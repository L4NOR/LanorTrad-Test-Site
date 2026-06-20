/* =========================================================================
   LanorTrad — Fabrique de cartes manga (accueil + catalogue)
   Halo couleur auto, bouton favori, fondu d'image, transition partagée.
   ========================================================================= */
(function () {
  "use strict";

  window.LTcard = function (s, opts = {}) {
    const statusOn = (s.status || "").toLowerCase().includes("cours");
    const chips = s.genres.slice(0, 1).map(g => `<span class="chip">${g}</span>`).join("");
    const fav = window.LTstore && window.LTstore.isFav(s.id);
    return `
      <a class="m-card" href="${s.url}" data-colorize data-cover="${s.cover}" data-id="${s.id}" style="--accent:${s.accent}">
        <div class="inner">
          <span class="shine"></span>
          <span class="card-glow"></span>
          <button class="fav-btn ${fav ? "on" : ""}" data-fav="${s.id}" aria-label="Ajouter aux favoris" title="Favori">${heart()}</button>
          <span class="badge ${statusOn ? "on" : ""}">${s.status}</span>
          <div class="cover skeleton" data-morph>
            <img src="${s.cover}" alt="${s.title}" loading="lazy" data-fade>
          </div>
          <div class="meta">
            <h3>${s.title}</h3>
            <div class="row">
              ${chips}
              <span>${s.chapters} ch.</span>
              ${window.LT ? window.LT.stars(s.rating || 4.5) : ""}
            </div>
          </div>
        </div>
      </a>`;
  };

  // identifiant CSS sûr pour view-transition-name
  function cssId(id) { return id.replace(/[^a-z0-9]/gi, "-"); }
  window.LTcssId = cssId;

  function heart() {
    return `<svg viewBox="0 0 24 24" width="18" height="18"><path d="M12 21s-7.5-4.6-10-9.1C.4 8.8 1.6 5.5 4.6 4.7c1.9-.5 3.7.3 4.7 1.8l.7 1 .7-1c1-1.5 2.8-2.3 4.7-1.8 3 .8 4.2 4.1 2.6 7.2C19.5 16.4 12 21 12 21z"/></svg>`;
  }

  // fondu des images quand chargées + retrait du skeleton
  function fadeImages(root = document) {
    root.querySelectorAll("img[data-fade]:not([data-faded])").forEach(img => {
      const done = () => { img.dataset.faded = "1"; img.classList.add("loaded"); img.closest(".skeleton")?.classList.remove("skeleton"); };
      if (img.complete && img.naturalWidth) done();
      else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", () => img.closest(".skeleton")?.classList.remove("skeleton"), { once: true }); }
    });
  }

  document.addEventListener("lt:cards", () => { fadeImages(); window.LTpalette && window.LTpalette.colorize(); });
  window.LTfadeImages = fadeImages;
})();
