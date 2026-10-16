const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const E = require('../engine.js');
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../cards.js'), 'utf8'), ctx);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
test('twelve highlighted decks contain new playable cards, have distinct lists and satisfy deck rules', () => {
  assert.equal(data.featuredDecks.length, 12);
  const seen = new Set(), added = new Set(data.catalogInfo.added);
  for (const key of data.featuredDecks) {
    const deck = data.decks[key];
    assert.deepEqual(E.validateDeck(data.cards, deck), [], key);
    assert.ok(deck.some(code => added.has(code)), key);
    assert.ok(deck.filter(code => data.cards[code].type === 'unit').length >= 15, key);
    assert.ok(data.deckTitles[key]);
    const fingerprint = [...deck].sort().join(',');
    assert.ok(!seen.has(fingerprint), key); seen.add(fingerprint);
  }
  for (const [key, code] of [['braum_poros', '01FR009'], ['anivia_rebirth', '01FR024'], ['tryndamere_ramp', '01FR039']])
    assert.equal(data.decks[key].filter(x => x === code).length, 3, key);
});
test('every highlighted deck completes seeded duels using real rules and survives save/resume', () => {
  for (const key of data.featuredDecks) for (let seed = 1; seed <= 4; seed++) {
    let state = E.create(data.cards, data.decks[key], data.decks.noxus, seed, { faithful: true, skipMulligan: true });
    let actions = 0;
    while (state.winner === null && actions++ < 1800) {
      E.bot(state, state.priority);
      if (actions === 20) state = E.hydrate(JSON.parse(JSON.stringify(state)), data.cards);
      for (const player of state.players) assert.ok(player.board.length <= 6 && player.hand.length <= 10 && player.mana >= 0, key);
    }
    assert.notEqual(state.winner, null, key + ':' + seed);
  }
});
