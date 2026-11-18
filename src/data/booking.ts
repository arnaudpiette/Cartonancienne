import { reservation, tarot } from '../lib/content';

export const bookingServices = {
  'tarot-solo': tarot.bookingServices.solo,
  'roue-astrologique': tarot.bookingServices.astrologicalWheel,
} as const;

export type BookingServiceSlug = keyof typeof bookingServices;

export function isBookingService(value: string | null | undefined): value is BookingServiceSlug {
  return !!value && Object.hasOwn(bookingServices, value);
}

export const paymentOnSite = reservation.paymentOnSite;

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
