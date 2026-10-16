const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: 'no-preference', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.evaluate(() => {
      const legacy = Engine.create(CARD_DATA.cards, CARD_DATA.decks.demacia, CARD_DATA.decks.noxus, 21, { faithful: true, skipMulligan: true });
      delete legacy.cardCatalog; delete legacy.presentationEvents;
      for (const player of legacy.players) { delete player.scheduled; delete player.globalBuffs; }
      localStorage.setItem('runeterra-mesa-v1', JSON.stringify(legacy));
    });
    await page.reload();
    assert.equal(await page.locator('#resume').isVisible(), true);
    await page.click('#resume');
    assert.equal(await page.evaluate(() => !!state.cardCatalog['01DE012'] && state.players.every(p => Array.isArray(p.scheduled))), true);
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.summons, CARD_DATA.decks.noxus, 22, { faithful: true, skipMulligan: true });
      for (const player of state.players) { player.board = []; player.hand = []; player.mana = 10; player.spellMana = 0; }
      const spec = CARD_DATA.cards['01SI007'];
      state.players[0].hand.push({ ...structuredClone(spec), id: 'c' + state.nextId++, maxHealth: spec.health });
      state.priority = 0; busy = false; resetSelection(); render();
    });
    await page.locator('#my-hand .card').click();
    await page.locator('canvas.card-native-effects').first().waitFor({ timeout: 12000 });
    assert.equal(await page.evaluate(() => state.players[0].board.length), 3);
    assert.ok(await page.evaluate(() => CardEffects.status().active > 0));
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/native-spell-duel-v29.png') });
    await page.click('#menu');
    await page.waitForFunction(() => CardEffects.status().active === 0);
    assert.equal(await page.locator('canvas.card-native-effects').count(), 0);
    await page.click('#start');
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.noxus, CARD_DATA.decks.demacia, 23, { faithful: true, skipMulligan: true });
      for (const player of state.players) { player.board = []; player.hand = []; player.mana = 10; player.spellMana = 0; }
      state.players[1].nexus = 10;
      const spec = CARD_DATA.cards['01NX038'];
      state.players[0].hand.push({ ...structuredClone(spec), id: 'c' + state.nextId++, maxHealth: spec.health });
      state.priority = 0; busy = false; resetSelection(); render();
      window.levelUpCalls = [];
      const originalPlay = ChampionCinematic.play;
      ChampionCinematic.play = async card => { levelUpCalls.push({ code: card.code, id: card.id }); return originalPlay(card); };
    });
    await page.locator('#my-hand .card').click();
    await page.waitForFunction(() => levelUpCalls.some(card => card.code === '01NX038T2'), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => state.players[0].board[0].level), 2);
    await page.waitForFunction(() => !busy, null, { timeout: 15000 });
    await page.evaluate(() => clearTimeout(timer));
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log('PASS: legacy save resume, native spell effects in real duel, menu cancellation and Darius level-up presentation on summon, offline.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
