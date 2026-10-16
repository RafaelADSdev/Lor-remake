const { chromium } = require("playwright");
const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm");
const E = require("../engine.js"),
  ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
const url =
  "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    offline: true,
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage(),
    errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  await page.goto(url);
  await page.locator("#start").click();
  assert.equal(await page.locator("#opening-cards button").count(), 4);
  await page.locator("#opening-cards button").first().click();
  assert.equal(
    await page.locator("#opening-cards [aria-pressed=true]").count(),
    1,
  );
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth),
  );
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/mao-inicial-v5.png"),
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 960 });
    assert.ok(await page.locator("#confirm-opening").isVisible());
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  await page.locator("#confirm-opening").click();
  await page.waitForFunction(() => state.phase !== "mulligan");
  assert.equal(await page.locator("#my-hand .card").count(), 5);
  // A committed enemy Fast spell awaits the player's response after reload.
  const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  s.players.forEach((p) => {
    p.mana = 10;
    p.hand = [];
    p.board = [];
  });
  const put = (i, code, zone = "hand") => {
    const c = {
      ...structuredClone(data.cards[code]),
      id: "c" + s.nextId++,
      maxHealth: data.cards[code].health,
    };
    s.players[i][zone].push(c);
    return c;
  };
  const victim = put(0, "01NX015", "board");
  put(0, "01DE018");
  put(0, "01NX043");
  put(0, "01DE039");
  put(0, "01NX002");
  s.priority = 1;
  E.play(s, 1, put(1, "01NX043").id, victim.id);
  await page.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await page.locator("#resume").click();
  assert.equal(await page.locator("#spell-stack button").count(), 1);
  assert.ok(await page.locator('#my-hand [data-code="01DE039"]').isDisabled());
  assert.ok(await page.locator('#my-hand [data-code="01NX002"]').isDisabled());
  await page.locator("#oracle").click();
  assert.match(
    await page.locator("#oracle-result").textContent(),
    /você 1, bot 0/,
  );
  await page.locator('#my-hand [data-code="01DE018"]').click();
  await page.locator(`#my-board [data-id="${victim.id}"]`).click();
  assert.equal(await page.evaluate(() => state.phase), "response");
  assert.match(
    await page.locator("#oracle-result").textContent(),
    /você 0, bot 0/,
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.evaluate(() => {
    window.spellSamples = [];
    document.addEventListener("arena-motion-stage", (e) => {
      if (e.detail.phase === "spell-missile")
        spellSamples.push(document.querySelector("#enemy-nexus b").textContent);
    });
  });
  await page.locator('#my-hand [data-code="01NX043"]').click();
  await page.locator("#enemy-nexus").click();
  assert.equal(await page.locator("#spell-stack button").count(), 2);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/respostas-v5.png"),
  });
  await page.waitForFunction(
    () => !busy && state.phase === "main" && state.priority === 0,
  );
  assert.equal(await page.evaluate(() => state.players[0].board[0].health), 1);
  assert.equal(await page.locator("#enemy-nexus b").textContent(), "19");
  assert.equal((await page.evaluate(() => spellSamples))[0], "20");
  await page
    .locator(`#my-board [data-id="${victim.id}"]`)
    .dragTo(page.locator("#enemy-board"));
  assert.equal(await page.locator("#pass").textContent(), "Atacar");
  await page.locator("#pass").click();
  await page.waitForFunction(
    () => !busy && state.phase === "response" && state.priority === 0,
  );
  await page.locator("#pass").click();
  await page.waitForFunction(() => !busy && state.phase === "main");
  assert.equal(await page.evaluate(() => state.players[1].nexus), 16);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: mulligan responsivo, resposta persistida, restrição de velocidades, Súbito salva alvo, Oráculo atualiza sem mutação, duas magias resolvem com animação e dano no impacto, zero erros/rede.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
