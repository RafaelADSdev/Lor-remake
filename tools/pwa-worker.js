/* Template compiled by build_pwa.py. No forced activation during a duel. */
'use strict';
const VERSION = __CORE_VERSION__;
const CORE = __CORE_FILES__;
const REVISIONS = __CORE_REVISIONS__;
const ART_VERSION = __ART_VERSION__;
const base = new URL('./', self.location.href);
const prefix = `lor-pwa-${encodeURIComponent(base.pathname)}-`;
const coreName = prefix + 'core-' + VERSION;
const runtimeName = prefix + 'runtime-' + VERSION;
const artName = prefix + 'art-' + ART_VERSION;
const corePaths = new Set(CORE.map(file => new URL(file, base).pathname));
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(coreName);
    const metadata = new URL('__pwa__/core-revisions.json', base);
    const names = (await caches.keys()).filter(name => name.startsWith(prefix + 'core-') && name !== coreName);
    const previous = names.length ? await caches.open(names[names.length - 1]) : null;
    const stored = previous && await previous.match(metadata);
    const oldRevisions = stored ? await stored.json().catch(() => ({})) : {};
    const controller = new AbortController();
    let cursor = 0, completed = 0;
    async function progress() {
      try {
        const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
        for (const client of clients)
          if (client.url.startsWith(base.href)) client.postMessage({ type: 'LOR_OFFLINE_PROGRESS', scope: base.pathname, completed, total: CORE.length });
      } catch {} // Closing the window cannot invalidate an otherwise complete cache.
    }
    const results = await Promise.allSettled(Array.from({ length: 4 }, async () => {
      try {
        while (cursor < CORE.length && !controller.signal.aborted) {
          const file = CORE[cursor++], url = new URL(file, base);
          const unchanged = previous && oldRevisions[file] === REVISIONS[file];
          const reused = unchanged && await previous.match(url);
          const response = reused || await fetch(url, { cache: 'reload', signal: controller.signal });
          if (!response.ok) throw Error(`Offline resource unavailable: ${url.pathname}`);
          await cache.put(url, response);
          completed++;
          if (completed % 5 === 0 || completed === CORE.length) await progress();
        }
      } catch (error) { controller.abort(); throw error; }
    }));
    const failure = results.find(result => result.status === 'rejected');
    if (failure) { await caches.delete(coreName); throw failure.reason; }
    await cache.put(metadata, Response.json(REVISIONS));
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([coreName, runtimeName, artName]);
    for (const key of await caches.keys())
      if (key.startsWith(prefix) && !keep.has(key)) await caches.delete(key);
    await self.clients.claim();
  })());
});
// Serialize writes so the automatic image cache stays bounded under concurrency.
let writes = Promise.resolve();
function remember(request, response) {
  const copy = response.clone();
  writes = writes.catch(() => {}).then(async () => {
    const cache = await caches.open(runtimeName);
    await cache.put(request, copy);
    const keys = await cache.keys();
    for (const key of keys.slice(0, Math.max(0, keys.length - 48))) await cache.delete(key);
  });
  return writes.catch(() => {}); // Quota errors must never break gameplay.
}
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  // Safari media uses byte ranges. Do not cache partial audio/video responses.
  if (request.headers.has('range') || ['audio', 'video'].includes(request.destination)) return;
  // The optional downloader writes its own persistent cache without duplication.
  if (request.headers.has('X-PWA-Artwork')) return;
  if (request.mode === 'navigate' || corePaths.has(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(coreName);
      const cached = await cache.match(request.mode === 'navigate' ? new URL('index.html', base) : request, { ignoreSearch: true });
      return cached || fetch(request);
    })());
    return;
  }
  if (!url.pathname.startsWith(new URL('assets/', base).pathname) || !/\.(png|webp|jpg|jpeg|svg)$/i.test(url.pathname)) return;
  let fetchedFromNetwork = false;
  const network = (async () => {
    const art = await caches.open(artName);
    const runtime = await caches.open(runtimeName);
    const cached = await art.match(request) || await runtime.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.status === 200) { fetchedFromNetwork = true; return response; }
      throw Error('Image unavailable');
    } catch {
      // Let the card view show its live name/cost/stats over the offline artwork.
      return new Response('', { status: 503, statusText: 'Image not saved offline' });
    }
  })();
  event.respondWith(network);
  // Register lifetime work synchronously, even when network/cache lookups await.
  event.waitUntil(network.then(response => {
    const bytes = Number(response.headers.get('content-length'));
    if (fetchedFromNetwork && response.ok && bytes > 0 && bytes <= 2 * 1048576)
      return remember(request, response);
  }).catch(() => {}));
});
