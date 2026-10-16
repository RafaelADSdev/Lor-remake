/* Fresh profiles: lobby navigation and persistent sound preferences. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const url = 'file:///' + path.resolve(__dirname, '../index.html').replaceAll('\\', '/');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url);
    assert.equal(await page.evaluate(() => ArenaMotion.soundEnabled), true, 'effects start enabled');
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'true');
    await page.locator('#sound-toggle').click();
    await page.reload();
    assert.equal(await page.evaluate(() => ArenaMotion.soundEnabled), false, 'explicit mute survives reload');
    assert.equal(await page.locator('#sound-toggle').getAttribute('aria-pressed'), 'false');
    await page.locator('#sound-toggle').click();
    await page.reload();
    assert.equal(await page.evaluate(() => ArenaMotion.soundEnabled && RegionalAudio.enabled), true);
    assert.match(await page.locator('#welcome-campaign-progress').textContent(), /0\/70/);
    await page.locator('#open-campaign').click();
    assert.equal(await page.locator('#campaign').isVisible(), true);
    await page.locator('#campaign-close').click();
    assert.equal(await page.locator('#deck').isVisible(), false, 'configuration waits for mode selection');
    await page.locator('#choose-duel').click();
    assert.equal(await page.locator('#deck').evaluate(el => el === document.activeElement), true);
    await page.locator('#back-to-modes').click();
    assert.equal(await page.locator('#deck').isVisible(), false);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => scrollTo(0, 0));
      if (width > 800) {
        const campaignButton = await page.locator('#open-campaign').boundingBox();
        const duelButton = await page.locator('#choose-duel').boundingBox();
        assert.ok(Math.abs(campaignButton.y - duelButton.y) <= 1, 'mode buttons share a row');
        assert.ok(Math.abs(campaignButton.height - duelButton.height) <= 1, 'mode buttons share height');
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `overflow at ${width}`);
      await page.screenshot({ path: path.resolve(__dirname, `../test-results/home-${width}.png`), fullPage: true });
      await page.locator('#choose-duel').click();
      assert.equal(await page.locator('#deck').isVisible(), true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `duel overflow at ${width}`);
      await page.screenshot({ path: path.resolve(__dirname, `../test-results/home-duel-${width}.png`), fullPage: true });
      await page.locator('#back-to-modes').click();
    }
    await page.locator('.header-more > summary').click();
    assert.equal(await page.locator('#build-deck').isVisible(), true);
    assert.equal(await page.locator('#open-animations').isVisible(), true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#build-deck').isVisible(), false);
    await page.locator('.header-more > summary').click();
    await page.locator('#build-deck').click();
    assert.equal(await page.locator('#collection-dialog').isVisible(), true);
    await page.locator('#close-collection').click();
    await page.locator('.header-more > summary').click();
    await page.locator('#open-animations').click();
    assert.equal(await page.locator('#animation-gallery').isVisible(), true);
    await page.locator('#animation-close').click();
    await page.locator('#choose-duel').click();
    await page.locator('#start').click();
    assert.equal(await page.locator('#game').isVisible(), true);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Home campaign, duel navigation, responsive layout and sound preferences: OK');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
