import type { APIRoute } from 'astro';
import { isBookingService } from '../../../data/booking';
import { deliverBookingNotification } from '../../../lib/booking-delivery';
import { isAdmin, supabaseServer } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!await isAdmin(cookies, request)) return new Response('Forbidden', { status: 403 });
  const id = String((await request.formData()).get('id') || ''); const client = supabaseServer(cookies, request);
  if (!client || !id) return new Response('Invalid notification', { status: 400 });
  const { data } = await client.from('booking_notifications').select('id,event,appointments(id,service_slug,customer_name,customer_email,start_at)').eq('id', id).single();
  const appointment: any = data?.appointments;
  const event = data?.event;
  if (!appointment || !isBookingService(appointment.service_slug) || !['confirmed', 'changed', 'cancelled'].includes(event || '')) return redirect('/admin/agenda?message=Notification%20introuvable');
  const outcomes = await deliverBookingNotification(client, id, { bookingId: appointment.id, service: appointment.service_slug, startAt: appointment.start_at, customerName: appointment.customer_name, customerEmail: appointment.customer_email, kind: event as 'confirmed' | 'changed' | 'cancelled' });
  const failed = outcomes.filter((outcome) => !outcome.delivered && !outcome.skipped);
  return redirect(`/admin/agenda?message=${encodeURIComponent(failed.length ? 'Échec d’envoi visible dans la boîte d’envoi.' : 'Relance traitée.')}`);
};
