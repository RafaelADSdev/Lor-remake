const { selectMatchSetting } = require("./welcome-helpers.cjs");
const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  path = require("node:path"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  E = require("../engine.js");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
(async () => {
  const b = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await b.newContext({
      offline: true,
      reducedMotion: "no-preference",
      viewport: { width: 1440, height: 960 },
    }),
    page = await context.newPage(),
    errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  await page.addInitScript(() => {
    localStorage.setItem("lor-sound-enabled", "false");
    window.playedSounds = [];
    window.nativeClips = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      if (this instanceof HTMLAudioElement) playedSounds.push(this.src);
      return play.apply(this, args);
    };
    addEventListener("DOMContentLoaded", () => {
      new MutationObserver((records) => {
        for (const r of records)
          for (const n of r.addedNodes) {
            if (n.nodeType === 1 && n.dataset.nativeClip)
              nativeClips.push(n.dataset.nativeClip);
          }
      }).observe(document.querySelector("#effects-layer"), { childList: true });
    });
  });
  const url =
    "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
  await page.goto(url);
  await selectMatchSetting(page, "#arena-choice", "targon");
  await page.locator("#train").click();
  await page.waitForFunction(
    () =>
      !document.querySelector("#duel-music").paused &&
      document.querySelector("#duel-music").currentTime > 0.1,
  );
  assert.equal(
    await page.locator("#duel-music").getAttribute("data-regional-theme"),
    "targon",
  );
  assert.equal(await page.evaluate(() => RegionalAudio.enabled), false);
  await page.locator("#sound-toggle").click();
  await page.locator('#my-hand [data-code="01DE012"]').click();
  await page.waitForFunction(() => nativeClips.includes("creation"));
  await page.waitForFunction(() => !busy);
  assert.ok(
    await page.evaluate(() =>
      playedSounds.some((s) => s.endsWith("/sfx-mana.ogg")),
    ),
  );
  await page.locator("#sound-toggle").click();
  assert.equal(await page.evaluate(() => RegionalAudio.activeSounds), 0);
  await page.locator("#menu").click();
  assert.equal(
    await page.evaluate(() => document.querySelector("#duel-music").paused),
    true,
  );
  // Reach Garen's second strike using legal engine actions, then resume via the UI.
  const s = E.create(
    data.cards,
    Array(30).fill("01DE012"),
    Array(30).fill("01DE046"),
    17,
  );
  while (s.round < 5) E.pass(s, s.priority);
  E.play(s, 0, s.players[0].hand[0].id);
  E.pass(s, 1);
  E.attack(s, 0, [s.players[0].board[0].id]);
  E.resolve(s, {});
  while (s.round < 7) E.pass(s, s.priority);
  await selectMatchSetting(page, "#champion-cinematic", "rugged");
  await page.addInitScript(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  assert.equal(
    await page.locator("#champion-cinematic").inputValue(),
    "rugged",
  );
  async function evolve() {
    await page.locator("#resume").click();
    await page.locator("#attack").click();
    await page.locator("#my-board .champion-card").click();
    await page.getByRole("button", { name: /Confirmar ataque/ }).click();
    await page.waitForSelector(".champion-cinematic video");
  }
  await evolve();
  await page.waitForFunction(
    () =>
      document.querySelector(".champion-cinematic video")?.currentTime > 0.4,
  );
  assert.match(
    await page.locator(".champion-cinematic p").textContent(),
    /Garen Rugged.*skin/,
  );
  const video = await page
    .locator(".champion-cinematic video")
    .evaluate((v) => ({
      duration: v.duration,
      width: v.videoWidth,
      height: v.videoHeight,
      decoded: v.getVideoPlaybackQuality().totalVideoFrames,
    }));
  assert.equal(video.duration, 5);
  assert.equal(video.width, 1280);
  assert.ok(video.decoded > 1);
  await page.screenshot({
    path: path.resolve(
      __dirname,
      "../test-results/garen-rugged-integrado-v13.png",
    ),
  });
  await page.waitForSelector(".champion-cinematic", { state: "detached" });
  await page.waitForFunction(() => !busy);
  assert.ok(
    await page.evaluate(() =>
      state.players[0].board.some((c) => c.champion && c.level === 2),
    ),
  );
  // Repeat and skip through the actual Escape shortcut; no overlay/portrait remains.
  await page.locator("#menu").click();
  await page.evaluate(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await evolve();
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !busy);
  assert.equal(
    await page.locator(".champion-cinematic,.champion-evolution").count(),
    0,
  );
  await page.locator("#menu").click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page.evaluate(() =>
      ChampionCinematic.play({ championKey: "01DE012" }),
    ),
    false,
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await b.close();
  console.log(
    "PASS: música regional na arena real, SFX de mana por ação, fragmentos nativos na invocação, vídeo Garen Rugged na evolução por combate, fim/skip/reduzido e offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
