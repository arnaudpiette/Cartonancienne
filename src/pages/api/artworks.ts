import type { APIRoute } from 'astro'; import sharp from 'sharp'; import { isAdmin, supabaseServer } from '../../lib/supabase';
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!await isAdmin(cookies, request)) return new Response('Forbidden', { status: 403 });
  const data = await request.formData(); const client = supabaseServer(cookies, request); if (!client) return new Response('Supabase not configured', { status: 503 });
  const title = String(data.get('title') || '').trim(); const category = String(data.get('category') || '').trim(); const description = String(data.get('description') || '').trim(); const status = data.get('status') === 'published' ? 'published' : 'draft';
  if (!title || !['illustration','ceramique'].includes(category)) return new Response('Invalid artwork', { status: 400 });
  const { data: artwork, error } = await client.from('artworks').insert({ title, category, description, status }).select('id').single(); if (error || !artwork) return new Response('Could not save artwork', { status: 500 });
  const photos = data.getAll('photos').filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (photos.length > 12) return new Response('Maximum 12 photos', { status: 400 });
  for (const [index, photo] of photos.entries()) {
    if (!['image/jpeg','image/png','image/webp'].includes(photo.type) || photo.size > 10 * 1024 * 1024) return new Response('Unsupported image', { status: 400 });
    const source = Buffer.from(await photo.arrayBuffer()); const image = sharp(source, { limitInputPixels: 36_000_000 }); const meta = await image.metadata();
    if (!meta.width || !meta.height) return new Response('Invalid image', { status: 400 });
    const optimized = await image.rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).webp({ quality: 84 }).toBuffer();
    const path = `${artwork.id}/${crypto.randomUUID()}.webp`; const { error: uploadError } = await client.storage.from('artworks').upload(path, optimized, { contentType: 'image/webp', upsert: false });
    if (uploadError) return new Response('Could not upload image', { status: 500 });
    const alt = String(data.get(`alt-${index}`) || '').trim(); if (!alt) return new Response('Alt text required', { status: 400 });
    const position = Number(data.get(`position-${index}`) || index); const is_cover = String(data.get('cover') || '0') === String(index);
    const { error: mediaError } = await client.from('artwork_media').insert({ artwork_id: artwork.id, storage_path: path, alt_text: alt, credit: String(data.get(`credit-${index}`) || '').trim() || null, position: Number.isFinite(position) ? position : index, is_cover, width: meta.width, height: meta.height }); if (mediaError) return new Response('Could not save media', { status: 500 });
  }
  return redirect('/admin');
};
