// Local RPC adapter for HTTP integration tests. It executes the actual booking SQL
// under role anon. It does not emulate Supabase Auth/PostgREST deployment configuration.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const connection = { host: '127.0.0.1', port: 55432, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 3000 };
const database = `cartonancienne_http_qa_${Date.now()}`;
const admin = new pg.Client(connection); await admin.connect();
await admin.query(`create database ${database}`);
const pool = new pg.Pool({ ...connection, database });
try {
  await pool.query(`do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
    create schema auth; create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    grant usage on schema auth to public; grant execute on function auth.jwt() to public;`);
  for (const file of ['002_booking_agenda.sql', '003_fix_booking_slot_ambiguity.sql', '004_fix_agenda_admin_grants.sql', '005_fix_agenda_move_ambiguity.sql', '006_notification_delivery_outbox.sql', '009_booking_request_idempotency.sql', '20261111222342_keep_legacy_booking_rpc_during_rollout.sql', '20261112000222_notification_email_event_timestamp.sql']) await pool.query(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), 'utf8'));
  await pool.query("insert into public.availability_windows(start_at,end_at,kind) values ('2030-07-01T06:00Z','2030-07-01T18:00Z','open'),('2030-07-02T06:00Z','2030-07-02T18:00Z','open')");
} catch (error) {
  await pool.end(); await admin.query(`drop database ${database} with (force)`); await admin.end(); throw error;
}
const allowed = new Set(['public_available_slots', 'create_public_booking_once', 'claim_booking_notification_delivery', 'complete_booking_notification_delivery']);
const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json');
  if (request.url === '/health') { response.end('{"ready":true}'); return; }
  const fn = request.url?.split('/rest/v1/rpc/')[1];
  if (request.method !== 'POST' || !allowed.has(fn)) { response.writeHead(404); response.end('{}'); return; }
  const client = await pool.connect();
  try {
    let raw = ''; for await (const chunk of request) raw += chunk;
    const input = JSON.parse(raw); const names = Object.keys(input);
    if (names.some(name => !/^p_[a-z_]+$/.test(name))) throw new Error('invalid_arguments');
    await client.query('begin'); await client.query('set local role anon');
    const result = await client.query(`select * from public.${fn}(${names.map((name, i) => `${name} => $${i + 1}`).join(',')})`, Object.values(input));
    await client.query('commit'); response.end(JSON.stringify(result.rows));
  } catch (error) {
    await client.query('rollback'); response.writeHead(400); response.end(JSON.stringify({ message: error.message, code: error.code || 'LOCAL_TEST' }));
  } finally { client.release(); }
});
server.listen(55433, '127.0.0.1');
let stopping = false;
async function cleanup() {
  if (stopping) return; stopping = true;
  server.close(); await pool.end(); await admin.query(`drop database ${database} with (force)`); await admin.end(); process.exit(0);
}
process.on('SIGTERM', cleanup); process.on('SIGINT', cleanup);
