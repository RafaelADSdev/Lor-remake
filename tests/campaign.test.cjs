const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm');
const E = require('../engine.js');
const C = require('../campaign.js');
const content = require('../campaign-data.js');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../cards.js'), 'utf8'), context);
const data = JSON.parse(JSON.stringify(context.window.CARD_DATA));

const winRegion = (p, region) => ['patrol', 'river', 'elite', 'boss'].reduce((p, suffix) => C.complete(p, region + '-' + suffix, 0, 9).profile, p);

test('campaign starts with exactly three legal mono-region decks in different roles', () => {
  const decks = C.playerDecks(C.empty(), data);
  assert.deepEqual(decks.map(d => d.role), ['Agressivo', 'Defensivo', 'Controle']);
  for (const d of decks) {
    assert.deepEqual(E.validateDeck(data.cards, d.cards), []);
    assert.equal(new Set(d.cards.map(code => data.cards[code].region)).size, 1);
    assert.deepEqual(C.deckErrors(C.empty(), d.cards, data), []);
  }
});

test('only elite and boss victories award complete regional decks, once each', () => {
  const start = C.empty(), initial = C.ownedCards(start, data);
  for (const r of content.regions.filter(r => r.playable)) {
    let p = C.complete(start, r.id + '-patrol', 0, 9).profile;
    p = C.complete(p, r.id + '-river', 0, 9).profile;
    assert.deepEqual(C.ownedCards(p, data), initial, 'ordinary stages never award loose cards');
    assert.equal(C.playerDecks(p, data).length, 3);
    p = C.complete(p, r.id + '-elite', 1, 9).profile;
    assert.equal(C.playerDecks(p, data).length, 3, 'defeats grant nothing');
    p = C.complete(p, r.id + '-elite', 0, 9).profile;
    const intermediate = C.playerDecks(p, data).at(-1);
    assert.equal(C.playerDecks(p, data).length, 4);
    assert.deepEqual(E.validateDeck(data.cards, intermediate.cards), []);
    assert.deepEqual(C.deckErrors(p, intermediate.cards, data), []);
    assert.equal(new Set(intermediate.cards.map(code => data.cards[code].region)).size, 1);
    p = C.complete(p, r.id + '-boss', 0, 9).profile;
    const decks = C.playerDecks(p, data);
    assert.equal(decks.length, 5);
    assert.deepEqual(decks.at(-1).cards, C.deck(r.id + '-boss', data));
    assert.notDeepEqual([...intermediate.cards].sort(), [...decks.at(-1).cards].sort(), r.id);
    assert.deepEqual(C.ownedCards(p, data), new Set(decks.flatMap(d => d.cards)));
    assert.deepEqual(C.playerDecks(C.importProfile(JSON.stringify(p)), data), decks);
    for (const suffix of ['elite', 'boss', 'veteran', 'optional']) p = C.complete(p, r.id + '-' + suffix, 0, 8).profile;
    assert.equal(C.playerDecks(p, data).length, 5);
    assert.deepEqual(C.ownedCards(p, data), new Set(decks.flatMap(d => d.cards)));
  }
});

test('alliance needs a boss and three distinct victories in a different region, in either order', () => {
  let p = winRegion(C.empty(), 'demacia');
  assert.equal(C.alliance(p).unlocked, false, 'the completed region cannot also be the second region');
  for (const suffix of ['patrol', 'river']) p = C.complete(p, 'noxus-' + suffix, 0, 9).profile;
  assert.equal(C.alliance(p).unlocked, false);
  p = C.complete(p, 'noxus-patrol', 0, 7).profile;
  assert.equal(C.alliance(p).unlocked, false, 'replays do not count');
  p = C.complete(p, 'noxus-elite', 0, 9).profile;
  assert.equal(C.alliance(p).unlocked, true);
  assert.equal(C.alliance(C.importProfile(JSON.stringify(p))).unlocked, true);
  let reverse = C.empty();
  for (const suffix of ['patrol', 'river', 'elite']) reverse = C.complete(reverse, 'noxus-' + suffix, 0, 9).profile;
  assert.equal(C.alliance(reverse).unlocked, false);
  assert.equal(C.alliance(winRegion(reverse, 'demacia')).unlocked, true);
});

test('campaign deck rules enforce owned cards and the alliance independently of deck names', () => {
  let p = C.empty();
  const starters = C.playerDecks(p, data);
  const mixed = [...starters[0].cards.slice(0, 20), ...starters[1].cards.slice(0, 20)];
  assert.ok(C.deckErrors(p, mixed, data).some(e => e.includes('Aliança')));
  assert.ok(C.deckErrors(p, data.decks['campaign-nonexistent'], data).length);
  assert.ok(C.deckErrors(p, C.deck('ionia-boss', data), data).some(e => e.includes('decks conquistados')));
  p = winRegion(p, 'demacia');
  for (const suffix of ['patrol', 'river', 'elite']) p = C.complete(p, 'noxus-' + suffix, 0, 9).profile;
  assert.deepEqual(C.deckErrors(p, mixed, data), []);
  assert.ok(C.deckErrors(p, C.deck('ionia-boss', data), data).length, 'alliance does not unlock unearned cards');
});

