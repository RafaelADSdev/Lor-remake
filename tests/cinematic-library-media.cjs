/* Actual Chrome media decoding, independent of the game UI. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");
const game = path.resolve(__dirname, "..");
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(game, "cinematic-library-data.js"), "utf8"), context);
const sample = process.argv.includes("--sample");
const entries = JSON.parse(JSON.stringify(context.window.CINEMATIC_LIBRARY)).slice(0, sample ? 3 : undefined);

(async () => {
  if (!sample) assert.equal(entries.length, 133, "Run after the complete local import");
  assert.ok(entries.length > 0);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const results = [];
  const remoteRequests = [];
  try {
    const isolated = await browser.newContext({ offline: true });
    const page = await isolated.newPage();
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
    });
    await page.goto(pathToFileURL(path.join(game, "cinematic-library-data.js")).href);
    for (const entry of entries) {
      const result = await page.evaluate(async ({ source, seek }) => {
        const video = document.createElement("video");
        video.muted = true;
        video.playsInline = true;
        document.body.replaceChildren(video);
        const loaded = new Promise((resolve, reject) => {
          video.onloadedmetadata = resolve;
          video.onerror = () => reject(Error(`Media error ${video.error?.code}: ${video.error?.message}`));
        });
        video.src = source;
        const timeout = new Promise((_, reject) => setTimeout(() => reject(Error("Media load/seek timeout")), 10000));
        const decoded = (async () => {
          await loaded;
          video.currentTime = seek;
          await new Promise((resolve) => { video.onseeked = resolve; });
          const frame = new Promise((resolve) => video.requestVideoFrameCallback(resolve));
          await video.play();
          await frame;
          video.pause();
          return { duration: video.duration, width: video.videoWidth, height: video.videoHeight,
            currentTime: video.currentTime, decodedFrames: video.getVideoPlaybackQuality().totalVideoFrames,
            error: video.error?.message || null };
        })();
        return Promise.race([decoded, timeout]);
      }, { source: pathToFileURL(path.join(game, entry.video)).href, seek: entry.duration * 0.45 });
      assert.equal(result.error, null, entry.id);
      assert.ok(result.decodedFrames > 0, entry.id);
      assert.ok(result.width >= 960 && result.height > 0, entry.id);
      assert.ok(Math.abs(result.duration - entry.duration) < 0.08, entry.id);
      results.push({ id: entry.id, ...result });
    }
    assert.deepEqual(remoteRequests, []);
    fs.writeFileSync(path.join(__dirname, sample ? "cinematic-library-media-sample-results.json" : "cinematic-library-media-results.json"), JSON.stringify({
      browser: await browser.version(), checkedVideos: results.length, remoteRequests, results,
    }, null, 2) + "\n");
    console.log(`Chrome decoded, sought and played ${results.length} local WebM clips without media errors or network requests.`);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
