/* =========================================================================
   LanorTrad — Ambiance immersive : teinte le fond global dans la couleur
   d'un univers et fait monter des braises. API : window.LTambiance.
     LTambiance.set("#e0245e")  → active / met à jour la couleur
     LTambiance.clear()          → désactive
   Respecte prefers-reduced-motion (couleur conservée, braises coupées).
   ========================================================================= */
(function () {
  "use strict";

  var layer = null, built = false;
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function ensureLayer() {
    if (built) return;
    built = true;
    layer = document.createElement("div");
    layer.className = "lt-embers";
    layer.setAttribute("aria-hidden", "true");

    if (!reduce) {
      var n = window.innerWidth < 640 ? 14 : 26;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < n; i++) {
        var e = document.createElement("span");
        e.className = "lt-ember";
        var size = 3 + Math.random() * 6;
        e.style.width = size + "px";
        e.style.height = size + "px";
        e.style.left = (Math.random() * 100).toFixed(2) + "%";
        e.style.setProperty("--dx", (Math.random() * 120 - 60).toFixed(0) + "px");
        e.style.setProperty("--o", (0.35 + Math.random() * 0.5).toFixed(2));
        e.style.animationDuration = (7 + Math.random() * 9).toFixed(1) + "s";
        e.style.animationDelay = (-Math.random() * 14).toFixed(1) + "s";
        frag.appendChild(e);
      }
      layer.appendChild(frag);
    }
    (document.body || document.documentElement).appendChild(layer);
  }

  function set(hex) {
    if (!hex) return;
    document.documentElement.style.setProperty("--amb", hex);
    document.body.classList.add("lt-amb");
    ensureLayer();
    if (layer) layer.style.display = "";
  }

  function clear() {
    document.body.classList.remove("lt-amb");
    if (layer) layer.style.display = "none";   // coupe aussi les braises
  }

  window.LTambiance = { set: set, clear: clear };
})();
