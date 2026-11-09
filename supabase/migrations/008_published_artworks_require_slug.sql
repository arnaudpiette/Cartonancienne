-- Additive publication invariant. Drafts may keep a null or blank slug.
-- Review in production before applying; this migration performs no data change.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.artworks'::regclass
      and conname = 'published_artworks_require_nonblank_slug'
  ) then
    alter table public.artworks
      add constraint published_artworks_require_nonblank_slug
      check (status <> 'published' or nullif(btrim(slug), '') is not null);
  end if;
end;
$$;
