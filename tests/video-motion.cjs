const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const E = require("../engine.js");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
const url =
  "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
function fixture(owner) {
  const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  const make = (code) => ({
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  });
  s.round = 5;
  s.arenaThemes = ["rift", "rift"];
  s.players.forEach((p) => {
    p.hand = [];
    p.mana = 0;
    p.board = [];
  });
  s.players[owner].board = [make("01DE046"), make("01NX037")];
  s.players[1 - owner].board = [make("01DE046")];
  s.attackTokens = [owner === 0, owner === 1];
  s.priority = owner;
  E.attack(
    s,
    owner,
    s.players[owner].board.map((c) => c.id),
  );
  E.commitBlocks(s, 1 - owner, {
    [s.combat.ids[0]]: s.players[1 - owner].board[0].id,
  });
  // Saved response with the player passing second; no private app hooks needed.
  s.priority = 0;
  return s;
}
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const errors = [],
    remote = [];
  async function open(s, reducedMotion = "no-preference", record = false) {
    const context = await browser.newContext({
      offline: true,
      viewport: { width: 1600, height: 1000 },
      reducedMotion,
      ...(record
        ? {
            recordVideo: {
              dir: path.resolve(__dirname, "../test-results/video"),
              size: { width: 1600, height: 1000 },
            },
          }
        : {}),
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) remote.push(r.url());
    });
    await page.addInitScript((s) => {
      localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s));
      window.samples = [];
      window.stages = [];
      window.sequenceDone = false;
      document.addEventListener("arena-motion-stage", (e) => {
        stages.push(e.detail.phase);
        if (e.detail.phase === "strike-travel" && e.detail.blocker) {
          const nodes = [e.detail.attacker, e.detail.blocker].map((id) =>
            document.querySelector(`.fx-combat-card[data-unit-id="${id}"]`),
          );
          const start = nodes.map((n) => n.getBoundingClientRect());
          setTimeout(
            () =>
              samples.push(
                nodes.map((n, i) => {
                  const r = n.getBoundingClientRect();
                  return Math.hypot(r.x - start[i].x, r.y - start[i].y);
                }),
              ),
            65,
          );
        }
        if (
          e.detail.phase === "strike-impact" &&
          e.detail.blocker &&
          window.captureCollision
        ) {
          queueMicrotask(() => {
            // Hold the short contact flare for a deterministic screenshot.
            for (const a of document.getAnimations()) {
              if (a.effect?.target?.classList.contains("fx-collision")) {
                a.currentTime = 70;
                a.pause();
              }
              if (
                a.effect?.target?.id === "effects-layer" &&
                a.playState === "running"
              )
                a.pause();
            }
          });
        }
        if (e.detail.phase === "nexus-strike-travel")
          window.nexusBeforeHit = document.querySelector(
            e.detail.side ? "#enemy-nexus b" : "#my-nexus b",
          ).textContent;
        if (e.detail.phase === "combat-last-breath") sequenceDone = true;
      });
    }, s);
    await page.goto(url);
    await page.locator("#resume").click();
    await page.waitForFunction(() => NexusView.ready === 2);
    return { context, page };
  }
  for (const owner of [0, 1]) {
    const { page, context } = await open(
      fixture(owner),
      "no-preference",
      owner === 1,
    );
    assert.ok(
      await page.evaluate(() => {
        const originals = [...document.querySelectorAll(".nexus-crystal")];
        for (let i = 0; i < 20; i++) render();
        return originals.every(
          (canvas, side) =>
            document.querySelectorAll(".nexus-crystal")[side] === canvas,
        );
      }),
      "resource redraw reuses exactly two WebGL canvases",
    );
    const pixels = await page.evaluate(() => {
      NexusView.sync();
      return [...document.querySelectorAll(".nexus-crystal")].map((c) => {
        const p = new Uint8Array(c.width * c.height * 4);
        c.getContext("webgl").readPixels(
          0,
          0,
          c.width,
          c.height,
          6408,
          5121,
          p,
        );
        const result = { painted: 0, red: 0, blue: 0 };
        let xmin = c.width,
          xmax = 0,
          ymin = c.height,
          ymax = 0;
        for (let i = 0; i < p.length; i += 4)
          if (p[i + 3] > 0) {
            const x = (i / 4) % c.width,
              y = Math.floor(i / 4 / c.width);
            xmin = Math.min(xmin, x);
            xmax = Math.max(xmax, x);
            ymin = Math.min(ymin, y);
            ymax = Math.max(ymax, y);
            result.painted++;
            if (p[i] > p[i + 2] * 1.3) result.red++;
            if (p[i + 2] > p[i] * 1.3) result.blue++;
          }
        const bounds = c.getBoundingClientRect();
        result.aspect =
          (((xmax - xmin + 1) / c.width) * bounds.width) /
          (((ymax - ymin + 1) / c.height) * bounds.height);
        result.fill = result.painted / ((xmax - xmin + 1) * (ymax - ymin + 1));
        return result;
      });
    });
    assert.ok(
      pixels.every((p) => p.painted > 1000),
      "both original textured meshes render",
    );
    assert.ok(
      pixels[0].red > pixels[0].blue && pixels[1].blue > pixels[1].red,
      "enemy red, player blue",
    );
    assert.ok(
      pixels.every((p) => p.aspect > 0.85 && p.aspect < 1.3 && p.fill > 0.58),
      "compact gem silhouette: no exposed elongated rear shaft or stretched canvas: " + JSON.stringify(pixels),
    );
    if (owner === 1)
      await page.evaluate(() => (window.captureCollision = true));
    await page.locator("#pass").click();
    if (owner === 1) {
      await page.waitForSelector(".fx-collision");
      const flare = await page.locator(".fx-collision").boundingBox();
      assert.ok(
        flare.width > 50 && flare.height > 25,
        "contact keeps DOMRect dimensions",
      );
      const flareStyle = await page.locator(".fx-collision").evaluate((e) => ({
        opacity: getComputedStyle(e).opacity,
        x: e.getBoundingClientRect().x,
        y: e.getBoundingClientRect().y,
        visibility: getComputedStyle(e).visibility,
      }));
      assert.ok(
        Number(flareStyle.opacity) > 0.1,
        "the collision flare is painted",
      );
      fs.writeFileSync(
        path.resolve(__dirname, "../test-results/collision-position.json"),
        JSON.stringify(flareStyle),
      );
      await page.screenshot({
        path: path.resolve(__dirname, "../test-results/colisao-defesa-v12.png"),
      });
      await page.evaluate(() => {
        window.captureCollision = false;
        for (const a of document.getAnimations())
          if (a.playState === "paused") a.play();
      });
    }
    await page.waitForFunction(() => sequenceDone && !busy);
    const result = await page.evaluate(() => ({
      stages,
      samples,
      nexusBeforeHit,
      nx: [...document.querySelectorAll(".nexus b")].map((n) =>
        Number(n.textContent),
      ),
      actual: state.players.map((p) => p.nexus),
      ghosts: document.querySelectorAll(".fx-combat-card").length,
    }));
    assert.ok(
      result.samples[0][0] > 5 && result.samples[0][1] > 3,
      "attacker and blocker both move toward contact",
    );
    assert.equal(
      result.nexusBeforeHit,
      "20",
      "Nexus damage waits for the projectile to arrive",
    );
    assert.equal(result.actual[1 - owner], 17);
    assert.equal(result.ghosts, 0);
    assert.deepEqual(
      [...result.nx].sort((a, b) => a - b),
      [17, 20],
    );
    for (const stage of [
      "block-brace",
      "block-recoil",
      "combat-return",
      "nexus-strike-travel",
    ])
      assert.ok(result.stages.includes(stage), stage);
    await page.screenshot({
      path: path.resolve(
        __dirname,
        `../test-results/animacoes-v12-${owner ? "defesa" : "ataque"}.png`,
      ),
    });
    await page.locator("#menu").click();
    assert.equal(await page.locator("body.hud-motion").count(), 0);
    const video = page.video();
    await context.close();
    if (video)
      await video.saveAs(
        path.resolve(
          __dirname,
          "../test-results/demonstracao-combate-v12.webm",
        ),
      );
  }
  {
    const { page, context } = await open(fixture(1));
    await page.locator("#pass").click();
    await page.waitForSelector(".fx-combat-card");
    await page.locator("#menu").click();
    const stateAfterCancel = await page.evaluate(() => JSON.stringify(state));
    await page.waitForTimeout(1100);
    assert.equal(
      await page.evaluate(() => JSON.stringify(state)),
      stateAfterCancel,
    );
    assert.equal(await page.locator("#effects-layer > *").count(), 0);
    assert.equal(await page.locator("body.hud-motion").count(), 0);
    await context.close();
  }
  {
    const { page, context } = await open(fixture(1), "reduce");
    await page.locator("#pass").click();
    await page.waitForFunction(() => !busy);
    assert.equal(await page.locator("#my-nexus b").textContent(), "17");
    assert.equal(await page.locator("#effects-layer > *").count(), 0);
    assert.equal(
      await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter(
              (a) => a.playState === "running" && !(a instanceof CSSTransition),
            ).length,
      ),
      0,
    );
    assert.equal(await page.locator(".nexus-crystal").count(), 2);
    await context.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: colisão nos dois sentidos, bloqueador avança/recua, projétil antes do dano, retorno à base, dois Nexus WebGL persistentes, cancelamento, movimento reduzido e offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
