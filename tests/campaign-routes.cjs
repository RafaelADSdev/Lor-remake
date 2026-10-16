const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ ...devices['Pixel 7'], offline: true, reducedMotion: 'reduce' });
    await page.goto('file:///' + path.resolve(__dirname, '../index.html').replaceAll('\\', '/'));
    await page.locator('#open-campaign').click();
    const route = page.locator('.campaign-route-map');
    await route.waitFor();
    assert.equal(await route.locator('button').count(), 7);
    assert.equal(await route.locator('path').count(), 7);
    assert.match(await route.locator('[data-route="demacia-patrol"]').getAttribute('aria-label'), /Aberto/);
    assert.match(await route.locator('[data-route="demacia-boss"]').getAttribute('aria-label'), /Bloqueado/);
    assert.match(await route.locator('[data-route="demacia-elite"]').getAttribute('aria-label'), /XP.*[Dd]eck/);
    await route.locator('[data-route="demacia-patrol"]').tap();
    assert.equal(await page.evaluate(() => document.activeElement.dataset.encounter), 'demacia-patrol');
    assert.equal(await page.evaluate(() => state), null, 'Selecting a route never starts a duel');
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      for (const button of await route.locator('button').all()) assert.ok((await button.boundingBox()).width >= 44);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/campaign-routes-mobile.png'), fullPage: true });
    await page.locator('.campaign-route-section').screenshot({ path: path.resolve(__dirname, '../test-results/campaign-routes-detail.png') });
    console.log('Campaign routes: branches, rewards, locked stages, touch navigation and mobile layout passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
