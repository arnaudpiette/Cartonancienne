import type { Artwork, ArtworkCategory } from '../data/artworks';
import { supabaseServer } from './supabase';
import type { AstroCookies } from 'astro';

type ArtworkRow = {
  id: string; title: string; slug: string | null; category: ArtworkCategory;
  description: string | null; status: 'draft' | 'published'; year: number | null;
  show_in_cabinet: boolean; display_order: number;
  artwork_media: { storage_path: string; alt_text: string; credit: string | null; position: number; is_cover: boolean }[] | null;
};

export async function publishedPortfolio(cookies: AstroCookies, request: Request, category?: ArtworkCategory, cabinetOnly = false): Promise<Artwork[]> {
  const client = supabaseServer(cookies, request);
  if (!client) return [];
  let query = client.from('artworks').select('id,title,slug,category,description,status,year,show_in_cabinet,display_order,artwork_media(storage_path,alt_text,credit,position,is_cover)')
    .eq('status', 'published').not('slug', 'is', null).order('display_order').order('created_at');
  if (category) query = query.eq('category', category);
  if (cabinetOnly) query = query.eq('show_in_cabinet', true);
  const { data } = await query;
  const rows = (data ?? []) as ArtworkRow[];
  const items: (Artwork | null)[] = await Promise.all(rows.map(async (row) => {
    const media = [...(row.artwork_media ?? [])].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.position - b.position)[0];
    if (!media || !row.slug) return null;
    return { slug: row.slug, title: row.title, category: row.category, categoryLabel: row.category === 'ceramique' ? 'Céramique peinte' : 'Illustration', imageUrl: `/api/artwork-image?slug=${encodeURIComponent(row.slug)}`, alt: media.alt_text, credit: media.credit || 'Crédit non renseigné', description: row.description || '', year: row.year } as Artwork;
  }));
  return items.filter((item): item is Artwork => item !== null);
}
