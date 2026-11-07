-- Run in Supabase SQL editor. The authenticated account must have app_metadata.role = 'admin'.
create table if not exists public.artworks (
 id uuid primary key default gen_random_uuid(), title text not null, slug text unique, category text not null check (category in ('illustration','ceramique')), description text default '', status text not null default 'draft' check (status in ('draft','published')), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.artwork_media (
 id uuid primary key default gen_random_uuid(), artwork_id uuid not null references public.artworks(id) on delete cascade, storage_path text not null unique, alt_text text not null, credit text, position integer not null default 0, is_cover boolean not null default false, width integer, height integer, created_at timestamptz not null default now());
alter table public.artworks enable row level security; alter table public.artwork_media enable row level security;
create policy "published artworks are public" on public.artworks for select using (status = 'published' or (auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "admin manages artworks" on public.artworks for all using ((auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
create policy "public sees published media" on public.artwork_media for select using (exists(select 1 from public.artworks a where a.id=artwork_id and (a.status='published' or (auth.jwt()->'app_metadata'->>'role')='admin')));
create policy "admin manages media" on public.artwork_media for all using ((auth.jwt()->'app_metadata'->>'role') = 'admin') with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types) values ('artworks','artworks',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
create policy "admin uploads artwork media" on storage.objects for insert to authenticated with check (bucket_id='artworks' and (auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin reads artwork media" on storage.objects for select to authenticated using (bucket_id='artworks' and (auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin updates artwork media" on storage.objects for update to authenticated using (bucket_id='artworks' and (auth.jwt()->'app_metadata'->>'role')='admin');
create policy "admin deletes artwork media" on storage.objects for delete to authenticated using (bucket_id='artworks' and (auth.jwt()->'app_metadata'->>'role')='admin');
