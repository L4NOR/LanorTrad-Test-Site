/* =========================================================================
   LanorTrad — Extraction de la couleur dominante d'une couverture.
   Sert à teinter automatiquement le halo des cartes/fiches.
   Met en cache (mémoire + localStorage). Images locales = pas de souci CORS.
   ========================================================================= */
(function () {
  "use strict";
  const mem = new Map();

  function cacheGet(src) {
    if (mem.has(src)) return mem.get(src);
    try { const v = localStorage.getItem("lt-color-" + src); if (v) { mem.set(src, v); return v; } } catch {}
    return null;
  }
  function cacheSet(src, hex) { mem.set(src, hex); try { localStorage.setItem("lt-color-" + src, hex); } catch {} }

  function get(src) {
    return new Promise(resolve => {
      const cached = cacheGet(src);
      if (cached) return resolve(cached);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const W = 18, H = 26;
          const c = document.createElement("canvas"); c.width = W; c.height = H;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0, W, H);
          const data = ctx.getImageData(0, 0, W, H).data;
          let br = 0, bg = 0, bb = 0, bScore = -1;     // pixel le plus "vibrant"
          let ar = 0, ag = 0, ab = 0, n = 0;            // moyenne de secours
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
            if (a < 125) continue;
            const max = Math.max(r, g, b), min = Math.min(r, g, b);
            const lum = (max + min) / 2, sat = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255) || 1);
            ar += r; ag += g; ab += b; n++;
            if (lum < 28 || lum > 232) continue;        // ignore quasi noir/blanc
            const score = sat * 255 + (255 - Math.abs(lum - 140)); // vibrant + mi-clair
            if (score > bScore) { bScore = score; br = r; bg = g; bb = b; }
          }
          let r, g, b;
          if (bScore < 0 && n) { r = ar / n | 0; g = ag / n | 0; b = ab / n | 0; }
          else { r = br; g = bg; b = bb; }
          [r, g, b] = punch(r, g, b);
          const hex = "#" + [r, g, b].map(x => x.toString(16).padStart(2, "0")).join("");
          cacheSet(src, hex); resolve(hex);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // rehausse un peu la saturation pour un halo qui claque
  function punch(r, g, b) {
    const max = Math.max(r, g, b), avg = (r + g + b) / 3, k = 1.25;
    r = clamp(avg + (r - avg) * k); g = clamp(avg + (g - avg) * k); b = clamp(avg + (b - avg) * k);
    return [r | 0, g | 0, b | 0];
  }
  const clamp = v => Math.max(0, Math.min(255, v));

  // applique --accent sur tous les [data-colorize][data-cover] d'un conteneur
  function colorize(root = document) {
    root.querySelectorAll("[data-colorize][data-cover]").forEach(elm => {
      if (elm.dataset.colorized) return;
      elm.dataset.colorized = "1";
      get(elm.dataset.cover).then(hex => { if (hex) elm.style.setProperty("--accent", hex); });
    });
  }

  window.LTpalette = { get, colorize };
})();
