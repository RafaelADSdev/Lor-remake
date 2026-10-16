/* Records the actual offline prototype, not the Riot client. */
const fs = require("node:fs"), path = require("node:path"), { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");
(async () => {
  const output = path.resolve(__dirname, "../test-results"), game = path.resolve(__dirname, "..");
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true,
      reducedMotion: "no-preference", recordVideo: { dir: output, size: { width: 1440, height: 1000 } } });
    const page = await context.newPage(), errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem("lor-music-enabled", "false"));
    await page.goto(pathToFileURL(path.join(game, "index.html")).href);
    await page.locator("#train").click();
    await page.evaluate(() => {
      clearTimeout(timer); schedule = () => clearTimeout(timer);
      state = Engine.create(CARD_DATA.cards, CARD_DATA.decks.demacia, CARD_DATA.decks.noxus, 9, { faithful: true, skipMulligan: true });
      const unit = code => ({ ...structuredClone(CARD_DATA.cards[code]), id: "c" + state.nextId++, maxHealth: CARD_DATA.cards[code].health });
      state.players[0].board = [unit("01DE046")]; state.players[0].hand = [];
      state.players[1].board = []; state.players[1].hand = [unit("01NX012")];
      state.round = 5; state.players.forEach(player => player.mana = 5);
      state.attackTokens = [true, false]; state.priority = 0; busy = false; mode = ""; render();
    });
    await page.waitForFunction(() => document.querySelector("#arena-token .token-blade").dataset.nativeClip === "idle");
    const clip = await page.evaluate(() => {
      const boxes = ["mana-wheel", "arena-token", "enemy-arena-token"].map(id => document.getElementById(id).getBoundingClientRect());
      const x = Math.max(0, Math.floor(Math.min(...boxes.map(b => b.x))-30)),
        y = Math.max(0, Math.floor(Math.min(...boxes.map(b => b.y))-30));
      return { x, y, width: Math.min(innerWidth-x, Math.ceil(Math.max(...boxes.map(b => b.right))-x+30)),
        height: Math.min(innerHeight-y, Math.ceil(Math.max(...boxes.map(b => b.bottom))-y+60)) };
    });
    await page.screenshot({ path: path.join(output, "iniciativa-encaixe-jogador.png"), clip });
    await page.locator("#pass").click();
    await page.waitForTimeout(200);
    await page.evaluate(() => { Engine.pass(state, state.priority); render(); });
    await page.waitForFunction(() => document.getElementById("initiative-token").dataset.transferTo === "1");
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(output, "iniciativa-passagem.png"), clip });
    await page.waitForFunction(() => !document.getElementById("initiative-token").dataset.transferTo);
    await page.screenshot({ path: path.join(output, "iniciativa-encaixe-bot.png"), clip });
    await page.waitForTimeout(500);
    await page.evaluate(() => { Engine.pass(state, state.priority); render(); });
    await page.waitForTimeout(200);
    await page.evaluate(() => { Engine.pass(state, state.priority); render(); });
    await page.waitForFunction(() => document.getElementById("initiative-token").dataset.transferTo === "0");
    await page.waitForTimeout(420);
    await page.screenshot({ path: path.join(output, "iniciativa-passagem-ataque.png"), clip });
    await page.waitForFunction(() => !document.getElementById("initiative-token").dataset.transferTo);
    await page.waitForTimeout(500);
    if (errors.length) throw Error(errors.join("\n"));
    const video = page.video();
    await context.close();
    await video.saveAs(path.join(output, "iniciativa-passagem.webm"));
    console.log("Recorded attack coin transferring only on round changes in the offline prototype, with socket detail screenshots.");
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
