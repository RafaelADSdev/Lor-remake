const { chromium } = require("playwright"),
  assert = require("node:assert/strict");
const path = require("node:path"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const context = await browser.newContext({
    offline: true,
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage(),
    errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  await page.goto(
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"),
  );
  await page.locator("#build-deck").click();
  await page.locator('#catalog-source').selectOption('playable');
  assert.equal(
    await page.locator(".collection-row").count(),
    await page.evaluate(
      () => Object.values(CARD_DATA.cards).filter((c) => c.collectible).length,
    ),
  );
  assert.equal(await page.locator("#deck-list .deck-card-row").count(), 14);
  assert.equal(await page.locator("#mana-curve > div").count(), 8);
  await page.locator("#card-search").fill("legiao");
  await page.locator("#card-cost").selectOption("1");
  assert.equal(await page.locator(".collection-row").count(), 2);
  await page.locator("#card-search").fill("inexistente");
  assert.match(
    await page.locator("#collection-list").textContent(),
    /Nenhuma carta/,
  );
  await page.locator("#card-search").fill("");
  await page.locator("#card-cost").selectOption("");
  await page.locator("#card-type").selectOption("champion");
  assert.equal(await page.locator(".collection-row").count(), 5);
  await page
    .getByRole("button", { name: "Ver detalhes de Garen", exact: true })
    .click();
  assert.match(
    await page.locator("#builder-preview").textContent(),
    /Evolução/,
  );
  await page
    .getByRole("button", { name: "Remover Garen", exact: true })
    .click();
  assert.ok(await page.locator("#save-deck").isDisabled());
  await page
    .getByRole("button", { name: "Adicionar Darius", exact: true })
    .click();
  assert.ok(await page.locator("#save-deck").isEnabled());
  await page.locator("#deck-name").fill("Garen e Darius");
  await page.locator("#close-collection").click();
  await page.reload();
  await page.locator("#build-deck").click();
  assert.equal(await page.locator("#deck-name").inputValue(), "Garen e Darius");
  assert.match(await page.locator("#deck-counter").textContent(), /40\/40/);
  await page.locator("#save-deck").click();
  assert.match(await page.locator("#deck-summary").textContent(), /Darius ×1/);
  await page.locator("#deck").selectOption("noxus");
  await page.locator("#build-deck").click();
  await page.locator("#deck-name").fill("Força de Noxus");
  await page.locator("#save-deck").click();
  await page.reload();
  await page.locator("#build-deck").click();
  assert.equal(await page.locator("#saved-decks option").count(), 3);
  const first = await page
    .locator("#saved-decks option")
    .filter({ hasText: "Garen e Darius" })
    .getAttribute("value");
  await page.locator("#saved-decks").selectOption(first);
  assert.equal(await page.locator("#deck-name").inputValue(), "Garen e Darius");
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#export-deck").click();
  const download = await downloadEvent,
    file = path.resolve(__dirname, "../test-results/deck-exportado.json");
  await download.saveAs(file);
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  assert.equal(exported.cards.length, 40);
  assert.equal(exported.name, "Garen e Darius");
  await page.locator("#new-deck").click();
  assert.match(await page.locator("#deck-counter").textContent(), /0\/40/);
  await page.locator("#deck-file").setInputFiles(file);
  await page.waitForFunction(
    () => document.querySelector("#deck-name").value === "Garen e Darius",
  );
  assert.ok(await page.locator("#save-deck").isEnabled());
  await page.locator("#deck-file").setInputFiles({
    name: "invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"cards":["bad"]}'),
  });
  await page.waitForFunction(() =>
    document
      .querySelector("#deck-error")
      .textContent.includes("Não foi possível importar"),
  );
  assert.match(await page.locator("#deck-counter").textContent(), /40\/40/);
  await page.locator("#card-region").selectOption("Demacia");
  await page.waitForFunction(() =>
    [...document.images].every(
      (i) => !i.hasAttribute("src") || (i.complete && i.naturalWidth),
    ),
  );
  await page.screenshot({
    path: path.resolve(
      __dirname,
      "../test-results/composicao-deck-desktop.png",
    ),
  });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve)),
        ),
    );
    await page.waitForFunction(() => document.querySelector("#collection-dialog").getBoundingClientRect().width <= innerWidth);
    assert.equal(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth > innerWidth ||
          document.querySelector("#collection-dialog").scrollWidth >
            document.querySelector("#collection-dialog").clientWidth + 1,
      ),
      false,
    );
    await page.locator("#save-deck").scrollIntoViewIfNeeded();
    assert.ok(await page.locator("#save-deck").isVisible());
    if (width === 390)
      await page.screenshot({
        path: path.resolve(
          __dirname,
          "../test-results/composicao-deck-mobile.png",
        ),
      });
  }
  await page.locator("#save-deck").click();
  await page.locator("#start").click();
  assert.equal(
    await page.evaluate(() => state.players[0].deckName),
    "Garen e Darius",
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: busca/filtros, curva, inspeção, validade 39/40, troca de campeão, rascunho após reload, dois decks com nome, exportação/importação segura, quatro larguras e início do duelo com o deck escolhido; zero erros/rede.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
