import type { APIRoute } from 'astro';
import { isBookingService } from '../../../data/booking';
import { deliverBookingNotification } from '../../../lib/booking-delivery';
import { isAdmin, supabaseServer } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!await isAdmin(cookies, request)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData(); const id = String(form.get('id') || ''); const action = String(form.get('action') || ''); const start = String(form.get('start') || '');
  if (!id || !['move', 'cancel'].includes(action) || (action === 'move' && !start)) return redirect('/admin/agenda?message=Action%20invalide');
  const client = supabaseServer(cookies, request); if (!client) return new Response('Supabase not configured', { status: 503 });
  const { error } = await client.rpc('admin_change_appointment', { p_id: id, p_start_local: action === 'move' ? start : null, p_cancel: action === 'cancel' });
  if (error) return redirect('/admin/agenda?message=Modification%20refusée%20:%20le%20créneau%20est%20indisponible%20ou%20en%20conflit.');
  const { data: appointment } = await client.from('appointments').select('service_slug,customer_name,customer_email,start_at').eq('id', id).single();
  if (appointment && isBookingService(appointment.service_slug)) {
    const event = action === 'cancel' ? 'cancelled' : 'changed';
    const { data: notification } = await client.from('booking_notifications').select('id').eq('appointment_id', id).eq('event', event).order('created_at', { ascending: false }).limit(1).single();
    if (notification) await deliverBookingNotification(client, notification.id, { bookingId: id, service: appointment.service_slug, startAt: appointment.start_at, customerName: appointment.customer_name, customerEmail: appointment.customer_email, kind: event });
  }
  return redirect(`/admin/agenda?message=${encodeURIComponent(action === 'cancel' ? 'Rendez-vous annulé.' : 'Rendez-vous déplacé.')}`);
};
