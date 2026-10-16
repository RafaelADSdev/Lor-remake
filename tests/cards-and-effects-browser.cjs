const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [], remote = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    assert.ok(await page.evaluate(() => Object.values(CARD_DATA.cards).filter(card => card.collectible).length > 200));
    assert.equal(await page.evaluate(() => CardEffects.list().length), 564);
    await page.click('#build-deck');
    await page.selectOption('#catalog-source', 'playable');
    await page.fill('#card-search', 'Relíquia Assombrada');
    await page.getByRole('button', { name: 'Ver detalhes de Relíquia Assombrada', exact: true }).click();
    assert.match(await page.locator('#builder-preview').innerText(), /Jogável/);
    await page.getByRole('button', { name: 'Ver animações da carta' }).click();
    assert.equal(await page.locator('#animation-gallery').evaluate(element => element.open), true);
    assert.ok(await page.locator('.animation-choice').count() >= 1);
    await page.click('#animation-close');
    await page.selectOption('#catalog-source', 'official');
    await page.fill('#card-search', 'Aatrox');
    await page.getByRole('button', { name: 'Ver detalhes de Aatrox', exact: true }).click();
    assert.match(await page.locator('#builder-preview').innerText(), /Na sua coleção/);
    assert.equal(await page.getByRole('button', { name: 'Jogar esta carta no modo livre', exact: true }).count(), 0);
    assert.equal(await page.locator('#collection-dialog').evaluate(element => element.open), true);
    await page.click('#close-collection');
    await page.selectOption('#deck', 'summons');
    await page.click('#start');
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.summons, CARD_DATA.decks.noxus, 21, { faithful: true, skipMulligan: true });
      state.cardCatalog = structuredClone(CARD_DATA.cards);
      for (const player of state.players) { player.board = []; player.hand = []; player.mana = 10; player.spellMana = 0; }
      const make = code => ({ ...structuredClone(CARD_DATA.cards[code]), id: 'c' + state.nextId++, maxHealth: CARD_DATA.cards[code].health });
      state.players[0].board.push(make('01DE011'));
      state.players[1].board.push(make('01DE046'));
      state.priority = 0; state.attackTokens = [true, false]; busy = false;
      resetSelection(); render();
    });
    const attacker = await page.evaluate(() => state.players[0].board[0].id);
    const defender = await page.evaluate(() => state.players[1].board[0].id);
    await page.locator(`#my-board [data-id="${attacker}"]`).click();
    assert.equal(await page.locator(`#enemy-board [data-id="${defender}"]`).evaluate(element => element.classList.contains('challenge-target')), true);
    await page.locator(`#enemy-board [data-id="${defender}"]`).click();
    assert.equal(await page.locator('.challenge-paired').count(), 2);
    await page.click('#attack');
    await page.evaluate(() => clearTimeout(timer));
    assert.equal(await page.evaluate(id => state.combat.forcedBlocks[id], attacker), defender);
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.summons, CARD_DATA.decks.noxus, 22, { faithful: true, skipMulligan: true });
      for (const player of state.players) { player.board = []; player.hand = []; player.mana = 10; player.spellMana = 0; }
      const spec = CARD_DATA.cards['01SI007'];
      state.players[0].hand.push({ ...structuredClone(spec), id: 'c' + state.nextId++, maxHealth: spec.health });
      state.priority = 0; busy = false; resetSelection(); render();
    });
    await page.locator('#my-hand .card').click();
    await page.waitForFunction(() => state.players[0].board.length === 3, null, { timeout: 10000 });
    assert.ok(await page.evaluate(() => state.players[0].board.every(card => card.code === '01SI007T1')));
    await page.evaluate(() => clearTimeout(timer));
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/new-summons-v29.png') });
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.freljord_champions, CARD_DATA.decks.noxus, 23, { faithful: true, skipMulligan: true });
      state.cardCatalog = structuredClone(CARD_DATA.cards);
      for (const player of state.players) { player.board = []; player.hand = []; player.mana = 10; player.spellMana = 3; }
      const make = code => ({ ...structuredClone(CARD_DATA.cards[code]), id: 'c' + state.nextId++, maxHealth: CARD_DATA.cards[code].health });
      state.players[0].board.push(make('01FR024')); state.players[0].hand.push(make('01FR024'));
      state.players[1].board.push(make('01DE046'), make('01DE039'));
      state.priority = 0; busy = false; resetSelection(); render();
    });
    await page.locator('#my-hand .card').click();
    await page.locator('#enemy-board .card').first().click();
    assert.equal(await page.locator('.spell-target-picked').count(), 1);
    assert.match(await page.locator('#pass').innerText(), /Confirmar alvos \(1\/2\)/i);
    await page.locator('#enemy-board .card').last().click();
    await page.waitForFunction(() => !busy);
    assert.ok(await page.evaluate(() => state.players[1].board.every(card => card.attack === 0)));
    await page.evaluate(() => {
      clearTimeout(timer);
      const spec = CARD_DATA.cards['01FR024'];
      state.players[0].hand = [{ ...structuredClone(spec), id: 'c' + state.nextId++, maxHealth: spec.health }];
      state.players[0].mana = 10; state.players[0].spellMana = 3; state.priority = 0; resetSelection(); render();
    });
    await page.locator('#my-hand .card').click();
    await page.locator('#enemy-board .card').first().click();
    await page.click('#pass');
    await page.waitForFunction(() => !busy);
    assert.equal(await page.evaluate(() => state.players[0].hand.length), 0);
    await page.evaluate(() => clearTimeout(timer));
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    await page.click('#menu');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.click('#open-animations');
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/animation-library-mobile-v29.png') });
    assert.ok(await page.evaluate(() => document.querySelector('#animation-gallery').scrollWidth <= innerWidth));
    console.log('PASS: offline collection, card previews, Aatrox in normal collection, Challenger UI, real spell/response summons, one/two target signature and mobile gallery.');
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
