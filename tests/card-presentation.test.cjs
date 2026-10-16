const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const played = [], rect = { x: 20, y: 40, width: 80, height: 100 };
  const root = { ArenaMotion: { enabled: true, reduced: false },
    CardEffects: { has: () => true, play: async entry => { played.push(entry); return true; }, cancel() {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../card-presentation.js'), 'utf8'), {
    window: root, document: { querySelector: () => null, getElementById: () => ({ getBoundingClientRect: () => rect }) },
  });
  const state = { phase: 'main', combat: null, stack: [], players: [0, 1].map(() => ({ hand: [], board: [] })) };
  return { root, played, state, before: { state: structuredClone(state), nodes: new Map([['u1', { rect }], ['old', { rect }]]) } };
}
test('new summons and removed units use their own card effects and prior rects', async () => {
  const { root, played, state, before } = setup();
  before.state.players[1].board.push({ code: 'OLD', id: 'old' });
  state.players[0].board.push({ code: 'NEW', id: 'u1' });
  await root.CardPresentation.change(before, state);
  assert.deepEqual(played.map(x => [x.code, x.phase]), [['NEW', 'summon'], ['OLD', 'death']]);
  assert.equal(played[1].targetRect.width, 80);
});
test('prepared spells stay silent until the engine resolves them', async () => {
  const { root, played, state, before } = setup();
  const card = { code: 'SPELL', id: 's1', type: 'spell' };
  before.state.players[0].hand.push(card); state.stack.push({ card });
  await root.CardPresentation.change(before, state);
  assert.equal(played.length, 0);
  await root.CardPresentation.change(before, state, { kind: 'stack', spells: [{ resolved: false, card, owner: 0 }] });
  assert.equal(played.length, 0);
  await root.CardPresentation.change(before, state, { kind: 'stack', spells: [{ resolved: true, card, owner: 0, target: 'nexus', before: before.state, after: state }] });
  assert.deepEqual(played.map(x => x.phase), ['cast', 'missile', 'impact']);
});
test('recall uses recall instead of death, and effects off suppress all scenes', async () => {
  const { root, played, state, before } = setup();
  const card = { code: 'RECALLED', id: 'old' };
  before.state.players[0].board.push(card); state.players[0].hand.push(card);
  await root.CardPresentation.change(before, state);
  assert.equal(played[0].phase, 'recall');
  root.ArenaMotion.enabled = false;
  await root.CardPresentation.change(before, state);
  assert.equal(played.length, 1);
});
test('instant signature events use the actual spell code and all selected targets once', async () => {
  const { root, played, state, before } = setup();
  before.state.players[0].hand.push({ id: 'signature', code: 'CHAMPION', type: 'unit' });
  state.presentationEvents = [{ kind: 'spell', id: 'signature', code: 'SIGNATURE', owner: 0, target: ['u1', 'old'] }];
  await root.CardPresentation.change(before, state);
  assert.equal(played.filter(entry => entry.phase === 'cast').length, 1);
  assert.equal(played.filter(entry => entry.phase === 'impact').length, 2);
  assert.ok(played.every(entry => entry.code === 'SIGNATURE'));
  played.length = 0;
  before.state.players[0].hand = [];
  await root.CardPresentation.change(before, state);
  assert.equal(played.length, 0, 'persisted events from a prior action must not replay');
});
