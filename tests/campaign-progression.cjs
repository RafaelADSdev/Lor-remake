/* Isolated save fixtures; victories exercise the application's result callback. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: 'reduce', viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.locator('#open-campaign').click();
    assert.equal(await page.locator('#campaign-deck option').count(), 3);
    assert.match(await page.locator('#campaign-alliance').textContent(), /Chefes: 0\/1/);
    await page.locator('#campaign-collection').click();
    assert.match(await page.locator('#collection-count').textContent(), /dos decks conquistados na campanha/);
    assert.equal(await page.locator('.collection-row').evaluateAll(rows => rows.every(row => CampaignUI.ownedCards().has(row.dataset.code))), true);
    // Presets and imports cannot save unearned or mixed decks through this editor.
    await page.locator('#collection-preset').selectOption('anivia_rebirth');
    await page.locator('#load-featured-deck').click();
    assert.equal(await page.locator('#save-deck').isDisabled(), true);
    assert.match(await page.locator('#deck-error').textContent(), /Aliança/);
    await page.locator('#close-collection').click();
    assert.doesNotMatch(await page.locator('.campaign-encounter[data-kind="patrol"] small').textContent(), /cartas|Deck completo/);
    assert.match(await page.locator('.campaign-encounter[data-kind="elite"] small').textContent(), /Deck completo/);
    const completed = Object.fromEntries(['demacia-patrol', 'demacia-river', 'noxus-patrol', 'noxus-river'].map(id => [id, { bestRound: 9 }]));
    await page.locator('#campaign-import-file').setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, completed })) });
    await page.waitForFunction(() => document.getElementById('campaign-total').textContent === '4/70 encontros');
    assert.equal(await page.locator('#campaign-deck option').count(), 3, 'ordinary victories do not unlock cards or decks');
    await page.locator('[data-encounter="demacia-elite"]').click();
    await page.evaluate(async () => {
      clearTimeout(timer); state.round = 9; state.players[1].nexus = 0; state.winner = 0; state.phase = 'over'; render(); save(); await finish();
    });
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#campaign-result').textContent(), /Deck conquistado: Demacia/);
    assert.doesNotMatch(await page.locator('#campaign-result').textContent(), /Cartas conquistadas/);
    await page.locator('#campaign-return').click();
    assert.equal(await page.locator('#campaign-deck option').count(), 4);
    await page.locator('#campaign-deck').selectOption('campaign-reward-demacia-intermediate');
    await page.locator('[data-encounter="demacia-boss"]').click();
    await page.evaluate(async () => {
      clearTimeout(timer); state.round = 9; state.players[1].nexus = 0; state.winner = 0; state.phase = 'over'; render(); save(); await finish();
    });
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#campaign-result').textContent(), /Deck conquistado: Demacia/);
    await page.locator('#campaign-return').click();
    assert.equal(await page.locator('#campaign-deck option').count(), 5);
    assert.match(await page.locator('#campaign-alliance').textContent(), /outra região: 2\/3/);
    // Start validation also protects the bridge; a normal-library deck cannot bypass rewards.
    assert.equal(await page.evaluate(() => CampaignBridge.start('noxus-elite', 'anivia_rebirth')), false);
    assert.equal(await page.locator('#campaign').isVisible(), true);
    await page.locator('.campaign-destinations [data-region="noxus"]').click();
    await page.locator('[data-encounter="noxus-elite"]').click();
    await page.evaluate(async () => {
      clearTimeout(timer); state.round = 9; state.players[1].nexus = 0; state.winner = 0; state.phase = 'over'; render(); save(); await finish();
    });
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#campaign-result').textContent(), /Aliança entre Regiões liberada!/);
    await page.locator('#campaign-return').click();
    assert.equal(await page.locator('#campaign-deck option').count(), 6);
    await page.reload();
    await page.locator('#open-campaign').click();
    assert.match(await page.locator('#campaign-alliance').textContent(), /Aliança entre Regiões liberada/);
    await page.evaluate(() => {
      const decks = Campaign.playerDecks(Campaign.importProfile(localStorage.getItem('runeterra-campaign-v1')), CARD_DATA);
      CARD_DATA.decks.custom = [...decks[0].cards.slice(0, 20), ...decks[1].cards.slice(0, 20)];
      CARD_DATA.deckNames.custom = 'Minha aliança';
      document.dispatchEvent(new CustomEvent('lor-deck-saved', { detail: { key: 'custom' } }));
    });
    assert.equal(await page.locator('#campaign-deck').inputValue(), 'custom');
    await page.locator('[data-encounter="noxus-patrol"]').click();
    assert.equal(await page.evaluate(() => new Set(state.players[0].deck.concat(state.players[0].hand).map(c => CARD_DATA.cards[c.code].region)).size), 2);
    assert.deepEqual(errors, []);
    await context.close();
    console.log('PASS: three starters, no loose card rewards, intermediate deck after elite, boss deck, earned editor cards, alliance, persistence and mixed-deck launch.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
