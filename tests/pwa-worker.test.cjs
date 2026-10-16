const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const prefix = 'lor-pwa-%2Farena%2F-';
const origin = 'https://example.test/arena/';
class MemoryCache {
  entries = new Map();
  key(request) { return new URL(typeof request === 'string' ? request : request.url || request.href, origin).href; }
  async put(request, response) { this.entries.set(this.key(request), response.clone()); }
  async match(request) { return this.entries.get(this.key(request))?.clone(); }
  async keys() { return [...this.entries.keys()].map(url => new Request(url)); }
  async delete(request) { return this.entries.delete(this.key(request)); }
}
async function fixture(fail = false) {
  const stores = new Map(), handlers = {}, fetched = [], messages = [];
  const caches = {
    async open(name) { if (!stores.has(name)) stores.set(name, new MemoryCache()); return stores.get(name); },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  const old = await caches.open(prefix + 'core-old');
  await old.put(origin + 'index.html', new Response('previous HTML'));
  await old.put(origin + 'engine.js', new Response('unchanged engine'));
  await old.put(origin + '__pwa__/core-revisions.json', Response.json({ 'index.html': 'old', 'engine.js': 'same' }));
  const source = fs.readFileSync(require.resolve('../tools/pwa-worker.js'), 'utf8')
    .replace('__CORE_VERSION__', JSON.stringify('new'))
    .replace('__CORE_FILES__', JSON.stringify(['index.html', 'engine.js']))
    .replace('__CORE_REVISIONS__', JSON.stringify({ 'index.html': 'new', 'engine.js': 'same' }))
    .replace('__ART_VERSION__', JSON.stringify('art'));
  vm.runInNewContext(source, {
    URL, Request, Response, AbortController, caches,
    self: { location: { href: origin + 'sw.js' }, addEventListener(type, fn) { handlers[type] = fn; },
      clients: { async claim() {}, async matchAll() { return [{ url: origin, postMessage(value) { messages.push(value); } }]; } } },
    async fetch(url) { if (fail) throw Error('connection lost'); fetched.push(String(url)); return new Response('new HTML'); },
  });
  async function fire(type) { let work; handlers[type]({ waitUntil(promise) { work = promise; } }); await work; }
  async function request(url) {
    let response, work;
    handlers.fetch({ request: new Request(url), respondWith(promise) { response = promise; }, waitUntil(promise) { work = promise; } });
    const result = await response; await work; return result;
  }
  return { caches, fetched, messages, fire, request };
}
test('updates reuse unchanged core bytes and download only changed files', async () => {
  const f = await fixture();
  await f.fire('install');
  assert.deepEqual(f.fetched, [origin + 'index.html']);
  const current = await f.caches.open(prefix + 'core-new');
  assert.equal(await (await current.match(origin + 'engine.js')).text(), 'unchanged engine');
  assert.equal(await (await current.match(origin + 'index.html')).text(), 'new HTML');
  assert.ok(f.messages.some(message => message.completed === 2 && message.total === 2));
});
test('activation keeps the current artwork and unrelated apps caches', async () => {
  const f = await fixture();
  await f.caches.open('another-app');
  await f.caches.open(prefix + 'art-art');
  await f.fire('install'); await f.fire('activate');
  const names = await f.caches.keys();
  assert.ok(names.includes('another-app'));
  assert.ok(names.includes(prefix + 'art-art'));
  assert.ok(!names.includes(prefix + 'core-old'));
});
test('failed installation removes its partial core and retains the working release', async () => {
  const f = await fixture(true);
  await assert.rejects(f.fire('install'), /connection lost/);
  const names = await f.caches.keys();
  assert.ok(names.includes(prefix + 'core-old'));
  assert.ok(!names.includes(prefix + 'core-new'));
});
test('the original PWA without revision metadata upgrades with a complete download', async () => {
  const f = await fixture();
  await (await f.caches.open(prefix + 'core-old')).delete(origin + '__pwa__/core-revisions.json');
  await f.fire('install');
  assert.equal(f.fetched.length, 2);
});
test('an artwork cache hit is not copied into the automatic cache again', async () => {
  const f = await fixture();
  await (await f.caches.open(prefix + 'art-art')).put(origin + 'assets/card.png', new Response('image', { headers: { 'content-length': '5' } }));
  assert.equal(await (await f.request(origin + 'assets/card.png')).text(), 'image');
  assert.equal((await (await f.caches.open(prefix + 'runtime-new')).keys()).length, 0);
  assert.equal(f.fetched.length, 0);
});
