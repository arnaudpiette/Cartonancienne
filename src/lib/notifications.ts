import { bookingServices, formatParis, paymentOnSite, type BookingServiceSlug } from '../data/booking';

export type BookingMail = { bookingId: string; service: BookingServiceSlug; startAt: string; customerName: string; customerEmail: string; kind: 'confirmed' | 'changed' | 'cancelled'; duration?: number; price?: number; eventAt?: string };
export type BookingRecipient = 'customer' | 'admin';
export const bookingSender = 'La Cartonancienne <reservations@lacartonancienne.com>';
type TimestampedMail = BookingMail & { eventAt: string };

export function bookingIcs(mail: TimestampedMail) {
  const stamp = new Date(mail.eventAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(mail.startAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(new Date(mail.startAt).getTime() + (mail.duration ?? bookingServices[mail.service].duration) * 60_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//La Cartonancienne//Agenda//FR', `METHOD:${mail.kind === 'cancelled' ? 'CANCEL' : 'REQUEST'}`, 'BEGIN:VEVENT', `UID:${mail.bookingId}@lacartonancienne.fr`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${bookingServices[mail.service].title} — La Cartonancienne`, `STATUS:${mail.kind === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

/** The visible sender is the domain address; replies and internal notices reach the creator. */
export function bookingMailPayload(mail: TimestampedMail, recipient: BookingRecipient, settings: { adminEmail: string; from?: string }) {
  if (!settings.adminEmail) throw new Error('Adresse administrateur non configurée');
  return {
    from: settings.from || bookingSender,
    to: [recipient === 'customer' ? mail.customerEmail : settings.adminEmail],
    reply_to: recipient === 'customer' ? settings.adminEmail : mail.customerEmail,
    subject: `${mail.kind === 'cancelled' ? 'Annulation' : mail.kind === 'changed' ? 'Rendez-vous déplacé' : 'Réservation'} — ${bookingServices[mail.service].title}`,
    text: bookingMailText(mail, recipient),
    attachments: [{ filename: 'rendez-vous.ics', content: Buffer.from(bookingIcs(mail)).toString('base64') }],
  };
}

export async function sendBookingMail(payload: ReturnType<typeof bookingMailPayload>, apiKey: string, idempotencyKey: string, fetcher: typeof fetch = fetch) {
  if (!apiKey) throw new Error('PRIVATE_RESEND_API_KEY manquante');
  const response = await fetcher('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Envoi transactionnel refusé (${response.status})`);
  const result = await response.json();
  if (typeof result.id !== 'string' || !result.id) throw new Error('Réponse du service d’envoi invalide');
  return { delivered: true, simulated: false, messageId: result.id };
}

/** Delivery is opt-in: tests stay simulated unless PRIVATE_BOOKING_MAIL_MODE is exactly "live". */
export async function notifyBookingRecipient(mail: BookingMail, recipient: BookingRecipient, notificationId: string) {
  const apiKey = import.meta.env.PRIVATE_RESEND_API_KEY;
  const admin = import.meta.env.PRIVATE_ADMIN_EMAIL;
  const to = recipient === 'customer' ? mail.customerEmail : admin;
  if (!to) throw new Error(`Destinataire ${recipient} non configuré`);
  if (import.meta.env.PRIVATE_BOOKING_MAIL_MODE !== 'live') {
    const simulatedFailures = String(import.meta.env.PRIVATE_BOOKING_MAIL_SIMULATE_FAILURES || '').split(',').map((value) => value.trim());
    if (simulatedFailures.includes(recipient)) throw new Error(`Échec simulé pour ${recipient}`);
    console.info('[booking notification simulated]', { bookingId: mail.bookingId, recipient });
    return { delivered: true, simulated: true };
  }
  if (!mail.eventAt || Number.isNaN(Date.parse(mail.eventAt))) throw new Error('Horodatage de notification absent : vérifier les migrations');
  const payload = bookingMailPayload({ ...mail, eventAt: mail.eventAt }, recipient, { adminEmail: admin, from: import.meta.env.PRIVATE_MAIL_FROM });
  return sendBookingMail(payload, apiKey, `booking-${notificationId}-${recipient}`);
}

export function bookingMailText(mail: BookingMail, recipient: BookingRecipient) {
  const offer = bookingServices[mail.service];
  const intro = recipient === 'customer'
    ? `Bonjour ${mail.customerName},\n\nVotre rendez-vous est ${mail.kind === 'cancelled' ? 'annulé' : mail.kind === 'changed' ? 'déplacé' : 'enregistré'}.`
    : `Notification interne : ${mail.customerName} (${mail.customerEmail}) — ${mail.kind}.`;
  return `${intro}\n\n${offer.title}\n${formatParis(mail.startAt)} · Europe/Paris\nDurée : ${mail.duration ?? offer.duration} minutes\nTarif : ${mail.price ?? offer.price} €${mail.kind === 'cancelled' ? '' : `\n\n${paymentOnSite}`}\n\nPour toute question, répondez à cet e-mail.`;
}
