const { selectMatchSetting } = require("./welcome-helpers.cjs");
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const game = path.resolve(__dirname, ".."),
  folder = path.join(game, "assets/arenas/ambient"),
  source = JSON.parse(
    fs.readFileSync(path.join(folder, "sources.json"), "utf8"),
  );
const sha = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
assert.equal(sha(path.resolve(game, "..", source.mesh)), source.meshSha256);
assert.equal(
  sha(path.join(game, "assets/arenas/current/piltover.png")),
  source.textureSha256,
);
assert.equal(sha(path.join(folder, "piltover-gear.png")), source.spriteSha256);
assert.ok(source.triangles > 100);
const url = "file:///" + path.join(game, "index.html").replaceAll("\\", "/");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [],
    remote = [];
  async function open(options = {}) {
    const context = await browser.newContext({
        offline: true,
        viewport: { width: 1600, height: 1000 },
        ...options,
      }),
      page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) remote.push(r.url());
    });
    return { context, page };
  }
  const { context, page } = await open();
  await page.goto(url);
  const sample = () =>
    page.evaluate(() => {
      const c = document.getElementById("arena-ambient"),
        p = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let painted = 0,
        hash = 0,
        protectedPixels = 0,
        seamPixels = 0;
      const examples = [];
      for (let i = 0; i < p.length; i += 4)
        if (p[i + 3]) {
          painted++;
          hash =
            (Math.imul(hash, 31) +
              i +
              p[i] +
              p[i + 1] +
              p[i + 2] +
              p[i + 3]) >>>
            0;
          const x = ((i / 4) % c.width) / c.width,
            y = Math.floor(i / 4 / c.width) / c.height;
          const inset = innerWidth <= 700 ? 0.11 : 0.2;
          if (y > 0.497 && y < 0.503) seamPixels++;
          if (x > inset && x < 1 - inset && y > 0.1 && y < 0.9) {
            protectedPixels++;
            if (examples.length < 8) examples.push([x, y, p[i + 3]]);
          }
        }
      return {
        painted,
        hash,
        protectedPixels,
        seamPixels,
        examples,
        viewport: innerWidth,
        canvasWidth: c.width,
        arenaWidth: document.querySelector(".arena").clientWidth,
        frames: Number(c.dataset.frames || 0),
      };
    });
  const keys = [
    "rift",
    "demacia",
    "noxus",
    "ionia",
    "freljord",
    "piltover",
    "bilgewater",
    "shadowisles",
    "shurima",
    "targon",
    "bandlecity",
    "zaun",
  ];
  for (const key of keys) {
    await selectMatchSetting(page, "#arena-choice", key);
    await page.locator("#train").click();
    await page.waitForFunction(() => ArenaAmbient.running);
    await page.waitForTimeout(180);
    const a = await sample();
    await page.waitForTimeout(180);
    const b = await sample();
    assert.ok(
      a.painted > 30 && b.painted > 30,
      key + " has visible scenery effects",
    );
    assert.notEqual(a.hash, b.hash, key + " pixels actually move");
    assert.equal(
      b.protectedPixels,
      0,
      key + " leaves the card lanes entirely clear",
    );
    assert.ok(
      b.frames > a.frames && b.frames - a.frames < 14,
      "single throttled frame loop",
    );
    assert.equal(
      await page.locator("#arena-ambient").getAttribute("data-local-theme"),
      key,
    );
    await page.locator("#menu").click();
    assert.equal(await page.evaluate(() => ArenaAmbient.running), false);
  }
  await selectMatchSetting(page, "#arena-choice", "piltover");
  await page.locator("#train").click();
  await page.waitForFunction(() => ArenaAmbient.running);
  const same = await page.evaluate(() => {
    const c = document.getElementById("arena-ambient");
    for (let i = 0; i < 25; i++) render();
    return c === document.getElementById("arena-ambient");
  });
  assert.equal(same, true);
  assert.equal(await page.locator("#arena-ambient").count(), 1);
  await page.locator("#motion-toggle").click();
  assert.equal(await page.evaluate(() => ArenaAmbient.running), false);
  const stopped = await sample();
  await page.waitForTimeout(180);
  assert.equal((await sample()).frames, stopped.frames);
  assert.equal(stopped.painted, 0);
  await page.locator("#motion-toggle").click();
  await page.waitForFunction(() => ArenaAmbient.running);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  assert.equal(await page.evaluate(() => ArenaAmbient.running), false);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForFunction(() => ArenaAmbient.running);
  for (const width of [320, 390, 768, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.waitForTimeout(100);
    const resized = await sample();
    assert.equal(resized.protectedPixels, 0, JSON.stringify(resized));
    assert.equal(
      (await sample()).seamPixels,
      0,
      "the center rule stays clear on small screens too",
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  await page.mouse.move(1590, 10);
  await page.screenshot({
    path: path.join(game, "test-results/mapa-piltover-v17.png"),
  });
  await page.locator("#menu").click();
  await selectMatchSetting(page, "#arena-renderer", "light");
  await page.locator("#resume").click();
  await page.waitForFunction(() => ArenaAmbient.running);
  assert.equal(
    await page.locator(".arena").getAttribute("data-geometry"),
    "fallback",
  );
  assert.ok((await sample()).painted > 30);
  await page.locator("#menu").click();
  await selectMatchSetting(page, "#arena-choice", "auto");
  await page.locator("#opponent").selectOption("noxus");
  await page.locator("#start").click();
  assert.equal(
    await page.locator("#arena-ambient").getAttribute("data-local-theme"),
    "demacia",
  );
  assert.equal(
    await page.locator("#arena-ambient").getAttribute("data-enemy-theme"),
    "noxus",
  );
  await context.close();
  const reduced = await open({ reducedMotion: "reduce" });
  await reduced.page.goto(url);
  await reduced.page.locator("#train").click();
  assert.equal(await reduced.page.evaluate(() => ArenaAmbient.running), false);
  assert.equal(await reduced.page.locator("#arena-ambient").isVisible(), false);
  await reduced.context.close();
  const fallback = await open();
  await fallback.page.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /^webgl/.test(kind) ? null : get.call(this, kind, ...args);
    };
  });
  await fallback.page.goto(url);
  await selectMatchSetting(fallback.page, "#arena-choice", "piltover");
  await fallback.page.locator("#train").click();
  await fallback.page.waitForFunction(() => ArenaAmbient.running);
  assert.equal(
    await fallback.page.locator(".arena").getAttribute("data-geometry"),
    "fallback",
  );
  await fallback.context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: 12 ambientações realmente animadas, engrenagem nativa verificada, campo central limpo, lados independentes, canvas único, pausa/retomada/menu, ocultação simulada, 4 larguras, modo leve, sem WebGL e movimento reduzido; offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
