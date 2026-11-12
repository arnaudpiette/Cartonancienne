import type { APIRoute } from 'astro';
import { isBookingDay, isBookingService, parisDay } from '../../data/booking';
import { validateBooking } from '../../lib/booking-validation';
import { deliverBookingNotification } from '../../lib/booking-delivery';
import { supabaseServer } from '../../lib/supabase';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

export const GET: APIRoute = async ({ request, cookies, url }) => {
  const service = url.searchParams.get('service');
  const day = url.searchParams.get('day') || '';
  if (!isBookingService(service) || !isBookingDay(day) || day < parisDay()) return json({ error: 'Choisissez un tirage et une date valides.' }, 400);
  const client = supabaseServer(cookies, request);
  if (!client) return json({ error: 'La réservation est momentanément indisponible. Vous pouvez contacter l’atelier.' }, 503);
  try {
    const { data, error } = await client.rpc('public_available_slots', { p_service_slug: service, p_day: day });
    if (error) return json({ error: 'Impossible de consulter les disponibilités. Veuillez réessayer.' }, 503);
    return json({ slots: (data || []).filter((slot: { start_at: string }) => Date.parse(slot.start_at) > Date.now()) });
  } catch { return json({ error: 'Impossible de consulter les disponibilités. Veuillez réessayer.' }, 503); }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'Origine de la demande refusée.' }, 403);
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return json({ error: 'Format de demande invalide.' }, 415);
  let input: unknown;
  try { input = await request.json(); } catch { return json({ error: 'Données de réservation invalides.' }, 400); }
  const details = validateBooking(input);
  if (!details) return json({ error: 'Vérifiez votre tirage, votre horaire et vos coordonnées.' }, 400);
  const client = supabaseServer(cookies, request);
  if (!client) return json({ error: 'La réservation est momentanément indisponible. Vous pouvez contacter l’atelier.' }, 503);
  let booking;
  try {
    const { data, error } = await client.rpc('create_public_booking_once', {
      p_request_id: details.requestId, p_service_slug: details.service, p_start_at: details.startAt,
      p_customer_name: details.customerName, p_customer_email: details.email,
    });
    if (error || !data?.[0]) {
      const conflict = error && /slot_(unavailable|conflict)|booking_cancelled|request_mismatch/.test(error.message);
      return json({ error: conflict ? 'Ce créneau n’est plus disponible. Choisissez un autre horaire ; vos coordonnées sont conservées.' : 'L’enregistrement n’a pas pu être vérifié. Réessayez sans changer vos choix, ou contactez l’atelier.' }, conflict ? 409 : 503);
    }
    booking = data[0];
  } catch { return json({ error: 'La réponse du système de réservation n’a pas pu être vérifiée. Réessayez sans changer vos choix.' }, 503); }

  let notification: 'sent' | 'pending' | 'simulation' = 'pending';
  try {
    const outcomes = await deliverBookingNotification(client, booking.notification_id, {
      bookingId: booking.id, service: details.service, startAt: booking.start_at,
      customerName: details.customerName, customerEmail: details.email, kind: 'confirmed',
      duration: booking.duration_minutes, price: booking.price_eur,
    }, booking.notification_token);
    const customer = outcomes.find(outcome => outcome.recipient === 'customer');
    if (customer?.delivered) notification = customer.simulated ? 'simulation' : 'sent';
  } catch { /* The booking is committed; notification retries belong to the existing outbox. */ }
  return json({ booking: { id: booking.id, startAt: booking.start_at, duration: booking.duration_minutes, price: booking.price_eur, notification } });
};
