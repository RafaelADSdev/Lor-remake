/* Isolated origin. A release fixture changes only the HTML revision. */
const { chromium, devices } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const core = JSON.parse(worker.match(/const CORE = (\[[\s\S]*?\]);/)[1]);
const revisions = JSON.parse(worker.match(/const REVISIONS = (\{[\s\S]*?\});/)[1]);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
let release = 'a', failCore = true, requests = [];
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/app\//, '') || 'index.html';
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (name === 'sw.js') {
    const updated = { ...revisions, 'index.html': release };
    const source = worker.replace(/const VERSION = "[^"]+";/, `const VERSION = "update-${release}";`)
      .replace(/const REVISIONS = \{[\s\S]*?\};/, 'const REVISIONS = ' + JSON.stringify(updated) + ';');
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Cache-Control': 'no-store' });
    return res.end(source);
  }
  if (failCore && name === 'engine.js' && req.headers['sec-fetch-dest'] === 'empty') return res.writeHead(503).end();
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) return res.writeHead(404).end();
    requests.push({ name, bytes: stat.size });
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/app/`;
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const context = await browser.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto(url);
    await page.locator('#pwa-panel summary').click();
    await page.locator('#pwa-retry').waitFor({ state: 'visible', timeout: 120000 });
    assert.equal(await page.evaluate(async () => (await caches.keys()).some(name => name.includes('core-update-a'))), false, 'failed installation leaves no partial core');
    failCore = false;
    await page.locator('#pwa-retry').click();
    await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#pwa-status').textContent.includes('prontos'), null, { timeout: 120000 });
    await page.evaluate(() => {
      window.updateSentinel = 'partida preservada';
      localStorage.setItem('runeterra-campaign-v1', JSON.stringify({ version: 1, completed: { 'demacia-patrol': { bestRound: 7 } } }));
    });
    release = 'b'; requests = [];
    await page.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
    let installed = false;
    for (let attempt = 0; attempt < 300 && !installed; attempt++) {
      installed = await page.evaluate(async () => {
        const registration = await navigator.serviceWorker.getRegistration();
        const cache = await caches.open('lor-pwa-%2Fapp%2F-core-update-b');
        return registration.waiting?.state === 'installed' && !!(await cache.match(new URL('__pwa__/core-revisions.json', location.href)));
      });
      if (!installed) await page.waitForTimeout(100);
    }
    assert.ok(installed, 'replacement core installed completely');
    assert.equal(await page.evaluate(() => window.updateSentinel), 'partida preservada', 'updates never force reload a running app');
    assert.deepEqual(requests.map(request => request.name), ['index.html']);
    const total = core.reduce((sum, file) => sum + fs.statSync(path.join(root, file.split('?')[0])).size, 0);
    console.log(`Core update: ${requests[0].bytes} bytes downloaded; ${total - requests[0].bytes} bytes reused.`);
    await page.close();
    const reopened = await context.newPage();
    await reopened.goto(url + '?mode=campaign');
    await reopened.locator('#campaign').waitFor({ state: 'visible' });
    assert.equal(await reopened.locator('[data-route="demacia-patrol"]').getAttribute('data-completed'), 'true');
    await context.close();
    console.log('PWA update: retry, atomic cache, incremental download, pending activation and campaign save passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
