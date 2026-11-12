// Fixed loopback destination only: never consume a production database environment variable.
// Prerequisite: a disposable PostgreSQL 17 instance on 127.0.0.1:55432, user postgres, trust auth.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import pg from 'pg';

const connection = { host: '127.0.0.1', port: 55432, user: 'postgres', database: 'postgres', connectionTimeoutMillis: 3000 };
const database = `cartonancienne_qa_${Date.now()}`;
test('Isolated PostgreSQL: migrations, RLS, conflicts, retries, DST and outbox', async t => {
  const admin = new pg.Client(connection); await admin.connect();
  await admin.query(`create database ${database}`);
  const pool = new pg.Pool({ ...connection, database });
  t.after(async () => { await pool.end(); await admin.query(`drop database ${database} with (force)`); await admin.end(); });
  await pool.query(`do $$ begin if not exists(select from pg_roles where rolname='anon') then create role anon; end if; if not exists(select from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;
    create schema auth;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    grant usage on schema auth to public; grant execute on function auth.jwt() to public;`);
  for (const name of ['002_booking_agenda.sql', '003_fix_booking_slot_ambiguity.sql', '004_fix_agenda_admin_grants.sql', '005_fix_agenda_move_ambiguity.sql', '006_notification_delivery_outbox.sql', '009_booking_request_idempotency.sql', '20261111222342_keep_legacy_booking_rpc_during_rollout.sql', '20261112000222_notification_email_event_timestamp.sql']) {
    await pool.query(await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8'));
  }
  // Portfolio migrations 001, 007 and 008 are outside this isolated booking fixture.
  const asRole = async (role, sql, values = [], claims = {}) => {
    const client = await pool.connect();
    try {
      await client.query('begin'); await client.query(`set local role ${role}`);
      await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const result = await client.query(sql, values); await client.query('commit'); return result;
    } catch (error) { await client.query('rollback'); throw error; } finally { client.release(); }
  };
  const create = (id, start = '2030-07-01T08:00:00Z', service = 'tarot-solo', email = 'client@example.test') => asRole('anon', 'select * from public.create_public_booking_once($1,$2,$3,$4,$5)', [id, service, start, 'Test Client', email]);
  await pool.query("insert into public.availability_windows(start_at,end_at,kind) values ('2030-07-01T06:00:00Z','2030-07-01T18:00:00Z','open')");

  await t.test('Anonymous and non-admin users cannot read private booking data or administer availability', async () => {
    await assert.rejects(asRole('anon', 'select * from public.appointments'), /permission denied/);
    await assert.rejects(asRole('anon', 'select * from public.booking_request_keys'), /permission denied/);
    assert.equal((await asRole('authenticated', 'select * from public.appointments')).rows.length, 0);
    await assert.rejects(asRole('authenticated', "select public.admin_set_availability('2030-08-01 10:00','2030-08-01 12:00','open')"), /forbidden/);
    // Older deployed servers keep their existing RPC while the new wrapper is rolled out.
    assert.equal((await asRole('anon', "select has_function_privilege('anon','public.create_public_booking(text,timestamptz,text,text)','execute') as allowed")).rows[0].allowed, true);
  });
  let booked;
  await t.test('Concurrent retries of the same request return exactly one booking and notification', async () => {
    const key = randomUUID(); const results = await Promise.all([create(key), create(key), create(key)]);
    booked = results[0].rows[0];
    assert.ok(results.every(result => result.rows[0].id === booked.id));
    assert.equal(booked.duration_minutes, 60); assert.equal(booked.price_eur, 50);
    assert.equal((await pool.query('select count(*)::int as n from public.appointments')).rows[0].n, 1);
    assert.equal((await pool.query('select count(*)::int as n from public.booking_notifications')).rows[0].n, 1);
    await assert.rejects(create(key, '2030-07-01T10:00:00Z'), /request_mismatch/);
  });
  await t.test('Two distinct requests for overlapping 60/90 minute intervals yield one success', async () => {
    const results = await Promise.allSettled([create(randomUUID(), '2030-07-01T11:00:00Z', 'roue-astrologique'), create(randomUUID(), '2030-07-01T11:30:00Z')]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    const failure = results.find(result => result.status === 'rejected'); assert.match(failure.reason.message, /slot_(conflict|unavailable)/);
  });
  await t.test('Database computes Roue duration and price, rejects past, off-grid and blocked slots', async () => {
    const result = (await create(randomUUID(), '2030-07-01T14:00:00Z', 'roue-astrologique')).rows[0];
    assert.equal(result.duration_minutes, 90); assert.equal(result.price_eur, 70);
    await assert.rejects(create(randomUUID(), '2020-07-01T08:00:00Z'), /slot_unavailable/);
    await assert.rejects(create(randomUUID(), '2030-07-01T16:07:00Z'), /slot_unavailable/);
    await pool.query("insert into public.availability_windows(start_at,end_at,kind) values('2030-07-01T16:00Z','2030-07-01T18:00Z','blocked')");
    await assert.rejects(create(randomUUID(), '2030-07-01T16:00:00Z'), /slot_unavailable/);
  });
  await t.test('Notification claim is atomic; failure persists and retry cannot resend completed recipients', async () => {
    const args = [booked.notification_id, 'customer', booked.notification_token];
    const results = await Promise.all([asRole('anon', 'select * from public.claim_booking_notification_delivery($1,$2,$3)', args), asRole('anon', 'select * from public.claim_booking_notification_delivery($1,$2,$3)', args)]);
    assert.equal(results.filter(result => result.rows[0].claimed).length, 1);
    const lease = results.find(result => result.rows[0].claimed).rows[0].lease_id;
    const eventAt = results.find(result => result.rows[0].claimed).rows[0].event_at;
    assert.ok(eventAt);
    await asRole('anon', 'select public.complete_booking_notification_delivery($1,$2,$3,$4,$5,$6)', [booked.notification_id, 'customer', lease, false, 'Simulated failure', booked.notification_token]);
    assert.equal((await pool.query('select status from public.booking_notifications where id=$1', [booked.notification_id])).rows[0].status, 'failed');
    const retry = (await asRole('anon', 'select * from public.claim_booking_notification_delivery($1,$2,$3)', args)).rows[0]; assert.equal(retry.claimed, true);
    assert.equal(new Date(retry.event_at).getTime(), new Date(eventAt).getTime());
    await asRole('anon', 'select public.complete_booking_notification_delivery($1,$2,$3,$4,$5,$6)', [booked.notification_id, 'customer', retry.lease_id, true, null, booked.notification_token]);
    assert.equal((await asRole('anon', 'select * from public.claim_booking_notification_delivery($1,$2,$3)', args)).rows[0].claimed, false);
    await assert.rejects(asRole('anon', 'select * from public.claim_booking_notification_delivery($1,$2,$3)', [booked.notification_id, 'admin', randomUUID()]), /forbidden/);
  });
  await t.test('Paris DST uses real UTC instants for both repeated local times', async () => {
    await pool.query("insert into public.availability_windows(start_at,end_at,kind) values('2030-10-26T22:00Z','2030-10-27T23:00Z','open')");
    const slots = (await asRole('anon', "select start_at, to_char(start_at at time zone 'Europe/Paris','HH24:MI') as local from public.public_available_slots('tarot-solo','2030-10-27')")).rows;
    const repeated = slots.filter(slot => slot.local === '02:00'); assert.equal(repeated.length, 2); assert.notEqual(repeated[0].start_at.getTime(), repeated[1].start_at.getTime());
  });
  await t.test('Admin move and cancellation preserve the appointment and create outbox events', async () => {
    await asRole('authenticated', "select * from public.admin_change_appointment($1,'2030-07-01 11:00',false)", [booked.id], { app_metadata: { role: 'admin' } });
    await asRole('authenticated', 'select * from public.admin_change_appointment($1,null,true)', [booked.id], { app_metadata: { role: 'admin' } });
    assert.equal((await pool.query('select status from public.appointments where id=$1', [booked.id])).rows[0].status, 'cancelled');
    assert.deepEqual((await pool.query('select event from public.booking_notifications where appointment_id=$1 order by created_at', [booked.id])).rows.map(row => row.event), ['confirmed', 'changed', 'cancelled']);
    assert.equal((await asRole('authenticated', 'select * from public.appointments', [], { app_metadata: { role: 'admin' } })).rows.length, 3);
  });
});
