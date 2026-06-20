/* =========================================================================
   LanorTrad — Données utilisateur (favoris, progression, historique, récents)
   Stockage local, sans backend. Émet "lt:store" à chaque changement.
   ========================================================================= */
(function () {
  "use strict";
  const FAV = "lt-favorites";
  const RECENTS = "lt-search-recents";

  function read(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} emit(); }
  function emit() { document.dispatchEvent(new Event("lt:store")); }

  /* — Favoris — */
  function favorites() { return read(FAV, []); }
  function isFav(id) { return favorites().includes(id); }
  function toggleFav(id) {
    const f = favorites(); const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.unshift(id);
    write(FAV, f);
    return i < 0; // true = ajouté
  }

  /* — Progression / reprise — */
  function progress(id) { return read("lt-progress-" + id, null); }
  function setProgress(id, chapter, page) { write("lt-progress-" + id, { chapter, page, t: Date.now() }); }

  /* — Historique : toutes les séries avec progression, du plus récent — */
  function history() {
    return (window.SERIES || [])
      .map(s => ({ s, p: progress(s.id) }))
      .filter(x => x.p)
      .sort((a, b) => (b.p.t || 0) - (a.p.t || 0));
  }

  /* — Recherches récentes — */
  function recents() { return read(RECENTS, []); }
  function addRecent(term) {
    term = (term || "").trim(); if (!term) return;
    let r = recents().filter(x => x.toLowerCase() !== term.toLowerCase());
    r.unshift(term); r = r.slice(0, 6); write(RECENTS, r);
  }
  function clearRecents() { write(RECENTS, []); }

  window.LTstore = { favorites, isFav, toggleFav, progress, setProgress, history, recents, addRecent, clearRecents };
})();
