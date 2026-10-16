const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  E = require("../engine.js");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
function fixture(defend = false) {
  const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  const unit = (code) => ({
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  });
  s.round = 5;
  s.players.forEach((p) => {
    p.mana = 3;
    p.spellMana = 2;
    p.hand = [];
  });
  s.players[0].board = [unit("01DE039"), unit("01NX037"), unit("01NX012")];
  s.players[1].board = [unit("01NX015"), unit("01DE046")];
  s.arenaThemes = ["rift", "rift"];
  s.attackTokens = [!defend, defend];
  s.priority = defend ? 1 : 0;
  if (defend)
    E.attack(
      s,
      1,
      s.players[1].board.map((c) => c.id),
    );
  return s;
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await browser.newContext({
      offline: true,
      reducedMotion: "no-preference",
      viewport: { width: 1600, height: 1000 },
    }),
    errors = [];
  const url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
  async function open(s, reduced = false) {
    const p = await context.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    if (reduced) await p.emulateMedia({ reducedMotion: "reduce" });
    await p.addInitScript(
      (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
      s,
    );
    await p.goto(url);
    await p.locator("#resume").click();
    return p;
  }
  const p = await open(fixture());
  const [a, b] = await p.locator("#my-board .card").all();
  const buttonBefore = await p.locator("#pass").boundingBox();
  await a.click();
  assert.equal(await p.evaluate(() => mode), "attack");
  assert.equal(await p.locator("#my-board .on-battlefield").count(), 1);
  assert.equal(await p.evaluate(() => state.phase), "main");
  await b.click();
  assert.equal(await p.locator("#my-board .on-battlefield").count(), 2);
  const buttonAfter = await p.locator("#pass").boundingBox();
  assert.ok(
    Math.abs(buttonBefore.y - buttonAfter.y) < 1,
    "action orb stays on the centre line",
  );
  await a.click();
  assert.equal(await p.locator("#my-board .on-battlefield").count(), 1);
  await b.click();
  assert.equal(await p.evaluate(() => mode), null);
  assert.equal(
    await p
      .locator('#mana-wheel g[data-side="0"] path[data-filled="true"]')
      .count(),
    3,
  );
  assert.equal(
    await p
      .locator('#mana-wheel g[data-side="0"] circle[data-filled="true"]')
      .count(),
    2,
  );
  assert.match(
    await p.locator("#mana-wheel").getAttribute("aria-label"),
    /você 3\/5, reserva 2\/3/,
  );
  await p.waitForFunction(() => NexusView.ready === 2);
  assert.equal(
    await p.locator('.nexus-crystal[data-view="three-quarter"]').count(),
    2,
  );
  await p.screenshot({
    path: path.resolve(__dirname, "../test-results/painel-clique-v14.png"),
  });
  await p.close();
  const d = await open(fixture(true));
  const allies = d.locator("#my-board .card");
  await allies.nth(0).click();
  assert.equal(
    await d.locator('#my-board [data-combat-role="block"]').count(),
    1,
  );
  assert.equal(
    await d
      .locator('#my-board [data-combat-role="block"]')
      .getAttribute("data-combat-lane"),
    "2",
    "skip Fearsome for a 2-attack blocker",
  );
  await allies.nth(1).click();
  assert.equal(
    await d.locator('#my-board [data-combat-role="block"]').count(),
    2,
  );
  await allies.nth(2).click();
  assert.equal(
    await d.locator('#my-board [data-combat-role="block"]').count(),
    2,
    "CantBlock remains in reserve",
  );
  await allies.nth(0).click();
  assert.equal(
    await d.locator('#my-board [data-combat-role="block"]').count(),
    1,
    "second click returns blocker to reserve",
  );
  assert.equal(
    await d.evaluate(() => state.phase),
    "block",
    "assigning a defender does not commit combat",
  );
  await allies.nth(0).click();
  await d.locator("#enemy-board .card").nth(1).click();
  assert.equal(
    await d.locator('#my-board [data-combat-role="block"]').count(),
    2,
    "manual pairing remains available",
  );
  await d.mouse.move(1, 1);
  await d.screenshot({
    path: path.resolve(__dirname, "../test-results/defesa-clique-v14.png"),
  });
  for (const width of [320, 390, 768, 1440]) {
    await d.setViewportSize({ width, height: 1000 });
    assert.ok(
      await d.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    const box = await d.locator("#pass").boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width);
  }
  await d.close();
  const r = await open(fixture(true), true);
  await r.locator("#my-board .card").first().click();
  assert.equal(await r.locator("#my-board .on-battlefield").count(), 1);
  assert.equal(await r.locator(".fx-combat-card").count(), 0);
  await r.close();
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: clique direto ataque/defesa, recolher, bloqueios legais, alvo manual, confirmação preservada, painel fixo/mana real, Nexus lateral e quatro larguras/reduzido.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
