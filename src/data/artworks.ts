import type { ImageMetadata } from 'astro';
import egg from '../assets/originals/oeuf-phenix-ivoire-ombre-douce.png';
import crabPlate from '../assets/originals/assiette-au-crabe.png';
import laLune from '../assets/originals/la-lune.jpg';
import carnet from '../assets/editorial/illustrations/01.webp';
import poulpeSgraffite from '../assets/editorial/ceramiques/sgraffite/10.webp';
import cristaux from '../assets/editorial/tarot/03.webp';
import { oeuvres as artworkContent } from '../lib/content';

export type ArtworkCategory = 'illustration' | 'ceramique';

export type Artwork = {
  slug: string;
  title: string;
  category: ArtworkCategory;
  categoryLabel: string;
  image?: ImageMetadata;
  imageUrl?: string;
  alt: string;
  credit: string;
  description: string;
  year?: number | null;
};

const artworkImages = new Map<string, ImageMetadata>([
  ['la-lune', laLune],
  ['oeuf-phenix', egg],
  ['assiette-au-crabe', crabPlate],
  ['carnet-moleskine', carnet],
  ['assiette-au-poulpe', poulpeSgraffite],
  ['cristaux', cristaux],
]);

export const artworks: Artwork[] = artworkContent.artworks.map((artwork) => {
  const image = artworkImages.get(artwork.slug);
  if (!image) throw new Error(`Missing local image for artwork: ${artwork.slug}`);
  if (artwork.category !== 'illustration' && artwork.category !== 'ceramique') {
    throw new Error(`Unknown artwork category: ${artwork.category}`);
  }
  return { ...artwork, category: artwork.category, image };
});

export const pendingIllustrations = ['Gloria — visuel original et fiche à fournir'];
