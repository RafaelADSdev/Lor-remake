const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const game = path.resolve(__dirname, "..");
const manifest = JSON.parse(fs.readFileSync(path.join(game, "research/cinematic-library-manifest.json"), "utf8"));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(game, "cinematic-library-data.js"), "utf8"), context);
const library = JSON.parse(JSON.stringify(context.window.CINEMATIC_LIBRARY));

test("all preserved Bink2 videos have independently decoded browser assets", () => {
  assert.equal(manifest.summary.sourceVideos, 133);
  assert.equal(manifest.summary.validatedVideos, 133);
  assert.deepEqual(manifest.errors, {});
  assert.equal(manifest.videos.length, 133);
  assert.equal(library.length, 133);
  assert.deepEqual(library.map((entry) => entry.id), manifest.videos.map((entry) => entry.id));
  assert.equal(new Set(library.map((entry) => entry.id)).size, 133);
  for (const entry of manifest.videos) {
    assert.equal(entry.fullDecodePassed, true, entry.id);
    assert.equal(entry.decodedFrames, entry.sourceFrames, entry.id);
    assert.ok(Math.abs(entry.decodedDuration - entry.duration) < 0.08, entry.id);
    const video = fs.readFileSync(path.join(game, entry.video));
    assert.equal(video.length, entry.outputBytes, entry.id);
    assert.equal(crypto.createHash("sha256").update(video).digest("hex"), entry.outputSha256, entry.id);
    assert.equal(video.subarray(0, 4).toString("hex"), "1a45dfa3", entry.id);
    assert.ok(entry.poster, entry.id);
    const poster = fs.readFileSync(path.join(game, entry.poster));
    assert.equal(poster.subarray(0, 2).toString("hex"), "ffd8", entry.id);
    assert.equal(poster.subarray(-2).toString("hex"), "ffd9", entry.id);
  }
});

test("skins, generic videos and third-stage evolutions cannot become champion defaults", () => {
  for (const entry of library) {
    if (entry.skin || entry.kind !== "champion-cinematic" || entry.level !== 2) {
      assert.equal(entry.defaultChampionCinematic, false, entry.id);
    }
  }
  const defaults = library.filter((entry) => entry.defaultChampionCinematic);
  const codes = defaults.flatMap((entry) => entry.championCodes);
  assert.equal(new Set(codes).size, codes.length, "Each champion has one explicit default");
  const rugged = library.find((entry) => entry.video === "assets/video/garen-rugged-level-up.webm");
  assert.equal(rugged.skin, "Rugged");
  assert.equal(rugged.audio, "garen-rugged-level-up");
  const originalGaren = JSON.parse(fs.readFileSync(path.join(game, "research/current-video-manifest.json"), "utf8"));
  const preservedVideo = fs.readFileSync(path.join(game, rugged.video));
  assert.equal(crypto.createHash("sha256").update(preservedVideo).digest("hex"), originalGaren.outputSha256);
  assert.equal(library.filter((entry) => entry.audio).length, 1);
});
