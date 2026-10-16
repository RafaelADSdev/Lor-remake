const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  C = require("../riot-deck-code.js");
test("lê e reescreve o exemplo da documentação oficial da Riot", () => {
  const code =
    "CEAAEBYBAEDRMGREFYZDKCABAABQMCYSCQNB2JYCAQAQABYMFIWAMAIBBEKCAIRHFE";
  const cards = C.decode(code);
  assert.equal(cards.length, 40);
  assert.equal(C.encode(cards), code);
});
test("regiões recentes, varints e listas em ordem diferente preservam o mesmo código", () => {
  const cards = [
    "06RU001",
    "05BC110",
    "05BC110",
    "01DE039",
    "01DE039",
    "01DE039",
    "07PZ501",
  ];
  const code = C.encode(cards);
  assert.deepEqual(C.decode(code).sort(), cards.sort());
  assert.equal(C.encode([...cards].reverse()), code);
  assert.throws(() => C.decode("AAAA"));
  assert.throws(() => C.decode("codigo-invalido"));
  assert.throws(() => C.encode(["TOKEN"]));
});
