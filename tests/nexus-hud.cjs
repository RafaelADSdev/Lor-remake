/* Native Nexus presentation and graceful GPU fallback, in real offline Chrome. */
const { chromium } = require("playwright");
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const { pathToFileURL } = require("node:url");
const {createHash} = require("node:crypto");
const digest = raw => createHash('sha256').update(raw).digest('hex');
const game = path.resolve(__dirname, '..');
const sources = JSON.parse(fs.readFileSync(path.join(game,'assets/arenas/nexus/sources.json'),'utf8'));
assert.equal(sources.rendererSha256,digest(fs.readFileSync(path.join(game,'nexus-view.js'))),'fallbacks were baked from the current renderer');
for (const sprite of sources.sprites) assert.equal(sprite.sha256,digest(fs.readFileSync(path.join(game,sprite.file))));
const E = require("../engine.js"), catalog = { window: {} };
vm.runInNewContext(fs.readFileSync(require.resolve("../cards.js"), "utf8"), catalog);
const data = catalog.window.CARD_DATA;
const saved = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, { faithful: true, skipMulligan: true });
saved.arenaThemes = ["ionia", "ionia"];
saved.players.forEach(p => { p.hand = []; p.board = []; });
saved.players[0].nexus = 19;
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [], remote = [], results = [];
  const output = path.resolve(__dirname, "../test-results");
  fs.mkdirSync(output, { recursive: true });
  try {
    for (const [width, height, gpu] of [[1600, 1000, true], [390, 844, true], [1600, 1000, false]]) {
      const context = await browser.newContext({ offline: true, viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("pageerror", e => errors.push(e.message));
      page.on("request", r => { if (/^https?:/.test(r.url())) remote.push(r.url()); });
      await page.addInitScript(({saved, gpu}) => {
        localStorage.setItem("runeterra-mesa-v1", JSON.stringify(saved));
        localStorage.setItem("lor-music-enabled", "false");
        if (!gpu) {
          const original = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
            return /webgl/.test(kind) ? null : original.call(this, kind, ...args);
          };
        }
      }, { saved, gpu });
      await page.goto(pathToFileURL(path.resolve(__dirname, "../index.html")).href);
      await page.locator("#resume").click();
      await page.evaluate(() => document.fonts.ready);
      if (gpu) await page.waitForFunction(() => NexusView.ready === 2);
      else await page.waitForFunction(() => [...document.querySelectorAll('.nexus-fallback')].length === 2 &&
        [...document.querySelectorAll('.nexus-fallback')].every(i => i.complete && i.naturalWidth));
      const layout = await page.evaluate(() => {
        const rect = e => { const r = e.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
        return { arena: rect(document.querySelector('.arena')), overflow: document.documentElement.scrollWidth > innerWidth,
          plates: [...document.querySelectorAll('.nexus')].map(e => ({ box:rect(e), number:rect(e.querySelector('b')),
            text:e.querySelector('b').textContent, label:e.getAttribute('aria-label'),
            identity:rect(e.closest('.player-bar').querySelector('div:first-child')),
            spriteVisible: !!e.querySelector('.nexus-fallback') && getComputedStyle(e.querySelector('.nexus-fallback')).display !== 'none' })) };
      });
      results.push({width,height,gpu,...layout});
      const filename = `nexus-v24-${!gpu ? 'fallback' : width > 1000 ? 'desktop' : 'mobile'}.png`;
      await page.screenshot({path:path.join(output,filename)});
      if (width > 1000 && gpu) {
        const a = layout.arena;
        await page.screenshot({path:path.join(output,'nexus-v24-detail.png'),clip:{x:a.x+a.width*.065,y:a.y+a.height*.32,width:a.width*.14,height:a.height*.36}});
      }
      assert.equal(layout.overflow, false);
      assert.deepEqual(layout.plates.map(p => p.text), ["20", "19"]);
      for (const p of layout.plates) {
        if (width > 1000) assert.ok(p.box.width / layout.arena.width < .105, "Nexus housing stays compact beside the gem");
        assert.ok(p.number.x > p.box.x && p.number.x + p.number.width < p.box.x + p.box.width + 1, "health stays inside its housing");
        assert.ok(p.box.x >= 0 && p.box.y >= 0 && p.box.y + p.box.height <= height, "Nexus remains on screen");
        assert.ok(p.box.y >= p.identity.y + p.identity.height || p.box.y + p.box.height <= p.identity.y,
          "Nexus stays clear of the player name: " + JSON.stringify({width,p}));
        assert.equal(p.spriteVisible, !gpu);
        assert.match(p.label, /Nexus.*(?:20|19) de vida/);
      }
      if (gpu) {
        const old = await page.locator('.nexus-crystal').elementHandles();
        await page.evaluate(() => { for (let i=0;i<10;i++) render(); });
        for (const canvas of old) assert.equal(await canvas.evaluate(c => c.isConnected), true);
        await page.evaluate(() => {
          document.querySelector('.nexus-crystal').getContext('webgl').getExtension('WEBGL_lose_context').loseContext();
        });
        await page.waitForFunction(() => !document.getElementById('enemy-nexus').classList.contains('has-nexus-model'));
        assert.equal(await page.locator('#enemy-nexus .nexus-fallback').isVisible(), true, "native fallback survives context loss");
      } else {
        await page.emulateMedia({reducedMotion:'no-preference'});
        await page.evaluate(() => { state.winner = 0; window.testEnding = DuelOutcome.play(state); });
        await page.waitForSelector('.outcome-shard');
        assert.ok(await page.locator('.outcome-shard').first().evaluate(c => {
          const a = c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          return a.some((v,i) => i%4 === 3 && v > 0);
        }), 'no-GPU ending uses the native sprite pixels');
        assert.equal(await page.locator('#enemy-nexus .nexus-fallback').isVisible(), false, 'defeated sprite disappears behind its fragments');
        await page.keyboard.press('Escape');
        await page.evaluate(() => window.testEnding);
      }
      await page.locator('#menu').click();
      await context.close();
    }
    assert.deepEqual(errors, []); assert.deepEqual(remote, []);
    fs.writeFileSync(path.join(output,'nexus-v24.json'),JSON.stringify(results,null,2));
    console.log('PASS: compact native Nexus HUD, health labels, mobile, persistent canvases, offline sprites and context-loss fallback.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
