/* LanorTrad — Service Worker : shell hors-ligne (PWA) */
const CACHE = "lanortrad-v59";
/* Cache séparé pour les pages de chapitres : il SURVIT aux montées de version
   du shell (sinon chaque mise à jour du site effacerait les chapitres
   téléchargés pour la lecture hors connexion). */
const IMG_CACHE = "lanortrad-img-v1";
/* Listes de pages par serie (js/data/pages/<Serie>.js), chargees a la demande
   par le lecteur. Meme logique que les images : ce cache SURVIT aux montees de
   version du shell, sinon une mise a jour du site rendrait illisibles les
   chapitres deja telecharges pour le hors connexion. */
const DATA_CACHE = "lanortrad-data-v1";
/* Miroir de l'etat des notifications, ecrit par js/push.js : series suivies et
   sorties deja annoncees. Le service worker se reveille quand AUCUNE page n'est
   ouverte — il n'a donc pas acces a localStorage, d'ou ce relais par le Cache
   API, qui, lui, lui est accessible. Survit aux montees de version du shell. */
const PUSH_CACHE = "lanortrad-push";
const PUSH_ETAT = "/lt-push-etat";
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
  "js/planning.js", "js/preview.js", "js/forum.js", "js/supabase-config.js", "js/xp.js", "js/classement.js", "js/views.js", "js/notes.js", "js/pulse.js", "js/ratings.js", "js/sync.js", "js/atelier.js", "js/presence.js",
  "js/personnages.js", "js/pronos.js", "js/devine.js",
  "js/data/series.js", "js/data/covers.js", "js/data/chapters.js", "js/data/notes.js", "js/data/schedule.js", "js/data/gallery.js",
  "js/data/atelier.js", "js/data/credits.js", "js/data/personnages.js",
  "js/push-config.js", "js/push.js",
  "manifest.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: "reload" })))).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE && k !== IMG_CACHE && k !== DATA_CACHE && k !== PUSH_CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});

/* Adresses lisibles : hors ligne, il n'y a plus de reecriture Netlify pour
   les traduire (voir netlify.toml). Le service worker fait donc lui-meme le
   rapprochement, sans quoi /manga/tougen-anki/ tomberait sur la page « hors
   ligne » alors que manga.html est bel et bien en cache. */
function fichierPour(pathname) {
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "manga" && seg[1]) return seg[2] ? "reader.html" : "manga.html";
  if (seg[0] === "genre" && seg[1]) return "catalogue.html";
  return null;
}

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
      // Adresse lisible : on sert le fichier qui la rend.
      const propre = fichierPour(url.pathname);
      if (propre) { const hit2 = await caches.match(propre); if (hit2) return hit2; }
      // Vraiment rien en cache : page « hors ligne » (explications + mini-jeu)
      // plutôt qu'une erreur du navigateur.
      return (await caches.match(OFFLINE_PAGE)) || caches.match("index.html");
    }
    return caches.match("index.html");
  }));
});

/* =========================================================================
   NOTIFICATIONS DE SORTIE (Web Push)

   POURQUOI CE CODE EST ICI ET PAS DANS UNE PAGE
   Quand un chapitre sort, le navigateur du lecteur reveille CE fichier —
   souvent sans qu'aucune page du site ne soit ouverte, parfois navigateur
   ferme. Tout ce qui decide du texte de la notification doit donc vivre ici.

   POURQUOI LE MESSAGE N'EST PAS DANS LE PUSH
   Un push peut transporter un contenu, mais il doit alors etre chiffre de
   bout en bout (RFC 8291) : une centaine de lignes de cryptographie a tenir
   a jour, pour transmettre ce que le site publie deja. On envoie donc un
   PING VIDE, et c'est le service worker qui va lire push/latest.json (genere
   au deploiement par scripts/build-seo.js) pour savoir quoi annoncer.

   REGLE DU NAVIGATEUR : tout push recu DOIT afficher une notification. Si on
   n'affiche rien, le navigateur affiche a notre place un « ce site a ete mis
   a jour en arriere-plan ». D'ou le repli generique en fin de parcours.
   ========================================================================= */

/* La cle publique (js/push-config.js) sert au reabonnement automatique, et la
   configuration Supabase a l'enregistrement de la nouvelle adresse. Ces deux
   fichiers ecrivent sur `window`, qui n'existe pas dans un service worker :
   on le fait exister l'espace de l'import, puis on remet les choses en place.
   Import protege : un fichier absent ne doit pas empecher le service worker
   de s'installer (le hors-ligne, lui, doit continuer a marcher). */
try {
  self.window = self;
  importScripts("js/push-config.js", "js/supabase-config.js");
} catch (e) { /* pas de notifications, le reste du service worker vit sa vie */ }
try { delete self.window; } catch (e) {}

const NOTIF_ICONE = "images/icons/icon-192x192.png";
const NOTIF_BADGE = "images/icons/icon-96x96.png";

async function miroirPush() {
  try {
    const c = await caches.open(PUSH_CACHE);
    const r = await c.match(PUSH_ETAT);
    return r ? await r.json() : null;
  } catch { return null; }
}

async function ecrireMiroirPush(etat) {
  try {
    const c = await caches.open(PUSH_CACHE);
    await c.put(PUSH_ETAT, new Response(JSON.stringify(etat), { headers: { "Content-Type": "application/json" } }));
  } catch { /* quota, navigation privee : sans consequence */ }
}

