-- Qualifies availability columns to avoid collision with the function's return column names.
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

grant execute on function public.admin_change_appointment(uuid,timestamp,boolean) to authenticated;
