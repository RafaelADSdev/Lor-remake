const { selectMatchSetting } = require("./welcome-helpers.cjs");
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const folder = path.resolve(__dirname, "../assets/arenas/current");
const manifest = JSON.parse(
  fs.readFileSync(path.join(folder, "sources.json"), "utf8"),
);
const fallbacks = JSON.parse(
  fs.readFileSync(path.join(folder, "fallback-sources.json"), "utf8"),
);
assert.equal(fallbacks.length, manifest.length);
for (const row of fallbacks) {
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(folder, row.file)))
      .digest("hex"),
    row.sha256,
  );
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.resolve(__dirname, "../arena-scene.js")))
      .digest("hex"),
    row.projectionSha256,
    "rebake light backgrounds after changing the projection",
  );
}
for (const row of manifest) {
  assert.equal(
    crypto
      .createHash("sha256")
      .update(fs.readFileSync(path.join(folder, row.file)))
      .digest("hex"),
    row.textureSha256,
  );
  assert.ok(row.parts.length >= 1 && row.triangles > 100);
  for (const part of row.parts) {
    const source = path.resolve(__dirname, "../../", part.source);
    assert.equal(
      crypto.createHash("sha256").update(fs.readFileSync(source)).digest("hex"),
      part.sha256,
    );
  }
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await browser.newContext({
      offline: true,
      viewport: { width: 1440, height: 960 },
    }),
    page = await context.newPage(),
    errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  const url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
  await page.goto(url);
  for (const row of manifest) {
    await selectMatchSetting(page, "#arena-choice", row.key);
    await page.locator("#train").click();
    await page.waitForFunction(() => ArenaScene.ready);
    assert.equal(await page.locator("#arena-geometry").isVisible(), true);
    const difference = await page.evaluate(
      async (src) => {
        const image = new Image();
        image.src = src;
        await image.decode();
        const c = document.querySelector("#arena-geometry"),
          half = Math.floor(c.height / 2);
        const light = document.createElement("canvas");
        light.width = c.width;
        light.height = half;
        const ctx = light.getContext("2d");
        ctx.drawImage(image, 0, 0, light.width, light.height);
        const pixels = new Uint8Array(c.width * c.height * 4),
          staticPixels = ctx.getImageData(0, 0, light.width, light.height).data;
        ArenaScene.draw();
        const gl = c.getContext("webgl");
        gl.readPixels(
          0,
          0,
          c.width,
          c.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        let difference = 0,
          count = 0;
        for (const x of [0.35, 0.5, 0.65])
          for (const y of [0.15, 0.4, 0.65]) {
            const ix = Math.floor(x * c.width),
              iy = Math.floor(y * half);
            for (let k = 0; k < 3; k++) {
              difference += Math.abs(
                pixels[((half - iy - 1) * c.width + ix) * 4 + k] -
                  staticPixels[(iy * c.width + ix) * 4 + k],
              );
              count++;
            }
          }
        return difference / count;
      },
      "data:image/png;base64," +
        fs
          .readFileSync(path.join(folder, "fallback-" + row.key + ".png"))
          .toString("base64"),
    );
    assert.ok(
      difference < 18,
      row.key + " light background matches native central floor: " + difference,
    );
    assert.ok(
      await page.evaluate(() => {
        ArenaScene.draw();
        const c = document.querySelector("#arena-geometry"),
          gl = c.getContext("webgl"),
          pixels = new Uint8Array(c.width * c.height * 4);
        gl.readPixels(
          0,
          0,
          c.width,
          c.height,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          pixels,
        );
        let painted = 0;
        for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 0) painted++;
        return painted > c.width * c.height * 0.5;
      }),
      row.key + " paints native geometry over more than half the field",
    );
    await page.locator("#menu").click();
  }
  // Reload the first model after cache eviction; both halves remain independent.
  await selectMatchSetting(page, "#arena-choice", "auto");
  await page.locator("#opponent").selectOption("noxus");
  await page.locator("#start").click();
  await page.waitForFunction(() => ArenaScene.ready);
  assert.deepEqual(await page.evaluate(() => state.arenaThemes), [
    "demacia",
    "noxus",
  ]);
  await page.locator("#menu").click();
  await selectMatchSetting(page, "#arena-renderer", "light");
  await page.locator("#train").click();
  assert.equal(
    await page.locator(".arena").getAttribute("data-geometry"),
    "fallback",
  );
  assert.equal(await page.locator("#arena-geometry").isVisible(), false);
  await page.locator("#menu").click();
  await page.reload();
  assert.equal(await page.locator("#arena-renderer").inputValue(), "light");
  await context.close();
  const fallback = await browser.newContext({ offline: true });
  const p = await fallback.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return /^webgl/.test(kind) ? null : get.call(this, kind, ...args);
    };
  });
  await p.goto(url);
  await selectMatchSetting(p, "#arena-choice", "shurima");
  await p.locator("#train").click();
  assert.equal(
    await p.locator(".arena").getAttribute("data-geometry"),
    "fallback",
  );
  assert.ok(await p.locator("#pass").isVisible());
  await fallback.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: 12 arenas com malhas/texturas verificadas, desenho real WebGL, cache/reentrada, duas regiões independentes, modo leve persistido e fallback sem WebGL; offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
