const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<select id="champion-cinematic"><option value="on">Com animação</option><option value="off">Sem animação</option></select>');
    await page.evaluate(() => {
      window.CINEMATIC_LIBRARY = [
        { id: 'ahri', name: 'Ahri', championCodes: ['05IO004'], codes: ['05IO004T1'], level: 2, defaultChampionCinematic: true },
        { id: 'ahri-skin', name: 'Ahri Coven', skin: 'Coven', championCodes: ['05IO004'], level: 2, defaultChampionCinematic: false },
      ];
    });
    await page.addScriptTag({ path: path.resolve(__dirname, '../champion-cinematic.js') });
    assert.equal(await page.evaluate(() => ChampionCinematic.entryFor({ championKey: '05IO004', level: 2 }).id), 'ahri');
    assert.equal(await page.evaluate(() => ChampionCinematic.entryFor({ championKey: '01DE012', level: 2 })), null);
    assert.deepEqual(await page.locator('#champion-cinematic option').allTextContents(), ['Com animação', 'Sem animação']);
    await page.selectOption('#champion-cinematic', 'off');
    assert.equal(await page.evaluate(() => ChampionCinematic.enabled), false);
    assert.equal(await page.evaluate(() => ChampionCinematic.entryFor({ championKey: '05IO004', level: 2 })), null);
    await page.selectOption('#champion-cinematic', 'on');
    assert.equal(await page.evaluate(() => ChampionCinematic.entryFor({ championKey: '05IO004', level: 2 }).id), 'ahri');
    console.log('PASS: two animation options, correct champion default and on/off behavior.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
