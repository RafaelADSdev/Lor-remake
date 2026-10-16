const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const game = path.resolve(__dirname, ".."), output = path.join(game, "test-results");
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(game, "assets/arenas/token/sources.json"), "utf8"));
  for (const [name, item] of Object.entries(manifest.sprites))
    assert.equal(hash(fs.readFileSync(path.join(game, "assets/arenas/token", name + ".png"))), item.sha256);
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(game, "attack-token-data.js"), "utf8"), context);
  const clips = context.window.ATTACK_TOKEN_DATA.clips;
  assert.equal(context.window.ATTACK_TOKEN_DATA.flame.tilesX * context.window.ATTACK_TOKEN_DATA.flame.tilesY, 36);
  assert.equal(hash(fs.readFileSync(path.join(game, "assets/arenas/token/flame.png"))), manifest.flame.texture.exports.find(e => e.file.endsWith(".png")).sha256);
  assert.ok(Math.abs(clips.idle.duration - 2) < .00001);
  assert.ok(Math.abs(clips.punch.duration - .8) < .00001);
  assert.ok(Math.abs(clips.consume.duration - 25/60) < .00001);
  assert.equal(clips.consume.tracks.filter(t => /Fracture_00/.test(t.path)).length, 5);
  for (const clip of Object.values(clips)) {
    assert.equal(clip.offsets[0], 0); assert.equal(clip.offsets.at(-1), 1);
    assert.ok(clip.tracks.every(track => track.path));
  }
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true, reducedMotion: "no-preference" });
    const errors = [], remote = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
    await page.addInitScript(() => localStorage.setItem("lor-music-enabled", "false"));
    await page.goto("file:///" + path.join(game, "index.html").replaceAll("\\", "/"));
    await page.locator("#train").click();
    // A deterministic main-phase state isolates token presentation from bot timers.
    await page.evaluate(() => {
      clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.demacia, CARD_DATA.decks.noxus, 9, { faithful: true, skipMulligan: true });
      state.players[0].board = [{ ...structuredClone(CARD_DATA.cards["01DE046"]), id: "c" + state.nextId++, maxHealth: 4 }];
      state.attackTokens = [true, false]; state.priority = 0; busy = false; mode = "";
      render();
    });
    assert.equal(await page.locator("#arena-token").getAttribute("data-native-transition"), "assemble");
    await page.waitForFunction(() => document.querySelector(".token-blade").dataset.nativeClip === "idle");
    assert.equal(await page.locator("#arena-token svg").count(), 0);
    const idle = await page.locator("#arena-token .token-blade").evaluate(el => {
      const effect = el.getAnimations()[0].effect;
      return { duration: effect.getTiming().duration, loop: effect.getTiming().iterations === Infinity,
        first: effect.getKeyframes()[0].transform, mid: effect.getKeyframes()[Math.floor(effect.getKeyframes().length/2)].transform };
    });
    assert.ok(idle.loop && Math.abs(idle.duration - 2000) < .01);
    assert.notEqual(idle.first, idle.mid);
    assert.equal(await page.locator("#arena-token .token-flame").evaluate(el => el.getAnimations().length), 1);
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "token-ataque.png") });
    await page.locator("#attack").click();
    assert.equal(await page.locator("#arena-token .token-blade").getAttribute("data-native-clip"), "punch");
    await page.locator("#my-board .card").first().click();
    await page.locator("#attack").click();
    await page.waitForFunction(() => document.querySelector("#arena-token").dataset.nativeTransition === "consume");
    assert.equal(await page.locator("#arena-token .token-fragments img").count(), 5);
    await page.waitForFunction(() => !document.querySelector(".token-fragments"));
    assert.equal(await page.locator("#arena-token .token-defense").isVisible(), true);
    await page.screenshot({ path: path.join(output, "token-defesa.png") });
    await page.evaluate(() => { clearTimeout(timer); state.attackTokens = [true, false]; render(); });
    await page.locator("#menu").click();
    assert.equal(await page.locator("#arena-token").evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#train").click();
    assert.equal(await page.locator("#arena-token").evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#motion-toggle").click();
    assert.equal(await page.locator("#arena-token").evaluate(el => el.getAnimations({ subtree: true }).length), 0);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const rect = await page.locator("#arena-token").boundingBox();
      assert.ok(rect.x >= 0 && rect.x + rect.width <= width);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log("Native token: seven sprite hashes, five clips, assembly, 2s idle, real attack punch/consumption, five shards, menu cancellation, reduced/off motion and four widths pass offline.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
