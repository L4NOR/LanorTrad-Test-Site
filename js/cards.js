/* =========================================================================
   LanorTrad — Fabrique de cartes manga (accueil + catalogue)
   Halo couleur auto, bouton suivre, fondu d'image, transition partagée.
   ========================================================================= */
(function () {
  "use strict";

  window.LTcard = function (s, opts = {}) {
    const statusOn = (s.status || "").toLowerCase().includes("cours");
    const chips = s.genres.slice(0, 1).map(g => `<span class="chip">${g}</span>`).join("");
    const following = window.LTstore && window.LTstore.isFollowing(s.id);
    const isNew = window.LTstore && window.LTstore.isNew(s);
    return `
      <a class="m-card" href="${s.url}" data-colorize data-cover="${s.cover}" data-id="${s.id}" style="--accent:${s.accent}">
        <div class="inner">
          <span class="shine"></span>
          <span class="card-glow"></span>
          <button class="follow-btn ${following ? "on" : ""}" data-follow="${s.id}" aria-label="${following ? "Ne plus suivre" : "Suivre cette série"}" title="${following ? "Suivi" : "Suivre"}">${bell()}</button>
          <div class="card-flags">
            ${isNew ? `<span class="badge new">Nouveau</span>` : ""}
            <span class="badge ${statusOn ? "on" : ""}">${s.status}</span>
          </div>
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

  function bell() {
    return `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;
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
