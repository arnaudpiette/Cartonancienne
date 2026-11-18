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
  await expect(page.locator('.logo-signature')).toHaveText('Séverine Piette');
  await expect(page.locator('.hero .eyebrow')).toHaveCount(0);
  await expect(page.locator('#atelier-caption')).toContainText('Mon atelier');
  expect(externalFonts).toEqual([]);
  await expect(page.getByText(/Gloria|fiche à fournir/)).toHaveCount(0);
  await expect(page.locator('.work-card[data-kind="illustration"]')).toHaveCount(3);
  await expect(page.locator('.work-card[data-kind="ceramique"]')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Carnet Moleskine', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Assiette au poulpe', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cristaux', exact: true })).toBeVisible();
  await page.locator('[data-filter="illustration"]').click();
  await expect(page.locator('[data-filter="illustration"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.work-card:visible')).toHaveCount(3);
  await page.locator('[data-filter="ceramique"]').click(); await expect(page.locator('.work-card:visible')).toHaveCount(3);
  await page.goto('/illustrations'); await expect(page.getByText(/Gloria|fiche à fournir/)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'La Lune', exact: true })).toBeVisible();
  await expect(page.getByText('Biodynamie créative')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Mes services à la carte' })).toHaveCount(0);
});

test('Homepage Atelier card and section follow the requested composition', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const panels = page.locator('.split-links > a');
  await expect(panels).toHaveCount(3);
  await expect(panels.nth(0)).toHaveAttribute('href', '/tarot');
  await expect(panels.nth(0).locator('h2')).toHaveText('Tarot');
  await expect(panels.nth(0)).toHaveCSS('text-align', 'center');
  await expect(panels.nth(1)).toHaveAttribute('href', '/illustrations');
  await expect(panels.nth(1).locator('h2')).toHaveText('Illustrations');
  await expect(panels.nth(2).locator('h2')).toHaveText('Ateliers');
  await expect(panels.nth(1).locator('.split-link-copy')).toHaveCSS('text-align', 'center');
  await expect(panels.nth(2).locator('.split-link-copy')).toHaveCSS('text-align', 'center');
  const desktopTitleStyles = await panels.locator('h2').evaluateAll((titles) => titles.map((title) => {
    const style = getComputedStyle(title);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing];
  }));
  expect(desktopTitleStyles[1]).toEqual(desktopTitleStyles[0]);
  expect(desktopTitleStyles[2]).toEqual(desktopTitleStyles[0]);
  await expect(panels.nth(2).locator('img')).toHaveCSS('opacity', '1');
  await expect(panels.nth(2).locator('img')).toHaveCSS('position', 'relative');
  await expect(panels.nth(2).locator('.split-link-copy > b')).toHaveCSS('margin-top', '24px');
  await expect(panels.nth(0).locator('img')).toHaveAttribute('src', /cartonancienne-pierre-tarot/);
  await expect(panels.nth(1).locator('img')).toHaveAttribute('src', /cartonancienne-papier-illustrations/);
  const ornamentWidths = await panels.locator('img').evaluateAll((images) => images.map((image) => getComputedStyle(image).width));
  expect(ornamentWidths).toEqual(['200px', '200px', '300px']);
  const ornamentHeights = await panels.locator('img').evaluateAll((images) => images.map((image) => getComputedStyle(image).height));
  expect(ornamentHeights).toEqual(['200px', '200px', '300px']);
  const desktopPanelHeights = await panels.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(desktopPanelHeights[0]).toBe(505);
  expect(desktopPanelHeights[1]).toBe(desktopPanelHeights[2]);
  const desktopAlignments = await panels.evaluateAll((elements) => elements.slice(1).map((panel) => {
    const slot = panel.querySelector('.split-ornament-slot')?.getBoundingClientRect();
    const image = panel.querySelector('img')?.getBoundingClientRect();
    const copy = panel.querySelector('.split-link-copy')?.getBoundingClientRect();
    return slot && image && copy
      ? {
          imageVerticalCenter: image.top + image.height / 2,
          slotVerticalCenter: slot.top + slot.height / 2,
          imageCenter: image.left + image.width / 2,
          slotCenter: slot.left + slot.width / 2,
          copyTop: copy.top,
          ornamentEyebrowGap: copy.top - slot.bottom,
          groupCenter: (slot.top + copy.bottom) / 2,
          panelCenter: panel.getBoundingClientRect().top + panel.getBoundingClientRect().height / 2,
          copyCenter: copy.left + copy.width / 2,
          panelHorizontalCenter: panel.getBoundingClientRect().left + panel.getBoundingClientRect().width / 2,
        }
      : null;
  }));
  expect(desktopAlignments.every((alignment) => alignment !== null &&
    Math.abs(alignment.imageVerticalCenter - alignment.slotVerticalCenter) < 1 &&
    Math.abs(alignment.imageCenter - alignment.slotCenter) < 1 &&
    Math.abs(alignment.ornamentEyebrowGap) < 1 &&
    Math.abs(alignment.groupCenter - alignment.panelCenter) < 1 &&
    Math.abs(alignment.copyCenter - alignment.panelHorizontalCenter) < 1)).toBe(true);
  await expect(page.locator('.about-tease + #atelier')).toHaveCount(1);
  const atelierFigureOrder = await page.locator('#atelier figure').evaluate((figure) => Array.from(figure.children).map((child) => child.tagName));
  expect(atelierFigureOrder).toEqual(['FIGCAPTION', 'IMG']);
  const borders = await panels.evaluateAll((elements) => elements.map((element) => {
    const style = getComputedStyle(element);
    return { bottom: style.borderBottomWidth, left: style.borderLeftWidth, bottomColor: style.borderBottomColor, leftColor: style.borderLeftColor };
  }));
  expect(borders[0].bottom).toBe('1px');
  expect(borders[0].bottomColor).toBe(borders[2].leftColor);
  expect(borders[1].left).toBe('0px');
  expect(borders[2].left).toBe('1px');
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(panels.nth(0)).toHaveCSS('text-align', 'center');
  await expect(panels.nth(1).locator('.split-link-copy')).toHaveCSS('text-align', 'center');
  await expect(panels.nth(2).locator('.split-link-copy')).toHaveCSS('text-align', 'center');
  const mobileTitleStyles = await panels.locator('h2').evaluateAll((titles) => titles.map((title) => {
    const style = getComputedStyle(title);
    return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight, style.letterSpacing];
  }));
  expect(mobileTitleStyles[1]).toEqual(mobileTitleStyles[0]);
  expect(mobileTitleStyles[2]).toEqual(mobileTitleStyles[0]);
  await expect(panels.nth(1).locator('.split-link-copy > b')).toHaveCSS('margin-top', '8px');
  await expect(panels.nth(2).locator('.split-link-copy > b')).toHaveCSS('margin-top', '8px');
  const mobileOrnamentWidths = await panels.locator('img').evaluateAll((images) => images.map((image) => getComputedStyle(image).width));
  expect(mobileOrnamentWidths).toEqual(['200px', '200px', '300px']);
  const mobileOrnamentHeights = await panels.locator('img').evaluateAll((images) => images.map((image) => getComputedStyle(image).height));
  expect(mobileOrnamentHeights).toEqual(['200px', '200px', '300px']);
  const mobilePanelHeights = await panels.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().height));
  expect(mobilePanelHeights[0]).toBe(315);
  expect(mobilePanelHeights[1]).toBeGreaterThan(315);
  expect(mobilePanelHeights[2]).toBe(mobilePanelHeights[1]);
  const mobileOrnamentGaps = await panels.evaluateAll((elements) => elements.slice(1).map((panel) => {
    const slot = panel.querySelector('.split-ornament-slot')!.getBoundingClientRect();
    const copy = panel.querySelector('.split-link-copy')!.getBoundingClientRect();
    return copy.top - slot.bottom;
  }));
  expect(mobileOrnamentGaps).toEqual([0, 0]);
  const workshopCtaFits = await panels.nth(2).evaluate((panel) => {
    const cta = panel.querySelector('b');
    return cta !== null && cta.getBoundingClientRect().bottom <= panel.getBoundingClientRect().bottom;
  });
  expect(workshopCtaFits).toBe(true);
});

