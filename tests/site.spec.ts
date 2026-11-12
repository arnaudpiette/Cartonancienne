import { test, expect } from '@playwright/test';

test('Recovered mobile navigation works at both mobile widths and respects the desktop breakpoint', async ({ page }) => {
  for (const width of [375, 390, 760]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const toggle = page.locator('.menu-toggle');
    await expect(toggle).toBeVisible();
    const box = await toggle.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(48); expect(box!.height).toBeGreaterThanOrEqual(48);
    await toggle.focus(); await page.keyboard.press('Enter');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('#mobile-menu')).toBeVisible();
    await expect(page.locator('body')).toHaveClass(/menu-open/);
    const links = page.locator('#mobile-menu a');
    await expect(links.first()).toBeFocused();
    await page.keyboard.press('Shift+Tab'); await expect(links.last()).toBeFocused();
    await page.keyboard.press('Tab'); await expect(links.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused(); await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await page.keyboard.press('Space'); await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Navigation mobile' }).getByRole('link', { name: 'Tarot', exact: true }).click();
    await page.waitForURL('**/tarot');
    await expect(page.locator('#mobile-menu')).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 761, height: 844 }); await page.goto('/');
  await expect(page.locator('.menu-toggle')).toBeHidden();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Local fonts, gallery filters and the removal of internal editorial notes are preserved', async ({ page }) => {
  const externalFonts: string[] = [];
  page.on('request', request => { if (/fonts\.googleapis|fonts\.gstatic/.test(request.url())) externalFonts.push(request.url()); });
  await page.goto('/'); await page.evaluate(() => document.fonts.ready);
  expect(await page.locator('.hero h1').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Bodoni');
  expect(externalFonts).toEqual([]);
  await expect(page.getByText(/Gloria|fiche à fournir/)).toHaveCount(0);
  await page.locator('[data-filter="illustration"]').click();
  await expect(page.locator('[data-filter="illustration"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.work-card:visible')).toHaveCount(1);
  await page.locator('[data-filter="ceramique"]').click(); await expect(page.locator('.work-card:visible')).toHaveCount(2);
  await page.goto('/illustrations'); await expect(page.getByText(/Gloria|fiche à fournir/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'La Lune', exact: true })).toBeVisible();
});

for (const width of [375, 1440]) {
  test(`Public pages render without errors or horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/', '/illustrations', '/ceramiques', '/oeuvres/la-lune', '/oeuvres/oeuf-phenix', '/oeuvres/assiette-au-crabe', '/tarot', '/ateliers', '/reservation', '/bonjour', '/contact', '/login']) {
      const response = await page.goto(path); expect(response?.status(), path).toBe(200);
      await expect(page.locator('main h1'), path).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), path).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
