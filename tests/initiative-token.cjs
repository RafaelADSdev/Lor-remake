const { chromium } = require("playwright");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const assert = require("node:assert/strict"), crypto = require("node:crypto");
const game = path.resolve(__dirname, ".."), output = path.join(game, "test-results");

(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(game, "assets/arenas/token/initiative-sources.json"), "utf8"));
  for (const [file, digest] of Object.entries(manifest.derived))
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(game, "assets/arenas/token", file))).digest("hex"), digest);
  const ctx = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(game, "initiative-token-data.js"), "utf8"), ctx);
  const clip = ctx.window.INITIATIVE_TOKEN_DATA, channel = clip.tracks[0].channels;
  assert.equal(clip.duration, 1);
  assert.equal(channel.position[0][1], 29); assert.equal(channel.position.at(-1)[1], -29);
  assert.equal(channel.euler.at(-1)[0], -360);
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, offline: true, reducedMotion: "no-preference" });
    const errors = [], remote = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => { if (/^https?:/.test(request.url())) remote.push(request.url()); });
    await page.addInitScript(() => localStorage.setItem("lor-music-enabled", "false"));
    await page.goto("file:///" + path.join(game, "index.html").replaceAll("\\", "/"));
    await page.locator("#train").click();
    await page.evaluate(() => {
      clearTimeout(timer); schedule = () => clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.demacia, CARD_DATA.decks.noxus, 9, { faithful: true, skipMulligan: true });
      const unit = code => ({ ...structuredClone(CARD_DATA.cards[code]), id: "c" + state.nextId++, maxHealth: CARD_DATA.cards[code].health });
      state.players[0].board = [unit("01DE046")]; state.players[0].hand = [];
      state.players[1].board = []; state.players[1].hand = [unit("01NX012")];
      state.players.forEach(player => player.mana = 5);
      state.attackTokens = [true, false]; state.priority = 0; busy = false; mode = ""; render();
    });
    await page.waitForFunction(() => document.querySelector("#arena-token .token-blade").dataset.nativeClip === "idle");
    assert.equal(await page.locator(".arena-token").count(), 2);
    assert.equal(await page.locator("#enemy-arena-token .token-defense").isVisible(), true);
    const coin = page.locator("#initiative-token");
    async function settled(side) {
      await page.waitForFunction(side => {
        const coin = document.getElementById("initiative-token");
        return coin.dataset.owner === String(side) && !coin.dataset.transferTo;
      }, side);
      const error = await page.evaluate(side => {
        const coin = document.getElementById("initiative-token").getBoundingClientRect(), housing = document.getElementById("native-action-housing"),
          source = INITIATIVE_TOKEN_DATA.socketProjection, circle = source.sockets[side], box = housing.getBBox(),
          point = new DOMPoint(box.x + circle.center[0]/source.spriteSize[0]*box.width,
            box.y + circle.center[1]/source.spriteSize[1]*box.height).matrixTransform(housing.getScreenCTM());
        return Math.hypot(coin.x+coin.width/2-point.x, coin.y+coin.height/2-point.y);
      }, side);
      assert.ok(error < 1, "Coin must fit the native circular socket, error " + error);
      assert.equal(await coin.evaluate(el => getComputedStyle(el).opacity), "0", "Travelling coin must not cover the fixed symbol at rest");
      const expectedFace = await page.evaluate(side => Engine.canAttack(state, side) ? "attack" : "defense", side);
      assert.equal(await coin.getAttribute("data-face"), expectedFace, "Coin face follows the receiving side's attack availability");
      assert.equal(await coin.getAttribute("data-face-side"), String(side));
      const markers = await page.evaluate(() => {
        const source = INITIATIVE_TOKEN_DATA.socketProjection, housing = document.getElementById("native-action-housing"), box = housing.getBBox();
        return ["arena-token", "enemy-arena-token"].map((id, side) => {
          const marker = document.getElementById(id), rect = marker.getBoundingClientRect(), circle = source.sockets[side],
            center = new DOMPoint(box.x+circle.center[0]/source.spriteSize[0]*box.width, box.y+circle.center[1]/source.spriteSize[1]*box.height).matrixTransform(housing.getScreenCTM());
          return { distance: Math.hypot(rect.x+rect.width/2-center.x, rect.y+rect.height/2-center.y),
            circular: getComputedStyle(marker).borderRadius === "50%" };
        });
      });
      for (const marker of markers) { assert.ok(marker.distance < 1, "Attack/defense must stay in its housing socket"); assert.ok(marker.circular); }
      const button = await page.locator("#attack").boundingBox(), lower = await page.locator("#arena-token").boundingBox();
      if (button) {
        assert.ok(button.width >= 44 && button.height >= 44, "Attack retains a 44px target");
        assert.ok(Math.hypot(button.x+button.width/2-lower.x-lower.width/2,
          button.y+button.height/2-lower.y-lower.height/2) < 1, "Attack target follows the lower socket");
      }
    }
    await settled(0);
    assert.equal(await page.locator("#attack").isVisible(), true);
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "iniciativa-jogador.png") });
    await page.locator("#pass").click();
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "A normal pass must not move the coin");
    await settled(0);
    assert.deepEqual(await page.evaluate(() => state.attackTokens), [true, false]);
    await page.evaluate(() => { Engine.play(state, 1, state.players[1].hand[0].id); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "Playing a unit must not move the coin");
    await settled(0);
    await page.evaluate(() => { state.players[0].mana--; state.attackTokens[1] = true; render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "Mana updates and rally do not change round ownership");
    await page.evaluate(() => { state.attackTokens[1] = false; Engine.pass(state, 0); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "First pass stays in the current round");
    await page.evaluate(() => { Engine.pass(state, 1); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), "1", "Round change passes the attack coin to the bot");
    assert.equal(await coin.evaluate(el => getComputedStyle(el).opacity), "1");
    assert.equal(await coin.getAttribute("data-face"), "attack");
    assert.equal(await coin.locator(".token-blade").getAttribute("src"), "assets/arenas/token/blade.png");
    assert.equal(await coin.evaluate(el => el.style.getPropertyValue("--token-angle")), "230deg");
    assert.equal(await coin.evaluate(el => el.getAnimations()[0].effect.getTiming().duration), 1000);
    assert.equal(await page.evaluate(() => {
      const flight = document.getElementById("initiative-token").getAnimations()[0];
      render(); render();
      return document.getElementById("initiative-token").getAnimations()[0] === flight;
    }), true, "Repeated renders must preserve the current round transition");
    await settled(1);
    await page.screenshot({ path: path.join(output, "iniciativa-bot.png") });
    await page.waitForFunction(() => document.querySelector("#enemy-arena-token .token-blade").dataset.nativeClip === "idle");
    assert.equal(await page.locator("#arena-token .token-defense").isVisible(), true);
    assert.equal(await page.locator("#enemy-arena-token").getAttribute("data-token-state"), "available");
    await page.evaluate(() => { Engine.attack(state, 1, [state.players[1].board[0].id]); render(); });
    assert.equal(await page.locator("#enemy-arena-token .token-blade").getAttribute("data-native-clip"), "punch");
    await page.waitForFunction(() => document.getElementById("enemy-arena-token").dataset.nativeTransition === "consume");
    await page.waitForFunction(() => !document.querySelector("#enemy-arena-token .token-fragments"));
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "Declaring and consuming attack does not pass the coin");
    await settled(1);
    assert.equal(await page.locator("#enemy-arena-token .token-defense").isVisible(), true);
    assert.equal(await page.locator("#arena-token").getAttribute("data-token-state"), "defending");
    await page.evaluate(() => { Engine.commitBlocks(state, 0, {}); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "Confirming blocks does not move the coin");
    await page.evaluate(() => { Engine.pass(state, state.priority); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), null, "Combat resolution stays in this round");
    await page.evaluate(() => { Engine.pass(state, state.priority); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), null);
    await page.evaluate(() => { Engine.pass(state, state.priority); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), "0", "Next round returns the attack coin to the player");
    assert.equal(await coin.getAttribute("data-face"), "attack");
    await settled(0);
    // Cancel an actual round transition through the real menu action.
    await page.evaluate(() => { Engine.pass(state, state.priority); Engine.pass(state, state.priority); render(); });
    assert.equal(await coin.getAttribute("data-transfer-to"), "1");
    await page.locator("#menu").click();
    assert.equal(await coin.evaluate(el => el.getAnimations().length), 0);
    assert.equal(await page.locator(".arena-token").evaluateAll(els => els.reduce((sum, el) => sum + el.getAnimations({ subtree: true }).length, 0)), 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator("#resume").click();
    await page.evaluate(() => { clearTimeout(timer); Engine.pass(state, state.priority); Engine.pass(state, state.priority); render(); });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await coin.evaluate(el => el.getAnimations().length), 0);
    await settled(await page.evaluate(() => state.token));
    for (const width of [320, 390, 768, 1440, 2529]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await settled(await page.evaluate(() => state.token));
      for (const id of ["arena-token", "enemy-arena-token", "initiative-token"]) {
        const box = await page.locator("#"+id).boundingBox();
        assert.ok(box.x >= 0 && box.x+box.width <= width && box.y >= 0, id + " remains in the arena at " + width);
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      if (width === 390) await page.screenshot({ path: path.join(output, "iniciativa-mobile.png") });
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    console.log("Round coin: only attack/defense round changes fly both ways; passes, plays, rally, attack and block/response stay still; socket fit, cancellation, reduced motion and five widths pass offline.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
