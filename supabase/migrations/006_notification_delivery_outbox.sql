-- Keep the existing notification rows as the event outbox and record each recipient separately.
alter table public.booking_notifications
  add column if not exists notification_token uuid not null default gen_random_uuid();

create unique index if not exists booking_notifications_notification_token_key
  on public.booking_notifications(notification_token);

create table if not exists public.booking_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.booking_notifications(id) on delete cascade,
  recipient text not null check (recipient in ('customer', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  locked_at timestamptz,
  lease_id uuid,
  created_at timestamptz not null default now(),
  unique (notification_id, recipient)
);

alter table public.booking_notification_deliveries enable row level security;
create policy "admin reads notification deliveries" on public.booking_notification_deliveries
  for select using (public.admin_booking());

create or replace function public.create_notification_deliveries()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.booking_notification_deliveries(notification_id, recipient)
  values (new.id, 'customer'), (new.id, 'admin')
  on conflict (notification_id, recipient) do nothing;
  return new;
end;
$$;

drop trigger if exists booking_notifications_create_deliveries on public.booking_notifications;
create trigger booking_notifications_create_deliveries
after insert on public.booking_notifications
for each row execute function public.create_notification_deliveries();

-- A caller may claim an initial public-booking delivery only with the short-lived
-- opaque token returned by create_public_booking. Administrators may retry later.
create or replace function public.claim_booking_notification_delivery(
  p_notification_id uuid,
  p_recipient text,
  p_notification_token uuid default null
) returns table(claimed boolean, lease_id uuid)
language plpgsql security definer set search_path=public as $$
declare n public.booking_notifications%rowtype; d public.booking_notification_deliveries%rowtype; new_lease uuid;
begin
  if p_recipient not in ('customer', 'admin') then raise exception 'invalid_recipient'; end if;
  select * into n from public.booking_notifications where id=p_notification_id for update;
  if n.id is null then raise exception 'notification_not_found'; end if;
  if not public.admin_booking() and (p_notification_token is null or p_notification_token <> n.notification_token or n.created_at < now() - interval '15 minutes') then
    raise exception 'forbidden';
  end if;
  select * into d from public.booking_notification_deliveries where notification_id=p_notification_id and recipient=p_recipient for update;
  if d.id is null then
    insert into public.booking_notification_deliveries(notification_id, recipient) values (p_notification_id, p_recipient) returning * into d;
  end if;
  if d.status = 'sent' or (d.status = 'sending' and d.locked_at > now() - interval '15 minutes') then
    return query select false, null::uuid;
    return;
  end if;
  new_lease := gen_random_uuid();
  update public.booking_notification_deliveries
    set status='sending', attempts=attempts+1, locked_at=now(), lease_id=new_lease, last_error=null
    where id=d.id;
  update public.booking_notifications set attempts=attempts+1, status='pending', last_error=null where id=p_notification_id;
  return query select true, new_lease;
end;
$$;

create or replace function public.complete_booking_notification_delivery(
  p_notification_id uuid,
  p_recipient text,
  p_lease_id uuid,
  p_success boolean,
  p_error text default null,
  p_notification_token uuid default null
) returns void
language plpgsql security definer set search_path=public as $$
declare n public.booking_notifications%rowtype; customer_status text; admin_status text;
begin
  if p_recipient not in ('customer', 'admin') then raise exception 'invalid_recipient'; end if;
  select * into n from public.booking_notifications where id=p_notification_id for update;
  if n.id is null then raise exception 'notification_not_found'; end if;
  if not public.admin_booking() and (p_notification_token is null or p_notification_token <> n.notification_token or n.created_at < now() - interval '15 minutes') then
    raise exception 'forbidden';
  end if;
  update public.booking_notification_deliveries
    set status=case when p_success then 'sent' else 'failed' end,
        sent_at=case when p_success then now() else null end,
        last_error=case when p_success then null else coalesce(nullif(left(p_error, 1000), ''), 'Erreur d’envoi') end,
        locked_at=null, lease_id=null
    where notification_id=p_notification_id and recipient=p_recipient and status='sending' and lease_id=p_lease_id;
  if not found then raise exception 'delivery_lease_not_owned'; end if;
  select max(status) filter (where recipient='customer'), max(status) filter (where recipient='admin')
    into customer_status, admin_status from public.booking_notification_deliveries where notification_id=p_notification_id;
  update public.booking_notifications
    set status=case when customer_status='sent' and admin_status='sent' then 'sent'
                    when customer_status='failed' or admin_status='failed' then 'failed'
                    else 'pending' end,
        last_error=case when customer_status='failed' or admin_status='failed' then coalesce(
          (select last_error from public.booking_notification_deliveries where notification_id=p_notification_id and status='failed' order by created_at desc limit 1), 'Erreur d’envoi') else null end,
        sent_at=case when customer_status='sent' and admin_status='sent' then now() else null end
    where id=p_notification_id;
end;
$$;

drop function public.create_public_booking(text, timestamptz, text, text);
create function public.create_public_booking(p_service_slug text, p_start_at timestamptz, p_customer_name text, p_customer_email text)
returns table(id uuid,start_at timestamptz,notification_id uuid,notification_token uuid)
language plpgsql security definer set search_path=public as $$
declare duration integer; calculated_end timestamptz; appointment_id uuid; outbox_id uuid; outbox_token uuid;
begin
  select duration_minutes into duration from public.booking_services where slug=p_service_slug and active;
  if duration is null then raise exception 'invalid_service'; end if;
  calculated_end := p_start_at + make_interval(mins => duration);
  if not exists (select 1 from public.public_available_slots(p_service_slug, (p_start_at at time zone 'Europe/Paris')::date) as slot where slot.start_at=p_start_at) then raise exception 'slot_unavailable'; end if;
  insert into public.appointments(service_slug,customer_name,customer_email,start_at,end_at)
    values (p_service_slug,trim(p_customer_name),lower(trim(p_customer_email)),p_start_at,calculated_end) returning appointments.id into appointment_id;
  insert into public.booking_notifications(appointment_id,event) values(appointment_id,'confirmed')
    returning booking_notifications.id, booking_notifications.notification_token into outbox_id, outbox_token;
  return query select appointment_id,p_start_at,outbox_id,outbox_token;
exception when exclusion_violation then raise exception 'slot_conflict';
end;
$$;

revoke all on table public.booking_notification_deliveries from anon, authenticated;
revoke execute on function public.create_notification_deliveries() from public, anon, authenticated;
grant select on table public.booking_notification_deliveries to authenticated;
grant execute on function public.create_public_booking(text,timestamptz,text,text), public.claim_booking_notification_delivery(uuid,text,uuid), public.complete_booking_notification_delivery(uuid,text,uuid,boolean,text,uuid) to anon, authenticated;
