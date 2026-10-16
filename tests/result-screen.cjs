const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const [winner, label] of [[0, 'vitoria'], [1, 'derrota'], ['draw', 'empate']]) {
      const context = await browser.newContext({ offline: true, reducedMotion: 'no-preference', viewport: { width: 1440, height: 900 } });
      const page = await context.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
      await page.locator('#choose-duel').click();
      await page.locator('#start').click();
      await page.locator('#confirm-opening').click();
      await page.evaluate(winner => {
        clearTimeout(timer); state.round = 16; state.winner = winner; state.phase = 'over'; render();
        window.resultFinished = finish();
      }, winner);
      await page.locator('#duel-ending').waitFor();
      await page.waitForFunction(() => document.querySelector('.outcome-native-nexus canvas')?.dataset.progress);
      assert.equal(await page.locator('.outcome-native-nexus canvas').count(), winner==='draw'?2:1);
      const fractureClip=await page.locator('.outcome-native-nexus canvas').first().getAttribute('data-clip');
      assert.equal(fractureClip,winner===1||winner==='draw'?'7916038429985625360':'-6811966665724754187');
      if (winner === 'draw') await page.locator('.outcome-skip').click();
      await page.locator('#result-dialog').waitFor({ state: 'visible' });
      await page.waitForFunction(() => document.querySelector('#result-native-art canvas')?.dataset.progress==='1');
      assert.equal(await page.locator('#result-native-art').getAttribute('data-renderer'),'native-webgl');
      assert.equal(await page.locator('#result-native-art canvas').getAttribute('data-clip'),'-2335169206498055647');
      assert.equal(await page.locator('#result-dialog').getAttribute('data-outcome'), winner === 0 ? 'victory' : winner === 1 ? 'defeat' : 'draw');
      // The source rig has finished; supporting text can still be settling.
      await page.evaluate(() => Promise.all(document.getElementById('result-dialog').getAnimations({ subtree: true }).map(a => a.finished.catch(() => {}))));
      for (const [width, height] of [[1440, 900], [390, 844], [320, 600], [800, 450]]) {
        await page.setViewportSize({ width, height });
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const layout = await page.locator('#result-dialog').evaluate(el => ({ width: el.clientWidth, scroll: el.scrollWidth, box: el.getBoundingClientRect().toJSON() }));
        assert.ok(layout.box.x >= 0 && layout.box.y >= 0 && layout.box.right <= width && layout.box.bottom <= height);
        assert.equal(layout.scroll <= layout.width, true, JSON.stringify({ label, width, layout }));
        await page.locator('#view-result').scrollIntoViewIfNeeded();
        assert.equal(await page.locator('#view-result').isVisible(), true);
        if (width === 1440 || width === 390) await page.screenshot({ path: path.resolve(__dirname, `../test-results/result-${label}-${width}.png`) });
      }
      await page.locator('#view-result').click();
      assert.equal(await page.locator('#result-dialog').isVisible(), false);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.evaluate(() => { document.getElementById('result-dialog').showModal(); DuelOutcome.reveal(document.getElementById('result-dialog'), state.winner); });
      assert.equal(await page.locator('#result-dialog').evaluate(el => el.getAnimations({ subtree: true }).length), 0);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#result-dialog').isVisible(), false);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(async () => {
        ArenaMotion.toggle(); await DuelOutcome.play(state);
        document.getElementById('result-dialog').showModal(); DuelOutcome.reveal(document.getElementById('result-dialog'), state.winner);
      });
      assert.equal(await page.locator('#duel-ending').count(), 0);
      assert.equal(await page.evaluate(() => ArenaMotion.enabled), false);
      assert.equal(await page.locator('#result-dialog').evaluate(el => el.getAnimations({ subtree: true }).filter(a => !(a instanceof CSSTransition)).length), 0);
      await page.locator('#again').click();
      assert.equal(await page.evaluate(() => state.winner), null);
      assert.equal(await page.locator('.nexus-fallen').count(), 0);
      await page.evaluate(() => {
        ArenaMotion.toggle(); clearTimeout(timer); state.round = 16; state.winner = 0; state.phase = 'over'; render();
        window.resultFinished = finish();
      });
      await page.locator('#duel-ending').waitFor();
      await page.locator('#menu').click();
      await page.evaluate(() => resultFinished);
      assert.equal(await page.locator('#result-dialog').isVisible(), false, 'leaving during the sequence cannot reopen an old result');
      assert.deepEqual(errors, []);
      await context.close();
    }
    const fallbackContext=await browser.newContext({offline:true,reducedMotion:'reduce'});
    await fallbackContext.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl'||type==='webgl2'?null:original.call(this,type,...args);};
    });
    const fallbackPage=await fallbackContext.newPage();
    await fallbackPage.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await fallbackPage.evaluate(()=>{document.getElementById('result-dialog').showModal();DuelOutcome.reveal(document.getElementById('result-dialog'),0);});
    await fallbackPage.locator('.result-native-fallback').evaluate(img=>img.decode());
    assert.equal(await fallbackPage.locator('#result-native-art').getAttribute('data-renderer'),'fallback');
    assert.equal(await fallbackPage.locator('.result-native-fallback').evaluate(img=>img.naturalWidth),1200);
    await fallbackContext.close();
    console.log('PASS: animated victory, defeat and draw; skip, view field, Escape, effects off, reduced motion, rematch, menu cancellation and four result layouts.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
