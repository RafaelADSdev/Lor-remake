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
    p.hand = [];
    p.board = [];
    p.mana = 10;
  });
  return s;
}
function put(s, i, code, zone = "board") {
  const c = {
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  };
  assert.ok(c.code);
  s.players[i][zone].push(c);
  return c;
}
function fight(s, a, block) {
  E.attack(s, 0, [a.id]);
  E.commitBlocks(s, 1, block ? { [a.id]: block.id } : {});
  E.pass(s, 0);
}
test("Roubo de Vida cura Nexus e Efêmero morre após golpe ou fim de rodada", () => {
  const s = setup(),
    a = put(s, 0, "01SI004");
  s.players[0].nexus = 10;
  fight(s, a);
  assert.equal(s.players[0].nexus, 10 + a.attack);
  assert.equal(s.players[0].board.length, 0);
  const t = setup();
  put(t, 0, "01IO013");
  E.pass(t, 0);
  E.pass(t, 1);
  assert.equal(t.players[0].board.length, 0);
});
test("Barreira bloqueia próximo dano e depois desaparece; roubo não cura dano prevenido", () => {
  const s = setup(),
    a = put(s, 0, "01SI055"),
    b = put(s, 1, "01DE046");
  b.keywords.push("Barrier");
  s.players[0].nexus = 10;
  fight(s, a, b);
  assert.equal(s.players[0].nexus, 10);
  assert.equal(b.health, 4);
  assert.ok(!b.keywords.includes("Barrier"));
});
test("Barreira expira na rodada e Sobrepujar com roubo não conta dano duas vezes", () => {
  const s = setup(),
    a = put(s, 0, "01DE046");
  E.play(s, 0, put(s, 0, "01DE032", "hand").id, a.id);
  assert.ok(a.keywords.includes("Barrier"));
  E.pass(s, 0);
  E.pass(s, 1);
  assert.ok(!a.keywords.includes("Barrier"));
  const t = setup(),
    u = put(t, 0, "01SI055"),
    b = put(t, 1, "01DE039");
  u.attack = 6;
  u.keywords.push("Overwhelm");
  t.players[0].nexus = 5;
  fight(t, u, b);
  assert.equal(t.players[0].nexus, 11);
  assert.equal(t.players[1].nexus, 16);
});
