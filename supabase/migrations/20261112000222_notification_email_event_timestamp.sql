-- Stable notification time keeps Resend retry payloads byte-identical.
-- Existing clients ignore the additive response field. No booking or delivery row is changed.
begin;
drop function public.claim_booking_notification_delivery(uuid,text,uuid);
create or replace function public.claim_booking_notification_delivery(
  p_notification_id uuid,
  p_recipient text,
  p_notification_token uuid default null
) returns table(claimed boolean, lease_id uuid, event_at timestamptz)
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
    return query select false, null::uuid, n.created_at;
    return;
  end if;
  new_lease := gen_random_uuid();
  update public.booking_notification_deliveries
    set status='sending', attempts=attempts+1, locked_at=now(), lease_id=new_lease, last_error=null
    where id=d.id;
  update public.booking_notifications set attempts=attempts+1, status='pending', last_error=null where id=p_notification_id;
  return query select true, new_lease, n.created_at;
end;
$$;
revoke execute on function public.claim_booking_notification_delivery(uuid,text,uuid) from public;
grant execute on function public.claim_booking_notification_delivery(uuid,text,uuid) to anon, authenticated;
commit;
