const { test } = require("node:test"), assert = require("node:assert/strict"),
  fs = require("node:fs"), vm = require("node:vm"), A = require("../opponents.js");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve("../cards.js"), "utf8"), context);
const data = JSON.parse(JSON.stringify(context.window.CARD_DATA));
data.deckNames = { ...data.deckTitles, demacia: "Vanguarda de Demacia · Garen", noxus: "Legião de Noxus · Darius" };
const player = cards => ({ hand: cards.slice(0, 4).map(code => ({ code })), board: [], deck: cards.slice(4).map(code => ({ code })) });

test("nomes gerados identificam cartas e regiões reais, sem prefixo genérico e sem duplicatas", () => {
  const decks = A.generate(data.cards, data.regionNames), names = new Set();
  for (const deck of decks) {
    assert.doesNotMatch(deck.name, /Gerado|auto_/);
    assert.ok(deck.cards.some(code => deck.name.includes(data.cards[code].name)));
    assert.ok(deck.cards.some(code => deck.name.includes(data.regionNames[data.cards[code].region] || data.cards[code].region)));
    assert.ok(!names.has(deck.name), deck.name);
    names.add(deck.name);
  }
});
test("salvamento antigo recupera nome pela composição, sem depender do deck selecionado no menu", () => {
  const mine = player(data.decks.noxus);
  mine.deckName = "Seu deck";
  assert.equal(A.playerName(data, mine), "Legião de Noxus · Darius");
  const enemy = player(data.decks.frost);
  enemy.deckName = "Adversário";
  assert.equal(A.playerName(data, enemy, "frost"), data.deckNames.frost);
});
test("nomes personalizados são preservados e nomes antigos de decks gerados são atualizados", () => {
  const mine = { ...player(data.decks.demacia), deckName: "Minha Vanguarda" };
  assert.equal(A.playerName(data, mine), "Minha Vanguarda");
  const generated = A.generate(data.cards, data.regionNames)[0];
  const local = { ...data, decks: { ...data.decks, [generated.id]: generated.cards }, deckNames: { ...data.deckNames, [generated.id]: generated.name } };
  assert.equal(A.playerName(local, { ...player(generated.cards), deckName: "Gerado · Demacia · Pressão 1" }, generated.id), generated.name);
});
test("partida parcial sem metadados usa as cartas restantes, inclusive sem campeão", () => {
  const mine = { hand: [{ code: "01DE039" }], board: [], deck: [] };
  assert.equal(A.playerName(data, mine), "Cithria de Campinuvem · Demacia");
});
