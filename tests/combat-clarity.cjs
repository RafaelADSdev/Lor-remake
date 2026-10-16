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
function fixture(owner, phase = "response") {
  const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  const make = (code) => ({
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  });
  s.players[0].board = [make("01DE039"), make("01DE046")];
  s.players[1].board = [make("01NX037"), make("01NX015")];
  s.attackTokens = [owner === 0, owner === 1];
  s.priority = owner;
  E.attack(
    s,
    owner,
    s.players[owner].board.map((c) => c.id),
  );
  if (phase === "response") {
    E.commitBlocks(s, 1 - owner, {
      [s.combat.ids[0]]: s.players[1 - owner].board[0].id,
    });
    s.priority = 0;
  }
  return s;
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    offline: true,
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 960 },
  });
  let page = await context.newPage();
  const errors = [];
  const url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
  await page.goto(url);
  for (const owner of [0, 1]) {
    const s = fixture(owner);
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(
      (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
      s,
    );
    await page.goto(url);
    await page.locator("#resume").click();
    assert.match(
      await page.locator("#phase-label").textContent(),
      owner === 0 ? /VOCÊ ATACA.*BOT DEFENDE/ : /BOT ATACA.*VOCÊ DEFENDE/,
    );
    assert.equal(
      await page.locator('.board [data-combat-role="attack"]').count(),
      2,
    );
    assert.equal(
      await page.locator('.board [data-combat-role="block"]').count(),
      1,
    );
    assert.equal(
      await page
        .locator('[data-combat-role="block"]')
        .getAttribute("data-combat-lane"),
      "1",
    );
    assert.match(
      await page.locator("#combat-detail").textContent(),
      /1 sem bloqueio/,
    );
    await page.locator('[data-combat-role="block"]').focus();
    assert.equal(await page.locator(".combat-pair-focus").count(), 2);
    await page.mouse.move(1, 1);
    await page.screenshot({
      path: path.resolve(
        __dirname,
        `../test-results/combate-${owner === 0 ? "ataque" : "defesa"}-v8.png`,
      ),
    });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 960 });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.ok(await page.locator("#phase-label").isVisible());
      if (width === 390 && owner === 1)
        await page.screenshot({
          path: path.resolve(
            __dirname,
            "../test-results/combate-mobile-v8.png",
          ),
        });
    }
    await page
      .getByRole("button", { name: "Nova partida", exact: true })
      .click();
  }
  const s = fixture(1, "block");
  await page.close();
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await page.goto(url);
  await page.locator("#resume").click();
  await page.locator("#my-board .card").first().click();
  assert.match(
    await page.locator("#instruction").textContent(),
    /selecionado.*atacante/,
  );
  await page.locator("#enemy-board .card").first().click();
  assert.equal(
    await page.locator('#my-board [data-combat-role="block"]').count(),
    1,
  );
  await page.locator("#pass").click();
  await page.waitForFunction(
    () => !busy && (state.priority === 0 || state.winner !== null),
  );
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: ataque/defesa explícitos nos dois lados, par numerado, aviso de Nexus aberto, foco realça par, quatro larguras e bloqueio por clique funcionando.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
