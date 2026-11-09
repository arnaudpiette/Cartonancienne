-- READ ONLY preflight for production. Run this whole file in Supabase SQL Editor.
-- It contains no DDL, DML, transaction control, or calls with side effects.

-- 1. Required tables and their columns.
select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where (n.nspname, c.relname) in (('public', 'artworks'), ('public', 'artwork_media'));

select table_schema, table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name in ('artworks', 'artwork_media')
order by table_name, ordinal_position;

-- 2. Existing constraints and indexes, including an existing one-cover rule.
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in ('public.artworks'::regclass, 'public.artwork_media'::regclass)
order by conrelid::regclass::text, conname;

select tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public' and tablename in ('artworks', 'artwork_media')
order by tablename, indexname;

-- 3. RLS policies on portfolio and Storage objects.
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where (schemaname = 'public' and tablename in ('artworks', 'artwork_media'))
   or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- 4. Functions related to portfolio management, if any.
select n.nspname as schema_name, p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
       pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and (p.proname ilike '%artwork%' or p.proname ilike '%portfolio%')
order by p.proname, arguments;

-- 5. Bucket configuration and files currently recorded by the portfolio.
select id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at
from storage.buckets where id = 'artworks';

select a.id as artwork_id, a.slug, a.status, m.id as media_id, m.storage_path, m.is_cover
from public.artworks a left join public.artwork_media m on m.artwork_id = a.id
order by a.created_at, m.position;

-- 6. Must return zero rows before adding the one-cover unique index.
select artwork_id, count(*) as cover_count, array_agg(id order by position) as media_ids
from public.artwork_media
where is_cover
group by artwork_id
having count(*) > 1;

-- 7. Migration metadata availability. If migration_relation is not null, run:
--    select * from supabase_migrations.schema_migrations order by version;
-- separately to avoid an error on projects where Supabase does not expose it.
select to_regclass('supabase_migrations.schema_migrations') as migration_relation;
