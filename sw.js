/* LanorTrad — Service Worker : shell hors-ligne (PWA) */
const CACHE = "lanortrad-v43";
/* Cache séparé pour les pages de chapitres : il SURVIT aux montées de version
   du shell (sinon chaque mise à jour du site effacerait les chapitres
   téléchargés pour la lecture hors connexion). */
const IMG_CACHE = "lanortrad-img-v1";
/* Listes de pages par serie (js/data/pages/<Serie>.js), chargees a la demande
   par le lecteur. Meme logique que les images : ce cache SURVIT aux montees de
   version du shell, sinon une mise a jour du site rendrait illisibles les
   chapitres deja telecharges pour le hors connexion. */
const DATA_CACHE = "lanortrad-data-v1";
/* Page servie quand une navigation échoue hors ligne (elle embarque le
   mini-jeu). Précachée en priorité : sans réseau, impossible d'aller la
   chercher au moment où on en a besoin. */
const OFFLINE_PAGE = "offline.html";
const SHELL = [
  "index.html", "catalogue.html", "manga.html", "reader.html",
  "bibliotheque.html", "planning.html", "equipe.html", "forum.html", "classement.html",
  "mentions-legales.html", "confidentialite.html",
  OFFLINE_PAGE,
  "css/base.css", "css/components.css", "css/animations.css", "css/extras.css",
  "css/home.css", "css/catalogue.css", "css/manga.css", "css/reader.css", "css/pages.css",
  "css/planning.css", "css/forum.css", "css/classement.css", "css/offline.css", "css/perf.css",
  "css/preview.css", "css/fonts.css", "css/atelier.css",
  "fonts/inter-400-latin.woff2", "fonts/inter-500-latin.woff2",
  "fonts/inter-600-latin.woff2", "fonts/inter-700-latin.woff2",
  "fonts/sora-600-latin.woff2", "fonts/sora-700-latin.woff2", "fonts/sora-800-latin.woff2",
  "js/perf.js", "js/offline.js",
  "js/core.js", "js/store.js", "js/palette.js", "js/cards.js", "js/tilt.js",
  "js/hero.js", "js/home.js", "js/catalogue.js", "js/manga.js", "js/reader.js",
  "js/planning.js", "js/preview.js", "js/forum.js", "js/supabase-config.js", "js/xp.js", "js/classement.js", "js/views.js", "js/pulse.js", "js/ratings.js", "js/sync.js", "js/atelier.js",
  "js/data/series.js", "js/data/covers.js", "js/data/chapters.js", "js/data/schedule.js", "js/data/gallery.js",
  "js/data/atelier.js",
  "manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE && k !== IMG_CACHE && k !== DATA_CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Images de chapitres : cache d'abord (lecture hors-ligne des chapitres déjà
  // lus ou téléchargés). Couvre aussi Manga/preview/ (vignettes d'aperçu).
  // La bibliothèque est en WebP depuis la migration.
  if (/\/Manga\/.+\.(jpe?g|png|webp)$/i.test(url.pathname)) {
    e.respondWith(caches.open(IMG_CACHE).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const res = await fetch(req); if (res.ok) c.put(req, res.clone()); return res; }
      catch { return hit || Response.error(); }
    }));
    return;
  }

  // Listes de pages : réseau d'abord (pour voir les nouveaux chapitres), mais
  // conservées dans un cache qui survit aux mises à jour du site.
  if (url.pathname.includes("/js/data/pages/")) {
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(DATA_CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(async () => (await caches.match(req)) || Response.error()));
    return;
  }

  // Shell & assets : réseau d'abord, repli sur le cache (hors-ligne)
  e.respondWith(fetch(req).then(res => {
    if (res.ok && (url.pathname.endsWith(".css") || url.pathname.endsWith(".js") || url.pathname.endsWith(".html") || url.pathname === "/")) {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  }).catch(async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    if (req.mode === "navigate") {
      // Les pages sont pilotées par l'URL côté client : manga.html?id=X est
      // rendu par la version cachée de manga.html (d'où ignoreSearch).
      const page = await caches.match(req, { ignoreSearch: true });
      if (page) return page;
      // Vraiment rien en cache : page « hors ligne » (explications + mini-jeu)
      // plutôt qu'une erreur du navigateur.
      return (await caches.match(OFFLINE_PAGE)) || caches.match("index.html");
    }
    return caches.match("index.html");
  }));
});