function octetsCle(b64) {
  const p = "=".repeat((4 - (b64.length % 4)) % 4);
  const brut = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(brut.length);
  for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
  return out;
}

/* Que faut-il annoncer ? On compare les sorties publiees a ce que cet appareil
   a deja vu passer (le miroir, seme au moment de l'abonnement). */
async function quoiAnnoncer() {
  let sorties = [];
  try {
    const r = await fetch("push/latest.json", { cache: "no-store" });
    if (r.ok) sorties = (await r.json()).sorties || [];
  } catch { /* hors ligne pile a cet instant : on annoncera en generique */ }

  const etat = (await miroirPush()) || {};
  const annonces = Array.isArray(etat.annonces) ? etat.annonces : [];
  const suivis = Array.isArray(etat.follows) ? etat.follows : [];

  let neuf = sorties.filter(s => s && s.sig && annonces.indexOf(s.sig) < 0);

  // Filtre des series suivies. Si rien ne correspond, on garde la liste
  // complete : le serveur nous a reveilles pour une raison, et un miroir peut
  // dater (suivis modifies sur un autre appareil).
  if (!etat.tous && suivis.length) {
    const f = neuf.filter(s => suivis.indexOf(s.id) >= 0);
    if (f.length) neuf = f;
  }

  // Miroir absent (donnees du site effacees) : on n'a aucun point de repere,
  // donc on annonce UNE sortie, la plus recente, et pas les trente dernieres.
  if (!annonces.length) neuf = neuf.slice(0, 1);

  if (neuf.length) {
    await ecrireMiroirPush(Object.assign({}, etat, {
      annonces: neuf.map(s => s.sig).concat(annonces).slice(0, 80),
    }));
  }
  return neuf;
}

self.addEventListener("push", e => {
  e.waitUntil((async () => {
    const neuf = await quoiAnnoncer();
    let titre, corps, url, etiquette;

    if (neuf.length === 1) {
      titre = neuf[0].titre;
      corps = "Chapitre " + neuf[0].num + " est en ligne !";
      url = neuf[0].url || "/";
      etiquette = "lt-" + neuf[0].sig;
    } else if (neuf.length > 1) {
      titre = neuf.length + " nouveaux chapitres";
      const noms = neuf.slice(0, 3).map(s => s.titre);
      corps = noms.join(", ") + (neuf.length > 3 ? " et " + (neuf.length - 3) + " autre" + (neuf.length > 4 ? "s" : "") : "");
      url = "/";
      etiquette = "lt-" + neuf.map(s => s.sig).join("|");
    } else {
      // Repli obligatoire : un push sans notification affichee est remplace
      // par un message generique du navigateur, bien plus moche que celui-ci.
      titre = "LanorTrad";
      corps = "Du nouveau a lire sur le site.";
      url = "/";
      etiquette = "lt-sortie";
    }

    await self.registration.showNotification(titre, {
      body: corps,
      icon: NOTIF_ICONE,
      badge: NOTIF_BADGE,
      lang: "fr",
      // Une etiquette PAR CONTENU, et non une etiquette fixe : deux sorties
      // differentes doivent pouvoir coexister dans le volet des notifications.
      // Avec une etiquette commune, l'annonce du mardi remplacerait celle du
      // lundi, qu'on n'aurait peut-etre pas encore lue. Meme contenu annonce
      // deux fois (rare, mais possible) : la aussi, une seule notification.
      tag: etiquette,
      renotify: true,
      data: { url },
      actions: [{ action: "lire", title: "Lire" }],
    });
  })());
});

/* Clic : on reutilise un onglet LanorTrad deja ouvert plutot que d'en empiler
   un nouveau a chaque notification. */
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const cible = new URL((e.notification.data && e.notification.data.url) || "/", self.location.origin).href;
  e.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of fenetres) {
      if (new URL(c.url).origin !== self.location.origin) continue;
      await c.focus();
      if ("navigate" in c) { try { await c.navigate(cible); } catch { /* deja au bon endroit */ } }
      return;
    }
    await self.clients.openWindow(cible);
  })());
});

/* Les navigateurs renouvellent parfois l'adresse de push d'eux-memes. Sans ce
   gestionnaire, l'abonnement devient muet et personne ne s'en rend compte :
   le site continue d'envoyer vers une adresse morte. */
self.addEventListener("pushsubscriptionchange", e => {
  e.waitUntil((async () => {
    const cle = (self.LT_PUSH || {}).publicKey;
    const sb = self.LT_SUPABASE || {};
    if (!cle || !sb.url || !sb.anonKey) return;

    const appel = (nom, corps) => fetch(sb.url + "/rest/v1/rpc/" + nom, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: sb.anonKey, Authorization: "Bearer " + sb.anonKey },
      body: JSON.stringify(corps),
    });

    let sub = e.newSubscription;
    if (!sub) {
      sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: octetsCle(cle),
      }).catch(() => null);
    }
    if (!sub) return;

    const etat = (await miroirPush()) || {};
    const j = sub.toJSON();
    await appel("push_subscribe", {
      p_endpoint: sub.endpoint,
      p_p256dh: (j.keys && j.keys.p256dh) || "",
      p_auth: (j.keys && j.keys.auth) || "",
      p_follows: etat.tous ? [] : (etat.follows || []),
    }).catch(() => {});

    if (e.oldSubscription && e.oldSubscription.endpoint !== sub.endpoint) {
      await appel("push_unsubscribe", { p_endpoint: e.oldSubscription.endpoint }).catch(() => {});
    }
  })());
});
