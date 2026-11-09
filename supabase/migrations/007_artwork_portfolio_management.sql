-- Additive portfolio management. Review against the production catalog before applying.
-- No existing content, bucket or policy is removed or replaced.

alter table public.artworks
  add column if not exists year integer check (year between 1000 and 9999),
  add column if not exists show_in_cabinet boolean not null default true,
  add column if not exists display_order integer not null default 0;

create index if not exists artworks_public_listing_idx
  on public.artworks (category, show_in_cabinet, display_order, created_at)
  where status = 'published';

create unique index if not exists artwork_media_one_cover_per_artwork_idx
  on public.artwork_media (artwork_id) where is_cover;

-- Keeps the private bucket private. A file is readable only when it is the
-- recorded media of a published work; drafts remain inaccessible by path.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'published artwork media is readable'
  ) then
    create policy "published artwork media is readable" on storage.objects
      for select
      using (
        bucket_id = 'artworks'
        and exists (
          select 1
          from public.artwork_media media
          join public.artworks artwork on artwork.id = media.artwork_id
          where media.storage_path = name and artwork.status = 'published'
        )
      );
  end if;
end;
$$;

-- SQL privileges are required in addition to RLS. The policies from 001 and
-- this migration remain the authorization boundary for anonymous reads.
grant select on public.artworks, public.artwork_media to anon, authenticated;
grant insert, update, delete on public.artworks, public.artwork_media to authenticated;
