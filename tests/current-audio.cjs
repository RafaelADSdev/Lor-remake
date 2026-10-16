/* Verify the source-bound regional OGG set using actual offline Chrome decoding. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
(async () => {
  const root = path.resolve(__dirname, "..");
  const proof = JSON.parse(fs.readFileSync(path.join(root, "assets/audio/current/sources.json"), "utf8"));
  assert.equal(proof.exports.length, 12);
  assert.equal(proof.sounds.length, 12);
  assert.equal(proof.sounds.find(x => x.key === "garen-rugged-level-up").event,
    "Play_CH_RiftQuest_Garen_ChampLvlUp");
  assert.deepEqual(proof.sounds.filter(x => ["hit", "nexus-hit"].includes(x.key)).map(x => x.event),
    ["Play_IMP_damage_unit_hit", "Play_IMP_damage_face_hit"]);
  for (const item of [...proof.exports, ...proof.sounds]) {
    const raw = fs.readFileSync(path.join(root, item.file));
    assert.equal(crypto.createHash("sha256").update(raw).digest("hex"), item.sha256);
    assert.equal(raw.subarray(0, 4).toString(), "OggS");
  }
  const output = path.join(root, "test-results"); fs.mkdirSync(output, { recursive: true });
  const fixture = path.join(output, "current-audio-reference.html");
  fs.writeFileSync(fixture, '<!doctype html><base href="../"><audio id="duel-music" preload="metadata"></audio><button id="play">Ouvir</button><script src="regional-audio-data.js"></script><script src="native-sounds-data.js"></script><script src="regional-audio.js"></script>');
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    const page = await browser.newPage(); const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(pathToFileURL(fixture).href);
    const result = await page.evaluate(async () => {
      const audio = document.getElementById("duel-music"), rows = [];
      for (const theme of RegionalAudio.themes) {
        const ready = new Promise((resolve, reject) => {
          audio.onloadedmetadata = resolve;
          audio.onerror = () => reject(new Error(theme + ": " + audio.error?.message));
          setTimeout(() => reject(new Error(theme + ": metadata timeout")), 15000);
        });
        if (!RegionalAudio.select(theme, audio)) throw new Error("Missing " + theme);
        await ready;
        rows.push({ theme, duration: audio.duration, expected: REGIONAL_AUDIO[theme].seconds, src: audio.currentSrc });
      }
      for (const [key, entry] of Object.entries(NATIVE_SOUNDS)) {
        const voice = new Audio();
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(key + ": metadata timeout")), 5000);
          voice.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
          voice.onerror = () => { clearTimeout(timer); reject(new Error(key + ": decode failed")); };
          voice.src = entry.src;
        });
        rows.push({ sound: key, duration: voice.duration, expected: entry.seconds, src: voice.currentSrc });
      }
      document.getElementById("play").onclick = () => { window.playResult = RegionalAudio.sound("turn"); };
      return rows;
    });
    for (const row of result) assert.ok(Math.abs(row.duration - row.expected) < 0.2, JSON.stringify(row));
    await page.click("#play"); assert.equal(await page.evaluate(() => window.playResult), true);
    assert.equal(await page.evaluate(() => RegionalAudio.activeSounds), 1);
    assert.equal(await page.evaluate(async () => {
      const played = await RegionalAudio.sound("hit");
      RegionalAudio.stop(["hit", "nexus-hit"]);
      return played && RegionalAudio.activeSounds === 1;
    }), true, "selective combat cancellation preserves the interface voice");
    await page.evaluate(() => { RegionalAudio.enabled = false; });
    assert.equal(await page.evaluate(() => RegionalAudio.activeSounds), 0);
    assert.equal(await page.evaluate(() => RegionalAudio.sound("turn")), false);
    assert.equal(await page.evaluate(() => RegionalAudio.select("unavailable")), false);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "current-audio.json"), JSON.stringify({ regions: result, sounds: proof.sounds.map(x => ({ key: x.key, seconds: x.seconds })), errors, passed: true }, null, 2));
    console.log("12 regional OGG arrangements and 12 source-bound effects decode offline and match hashes; user-gesture play and mute cleanup pass.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
