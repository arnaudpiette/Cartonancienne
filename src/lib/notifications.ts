import { bookingServices, type BookingServiceSlug } from '../data/booking';

type BookingMail = { bookingId: string; service: BookingServiceSlug; startAt: string; customerName: string; customerEmail: string; kind: 'confirmed' | 'changed' | 'cancelled' };

export function bookingIcs(mail: BookingMail) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(mail.startAt).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const end = new Date(new Date(mail.startAt).getTime() + bookingServices[mail.service].duration * 60_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//La Cartonancienne//Agenda//FR', 'BEGIN:VEVENT', `UID:${mail.bookingId}@lacartonancienne.fr`, `DTSTAMP:${stamp}`, `DTSTART:${start}`, `DTEND:${end}`, `SUMMARY:${bookingServices[mail.service].title} — La Cartonancienne`, `STATUS:${mail.kind === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, `METHOD:${mail.kind === 'cancelled' ? 'CANCEL' : 'REQUEST'}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

/** Delivery is opt-in: tests stay simulated unless PRIVATE_BOOKING_MAIL_MODE is exactly "live". */
export async function notifyBooking(mail: BookingMail) {
  const apiKey = import.meta.env.PRIVATE_RESEND_API_KEY;
  const admin = import.meta.env.PRIVATE_ADMIN_EMAIL;
  const subject = `${mail.kind === 'cancelled' ? 'Annulation' : 'Réservation'} — ${bookingServices[mail.service].title}`;
  const recipients = [mail.customerEmail, admin].filter(Boolean);
  if (import.meta.env.PRIVATE_BOOKING_MAIL_MODE !== 'live' || !apiKey || !admin) {
    console.info('[booking notification simulated]', { bookingId: mail.bookingId, recipients, subject });
    return { delivered: false, simulated: true };
  }
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: import.meta.env.PRIVATE_MAIL_FROM || 'La Cartonancienne <agenda@lacartonancienne.fr>', to: recipients, subject, text: `Bonjour ${mail.customerName},\n\nVotre rendez-vous est ${mail.kind === 'cancelled' ? 'annulé' : 'enregistré'}.`, attachments: [{ filename: 'rendez-vous.ics', content: Buffer.from(bookingIcs(mail)).toString('base64') }] }) });
  if (!response.ok) throw new Error(`Transactional mail failed (${response.status})`);
  return { delivered: true, simulated: false };
}
