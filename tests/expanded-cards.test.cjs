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
function setup() {
  const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  s.players.forEach((p) => {
    p.board = [];
    p.hand = [];
    p.mana = 10;
    p.spellMana = 0;
  });
  return s;
}
function put(s, i, code, zone = "hand") {
  const c = {
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  };
  assert.ok(c.code, code);
  s.players[i][zone].push(c);
  return c;
}
test("Data Dragon amplia coleção para dez regiões, incluindo Bandópolis, com artes locais e efeitos explícitos", () => {
  const cards = Object.values(data.cards).filter((c) => c.collectible);
  assert.ok(cards.length >= 60);
  assert.equal(new Set(cards.map((c) => c.region)).size, 10);
  assert.ok(cards.some(c=>c.region==='BandleCity'));
  for (const c of cards) {
    assert.ok(
      fs.existsSync(require("node:path").resolve(__dirname, "../", c.image)),
    );
    assert.ok(
      fs.existsSync(require("node:path").resolve(__dirname, "../", c.portrait)),
    );
  }
});
test("buff permanente, palavra-chave temporária e Elixir de Ferro expiram corretamente", () => {
  const s = setup(),
    u = put(s, 0, "01DE039", "board");
  E.play(s, 0, put(s, 0, "01FR005").id, u.id);
  assert.equal(u.attack, 10);
  assert.equal(u.health, 6);
  s.players[0].mana = 10;
  E.play(s, 0, put(s, 0, "01NX019").id, u.id);
  assert.ok(u.keywords.includes("Overwhelm"));
  E.play(s, 0, put(s, 0, "01FR004").id, u.id);
  E.pass(s, 0);
  E.pass(s, 1);
  assert.equal(u.attack, 10);
  assert.equal(u.maxHealth, 6);
  assert.ok(!u.keywords.includes("Overwhelm"));
});
test("Attune concede reserva e cura pode atingir Nexus ou aliado", () => {
  const s = setup(),
    unit = put(s, 0, "02BW040");
  E.play(s, 0, unit.id);
  assert.equal(s.players[0].spellMana, 1);
  s.priority = 0;
  s.players[0].nexus = 12;
  E.play(s, 0, put(s, 0, "01IO004").id, "my-nexus");
  assert.equal(s.players[0].nexus, 15);
  unit.health = 1;
  E.play(s, 0, put(s, 0, "01IO004").id, unit.id);
  assert.equal(unit.health, unit.maxHealth);
});
test("Disparo Místico atinge aliado; Vingança perde alvo inválido sem afetar Nexus", () => {
  const s = setup(),
    ally = put(s, 0, "01DE046", "board");
  E.play(s, 0, put(s, 0, "01PZ052").id, ally.id);
  E.pass(s, 1);
  assert.equal(ally.health, 2);
  s.priority = 0;
  const enemy = put(s, 1, "01DE039", "board");
  E.play(s, 0, put(s, 0, "01SI001").id, enemy.id);
  E.pass(s, 1);
  assert.equal(s.players[1].board.length, 0);
});
test("Avalanche atinge ambos campos, Lampejo congela e Mobilizar devolve ataque", () => {
  const s = setup(),
    ally = put(s, 0, "01DE046", "board"),
    enemy = put(s, 1, "01DE046", "board");
  E.play(s, 0, put(s, 0, "01FR020").id);
  E.pass(s, 1);
  assert.equal(ally.health, 2);
  assert.equal(enemy.health, 2);
  s.priority = 0;
  E.play(s, 0, put(s, 0, "01FR001").id, enemy.id);
  assert.equal(enemy.attack, 0);
  s.attackTokens = [false, false];
  s.players[0].mana = 10;
  E.play(s, 0, put(s, 0, "01DE021").id);
  E.pass(s, 1);
  assert.ok(E.canAttack(s, 0));
});
test("100 partidas com novos decks e efeitos terminam sem ação ilegal", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = E.create(data.cards, data.decks.frost, data.decks.shadow, seed, {
      faithful: true,
      skipMulligan: true,
    });
    assert.deepEqual(E.validateDeck(data.cards, data.decks.frost), []);
    assert.deepEqual(E.validateDeck(data.cards, data.decks.shadow), []);
    let actions = 0;
    while (s.winner === null && actions++ < 1400) {
      E.bot(s, s.priority);
      for (const p of s.players) {
        assert.ok(p.mana >= 0);
        assert.ok(p.board.length <= 6);
        assert.ok(p.spellMana <= 3);
      }
    }
    assert.notEqual(s.winner, null, "seed " + seed);
  }
});
test("cura com compra, dreno com Robusto e Ruína respeitam os efeitos", () => {
  const s = setup();
  s.players[0].nexus = 10;
  const before = s.players[0].deck.length;
  E.play(s, 0, put(s, 0, "01IO001").id, "my-nexus");
  assert.equal(s.players[0].nexus, 14);
  assert.equal(s.players[0].deck.length, before - 1);
  s.players[0].mana = 10;
  const tough = put(s, 1, "01DE020", "board");
  E.play(s, 0, put(s, 0, "01SI054").id, tough.id);
  E.pass(s, 1);
  assert.equal(s.players[0].nexus, 16);
  assert.equal(s.players[1].board.length, 0);
  s.priority = 0;
  s.players[0].mana = 10;
  put(s, 0, "01NX037", "board");
  put(s, 1, "01DE028", "board");
  E.play(s, 0, put(s, 0, "01SI015").id);
  E.pass(s, 1);
  assert.equal(s.players[0].board.length + s.players[1].board.length, 0);
  assert.equal(s.players[1].nexus, 19);
});
test("buff coletivo, Elusivo permanente e golpe expurgante revalidam corretamente", () => {
  const s = setup(),
    a = put(s, 0, "01DE039", "board"),
    b = put(s, 0, "01DE046", "board");
  E.play(s, 0, put(s, 0, "01DE035").id);
  E.pass(s, 1);
  assert.equal(a.attack, 5);
  assert.equal(b.attack, 4);
  s.priority = 0;
  s.players[0].mana = 10;
  E.play(s, 0, put(s, 0, "01IO022").id, a.id);
  E.play(s, 0, put(s, 0, "01PZ026").id, a.id);
  E.pass(s, s.priority);
  E.pass(s, s.priority);
  assert.ok(a.keywords.includes("Elusive"));
  assert.equal(a.attack, 2);
  const t = setup(),
    victim = put(t, 1, "01DE039", "board");
  E.play(t, 0, put(t, 0, "01NX004").id, victim.id);
  E.play(t, 1, put(t, 1, "01NX027").id, victim.id);
  E.pass(t, 1);
  assert.equal(t.players[1].board.length, 1);
  assert.equal(victim.health, 2);
});
