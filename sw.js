/* Template compiled by build_pwa.py. No forced activation during a duel. */
'use strict';
const VERSION = "a9a1aa639e8a";
const CORE = [
  "animation-gallery.css?v=0.29",
  "animation-gallery.js?v=0.29",
  "app.js?v=0.29",
  "arena-ambient-data.js",
  "arena-ambient.css?v=0.20",
  "arena-ambient.js",
  "arena-backdrop.js?v=0.25",
  "arena-chrome.js?v=3",
  "arena-hud.js?v=0.29",
  "arena-scene.css?v=0.25",
  "arena-scene.js?v=0.18",
  "arena-themes.css",
  "arena-view.js?v=0.23",
  "arena.css",
  "assets/01DE012.png",
  "assets/01DE028.png",
  "assets/arena-v2.png",
  "assets/arenas/action-button.png",
  "assets/arenas/action-frame.svg",
  "assets/arenas/backgrounds/bandlecity.js",
  "assets/arenas/backgrounds/bilgewater.js",
  "assets/arenas/backgrounds/demacia.js",
  "assets/arenas/backgrounds/freljord.js",
  "assets/arenas/backgrounds/ionia.js",
  "assets/arenas/backgrounds/noxus.js",
  "assets/arenas/backgrounds/piltover.js",
  "assets/arenas/backgrounds/rift.js",
  "assets/arenas/backgrounds/shadowisles.js",
  "assets/arenas/backgrounds/shurima.js",
  "assets/arenas/backgrounds/targon.js",
  "assets/arenas/backgrounds/zaun.js",
  "assets/arenas/cardback.png",
  "assets/arenas/hud/mana-pips.js",
  "assets/arenas/hud/sprites.js",
  "assets/arenas/nexus-health-frame.svg",
  "assets/arenas/token/blade.png",
  "assets/arenas/token/defense-shield.png",
  "assets/arenas/token/defense.png",
  "assets/arenas/token/flame.png",
  "assets/arenas/token/initiative.png",
  "assets/arenas/token/shard1.png",
  "assets/arenas/token/shard2.png",
  "assets/arenas/token/shard3.png",
  "assets/arenas/token/shard4.png",
  "assets/arenas/token/shard5.png",
  "assets/beaufort-bold.ttf",
  "assets/beaufort.ttf",
  "assets/pwa/apple-touch-icon.png",
  "assets/pwa/card-offline.svg",
  "assets/pwa/icon-192.png",
  "assets/pwa/icon-512.png",
  "assets/pwa/maskable-512.png",
  "assets/univers.ttf",
  "attack-token-data.js",
  "attack-token.css?v=5",
  "attack-token.js?v=4",
  "card-effects-data.js?v=0.29",
  "card-effects.css?v=0.29",
  "card-effects.js?v=0.29",
  "card-presentation.js?v=0.29",
  "cards.js?v=0.30",
  "champion-cinematic.css",
  "champion-cinematic.js?v=0.30.1",
  "champion-presentation.js?v=0.30.1",
  "champions.css",
  "champions.js?v=0.29",
  "cinematic-library-data.js?v=0.29",
  "collection.js?v=0.30.3",
  "combat-clarity.css?v=0.29",
  "combat-motion.js",
  "combat-view.js",
  "current-motion-data.js",
  "current-motion.js",
  "deck-builder.css?v=0.30",
  "deck-tools.js?v=0.30",
  "duel-outcome.css?v=0.24",
  "duel-outcome.js?v=0.19",
  "duel-polish.css?v=names1",
  "duel-ui.css",
  "duel-ui.js",
  "engine.js?v=0.29",
  "game-audio.js",
  "header.css?v=2",
  "index.html",
  "initiative-token-data.js",
  "initiative-token.js?v=5",
  "lor-motion-profile.js",
  "lor-motion.css",
  "manifest.webmanifest",
  "mobile-pwa.css",
  "motion-v3.js",
  "native-sounds-data.js?v=0.28",
  "nexus-data.js",
  "nexus-fallback-data.js?v=0.24",
  "nexus-hud.css?v=0.25",
  "nexus-view.js?v=0.24",
  "official-catalog.js",
  "opponents.js?v=2",
  "pwa-artwork.json",
  "pwa.js",
  "regional-audio-data.js",
  "regional-audio.js",
  "riot-deck-code.js",
  "spell-presentation.css",
  "style.css",
  "video-motion.css",
  "welcome-settings-motion.js?v=0.27",
  "welcome.css?v=0.30.2"
];
const ART_VERSION = "38bf862d1b6d";
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