test('Arrow links use a consistent icon size and text spacing', async ({ page }) => {
  for (const path of ['/', '/ateliers', '/tarot', '/bonjour', '/presse', '/illustrations', '/ceramiques', '/contact', '/reservation', '/oeuvres/la-lune']) {
    await page.goto(path);
    const arrows = await page.locator('.arrow-link .arrow-icon').evaluateAll((icons) => icons.map((icon) => {
      const link = icon.closest('.arrow-link');
      const style = getComputedStyle(icon);
      return { width: style.width, height: style.height, gap: link ? getComputedStyle(link).gap : null };
    }));
    expect(arrows.length, path).toBeGreaterThan(0);
    expect(arrows.every(({ width, height, gap }) => width === '14px' && height === '14px' && gap === '8px'), `${path}: ${JSON.stringify(arrows)}`).toBe(true);
  }
});

for (const width of [375, 1440]) {
  test(`Public pages render without errors or horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/', '/illustrations', '/ceramiques', '/oeuvres/la-lune', '/oeuvres/oeuf-phenix', '/oeuvres/assiette-au-crabe', '/oeuvres/carnet-moleskine', '/oeuvres/assiette-au-poulpe', '/oeuvres/cristaux', '/tarot', '/ateliers', '/reservation', '/bonjour', '/contact', '/login']) {
      const response = await page.goto(path); expect(response?.status(), path).toBe(200);
      await expect(page.locator('main h1'), path).toHaveCount(1);
      const { scrollWidth, overflowingElements } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        overflowingElements: [...document.querySelectorAll('body *')]
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return rect.left < -1 || rect.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1;
          })
          .map((element) => {
            const rect = element.getBoundingClientRect();
            const className = typeof element.className === 'string' ? element.className : '';
            return `${element.tagName.toLowerCase()}.${className} [${Math.round(rect.left)}, ${Math.round(rect.right)}; ${element.clientWidth}/${element.scrollWidth}]`;
          })
          .slice(0, 5),
      }));
      expect(scrollWidth, `${path}: ${overflowingElements.join(', ')}`).toBeLessThanOrEqual(width);
    }
    expect(errors).toEqual([]);
  });
}
