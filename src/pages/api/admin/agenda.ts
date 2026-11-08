import type { APIRoute } from 'astro';
import { isAdmin, supabaseServer } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!await isAdmin(cookies, request)) return new Response('Forbidden', { status: 403 });
  const form = await request.formData(); const start = String(form.get('start') || ''); const end = String(form.get('end') || ''); const kind = String(form.get('kind') || ''); const note = String(form.get('note') || '');
  if (!start || !end || !['open', 'blocked'].includes(kind)) return redirect('/admin/agenda?message=Plage%20invalide');
  const client = supabaseServer(cookies, request); if (!client) return new Response('Supabase not configured', { status: 503 });
  const { error } = await client.rpc('admin_set_availability', { p_start_local: start, p_end_local: end, p_kind: kind, p_note: note });
  return redirect(`/admin/agenda?message=${encodeURIComponent(error ? 'Conflit : cette période contient un rendez-vous confirmé ou est invalide.' : 'Plage enregistrée.')}`);
};
