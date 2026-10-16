const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  E = require("../engine.js");
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
  s.round = 10;
  s.arenaThemes = ["shadowisles", "shadowisles"];
  s.players.forEach((p) => {
    p.board = [];
    p.hand = [];
    p.mana = 10;
    p.spellMana = 3;
  });
  const card = {
    ...structuredClone(data.cards["01NX037"]),
    id: "c" + s.nextId++,
    maxHealth: data.cards["01NX037"].health,
  };
  s.players[owner].board = [card];
  s.players[1 - owner].nexus = 1;
  s.attackTokens = [owner === 0, owner === 1];
  s.priority = owner;
  E.attack(s, owner, [card.id]);
  E.commitBlocks(s, 1 - owner, {});
  s.priority = 0;
  return s;
}
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true }),
    errors = [],
    remote = [];
  async function open(s, reducedMotion = "no-preference", off = false) {
    const context = await browser.newContext({
      offline: true,
      reducedMotion,
      viewport: { width: 1600, height: 900 },
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/^https?:/.test(r.url())) remote.push(r.url());
    });
    await page.addInitScript(
      ({ s, off }) => {
        localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s));
        if (off) localStorage.setItem("arena-motion", "off");
        window.outcomes = [];
        document.addEventListener("duel-outcome-stage", (e) =>
          outcomes.push(e.detail.phase),
        );
      },
      { s, off },
    );
    await page.goto(url);
    await page.locator("#resume").click();
    await page.waitForFunction(() => NexusView.ready === 2 && ArenaScene.ready);
    return { page, context };
  }
  for (const owner of [0, 1]) {
    const { page, context } = await open(fixture(owner));
    for (const width of [320, 390, 768, 1440, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      const layout = await page.evaluate(() => {
        const stage = document.querySelector(".arena").getBoundingClientRect(),
          seam = document
            .querySelector(".arena-center-rule")
            .getBoundingClientRect(),
          button = document.querySelector("#pass").getBoundingClientRect(),
          range = document.createRange();
        range.selectNodeContents(document.querySelector("#pass"));
        const text = range.getBoundingClientRect();
        const svg = document.getElementById("mana-wheel"),
          housing = svg.querySelector("path");
        const outside = [...svg.querySelectorAll(".hud-mana-tick")].filter(
          (tick) => {
            const matrix = svg
              .getScreenCTM()
              .inverse()
              .multiply(tick.getScreenCTM());
            return [
              [-2.5, -5],
              [-2.5, 5],
              [2.5, -5],
              [2.5, 5],
            ].some(
              ([x, y]) =>
                !housing.isPointInFill(
                  new DOMPoint(x, y).matrixTransform(matrix),
                ),
            );
          },
        ).length;
        return {
          middle: stage.y + stage.height / 2,
          seam: seam.y + seam.height / 2,
          button: button.y + button.height / 2,
          textWidth: text.width,
          buttonWidth: button.width,
          outside,
          tickCount: svg.querySelectorAll(".hud-mana-tick").length,
          combatBounds: [
            ...document.querySelectorAll(".board .on-battlefield"),
          ].map((el) => {
            const r = el.getBoundingClientRect();
            return [
              (r.top - stage.top) / stage.height,
              (r.bottom - stage.top) / stage.height,
            ];
          }),
          overflow: document.documentElement.scrollWidth > innerWidth,
        };
      });
      assert.ok(
        Math.abs(layout.seam - layout.middle) < 1,
        "seam at exact center",
      );
      assert.ok(
        Math.abs(layout.button - layout.middle) < 1,
        "action wheel shares center",
      );
      assert.equal(
        layout.outside,
        0,
        "all 20 mana marks stay inside the metal housing",
      );
      assert.equal(layout.tickCount, 20);
      assert.ok(
        layout.combatBounds.every(
          ([top, bottom]) => top >= 0.25 && bottom <= 0.75,
        ),
        "combat stays inside the central floor",
      );
      assert.ok(
        layout.textWidth < layout.buttonWidth * 0.72,
        "Confirmar fits the blue orb at " + width,
      );
      assert.equal(layout.overflow, false);
    }
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.screenshot({
      path: path.resolve(__dirname, "../test-results/tabuleiro-v19.png"),
    });
    await page.locator("#pass").click();
    await page.waitForSelector("#duel-ending");
    assert.equal(
      await page.locator("#result-dialog").evaluate((e) => e.open),
      false,
      "result waits for Nexus break",
    );
    assert.equal(await page.locator(".outcome-shard").count(), 14);
    const fallenId = owner === 0 ? "enemy-nexus" : "my-nexus";
    assert.equal(await page.locator(`#${fallenId}.nexus-fallen`).count(), 1);
    assert.equal(
      await page.locator(".outcome-shockwave").count(),
      2,
      "two shockwaves expand from the defeated Nexus",
    );
    const waveCenter = await page.locator(".outcome-shockwave").first().evaluate((el) => [
      parseFloat(el.style.left), parseFloat(el.style.top),
    ]);
    const gemBox = await page.locator(`#${fallenId} canvas`).boundingBox();
    assert.ok(Math.abs(waveCenter[0] - gemBox.x - gemBox.width / 2) < 1);
    assert.ok(Math.abs(waveCenter[1] - gemBox.y - gemBox.height / 2) < 1);
    assert.equal(
      await page.evaluate(() => ArenaAmbient.running),
      false,
      "scenery stops when the duel ends",
    );
    assert.ok(
      await page
        .locator(".outcome-shard")
        .first()
        .evaluate((c) => {
          const pixels = c
            .getContext("2d")
            .getImageData(0, 0, c.width, c.height).data;
          let painted = 0;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) painted++;
          return painted > 1000;
        }),
      "fragments contain the original rendered gem pixels",
    );
    if (owner === 0) {
      await page.evaluate(() => {
        document
          .getElementById("duel-ending")
          .getAnimations({ subtree: true })
          .forEach((a) => {
            a.pause();
            a.currentTime = 900;
          });
      });
      await page.screenshot({
        path: path.resolve(__dirname, "../test-results/nexus-ruptura-v19.png"),
      });
      await page.evaluate(() =>
        document
          .getElementById("duel-ending")
          .getAnimations({ subtree: true })
          .forEach((a) => a.play()),
      );
    }
    assert.equal(await page.evaluate(() => state.winner), owner);
    await page.waitForFunction(
      () => document.getElementById("result-dialog").open,
    );
    await page.waitForFunction(
      () =>
        !document
          .getElementById("result-dialog")
          .getAnimations({ subtree: true })
          .some((a) => a.playState === "running"),
    );
    assert.equal(
      await page.locator("#result-title").textContent(),
      owner === 0 ? "Vitória" : "Derrota",
    );
    assert.equal(await page.locator("#duel-ending").count(), 0);
    await page.screenshot({
      path: path.resolve(
        __dirname,
        `../test-results/${owner ? "derrota" : "vitoria"}-v19.png`,
      ),
    });
    assert.deepEqual(await page.evaluate(() => outcomes), [
      "nexus-break",
      "result",
    ]);
    for (const [width, height] of [[320, 600], [800, 450]]) {
      await page.setViewportSize({ width, height });
      assert.equal(await page.locator("#result-dialog").evaluate((el) => el.scrollWidth > el.clientWidth), false);
      await page.locator("#view-result").scrollIntoViewIfNeeded();
      assert.equal(await page.locator("#view-result").isVisible(), true);
    }
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.locator("#view-result").click();
    await page.evaluate(() => schedule());
    assert.equal(
      await page.locator("#result-dialog").evaluate((e) => e.open),
      false,
      "view field stays dismissed",
    );
    await page.locator("#menu").click();
    await page.locator("#train").click();
    assert.equal(await page.locator(".nexus-fallen").count(), 0);
    assert.equal(await page.evaluate(() => state.winner), null);
    await context.close();
  }
  for (const [reduced, off] of [
    ["reduce", false],
    ["no-preference", true],
  ]) {
    const { page, context } = await open(fixture(0), reduced, off);
    await page.locator("#pass").click();
    await page.waitForFunction(
      () => document.getElementById("result-dialog").open,
    );
    assert.deepEqual(await page.evaluate(() => outcomes), ["result"]);
    assert.equal(await page.locator(".outcome-shard").count(), 0);
    await context.close();
  }
  for (const action of ["escape", "skip", "menu", "motion-off", "reduced-motion", "again"]) {
    const { page, context } = await open(fixture(1));
    await page.locator("#pass").click();
    await page.waitForSelector("#duel-ending");
    if (action === "escape") await page.keyboard.press("Escape");
    if (action === "skip") await page.locator(".outcome-skip").click();
    if (action === "motion-off") await page.locator("#motion-toggle").click();
    if (action === "reduced-motion") await page.emulateMedia({ reducedMotion: "reduce" });
    if (action === "menu") {
      await page.locator("#menu").click();
      await page.waitForTimeout(2100);
      assert.equal(
        await page.locator("#result-dialog").evaluate((e) => e.open),
        false,
        "menu cancellation cannot open stale result",
      );
    } else
      await page.waitForFunction(
        () => document.getElementById("result-dialog").open,
      );
    assert.equal(await page.locator("#duel-ending").count(), 0);
    if (action === "again") {
      await page.locator("#again").click();
      assert.equal(
        await page.locator("#result-dialog").evaluate((e) => e.open),
        false,
      );
      assert.equal(await page.evaluate(() => state.winner), null);
      assert.equal(await page.locator(".nexus-fallen").count(), 0);
    }
    await context.close();
  }
  const draw = fixture(0);
  draw.winner = "draw";
  draw.phase = "over";
  draw.players.forEach((p) => (p.nexus = 0));
  const animatedDraw = await open(draw);
  await animatedDraw.page.waitForSelector("#duel-ending");
  assert.equal(await animatedDraw.page.locator(".nexus-fallen").count(), 2);
  assert.equal(await animatedDraw.page.locator(".outcome-shard").count(), 28);
  assert.equal(await animatedDraw.page.locator(".outcome-shockwave").count(), 4);
  await animatedDraw.page.locator(".outcome-skip").click();
  await animatedDraw.page.waitForFunction(() => document.getElementById("result-dialog").open);
  assert.equal(await animatedDraw.page.locator("#result-title").textContent(), "Empate");
  await animatedDraw.context.close();
  const { page, context } = await open(draw, "reduce");
  await page.waitForFunction(
    () => document.getElementById("result-dialog").open,
  );
  assert.equal(await page.locator("#result-title").textContent(), "Empate");
  assert.match(await page.locator("#result-copy").textContent(), /dois Nexus/);
  for (const [width, height] of [
    [320, 600],
    [800, 450],
  ]) {
    await page.setViewportSize({ width, height });
    // Dynamic viewport units settle on the next rendering frame after resize.
    await page.evaluate(() => new Promise(requestAnimationFrame));
    const box = await page.locator("#result-dialog").boundingBox();
    assert.ok(
      box.x >= 0 &&
        box.y >= 0 &&
        box.x + box.width <= width &&
        box.y + box.height <= height,
      "result stays inside small and landscape viewports: " + JSON.stringify({ width, height, box }),
    );
    await page.locator("#view-result").scrollIntoViewIfNeeded();
    assert.equal(await page.locator("#view-result").isVisible(), true);
    assert.equal(await page.locator("#result-dialog").evaluate((el) => el.scrollWidth > el.clientWidth), false);
  }
  await context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: mana dentro da moldura, centro comum/5 larguras, texto no orbe; vitória/derrota reais, empate, pular/Escape/menu, efeitos desligados e movimento reduzido; offline.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
