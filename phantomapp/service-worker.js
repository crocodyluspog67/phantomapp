/* Cache-first service worker for Tycoon (single-page root)
   - Pre-caches the app shell (index and manifest)
   - Runtime-caches assets: assets, img, cards, background, cutins, ranks, sfx
*/
const SW_VERSION = 'tycoon-v1.0.1';
const STATIC_CACHE = `${SW_VERSION}-static`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest'
];

const RUNTIME_PATH_PREFIXES = [
  './assets/',
  './img/',
  './cards/',
  './background/',
  './cutins/',
  './ranks/',
  './sfx/'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) =>
          k.startsWith('tycoon-') && k !== STATIC_CACHE && k !== RUNTIME_CACHE
            ? caches.delete(k)
            : Promise.resolve()
        )
      )
    )
  );
  self.clients.claim();
});

function isRuntimeAsset(url) {
  try {
    const u = new URL(url, self.location.href);
    if (u.origin !== self.location.origin) return false;
    const path = u.pathname.startsWith('/') ? '.' + u.pathname : u.pathname;
    return RUNTIME_PATH_PREFIXES.some((p) => path.startsWith(p));
  } catch {
    return false;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isRuntimeAsset(req.url)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(req);
        if (cached) return cached;
        const res = await fetch(req);
        if (res && res.ok && (res.type === 'basic' || res.type === 'cors')) {
          cache.put(req, res.clone());
        }
        return res;
      })
    );
    return;
  }

  event.respondWith(
    fetch(req).catch(() => caches.match(req).then((res) => res || caches.match('./index.html')))
  );
});