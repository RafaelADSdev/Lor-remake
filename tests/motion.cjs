const { chromium } = require("playwright");
const path = require("node:path"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  assert = require("node:assert/strict");
const E = require("../engine.js");
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
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => (Date.now = () => 3));
  await page.goto(
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"),
  );
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
  await page.waitForTimeout(80);
  assert.ok(
    await page.evaluate(() =>
      document
        .getAnimations()
        .some(
          (a) => a.playState === "running" && !(a instanceof CSSTransition),
        ),
    ),
  );
  assert.equal(await page.locator("#pass").isDisabled(), true);
  await page.waitForFunction(() => !busy && state.priority === 0);
  await page
    .getByRole("button", { name: "Efeitos: ativados", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Efeitos: desligados", exact: true })
      .getAttribute("aria-pressed"),
    "false",
  );
  await page.locator("#attack").click();
  await page.locator("#my-board .card").click();
  await page.getByRole("button", { name: /Confirmar ataque/ }).click();
  await page.waitForTimeout(80);
  assert.equal(
    await page.evaluate(() =>
      document
        .getAnimations()
        .some(
          (a) => a.playState === "running" && !(a instanceof CSSTransition),
        ),
    ),
    false,
  );
  // Interruption during presentation must not schedule an action in the menu.
  await page
    .getByRole("button", { name: "Efeitos: desligados", exact: true })
    .click();
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
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
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  const stopped = await page.evaluate(() => JSON.stringify(state));
  await page.waitForTimeout(1500);
  assert.equal(await page.evaluate(() => JSON.stringify(state)), stopped);
  assert.equal(await page.locator("#effects-layer").locator("*").count(), 0);
  await page.locator("#opponent").selectOption("noxus");
  await page
    .getByRole("button", { name: "Entrar no campo de batalha" })
    .click();
  await page.locator("#confirm-opening").click();
  await page.waitForFunction(() => !busy);
  await page
    .locator('#my-hand .card[data-code="01NX043"]:enabled')
    .first()
    .click();
  await page.locator("#enemy-nexus").click();
  assert.equal(await page.evaluate(() => state.players[1].nexus), 20);
  await page.waitForSelector(".fx-spell");
  assert.equal(await page.locator(".fx-spell").count(), 1);
  assert.equal(await page.locator("#enemy-nexus b").textContent(), "20");
  assert.equal(await page.evaluate(() => state.players[1].nexus), 19);
  await page.waitForFunction(() => !busy && state.priority === 0);
  assert.equal(await page.locator("#enemy-nexus b").textContent(), "19");
  assert.deepEqual(errors, []);
  // Reach a populated board using only legal engine actions for the visual fixture.
  let fixture;
  for (let seed = 1; seed <= 200 && !fixture; seed++) {
    const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, seed);
    for (let n = 0; n < 200 && s.winner === null; n++) {
      if (
        s.phase === "main" &&
        s.priority === 0 &&
        s.players.every((p) => p.board.length >= 2)
      ) {
        fixture = s;
        break;
      }
      if (s.phase === "block") E.resolve(s, E.autoBlocks(s));
      else E.bot(s, s.priority);
    }
  }
  assert.ok(fixture);
  for (let n = 0; n < 6 && fixture.winner === null; n++)
    E.pass(fixture, fixture.priority);
  if (fixture.priority === 1) E.pass(fixture, 1);
  fixture.players[0].deckName = "Vanguarda de Demacia";
  fixture.players[1].deckName = "Legião de Noxus";
  const preview = await context.newPage();
  await preview.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    fixture,
  );
  await preview.goto(
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"),
  );
  await preview
    .getByRole("button", { name: "Continuar partida salva" })
    .click();
  await preview.mouse.move(1420, 90);
  await preview.screenshot({
    path: path.resolve(__dirname, "../test-results/arena-v2.png"),
    fullPage: true,
  });
  // Six units per side must fit the battlefield at every supported breakpoint.
  const full = E.create(
    data.cards,
    Array(30).fill("01DE049"),
    Array(30).fill("01NX012"),
    42,
  );
  while (full.round < 6) E.pass(full, full.priority);
  if (full.priority === 1) E.pass(full, 1);
  for (let n = 0; n < 6; n++) {
    E.play(full, 0, full.players[0].hand[0].id);
    E.play(full, 1, full.players[1].hand[0].id);
  }
  const layout = await context.newPage();
  await layout.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    full,
  );
  await layout.goto(
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"),
  );
  await layout.getByRole("button", { name: "Continuar partida salva" }).click();
  for (const width of [1440, 1100, 1024, 768, 390, 320]) {
    await layout.setViewportSize({ width, height: 960 });
    await layout.mouse.move(1, 1);
    await layout.waitForTimeout(250);
    const fits = await layout.evaluate(() =>
      [...document.querySelectorAll(".board")].every((board) => {
        const r = board.getBoundingClientRect();
        return [...board.querySelectorAll(".card")].every((card) => {
          const c = card.getBoundingClientRect();
          return (
            c.left >= r.left - 1 &&
            c.right <= r.right + 1 &&
            c.top >= r.top - 1 &&
            c.bottom <= r.bottom + 1
          );
        });
      }),
    );
    if (!fits)
      console.log(
        JSON.stringify(
          await layout.evaluate(() =>
            [...document.querySelectorAll(".board")].map((b) => ({
              width: b.getBoundingClientRect().width,
              cards: [...b.querySelectorAll(".card")].map((c) => ({
                width: c.getBoundingClientRect().width,
                transform: getComputedStyle(c).transform,
              })),
            })),
          ),
        ),
      );
    assert.ok(fits, "Campo cheio precisa caber: " + width);
  }
  console.log(
    "PASS: efeitos WAAPI, trava durante animação, opção desligar, interrupção sem ação residual, zero erros; prévia com estado legal.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
