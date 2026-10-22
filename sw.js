// Offline support for mushaff.com: the app itself is kept up to date from the network when online,
// and mushaf pages that were opened once stay available without internet.
const APP = "mushaf-app-v1", PAGES = "mushaf-pages-v1", FONTS = "mushaf-fonts-v1";
const SHELL = ["/", "/index.html", "/desktop.html", "/data.js", "/quran.js", "/manifest.webmanifest", "/icons/icon-192.png"];
const MAX_PAGES = 1300;   // roughly two full mushafs of page images

self.addEventListener("install", e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => ![APP, PAGES, FONTS].includes(k)).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Mushaf page images never change: serve from the cache, fetch and keep them the first time
  if (url.origin === location.origin && url.pathname.startsWith("/pages/")) {
    e.respondWith(caches.open(PAGES).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) { c.put(req, res.clone()); trim(c, MAX_PAGES); }
      return res;
    }));
    return;
  }

  // The app (pages, scripts, data): network first so updates show at once, the cache when offline
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) caches.open(APP).then(c => c.put(req, res.clone()));
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit =>
      hit || (req.mode === "navigate" ? caches.match(url.pathname.includes("desktop") ? "/desktop.html" : "/") : undefined)
    )));
    return;
  }

  // Fonts: keep a copy so the layout looks the same offline
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async c => {
      const hit = await c.match(req);
      const net = fetch(req).then(res => { c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // Everything else (recitation audio, tafsir) goes to the network as usual
});
