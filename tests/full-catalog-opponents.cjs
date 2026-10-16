const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const url =
  "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
      offline: true,
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  assert.equal(await page.locator("#opponent").inputValue(), "random");
  const counts = await page.evaluate(() => ({
    opponents: CARD_DATA.opponents.length,
    generated: CARD_DATA.generatedDecks.length,
    playable: Object.values(CARD_DATA.cards).filter((c) => c.collectible)
      .length,
  }));
  assert.ok(counts.opponents >= 300);
  let last;
  for (let i = 0; i < 5; i++) {
    await page.locator("#start").click();
    const chosen = await page.evaluate(() => ({
      id: state.opponentKey,
      mirror:
        ArenaDecks.fingerprint(CARD_DATA.decks[state.opponentKey]) ===
        ArenaDecks.fingerprint(
          CARD_DATA.decks[document.getElementById("deck").value],
        ),
    }));
    assert.notEqual(chosen.id, last);
    assert.equal(chosen.mirror, false);
    last = chosen.id;
    await page.locator("#menu").click();
    await page.locator("#resume").click();
    assert.equal(await page.evaluate(() => state.opponentKey), last);
    await page.locator("#menu").click();
  }
  await page.locator("#build-deck").click();
  assert.equal(await page.locator('#catalog-source').inputValue(), 'official');
  await page.locator("#catalog-source").selectOption("official");
  assert.match(await page.locator("#collection-count").textContent(), /1647/);
  assert.equal(await page.locator(".collection-row").count(), 48);
  const first = await page
    .locator(".collection-row")
    .first()
    .getAttribute("data-code");
  await page.locator("#catalog-next").click();
  assert.notEqual(
    await page.locator(".collection-row").first().getAttribute("data-code"),
    first,
  );
  await page.locator("#card-search").fill("Jinx");
  await page.locator('#new-deck').click();
  assert.ok((await page.locator(".collection-row").count()) > 0);
  const jinx = page.locator(".collection-row").first();
  assert.ok(
    await jinx.locator(".collection-controls button").last().isEnabled(),
  );
  await jinx.locator(".collection-art").click();
  assert.match(
    await page.locator("#builder-preview").textContent(),
    /ainda sem regras de duelo/,
  );
  await page.locator("#card-search").fill("");
  await page.locator("#catalog-source").selectOption("all");
  assert.match(await page.locator("#collection-count").textContent(), /2512/);
  await page.screenshot({
    path: path.resolve(__dirname, "../test-results/catalogo-completo-v10.png"),
  });
  await page.locator("#catalog-source").selectOption("playable");
  await page.locator("#open-deck-code").click();
  await page.locator("#deck-code-examples").selectOption("0");
  assert.match(
    await page.locator("#deck-code-status").textContent(),
    /40 cartas/,
  );
  assert.ok(await page.locator("#use-deck-code").isEnabled());
  await page.locator("#save-deck-reference").click();
  assert.equal(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("lor-deck-references-v1")).length,
    ),
    1,
  );
  await page.locator("#close-deck-code").click();
  await page.locator('#load-preset').click();
  await page.locator("#export-deck-code").click();
  assert.equal(
    await page.evaluate(
      () =>
        RiotDeckCode.decode(document.getElementById("riot-deck-code").value)
          .length,
    ),
    40,
  );
  assert.ok(await page.locator("#use-deck-code").isEnabled());
  await page.locator("#use-deck-code").click();
  await page.locator("#export-deck-code").click();
  await page.locator("#riot-deck-code").fill("INVALIDO");
  await page.locator("#read-deck-code").click();
  assert.match(
    await page.locator("#deck-code-status").textContent(),
    /Não foi possível/,
  );
  assert.ok(await page.locator("#use-deck-code").isDisabled());
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.ok(
      await page
        .locator("#deck-code-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "code overflow " + width,
    );
  }
  await page.locator("#close-deck-code").click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    assert.ok(
      await page
        .locator("#collection-dialog")
        .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
      "collection overflow " + width,
    );
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: " +
      JSON.stringify(counts) +
      "; sorteio, retomada, catálogo, paginação, códigos e responsividade offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
