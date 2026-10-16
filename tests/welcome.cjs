const { chromium } = require("playwright");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      offline: true,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [], remote = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) remote.push(request.url());
    });
    await page.goto("file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/"));
    await page.evaluate(() => document.fonts.ready);
    const output = path.resolve(__dirname, "../test-results");
    fs.mkdirSync(output, { recursive: true });
    for (const [deck, name] of [["noxus", "Darius"], ["demacia", "Garen"]]) {
      await page.locator("#deck").selectOption(deck);
      assert.equal(await page.locator("#welcome-champion-name").textContent(), name);
      assert.ok((await page.locator("#deck-summary").textContent()).includes(name));
      await page.waitForFunction(() => {
        const art = document.getElementById("welcome-champion-art");
        return art.complete && art.naturalWidth > 0;
      });
      assert.equal(await page.locator("#welcome-deck-cards img").count(), 3);
    }
    await page.screenshot({ path: path.join(output, "inicio-desktop.png"), fullPage: true });
    await page.locator(".welcome-settings summary").click();
    await page.locator("#arena-choice").selectOption("piltover");
    await page.locator("#arena-renderer").selectOption("light");
    assert.ok((await page.locator("#arena-preview-name").textContent()).includes("Piltover"));
    await page.locator(".welcome-settings summary").click();
    for (const width of [320, 390, 768, 1024, 1440, 1920, 2529]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow at ${width}px`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.screenshot({ path: path.join(output, "inicio-mobile.png"), fullPage: true });
    await page.locator(".welcome-settings summary").click();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "Expanded mobile settings overflow");
    await page.locator(".welcome-settings summary").click();
    await page.locator("#build-deck").click();
    assert.equal(await page.locator("#collection-dialog").isVisible(), true);
    await page.locator("#close-collection").click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("#start").click();
    assert.equal(await page.locator("#welcome").isVisible(), false);
    assert.equal(await page.locator("#opening-cards button").count(), 4);
    await page.locator("#confirm-opening").click();
    await page.locator("#menu").click();
    assert.equal(await page.locator("#welcome").isVisible(), true);
    await page.locator("#resume").click();
    assert.equal(await page.locator("#game").isVisible(), true);
    assert.equal(await page.locator("#welcome").isVisible(), false);
    await page.locator("#menu").click();
    await page.locator("#train").click();
    assert.equal(await page.locator("#game").isVisible(), true);
    assert.equal(await page.locator("#opening-cards").isVisible(), false);
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log("Welcome: champion art, deck preview, settings, collection, start, resume, training, seven widths and offline checks passed.");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
