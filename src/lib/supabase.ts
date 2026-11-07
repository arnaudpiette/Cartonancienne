import { createServerClient } from '@supabase/ssr';
import type { AstroCookies } from 'astro';
import type { CookieOptionsWithName } from '@supabase/ssr';

export function supabaseServer(cookies: AstroCookies, request?: Request) {
  const url = import.meta.env.PUBLIC_SUPABASE_URL;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createServerClient(url, key, {
    cookies: {
      getAll: () => (request?.headers.get('cookie') ?? '').split('; ').filter(Boolean).map((part) => { const index = part.indexOf('='); return { name: decodeURIComponent(part.slice(0, index)), value: part.slice(index + 1) }; }),
      setAll: (entries: { name: string; value: string; options: CookieOptionsWithName }[]) => entries.forEach(({ name, value, options }) => cookies.set(name, value, options))
    }
  });
}

export async function isAdmin(cookies: AstroCookies, request?: Request) {
  const client = supabaseServer(cookies, request);
  if (!client) return false;
  const { data: { user } } = await client.auth.getUser();
  return user?.app_metadata?.role === 'admin';
}
