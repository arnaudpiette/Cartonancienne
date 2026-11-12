-- Additive booking retry protection. Apply only to an isolated test database first.
-- Existing appointments, notification outbox, and overlap constraint are preserved.
begin;

create table public.booking_request_keys (
  request_id uuid primary key,
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.booking_request_keys enable row level security;
revoke all on table public.booking_request_keys from public, anon, authenticated;

create function public.create_public_booking_once(
  p_request_id uuid, p_service_slug text, p_start_at timestamptz,
  p_customer_name text, p_customer_email text
) returns table(id uuid, start_at timestamptz, notification_id uuid, notification_token uuid, duration_minutes integer, price_eur integer)
language plpgsql security definer set search_path=public as $$
declare existing public.appointments%rowtype; created record;
begin
  if p_request_id is null or p_start_at is null or
     p_customer_name is null or char_length(trim(p_customer_name)) not between 1 and 120 or
     p_customer_name ~ '[[:cntrl:]]' or p_customer_email is null or char_length(trim(p_customer_email)) > 254 or
     trim(p_customer_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'invalid_booking';
  end if;
  -- Serialize the same opaque request key, including concurrent HTTP retries.
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select a.* into existing from public.booking_request_keys k
    join public.appointments a on a.id=k.appointment_id where k.request_id=p_request_id;
  if existing.id is not null then
    if existing.service_slug is distinct from p_service_slug or existing.start_at is distinct from p_start_at or
       existing.customer_name is distinct from trim(p_customer_name) or existing.customer_email is distinct from lower(trim(p_customer_email)) then
      raise exception 'request_mismatch';
    end if;
    if existing.status <> 'confirmed' then raise exception 'booking_cancelled'; end if;
    return query select a.id, a.start_at, n.id, n.notification_token,
      (extract(epoch from (a.end_at-a.start_at))/60)::integer, s.price_eur
      from public.appointments a join public.booking_services s on s.slug=a.service_slug
      join public.booking_notifications n on n.appointment_id=a.id and n.event='confirmed'
      where a.id=existing.id order by n.created_at limit 1;
    return;
  end if;
  if p_start_at <= now() then raise exception 'slot_unavailable'; end if;
  -- The existing function rechecks availability and inserts under the GiST exclusion constraint.
  select * into created from public.create_public_booking(p_service_slug, p_start_at, p_customer_name, p_customer_email);
  insert into public.booking_request_keys(request_id, appointment_id) values(p_request_id, created.id);
  return query select created.id::uuid, created.start_at::timestamptz, created.notification_id::uuid,
    created.notification_token::uuid, s.duration_minutes, s.price_eur
    from public.booking_services s where s.slug=p_service_slug;
end;
$$;

revoke execute on function public.create_public_booking_once(uuid,text,timestamptz,text,text) from public;
grant execute on function public.create_public_booking_once(uuid,text,timestamptz,text,text) to anon, authenticated;
-- The wrapper calls this as its owner. Public creation must go through the retry-safe entry point.
revoke execute on function public.create_public_booking(text,timestamptz,text,text) from public, anon, authenticated;

commit;
