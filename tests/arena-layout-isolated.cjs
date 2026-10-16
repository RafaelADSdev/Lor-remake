/* Synthetic layout fixture only: no game page, user tab, assets, or saves. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const game = path.resolve(__dirname, "..");
const styles = [
  "style.css",
  "arena.css",
  "arena-themes.css",
  "duel-polish.css",
  "arena-scene.css",
];

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    const css = styles
      .map((f) => fs.readFileSync(path.join(game, f), "utf8"))
      .join("\n");
    const html = fs.readFileSync(path.join(game, "index.html"), "utf8");
    assert.ok(
      html.indexOf('href="arena-scene.css') >
        html.indexOf('href="duel-polish.css'),
    );
    await page.setContent(`<style>${css}</style><body class="in-duel">
      <header style="height:49px"></header><main><section id="game">
      <div class="game-grid"><div class="arena"><span style="position:absolute;top:50%">Campo</span>
      </div></div></section></main></body>`);
    for (const [width, height] of [
      [1280, 720],
      [1920, 1080],
      [2529, 1284],
      [3440, 1440],
      [3840, 2160],
      [1200, 1800],
    ]) {
      await page.setViewportSize({ width, height });
      for (const header of [49, 90]) {
        await page.locator("header").evaluate((el, h) => {
          el.style.height = h + "px";
        }, header);
        const rect = await page.locator(".arena").boundingBox();
        assert.ok(
          rect && rect.width > 600 && rect.height > 300,
          JSON.stringify(rect),
        );
        assert.ok(
          Math.abs(rect.width / rect.height - 1.6) < 0.002,
          JSON.stringify(rect),
        );
        assert.ok(
          rect.y >= header - 1 && rect.y + rect.height <= height + 1,
          JSON.stringify(rect),
        );
        assert.ok(
          rect.x >= -1 && rect.x + rect.width <= width + 1,
          JSON.stringify(rect),
        );
        assert.ok(Math.abs(rect.x - (width - rect.width) / 2) < 1);
        console.log(
          `${width}×${height}, cabeçalho ${header}px: campo ${rect.width.toFixed(1)}×${rect.height.toFixed(1)}`,
        );
      }
    }
    await page.locator("#game").evaluate((el) => {
      el.hidden = true;
    });
    assert.equal(await page.locator(".arena").boundingBox(), null);
    await page.locator("#game").evaluate((el) => {
      el.hidden = false;
    });
    assert.ok((await page.locator(".arena").boundingBox()).height > 300);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
