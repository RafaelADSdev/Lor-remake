const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  E = require("../engine.js");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await browser.newContext({
      offline: true,
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 960 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => (Date.now = () => 123));
  const url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
  await page.goto(url);
  assert.match(
    await page.locator("#deck-summary").textContent(),
    /40 cartas.*Garen/,
  );
  await page
    .getByRole("button", { name: "Treinar invocação de Garen" })
    .click();
  const champion = page.locator("#my-hand .champion-card:enabled").first();
  const id = await champion.getAttribute("data-id");
  assert.ok((await champion.getAttribute("draggable")) === "true");
  await champion.dragTo(page.locator("#my-board"));
  await page.waitForSelector(`#my-board [data-id="${id}"]`);
  assert.equal(
    await page.locator("#my-board .champion-badge").textContent(),
    "★ CAMPEÃO",
  );
  assert.equal(
    await page.locator("#my-board .card-name").textContent(),
    "Garen",
  );
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  await page.getByRole("button", { name: "Coleção e montar deck" }).click();
  assert.match(await page.locator("#deck-counter").textContent(), /40\/40/);
  await page
    .getByRole("button", { name: "Remover Garen", exact: true })
    .click();
  assert.equal(
    await page.getByRole("button", { name: "Salvar e usar deck" }).isDisabled(),
    true,
  );
  await page
    .getByRole("button", { name: "Adicionar Garen", exact: true })
    .click();
  await page.getByRole("button", { name: "Salvar e usar deck" }).click();
  assert.equal(await page.locator("#deck").inputValue(), "custom");
  await page.reload();
  assert.equal(await page.locator('#deck option[value="custom"]').count(), 1);
  await page.locator("#deck").selectOption("noxus");
  await page
    .getByRole("button", { name: "Treinar invocação de Darius" })
    .click();
  await page.locator("#my-hand .champion-card:enabled").first().click();
  await page.waitForSelector("#my-board .champion-card");
  assert.equal(
    await page.locator("#my-board .card-name").textContent(),
    "Darius",
  );
  await page.getByRole("button", { name: "Nova partida", exact: true }).click();
  // Legal prepared state: Garen needs one more strike and has the attack token.
  const fixture = E.create(
    data.cards,
    Array(30).fill("01DE012"),
    Array(30).fill("01DE046"),
    17,
  );
  while (fixture.round < 5) E.pass(fixture, fixture.priority);
  E.play(fixture, 0, fixture.players[0].hand[0].id);
  E.pass(fixture, 1);
  const g = fixture.players[0].board[0];
  E.attack(fixture, 0, [g.id]);
  E.resolve(fixture, {});
  while (fixture.round < 7) E.pass(fixture, fixture.priority);
  fixture.players[0].deckName = "Garen";
  await page.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    fixture,
  );
  await page.reload();
  await page.getByRole("button", { name: "Continuar partida salva" }).click();
  await page.locator("#attack").click();
  await page.locator("#my-board .champion-card").click();
  await page.getByRole("button", { name: /Confirmar ataque/ }).click();
  await page.waitForFunction(() =>
    state.players[0].board.some((c) => c.champion && c.level === 2),
  );
  assert.match(
    await page.locator("#my-board .champion-badge").textContent(),
    /NÍVEL 2/,
  );
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/campeao-v4.png"),
    fullPage: true,
  });
  // Repeat the legal evolution with effects enabled and verify its presentation.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.reload();
  await page.getByRole("button", { name: "Continuar partida salva" }).click();
  await page.locator("#attack").click();
  await page.locator("#my-board .champion-card").click();
  await page.getByRole("button", { name: /Confirmar ataque/ }).click();
  await page.waitForSelector(".champion-evolution", { timeout: 20000 });
  assert.match(
    await page.locator(".champion-evolution img").getAttribute("src"),
    /01DE012T1/,
  );
  await page.waitForSelector(".champion-evolution", { state: "detached" });
  assert.match(
    await page.locator("#my-board .champion-badge").textContent(),
    /NÍVEL 2/,
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: treino Garen/Darius, arrastar campeão real ao campo, coleção 40 cartas, validação/salvamento customizado, evolução de Garen pelo combate com apresentação animada, zero erros offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
