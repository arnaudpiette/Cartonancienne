-- Supabase CLI runs this file and records its version in a single transaction.
-- If executing manually, wrap the complete file and history registration in one transaction.

-- Keep legacy for rollback, but expose only the retry-safe wrapper.
revoke execute on function public.create_public_booking(text,timestamptz,text,text) from public, anon, authenticated;

do $guard$
declare wrapper oid := 'public.create_public_booking_once(uuid,text,timestamptz,text,text)'::regprocedure;
        legacy oid := 'public.create_public_booking(text,timestamptz,text,text)'::regprocedure;
        owner_id oid; is_definer boolean;
begin
  select proowner, prosecdef into owner_id, is_definer from pg_proc where oid=wrapper;
  if not is_definer or not has_function_privilege(owner_id,legacy,'EXECUTE') then
    raise exception 'booking wrapper cannot safely execute legacy function';
  end if;
end $guard$;

-- PostgreSQL cannot change a table return type with CREATE OR REPLACE. For the
-- exact known legacy body only, preserve the owner and direct grants while
-- recreating the function inside this transaction; DROP never uses CASCADE.
do $normalize$
declare
  fn oid := 'public.claim_booking_notification_delivery(uuid,text,uuid)'::regprocedure;
  ret text; body text; definition text; owner_name name; acl record; grants text[] := '{}';
begin
  select pg_get_function_result(p.oid), p.prosrc, pg_get_functiondef(p.oid), r.rolname
    into ret, body, definition, owner_name
    from pg_proc p join pg_roles r on r.oid=p.proowner where p.oid=fn;
  if ret = 'TABLE(claimed boolean, lease_id uuid, event_at timestamp with time zone)' then
    return;
  end if;
  if ret <> 'TABLE(claimed boolean, lease_id uuid)' or body <> $oldbody$
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
$oldbody$ then
    raise exception 'unknown claim function contract or body; manual review required';
  end if;
  for acl in
    select a.grantee, a.is_grantable, r.rolname from pg_proc p
    cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    left join pg_roles r on r.oid=a.grantee where p.oid=fn and a.privilege_type='EXECUTE'
  loop
    grants := array_append(grants, format('grant execute on function public.claim_booking_notification_delivery(uuid,text,uuid) to %s%s',
       case when acl.grantee=0 then 'PUBLIC' else quote_ident(acl.rolname) end,
       case when acl.is_grantable then ' with grant option' else '' end));
  end loop;
  definition := replace(definition, 'RETURNS TABLE(claimed boolean, lease_id uuid)',
                                     'RETURNS TABLE(claimed boolean, lease_id uuid, event_at timestamp with time zone)');
  definition := replace(definition, 'return query select false, null::uuid;', 'return query select false, null::uuid, n.created_at;');
  definition := replace(definition, 'return query select true, new_lease;', 'return query select true, new_lease, n.created_at;');
  if position('event_at timestamp with time zone' in definition)=0
     or position('select false, null::uuid, n.created_at;' in definition)=0
     or position('select true, new_lease, n.created_at;' in definition)=0 then
    raise exception 'claim function transformation failed';
  end if;
  drop function public.claim_booking_notification_delivery(uuid,text,uuid);
  execute definition;
  execute format('alter function public.claim_booking_notification_delivery(uuid,text,uuid) owner to %I',owner_name);
  revoke all on function public.claim_booking_notification_delivery(uuid,text,uuid) from public;
  foreach definition in array grants loop execute definition; end loop;
end $normalize$;

alter function public.admin_booking() set search_path = public, pg_temp;
-- Cover foreign keys without changing existing rows. Non-concurrent creation
-- takes a write-blocking lock: assess the tables and maintenance window first.
create index if not exists appointments_service_slug_idx on public.appointments(service_slug);
create index if not exists booking_notifications_appointment_id_idx on public.booking_notifications(appointment_id);

do $indexes$
begin
  if not exists (select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
                 where c.oid='public.appointments_service_slug_idx'::regclass
                   and i.indrelid='public.appointments'::regclass and i.indisvalid and i.indisready
                   and not i.indisunique and i.indpred is null and i.indexprs is null
                   and i.indnkeyatts=1 and i.indnatts=1
                   and (select attname from pg_attribute where attrelid=i.indrelid and attnum=i.indkey[0])='service_slug')
     or not exists (select 1 from pg_index i join pg_class c on c.oid=i.indexrelid
                 where c.oid='public.booking_notifications_appointment_id_idx'::regclass
                   and i.indrelid='public.booking_notifications'::regclass and i.indisvalid and i.indisready
                   and not i.indisunique and i.indpred is null and i.indexprs is null
                   and i.indnkeyatts=1 and i.indnatts=1
                   and (select attname from pg_attribute where attrelid=i.indrelid and attnum=i.indkey[0])='appointment_id') then
    raise exception 'index name exists with an unexpected definition';
  end if;
end $indexes$;
