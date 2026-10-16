const { chromium } = require("playwright"), assert = require("node:assert/strict"),
  path = require("node:path"), fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true, reducedMotion: "reduce" });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("file:///"+path.resolve(__dirname, "../index.html").replaceAll("\\", "/"));
    const generated = await page.evaluate(() => CARD_DATA.generatedDecks[0]);
    assert.doesNotMatch(generated.name, /Gerado|auto_/);
    assert.equal(await page.locator(`#deck option[value="${generated.id}"]`).textContent(), generated.name);
    assert.equal(await page.locator(`#opponent option[value="${generated.id}"]`).textContent(), generated.name);
    await page.locator("#deck").selectOption(generated.id);
    await page.locator("#opponent").selectOption("noxus");
    await page.locator("#train").click();
    await page.evaluate(() => { clearTimeout(timer); schedule = () => clearTimeout(timer); });
    assert.equal(await page.locator("#my-name").textContent(), generated.name);
    assert.equal(await page.locator("#bot-name").textContent(), "Bot · Legião de Noxus · Darius");
    assert.equal(await page.evaluate(() => state.players[0].deckKey), generated.id);
    // A legacy save has no player key, but still contains the original cards.
    await page.evaluate(() => {
      const legacy = Engine.create(CARD_DATA.cards, CARD_DATA.decks.noxus, CARD_DATA.decks.frost, 7, { faithful: true, skipMulligan: true });
      legacy.players[0].deckName = "Seu deck";
      legacy.players[1].deckName = "Adversário";
      legacy.opponentKey = "frost";
      localStorage.setItem("runeterra-mesa-v1", JSON.stringify(legacy));
      state = null; // Keep the current duel's beforeunload save from replacing this fixture.
    });
    await page.reload();
    await page.locator("#resume").click();
    await page.evaluate(() => { clearTimeout(timer); schedule = () => clearTimeout(timer); });
    assert.equal(await page.locator("#my-name").textContent(), "Legião de Noxus · Darius");
    assert.equal(await page.locator("#bot-name").textContent(), "Bot · Freljord e Ionia · Gelo e Ímpeto");
    await page.evaluate(() => { state.players[0].deckName = "Minha Vanguarda"; render(); });
    assert.equal(await page.locator("#my-name").textContent(), "Minha Vanguarda");
    const out = path.resolve(__dirname, "../test-results"); fs.mkdirSync(out, { recursive: true });
    await page.mouse.move(0, 0);
    await page.screenshot({ path: path.join(out, "nomes-decks-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.mouse.move(0, 0);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await page.locator("#bot-name").getAttribute("title"), "Bot · Freljord e Ionia · Gelo e Ímpeto");
    await page.screenshot({ path: path.join(out, "nomes-decks-mobile.png") });
    assert.deepEqual(errors, []);
    console.log("Deck names: consistent menu, bot and player names; legacy save recovery; custom names preserved; desktop/mobile offline.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
