const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
const E = require("../engine.js"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
const setup = (code) =>
  E.create(data.cards, Array(30).fill(code), Array(30).fill("01DE046"), 1);
test("catálogo e decks de 40 cartas incluem campeões reais", () => {
  assert.ok(data.cards["01DE012"]?.champion);
  assert.ok(data.cards["01NX038"]?.champion);
  for (const deck of [data.decks.demacia, data.decks.noxus]) {
    assert.equal(deck.length, 40);
    assert.ok(deck.some((c) => data.cards[c].champion));
    assert.ok(
      Object.values(
        deck.reduce((a, c) => ((a[c] = (a[c] || 0) + 1), a), {}),
      ).every((n) => n <= 3),
    );
  }
});
test("Garen é invocado, concede bônus e regenera", () => {
  const s = setup("01DE012");
  while (s.round < 5) E.pass(s, s.priority);
  const ally = { ...data.cards["01DE039"], id: "ally", maxHealth: 2 };
  s.players[0].board.push(ally);
  E.play(s, 0, s.players[0].hand[0].id);
  const g = s.players[0].board.find((u) => u.champion);
  assert.equal(g.name, "Garen");
  assert.equal(ally.attack, 3);
  g.health = 2;
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  assert.equal(g.health, 5);
  assert.equal(ally.attack, 2);
});
test("Garen evolui após dois golpes e Mobilizar preserva o ataque inimigo", () => {
  const s = setup("01DE012");
  while (s.round < 5) E.pass(s, s.priority);
  E.play(s, 0, s.players[0].hand[0].id);
  E.pass(s, 1);
  const g = s.players[0].board[0];
  E.attack(s, 0, [g.id]);
  E.resolve(s, {});
  assert.equal(g.strikes, 1);
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  E.attack(s, 0, [g.id]);
  E.resolve(s, {});
  assert.equal(g.level, 2);
  assert.equal(g.attack, 6);
  assert.equal(g.maxHealth, 6);
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  assert.ok(E.canAttack(s, 0));
  assert.ok(E.canAttack(s, 1));
});
test("Darius evolui ao ver Nexus com 10 de vida e conserva dano sofrido", () => {
  const s = setup("01NX038");
  while (s.round < 7) E.pass(s, s.priority);
  E.play(s, 0, s.players[0].hand[0].id);
  const d = s.players[0].board[0];
  d.health = 3;
  s.players[1].nexus = 10;
  E.pass(s, 1);
  assert.equal(d.level, 2);
  assert.equal(d.attack, 10);
  assert.equal(d.health, 4);
  assert.equal(d.maxHealth, 7);
});
test("cópia de Darius vira feitiço e devolve campeão ao deck", () => {
  const s = setup("01NX038");
  while (s.round < 7) E.pass(s, s.priority);
  E.play(s, 0, s.players[0].hand[0].id);
  E.pass(s, 1);
  const c = s.players[0].hand[0],
    view = E.cardView(s, 0, c);
  assert.equal(view.name, "Dizimar de Darius");
  assert.equal(view.type, "spell");
  s.players[0].mana = 6;
  const before = s.players[0].deck.length;
  E.play(s, 0, c.id);
  assert.equal(s.players[1].nexus, 16);
  assert.equal(s.players[0].deck.length, before + 1);
  assert.equal(s.players[0].board.length, 1);
});
test("treino coloca campeão na mão com mana suficiente; deck customizado valida limites", () => {
  const s = E.training(
    data.cards,
    data.decks.demacia,
    data.decks.noxus,
    12,
    "01DE012",
  );
  const g = s.players[0].hand.find((c) => c.code === "01DE012");
  assert.ok(g);
  assert.ok(E.playable(s, 0, g));
  E.play(s, 0, g.id);
  assert.equal(s.players[0].board[0].name, "Garen");
  assert.equal(E.validateDeck(data.cards, data.decks.demacia).length, 0);
  assert.ok(E.validateDeck(data.cards, Array(40).fill("01DE012")).length > 0);
});
test("Julgamento de Garen exige aliado bloqueando, golpeia todos atacantes e embaralha Garen", () => {
  const s = setup("01DE012");
  while (s.round < 7) E.pass(s, s.priority);
  E.play(s, 0, s.players[0].hand[0].id);
  E.pass(s, 1);
  E.pass(s, 0); // rodada 8, ataque inimigo
  const enemy = { ...data.cards["01DE039"], id: "enemy", maxHealth: 2 };
  s.players[1].board = [enemy, { ...enemy, id: "enemy2" }];
  E.attack(s, 1, ["enemy", "enemy2"]);
  const g = s.players[0].board[0],
    copy = s.players[0].hand[0];
  const before = JSON.stringify(s);
  assert.throws(() => E.play(s, 0, copy.id, g.id));
  assert.equal(JSON.stringify(s), before);
  E.previewBlocks(s, 0, { enemy: g.id });
  E.play(s, 0, copy.id, g.id);
  assert.equal(s.players[1].board.length, 0);
  assert.equal(g.level, 2);
  assert.equal(s.players[0].mana, 3);
  assert.equal(s.players[0].spellMana, 0);
  E.resolve(s, {});
  assert.equal(s.players[0].nexus, 20);
});
test("Súbito preserva a ação e bloqueio aceita Rápido, mas rejeita invocação", () => {
  const s = E.create(
    data.cards,
    Array(30).fill("01NX027"),
    Array(30).fill("01DE039"),
    4,
  );
  s.players[0].board = [{ ...data.cards["01DE039"], id: "ally", maxHealth: 2 }];
  E.play(s, 0, s.players[0].hand[0].id, "ally");
  assert.equal(s.priority, 0);
  E.pass(s, 0);
  E.play(s, 1, s.players[1].hand[0].id);
  E.pass(s, 0);
  E.pass(s, 1);
  E.pass(s, 1);
  E.pass(s, 0);
  E.pass(s, 0);
  E.pass(s, 1); // até token inimigo
  while (s.token !== 1) E.pass(s, s.priority);
  if (s.priority !== 1) E.pass(s, 0);
  E.attack(
    s,
    1,
    s.players[1].board.map((c) => c.id),
  );
  assert.equal(E.playable(s, 0, { ...data.cards["01DE039"] }), false);
});
