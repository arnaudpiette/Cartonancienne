export const bookingServices = {
  'tarot-solo': { title: 'Tarot Solo', price: 50, duration: 60, description: 'Une question à poser, un domaine à explorer avec le tarot de Marseille.' },
  'roue-astrologique': { title: 'Tarot Roue', price: 70, duration: 90, description: 'Une lecture à 12 cartes, pour accompagner le mouvement de votre année et éclairer les secteurs de vie.' },
} as const;

export type BookingServiceSlug = keyof typeof bookingServices;

export function isBookingService(value: string | null | undefined): value is BookingServiceSlug {
  return !!value && Object.hasOwn(bookingServices, value);
}

export const paymentOnSite = 'Paiement sur place le jour de votre séance. Aucun paiement en ligne n’est demandé.';

export function parisDay(value = new Date()) {
  return value.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' });
}

export function isBookingDay(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function reservationHref(service: BookingServiceSlug) {
  return `/reservation?offre=${service}`;
}

export function formatParis(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}
