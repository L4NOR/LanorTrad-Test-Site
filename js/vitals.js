/* =========================================================================
   LanorTrad — Mesure des Core Web Vitals RÉELS (RUM).

   Pourquoi : un score Lighthouse, c'est une simulation sur la machine du
   développeur. Il ne dit rien de ce que vit un lecteur sur un téléphone de
   2019 en 4G dans le métro. Or c'est CE ressenti-là que Google mesure pour le
   classement, via les données de terrain (CrUX).

   Ce module relève trois choses, telles qu'elles se produisent chez le
   visiteur, et les envoie en UN seul événement quand il quitte la page :

     LCP — quand le plus gros élément visible s'affiche (« la page est là »).
     CLS — de combien la mise en page a sauté (« le texte bouge sous mon doigt »).
     INP — le délai entre un clic/tap et la réaction visible (« ça répond ? »).

   Aucune bibliothèque externe : les trois se lisent avec PerformanceObserver.

   Vie privée : chargé UNIQUEMENT si le visiteur a accepté la mesure d'audience
   (js/core.js ne l'appelle pas autrement), et n'envoie que des durées et un
   type de page. Aucun identifiant, aucune URL de chapitre, aucun contenu.
   ========================================================================= */
(function () {
  "use strict";

  // Les pages pré-rendues démarrent avant d'être affichées : sans ce décalage,
  // le LCP d'une page pré-rendue paraîtrait négatif ou absurdement bas.
  var nav = performance.getEntriesByType("navigation")[0];
  var start = (nav && nav.activationStart) || 0;
  var rel = function (t) { return Math.max(0, t - start); };

  var M = { lcp: null, cls: 0, inp: 0, ttfb: nav ? Math.round(rel(nav.responseStart)) : null };
  var sent = false;

  function observe(type, cb, extra) {
    try {
      var o = new PerformanceObserver(function (l) { l.getEntries().forEach(cb); });
      var opts = { type: type, buffered: true };
      for (var k in (extra || {})) opts[k] = extra[k];
      o.observe(opts);
      return o;
    } catch (e) { return null; }   // navigateur sans ce type d'entrée : on s'en passe
  }

  /* ---- LCP : on garde la dernière candidate, elle peut changer jusqu'à
     la première interaction. ---- */
  observe("largest-contentful-paint", function (e) { M.lcp = Math.round(rel(e.startTime)); });

  /* ---- CLS : somme par « fenêtre de session », pas somme brute.
     C'est la définition de Google : on additionne les décalages tant qu'ils
     s'enchaînent (moins d'1 s d'écart, 5 s de fenêtre max), et on retient la
     pire fenêtre. Faire une somme brute punirait à tort une page longtemps
     ouverte — typiquement notre lecteur, ou l'accueil dont le carrousel
     tourne en boucle. ---- */
  var win = 0, first = 0, last = 0;
  observe("layout-shift", function (e) {
    if (e.hadRecentInput) return;              // un décalage causé par un clic est voulu
    if (win && e.startTime - last < 1000 && e.startTime - first < 5000) {
      win += e.value; last = e.startTime;
    } else {
      win = e.value; first = last = e.startTime;
    }
    if (win > M.cls) M.cls = win;
  });

  /* ---- INP : on retient la pire interaction. La vraie définition écarte le
     98e centile sur les pages très interactives ; ici le maximum est plus
     sévère, donc plus utile pour repérer un problème. ---- */
  observe("event", function (e) {
    if (e.interactionId && e.duration > M.inp) M.inp = Math.round(e.duration);
  }, { durationThreshold: 40 });

  /* ---- Type de page : pour comparer ce qui est comparable. Le lecteur et
     l'accueil n'ont pas du tout le même profil. Jamais l'URL elle-même, qui
     dirait quelle série est lue. ---- */
  function pageType() {
    var p = location.pathname.split("/").pop() || "index.html";
    return p.replace(/\.html$/, "") || "index";
  }

  /* ---- Envoi unique, au moment où le visiteur s'en va. On n'envoie rien si
     aucune mesure n'a pu être prise. ---- */
  function send() {
    if (sent || M.lcp === null) return;
    sent = true;
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "web_vitals", {
      page_type: pageType(),
      lcp_ms: M.lcp,
      cls_x1000: Math.round(M.cls * 1000),   // GA n'aime pas les décimales
      inp_ms: M.inp,
      ttfb_ms: M.ttfb,
      perf_tier: document.documentElement.getAttribute("data-perf") || "?"
    });
  }

  // « hidden » est le seul moment fiable : sur mobile, unload et beforeunload
  // ne se déclenchent souvent jamais (l'onglet est gelé puis tué).
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") send();
  });
  window.addEventListener("pagehide", send);

  // Utile pour vérifier en console : window.LTvitals.now()
  window.LTvitals = { now: function () { return JSON.parse(JSON.stringify(M)); } };
})();
