/* Keep the complete hand inside the viewport, including a full ten-card hand. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: "reduce" });
    const page = await context.newPage();
    const errors = [], remote = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
    const url = "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(url);
    if (await page.locator(".welcome-settings summary").count())
      await page.locator(".welcome-settings summary").click();
    await page.locator("#arena-choice").selectOption("piltover");
    await page.locator("#train").click();
    const five = await page.evaluate(() => structuredClone(state));
    const ten = structuredClone(five);
    while (ten.players[0].hand.length < 10) {
      const c = structuredClone(ten.players[0].hand[ten.players[0].hand.length % 5]);
      c.id = "c" + ten.nextId++;
      ten.players[0].hand.push(c);
    }
    for (const saved of [five, ten]) {
      await page.evaluate(s => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)), saved);
      await page.reload();
      await page.locator("#resume").click();
      for (const [width, height] of [[2541, 1297], [1440, 900], [1366, 768], [1200, 1000], [1024, 768], [768, 1024], [390, 844], [320, 740]]) {
        await page.setViewportSize({ width, height });
        await page.mouse.move(0, 0);
        await page.waitForTimeout(250);
        const geometry = await page.evaluate(() => {
          const rect = e => e.getBoundingClientRect().toJSON();
          const cards = [...document.querySelectorAll("#my-hand .card")];
          return {
            arena: rect(document.querySelector(".arena")),
            cards: cards.map(rect),
            overflow: document.documentElement.scrollWidth > innerWidth,
            phaseSize: parseFloat(getComputedStyle(document.querySelector("#phase-label")).fontSize),
            instruction: rect(document.querySelector("#instruction")),
          };
        });
        const label = `${saved.players[0].hand.length} cards at ${width}x${height}`;
        assert.equal(geometry.overflow, false, label + ": no horizontal page overflow");
        assert.ok(geometry.arena.bottom <= height + 1, label + ": arena fits viewport");
        if (width > 1100)
          assert.ok(Math.abs(geometry.arena.width / geometry.arena.height - 1.6) < 0.01, label + ": native board proportions preserved");
        assert.ok(geometry.phaseSize >= 14, label + ": readable phase");
        for (const c of geometry.cards) {
          assert.ok(c.left >= -1 && c.right <= width + 1, label + ": card stays inside horizontally");
          assert.ok(c.bottom <= height && c.top >= geometry.arena.top, label + ": complete card visible");
          assert.ok(c.height >= 130, label + ": sufficient card size");
        }
        if (saved === five && [1440, 390].includes(width)) {
          await page.screenshot({ path: path.resolve(__dirname, `../test-results/cartas-legiveis-${width}.png`) });
        }
        if (saved === ten && width === 1440) {
          await page.screenshot({ path: path.resolve(__dirname, "../test-results/cartas-legiveis-mao-cheia.png") });
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const first = page.locator("#my-hand .card").first();
    await first.hover();
    await page.waitForTimeout(250);
    assert.ok(await page.locator("#grimoire").isVisible());
    const preview = await page.locator("#inspection img").evaluate(e => ({
      portrait: e.src === new URL(CARD_DATA.cards[state.players[0].hand[0].code].portrait, location.href).href,
      ratio: getComputedStyle(e).aspectRatio,
      complete: e.complete && e.naturalWidth > 0,
    }));
    assert.ok(preview.complete);
    assert.ok(preview.portrait);
    assert.equal(preview.ratio, "0.66 / 1");
    await page.waitForTimeout(2800);
    assert.ok(await page.locator("body").evaluate(e => e.classList.contains("peek-open")), "inspection stays open while reading");
    await page.screenshot({ path: path.resolve(__dirname, "../test-results/cartas-legiveis-inspecao.png") });
    await page.locator("#inspection img").hover();
    await page.waitForTimeout(350);
    assert.ok(await page.locator("body").evaluate(e => e.classList.contains("peek-open")), "inspection can be reached to scroll");
    await page.mouse.move(1, 1);
    await page.waitForTimeout(350);
    assert.ok(await page.locator("body").evaluate(e => !e.classList.contains("peek-open")), "inspection closes on leaving");
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log("Card legibility: 5/10 cards, eight viewports, native board proportions, portrait inspection, no errors, fully offline.");
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
