/* Native impact playback at actual combat contact, using offline Chrome. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const E = require("../engine.js");
const catalog = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve("../cards.js"), "utf8"), catalog);
const data = JSON.parse(JSON.stringify(catalog.window.CARD_DATA));
const impactKeys = ["hit", "nexus-hit"];

function fixture(owner, kind = "mixed") {
  const state = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  const make = (code) => ({
    ...structuredClone(data.cards[code]),
    id: "c" + state.nextId++,
    maxHealth: data.cards[code].health,
  });
  state.round = 5;
  state.arenaThemes = ["rift", "rift"];
  state.players.forEach((player) => {
    player.hand = [];
    player.board = [];
    player.mana = 0;
  });
  state.players[owner].board = [make(kind === "overwhelm" ? "01NX038" : "01DE046")];
  if (kind === "mixed") state.players[owner].board.push(make("01NX012"));
  state.players[1 - owner].board = [make("01DE046")];
  state.attackTokens = [owner === 0, owner === 1];
  state.priority = owner;
  E.attack(state, owner, state.players[owner].board.map((card) => card.id));
  E.commitBlocks(state, 1 - owner, {
    [state.combat.ids[0]]: state.players[1 - owner].board[0].id,
  });
  if (kind === "ghost") state.players[1 - owner].board = [];
  state.priority = 0;
  return state;
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [], remote = [];
  async function open(owner, kind = "mixed", reducedMotion = "no-preference", sound = true) {
    const context = await browser.newContext({
      offline: true,
      viewport: { width: 1440, height: 960 },
      reducedMotion,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(6000);
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/^https?:/.test(request.url())) remote.push(request.url());
    });
    await page.addInitScript((state) => {
      localStorage.setItem("runeterra-mesa-v1", JSON.stringify(state));
      localStorage.setItem("lor-music-enabled", "false");
      window.impactCalls = [];
      window.impactVoices = [];
      window.impactStages = [];
      window.combatDone = false;
      document.addEventListener("arena-motion-stage", ({ detail }) => {
        impactStages.push({ ...detail, time: performance.now() });
        if (detail.phase === "combat-last-breath") combatDone = true;
      });
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function (...args) {
        const key = ["hit", "nexus-hit"].find((key) =>
          window.NATIVE_SOUNDS?.[key] && this.src.endsWith(NATIVE_SOUNDS[key].src),
        );
        if (key) impactVoices.push({ key, voice: this });
        return nativePlay.apply(this, args);
      };
    }, fixture(owner, kind));
    await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
    await page.locator("#resume").click();
    await page.evaluate(() => {
      const original = RegionalAudio.sound.bind(RegionalAudio);
      RegionalAudio.sound = function (key, ...args) {
        if (!["hit", "nexus-hit"].includes(key)) return original(key, ...args);
        const call = {
          key,
          time: performance.now(),
          stage: impactStages.at(-1),
          missiles: document.querySelectorAll(".fx-nexus-missile").length,
        };
        impactCalls.push(call);
        const result = original(key, ...args);
        Promise.resolve(result).then((played) => { call.played = played; });
        return result;
      };
    });
    if (await page.evaluate(() => ArenaMotion.soundEnabled) !== sound)
      await page.locator("#sound-toggle").click();
    return { page, context };
  }
  async function resolveCombat(page) {
    await page.locator("#pass").click();
    await page.waitForFunction(() => !busy && state.combat === null);
  }
  try {
    for (const owner of [0, 1]) {
      const { page, context } = await open(owner);
      await resolveCombat(page);
      const result = await page.evaluate(() => ({
        calls: impactCalls,
        events: [NATIVE_SOUNDS.hit?.event, NATIVE_SOUNDS["nexus-hit"]?.event],
        playback: impactVoices.map(({ key, voice }) => ({
          key, time: voice.currentTime, duration: voice.duration, ready: voice.readyState,
        })),
        nexus: state.players.map((player) => player.nexus),
      }));
      assert.deepEqual(result.calls.map((call) => call.key), impactKeys,
        `owner ${owner}: blocked contact then direct Nexus impact must use native audio`);
      assert.deepEqual(result.events, ["Play_IMP_damage_unit_hit", "Play_IMP_damage_face_hit"]);
      assert.ok(result.calls.every((call) => call.played === true), "real media play promises resolve");
      assert.equal(result.calls[0].stage.phase, "strike-impact");
      assert.equal(result.calls[0].stage.kind, "blocked");
      assert.equal(result.calls[1].stage.kind, "nexus");
      assert.ok(result.calls.every((call) => call.missiles === 0), "projectiles arrive before audio");
      for (const key of impactKeys) {
        assert.ok(result.playback.some((voice) => voice.key === key && voice.time > 0 &&
          voice.duration > 0 && voice.ready >= 2), `${key}: original OGG actually decodes and advances offline`);
      }
      assert.equal(result.nexus[1 - owner], 17);
      await context.close();
    }
    {
      const { page, context } = await open(0, "overwhelm");
      await resolveCombat(page);
      const calls = await page.evaluate(() => impactCalls);
      assert.deepEqual(calls.map((call) => call.key), impactKeys, "Overwhelm has separate unit and Nexus impacts");
      assert.ok(calls[1].time - calls[0].time >= 200, "Nexus sound waits for the spillover projectile");
      assert.equal(calls[1].missiles, 0);
      assert.equal(await page.evaluate(() => state.players[1].nexus), 18);
      await context.close();
    }
    {
      const { page, context } = await open(0, "ghost");
      await resolveCombat(page);
      assert.deepEqual(await page.evaluate(() => impactCalls), [], "removed blocker does not create a false impact");
      assert.equal(await page.evaluate(() => state.players[1].nexus), 20);
      await context.close();
    }
    {
      const { page, context } = await open(0);
      await page.locator("#pass").click();
      await page.waitForFunction(() => impactCalls.some((call) => call.played));
      assert.ok(await page.evaluate(() => RegionalAudio.activeSounds > 0));
      await page.locator("#sound-toggle").click();
      assert.equal(await page.evaluate(() => RegionalAudio.activeSounds), 0, "mute stops current voices");
      await page.waitForFunction(() => !busy);
      assert.ok(await page.evaluate(() => impactVoices.every(({ voice }) => voice.paused)), "mute prevents further playback");
      assert.ok(await page.evaluate(() => impactCalls.filter((call) => call.played).length === 1));
      await context.close();
    }
    {
      const { page, context } = await open(0);
      await page.locator("#pass").click();
      await page.waitForFunction(() => impactCalls.some((call) => call.played));
      const count = await page.evaluate(() => {
        ArenaMotion.cancel();
        return impactCalls.length;
      });
      assert.ok(await page.evaluate(() => impactVoices.every(({ voice }) => voice.paused)),
        "cancel stops active impact voices while allowing unrelated interface audio");
      await page.waitForTimeout(1100);
      assert.equal(await page.evaluate(() => impactCalls.length), count, "cancelled sequence schedules no later impacts");
      assert.ok(await page.evaluate(() => impactVoices.every(({ voice }) => voice.paused)));
      await context.close();
    }
    for (const [reducedMotion, sound] of [["reduce", true], ["no-preference", false]]) {
      const { page, context } = await open(0, "mixed", reducedMotion, sound);
      await resolveCombat(page);
      assert.deepEqual(await page.evaluate(() => impactCalls), [], `${reducedMotion}/${sound}: no combat audio`);
      assert.equal(await page.evaluate(() => state.players[1].nexus), 17);
      await context.close();
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(remote, []);
    console.log("PASS: native OGG combat impacts play offline at unit/Nexus contact for both owners; Overwhelm, ghost block, mute, cancellation and reduced motion pass.");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
