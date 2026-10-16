/* A synthetic component fixture; never opens the game or any user session. */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const game = path.resolve(__dirname, "..");
(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage();
    await page.route("**/*", (route) => route.abort());
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const css = ["style.css", "arena.css", "arena-themes.css", "welcome.css"]
      .map((f) => fs.readFileSync(path.join(game, f), "utf8"))
      .join("\n");
    await page.setContent(`<style>${css}</style><button id="motion-toggle" aria-pressed="true">Efeitos</button>
      <main><section id="welcome" class="welcome"><div class="welcome-lower">
      <details class="welcome-settings"><summary><span>Personalizar partida</span><svg class="settings-chevron"></svg></summary>
      <div class="welcome-settings-grid">
      <div><label>Arena</label><select id="arena-choice"><option value="piltover">Piltover</option><option value="ionia">Ionia</option></select></div>
      <div><label>Visual do campo</label><select id="arena-renderer"><option value="geometry">3D</option><option value="light">Leve</option></select></div>
      <div><label>Evolução de Garen</label><select id="champion-cinematic"><option value="portrait">Retrato</option><option value="video">Vídeo</option></select></div>
      <div class="arena-preview"><div style="width:150px;height:68px;background:#36585a"></div><div><strong>Prévia da arena</strong><p>Esta arena será usada nos dois lados da próxima partida.</p></div></div>
      </div></details></div></section></main>`);
    await page.addScriptTag({
      content: fs.readFileSync(
        path.join(game, "welcome-settings-motion.js"),
        "utf8",
      ),
    });
    const preview = page.locator(".arena-preview");
    const active = () =>
      preview.evaluate(
        (el) =>
          el.getAnimations().filter((a) => !("animationName" in a)).length,
      );
    await page.locator("summary").click();
    const opening = await page
      .locator(".welcome-settings-grid")
      .evaluate((el) =>
        el.getAnimations({ subtree: true }).map((a) => a.animationName),
      );
    assert.equal(opening.filter((name) => name === "welcome-arrive").length, 4);
    await page.waitForTimeout(480);
    await page.locator("#arena-choice").selectOption("ionia");
    assert.equal(await active(), 1);
    const before = await preview.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    await page.waitForTimeout(150);
    const after = await preview.evaluate(
      (el) => getComputedStyle(el).transform,
    );
    assert.notEqual(before, after);
    await page.locator("#arena-choice").selectOption("piltover");
    await page.locator("#arena-renderer").selectOption("light");
    await page.locator("#champion-cinematic").selectOption("video");
    assert.equal(
      await active(),
      1,
      "rapid changes replace the previous transition",
    );
    await page
      .locator("#motion-toggle")
      .evaluate((el) => el.setAttribute("aria-pressed", "false"));
    assert.equal(await active(), 0);
    await page.locator("#arena-choice").selectOption("ionia");
    assert.equal(await active(), 0);
    await page
      .locator("#motion-toggle")
      .evaluate((el) => el.setAttribute("aria-pressed", "true"));
    await page.locator("#arena-choice").selectOption("piltover");
    assert.equal(await active(), 1);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(60);
    assert.equal(await active(), 0);
    await page.locator("#arena-choice").selectOption("ionia");
    assert.equal(await active(), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator("#arena-choice").selectOption("piltover");
    await page.locator("summary").click();
    assert.equal(await active(), 0, "closing cancels the preview");
    await page.locator("summary").click();
    await page.locator("#arena-choice").selectOption("ionia");
    await page.locator("#welcome").evaluate((el) => {
      el.hidden = true;
    });
    assert.equal(await active(), 0, "leaving the lobby cancels the preview");
    await page.locator("#welcome").evaluate((el) => {
      el.hidden = false;
    });
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      );
    }
    console.log(
      "Abertura, mudança real da prévia, trocas rápidas, cancelamento, Efeitos e movimento reduzido aprovados em documento sintético.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