test('all ten atlas regions have playable chapters and distinct, verified official emblems', () => {
  const crypto = require('node:crypto'), path = require('node:path');
  const sources = require('../assets/campaign/sources.json');
  const expected = ['demacia', 'noxus', 'freljord', 'ionia', 'piltover-zaun', 'bilgewater', 'shurima', 'targon', 'ixtal', 'shadow-isles'];
  assert.equal(content.encounters.length, 70);
  const hashes = new Set();
  for (const id of expected) {
    const r = C.region(id);
    assert.equal(r.playable, true, id);
    assert.equal(C.encounters(id).length, 7);
    assert.notDeepEqual([...C.deck(id + '-road', data)].sort(), [...C.deck(id + '-river', data)].sort(), id + ' routes have different opponents');
    const bytes = fs.readFileSync(path.join(__dirname, '..', r.symbol));
    const sha = crypto.createHash('sha256').update(bytes).digest('hex');
    assert.equal(sha, sources.symbols[id].sha256);
    hashes.add(sha);
  }
  assert.equal(hashes.size, 10, 'each region has its own emblem');
});

test('expanding the atlas preserves v1 progress, XP, record and selected region', () => {
  const oldSave = { version: 1, selectedRegion: 'freljord', completed: { 'demacia-patrol': { bestRound: 8 }, 'demacia-river': { bestRound: 11 } } };
  const loaded = C.importProfile(JSON.stringify(oldSave));
  assert.deepEqual(loaded, oldSave);
  assert.equal(C.stats(loaded).xp, 85);
  assert.equal(C.stats(loaded).total, 70);
  assert.equal(C.available(loaded, 'demacia-elite'), true);
  assert.equal(C.available(loaded, 'shadow-isles-patrol'), true);
});

test('all regions are free to enter; routes converge and optional encounters stay optional', () => {
  let p = C.empty();
  for (const region of content.regions.filter(r => r.playable)) {
    const nodes = C.encounters(region.id);
    assert.equal(nodes.length, 7);
    assert.equal(C.available(p, nodes[0].id), true);
    assert.equal(C.available(p, region.id + '-boss'), false);
    for (const suffix of ['patrol', 'river', 'elite']) p = C.complete(p, region.id + '-' + suffix, 0, 12).profile;
    assert.equal(C.available(p, region.id + '-boss'), true);
    assert.equal(C.available(p, region.id + '-veteran'), false);
    assert.equal(C.mastery(p, region.id).cleared, 3);
    p = C.complete(p, region.id + '-boss', 0, 15).profile;
    assert.equal(C.available(p, region.id + '-veteran'), true);
    assert.ok(C.titles(p).includes(region.title));
  }
});

test('defeats, draws and repeat victories never farm XP or erase progress', () => {
  const p = C.empty(), id = 'demacia-patrol';
  assert.deepEqual(C.complete(p, id, 1, 10).profile, p);
  assert.deepEqual(C.complete(p, id, 'draw', 10).profile, p);
  const first = C.complete(p, id, 0, 10);
  assert.ok(first.xp > 0);
  const repeat = C.complete(first.profile, id, 0, 8);
  assert.equal(repeat.xp, 0);
  assert.equal(C.stats(repeat.profile).xp, first.xp);
  assert.equal(repeat.profile.completed[id].bestRound, 8);
  assert.deepEqual(p, C.empty(), 'input is not mutated');
  assert.throws(() => C.complete(p, 'demacia-boss', 0, 10));
});

test('saved profiles reject wrong versions and sanitize unknown, malformed and impossible conclusions', () => {
  assert.throws(() => C.importProfile('{bad'));
  assert.throws(() => C.importProfile('{"version":99}'));
  const p = C.normalize({ version: 1, xp: 999999, selectedRegion: '__proto__', completed: {
    'demacia-patrol': { bestRound: 5 }, 'demacia-boss': { bestRound: 3 },
    'missing': { bestRound: 1 }, 'noxus-patrol': { bestRound: -8 }
  }});
  assert.equal(p.selectedRegion, 'demacia');
  assert.deepEqual(Object.keys(p.completed), ['demacia-patrol']);
  assert.equal(C.stats(p).xp, C.get('demacia-patrol').xp);
  assert.deepEqual(C.importProfile(JSON.stringify(p)), p);
});

test('every encounter builds a legal thematic opponent and applies only its declared opening rule', () => {
  for (const node of content.encounters) {
    const list = C.deck(node.id, data);
    assert.deepEqual(E.validateDeck(data.cards, list), [], node.id);
    assert.ok(list.every(code => data.cards[code].region === C.region(node.region).cardRegion), node.id);
    let s = E.create(data.cards, data.decks.demacia, list, 42, { faithful: true });
    C.prepare(s, node.id);
    assert.equal(s.players[0].nexus, 20);
    assert.equal(s.players[1].nexus, 20);
    assert.equal(s.players[1].spellMana, node.spellMana || 0);
    if (node.champion) assert.ok(s.players[1].hand.some(c => c.code === node.champion));
    if (node.openingCard) {
      assert.ok(list.includes(node.openingCard), node.id + ' leader exists in deck');
      assert.ok(s.players[1].hand.some(c => c.code === node.openingCard));
      assert.equal(s.players[1].board.length, 0, 'leader must still be played at its real cost');
    }
    s = E.hydrate(JSON.parse(JSON.stringify(s)), data.cards);
    assert.equal(s.campaign.encounterId, node.id);
    E.mulligan(s, []);
    C.afterMulligan(s);
    if (node.champion) assert.ok(s.players[1].hand.some(c => c.code === node.champion), 'champion survives mulligan');
    if (node.openingCard) assert.ok(s.players[1].hand.some(c => c.code === node.openingCard), 'leader survives mulligan');
    let turns = 0;
    while (s.winner === null && turns++ < 2000) E.bot(s, s.priority);
    assert.notEqual(s.winner, null, node.id);
  }
});
