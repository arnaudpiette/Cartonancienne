import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

const input = { service: 'tarot-solo', startAt: '2030-07-01T08:00:00Z', firstName: 'Test', lastName: 'Client', email: 'client@example.test' };
test('API commits once, survives simulated notification failure and rejects competing bookings', async ({ request }) => {
  const data = { ...input, requestId: randomUUID() };
  const [first, retry] = await Promise.all([request.post('/api/reservations', { data }), request.post('/api/reservations', { data })]);
  expect(first.status()).toBe(200); expect(retry.status()).toBe(200);
  const result = (await first.json()).booking;
  expect((await retry.json()).booking.id).toBe(result.id);
  expect(result).toMatchObject({ price: 50, duration: 60, notification: 'pending' });
  const conflict = await request.post('/api/reservations', { data: { ...data, requestId: randomUUID(), startAt: '2030-07-01T08:30:00Z', service: 'roue-astrologique' } });
  expect(conflict.status()).toBe(409);
  const slots = await request.get('/api/reservations?service=tarot-solo&day=2030-07-01');
  expect(slots.status()).toBe(200);
  expect((await slots.json()).slots.some((slot: { start_at: string }) => Date.parse(slot.start_at) === Date.parse(input.startAt))).toBe(false);
});
test('Actual browser submits Roue through Astro and local SQL; failed mail never undoes confirmation', async ({ page }) => {
  await page.goto('/reservation?offre=roue-astrologique');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Votre date').fill('2030-07-02');
  await page.locator('[name="startAt"]').first().check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Prénom', { exact: true }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Client');
  await page.getByLabel('Adresse e-mail').fill('client@example.test');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('button', { name: 'Confirmer ma réservation' }).click();
  await expect(page.locator('#booking-confirmed')).toBeVisible();
  await expect(page.locator('#confirmed-summary')).toContainText('90 minutes');
  await expect(page.locator('#confirmed-summary')).toContainText('70 €');
  await expect(page.locator('#booking-mail-status')).toContainText('ne réservez pas à nouveau');
});
