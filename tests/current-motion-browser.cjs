const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage({ reducedMotion: "reduce" });
    await page.setContent(
      '<main><div id="card" style="width:100px;height:75px;background:#4797b8"></div></main>',
    );
    for (const name of ["current-motion-data.js", "current-motion.js"])
      await page.addScriptTag({
        content: fs.readFileSync(path.join(__dirname, "..", name), "utf8"),
      });
    assert.equal(
      await page.evaluate(() => document.getAnimations().length),
      0,
      "Loading adapters never starts motion, including reduced-motion contexts",
    );
    const results = await page.evaluate(async () => {
      const card = document.querySelector("#card");
      const samples = [];
      for (const frames of [
        CurrentMotion.blockFrames(100),
        CurrentMotion.revealFrames(100, 75),
        CurrentMotion.shardFrames("death", 2, 100, 75),
        CurrentMotion.shardFrames("championDeath", 3, 100, 75),
        CurrentMotion.shardFrames("creation", 1, 100, 75),
      ]) {
        const animation = card.animate(frames, {
          duration: 1000,
          fill: "both",
          easing: "linear",
        });
        animation.pause();
        animation.currentTime = 500;
        samples.push(getComputedStyle(card).transform);
        animation.cancel();
      }
      return { samples, remaining: document.getAnimations().length };
    });
    assert.equal(results.samples.length, 5);
    assert.ok(
      results.samples.every(
        (s) => s.startsWith("matrix") && !/NaN|Infinity/.test(s),
      ),
    );
    assert.equal(results.remaining, 0);
    console.log(
      "Current motion browser: five native-curve adapters accepted by Chrome WAAPI, finite matrices, cancellation clean, no automatic reduced-motion animation.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
