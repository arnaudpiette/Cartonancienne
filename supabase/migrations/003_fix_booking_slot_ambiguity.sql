-- Repairs the already-deployed booking function without altering appointments or availability.
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

grant execute on function public.create_public_booking(text,timestamptz,text,text) to anon, authenticated;
