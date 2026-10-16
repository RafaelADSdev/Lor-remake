const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..'), url = pathToFileURL(path.join(root, 'index.html')).href;
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1742, height: 1178 }, reducedMotion: 'no-preference' });
    const page = await context.newPage(), errors = [], remote = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
    await page.goto(url); await page.locator('#open-campaign').click();
    assert.equal(await page.locator('.campaign-territory').count(), 10);
    await page.locator('.campaign-pin[data-region="noxus"] .campaign-pin-mark').hover();
    assert.equal(await page.locator('#campaign-map').getAttribute('data-preview-region'), 'noxus');
    assert.equal(await page.locator('.campaign-pin[data-region="demacia"]').getAttribute('aria-pressed'), 'true', 'hover never selects a chapter');
    assert.match(await page.locator('#campaign-map-peek').textContent(), /Noxus/);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.campaign-territory[data-region="noxus"]')).opacity) > .8);
    await page.screenshot({ path: path.join(root, 'test-results/campaign-map-hover.png') });
    // The geographical interior itself also previews a region, without a canvas read/file CORS dependency.
    const terrain = await page.evaluate(() => {
      const r = CAMPAIGN_MAP_DATA.regions.find(r => r.id === 'shurima'), w = document.getElementById('campaign-world').getBoundingClientRect();
      return { x: w.left + r.sample[0] / 2048 * w.width, y: w.top + r.sample[1] / 2048 * w.height };
    });
    await page.mouse.move(terrain.x, terrain.y);
    await page.waitForFunction(() => document.getElementById('campaign-map').dataset.previewRegion === 'shurima');
    await page.locator('#campaign-title').hover();
    assert.equal(await page.locator('#campaign-map').getAttribute('data-active-region'), 'demacia', 'leaving restores the selected frontier');
    await page.locator('.campaign-destinations [data-region="ionia"]').hover();
    assert.equal(await page.locator('#campaign-map').getAttribute('data-preview-region'), 'ionia');
    await page.locator('.campaign-pin[data-region="noxus"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.campaign-pin[data-region="noxus"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#campaign-map').getAttribute('data-active-region'), 'noxus');
    await page.locator('.campaign-pin[data-region="bilgewater"]').click();
    assert.ok(await page.locator('#campaign-region-panel').evaluate(el => el.getAnimations().length > 0), 'pointer selection starts a short panel transition');
    await page.locator('#motion-toggle').click();
    await page.waitForFunction(() => document.getElementById('campaign-map').dataset.motion === 'off');
    assert.equal(await page.locator('.campaign-territory').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s');
    assert.equal(await page.locator('#campaign-region-panel').evaluate(el => el.getAnimations().length), 0);
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    await context.close();
    const mobile = await browser.newContext({ ...devices['iPhone 13'], offline: true, reducedMotion: 'reduce' });
    const phone = await mobile.newPage(); await phone.goto(url); await phone.locator('#open-campaign').tap();
    await phone.locator('.campaign-destinations [data-region="noxus"]').tap();
    assert.equal(await phone.locator('#campaign-map').getAttribute('data-active-region'), 'noxus');
    assert.equal(await phone.locator('#campaign-map').getAttribute('data-motion'), 'off');
    assert.ok(await phone.locator('.campaign-territory').first().evaluate(el => parseFloat(getComputedStyle(el).transitionDuration) <= .00001), 'reduced motion is instant, including the shared 0.01ms accessibility override');
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await mobile.close();
    console.log('PASS: ten borders, emblem/destination/terrain hover, hover without selection, exit restoration, keyboard, effects toggle, reduced motion, touch and offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
