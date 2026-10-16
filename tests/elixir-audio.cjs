const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const path = require("node:path"),
  fs = require("node:fs"),
  vm = require("node:vm");
const E = require("../engine.js"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
  faithful: true,
  skipMulligan: true,
});
const make = (code) => ({
  ...structuredClone(data.cards[code]),
  id: "c" + s.nextId++,
  maxHealth: data.cards[code].health,
});
s.players[0].hand = [make("01NX027"), make("01NX027")];
s.players[0].board = [make("01DE039")];
s.players[0].mana = 3;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await page.goto(
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"),
  );
  await page.locator("#resume").click();
  await page.locator("#attack").click();
  await page.locator("#my-board .card").click();
  assert.ok(
    await page.locator('#my-hand [data-code="01NX027"]').first().isEnabled(),
    "Súbito deve funcionar enquanto preparo o ataque",
  );
  await page.locator('#my-hand [data-code="01NX027"]').first().click();
  assert.equal(await page.locator("#my-board .spell-target").count(), 1);
  await page.locator("#my-board .card").click();
  await page.waitForSelector(".fx-buff-rune");
  await page.waitForTimeout(120);
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/elixir-v7.png"),
  });
  await page.waitForFunction(() => !busy);
  assert.equal(await page.locator("#my-board .power").textContent(), "5");
  assert.equal(await page.locator("#pass").textContent(), "Atacar");
  assert.equal(await page.evaluate(() => selected.size), 1);
  await page
    .locator('#my-hand [data-code="01NX027"]')
    .dragTo(page.locator("#my-board .card"));
  await page.waitForFunction(() => !busy && state.players[0].hand.length === 0);
  assert.equal(await page.locator("#my-board .power").textContent(), "8");
  assert.equal(await page.evaluate(() => state.players[0].mana), 1);
  assert.equal(await page.evaluate(() => state.priority), 0);
  await page.waitForFunction(() => {
    const a = document.querySelector("#duel-music");
    return !a.paused && a.currentTime > 0.2 && a.readyState >= 2;
  });
  assert.ok(
    await page.evaluate(
      () => document.querySelector("#duel-music").duration > 74,
    ),
  );
  await page.locator("#music-toggle").click();
  assert.ok(
    await page.evaluate(() => document.querySelector("#duel-music").paused),
  );
  await page.locator("#music-volume").evaluate((el) => {
    el.value = "40";
    el.dispatchEvent(new Event("input"));
  });
  await page.reload();
  await page.locator("#resume").click();
  assert.equal(
    await page.locator("#music-toggle").textContent(),
    "Música: desligada",
  );
  assert.equal(
    await page.evaluate(() => document.querySelector("#duel-music").volume),
    0.4,
  );
  await page.locator("#music-toggle").click();
  await page.waitForFunction(
    () => !document.querySelector("#duel-music").paused,
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await page.locator("#resume").click();
  assert.equal(
    await page.locator("#motion-toggle").textContent(),
    "Efeitos: reduzidos",
  );
  await page.locator("#motion-toggle").click();
  assert.equal(
    await page.locator("#motion-toggle").textContent(),
    "Efeitos: ativados",
  );
  await page.locator('#my-hand [data-code="01NX027"]').first().click();
  await page.locator("#my-board .card").click();
  await page.waitForSelector(".fx-buff-rune");
  assert.ok(await page.locator(".fx-buff-rune").isVisible());
  await page.waitForFunction(() => !busy);
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  assert.ok(
    await page.evaluate(() => document.querySelector("#duel-music").paused),
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: Elixir durante preparo de ataque e por arraste, +3 de ataque, mana/iniciativa e seleção mantidas, animação própria; música real decodificada reproduz, pausa, persiste volume/mute e para no menu.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
