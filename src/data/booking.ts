export const bookingServices = {
  'tarot-solo': { title: 'Tirage solo', price: 50, duration: 60 },
  'roue-astrologique': { title: 'Roue astrologique', price: 70, duration: 90 },
} as const;

export type BookingServiceSlug = keyof typeof bookingServices;

export function isBookingService(value: string | null | undefined): value is BookingServiceSlug {
  return !!value && value in bookingServices;
}

export function reservationHref(service: BookingServiceSlug) {
  return `/reservation?offre=${service}`;
}

export function formatParis(value: string) {
  return new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'full', timeStyle: 'short' }).format(new Date(value));
}
