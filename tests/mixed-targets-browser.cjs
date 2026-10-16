const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ offline: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const errors = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.click('#start');
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.demacia, CARD_DATA.decks.noxus, 1, { faithful: true, skipMulligan: true });
      state.cardCatalog = structuredClone(CARD_DATA.cards);
      for (const player of state.players) { player.board = []; player.hand = []; player.mana = 10; player.maxMana = 10; player.spellMana = 0; }
      const make = code => ({ ...structuredClone(CARD_DATA.cards[code]), id: 'c' + state.nextId++, maxHealth: CARD_DATA.cards[code].health });
      const ally = make('01DE039'), enemy = make('01DE046');
      ally.attack = 2; ally.health = ally.maxHealth = 10;
      enemy.attack = 3; enemy.health = enemy.maxHealth = 10;
      state.players[0].board.push(ally); state.players[1].board.push(enemy);
      state.players[0].hand.push(make('01DE026'));
      state.priority = 0; busy = false; resetSelection(); render();
    });
    await page.locator('#my-hand .card').click();
    assert.equal(await page.locator('#my-board .spell-target').count(), 1);
    assert.equal(await page.locator('#enemy-board .spell-target').count(), 0);
    await page.locator('#my-board .card').click();
    assert.equal(await page.locator('#enemy-board .spell-target').count(), 1);
    assert.equal(await page.locator('#pass').isDisabled(), true);
    await page.locator('#my-board .card').click();
    assert.equal(await page.locator('.spell-target-picked').count(), 0);
    assert.equal(await page.locator('#enemy-board .spell-target').count(), 0);
    await page.locator('#my-board .card').click();
    await page.locator('#enemy-board .card').click();
    await page.waitForFunction(() => state.players[0].board[0]?.health === 7 && state.players[1].board[0]?.health === 8 && !busy);
    await page.evaluate(() => {
      clearTimeout(timer);
      state.players[0].board = []; state.players[1].board = [];
      const make = code => ({ ...structuredClone(CARD_DATA.cards[code]), id: 'c' + state.nextId++, maxHealth: CARD_DATA.cards[code].health });
      state.players[0].hand = [make('01IO026'), make('01DE012')];
      state.players[0].mana = 1; state.players[0].maxMana = 2; state.players[0].spellMana = 0;
      state.priority = 0; busy = false; resetSelection(); render();
    });
    assert.match(await page.locator('#my-resources .mana').innerText(), /1\s*\/\s*2/);
    await page.locator('#my-hand [data-code="01IO026"]').click();
    const handTarget = page.locator('#my-hand [data-code="01DE012"]');
    assert.equal(await handTarget.isEnabled(), true, 'unaffordable cards can still be targets in hand');
    assert.equal(await handTarget.evaluate(element => element.classList.contains('spell-target')), true);
    await handTarget.click();
    await page.waitForFunction(() => !busy && state.players[0].board.some(card => card.code === '01IO026'));
    assert.equal(await page.evaluate(() => state.players[0].hand[0].attack), 6);
    assert.equal(await page.evaluate(() => state.players[0].mana), 0);
    await page.evaluate(() => clearTimeout(timer));
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log('PASS: ally/enemy sequential targets, selection undo, required target count, expensive hand target and independent max mana, offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
