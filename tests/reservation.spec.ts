import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const slot = { start_at: '2030-07-01T08:00:00.000Z', end_at: '2030-07-01T09:00:00.000Z' };
async function mockSlots(page: Page) {
  await page.route('**/api/reservations?**', route => route.fulfill({ json: { slots: [slot] } }));
}
async function choose(page: Page, service = 'tarot-solo') {
  await page.goto('/reservation');
  await page.locator(`[name="service"][value="${service}"]`).check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Votre date').fill('2030-07-01');
  await page.locator('[name="startAt"]').check();
  await page.getByRole('button', { name: 'Continuer' }).click();
}
async function coordinates(page: Page) {
  await page.getByLabel('Prénom', { exact: true }).fill('Élise');
  await page.getByLabel('Nom', { exact: true }).fill('Piette');
  await page.getByLabel('Adresse e-mail', { exact: true }).fill('elise@example.test');
  await page.getByRole('button', { name: 'Continuer' }).click();
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page }).include('#booking').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
}
test('No false confirmation from URL, no calendar on step one, selection required', async ({ page }) => {
  await page.goto('/reservation?confirmation=fake');
  await expect(page.locator('#booking-confirmed')).toBeHidden();
  await expect(page.getByLabel('Votre date')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  await expect(page.locator('[data-step]:visible')).toHaveCount(1);
  await accessible(page);
});
for (const width of [320, 390, 768, 1440]) {
  for (const service of ['tarot-solo', 'roue-astrologique']) {
    test(`${service}: four steps, preserved inputs, summary and confirmation at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockSlots(page);
      let posts = 0;
      await page.route('**/api/reservations', async route => {
        posts++;
        const body = route.request().postDataJSON();
        expect(body.service).toBe(service); expect(body.email).toBe('elise@example.test');
        await new Promise(resolve => setTimeout(resolve, 150));
        await route.fulfill({ json: { booking: { id: 'test-booking', startAt: slot.start_at, duration: service === 'tarot-solo' ? 60 : 90, price: service === 'tarot-solo' ? 50 : 70, notification: 'pending' } } });
      });
      await choose(page, service);
      await expect(page.locator('#step-3-title')).toBeFocused();
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(page.locator('#booking-first-name')).toBeFocused();
      await expect(page.getByRole('alert')).toBeVisible();
      await coordinates(page);
      await expect(page.locator('#booking-summary')).toContainText('10:00'); // Paris, despite New York browser timezone.
      await expect(page.locator('#booking-summary')).toContainText(service === 'tarot-solo' ? '50 €' : '70 €');
      await page.getByRole('button', { name: 'Retour', exact: true }).click();
      await expect(page.getByLabel('Prénom', { exact: true })).toHaveValue('Élise');
      await page.getByRole('button', { name: 'Retour', exact: true }).click();
      await expect(page.locator('[name="startAt"]')).toBeChecked();
      await page.getByRole('button', { name: 'Continuer' }).click();
      await page.getByRole('button', { name: 'Continuer' }).click();
      await expect(page.locator('[data-progress][aria-current="step"]')).toHaveAttribute('data-progress', '4');
      await expect(page.locator('[data-step]:visible')).toHaveCount(1);
      await accessible(page);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await page.getByRole('button', { name: 'Confirmer ma réservation' }).click();
      await expect(page.getByRole('button', { name: 'Confirmer ma réservation' })).toBeDisabled();
      await expect(page.locator('#booking-confirmed')).toBeVisible();
      await expect(page.locator('#booking-mail-status')).toContainText('ne réservez pas à nouveau');
      await expect(page.locator('#confirmed-title')).toBeFocused();
      expect(posts).toBe(1);
      await accessible(page);
    });
  }
}
test('Changing service clears the old slot and requests the correct duration', async ({ page }) => {
  await mockSlots(page); await choose(page);
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page.getByRole('button', { name: 'Retour', exact: true }).click();
  await page.locator('[value="roue-astrologique"]').check();
  const response = page.waitForRequest(request => request.url().includes('/api/reservations?') && request.url().includes('roue-astrologique'));
  await page.getByRole('button', { name: 'Continuer' }).click(); await response;
  await expect(page.locator('[name="startAt"]')).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
});
test('Empty availability, retrieval error and retry are explicit', async ({ page }) => {
  let fail = true;
  await page.route('**/api/reservations?**', route => route.fulfill({ status: fail ? 503 : 200, json: fail ? { error: 'Indisponible pour le test' } : { slots: [] } }));
  await page.goto('/reservation?offre=tarot-solo');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#slots-status')).toContainText('Indisponible');
  fail = false; await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.locator('#slots-status')).toContainText('Aucun créneau');
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
});
test('Slot conflict returns to calendar and preserves customer fields', async ({ page }) => {
  await mockSlots(page);
  await page.route('**/api/reservations', route => route.fulfill({ status: 409, json: { error: 'Créneau indisponible' } }));
  await choose(page); await coordinates(page);
  await page.getByRole('button', { name: 'Confirmer ma réservation' }).click();
  await expect(page.locator('[data-step="2"]')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Créneau indisponible');
  await expect(page.locator('#booking-confirmed')).toBeHidden();
  await page.locator('[name="startAt"]').check(); await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.getByLabel('Adresse e-mail')).toHaveValue('elise@example.test');
});
test('Lost server response retries the same idempotency key without false success', async ({ page }) => {
  await mockSlots(page); const ids: string[] = [];
  await page.route('**/api/reservations', async route => {
    ids.push(route.request().postDataJSON().requestId);
    if (ids.length === 1) await route.abort('failed');
    else await route.fulfill({ json: { booking: { id: 'test', startAt: slot.start_at, duration: 60, price: 50, notification: 'simulation' } } });
  });
  await choose(page); await coordinates(page);
  await page.getByRole('button', { name: 'Confirmer ma réservation' }).click();
  await expect(page.getByRole('alert')).toContainText('même demande');
  await expect(page.locator('#booking-confirmed')).toBeHidden();
  await page.getByRole('button', { name: 'Confirmer ma réservation' }).click();
  await expect(page.locator('#booking-confirmed')).toBeVisible();
  expect(ids).toHaveLength(2); expect(ids[0]).toBe(ids[1]);
});
test('Keyboard selection and forward navigation move focus to current heading', async ({ page }) => {
  await mockSlots(page); await page.goto('/reservation');
  await page.locator('[value="tarot-solo"]').focus(); await page.keyboard.press('Space');
  await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'Continuer' })).toBeFocused();
  await page.keyboard.press('Enter'); await expect(page.locator('#step-2-title')).toBeFocused();
  await accessible(page);
});
test('Invalid date stops loading; invalid email keeps the customer on the coordinates step', async ({ page }) => {
  await mockSlots(page);
  await page.goto('/reservation?offre=tarot-solo');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Votre date').fill('');
  await expect(page.locator('#booking-slots')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('#slots-status')).toContainText('Choisissez une date valide');
  await expect(page.getByRole('button', { name: 'Continuer' })).toBeDisabled();
  await page.getByLabel('Votre date').fill('2030-07-01');
  await page.locator('[name="startAt"]').check();
  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByLabel('Prénom', { exact: true }).fill('Test');
  await page.getByLabel('Nom', { exact: true }).fill('Client');
  await page.getByLabel('Adresse e-mail').fill('invalid-email');
  await page.getByRole('button', { name: 'Continuer' }).click();
  await expect(page.locator('#booking-email')).toBeFocused();
  await expect(page.locator('#booking-email')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('[data-step="3"]')).toBeVisible();
  await accessible(page);
});
test('API rejects invalid and cross-origin submissions; unavailable backend is never success', async ({ request }) => {
  expect((await request.get('/api/reservations?service=constructor&day=2030-07-01')).status()).toBe(400);
  expect((await request.get('/api/reservations?service=tarot-solo&day=2030-02-30')).status()).toBe(400);
  expect((await request.get('/api/reservations?service=tarot-solo&day=2030-07-01')).status()).toBe(503);
  expect((await request.post('/api/reservations', { data: {}, headers: { Origin: 'https://other.example' } })).status()).toBe(403);
  expect((await request.post('/api/reservations', { data: {} })).status()).toBe(400);
  const response = await request.post('/api/reservations', { data: { service: 'tarot-solo', startAt: slot.start_at, firstName: 'Test', lastName: 'Client', email: 'client@example.test', requestId: '27018a5d-ddc3-421a-86b4-c42e5cc3d209' } });
  expect(response.status()).toBe(503); expect(response.headers()['cache-control']).toBe('no-store');
});
