const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.locator('#open-campaign').click();
    const deck = await page.locator('#campaign-deck').inputValue();
    await page.evaluate(() => {
      const choice = document.getElementById('arena-choice');
      choice.value = 'zaun'; choice.dispatchEvent(new Event('change'));
    });
    const expected = { demacia: 'demacia', noxus: 'noxus', freljord: 'freljord', ionia: 'ionia', 'piltover-zaun': 'piltover', bilgewater: 'bilgewater', shurima: 'shurima', targon: 'targon', ixtal: 'rift', 'shadow-isles': 'shadowisles' };
    for (const [region, theme] of Object.entries(expected)) {
      assert.equal(await page.evaluate(({ region, deck }) => CampaignBridge.start(region + '-patrol', deck), { region, deck }), true);
      assert.deepEqual(await page.evaluate(() => state.arenaThemes), [theme, theme], region);
      for (const side of ['local', 'enemy']) {
        assert.equal(await page.locator(`#arena-${side}-surface`).getAttribute('data-theme'), theme);
        await page.locator(`#arena-${side}-surface`).evaluate(img => img.decode());
      }
      await page.locator('#menu').click();
    }
    // A legacy save may have perfectly valid but geographically wrong themes.
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('runeterra-mesa-v1'));
      saved.arenaThemes = ['demacia', 'noxus'];
      localStorage.setItem('runeterra-mesa-v1', JSON.stringify(saved));
    });
    await page.reload();
    await page.locator('#open-campaign').click();
    await page.locator('#campaign-resume').click();
    assert.deepEqual(await page.evaluate(() => state.arenaThemes), ['shadowisles', 'shadowisles']);
    await page.locator('#menu').click();
    assert.equal(await page.locator('#arena-choice').inputValue(), 'zaun', 'campaign preserves free-duel preference');
    await page.evaluate(() => start(true));
    assert.deepEqual(await page.evaluate(() => state.arenaThemes), ['zaun', 'zaun'], 'normal duel still uses manual preference');
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: all campaign regions control both arena sides, legacy resume corrected, free-duel preference preserved, offline backgrounds loaded.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
