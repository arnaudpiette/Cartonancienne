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
  expect(ornamentHeights).toEqual(['200px', '200px', '200px']);
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
  expect(mobileOrnamentHeights).toEqual(['200px', '200px', '200px']);
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

test('Workshop, press, ceramic and contact pages use their requested layouts', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/ateliers');
  await expect(page.locator('.workshop-editorial + .workshop-actions')).toHaveCount(1);
  const workshopImages = page.locator('.workshop-grid article img');
  await expect(workshopImages).toHaveCount(4);
  const desktopImageSizes = await workshopImages.evaluateAll((images) => images.map((image) => {
    const { width, height } = image.getBoundingClientRect();
    return { width, height };
  }));
  expect(desktopImageSizes.every(({ width, height }) => width > height)).toBe(true);
  expect(desktopImageSizes.every((size) => size.width === desktopImageSizes[0].width && size.height === desktopImageSizes[0].height)).toBe(true);
  await expect(workshopImages.nth(2)).toHaveAttribute('alt', 'Création de tarot et visionboard pendant un atelier');
  await expect(workshopImages.nth(3)).toHaveAttribute('alt', 'Collage surréaliste créé pendant un atelier');
  const workshopActions = page.locator('.workshop-action');
  await expect(workshopActions).toHaveCount(2);
  await expect(workshopActions.nth(0).locator('.workshop-action-ornament')).toHaveAttribute('src', /celestial-watch/);
  await expect(workshopActions.nth(1).locator('.workshop-action-ornament')).toHaveAttribute('src', /workshop-tools/);
  const ornamentScaleFactors = await workshopActions.locator('.workshop-action-ornament').evaluateAll((ornaments) => ornaments.map((ornament) => ornament.getBoundingClientRect().width / 260));
  expect(ornamentScaleFactors.every((scale) => Math.abs(scale - 2.3) < 0.01)).toBe(true);
  const desktopActionOrder = await workshopActions.evaluateAll((actions) => actions.map((action) => {
    const ornament = action.querySelector('.workshop-action-ornament')!.getBoundingClientRect();
    const copy = action.querySelector('.workshop-action-copy')!.getBoundingClientRect();
    return { ornamentLeft: ornament.left, copyLeft: copy.left };
  }));
  expect(desktopActionOrder[0].ornamentLeft).toBeLessThan(desktopActionOrder[0].copyLeft);
  expect(desktopActionOrder[1].copyLeft).toBeLessThan(desktopActionOrder[1].ornamentLeft);
  await expect(workshopActions.nth(1).locator('.workshop-action-copy > p').nth(1)).toHaveCSS('text-align', 'justify');

  await page.goto('/illustrations');
  await expect(page.locator('.filters')).toHaveCount(0);
  const editorialHeadings = page.locator('.cabinet-heading');
  await expect(editorialHeadings).toHaveCount(2);
  const headingMetrics = await editorialHeadings.evaluateAll((rows) => rows.map((row) => {
    const bounds = row.getBoundingClientRect();
    const label = row.querySelector('.eyebrow')!;
    const style = getComputedStyle(label);
    return { left: bounds.left, width: bounds.width, center: bounds.left + bounds.width / 2, font: style.font, letterSpacing: style.letterSpacing };
  }));
  expect(headingMetrics[0].center).toBeCloseTo(headingMetrics[1].center, 0);
  expect(headingMetrics[0].width).toBeCloseTo(headingMetrics[1].width, 0);
  expect(headingMetrics[0].font).toBe(headingMetrics[1].font);
  expect(headingMetrics[0].letterSpacing).toBe(headingMetrics[1].letterSpacing);

  await page.goto('/presse');
  await expect(page.locator('.page-title-row .presse-title-ornament')).toBeVisible();
  await expect(page.locator('.presse-title-ornament')).toHaveAttribute('src', /presse/i);

  await page.goto('/ceramiques');
  await expect(page.locator('.filters')).toHaveCount(0);
  const ceramicFeature = page.locator('.ceramics-feature');
  await expect(ceramicFeature.locator('video')).toBeVisible();
  await expect(ceramicFeature.locator('.ceramics-feature-copy h2')).toHaveText('Terre, mer et mères divines');
  const ceramicColumns = await ceramicFeature.evaluate((feature) => {
    const video = feature.querySelector('video')!.getBoundingClientRect();
    const copy = feature.querySelector('.ceramics-feature-copy')!.getBoundingClientRect();
    return { videoLeft: video.left, copyLeft: copy.left, videoTop: video.top, copyTop: copy.top, videoRatio: video.width / video.height, collectionsMargin: Number.parseFloat(getComputedStyle(feature.parentElement!.querySelector('.ceramics-collections')!).marginTop) };
  });
  expect(ceramicColumns.videoLeft).toBeLessThan(ceramicColumns.copyLeft);
  expect(Math.abs(ceramicColumns.videoTop - ceramicColumns.copyTop)).toBeLessThan(1);
  expect(ceramicColumns.videoRatio).toBeCloseTo(9 / 16, 2);
  expect(ceramicColumns.collectionsMargin).toBeGreaterThan(60);

  await page.goto('/contact');
  const contactDirect = page.locator('.contact-direct');
  const contactColumns = await contactDirect.evaluate((section) => {
    const photo = section.querySelector('.contact-direct-photo')!.getBoundingClientRect();
    const copy = section.querySelector('.contact-direct-copy')!.getBoundingClientRect();
    return { photoLeft: photo.left, copyLeft: copy.left, photoWidth: photo.width };
  });
  expect(contactColumns.photoLeft).toBeLessThan(contactColumns.copyLeft);
  expect(contactColumns.photoWidth).toBeLessThanOrEqual(190);
  await expect(contactDirect).toContainText('severinepiettepr@gmail.com');

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/ateliers');
  const mobileActionOrder = await workshopActions.evaluateAll((actions) => actions.map((action) => {
    const ornament = action.querySelector('.workshop-action-ornament')!.getBoundingClientRect();
    const copy = action.querySelector('.workshop-action-copy')!.getBoundingClientRect();
    return { ornamentTop: ornament.top, copyTop: copy.top };
  }));
  expect(mobileActionOrder[0].ornamentTop).toBeLessThan(mobileActionOrder[0].copyTop);
  expect(mobileActionOrder[1].copyTop).toBeLessThan(mobileActionOrder[1].ornamentTop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/ceramiques');
  const mobileCeramicColumns = await page.locator('.ceramics-feature').evaluate((feature) => {
    const video = feature.querySelector('video')!.getBoundingClientRect();
    const copy = feature.querySelector('.ceramics-feature-copy')!.getBoundingClientRect();
    return { videoTop: video.top, copyTop: copy.top };
  });
  expect(mobileCeramicColumns.videoTop).toBeLessThan(mobileCeramicColumns.copyTop);
  await page.goto('/contact');
  const mobileContactColumns = await contactDirect.evaluate((section) => {
    const photo = section.querySelector('.contact-direct-photo')!.getBoundingClientRect();
    const copy = section.querySelector('.contact-direct-copy')!.getBoundingClientRect();
    return { photoLeft: photo.left, copyLeft: copy.left };
  });
  expect(mobileContactColumns.photoLeft).toBeLessThan(mobileContactColumns.copyLeft);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
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

test('Large page ornaments load image variants at least as wide as their rendered size', async ({ page }) => {
  for (const width of [375, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/illustrations', '/ateliers', '/bonjour', '/contact']) {
      await page.goto(path);
      const ornaments = page.locator('.ornament');
      for (let index = 0; index < await ornaments.count(); index++) {
        const ornament = ornaments.nth(index);
        await ornament.scrollIntoViewIfNeeded();
        const { renderedWidth, sourceWidth, pixelRatio, source } = await ornament.evaluate(async (element) => {
          if (!(element instanceof HTMLImageElement)) throw new Error('Expected an ornament image');
          element.loading = 'eager';
          await element.decode();
          const source = new URL(element.currentSrc || element.src, document.baseURI);
          return {
            renderedWidth: element.getBoundingClientRect().width,
            sourceWidth: Number(source.searchParams.get('w')),
            pixelRatio: window.devicePixelRatio,
            source: source.href,
          };
        });
        expect(sourceWidth, `${path} at ${width}px: ${source}`).toBeGreaterThanOrEqual(Math.ceil(renderedWidth * pixelRatio));
      }
    }
  }
});

test('Anonymous visitors are denied access to admin pages and mutation APIs', async ({ page }) => {
  for (const path of ['/admin', '/admin/agenda', '/admin/oeuvre', '/admin/ornements']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
  for (const path of ['/api/artworks', '/api/admin/agenda', '/api/admin/appointments', '/api/admin/notifications']) {
    const response = await page.request.post(path);
    expect(response.status(), path).toBe(403);
  }
});

test('Hero animation respects reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  await expect(page.locator('.hero-egg')).toHaveCSS('animation-name', 'egg-float');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.hero-egg')).toHaveCSS('animation-name', 'none');
});

