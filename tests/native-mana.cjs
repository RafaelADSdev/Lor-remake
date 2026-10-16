/* Regression: original mana segments stay in the native arc as mana is spent. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { selectMatchSetting } = require("./welcome-helpers.cjs");
const game = path.resolve(__dirname, ".."), folder = path.join(game, "assets/arenas/hud");
const source = JSON.parse(fs.readFileSync(path.join(folder, "mana-pips-sources.json"), "utf8"));
const sha = p => crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
assert.equal(sha(path.join(folder, "mana-pip.obj")), source.meshSha256);
for (const t of source.textures) assert.equal(sha(path.join(folder, t.file)), t.sha256);
assert.deepEqual(source.placements.map(s => s.length), [10, 10]);
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ offline: true, reducedMotion: "reduce", viewport: { width: 1600, height: 1000 } });
    const page = await context.newPage(), errors = [], remote = [];
    page.on("pageerror", e => errors.push(e.message));
    page.on("request", r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
    await page.goto("file:///" + path.join(game, "index.html").replaceAll("\\", "/"));
    await selectMatchSetting(page, "#arena-choice", "piltover");
    await page.locator("#train").click();
    await page.mouse.move(1, 1); await page.waitForTimeout(350);
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.locator(".hud-native-mana-pip").count(), 20);
    assert.equal(await page.locator("#native-mana-quad polygon").count(), 1);
    for (const [round, yours, enemy] of [[1, 1, 1], [5, 0, 3], [10, 5, 8], [10, 10, 10]]) {
      await page.evaluate(({ round, yours, enemy }) => ArenaHUD.render({ round, players: [
        { mana: yours, spellMana: 2 }, { mana: enemy, spellMana: 3 },
      ] }), { round, yours, enemy });
      for (const [side, mana] of [[0, yours], [1, enemy]]) {
        assert.equal(await page.locator(`#mana-wheel g[data-side="${side}"] path[data-filled="true"]`).count(), mana);
        assert.equal(await page.locator(`#mana-wheel g[data-side="${side}"] image[data-filled="true"]`).count(), mana);
        assert.equal(await page.locator(`#mana-wheel g[data-side="${side}"] text`).textContent(), `${mana} / ${round}`);
      }
      assert.match(await page.locator("#mana-wheel").getAttribute("aria-label"), new RegExp(`você ${yours}/${round}.*bot ${enemy}/${round}`));
      if (round === 10 && yours === 5) {
        for (const [width, height] of [[1600, 1000], [1366, 768], [768, 1024], [390, 844]]) {
          await page.setViewportSize({ width, height });
          await page.waitForTimeout(150);
          const geometry = await page.evaluate(() => {
            const frame = document.getElementById("native-action-housing").getBoundingClientRect();
            const inside = [...document.querySelectorAll(".hud-mana-tick")].every(p => {
              const r = p.getBoundingClientRect();
              return r.left >= frame.left && r.right <= frame.right && r.top >= frame.top && r.bottom <= frame.bottom;
            });
            const b = document.getElementById("pass"), r = b.getBoundingClientRect();
            return { inside, button: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) === b,
              overflow: document.documentElement.scrollWidth > innerWidth, frame: frame.toJSON() };
          });
          assert.ok(geometry.inside, "all 20 mana segments sit within the native housing");
          assert.ok(geometry.button, "mana never intercepts the action");
          assert.equal(geometry.overflow, false, `page overflow at ${width}x${height}`);
          if ([1600, 390].includes(width)) {
            await page.screenshot({ path: path.join(game, `test-results/mana-native-${width}.png`) });
            if (width === 1600) {
              const f = geometry.frame, x = Math.max(0, f.x - 30), y = Math.max(0, f.y - 45);
              await page.screenshot({ path: path.join(game, "test-results/mana-native-detail.png"),
                clip: { x, y, width: Math.min(width-x, f.width+60), height: Math.min(height-y, f.height+90) } });
            }
          }
        }
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log("PASS: native mana textures/UVs, 20 aligned segments, 1/5/10 mana, spent/full states, independent sides, four viewports and offline.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
