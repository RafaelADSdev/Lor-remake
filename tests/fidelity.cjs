const { chromium } = require("playwright");
const fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  E = require("../engine.js");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(path.resolve(__dirname, "../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    offline: true,
    viewport: { width: 1280, height: 900 },
    recordVideo: {
      dir: path.resolve(__dirname, "../test-results/video"),
      size: { width: 1280, height: 900 },
    },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    Date.now = () => 3;
    window.motionStages = [];
    window.strikeSamples = [];
    document.addEventListener("arena-motion-stage", (e) => {
      motionStages.push(e.detail);
      if (e.detail.phase === "strike-travel") {
        const el = document.querySelector(
          `.fx-combat-card[data-unit-id="${e.detail.attacker}"]`,
        );
        if (!el) return;
        const before = el.getBoundingClientRect();
        setTimeout(() => {
          const after = el.getBoundingClientRect();
          strikeSamples.push({
            id: e.detail.attacker,
            moved: Math.hypot(after.x - before.x, after.y - before.y),
          });
        }, 60);
      }
    });
  });
  const url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
  await page.goto(url);
  await page.locator("#opponent").selectOption("noxus");
  await page
    .getByRole("button", { name: "Entrar no campo de batalha" })
    .click();
  await page.locator("#confirm-opening").click();
  await page.waitForFunction(() => !busy);
  await page
    .locator("#my-hand .card:enabled")
    .filter({ has: page.locator(".power") })
    .first()
    .click();
  await page.waitForSelector(".fx-reveal img");
  assert.match(
    await page.locator(".fx-reveal img").getAttribute("src"),
    /-card\.png$/,
  );
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/revelacao-v3.png"),
  });
  await page.waitForFunction(() => !busy && state.priority === 0);
  const summon = await page.evaluate(() => motionStages.map((s) => s.phase));
  assert.ok(
    summon.indexOf("summon-reveal") < summon.indexOf("transform-to-pog"),
  );
  assert.ok(
    summon.indexOf("transform-to-pog") < summon.indexOf("pog-drop-and-land"),
  );
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  // The fixture is reached by legal actions, never by editing an active battle.
  const fixture = E.create(
    data.cards,
    Array(30).fill("01DE039"),
    Array(30).fill("01DE049"),
    15,
  );
  while (fixture.round < 5) E.pass(fixture, fixture.priority);
  for (let n = 0; n < 2; n++) {
    E.play(fixture, 0, fixture.players[0].hand[0].id);
    E.play(fixture, 1, fixture.players[1].hand[0].id);
  }
  fixture.players[0].deckName = "Vanguarda de Demacia";
  fixture.players[1].deckName = "Bot de treino";
  await page.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    fixture,
  );
  await page.reload();
  await page.getByRole("button", { name: "Continuar partida salva" }).click();
  await page.locator("#attack").click();
  for (const card of await page.locator("#my-board .card").all())
    await card.click();
  await page.getByRole("button", { name: /Confirmar ataque/ }).click();
  await page.waitForFunction(
    () =>
      motionStages.filter((s) => s.phase === "strike-impact").length === 2 &&
      !busy &&
      state.priority === 0,
  );
  const result = await page.evaluate(() => ({
    impacts: motionStages.filter((s) => s.phase === "strike-impact"),
    phases: motionStages.map((s) => s.phase),
    samples: strikeSamples,
    health: state.players[0].board.map((c) => c.health),
  }));
  assert.equal(result.impacts.length, 2);
  assert.notEqual(result.impacts[0].attacker, result.impacts[1].attacker);
  assert.ok(
    result.samples.every((s) => s.moved > 5),
    "Atacantes precisam se deslocar fisicamente",
  );
  assert.ok(result.phases.includes("death-marked-dying"));
  assert.ok(result.phases.includes("death-exit"));
  assert.deepEqual(result.health, [1, 1]);
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/arena-v3.png"),
    fullPage: true,
  });
  // Finish the round: both sides pass, with the bot first exhausting remaining mana.
  for (let n = 0; n < 8; n++) {
    const round = await page.evaluate(() => state.round);
    if (round > 5) break;
    await page.waitForFunction(() => !busy && state.priority === 0);
    await page.locator("#pass").click();
    await page.waitForFunction(() => !busy && state.priority === 0);
  }
  assert.ok(
    await page.evaluate(
      () =>
        motionStages.some((s) => s.phase === "draw-reveal") &&
        motionStages.some((s) => s.phase === "draw-to-hand"),
    ),
  );
  assert.deepEqual(errors, []);
  assert.equal(await page.locator("#effects-layer").locator("*").count(), 0);
  const video = page.video();
  await context.close();
  const movie = await video.path();
  fs.copyFileSync(
    movie,
    path.resolve(__dirname, "../test-results/lor-animacoes-v0.3.webm"),
  );
  await browser.close();
  console.log(
    "PASS: revelação original, revelação→marcador→pouso, dois golpes por par com movimento real, fragmentação, compra→mão, captura de vídeo, zero erros.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
