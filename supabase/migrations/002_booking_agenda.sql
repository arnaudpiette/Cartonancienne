-- Booking data is always stored as timestamptz (UTC); interface conversion is Europe/Paris.
create extension if not exists btree_gist;

create table public.booking_services (
  slug text primary key check (slug in ('tarot-solo', 'roue-astrologique')),
  title text not null, duration_minutes integer not null check (duration_minutes in (60, 90)), price_eur integer not null check (price_eur > 0), active boolean not null default true
);
insert into public.booking_services (slug,title,duration_minutes,price_eur) values
  ('tarot-solo','Tirage solo',60,50), ('roue-astrologique','Roue astrologique',90,70) on conflict (slug) do update set title=excluded.title,duration_minutes=excluded.duration_minutes,price_eur=excluded.price_eur;

create table public.availability_windows (
  id uuid primary key default gen_random_uuid(), start_at timestamptz not null, end_at timestamptz not null,
  kind text not null check (kind in ('open','blocked')), note text, created_at timestamptz not null default now(),
  check (end_at > start_at)
);
create table public.appointments (
  id uuid primary key default gen_random_uuid(), service_slug text not null references public.booking_services(slug),
  customer_name text not null check (char_length(customer_name) between 1 and 120), customer_email text not null check (char_length(customer_email) between 3 and 254),
  start_at timestamptz not null, end_at timestamptz not null, status text not null default 'confirmed' check (status in ('confirmed','cancelled')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), cancelled_at timestamptz, cancellation_reason text,
  check (end_at > start_at)
);
alter table public.appointments add constraint appointments_no_active_overlap exclude using gist (tstzrange(start_at,end_at,'[)') with &&) where (status='confirmed');
create table public.booking_notifications (
  id uuid primary key default gen_random_uuid(), appointment_id uuid not null references public.appointments(id) on delete cascade,
  event text not null check (event in ('confirmed','changed','cancelled')), status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts integer not null default 0, last_error text, created_at timestamptz not null default now(), sent_at timestamptz
);

