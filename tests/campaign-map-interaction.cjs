const { chromium, webkit, devices } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const http = require('node:http'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1742, height: 1178 }, offline: true });
    const page = await context.newPage();
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    await page.locator('#open-campaign').click();
    await page.locator('#campaign .campaign-region-symbol').evaluateAll(images => Promise.all(images.map(img => img.decode())));
    const shadows = page.locator('.campaign-pin[data-region="shadow-isles"] .campaign-pin-label');
    const shadowsRect = await shadows.boundingBox();
    const shadowsPoint = { x: shadowsRect.x + shadowsRect.width / 2, y: shadowsRect.y + shadowsRect.height / 2 };
    assert.equal(await page.evaluate(({ x, y }) => document.elementFromPoint(x, y).closest('[data-region]')?.dataset.region, shadowsPoint), 'shadow-isles', 'map controls do not cover the regional label');
    const initialTransform = await page.locator('#campaign-world').evaluate(el => el.style.transform);
    await page.mouse.click(shadowsPoint.x, shadowsPoint.y);
    assert.equal(await page.locator('.campaign-pin[data-region="shadow-isles"]').getAttribute('aria-pressed'), 'true', 'clicking the regional label selects Shadow Isles');
    assert.equal(await page.locator('#campaign-world').evaluate(el => el.style.transform), initialTransform, 'clicking a region never recenters the map');
    const ids = await page.locator('.campaign-pin').evaluateAll(pins => pins.map(pin => pin.dataset.region));
    for (const id of ids) {
      const pin = page.locator(`.campaign-pin[data-region="${id}"]`);
      const before = await pin.locator('.campaign-pin-mark').boundingBox();
      const labelBefore = await pin.locator('.campaign-pin-label').boundingBox();
      const center = { x: before.x + before.width / 2, y: before.y + before.height / 2 };
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      await page.waitForTimeout(200);
      const held = await pin.locator('.campaign-pin-mark').boundingBox();
      const labelHeld = await pin.locator('.campaign-pin-label').boundingBox();
      assert.ok(Math.abs(held.x - before.x) < .5 && Math.abs(held.y - before.y) < .5, id + ' emblem stays anchored while the mouse is held down');
      assert.ok(Math.abs(labelHeld.x - labelBefore.x) < .5 && Math.abs(labelHeld.y - labelBefore.y) < .5, id + ' name stays anchored while the mouse is held down');
      await page.mouse.move(center.x + 2, center.y + 1);
      await page.mouse.up();
      assert.equal(await pin.getAttribute('aria-pressed'), 'true', id + ' emblem selects despite a small hand movement');
      const released = await pin.locator('.campaign-pin-mark').boundingBox();
      assert.ok(Math.abs(released.x - before.x) < .5 && Math.abs(released.y - before.y) < .5, id + ' emblem stays anchored after selection');
      assert.equal(await page.locator('#campaign-world').evaluate(el => el.style.transform), initialTransform, id + ' selection keeps the map stationary');
    }
    const map = await page.locator('#campaign-map').boundingBox();
    await page.mouse.move(map.x + 20, map.y + 20); await page.mouse.down();
    await page.mouse.move(map.x + 84, map.y + 60, { steps: 8 }); await page.mouse.up();
    assert.notEqual(await page.locator('#campaign-world').evaluate(el => el.style.transform), initialTransform, 'empty background still drags');
    assert.equal(await page.locator('.campaign-pin[data-region="shadow-isles"]').getAttribute('aria-pressed'), 'true', 'drag does not select a different region');
    await page.locator('#campaign-zoom-reset').click();
    assert.equal(await page.locator('#campaign-world').evaluate(el => el.style.transform), initialTransform, 'explicit recenter button still works');
    await page.locator('#campaign-zoom-in').click();
    assert.match(await page.locator('#campaign-world').evaluate(el => el.style.transform), /scale\(1.25\)/);
    await page.locator('#campaign-zoom-reset').click();
    await page.locator('.campaign-pin[data-region="noxus"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.campaign-pin[data-region="noxus"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#campaign-world').evaluate(el => el.style.transform), initialTransform, 'keyboard selection does not move the map');
    await page.screenshot({ path: path.join(root, 'test-results/campaign-map-click-fixed.png') });
    await context.close();
    console.log('PASS: all ten emblems select without panning; covered label, small pointer movements, keyboard, background dragging and toolbar verified.');
  } finally { await browser.close(); }
  const mime = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
  const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    fs.stat(file, (error, stat) => {
      if (error || !stat.isFile()) return res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const touchBrowser = await webkit.launch({ headless: true });
  try {
    const context = await touchBrowser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.locator('#open-campaign').tap();
    for (const id of ['noxus', 'shadow-isles']) {
      await page.locator(`.campaign-destinations [data-region="${id}"]`).tap();
      const other = await page.locator('.campaign-pin').evaluateAll((pins, target) => {
        const bounds = document.getElementById('campaign-map').getBoundingClientRect();
        return pins.find(pin => {
          const r = pin.getBoundingClientRect();
          return pin.dataset.region !== target && r.left > bounds.left && r.right < bounds.right && r.top > bounds.top && r.bottom < bounds.bottom;
        })?.dataset.region;
      }, id);
      assert.ok(other, 'a neighboring emblem is visible');
      await page.locator(`.campaign-pin[data-region="${other}"] .campaign-pin-mark`).tap();
      const transform = await page.locator('#campaign-world').evaluate(el => el.style.transform);
      await page.locator(`.campaign-pin[data-region="${id}"] .campaign-pin-mark`).tap();
      assert.equal(await page.locator(`.campaign-pin[data-region="${id}"]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#campaign-world').evaluate(el => el.style.transform), transform, 'touch does not pan when selecting a symbol');
    }
    await context.close();
    console.log('PASS: WebKit iPhone emblem taps keep the map stationary.');
  } finally { await touchBrowser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
