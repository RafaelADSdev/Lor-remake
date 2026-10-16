const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm");
const E = require("../engine.js"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
const fresh = () =>
  E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
  });
function battle() {
  // Normal main-phase fixture after confirming the opening hand.
  const s = fresh();
  E.mulligan(s, []);
  s.players.forEach((p) => {
    p.mana = 10;
    p.spellMana = 0;
    p.hand = [];
    p.board = [];
  });
  return s;
}
test("Elixir exige aliado e aplica +3 apenas nesta rodada sem passar iniciativa", () => {
  const s = fresh();
  E.mulligan(s, []);
  const elixir = { ...data.cards["01NX027"], id: "elixir" };
  s.players[0].hand = [elixir];
  s.players[0].mana = 1;
  assert.equal(E.playable(s, 0, elixir), false);
  const unit = { ...data.cards["01DE039"], id: "ally", maxHealth: 2 };
  s.players[0].board = [unit];
  assert.deepEqual(E.targets(s, 0, elixir), ["ally"]);
  E.play(s, 0, elixir.id, unit.id);
  assert.equal(unit.attack, 5);
  assert.equal(unit.health, 2);
  assert.equal(s.priority, 0);
  E.pass(s, 0);
  E.pass(s, 1);
  assert.equal(unit.attack, 2);
  assert.equal(unit.health, 2);
});
function put(s, side, code, zone = "hand") {
  const c = {
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  };
  s.players[side][zone].push(c);
  return c;
}
test("mulligan começa com quatro cartas, substitui antes de devolver e compra na rodada 1", () => {
  const s = fresh(),
    old = s.players[0].hand.map((c) => c.id);
  assert.equal(s.phase, "mulligan");
  assert.equal(s.players[0].hand.length, 4);
  const before = JSON.stringify(s);
  assert.throws(() => E.mulligan(s, [old[0], old[0]]));
  assert.equal(JSON.stringify(s), before);
  E.mulligan(s, [old[0], old[1]]);
  assert.equal(s.phase, "main");
  assert.equal(s.round, 1);
  assert.ok(s.players[0].hand.some((c) => c.id === old[2]));
  // The round-start draw can draw a returned card, but the two replacements cannot.
  assert.ok(
    s.players[0].hand.slice(0, 4).every((c) => !old.slice(0, 2).includes(c.id)),
  );
  assert.equal(s.players[0].hand.length, 5);
  assert.equal(s.players[0].deck.length, 35);
  const ids = s.players.flatMap((p) => [...p.hand, ...p.deck].map((c) => c.id));
  assert.equal(new Set(ids).size, 80);
});
test("Rápido espera resposta; Súbito salva o alvo e conserva a iniciativa", () => {
  const s = battle(),
    victim = put(s, 1, "01NX015", "board");
  const fast = put(s, 0, "01NX043"),
    burst = put(s, 1, "01DE018");
  const unit = put(s, 1, "01DE039"),
    slow = put(s, 1, "01NX002");
  E.play(s, 0, fast.id, victim.id);
  assert.equal(s.phase, "response");
  assert.equal(victim.health, 1);
  assert.equal(s.players[0].mana, 9);
  assert.equal(E.playable(s, 1, unit), false);
  assert.equal(E.playable(s, 1, slow), false);
  E.play(s, 1, burst.id, victim.id);
  assert.equal(s.priority, 1);
  assert.equal(victim.health, 2);
  E.pass(s, 1);
  assert.equal(s.phase, "main");
  assert.equal(victim.health, 1);
  assert.equal(s.players[1].nexus, 20);
  assert.equal(s.round, 1);
});
test("pilha resolve último feitiço primeiro e feitiço sem alvo válido não causa dano", () => {
  const s = battle(),
    victim = put(s, 1, "01NX015", "board");
  E.play(s, 0, put(s, 0, "01NX043").id, victim.id);
  E.play(s, 1, put(s, 1, "01NX043").id, "nexus");
  const trace = E.pass(s, 0);
  assert.equal(s.players[0].nexus, 19);
  assert.equal(s.players[1].board.length, 0);
  assert.deepEqual(
    trace.spells.map((x) => x.owner),
    [1, 0],
  );
  const t = battle(),
    target = put(t, 1, "01NX015", "board");
  E.play(t, 0, put(t, 0, "01NX043").id, target.id);
  t.players[1].board = [];
  E.pass(t, 1);
  assert.equal(t.players[1].nexus, 20);
});
test("bloqueio confirmado permanece após morte do bloqueador; Sobrepujar atravessa", () => {
  for (const code of ["01DE039", "01NX038"]) {
    const s = battle(),
      a = put(s, 0, code, "board"),
      b = put(s, 1, "01NX015", "board");
    const spell = put(s, 0, "01NX043");
    E.attack(s, 0, [a.id]);
    E.commitBlocks(s, 1, { [a.id]: b.id });
    assert.equal(s.phase, "response");
    assert.equal(s.priority, 0);
    E.play(s, 0, spell.id, b.id);
    E.pass(s, 1);
    assert.equal(s.phase, "main");
    assert.equal(s.players[1].nexus, code === "01NX038" ? 14 : 20);
  }
});
test("Primeira-Espada ganha atributos apenas na rodada do ataque", () => {
  const s = battle(),
    a = put(s, 0, "01DE056", "board");
  E.attack(s, 0, [a.id]);
  E.commitBlocks(s, 1, {});
  E.pass(s, 0);
  assert.equal(a.attack, 5);
  assert.equal(a.maxHealth, 5);
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  assert.equal(a.attack, 3);
  assert.equal(a.maxHealth, 3);
});
test("Olho do Oráculo prevê o combate sem alterar partida ou revelar mão inimiga", () => {
  const s = battle(),
    a = put(s, 0, "01DE039", "board");
  E.attack(s, 0, [a.id]);
  const before = JSON.stringify(s),
    prediction = E.preview(s, {});
  assert.equal(prediction.nexus[1], 18);
  assert.equal(JSON.stringify(s), before);
  assert.deepEqual(Object.keys(prediction).sort(), [
    "nexus",
    "survivors",
    "winner",
  ]);
});
test("100 duelos com mulligan, respostas, feitiços e bot de ambos lados terminam", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, seed, {
      faithful: true,
    });
    E.mulligan(
      s,
      s.players[0].hand.filter((c) => c.cost >= 4).map((c) => c.id),
    );
    let actions = 0;
    while (s.winner === null && actions++ < 1200) {
      E.bot(s, s.priority);
      s.players.forEach((p) => {
        assert.ok(p.mana >= 0);
        assert.ok(p.hand.length <= 10);
        assert.ok(p.board.length <= 6);
      });
    }
    assert.notEqual(s.winner, null, "seed " + seed);
  }
});
