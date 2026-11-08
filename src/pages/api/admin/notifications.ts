import type { APIRoute } from 'astro';
import { isBookingService } from '../../../data/booking';
import { notifyBooking } from '../../../lib/notifications';
import { isAdmin, supabaseServer } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!await isAdmin(cookies, request)) return new Response('Forbidden', { status: 403 });
  const id = String((await request.formData()).get('id') || ''); const client = supabaseServer(cookies, request);
  if (!client || !id) return new Response('Invalid notification', { status: 400 });
  const { data } = await client.from('booking_notifications').select('id,event,appointments(id,service_slug,customer_name,customer_email,start_at)').eq('id', id).single();
  const appointment: any = data?.appointments;
  const event = data?.event;
  if (!appointment || !isBookingService(appointment.service_slug) || !['confirmed', 'changed', 'cancelled'].includes(event || '')) return redirect('/admin/agenda?message=Notification%20introuvable');
  try { const result = await notifyBooking({ bookingId: appointment.id, service: appointment.service_slug, startAt: appointment.start_at, customerName: appointment.customer_name, customerEmail: appointment.customer_email, kind: event as 'confirmed' | 'changed' | 'cancelled' }); await client.from('booking_notifications').update({ status: result.delivered ? 'sent' : 'pending', attempts: 1, last_error: result.simulated ? 'Transport local simulé : aucun e-mail envoyé.' : null, sent_at: result.delivered ? new Date().toISOString() : null }).eq('id', id); return redirect(`/admin/agenda?message=${encodeURIComponent(result.simulated ? 'Simulation locale enregistrée : configurez Resend pour envoyer.' : 'Notification envoyée.')}`); } catch (error) { await client.from('booking_notifications').update({ status: 'failed', attempts: 1, last_error: error instanceof Error ? error.message : 'Erreur d’envoi' }).eq('id', id); return redirect('/admin/agenda?message=Échec%20d’envoi%20visible%20dans%20la%20boîte%20d’envoi.'); }
};
