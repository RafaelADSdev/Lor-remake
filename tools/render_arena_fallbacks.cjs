/* Bake the same native geometry/projection into lightweight offline backgrounds. */
const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { selectMatchSetting } = require("../tests/welcome-helpers.cjs");
(async () => {
  const game = path.resolve(__dirname, ".."),
    folder = path.join(game, "assets/arenas/current");
  const sources = JSON.parse(
    fs.readFileSync(path.join(folder, "sources.json"), "utf8"),
  );
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({
      offline: true,
      viewport: { width: 1600, height: 1049 },
    });
    await page.goto(
      "file:///" + path.join(game, "index.html").replaceAll("\\", "/"),
    );
    const manifest = [];
    for (const { key, meshSha256, textureSha256 } of sources) {
      await selectMatchSetting(page, "#arena-choice", key);
      await page.locator("#train").click();
      await page.waitForFunction(() => ArenaScene.ready);
      const png = await page.evaluate(() => {
        ArenaScene.draw();
        const source = document.getElementById("arena-geometry"),
          output = document.createElement("canvas");
        const half = Math.floor(source.height / 2);
        output.width = source.width;
        output.height = half;
        output
          .getContext("2d")
          .drawImage(
            source,
            0,
            source.height - half,
            source.width,
            half,
            0,
            0,
            output.width,
            half,
          );
        return output.toDataURL("image/png").split(",")[1];
      });
      const bytes = Buffer.from(png, "base64"),
        file = "fallback-" + key + ".png";
      fs.writeFileSync(path.join(folder, file), bytes);
      manifest.push({
        key,
        file,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
        meshSha256,
        textureSha256,
        projectionSha256: crypto
          .createHash("sha256")
          .update(fs.readFileSync(path.join(game, "arena-scene.js")))
          .digest("hex"),
      });
      await page.locator("#menu").click();
    }
    fs.writeFileSync(
      path.join(folder, "fallback-sources.json"),
      JSON.stringify(manifest, null, 2) + "\n",
    );
    console.log(
      "Rendered 12 offline backgrounds using the same native UVs and center projection.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
