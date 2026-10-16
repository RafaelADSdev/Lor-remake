/* Native scenery supports the HUD without covering cards or duplicating on entry. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { selectMatchSetting } = require("./welcome-helpers.cjs");
const game = path.resolve(__dirname, ".."), folder = path.join(game, "assets/arenas/hud");
const sources = JSON.parse(fs.readFileSync(path.join(folder, "sources.json"), "utf8"));
const baked = JSON.parse(fs.readFileSync(path.join(folder, "sprites.json"), "utf8"));
const sha = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert.equal(sha(path.join(folder, "neutral-ui.png")), sources.textureSha256);
assert.equal(sha(path.join(folder, "ui-tray.json")), baked.modelSha256);
assert.equal(sha(path.join(folder, "spell-mana-tray.json")), baked.manaModelSha256);
assert.equal(sha(path.join(game, "tools/render_map_hud.cjs")), baked.rendererSha256);
for (const r of baked.records) assert.equal(sha(path.join(folder, r.name + ".png")), r.sha256);
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1600, height: 1000 }, reducedMotion: "no-preference" });
    const page = await context.newPage(), errors = [], remote = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
    await page.goto("file:///" + path.join(game, "index.html").replaceAll("\\", "/"));
    for (const key of ["piltover", "ionia", "demacia"]) {
      await selectMatchSetting(page, "#arena-choice", key);
      await page.locator("#train").click();
      await page.waitForFunction(() => [...document.querySelectorAll(".arena-frame")].every(i => i.complete && i.naturalWidth));
      await page.mouse.move(1, 1); await page.waitForTimeout(350);
      assert.equal(await page.locator(".arena-frame").count(), 2);
      assert.equal(await page.locator("#native-action-housing").count(), 1);
      assert.equal(await page.locator(".nexus-native-dock").count(), 2);
      assert.equal(await page.locator("#my-hand .card").count(), 5);
      for (const frame of await page.locator(".arena-frame").all()) {
        assert.equal(await frame.getAttribute("data-theme"), key);
        assert.match(await frame.getAttribute("src"), new RegExp(`fallback-${key}\\.png$`));
      }
      for (const width of [1600, 390]) {
        await page.setViewportSize({ width, height: width === 1600 ? 1000 : 844 });
        await page.waitForTimeout(150);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
        const target = await page.locator("#pass").evaluate(el => {
          const r = el.getBoundingClientRect();
          return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === el;
        });
        assert.ok(target, "native scenery never intercepts the action");
        await page.screenshot({ path: path.join(game, `test-results/map-integrated-${key}-${width}.png`) });
      }
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.locator("#menu").click();
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log("PASS: native meshes/texture hashes, three themed maps, desktop/mobile, reusable frames, visible cards, action hit testing and offline.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
