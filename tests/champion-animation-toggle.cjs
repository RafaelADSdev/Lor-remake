const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ offline: true, reducedMotion: 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('toggle-test-initialized')) {
        localStorage.setItem('lor-champion-cinematic', 'rugged');
        sessionStorage.setItem('toggle-test-initialized', 'yes');
      }
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.locator('.welcome-settings summary').click();
    assert.deepEqual(await page.locator('#champion-cinematic option').allTextContents(), ['Com animação', 'Sem animação']);
    assert.equal(await page.locator('#champion-cinematic').inputValue(), 'on');
    assert.equal(await page.evaluate(() => ChampionCinematic.entryFor({ championKey: '01DE012', level: 2 }).skin), 'Rugged');
    await page.selectOption('#champion-cinematic', 'off');
    const result = await page.evaluate(async () => {
      const s = Engine.create(CARD_DATA.cards, CARD_DATA.decks.noxus, CARD_DATA.decks.demacia, 1, { faithful: true, skipMulligan: true });
      s.players[0].board = []; s.players[0].mana = 10; s.players[1].nexus = 10;
      const card = { ...structuredClone(CARD_DATA.cards['01NX038']), id: 'c' + s.nextId++ };
      s.players[0].hand = [card];
      const before = { state: structuredClone(s) };
      Engine.play(s, 0, card.id);
      await ChampionPresentation.change(before, s);
      return { level: s.players[0].board[0].level, effects: document.querySelectorAll('.champion-cinematic, .champion-evolution, .card-native-effects').length };
    });
    assert.deepEqual(result, { level: 2, effects: 0 });
    await page.reload();
    assert.equal(await page.locator('#champion-cinematic').inputValue(), 'off');
    assert.equal(await page.evaluate(() => ChampionCinematic.enabled), false);
    await page.locator('.welcome-settings summary').click();
    await page.selectOption('#champion-cinematic', 'on');
    await page.reload();
    assert.equal(await page.locator('#champion-cinematic').inputValue(), 'on');
    assert.equal(await page.evaluate(() => ChampionCinematic.enabled), true);
    assert.deepEqual(errors, []);
    console.log('PASS: exactly two options, prior skin preference, off suppresses presentation while Darius evolves, on/off persistence, offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
