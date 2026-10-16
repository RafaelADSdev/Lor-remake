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
    await page.evaluate(() => {
      const pending = [...CARD_DATA.decks.braum_poros].map(code => code === '01FR009' ? '06RU026' : code);
      localStorage.setItem('runeterra-deck-library-v1', JSON.stringify([
        { id: 'braum-filter', name: 'Meu Braum', cards: CARD_DATA.decks.braum_poros },
        { id: 'aatrox-filter', name: 'Meu Aatrox', cards: pending },
      ]));
    });
    await page.reload();
    assert.equal(await page.locator('#deck-card-filter').count(), 1);
    async function checkSuggestionsAndOrder() {
      const result = await page.evaluate(() => {
        const codes = new Set(Object.values(CARD_DATA.decks).flat());
        const expected = [...codes].filter(code => CARD_DATA.cards[code]?.collectible).sort();
        const suggestions = [...document.querySelector('#deck-card-options').options].map(option => option.value.split(' · ').at(-1)).sort();
        const others = [...document.querySelectorAll('#deck optgroup[label="Outros decks"] option')].map(option => option.textContent);
        return { expected, suggestions, others, sorted: [...others].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })) };
      });
      assert.deepEqual(result.suggestions, result.expected, 'suggest only cards present in available duel decks');
      assert.deepEqual(result.others, result.sorted, 'Outros decks must stay in alphabetical order');
    }
    await checkSuggestionsAndOrder();
    const total = await page.locator('#deck option').count();
    await page.fill('#deck-card-filter', 'Braum');
    assert.ok(await page.evaluate(() => [...document.querySelector('#deck').options].every(option => CARD_DATA.decks[option.value].includes('01FR009'))));
    assert.ok(await page.locator('#deck option[value="saved_braum-filter"]').count());
    await checkSuggestionsAndOrder();
    assert.match(await page.locator('#deck-card-status').innerText(), /Braum/);
    await page.selectOption('#deck', 'saved_braum-filter');
    await page.click('#start');
    assert.equal(await page.evaluate(() => state.players[0].deckName), 'Meu Braum');
    await page.click('#menu');
    await page.fill('#deck-card-filter', 'reliquia assombrada');
    assert.ok(await page.evaluate(() => [...document.querySelector('#deck').options].every(option => CARD_DATA.decks[option.value].includes('01SI007'))));
    await page.fill('#deck-card-filter', '06RU026');
    assert.equal(await page.locator('#start').isDisabled(), true);
    assert.equal(await page.locator('#train').isDisabled(), true);
    await page.getByRole('button', { name: 'Meu Aatrox · Regras pendentes', exact: true }).click();
    assert.equal(await page.locator('#collection-dialog').evaluate(element => element.open), true);
    assert.match(await page.locator('#deck-list').innerText(), /Aatrox/);
    await page.click('#close-collection');
    await page.click('#resume');
    await page.click('#menu');
    assert.equal(await page.locator('#start').isEnabled(), true, 'resuming with no matching decks must restore a valid menu selection');
    await page.fill('#deck-card-filter', 'Yasuo');
    assert.match(await page.locator('#deck-card-status').innerText(), /Nenhum deck/);
    await page.click('#clear-deck-card-filter');
    assert.equal(await page.locator('#deck option').count(), total);
    await checkSuggestionsAndOrder();
    assert.equal(await page.locator('#start').isEnabled(), true);
    await page.fill('#deck-card-filter', 'Bra');
    assert.equal(await page.locator('#deck option').count(), total, 'partial input must not select an unrelated card');
    await page.fill('#deck-card-filter', 'Braum');
    await page.selectOption('#deck', 'saved_braum-filter');
    await page.click('#build-deck');
    await page.selectOption('#collection-preset', 'darius_overwhelm');
    await page.click('#load-featured-deck');
    await page.fill('#deck-name', 'Darius novo');
    await page.click('#save-deck');
    assert.equal(await page.locator('#deck-card-filter').inputValue(), '', 'saving a new deck outside the filter should keep that deck selected');
    assert.equal(await page.locator('#deck').inputValue(), 'custom');
    await checkSuggestionsAndOrder();
    await page.fill('#deck-card-filter', '01FR009');
    assert.ok(await page.locator('#deck-card-filter').evaluate(element => element.getBoundingClientRect().width >= 150), 'card input must remain readable next to clear button');
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/deck-card-filter-desktop.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.locator('#deck-card-filter').evaluate(element => element.getBoundingClientRect().width >= 150), 'mobile card input must remain usable');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.resolve(__dirname, '../test-results/deck-card-filter-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log('PASS: suggestions only from available decks, alphabetical Outros decks, card/spell filter, saved decks, pending editor, no matches/resume, clear, partial search, new deck save and mobile, offline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
