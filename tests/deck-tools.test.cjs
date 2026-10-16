const { test } = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs"),
  vm = require("node:vm"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = ctx.window.CARD_DATA,
  D = require("../deck-tools.js");
test("filtros combinam nome sem acento, região, campeão e custo", () => {
  assert.equal(
    D.filter(data.cards, {
      query: "legiao",
      region: "Noxus",
      type: "unit",
      cost: "1",
    }).length,
    2,
  );
  assert.deepEqual(
    D.filter(data.cards, { type: "champion" })
      .map((c) => c.name)
      .sort(),
    ["Anivia", "Braum", "Darius", "Garen", "Tryndamere"],
  );
  assert.equal(D.filter(data.cards, { query: "inexistente" }).length, 0);
});
test("curva soma todas as cópias e agrupa custos 7 ou maiores", () => {
  const stats = D.stats(data.cards, data.decks.demacia);
  assert.equal(
    stats.curve.reduce((a, b) => a + b),
    40,
  );
  assert.equal(stats.champions, 3);
  assert.equal(stats.units + stats.spells, 40);
  assert.equal(stats.regions.length, 2);
});
test("arquivo de deck é portátil, validado e rejeita formatos desconhecidos", () => {
  const deck = D.read(
    data.cards,
    JSON.stringify({
      format: "lor-offline-deck-v1",
      name: "Meu deck",
      cards: data.decks.demacia,
    }),
  );
  assert.equal(deck.cards.length, 40);
  assert.equal(deck.name, "Meu deck");
  assert.throws(() => D.read(data.cards, "{"));
  assert.throws(() =>
    D.read(
      data.cards,
      JSON.stringify({ format: "outro", cards: data.decks.demacia }),
    ),
  );
  assert.throws(() =>
    D.read(
      data.cards,
      JSON.stringify({ format: "lor-offline-deck-v1", cards: ["invalida"] }),
    ),
  );
});