alter table public.booking_services enable row level security; alter table public.availability_windows enable row level security; alter table public.appointments enable row level security; alter table public.booking_notifications enable row level security;
create policy "admin manages availability" on public.availability_windows for all using ((auth.jwt()->'app_metadata'->>'role')='admin') with check ((auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin reads appointments" on public.appointments for select using ((auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin reads notifications" on public.booking_notifications for select using ((auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin manages notifications" on public.booking_notifications for update using ((auth.jwt()->'app_metadata'->>'role')='admin');
-- No direct public policies on contacts, availability or appointments.

create or replace function public.admin_booking() returns boolean language sql stable as $$ select coalesce(auth.jwt()->'app_metadata'->>'role' = 'admin', false) $$;

create or replace function public.public_available_slots(p_service_slug text, p_day date)
returns table(start_at timestamptz, end_at timestamptz) language sql security definer set search_path=public as $$
  with service as (select duration_minutes from booking_services where slug=p_service_slug and active),
  candidates as (select s as start_at, s + make_interval(mins => service.duration_minutes) as end_at from service cross join lateral generate_series(
    timezone('Europe/Paris', p_day::timestamp), timezone('Europe/Paris', (p_day + 1)::timestamp) - interval '30 minutes', interval '30 minutes') s)
  select c.start_at,c.end_at from candidates c where
    exists (select 1 from availability_windows w where w.kind='open' and tstzrange(w.start_at,w.end_at,'[)') @> tstzrange(c.start_at,c.end_at,'[)')) and
    not exists (select 1 from availability_windows w where w.kind='blocked' and tstzrange(w.start_at,w.end_at,'[)') && tstzrange(c.start_at,c.end_at,'[)')) and
    not exists (select 1 from appointments a where a.status='confirmed' and tstzrange(a.start_at,a.end_at,'[)') && tstzrange(c.start_at,c.end_at,'[)'))
  order by c.start_at;
$$;

create or replace function public.create_public_booking(p_service_slug text, p_start_at timestamptz, p_customer_name text, p_customer_email text)
returns table(id uuid,start_at timestamptz) language plpgsql security definer set search_path=public as $$
declare duration integer; calculated_end timestamptz; appointment_id uuid;
begin
  select duration_minutes into duration from booking_services where slug=p_service_slug and active;
  if duration is null then raise exception 'invalid_service'; end if;
  calculated_end := p_start_at + make_interval(mins => duration);
  if not exists (select 1 from public_available_slots(p_service_slug, (p_start_at at time zone 'Europe/Paris')::date) as slot where slot.start_at=p_start_at) then raise exception 'slot_unavailable'; end if;
  insert into appointments(service_slug,customer_name,customer_email,start_at,end_at) values (p_service_slug,trim(p_customer_name),lower(trim(p_customer_email)),p_start_at,calculated_end) returning appointments.id into appointment_id;
  insert into booking_notifications(appointment_id,event) values(appointment_id,'confirmed');
  return query select appointment_id,p_start_at;
exception when exclusion_violation then raise exception 'slot_conflict';
end; $$;

create or replace function public.admin_set_availability(p_start_local timestamp, p_end_local timestamp, p_kind text, p_note text default null)
returns uuid language plpgsql security definer set search_path=public as $$ declare window_id uuid; begin
  if not admin_booking() then raise exception 'forbidden'; end if;
  if p_kind not in ('open','blocked') then raise exception 'invalid_kind'; end if;
  if p_end_local <= p_start_local then raise exception 'invalid_range'; end if;
  if p_kind='blocked' and exists(select 1 from appointments where status='confirmed' and tstzrange(start_at,end_at,'[)') && tstzrange(p_start_local at time zone 'Europe/Paris', p_end_local at time zone 'Europe/Paris','[)')) then raise exception 'booking_conflict'; end if;
  insert into availability_windows(start_at,end_at,kind,note) values(p_start_local at time zone 'Europe/Paris',p_end_local at time zone 'Europe/Paris',p_kind,nullif(trim(p_note),'')) returning id into window_id; return window_id;
end; $$;

create or replace function public.admin_change_appointment(p_id uuid, p_start_local timestamp default null, p_cancel boolean default false)
returns table(id uuid,start_at timestamptz,status text) language plpgsql security definer set search_path=public as $$
declare duration integer; new_start timestamptz; new_end timestamptz; old_status text;
begin
  if not admin_booking() then raise exception 'forbidden'; end if;
  select a.status, s.duration_minutes into old_status,duration from appointments a join booking_services s on s.slug=a.service_slug where a.id=p_id for update;
  if old_status is null then raise exception 'not_found'; end if;
  if p_cancel then update appointments set status='cancelled',cancelled_at=now(),updated_at=now() where appointments.id=p_id returning appointments.id,appointments.start_at,appointments.status into id,start_at,status; insert into booking_notifications(appointment_id,event) values(p_id,'cancelled'); return next; return; end if;
  new_start:=p_start_local at time zone 'Europe/Paris'; new_end:=new_start+make_interval(mins=>duration);
  if not exists(select 1 from availability_windows w where w.kind='open' and tstzrange(w.start_at,w.end_at,'[)') @> tstzrange(new_start,new_end,'[)')) or exists(select 1 from availability_windows w where w.kind='blocked' and tstzrange(w.start_at,w.end_at,'[)') && tstzrange(new_start,new_end,'[)')) then raise exception 'slot_unavailable'; end if;
  update appointments set start_at=new_start,end_at=new_end,updated_at=now() where appointments.id=p_id returning appointments.id,appointments.start_at,appointments.status into id,start_at,status; insert into booking_notifications(appointment_id,event) values(p_id,'changed'); return next;
exception when exclusion_violation then raise exception 'slot_conflict'; end; $$;

revoke all on table public.booking_services, public.availability_windows, public.appointments, public.booking_notifications from anon, authenticated;
-- RLS remains the authorization boundary; authenticated administrators need these read/update grants for the agenda UI.
grant select on table public.availability_windows, public.appointments, public.booking_notifications to authenticated;
grant update on table public.booking_notifications to authenticated;
grant execute on function public.public_available_slots(text,date), public.create_public_booking(text,timestamptz,text,text) to anon, authenticated;
grant execute on function public.admin_set_availability(timestamp,timestamp,text,text), public.admin_change_appointment(uuid,timestamp,boolean) to authenticated;
