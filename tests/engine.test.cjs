const { test } = require("node:test");
const assert = require("node:assert/strict");
const E = require("../engine.js");
const unit = (id, attack = 3, health = 3, keys = []) => ({
  id,
  code: "test",
  name: "Teste",
  cost: 1,
  attack,
  health,
  maxHealth: health,
  keywords: keys,
  type: "unit",
});
const catalog = { a: unit("a") };
test("combate retorna eventos visuais por par sem alterar as regras", () => {
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 3);
  s.players[0].board = [unit("a1", 4, 3), unit("a2", 2, 2)];
  s.players[1].board = [unit("b1", 1, 2)];
  E.attack(s, 0, ["a1", "a2"]);
  const trace = E.resolve(s, { a1: "b1" });
  assert.equal(trace.kind, "combat");
  assert.equal(trace.lanes.length, 2);
  assert.equal(trace.lanes[0].blockerId, "b1");
  assert.equal(trace.lanes[0].attackerHealth, 2);
  assert.equal(trace.lanes[0].blockerHealth, -2);
  assert.equal(trace.lanes[1].nexusDamage, 2);
  assert.deepEqual(trace.nexusAfter, [20, 18]);
});
test("partida determinística, mão inicial e mana", () => {
  const a = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 123);
  assert.deepEqual(
    a,
    E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 123),
  );
  assert.equal(a.players[0].hand.length, 5);
  assert.equal(a.players[0].mana, 1);
});
test("ação ilegal não altera estado", () => {
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 1);
  s.players[0].mana = 0;
  const before = JSON.stringify(s);
  assert.throws(() => E.play(s, 0, s.players[0].hand[0].id));
  assert.equal(JSON.stringify(s), before);
});
test("combate simultâneo e sobrepujar", () => {
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 1);
  s.players[0].board = [unit("atk", 7, 4, ["Overwhelm"])];
  s.players[1].board = [unit("def", 4, 2)];
  E.attack(s, 0, ["atk"]);
  E.resolve(s, { atk: "def" });
  assert.equal(s.players[1].nexus, 15);
  assert.equal(s.players[0].board.length, 0);
  assert.equal(s.players[1].board.length, 0);
});
test("dois passes: rodada, token e reserva de mana", () => {
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 1);
  E.pass(s, 0);
  E.pass(s, 1);
  assert.equal(s.round, 2);
  assert.equal(s.token, 1);
  assert.equal(s.players[0].spellMana, 1);
  assert.equal(s.players[0].mana, 2);
});
test("bloqueio ilegal e atacante repetido são rejeitados", () => {
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 1);
  s.players[0].board = [unit("atk")];
  s.players[1].board = [unit("def", 3, 3, ["CantBlock"])];
  assert.throws(() => E.attack(s, 0, ["atk", "atk"]));
  E.attack(s, 0, ["atk"]);
  assert.throws(() => E.resolve(s, { atk: "def" }));
});
test("reserva de feitiço não paga unidades; feitiço atinge o Nexus", () => {
  const spell = {
    ...unit("s"),
    type: "spell",
    effect: "damage",
    cost: 2,
    amount: 1,
  };
  const s = E.create(
    { a: unit("a"), s: spell },
    Array(30).fill("a"),
    Array(30).fill("s"),
    1,
  );
  s.players[0].mana = 0;
  s.players[0].spellMana = 3;
  assert.throws(() => E.play(s, 0, s.players[0].hand[0].id));
  s.priority = 1;
  s.players[1].mana = 0;
  s.players[1].spellMana = 3;
  E.play(s, 1, s.players[1].hand[0].id, "nexus");
  assert.equal(s.players[0].nexus, 19);
  assert.equal(s.players[1].spellMana, 1);
});
test("Assustador, Elusivo e Robusto restringem bloqueio e dano", () => {
  assert.equal(E.canBlock(unit("a", 3, 3, ["Fearsome"]), unit("b", 2)), false);
  assert.equal(E.canBlock(unit("a", 3, 3, ["Elusive"]), unit("b")), false);
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 1);
  s.players[0].board = [unit("atk", 2, 5)];
  s.players[1].board = [unit("def", 1, 3, ["Tough"])];
  E.attack(s, 0, ["atk"]);
  E.resolve(s, { atk: "def" });
  assert.equal(s.players[1].board[0].health, 2);
});
test("morte ao expirar bônus temporário também dispara Suspiro Final", () => {
  const s = E.create(catalog, Array(30).fill("a"), Array(30).fill("a"), 1);
  s.players[0].board = [
    {
      ...unit("grenade", 3, 1, ["LastBreath"]),
      effect: "lastDamage",
      tempHealth: 1,
      maxHealth: 3,
    },
  ];
  E.pass(s, 0);
  E.pass(s, 1);
  assert.equal(s.players[0].board.length, 0);
  assert.equal(s.players[1].nexus, 19);
});
test("100 partidas completas com decks reais, limites e retomada determinística", () => {
  const fs = require("node:fs"),
    vm = require("node:vm");
  const ctx = { window: {} };
  vm.runInNewContext(
    fs.readFileSync(require.resolve("../cards.js"), "utf8"),
    ctx,
  );
  const { cards, decks } = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.create(cards, decks.demacia, decks.noxus, seed);
    let actions = 0;
    while (s.winner === null && actions++ < 1000) {
      if (s.phase === "block") E.resolve(s, E.autoBlocks(s));
      else E.bot(s, s.priority);
      for (const p of s.players) {
        assert.ok(p.board.length <= 6);
        assert.ok(p.hand.length <= 10);
        assert.ok(p.mana >= 0 && p.mana <= 10);
        assert.ok(p.spellMana >= 0 && p.spellMana <= 3);
        assert.ok(p.board.every((c) => c.health > 0));
      }
      if (actions === 15) {
        const restored = JSON.parse(JSON.stringify(s));
        if (s.phase === "block") {
          E.resolve(restored, E.autoBlocks(restored));
          E.resolve(s, E.autoBlocks(s));
        } else {
          E.bot(restored, restored.priority);
          E.bot(s, s.priority);
        }
        assert.deepEqual(restored, s);
      }
    }
    assert.notEqual(
      s.winner,
      null,
      "Partida precisa terminar, semente " + seed,
    );
  }
});
