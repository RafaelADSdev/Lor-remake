const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
    await page.setContent('<button id="open-animations">Animações</button>');
    await page.evaluate(() => {
      window.played = []; window.cancelled = 0;
      window.CardEffects = {
        list: () => [
          { id: 'ruination', name: 'A Ruína', family: 'Spells', codes: ['01SI015'], phases: ['cast', 'impact'] },
          { id: 'tibbers', name: 'Tibbers', family: 'CardMoments', codes: ['06NX012T1'], phases: ['summon'] },
        ],
        describe: code => CardEffects.list().filter(x => x.codes.includes(code)),
        play: async x => { played.push({ groupId: x.groupId, phase: x.phase, host: !!x.host }); return true; },
        cancel: () => { cancelled++; },
      };
      window.OFFICIAL_CATALOG = { '01SI015': { name: 'A Ruína' }, '06NX012T1': { name: 'Tibbers' } };
      window.CINEMATIC_LIBRARY = [];
    });
    await page.addScriptTag({ path: path.resolve(__dirname, '../animation-gallery.js') });
    await page.click('#open-animations');
    assert.equal(await page.locator('#animation-gallery').evaluate(x => x.open), true);
    assert.equal(await page.locator('.animation-choice').count(), 2);
    await page.fill('#animation-search', 'tibbers');
    assert.equal(await page.locator('.animation-choice').count(), 1);
    await page.locator('.animation-choice').click();
    await page.click('#animation-play');
    assert.deepEqual(await page.evaluate(() => played.at(-1)), { groupId: 'tibbers', phase: 'summon', host: true });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#animation-gallery').evaluate(x => x.open), false);
    assert.equal(await page.locator('#open-animations').evaluate(x => x === document.activeElement), true);
    await page.evaluate(() => AnimationGallery.open({ code: '01SI015' }));
    assert.equal(await page.locator('.animation-choice').count(), 1);
    await page.selectOption('#animation-phase', 'impact');
    await page.click('#animation-play');
    assert.equal(await page.evaluate(() => played.at(-1).phase), 'impact');
    await page.click('#animation-close');
    assert.ok(await page.evaluate(() => cancelled >= 3));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('#open-animations');
    await page.addStyleTag({ path: path.resolve(__dirname, '../animation-gallery.css') });
    assert.ok(await page.evaluate(() => document.querySelector('#animation-gallery').scrollWidth <= innerWidth));
    console.log('PASS: gallery search, card filter, phase, host playback, cancel, focus and mobile sizing.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
