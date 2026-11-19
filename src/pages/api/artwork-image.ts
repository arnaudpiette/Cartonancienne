import sharp from 'sharp';
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
  const width = Math.min(Math.max(Number(url.searchParams.get('w')) || 1200, 200), 2000);
  const body = await sharp(Buffer.from(await data.arrayBuffer())).rotate().resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  return new Response(body, { headers: { 'Content-Type': 'image/webp', 'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400' } });
};
