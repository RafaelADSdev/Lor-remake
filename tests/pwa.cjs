const { chromium, webkit, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
let originAvailable = true;
let activeDownloads = 0, maxDownloads = 0;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webp': 'image/webp' };
const server = http.createServer((req, res) => {
  if (!originAvailable) return req.socket.destroy();
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/arena\//, '');
  const file = path.resolve(root, name || 'index.html');
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end();
    if (req.headers['x-pwa-artwork']) {
      maxDownloads = Math.max(maxDownloads, ++activeDownloads);
      res.on('close', () => activeDownloads--);
    }
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});
(async () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest')));
  assert.equal(manifest.display, 'standalone');
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/arena/`;
  for (const [name, engine, device] of [['android', chromium, devices['Pixel 7']], ['webkit-iphone', webkit, devices['iPhone 13']]]) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    const browser = await engine.launch({ ...(engine === chromium ? { channel: 'chrome' } : {}), headless: true });
    try {
      const context = await browser.newContext({ ...device, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await page.addInitScript(() => (Date.now = () => 123));
      fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(url);
      await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 120000 });
      await page.waitForFunction(() => document.querySelector('#pwa-status').textContent.includes('pronto'));
      assert.equal(await page.locator('#arena-renderer').inputValue(), 'light');
      for (const width of [320, 390, 768, 844]) {
        await page.setViewportSize({ width, height: width === 844 ? 390 : 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `Overflow ${name} ${width}`);
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.locator('#pwa-panel summary').click();
      assert.equal(await page.locator('#pwa-install-help').isVisible(), true);
      if (name === 'android') {
        const started = Date.now();
        await page.locator('#pwa-download').click();
        await page.waitForFunction(() => document.querySelector('#pwa-progress').value >= 3);
        await page.locator('#pwa-cancel').click();
        await page.waitForFunction(() => document.querySelector('#pwa-download-status').textContent.includes('pausado'));
        await page.locator('#pwa-download').click();
        await page.waitForFunction(() => document.querySelector('#pwa-download-status').textContent.includes('todas'), null, { timeout: 120000 });
        assert.ok(maxDownloads >= 2 && maxDownloads <= 4, 'artwork downloads use bounded parallel requests');
        console.log(`Artwork download: ${((Date.now() - started) / 1000).toFixed(1)} seconds; up to ${maxDownloads} concurrent requests.`);
      }
      await page.screenshot({ path: path.join(root, `test-results/pwa-${name}.png`), fullPage: true });
      // Playwright WebKit rejects SW navigations with setOffline(true): #42775.
      // Cutting the origin connection verifies real cache responses in that engine.
      if (engine === webkit) originAvailable = false;
      else await context.setOffline(true);
      await page.reload();
      await page.locator('#open-campaign').click();
      assert.equal(await page.locator('.campaign-destinations button').count(), 10);
      for (const id of ['demacia', 'noxus', 'freljord', 'ionia', 'piltover-zaun', 'bilgewater', 'shurima', 'targon', 'ixtal', 'shadow-isles']) {
        await page.locator(`.campaign-destinations [data-region="${id}"]`).click();
        assert.equal(await page.locator(`[data-encounter="${id}-patrol"]`).isEnabled(), true);
        await page.locator('.campaign-region-hero > img').evaluate(image => image.decode());
        assert.equal(await page.locator('.campaign-territory.is-active').getAttribute('data-region'), id, 'frontier geometry is available offline');
      }
      const allSymbolsLoaded = await page.locator('#campaign .campaign-region-symbol').evaluateAll(async images => {
        await Promise.all(images.map(image => image.decode()));
        return images.length === 21 && images.every(image => image.naturalWidth > 0);
      });
      assert.equal(allSymbolsLoaded, true, 'ten map emblems, ten destination emblems and panel emblem work on first offline visit');
      await page.locator('.campaign-destinations [data-region="demacia"]').click();
      assert.equal(await page.locator('.campaign-route-map button').count(), 7);
      await page.locator('[data-encounter="demacia-patrol"]').click();
      assert.equal(await page.evaluate(() => state.campaign.encounterId), 'demacia-patrol');
      await page.locator('#confirm-opening').click();
      // A prepared result verifies PWA persistence/rewards, not deck balance.
      await page.evaluate(async () => {
        clearTimeout(timer); state.round = 6; state.players[1].nexus = 0;
        state.winner = 0; state.phase = 'over'; render(); save(); await finish();
      });
      await page.locator('#result-dialog').waitFor({ state: 'visible' });
      assert.match(await page.locator('#campaign-result').textContent(), /40 XP/);
      await page.locator('#campaign-return').click();
      await page.goto(url + '?mode=campaign');
      await page.locator('#campaign').waitFor({ state: 'visible' });
      assert.equal(await page.locator('[data-route="demacia-patrol"]').getAttribute('data-completed'), 'true');
      assert.equal(await page.locator('[data-encounter="demacia-road"]').isEnabled(), true);
      await page.locator('#campaign-close').click();
      // Keep the ordinary home as the launch URL for the free-duel regression.
      await page.goto(url);
      if (!(await page.locator('#start').isVisible())) await page.locator('#choose-duel').click();
      await page.locator('#start').click();
      assert.equal(await page.locator('#opening-cards button').count(), 4);
      await page.locator('#confirm-opening').click();
      await page.waitForFunction(() => !busy && state.priority === 0 && !document.body.classList.contains('choosing-hand'));
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.querySelectorAll('.arena img[src]')]
        .filter(img => img.getClientRects().length)
        .every(img => img.complete && img.naturalWidth > 0));
      if (name === 'android') assert.equal(await page.locator('#my-hand .art-unavailable').count(), 0);
      else {
        const fallback = page.locator('#my-hand .art-unavailable').first();
        assert.ok(await fallback.count());
        await fallback.locator('.card-name').waitFor({ state: 'visible', timeout: 10000 });
        assert.equal(await fallback.locator('.cost').isVisible(), true);
      }
      const card = page.locator('#my-hand .card:enabled').filter({ has: page.locator('.power') }).first();
      assert.ok(await card.count(), 'Opening hand should include a playable unit');
      {
        const id = await card.getAttribute('data-id');
        await card.tap();
        try {
          await page.waitForFunction(id => state.players[0].board.some(c => c.id === id), id, { timeout: 10000 });
        } catch (error) {
          await page.screenshot({ path: path.join(root, `test-results/pwa-${name}-touch-failure.png`), fullPage: true });
          console.log(await page.evaluate(() => ({ mode, busy, phase: state.phase, priority: state.priority, spell: spell?.name })));
          throw error;
        }
      }
      await page.screenshot({ path: path.join(root, `test-results/pwa-${name}-duel.png`), fullPage: true, animations: 'disabled' });
      assert.ok((await page.locator('.arena').boundingBox()).height >= 500);
      // Reopening offline must retain the saved duel.
      await page.reload();
      if (!(await page.locator('#resume').isVisible())) await page.locator('#choose-duel').click();
      await page.locator('#resume').click();
      assert.equal(await page.locator('#game').isVisible(), true);
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${name}: scoped install, all ten campaign symbols/chapters offline, touch, save and responsive checks passed`);
    } finally { await browser.close(); }
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
