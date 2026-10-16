const { selectMatchSetting } = require("./welcome-helpers.cjs");
const { chromium } = require("playwright"),
  fs = require("node:fs"),
  path = require("node:path"),
  vm = require("node:vm"),
  assert = require("node:assert/strict"),
  E = require("../engine.js");
const ctx = { window: {} };
vm.runInNewContext(
  fs.readFileSync(require.resolve("../cards.js"), "utf8"),
  ctx,
);
const data = JSON.parse(JSON.stringify(ctx.window.CARD_DATA));
const url =
  "file:///" + path.resolve(__dirname, "../index.html").replaceAll("\\", "/");
function fixture(owner = 1) {
  const s = E.create(data.cards, data.decks.demacia, data.decks.noxus, 3, {
    faithful: true,
    skipMulligan: true,
  });
  const make = (code) => ({
    ...structuredClone(data.cards[code]),
    id: "c" + s.nextId++,
    maxHealth: data.cards[code].health,
  });
  s.arenaThemes = ["rift", "rift"];
  s.players[0].board = Array.from({ length: 6 }, () => make("01DE046"));
  s.players[1].board = Array.from({ length: 6 }, () => make("01NX037"));
  s.attackTokens = [owner === 0, owner === 1];
  s.priority = owner;
  E.attack(
    s,
    owner,
    s.players[owner].board.map((c) => c.id),
  );
  return s;
}
(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" }),
    context = await browser.newContext({
      offline: true,
      reducedMotion: "no-preference",
      viewport: { width: 1600, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [],
    remote = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) remote.push(r.url());
  });
  await page.goto(url);
  assert.equal(await page.locator("#arena-choice option").count(), 13);
  await page.locator("#opponent").selectOption("noxus");
  await page.locator("#start").click();
  assert.deepEqual(await page.evaluate(() => state.arenaThemes), [
    "demacia",
    "noxus",
  ]);
  await page.locator("#menu").click();
  for (const key of [
    "rift",
    "demacia",
    "noxus",
    "ionia",
    "freljord",
    "piltover",
    "bilgewater",
    "shadowisles",
    "shurima",
    "targon",
    "bandlecity",
    "zaun",
  ]) {
    await selectMatchSetting(page, "#arena-choice", key);
    await page.locator("#start").click();
    assert.deepEqual(await page.evaluate(() => state.arenaThemes), [key, key]);
    assert.equal(
      await page.locator("#arena-local-surface").getAttribute("data-theme"),
      key,
    );
    await page.locator("#menu").click();
  }
  await page.reload();
  assert.equal(await page.locator("#arena-choice").inputValue(), "zaun");
  await selectMatchSetting(page, "#arena-choice", "rift");
  // Load a reproducible combat through the real save/resume UI.
  const s = fixture();
  await page.evaluate(
    (s) => localStorage.setItem("runeterra-mesa-v1", JSON.stringify(s)),
    s,
  );
  await page.reload();
  await page.locator("#resume").click();
  for (let i = 0; i < 6; i++) {
    const ally = page.locator("#my-board .card").nth(i),
      attacker = page.locator("#enemy-board .card").nth(i);
    const before = await attacker.boundingBox();
    await attacker.hover();
    const after = await attacker.boundingBox();
    assert.ok(
      Math.abs(before.x - after.x) < 1 && Math.abs(before.y - after.y) < 1,
      "hover must preserve lane",
    );
    await ally.click();
    await attacker.click();
    assert.equal(
      await page.locator('#my-board [data-combat-role="block"]').count(),
      i + 1,
    );
    await page.waitForFunction(
      () =>
        !document
          .getAnimations()
          .some(
            (a) =>
              a.playState === "running" && a.effect?.target?.closest(".board"),
          ),
    );
    const a = await attacker.boundingBox(),
      b = await ally.boundingBox();
    assert.ok(
      Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 1,
      "paired card centers align",
    );
    assert.ok(a.width > a.height, "combat card must be horizontal");
    assert.ok(
      await page.evaluate(() => {
        const arena = document.querySelector(".arena").getBoundingClientRect();
        return [...document.querySelectorAll("#combat-links path")].every(
          (path, index) => {
            const id = Object.keys(blocks)[index],
              target = blocks[id];
            const a = document
                .querySelector(`.board [data-id="${id}"]`)
                .getBoundingClientRect(),
              b = document
                .querySelector(`.board [data-id="${target}"]`)
                .getBoundingClientRect();
            const numbers = path
              .getAttribute("d")
              .match(/-?\d+(?:\.\d+)?/g)
              .map(Number);
            return (
              Math.abs(numbers[0] - (a.x + a.width / 2 - arena.x)) < 1 &&
              Math.abs(numbers[1] - (a.y + a.height / 2 - arena.y)) < 1 &&
              Math.abs(numbers[2] - (b.x + b.width / 2 - arena.x)) < 1 &&
              Math.abs(numbers[3] - (b.y + b.height / 2 - arena.y)) < 1
            );
          },
        );
      }),
      "links follow the final animated positions",
    );
  }
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: path.resolve(
      __dirname,
      "../test-results/arena-floresta-defesa-v11.png",
    ),
  });
  for (const width of [320, 390, 768, 1440, 1600]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.evaluate(
      () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        ),
    );
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      "page overflow " + width,
    );
    const bounds = await page
      .locator(".board .card")
      .evaluateAll((es) => es.map((e) => e.getBoundingClientRect().toJSON()));
    assert.ok(
      bounds.every((r) => r.x >= 0 && r.right <= width),
      "cards outside " + width,
    );
    if (width === 390)
      await page.screenshot({
        path: path.resolve(__dirname, "../test-results/arena-mobile-v11.png"),
      });
  }
  await page.locator("#pass").click();
  await page.waitForFunction(() => !busy);
  assert.equal(await page.evaluate(() => state.phase), "response");
  await page.locator("#menu").click();
  await page.locator("#resume").click();
  assert.deepEqual(await page.evaluate(() => state.arenaThemes), [
    "rift",
    "rift",
  ]);
  assert.deepEqual(errors, []);
  assert.deepEqual(remote, []);
  await browser.close();
  console.log(
    "PASS: doze arenas, automático por deck, escolha persistida, retomada, seis bloqueios reais, hover estável, pares alinhados e cinco larguras; offline sem erros.",
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
