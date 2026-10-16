/* Template compiled by build_pwa.py. No forced activation during a duel. */
'use strict';
const VERSION = __CORE_VERSION__;
const CORE = __CORE_FILES__;
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
    // Limit concurrent downloads on mobile; fail the installation if incomplete.
    let cursor = 0;
    await Promise.all(Array.from({ length: 4 }, async () => {
      while (cursor < CORE.length) {
        const url = new URL(CORE[cursor++], base);
        const response = await fetch(url, { cache: 'reload' });
        if (!response.ok) throw Error(`Offline resource unavailable: ${url.pathname}`);
        await cache.put(url, response);
      }
    }));
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
  const network = (async () => {
    const art = await caches.open(artName);
    const runtime = await caches.open(runtimeName);
    const cached = await art.match(request) || await runtime.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && response.status === 200) return response;
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
    if (response.ok && bytes > 0 && bytes <= 2 * 1048576)
      return remember(request, response);
  }).catch(() => {}));
});
