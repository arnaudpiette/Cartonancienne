import { contact } from '../lib/content';

export const contactEmail = contact.email;
const motives = contact.motives;

export function contactHref(motif?: string) {
  const item = contactMotif(motif);
  return `mailto:${contactEmail}?subject=${encodeURIComponent(item.subject)}&body=${encodeURIComponent(item.body)}`;
}

export function contactPageHref(motif: string) {
  return `/contact?motif=${encodeURIComponent(motif)}`;
}

export function contactMotif(motif?: string) {
  return motives[motif || ''] || motives.ateliers;
}
