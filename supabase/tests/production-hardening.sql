-- Execute only against a disposable local database. All fixtures are rolled back.
\set ON_ERROR_STOP on
begin;
do $$
declare legacy oid := 'public.create_public_booking(text,timestamptz,text,text)'::regprocedure;
        wrapper oid := 'public.create_public_booking_once(uuid,text,timestamptz,text,text)'::regprocedure;
        claim oid := 'public.claim_booking_notification_delivery(uuid,text,uuid)'::regprocedure;
        role_name text;
begin
  foreach role_name in array array['anon','authenticated'] loop
    if has_function_privilege(role_name,legacy,'EXECUTE') then raise exception 'legacy remains executable: %',role_name; end if;
    if not has_function_privilege(role_name,wrapper,'EXECUTE') then raise exception 'wrapper is inaccessible: %',role_name; end if;
  end loop;
  if exists(select 1 from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x where p.oid=legacy and x.grantee=0 and x.privilege_type='EXECUTE') then raise exception 'legacy PUBLIC grant'; end if;
  if pg_get_function_result(claim) <> 'TABLE(claimed boolean, lease_id uuid, event_at timestamp with time zone)' then raise exception 'unexpected claim signature'; end if;
  if not exists(select 1 from pg_proc where oid='public.admin_booking()'::regprocedure and proconfig @> array['search_path=public, pg_temp']) then raise exception 'admin search_path'; end if;
  if not exists(select 1 from pg_index where indexrelid='public.appointments_service_slug_idx'::regclass and indisvalid)
    or not exists(select 1 from pg_index where indexrelid='public.booking_notifications_appointment_id_idx'::regclass and indisvalid) then raise exception 'index missing'; end if;
  if exists(select 1 from pg_class where oid in ('public.appointments'::regclass,'public.booking_notifications'::regclass,'public.booking_notification_deliveries'::regclass) and not relrowsecurity) then raise exception 'RLS disabled'; end if;
end $$;
insert into public.availability_windows(start_at,end_at,kind) values ('2035-01-04 08:00+00','2035-01-04 16:00+00','open');
set local role anon;
do $$
declare a record; b record; lease1 record; lease2 record; rejected boolean := false;
begin
  begin perform public.create_public_booking('tarot-solo','2035-01-04 09:00+00','Test Local','fixture@example.invalid');
  exception when insufficient_privilege then rejected:=true; end;
  if not rejected then raise exception 'anon legacy unexpectedly succeeded'; end if;
  select * into a from public.create_public_booking_once('11111111-1111-4111-8111-111111111111','tarot-solo','2035-01-04 09:00+00','Test Local','fixture@example.invalid');
  select * into b from public.create_public_booking_once('11111111-1111-4111-8111-111111111111','tarot-solo','2035-01-04 09:00+00','Test Local','fixture@example.invalid');
  if a.id is null or a.id is distinct from b.id or a.notification_id is distinct from b.notification_id then raise exception 'idempotency failed'; end if;
  rejected := false;
  begin perform public.create_public_booking_once('22222222-2222-4222-8222-222222222222','tarot-solo','2035-01-04 09:00+00','Test Local','fixture@example.invalid');
  exception when raise_exception then if sqlerrm in ('slot_conflict','slot_unavailable') then rejected:=true; else raise; end if; end;
  if not rejected then raise exception 'overlap succeeded'; end if;
  select * into lease1 from public.claim_booking_notification_delivery(a.notification_id,'customer',a.notification_token);
  select * into lease2 from public.claim_booking_notification_delivery(a.notification_id,'customer',a.notification_token);
  if not lease1.claimed or lease1.lease_id is null or lease1.event_at is null or lease2.claimed then raise exception 'claim lease failed'; end if;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
do $$
declare denied boolean:=false; n integer;
begin
  begin perform public.create_public_booking('tarot-solo','2035-01-04 11:00+00','Test Local','fixture@example.invalid');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'authenticated legacy unexpectedly succeeded'; end if;
  select count(*) into n from public.appointments; if n<>0 then raise exception 'appointments RLS leaked rows'; end if;
  select count(*) into n from public.booking_notifications; if n<>0 then raise exception 'notifications RLS leaked rows'; end if;
  denied:=false;
  begin perform public.admin_set_availability('2035-01-04 10:00','2035-01-04 11:00','open',null);
  exception when raise_exception then if sqlerrm='forbidden' then denied:=true; else raise; end if; end;
  if not denied then raise exception 'admin authorization failed'; end if;
end $$;
reset role;
rollback;
