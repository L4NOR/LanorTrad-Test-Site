/* LanorTrad — Service Worker (v2) : shell hors-ligne + notifications */
const CACHE = "lanortrad-v2";
const SHELL = [
  "index.html", "catalogue.html", "manga.html", "reader.html",
  "bibliotheque.html", "planning.html", "equipe.html", "forum.html", "premium.html",
  "css/base.css", "css/components.css", "css/animations.css", "css/extras.css",
  "css/home.css", "css/catalogue.css", "css/manga.css", "css/reader.css", "css/pages.css",
  "css/planning.css", "css/premium.css",
  "js/core.js", "js/store.js", "js/palette.js", "js/cards.js", "js/tilt.js",
  "js/hero.js", "js/home.js", "js/catalogue.js", "js/manga.js", "js/reader.js",
  "js/planning.js", "js/forum.js", "js/premium.js",
  "js/data/series.js", "js/data/chapters.js", "js/data/schedule.js", "js/data/gallery.js",
  "manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Images de chapitres : cache d'abord (lecture hors-ligne des chapitres déjà lus)
  if (/\/Manga\/.+\.(jpe?g|png|webp|avif)$/i.test(url.pathname)) {
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
      catch { return hit || Response.error(); }
    }));
    return;
  }

  // Shell & assets : réseau d'abord, repli sur le cache (hors-ligne)
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".html") || url.pathname === "/")) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("index.html"))));
});

/* Notifications (clic) */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
    for (const c of list) if ("focus" in c) return c.focus();
    if (clients.openWindow) return clients.openWindow("/");
  }));
});
