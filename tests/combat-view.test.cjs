const { test } = require("node:test"),
  assert = require("node:assert/strict");
const V = require("../combat-view.js");
const state = (owner) => ({
  phase: "block",
  priority: 1 - owner,
  players: [
    {
      board: [
        { id: "a", name: "Cithria" },
        { id: "x", name: "Garen" },
      ],
    },
    {
      board: [
        { id: "b", name: "Vigia" },
        { id: "y", name: "Poro" },
      ],
    },
  ],
  combat: { owner, ids: owner === 0 ? ["a"] : ["b"] },
});
test("bot defendendo não pede ao jogador para selecionar bloqueadores", () => {
  const s = state(0),
    v = V.describe(s, {});
  assert.match(v.title, /VOCÊ ATACA/);
  assert.match(v.instruction, /bot.*bloqueadores/i);
  assert.equal(v.roles.a.kind, "attack");
  assert.equal(v.roles.x.kind, "reserve");
});
test("números de ataque e bloqueio coincidem e seleção orienta o próximo clique", () => {
  const s = state(1),
    v = V.describe(s, { blocks: { b: "a" }, blocker: "a" });
  assert.equal(v.roles.a.kind, "block");
  assert.equal(v.roles.b.kind, "attack");
  assert.equal(v.roles.a.lane, v.roles.b.lane);
  assert.match(v.title, /BOT ATACA/);
  assert.match(v.instruction, /Cithria/);
  assert.equal(v.unblocked, 0);
});
test("ataque aberto avisa Nexus e resposta mantém identidade dos lados", () => {
  const s = state(1);
  s.phase = "response";
  s.priority = 0;
  const v = V.describe(s, {});
  assert.equal(v.unblocked, 1);
  assert.match(v.detail, /Nexus/);
  assert.match(v.instruction, /Resolver combate/);
  assert.match(v.title, /VOCÊ DEFENDE/);
});
