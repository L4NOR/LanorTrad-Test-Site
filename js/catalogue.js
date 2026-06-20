/* =========================================================================
   LanorTrad — Catalogue : filtres, tri, recherche
   ========================================================================= */
(function () {
  "use strict";

  function init() {
    const S = window.SERIES || [];
    const grid = document.getElementById("cat-grid");
    if (!grid) return;

    const fSearch = document.getElementById("f-search");
    const fStatus = document.getElementById("f-status");
    const fType   = document.getElementById("f-type");
    const fGenre  = document.getElementById("f-genre");
    const fSort   = document.getElementById("f-sort");
    const count   = document.getElementById("f-count");

    // Remplir le filtre genres
    const genres = [...new Set(S.flatMap(s => s.genres))].sort((a, b) => a.localeCompare(b, "fr"));
    fGenre.innerHTML = `<option value="">Tous les genres</option>` +
      genres.map(g => `<option value="${g}">${g}</option>`).join("");

    // Préremplir la recherche depuis ?q=
    const q = new URLSearchParams(location.search).get("q");
    if (q) fSearch.value = q;

    function apply() {
      const term = fSearch.value.trim().toLowerCase();
      const st = fStatus.value, ty = fType.value, ge = fGenre.value, so = fSort.value;

      let list = S.filter(s => {
        if (term && !(s.title.toLowerCase().includes(term) || s.genres.join(" ").toLowerCase().includes(term))) return false;
        if (st && s.status !== st) return false;
        if (ty && s.type !== ty) return false;
        if (ge && !s.genres.includes(ge)) return false;
        return true;
      });

      const sorters = {
        recent: (a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0),
        rating: (a, b) => (b.rating || 0) - (a.rating || 0),
        chapters: (a, b) => (b.chapters || 0) - (a.chapters || 0),
        az: (a, b) => a.title.localeCompare(b.title, "fr"),
        za: (a, b) => b.title.localeCompare(a.title, "fr"),
      };
      list.sort(sorters[so] || sorters.recent);

      count.textContent = `${list.length} résultat${list.length > 1 ? "s" : ""}`;
      if (!list.length) {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div><p>Aucune série ne correspond à ces filtres.</p></div>`;
      } else {
        grid.innerHTML = list.map(LTcard).join("");
      }
      document.dispatchEvent(new Event("lt:cards"));
      window.LT && window.LT._scanReveals && window.LT._scanReveals();
    }

    [fSearch, fStatus, fType, fGenre, fSort].forEach(elm =>
      elm.addEventListener("input", apply));
    apply();
  }

  document.addEventListener("lt:ready", init);
})();
