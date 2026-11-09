import type { APIRoute } from 'astro';
import { supabaseServer } from '../../lib/supabase';

/** A private-bucket image proxy. Every request rechecks published status through RLS. */
export const GET: APIRoute = async ({ url, cookies, request }) => {
  const slug = url.searchParams.get('slug');
  if (!slug) return new Response('Not found', { status: 404 });
  const client = supabaseServer(cookies, request);
  if (!client) return new Response('Not found', { status: 404 });
  const { data: artwork } = await client.from('artworks')
    .select('artwork_media(storage_path,position,is_cover)')
    .eq('slug', slug).eq('status', 'published').single();
  const media = [...(artwork?.artwork_media ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position)[0];
  if (!media) return new Response('Not found', { status: 404 });
  const { data, error } = await client.storage.from('artworks').download(media.storage_path);
  if (error || !data) return new Response('Not found', { status: 404 });
  return new Response(data, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=60, s-maxage=60' } });
};
