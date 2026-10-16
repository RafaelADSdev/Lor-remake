const { selectMatchSetting } = require("./welcome-helpers.cjs");
/* Regression: inspect the presented arena after idle, without forcing a redraw. */
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const game = path.resolve(__dirname, ".."),
  url = "file:///" + path.join(game, "index.html").replaceAll("\\", "/");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [];
  const context = await browser.newContext({
      offline: true,
      viewport: { width: 1600, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url);
  await selectMatchSetting(page, "#arena-choice", "rift");
  await page.locator("#train").click();
  await page.waitForFunction(() => ArenaScene.ready && ArenaAmbient.running);
  await page.waitForTimeout(1200);
  const retained = await page.evaluate(() => {
    const c = document.getElementById("arena-geometry"),
      gl = c.getContext("webgl"),
      p = new Uint8Array(c.width * c.height * 4);
    gl.readPixels(0, 0, c.width, c.height, gl.RGBA, gl.UNSIGNED_BYTE, p);
    let painted = 0;
    for (let i = 3; i < p.length; i += 4) if (p[i]) painted++;
    return { painted, total: c.width * c.height };
  });
  assert.ok(
    retained.painted > retained.total * 0.5,
    "the static WebGL map survives presentation while ambient animations run",
  );
  async function visibleBackground(name) {
    const screenshot = await page.screenshot({
      path: path.join(game, "test-results/" + name + ".png"),
    });
    const visible = await page.evaluate(
      async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const c = document.createElement("canvas");
        c.width = image.width;
        c.height = image.height;
        const ctx = c.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const rect = document.querySelector(".arena").getBoundingClientRect();
        let colored = 0;
        for (const x of [0.35, 0.5, 0.65])
          for (const y of [0.37, 0.63]) {
            const p = ctx.getImageData(
              Math.round(rect.x + x * rect.width),
              Math.round(rect.y + y * rect.height),
              1,
              1,
            ).data;
            if (p[0] + p[1] + p[2] > 70) colored++;
          }
        return colored;
      },
      "data:image/png;base64," + screenshot.toString("base64"),
    );
    assert.equal(
      visible,
      6,
      "the composed screenshot contains the board in both halves: " + name,
    );
    assert.deepEqual(
      await page
        .locator(".arena-surface")
        .evaluateAll((es) => es.map((e) => getComputedStyle(e).opacity)),
      ["1", "1"],
      "the static safety backgrounds stay available",
    );
  }
  await visibleBackground("fundo-persistente-v18");
  const keys = await page
    .locator("#arena-choice option")
    .evaluateAll((es) => es.map((e) => e.value).filter((k) => k !== "auto"));
  for (const key of keys) {
    await page.locator("#menu").click();
    await selectMatchSetting(page, "#arena-choice", key);
    await page.locator("#train").click();
    await page.waitForFunction(() => ArenaScene.ready);
    await page.waitForTimeout(180);
    assert.ok(
      await page.evaluate(() => {
        const c = document.getElementById("arena-geometry"),
          g = c.getContext("webgl"),
          p = new Uint8Array(c.width * c.height * 4);
        g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, p);
        let n = 0;
        for (let i = 3; i < p.length; i += 4) if (p[i]) n++;
        return ArenaScene.ready && n > c.width * c.height * 0.5;
      }),
      key + " retains its map after presentation, without a forced redraw",
    );
  }
  await page.locator("#menu").click();
  await selectMatchSetting(page, "#arena-choice", "rift");
  await page.locator("#train").click();
  await page.waitForFunction(() => ArenaScene.ready);
  await page.locator("#motion-toggle").click();
  await page.waitForTimeout(300);
  await visibleBackground("fundo-sem-efeitos-v18");
  assert.ok(
    await page.evaluate(() =>
      [...document.querySelectorAll(".nexus-crystal")].every((c) => {
        const g = c.getContext("webgl"),
          p = new Uint8Array(c.width * c.height * 4);
        g.readPixels(0, 0, c.width, c.height, g.RGBA, g.UNSIGNED_BYTE, p);
        let n = 0;
        for (let i = 3; i < p.length; i += 4) if (p[i]) n++;
        return n > 1000;
      }),
    ),
    "the idle Nexus images are retained with effects disabled too",
  );
  await page.locator("#motion-toggle").click();
  await page.evaluate(() =>
    document
      .getElementById("arena-geometry")
      .getContext("webgl")
      .getExtension("WEBGL_lose_context")
      .loseContext(),
  );
  await page.waitForFunction(
    () => document.querySelector(".arena").dataset.geometry === "fallback",
  );
  assert.equal(await page.locator("#arena-geometry").isVisible(), false);
  assert.equal(await page.evaluate(() => ArenaAmbient.running), true);
  await visibleBackground("fundo-contexto-perdido-v18");
  await page.locator("#menu").click();
  await selectMatchSetting(page, "#arena-choice", "piltover");
  await page.locator("#train").click();
  await page.waitForTimeout(300);
  await visibleBackground("fundo-fallback-piltover-v18");
  await context.close();
  const blocked = await browser.newContext({
      offline: true,
      viewport: { width: 1600, height: 1000 },
    }),
    p = await blocked.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.route("**/assets/arenas/current/rift.js", (r) => r.abort());
  await p.goto(url);
  await selectMatchSetting(p, "#arena-choice", "rift");
  await p.locator("#train").click();
  await p.waitForFunction(
    () => document.querySelector(".arena").dataset.geometry === "fallback",
  );
  assert.equal(await p.locator("#arena-geometry").isVisible(), false);
  assert.deepEqual(
    await p
      .locator(".arena-surface")
      .evaluateAll((es) => es.map((e) => getComputedStyle(e).opacity)),
    ["1", "1"],
  );
  await blocked.close();
  const blank = await browser.newContext({
      offline: true,
      viewport: { width: 1600, height: 1000 },
    }),
    bp = await blank.newPage();
  bp.on("pageerror", (e) => errors.push(e.message));
  await bp.addInitScript(() => {
    const draw = WebGLRenderingContext.prototype.drawArrays,
      clear = WebGLRenderingContext.prototype.clearColor;
    WebGLRenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.id !== "arena-geometry") return draw.apply(this, args);
    };
    WebGLRenderingContext.prototype.clearColor = function (r, g, b, a) {
      return clear.call(
        this,
        r,
        g,
        b,
        this.canvas.id === "arena-geometry" ? 1 : a,
      );
    };
  });
  await bp.goto(url);
  await bp.locator("#train").click();
  await bp.waitForFunction(
    () => document.querySelector(".arena").dataset.geometry === "fallback",
  );
  assert.equal(
    await bp.locator("#arena-geometry").isVisible(),
    false,
    "an opaque black GPU frame is rejected",
  );
  assert.equal(await bp.evaluate(() => ArenaAmbient.running), true);
  await bp.screenshot({
    path: path.join(game, "test-results/fundo-frame-preto-rejeitado-v18.png"),
  });
  await blank.close();
  assert.deepEqual(errors, []);
  await browser.close();
  console.log(
    "PASS: mapa retido após apresentação/ociosidade, fundos sempre disponíveis, pixels visíveis nos dois lados, efeitos on/off, perda de contexto, troca de arena e falha ao carregar 3D; offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
