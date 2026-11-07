export const contactEmail = 'severinepiettep@gmail.com';

const motives: Record<string, { label: string; subject: string; body: string }> = {
  'tarot-solo': { label: 'Rendez-vous solo', subject: 'Demande — rendez-vous tarot solo', body: 'Bonjour Séverine,\n\nJe souhaite demander un rendez-vous solo avec le tarot de Marseille.\n\nMerci,' },
  'roue-astrologique': { label: 'Roue astrologique', subject: 'Demande — roue astrologique', body: 'Bonjour Séverine,\n\nJe souhaite demander une lecture de la roue astrologique.\n\nMerci,' },
  'tarot-evenementiel': { label: 'Tarot événementiel', subject: 'Demande — tarot événementiel', body: 'Bonjour Séverine,\n\nJe souhaite vous parler d’une demande de tarot événementiel.\n\nMerci,' },
  'bon-tarot': { label: 'Le Bon Tarot', subject: 'Demande — Le Bon Tarot', body: 'Bonjour Séverine,\n\nJe souhaite en savoir plus sur Le Bon Tarot.\n\nMerci,' },
  ateliers: { label: 'Prochaines dates d’atelier', subject: 'Demande — prochaines dates d’atelier', body: 'Bonjour Séverine,\n\nJe souhaite recevoir les prochaines dates d’atelier.\n\nMerci,' },
  privatisation: { label: 'Privatisation d’atelier', subject: 'Demande — privatisation d’atelier', body: 'Bonjour Séverine,\n\nJe souhaite vous parler d’une privatisation d’atelier.\n\nMerci,' },
};

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
