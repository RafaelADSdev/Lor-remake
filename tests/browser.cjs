const { chromium } = require("playwright");
const path = require("node:path"),
  fs = require("node:fs"),
  assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
      offline: true,
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [],
    remote = [];
  await page.addInitScript(() => (Date.now = () => 123));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  await page.goto(
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"),
  );
  await page.locator("#opponent").selectOption("noxus");
  await page
    .getByRole("button", { name: "Entrar no campo de batalha" })
    .click();
  assert.equal(await page.locator("#opening-cards button").count(), 4);
  await page.locator("#confirm-opening").click();
  assert.equal(await page.locator("#my-hand .card").count(), 5);
  assert.equal(await page.evaluate(() => state.round), 1);
  assert.equal(await page.evaluate(() => state.players[0].deck.length), 35);
  const first = page
      .locator("#my-hand .card:enabled")
      .filter({ has: page.locator(".power") })
      .first(),
    id = await first.getAttribute("data-id");
  await first.click();
  assert.ok(
    await page.evaluate(
      (id) => state.players[0].board.some((c) => c.id === id),
      id,
    ),
  );
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  await page.getByRole("button", { name: "Continuar partida salva" }).click();
  let attacked = false,
    blocked = false;
  for (let n = 0; n < 60 && (!attacked || !blocked); n++) {
    await page.waitForFunction(
      () => !busy && (state.priority === 0 || state.winner !== null),
    );
    if (await page.evaluate(() => state.winner !== null)) break;
    if (await page.evaluate(() => state.phase === "block")) {
      const pair = await page.evaluate(() => {
        for (const a of state.players[1].board)
          for (const b of state.players[0].board)
            if (state.combat.ids.includes(a.id) && Engine.canBlock(a, b))
              return { a: a.id, b: b.id };
      });
      if (pair) {
        await page.locator(`#my-board [data-id="${pair.b}"]`).click();
        await page.locator(`#enemy-board [data-id="${pair.a}"]`).click();
        blocked = true;
      }
      await page.getByRole("button", { name: "Confirmar bloqueios" }).click();
      continue;
    }
    const playable = page
      .locator("#my-hand .card:enabled")
      .filter({ has: page.locator(".power") });
    if (await playable.count()) {
      await playable.first().click();
      continue;
    }
    if (await page.locator("#attack").isEnabled()) {
      await page.locator("#attack").click();
      await page.locator("#my-board .card").first().click();
      await page.getByRole("button", { name: /Confirmar ataque/ }).click();
      attacked = true;
      continue;
    }
    await page.locator("#pass").click();
  }
  assert.ok(attacked, "Ataque manual precisa funcionar");
  assert.ok(blocked, "Bloqueio manual precisa funcionar");
  await page.waitForFunction(
    () => !busy && (state.priority === 0 || state.winner !== null),
  );
  await page.waitForFunction(() =>
    [...document.images].every((i) => i.complete && i.naturalWidth > 0),
  );
  fs.mkdirSync(path.resolve(__dirname, "../test-results"), { recursive: true });
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/mesa-desktop.png"),
    fullPage: true,
  });
  await page.reload();
  await page.getByRole("button", { name: "Continuar partida salva" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/mesa-mobile.png"),
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: duelo normal 40 cartas, invocação, ataque/bloqueio manual, salvamento/reload, cinco larguras, zero erros e zero rede.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