for (const width of [375, 1440]) {
  test(`Public pages render without errors or horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    for (const path of ['/', '/illustrations', '/ceramiques', '/oeuvres/la-lune', '/oeuvres/oeuf-phenix', '/oeuvres/assiette-au-crabe', '/oeuvres/carnet-moleskine', '/oeuvres/assiette-au-poulpe', '/oeuvres/cristaux', '/tarot', '/ateliers', '/reservation', '/bonjour', '/contact', '/mentions-legales', '/login']) {
      const response = await page.goto(path); expect(response?.status(), path).toBe(200);
      await expect(page.locator('main h1'), path).toHaveCount(1);
      await expect(page.locator('.logo-signature'), path).toHaveText('Séverine Piette');
      const signatureFontSize = await page.locator('.logo-signature').evaluate((signature) => Number.parseFloat(getComputedStyle(signature).fontSize));
      expect(signatureFontSize, path).toBeGreaterThan(11);
      await expect(page.locator('.desktop-nav a').first(), path).toHaveAttribute('href', '/bonjour');
      await expect(page.locator('#mobile-menu nav a').first(), path).toHaveAttribute('href', '/bonjour');
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

test('Images load on all public pages', async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const path of ['/', '/illustrations', '/ceramiques', '/oeuvres/la-lune', '/oeuvres/oeuf-phenix', '/oeuvres/assiette-au-crabe', '/oeuvres/carnet-moleskine', '/oeuvres/assiette-au-poulpe', '/oeuvres/cristaux', '/tarot', '/ateliers', '/reservation', '/bonjour', '/contact', '/mentions-legales', '/login']) {
    await page.goto(path);
    const images = page.locator('main img');
    for (let index = 0; index < await images.count(); index++) {
      const { naturalWidth, currentSrc } = await images.nth(index).evaluate(async (element) => {
        if (!(element instanceof HTMLImageElement)) throw new Error('Expected a page image');
        element.loading = 'eager';
        await element.decode();
        return { naturalWidth: element.naturalWidth, currentSrc: element.currentSrc };
      });
      expect(naturalWidth, `${path} image ${index}: ${currentSrc}`).toBeGreaterThan(0);
    }
  }
});
