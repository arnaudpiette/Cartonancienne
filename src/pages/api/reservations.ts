import type { APIRoute } from 'astro';
import { isBookingService } from '../../data/booking';
import { deliverBookingNotification } from '../../lib/booking-delivery';
import { supabaseServer } from '../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const service = String(form.get('service') || ''); const startAt = String(form.get('startAt') || '');
  const customerName = String(form.get('name') || '').trim(); const customerEmail = String(form.get('email') || '').trim().toLowerCase();
  if (!isBookingService(service) || !customerName || !/^\S+@\S+\.\S+$/.test(customerEmail) || Number.isNaN(Date.parse(startAt))) return new Response('Données de réservation invalides', { status: 400 });
  const client = supabaseServer(cookies, request);
  if (!client) return new Response('Les réservations ne sont pas encore configurées.', { status: 503 });
  const { data, error } = await client.rpc('create_public_booking', { p_service_slug: service, p_start_at: startAt, p_customer_name: customerName, p_customer_email: customerEmail });
  if (error || !data?.[0]) return new Response('Ce créneau vient d’être réservé ou n’est plus disponible. Choisissez un autre horaire.', { status: 409 });
  const booking = data[0];
  try { await deliverBookingNotification(client, booking.notification_id, { bookingId: booking.id, service, startAt: booking.start_at, customerName, customerEmail, kind: 'confirmed' }, booking.notification_token); } catch (error) { console.error('[booking notification failed]', error); }
  return redirect(`/reservation?offre=${service}&confirmation=${booking.id}`);
};
