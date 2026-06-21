/* =========================================================================
   LanorTrad — Données utilisateur (suivis, progression, historique, récents)
   Stockage local, sans backend. Émet "lt:store" à chaque changement.
   ========================================================================= */
(function () {
  "use strict";
  const FOLLOW = "lt-follows";
  const SEEN = "lt-seen";
  const RECENTS = "lt-search-recents";

  function read(key, def) { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }
  function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} emit(); }
  function emit() { document.dispatchEvent(new Event("lt:store")); }
  function allSeries() { return window.SERIES || []; }
  function byId(id) { return allSeries().find(s => s.id === id); }

  /* — Suivis : séries pour lesquelles on veut repérer les nouvelles sorties — */
  function follows() { return read(FOLLOW, []); }
  function isFollowing(id) { return follows().includes(id); }
  function toggleFollow(id) {
    const f = follows(); const i = f.indexOf(id);
    if (i >= 0) f.splice(i, 1); else f.unshift(id);
    write(FOLLOW, f);
    return i < 0; // true = suivi
  }

  /* — Nouveautés : « nouveau » si la série a été mise à jour depuis qu'on l'a vue.
       On stocke une photo {id: lastUpdate}. Au tout 1er passage, on prend la
       photo de l'état actuel → rien n'est marqué « nouveau » d'emblée. — */
  function seenMap() { return read(SEEN, null); }
  function ensureSeenBaseline() {
    if (seenMap() !== null) return;
    const base = {};
    allSeries().forEach(s => { if (s.lastUpdate) base[s.id] = s.lastUpdate; });
    try { localStorage.setItem(SEEN, JSON.stringify(base)); } catch {}  // pas d'emit au boot
  }
  function isNew(s) {
    if (!s || !s.lastUpdate) return false;          // oneshots / sans date → jamais « nouveau »
    const seen = seenMap();
    if (!seen) return false;                         // pas de référence
    const ref = seen[s.id];
    return ref === undefined ? true : s.lastUpdate > ref;  // série ajoutée après la photo, ou MàJ plus récente
  }
  function markSeen(id) {
    const s = byId(id);
    if (!s || !s.lastUpdate) return;
    const seen = seenMap() || {};
    if (seen[id] === s.lastUpdate) return;
    seen[id] = s.lastUpdate; write(SEEN, seen);
  }
  function markAllSeen() {
    const seen = seenMap() || {};
    allSeries().forEach(s => { if (s.lastUpdate) seen[s.id] = s.lastUpdate; });
    write(SEEN, seen);
  }
  function newCount() { return allSeries().filter(isNew).length; }
  function followedNewCount() { return follows().map(byId).filter(s => s && isNew(s)).length; }

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

  ensureSeenBaseline();

  window.LTstore = {
    follows, isFollowing, toggleFollow,
    isNew, markSeen, markAllSeen, newCount, followedNewCount,
    progress, setProgress, history, recents, addRecent, clearRecents
  };
})();
