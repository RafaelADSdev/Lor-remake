const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA)),
  E = require("../engine.js"),
  A = require("../opponents.js");
test("gera biblioteca diversa com 40 cartas, duas regiões e quantidade de unidades suficiente", () => {
  const decks = A.generate(data.cards, data.regionNames);
  assert.ok(decks.length >= 50);
  const seen = new Set();
  for (const d of decks) {
    assert.deepEqual(E.validateDeck(data.cards, d.cards), []);
    assert.ok(
      d.cards.filter((code) => data.cards[code].type === "unit").length >= 20,
    );
    const key = A.fingerprint(d.cards);
    assert.ok(!seen.has(key));
    seen.add(key);
    assert.equal(d.origin, "generated");
  }
});
test("sorteio evita espelho e último oponente; não altera decks ou partida salva", () => {
  const pool = Object.entries(data.decks).map(([id, cards]) => ({
    id,
    cards,
    name: id,
  }));
  const before = JSON.stringify(pool);
  const a = A.pick(pool, data.decks.demacia, null, () => 0),
    b = A.pick(pool, data.decks.demacia, a.id, () => 0);
  assert.notEqual(a.id, "demacia");
  assert.notEqual(b.id, a.id);
  assert.equal(JSON.stringify(pool), before);
});
test("todos os decks gerados completam uma partida sem ações ilegais", () => {
  const decks = A.generate(data.cards, data.regionNames);
  for (let i = 0; i < decks.length; i++) {
    const s = E.create(data.cards, data.decks.demacia, decks[i].cards, i + 1, {
      faithful: true,
      skipMulligan: true,
    });
    let actions = 0;
    while (s.winner === null && actions++ < 1400) {
      E.bot(s, s.priority);
      for (const p of s.players) {
        assert.ok(p.mana >= 0);
        assert.ok(p.board.length <= 6);
        assert.ok(p.spellMana <= 3);
      }
    }
    assert.notEqual(s.winner, null, decks[i].id);
  }
});
