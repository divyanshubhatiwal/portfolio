// Service worker: makes the portfolio installable and usable offline.
// - Pages: network first (always fresh when online), cached copy or /offline when not.
// - Built assets, images and fonts: served from cache, refreshed in the background.
// - /api/* and other sites' APIs (GitHub, LeetCode): never cached, always live.
// Bump VERSION to force every visitor onto a fresh cache.
const VERSION = 'v1';
const CACHE = `portfolio-${VERSION}`;
const PRECACHE = ['/', '/offline/', '/case/', '/blog/', '/favicon.svg', '/profile.jpg', '/manifest.webmanifest', '/icons/icon-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('portfolio-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/img/') || url.pathname.startsWith('/icons/') ||
  /\.(?:png|jpe?g|svg|webp|avif|woff2?|ttf|css|js|pdf)$/.test(url.pathname);

const isFont = (url) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com';

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || (await cache.match('/offline/')) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((res) => { if (res.ok || res.type === 'opaque') cache.put(request, res.clone()); return res; })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/api/')) return; // live data only
    if (request.mode === 'navigate') { event.respondWith(networkFirst(request)); return; }
    if (isStaticAsset(url)) { event.respondWith(staleWhileRevalidate(request)); return; }
    return;
  }
  if (isFont(url)) event.respondWith(staleWhileRevalidate(request));
  // everything else cross-origin (GitHub API, LeetCode, contribution chart) goes straight to the network
});
