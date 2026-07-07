/* =========================================================================
   LanorTrad — Gestion de la fluidité (« tiers » de qualité graphique).

   Objectif : que le site reste fluide sur TOUT appareil, PC performant ou non.
   Certaines machines rament à cause des effets lourds pour le GPU (grands flous
   animés, grain en mix-blend, braises, backdrop-filter partout). Ce module :

     1. Devine un tier au démarrage (specs : mémoire, cœurs, save-data, reduced-motion).
     2. Pose data-perf="lite" | "high" sur <html> AVANT le premier rendu
        (le CSS perf.css réagit à cet attribut → aucun clignotement).
     3. Sonde les FPS réels une fois la page chargée ; si ça rame, bascule en
        « lite » et met le résultat en cache (les visites suivantes sont instantanées).
     4. Expose window.LTperf pour un réglage manuel (bouton « Fluidité »).

   Chargé en <head>, AVANT le CSS et les autres scripts, pour agir dès le 1er paint.
   ========================================================================= */
(function () {
  "use strict";

  var root = document.documentElement;
  var KEY_OVERRIDE = "lt-perf";        // choix manuel : "lite" | "high" (absent = auto)
  var KEY_AUTO     = "lt-perf-auto";   // cache de détection : {tier, ts}
  var CACHE_TTL    = 7 * 24 * 3600 * 1000;  // re-sonde au bout de 7 jours
  var FPS_MIN      = 50;               // en-dessous (sur 60 Hz) → machine à la peine

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function getOverride() { var v = localStorage.getItem(KEY_OVERRIDE); return (v === "lite" || v === "high") ? v : null; }

  var reduce = !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);

  // Signaux « appareil clairement modeste » → on part en léger sans même sonder.
  function isWeakDevice() {
    var conn = navigator.connection || navigator.webkitConnection;
    if (conn && conn.saveData) return true;                       // mode éco de données
    if (typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 2) return true;
    if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) return true;
    return false;
  }

  // Tier de départ (synchrone, avant paint). On sonde ensuite si mode auto.
  function resolveInitial() {
    var ov = getOverride();
    if (ov) return { tier: ov, mode: ov, probe: false };

    if (reduce || isWeakDevice()) return { tier: "lite", mode: "auto", probe: false };

    var cache = readJSON(KEY_AUTO);
    if (cache && cache.tier && (Date.now() - (cache.ts || 0) < CACHE_TTL))
      return { tier: cache.tier, mode: "auto", probe: false };

    // Pas de certitude : on démarre en « high » et on laisse la sonde FPS trancher.
    return { tier: "high", mode: "auto", probe: true };
  }

  var state = resolveInitial();

  function apply(tier) {
    root.setAttribute("data-perf", tier);
  }
  apply(state.tier);

  function cacheAuto(tier) {
    try { localStorage.setItem(KEY_AUTO, JSON.stringify({ tier: tier, ts: Date.now() })); } catch (e) {}
  }

  function announce() {
    try {
      document.dispatchEvent(new CustomEvent("lt:perf", {
        detail: { effective: root.getAttribute("data-perf"), mode: state.mode }
      }));
    } catch (e) {}
  }

  /* -------- Sonde FPS : mesure la fluidité réelle, ne fait que RÉTROGRADER -------- */
  function probeFPS() {
    if (state.mode !== "auto") return;          // choix manuel : on ne touche à rien
    if (root.getAttribute("data-perf") === "lite") return;  // déjà léger : rien à prouver

    var SETTLE = 1200;   // laisse retomber le pic de chargement (parsing/layout)
    var WINDOW = 2500;   // durée de mesure

    setTimeout(function () {
      if (document.hidden) {                     // onglet caché → rAF gelé, on réessaie
        var onShow = function () { document.removeEventListener("visibilitychange", onShow); probeFPS(); };
        document.addEventListener("visibilitychange", onShow);
        return;
      }
      var frames = 0, start = performance.now(), last = start;
      (function tick(now) {
        // Ignore une frame anormalement longue isolée (GC, changement d'onglet…).
        if (now - last < 500) frames++;
        last = now;
        if (now - start < WINDOW) { requestAnimationFrame(tick); return; }

        var fps = frames / ((now - start) / 1000);
        var tier = fps < FPS_MIN ? "lite" : "high";
        cacheAuto(tier);
        if (tier === "lite") { apply("lite"); announce(); }
      })(start);
    }, SETTLE);
  }

  if (state.probe) {
    if (document.readyState === "complete") probeFPS();
    else addEventListener("load", probeFPS, { once: true });
  }

  /* -------- API publique : réglage manuel -------- */
  function effective() { return root.getAttribute("data-perf") || "high"; }

  function set(mode) {
    if (mode === "lite" || mode === "high") {
      state.mode = mode;
      try { localStorage.setItem(KEY_OVERRIDE, mode); } catch (e) {}
      apply(mode);
    } else { // "auto"
      state.mode = "auto";
      try { localStorage.removeItem(KEY_OVERRIDE); } catch (e) {}
      var cache = readJSON(KEY_AUTO);
      apply((cache && cache.tier) || (reduce || isWeakDevice() ? "lite" : "high"));
      state.probe = true; probeFPS();
    }
    announce();
    return state.mode;
  }

  // Cycle pour le bouton : Auto → Complet → Léger → Auto
  function cycle() {
    var order = ["auto", "high", "lite"];
    var next = order[(order.indexOf(state.mode) + 1) % order.length];
    return set(next);
  }

  window.LTperf = {
    get: effective,               // "lite" | "high" (tier appliqué)
    mode: function () { return state.mode; },  // "auto" | "lite" | "high"
    set: set,
    cycle: cycle,
    isLite: function () { return effective() === "lite"; }
  };
})();
