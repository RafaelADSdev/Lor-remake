/* Isolated profiles only. Complete duel fixtures exercise the real result/save lifecycle. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const game = path.resolve(__dirname, '..'), output = path.join(game, 'test-results');
fs.mkdirSync(output, { recursive: true });
const url = 'file:///' + path.join(game, 'index.html').replaceAll('\\', '/');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
    const page = await context.newPage(), errors = [], remote = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
    await page.goto(url);
    await page.locator('#open-campaign').click();
    await page.locator('#campaign-world > img').evaluate(img => img.decode());
    assert.equal(await page.locator('#campaign-level').textContent(), 'Nível 1');
    assert.equal(await page.locator('.campaign-destinations button').count(), 10);
    const regionIds = await page.evaluate(() => CAMPAIGN_DATA.regions.map(r => r.id));
    for (const id of regionIds) {
      await page.locator(`.campaign-destinations [data-region="${id}"]`).click();
      assert.equal(await page.locator('.campaign-region-hero .campaign-region-symbol').getAttribute('src'), `assets/campaign/regions/${id}.png`);
      assert.equal(await page.locator('.campaign-encounter').count(), 7);
      assert.equal(await page.locator(`[data-encounter="${id}-patrol"]`).isEnabled(), true);
    }
    await page.locator('#campaign .campaign-region-symbol').evaluateAll(images => Promise.all(images.map(image => image.decode())));
    assert.equal(await page.locator('#campaign-pins .campaign-region-symbol').count(), 10);
    await page.locator('.campaign-destinations [data-region="freljord"]').click();
    assert.equal(await page.locator('[data-encounter="freljord-patrol"]').isEnabled(), true, 'high-level region remains open');
    assert.equal(await page.locator('[data-encounter="freljord-boss"]').isEnabled(), false);
    await page.locator('.campaign-destinations [data-region="demacia"]').click();
    assert.equal(await page.locator('#campaign-deck option').count(), 3);
    await page.locator('#campaign-deck').selectOption('campaign-starter-defense');
    await page.screenshot({ path: path.join(output, 'campaign-desktop.png'), fullPage: true });
    await page.locator('[data-encounter="demacia-patrol"]').click();
    assert.equal(await page.locator('#game').isVisible(), true);
    assert.equal(await page.evaluate(() => state.campaign.encounterId), 'demacia-patrol');
    assert.equal(await page.evaluate(() => state.players[0].deckKey), 'campaign-starter-defense');
    assert.equal(await page.evaluate(() => state.phase), 'mulligan');
    await page.locator('#confirm-opening').click();
    await page.locator('#menu').click();
    await page.locator('#open-campaign').click();
    await page.locator('[data-encounter="demacia-patrol"]').click();
    assert.equal(await page.locator('#campaign-replace').isVisible(), true);
    await page.locator('#campaign-replace-cancel').click();
    assert.equal(await page.locator('#campaign').isVisible(), true);
    await page.reload();
    await page.locator('#open-campaign').click();
    await page.locator('#campaign-resume').click();
    assert.equal(await page.evaluate(() => state.campaign.encounterId), 'demacia-patrol');
    // Finished-state fixture: engine completion itself is exercised for all 70 decks in campaign.test.cjs.
    await page.evaluate(async () => {
      clearTimeout(timer); state.players[1].nexus = 0; state.winner = 0; state.phase = 'over';
      render(); save(); await finish();
    });
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#campaign-result').textContent(), /40 XP/);
    await page.locator('#campaign-return').click();
    assert.equal(await page.locator('[data-encounter="demacia-river"]').isEnabled(), true);
    assert.equal(await page.locator('#campaign-total').textContent(), '1/70 encontros');
    await page.reload();
    await page.locator('#choose-duel').click();
    await page.locator('#resume').click();
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#campaign-result').textContent(), /já concluído/);
    assert.equal(await page.evaluate(() => Campaign.stats(Campaign.importProfile(localStorage.getItem('runeterra-campaign-v1'))).xp), 40);
    await page.locator('#campaign-return').click();
    // Import combines records, never erases current victories; malicious/wrong versions remain errors.
    await page.locator('#campaign-import-file').setInputFiles({ name: 'other.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, completed: { 'noxus-patrol': { bestRound: 9 } } })) });
    await page.waitForFunction(() => document.getElementById('campaign-total').textContent === '2/70 encontros');
    await page.locator('#campaign-import-file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"version":99}') });
    await page.waitForFunction(() => document.getElementById('campaign-storage').textContent.includes('Não foi possível importar'));
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#campaign-export').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'runeterra-campanha.json');
    const stream = await download.createReadStream(), chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    assert.equal(Object.keys(JSON.parse(Buffer.concat(chunks)).completed).length, 2);
    await page.locator('#campaign-deck').selectOption('campaign-starter-defense');
    await page.locator('#campaign-collection').click();
    assert.equal(await page.locator('#collection-dialog').isVisible(), true);
    assert.match(await page.locator('#deck-name').inputValue(), /Defensivo/);
    await page.locator('#deck-name').fill('Minha jornada');
    await page.locator('#save-deck').click();
    assert.equal(await page.locator('#campaign-deck').inputValue(), 'custom', 'saving and using a deck selects it in campaign');
    for (const width of [390, 320, 768, 1440]) {
      await page.setViewportSize({ width, height: width <= 390 ? 844 : 1000 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow ' + width);
      await page.locator('.campaign-destinations [data-region="shadow-isles"]').click();
      assert.equal(await page.locator('[data-encounter="shadow-isles-patrol"]').isEnabled(), true);
      await page.waitForFunction(() => {
        const rect = document.querySelector('.campaign-pin[data-region="shadow-isles"]').getBoundingClientRect();
        const viewport = document.getElementById('campaign-map').getBoundingClientRect();
        return rect.left >= viewport.left && rect.right <= viewport.right && rect.top >= viewport.top && rect.bottom <= viewport.bottom;
      });
      await page.locator('.campaign-destinations [data-region="demacia"]').click();
      await page.screenshot({ path: path.join(output, `campaign-${width}.png`), fullPage: true });
    }
    await page.locator('.campaign-destinations [data-region="ionia"]').click();
    assert.match(await page.locator('#campaign-region-panel').textContent(), /Yone/);
    await page.locator('.campaign-destinations [data-region="demacia"]').click();
    // Boss opening through the actual app callback, including post-mulligan guarantee.
    const prerequisiteSave = { version: 1, completed: Object.fromEntries(['patrol', 'river', 'elite'].map(s => ['demacia-' + s, { bestRound: 9 }])) };
    await page.locator('#campaign-import-file').setInputFiles({ name: 'route.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(prerequisiteSave)) });
    await page.locator('[data-encounter="demacia-boss"]').waitFor({ state: 'visible' });
    await page.locator('[data-encounter="demacia-boss"]').click();
    assert.equal(await page.evaluate(() => state.players[1].spellMana), 2);
    await page.locator('#confirm-opening').click();
    assert.equal(await page.evaluate(() => state.players[1].hand.some(c => c.code === '01DE012')), true);
    const xpBeforeDefeat = await page.evaluate(() => Campaign.stats(Campaign.importProfile(localStorage.getItem('runeterra-campaign-v1'))).xp);
    await page.evaluate(async () => { clearTimeout(timer); state.players[0].nexus = 0; state.winner = 1; state.phase = 'over'; render(); save(); await finish(); });
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.match(await page.locator('#campaign-result').textContent(), /continuam guardadas/);
    assert.equal(await page.evaluate(() => Campaign.stats(Campaign.importProfile(localStorage.getItem('runeterra-campaign-v1'))).xp), xpBeforeDefeat);
    await page.locator('#campaign-return').click();
    await page.locator('#campaign-close').click();
    if (await page.locator('#choose-duel').isVisible()) await page.locator('#choose-duel').click();
    await page.locator('#deck').selectOption('garen_challengers');
    await page.locator('#train').click();
    assert.equal(await page.evaluate(() => state.campaign), undefined, 'normal training has no campaign metadata');
    await page.evaluate(async () => { clearTimeout(timer); state.winner = 0; state.phase = 'over'; render(); save(); await finish(); });
    await page.locator('#result-dialog').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#campaign-return').isVisible(), false, 'normal duel result resets campaign UI');
    await page.locator('#view-result').click();
    await page.locator('#menu').click();
    await page.locator('#open-campaign').click();
    for (const id of regionIds.slice(3)) {
      const save = { version: 1, completed: Object.fromEntries(['patrol', 'river', 'elite'].map(s => [id + '-' + s, { bestRound: 9 }])) };
      await page.locator('#campaign-import-file').setInputFiles({ name: 'chapter.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(save)) });
      await page.locator(`.campaign-destinations [data-region="${id}"]`).click();
      await page.locator(`[data-encounter="${id}-boss"]`).click();
      await page.locator('#confirm-opening').click();
      assert.equal(await page.evaluate(() => state.players[1].hand.some(c => c.code === Campaign.get(state.campaign.encounterId).openingCard)), true, id);
      await page.evaluate(async () => { clearTimeout(timer); state.players[1].nexus = 0; state.winner = 0; state.phase = 'over'; render(); save(); await finish(); });
      await page.locator('#result-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#campaign-result').textContent(), /Título conquistado/);
      await page.locator('#campaign-return').click();
      assert.equal(await page.locator(`[data-encounter="${id}-veteran"]`).isEnabled(), true);
    }
    assert.equal(await page.evaluate(() => Campaign.importProfile(localStorage.getItem('runeterra-campaign-v1')).completed['demacia-patrol'].bestRound), 1, 'old progress survives all new chapters');
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log('PASS: ten offline emblems/chapters, seven new boss openings/titles, free regions, routes, resume, XP, backups, editor, normal duel, old progress and 320/390/768/1440 layouts.');
    await context.close();
    const denied = await browser.newContext({ offline: true });
    await denied.addInitScript(() => { Storage.prototype.setItem = function () { throw new DOMException('Disabled', 'QuotaExceededError'); }; });
    const deniedPage = await denied.newPage(); await deniedPage.goto(url);
    await deniedPage.locator('#open-campaign').click();
    await deniedPage.locator('.campaign-destinations [data-region="noxus"]').click();
    assert.match(await deniedPage.locator('#campaign-storage').textContent(), /não conseguiu salvar/);
    await denied.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
