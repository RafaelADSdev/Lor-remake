const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
  const played = [], spec = { champion: true, level: 2, code: 'LEVEL2', championKey: 'BASE' };
  const root = { ArenaMotion: { enabled: true, reduced: false }, CARD_DATA: { cards: { LEVEL2: spec } },
    ChampionCinematic: { play: async c => { played.push(c); return true; } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../champion-presentation.js'), 'utf8'), {
    window: root, matchMedia: () => ({ matches: false }),
  });
  const state = { players: [{ board: [] }, { board: [] }], presentationEvents: [] };
  return { root, played, spec, state, before: { state: structuredClone(state) } };
}
test('a champion evolving on summon plays its cinematic exactly once', async () => {
  const { root, played, spec, state, before } = setup();
  state.players[0].board.push({ ...spec, id: 'darius' });
  state.presentationEvents.push({ kind: 'levelup', owner: 0, id: 'darius', code: 'LEVEL2' });
  await root.ChampionPresentation.change(before, state);
  assert.equal(played.length, 1); assert.equal(played[0].id, 'darius');
});

test('Sem animação suppresses all level-up presentations without changing the evolved state', async () => {
  const { root, played, spec, state, before } = setup();
  root.ChampionCinematic.enabled = false;
  state.players[0].board.push({ ...spec, id: 'garen' });
  state.presentationEvents.push({ kind: 'levelup', owner: 0, id: 'garen', code: 'LEVEL2' });
  const original = JSON.stringify(state);
  await root.ChampionPresentation.change(before, state);
  assert.equal(played.length, 0);
  assert.equal(JSON.stringify(state), original);
});
test('a champion evolving and then dying in one resolution still plays its cinematic', async () => {
  const { root, played, state, before } = setup();
  before.state.players[0].board.push({ champion: true, level: 1, id: 'tryndamere' });
  state.presentationEvents.push({ kind: 'levelup', owner: 0, id: 'tryndamere', code: 'LEVEL2' });
  await root.ChampionPresentation.change(before, state);
  assert.equal(played.length, 1); assert.equal(played[0].code, 'LEVEL2');
});
test('level-up events do not replay on an already evolved unit; board diff still works', async () => {
  const { root, played, spec, state, before } = setup();
  state.players[0].board.push({ ...spec, id: 'garen' });
  before.state.players[0].board.push({ ...spec, level: 1, id: 'garen' });
  await root.ChampionPresentation.change(before, state);
  assert.equal(played.length, 1);
  before.state = structuredClone(state);
  state.presentationEvents.push({ kind: 'levelup', owner: 0, id: 'garen', code: 'LEVEL2' });
  await root.ChampionPresentation.change(before, state);
  assert.equal(played.length, 1);
});
