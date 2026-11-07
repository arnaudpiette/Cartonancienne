import egg from '../assets/originals/oeuf-phenix-ivoire-ombre-douce.png';
import crabPlate from '../assets/originals/assiette-au-crabe.png';
import laLune from '../assets/originals/la-lune.jpg';

export type ArtworkCategory = 'illustration' | 'ceramique';

export type Artwork = {
  slug: string;
  title: string;
  category: ArtworkCategory;
  categoryLabel: string;
  image: ImageMetadata;
  alt: string;
  credit: string;
  description: string;
};

export const artworks: Artwork[] = [
  {
    slug: 'la-lune',
    title: 'La Lune',
    category: 'illustration',
    categoryLabel: 'Illustration',
    image: laLune,
    alt: 'Illustration au trait noir d’une femme tenant un médaillon, titrée La Lune.',
    credit: 'Crédit à confirmer',
    description: 'Illustration au trait noir portant le titre « La Lune ».',
  },
  {
    slug: 'oeuf-phenix',
    title: 'Œuf Phénix',
    category: 'ceramique',
    categoryLabel: 'Céramique peinte',
    image: egg,
    alt: 'Œuf en céramique ivoire, décoré d’un phénix bleu.',
    credit: 'Séverine Piette',
    description: 'Œuf en céramique ivoire peint d’un phénix bleu.',
  },
  {
    slug: 'assiette-au-crabe',
    title: 'Assiette au crabe',
    category: 'ceramique',
    categoryLabel: 'Céramique peinte',
    image: crabPlate,
    alt: 'Assiette en céramique blanche décorée d’un crabe bleu.',
    credit: 'Séverine Piette',
    description: 'Assiette en céramique décorée d’un crabe bleu.',
  },
];

export const pendingIllustrations = ['Gloria — visuel original et fiche à fournir'];
