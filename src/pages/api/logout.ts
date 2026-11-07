import type { APIRoute } from 'astro'; import { supabaseServer } from '../../lib/supabase';
export const POST: APIRoute = async ({ cookies, request, redirect }) => { await supabaseServer(cookies, request)?.auth.signOut(); return redirect('/'); };
