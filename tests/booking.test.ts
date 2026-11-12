import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bookingServices, formatParis, isBookingDay, isBookingService, parisDay, paymentOnSite } from '../src/data/booking';
import { validateBooking } from '../src/lib/booking-validation';
import { bookingIcs, bookingMailText, bookingMailPayload, bookingSender, sendBookingMail } from '../src/lib/notifications';
import { deliverBookingNotification } from '../src/lib/booking-delivery';

const valid = { service: 'tarot-solo', startAt: '2030-07-01T08:00:00Z', firstName: ' Élise ', lastName: ' Piette ', email: ' ELise@example.test ', requestId: '27018a5d-ddc3-421a-86b4-c42e5cc3d209' };
test('Only the two actual service keys are accepted, including against prototype keys', () => {
  assert.equal(isBookingService('tarot-solo'), true);
  assert.equal(isBookingService('roue-astrologique'), true);
  for (const value of ['constructor', '__proto__', 'toString', 'bon-tarot', null]) assert.equal(isBookingService(value), false);
  assert.equal(bookingServices['tarot-solo'].duration, 60);
  assert.equal(bookingServices['roue-astrologique'].price, 70);
});
test('Booking input is normalized; client-supplied prices are ignored', () => {
  assert.deepEqual(validateBooking({ ...valid, price: 0 }), { service: 'tarot-solo', startAt: '2030-07-01T08:00:00.000Z', customerName: 'Élise Piette', email: 'elise@example.test', requestId: valid.requestId });
});
test('Invalid identities, e-mails, timestamps and request keys are rejected', () => {
  for (const patch of [{ firstName: ' ' }, { lastName: '' }, { firstName: 'x'.repeat(61) }, { lastName: 'x'.repeat(60) }, { firstName: 'A\nB' }, { email: 'a@@b.fr' }, { email: 'a'.repeat(250) + '@b.fr' }, { email: 3 }, { startAt: '2030-07-01T08:00:00' }, { startAt: 'nonsense' }, { requestId: '' }, { service: '__proto__' }]) assert.equal(validateBooking({ ...valid, ...patch }), null);
  assert.equal(validateBooking(null), null);
});
test('Dates are real calendar days; Paris formatting handles midnight and DST', () => {
  assert.equal(isBookingDay('2030-02-30'), false);
  assert.equal(isBookingDay('2030-02-28'), true);
  assert.equal(parisDay(new Date('2030-07-01T23:30:00Z')), '2030-07-02');
  assert.match(formatParis('2030-03-31T00:30:00Z'), /01:30/);
  assert.match(formatParis('2030-03-31T01:30:00Z'), /03:30/);
});
test('Emails recap each offer and payment on site; ICS keeps UTC duration and stable UID', () => {
  for (const service of ['tarot-solo', 'roue-astrologique'] as const) {
    const mail = { bookingId: 'test-id', service, startAt: valid.startAt, eventAt: '2026-11-12T00:00:00Z', customerName: 'Élise Piette', customerEmail: 'elise@example.test', kind: 'confirmed' as const };
    for (const recipient of ['customer', 'admin'] as const) {
      const text = bookingMailText(mail, recipient);
      assert.ok(text.includes(paymentOnSite)); assert.ok(text.includes(`${bookingServices[service].price} €`)); assert.ok(text.includes('Europe/Paris'));
    }
    const ics = bookingIcs(mail);
    assert.ok(ics.includes('DTSTART:20300701T080000Z'));
    assert.ok(ics.includes(service === 'tarot-solo' ? 'DTEND:20300701T090000Z' : 'DTEND:20300701T093000Z'));
    assert.ok(ics.includes('UID:test-id@lacartonancienne.fr'));
    assert.ok(bookingIcs({ ...mail, kind: 'cancelled' }).includes('STATUS:CANCELLED'));
  }
});
test('Already claimed notification recipients never invoke the mail transport', async () => {
  const calls: string[] = [];
  const outcomes = await deliverBookingNotification({ rpc: async (name: string) => { calls.push(name); return { data: [{ claimed: false }], error: null }; } }, 'outbox', { bookingId: 'test', service: 'tarot-solo', startAt: valid.startAt, customerName: 'Test', customerEmail: 'test@example.test', kind: 'confirmed' });
  assert.equal(calls.length, 2); assert.ok(outcomes.every(outcome => outcome.skipped));
});

const mail = { bookingId: 'test-booking', service: 'tarot-solo' as const, startAt: valid.startAt, eventAt: '2026-11-12T00:00:00Z', customerName: 'Test Client', customerEmail: 'customer@example.test', kind: 'confirmed' as const };
test('Sender, recipients and reply addresses route client conversations to the creator', () => {
  const settings = { adminEmail: 'creator@example.test' };
  const customer = bookingMailPayload(mail, 'customer', settings);
  const admin = bookingMailPayload(mail, 'admin', settings);
  assert.equal(customer.from, bookingSender);
  assert.ok(customer.from.includes('reservations@lacartonancienne.com'));
  assert.deepEqual(customer.to, ['customer@example.test']);
  assert.equal(customer.reply_to, 'creator@example.test');
  assert.deepEqual(admin.to, ['creator@example.test']);
  assert.equal(admin.reply_to, 'customer@example.test');
  assert.ok(customer.text.includes(paymentOnSite));
  const ics = Buffer.from(customer.attachments[0].content, 'base64').toString();
  assert.ok(ics.indexOf('METHOD:REQUEST') < ics.indexOf('BEGIN:VEVENT'));
  assert.ok(ics.includes('DTSTAMP:20261112T000000Z'));
});
test('Provider retries use the same key and byte-identical body, including the ICS timestamp', async () => {
  const calls: RequestInit[] = [];
  const transport: typeof fetch = async (_input, init) => { calls.push(init!); return Response.json({ id: 'provider-test-id' }); };
  const key = 'booking-outbox-id-customer';
  for (let i = 0; i < 2; i++) {
    const result = await sendBookingMail(bookingMailPayload(mail, 'customer', { adminEmail: 'creator@example.test' }), 'test-key', key, transport);
    assert.equal(result.messageId, 'provider-test-id');
  }
  assert.equal(calls[0].body, calls[1].body);
  for (const call of calls) {
    assert.equal(new Headers(call.headers).get('Idempotency-Key'), key);
    assert.ok(call.signal instanceof AbortSignal);
  }
});
test('Provider failures and malformed successes never become successful email notifications', async () => {
  const payload = bookingMailPayload(mail, 'customer', { adminEmail: 'creator@example.test' });
  await assert.rejects(sendBookingMail(payload, '', 'test', async () => Response.json({ id: 'unused' })), /manquante/);
  await assert.rejects(sendBookingMail(payload, 'test-key', 'test', async () => new Response('', { status: 403 })), /403/);
  await assert.rejects(sendBookingMail(payload, 'test-key', 'test', async () => Response.json({})), /invalide/);
});
