const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  vm = require("node:vm");
const E = require("../engine.js"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA)),
  url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await browser.newContext({
      offline: true,
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await page.locator("#build-deck").click();
  assert.equal(
    await page.locator(".collection-row").count(),
    Object.values(data.cards).filter((c) => c.collectible).length,
  );
  assert.equal(await page.locator("#card-region option").count(), 10);
  await page.locator("#card-region").selectOption("Freljord");
  assert.match(await page.locator("#collection-list").textContent(), /3/);
  await page
    .getByRole("button", {
      name: "Ver detalhes de Elixir de Ferro",
      exact: true,
    })
    .click();
  assert.match(
    await page.locator("#builder-preview").textContent(),
    /Vida|vida|\+0/,
  );
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/cartas-datadragon-v9.png"),
  });
  await page.locator("#close-collection").click();
  await page.locator("#deck").selectOption("frost");
  await page.locator("#start").click();
  assert.ok(await page.locator("#opening-hand").isVisible());
  assert.ok(
    await page.evaluate(() =>
      state.players[0].hand.every((c) =>
        ["Freljord", "Ionia"].includes(c.region),
      ),
    ),
  );
  const s = E.create(data.cards, data.decks.frost, data.decks.shadow, 3, {
    faithful: true,
    skipMulligan: true,
  });
  const make = (code) => ({
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  });
  s.players[0].hand = [make("01IO004"), make("01PZ052")];
  s.players[0].board = [make("01DE046")];
  s.players[0].mana = 10;
  s.players[0].nexus = 12;
  s.players[1].hand = [];
  const p = await context.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await p.goto(url);
  await p.locator("#resume").click();
  await p.locator('#my-hand [data-code="01IO004"]').click();
  assert.ok(
    await p
      .locator("#my-nexus")
      .evaluate((el) => el.classList.contains("spell-target")),
  );
  await p.locator("#my-nexus").click();
  assert.equal(await p.locator("#my-nexus b").textContent(), "15");
  await p.locator('#my-hand [data-code="01PZ052"]').click();
  await p.locator("#my-board .card").click();
  await p.waitForFunction(() => !busy && state.phase === "main");
  assert.equal(await p.locator("#my-board .health").textContent(), "2");
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: coleção jogável, nove regiões, inspeção de Elixir de Ferro, novo deck inicial, Poção cura Nexus aliado e Disparo Místico atinge aliado; offline sem erros.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
