const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ offline: true, reducedMotion: "no-preference" });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem("lor-champion-cinematic", "rugged");
      window.voices = [];
      const play = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        if (this instanceof HTMLAudioElement) voices.push(this);
        return play.apply(this, args);
      };
    });
    await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
    // A real gesture starts the real player and local media, without autoplay overrides.
    await page.evaluate(() => {
      const button = document.createElement("button");
      button.id = "test-cinematic";
      button.textContent = "Testar evolução";
      button.onclick = () => {
        window.done = false;
        window.result = ChampionCinematic.play({ championKey: "01DE012" }).then(ok => {
          window.done = true;
          return ok;
        });
      };
      document.body.append(button);
      if (!ArenaMotion.soundEnabled) ArenaMotion.toggleSound();
    });
    const clip = () => page.locator(".champion-cinematic video");
    const audioState = () => page.evaluate(() => {
      const voice = voices.findLast(v => v.src.endsWith("sfx-garen-rugged-level-up.ogg"));
      return voice && { time: voice.currentTime, paused: voice.paused, error: voice.error?.code };
    });
    await page.click("#test-cinematic");
    await page.waitForFunction(() => document.querySelector(".champion-cinematic video")?.currentTime > .3);
    assert.ok(await audioState(), "the original Rugged sound must be started alongside the video");
    await page.waitForFunction(() => voices.some(v => v.src.endsWith("sfx-garen-rugged-level-up.ogg") && v.currentTime > .1));
    assert.equal((await audioState()).paused, false);
    await clip().evaluate(v => {
      window.mediaEnd = null;
      v.addEventListener("ended", () => { window.mediaEnd = { time: v.currentTime, duration: v.duration }; });
      v.playbackRate = .4; // Reproduce slow playback exceeding the old nine-second wall timer.
    });
    await page.waitForFunction(() => done, null, { timeout: 18000 });
    const end = await page.evaluate(() => mediaEnd);
    assert.ok(end, "a playing video must reach ended, even when playback takes over nine seconds");
    assert.equal(end.duration, 5);
    assert.ok(end.time >= 4.99);
    assert.equal(await page.evaluate(() => result), true);

    await page.click("#test-cinematic");
    await page.waitForFunction(() => document.querySelector(".champion-cinematic video")?.currentTime > .3);
    await page.waitForFunction(() => done);
    assert.ok((await audioState()).time >= 4.8);
    assert.equal((await audioState()).paused, false, "the original sound tail must survive the video ending");
    await page.evaluate(() => ChampionCinematic.cancel());
    assert.equal((await audioState())?.paused ?? true, true);
    assert.equal(await page.evaluate(() => RegionalAudio.activeSounds), 0);

    await page.click("#test-cinematic");
    await page.waitForFunction(() => document.querySelector(".champion-cinematic video")?.currentTime > .2);
    await page.keyboard.press("Escape");
    assert.equal(await page.evaluate(() => result), true);
    assert.equal(await page.locator(".champion-cinematic").count(), 0);
    assert.equal(await page.evaluate(() => RegionalAudio.activeSounds), 0);

    await page.evaluate(() => { ArenaMotion.toggleSound(); voices.length = 0; });
    await page.click("#test-cinematic");
    await page.waitForFunction(() => document.querySelector(".champion-cinematic video")?.currentTime > .3);
    assert.equal(await audioState(), undefined, "effects mute must suppress cinematic audio");
    await page.locator(".champion-cinematic button").click();
    assert.equal(await page.evaluate(() => result), true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.evaluate(() => ChampionCinematic.play({ championKey: "01DE012" })), false);
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.resolve(__dirname, "../test-results/champion-cinematic.json"),
      JSON.stringify({ ended: end, audio: "original Wwise event, real offline playback", errors, passed: true }, null, 2));
    console.log("PASS: Rugged original audio, full playback beyond nine seconds, audio tail, cancel, Escape, skip, mute and reduced motion.");
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
