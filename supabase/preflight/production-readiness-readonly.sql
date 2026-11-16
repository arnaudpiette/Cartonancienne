-- Execute separately in each authorized Supabase SQL Editor.
-- Catalog metadata and aggregate counts only. No application RPC is called.

SELECT current_setting('server_version') AS postgres_version,
       current_database() AS database_name;

SELECT nspname AS schema_name
FROM pg_namespace
WHERE nspname IN ('public', 'auth', 'storage', 'supabase_migrations', 'extensions')
ORDER BY nspname;

SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname;

SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

SELECT c.relname AS table_name, con.conname AS constraint_name,
       con.contype AS constraint_type, pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, con.conname;

SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check
FROM pg_policies
WHERE (schemaname = 'public' AND tablename IN
       ('artworks', 'artwork_media', 'booking_services', 'availability_windows',
        'appointments', 'booking_notifications', 'booking_notification_deliveries',
        'booking_request_keys'))
   OR (schemaname = 'storage' AND tablename = 'objects')
ORDER BY schemaname, tablename, policyname;

SELECT p.proname AS function_name,
       pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS returns,
       p.prosecdef AS security_definer, p.provolatile AS volatility,
       p.proconfig AS settings,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN
      ('admin_booking', 'admin_change_appointment', 'admin_set_availability',
       'claim_booking_notification_delivery',
       'complete_booking_notification_delivery', 'create_notification_deliveries',
       'create_public_booking', 'create_public_booking_once',
       'public_available_slots')
ORDER BY p.proname, arguments;

SELECT p.proname AS function_name, pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN
      ('admin_booking', 'admin_change_appointment', 'admin_set_availability',
       'claim_booking_notification_delivery',
       'complete_booking_notification_delivery', 'create_notification_deliveries',
       'create_public_booking', 'create_public_booking_once',
       'public_available_slots')
ORDER BY p.proname;

SELECT c.relname AS table_name, t.tgname AS trigger_name,
       pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

SELECT schemaname, sequencename
FROM pg_sequences
WHERE schemaname = 'public'
ORDER BY sequencename;

SELECT e.extname AS extension_name, n.nspname AS schema_name,
       e.extversion AS version
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
ORDER BY e.extname;

SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'artworks';

SELECT c.relname AS table_name,
       CASE WHEN a.grantee = 0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type, a.is_grantable
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
 CROSS JOIN LATERAL aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) a
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
ORDER BY c.relname, grantee, a.privilege_type;

SELECT 'artworks' AS object_name, count(*) AS total FROM public.artworks
UNION ALL SELECT 'artwork_media', count(*) FROM public.artwork_media
UNION ALL SELECT 'availability_windows', count(*) FROM public.availability_windows
UNION ALL SELECT 'appointments', count(*) FROM public.appointments
UNION ALL SELECT 'booking_notifications', count(*) FROM public.booking_notifications
UNION ALL SELECT 'booking_notification_deliveries', count(*) FROM public.booking_notification_deliveries
UNION ALL SELECT 'booking_request_keys', count(*) FROM public.booking_request_keys
UNION ALL SELECT 'booking_services', count(*) FROM public.booking_services
UNION ALL SELECT 'storage_artworks_objects', count(*) FROM storage.objects WHERE bucket_id = 'artworks';

SELECT 'artworks' AS object_name, status, count(*) AS total
FROM public.artworks GROUP BY status
UNION ALL SELECT 'appointments', status, count(*) FROM public.appointments GROUP BY status
UNION ALL SELECT 'availability_windows', kind, count(*) FROM public.availability_windows GROUP BY kind
UNION ALL SELECT 'booking_notifications', status, count(*) FROM public.booking_notifications GROUP BY status
UNION ALL SELECT 'booking_notification_deliveries', status, count(*) FROM public.booking_notification_deliveries GROUP BY status
ORDER BY object_name, status;

SELECT count(*) AS confirmed_admin_accounts
FROM auth.users
WHERE email_confirmed_at IS NOT NULL
  AND raw_app_meta_data ->> 'role' = 'admin';

SELECT artwork_id, count(*) AS cover_count
FROM public.artwork_media
WHERE is_cover
GROUP BY artwork_id
HAVING count(*) > 1;

SELECT version, name
FROM supabase_migrations.schema_migrations
ORDER BY version;
