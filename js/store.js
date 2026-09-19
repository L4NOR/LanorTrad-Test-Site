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
    // Horodatage du dernier changement (synchro multi-appareils : « le plus
    // récent gagne ») ; enregistré même sur les pages sans sync.js.
    try { localStorage.setItem("lt-follows-t", String(Date.now())); } catch {}
    window.LTsync && window.LTsync.pushFollows();
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

  /* — « Ma liste » : où en est-on avec chaque série —
       Distinct du suivi (qui repère les sorties) et de la progression (qui
       sait à quelle page on est) : ici, c'est le lecteur qui range. Les
       libellés évitent exprès « En cours » et « Terminé », déjà pris par le
       statut de PUBLICATION affiché sur chaque carte. — */
  const STATUS = "lt-status";
  const STATUTS = [
    { v: "je-lis",    label: "Je lis",    ic: "📖" },
    { v: "a-lire",    label: "À lire",    ic: "🔖" },
    { v: "pause",     label: "En pause",  ic: "⏸️" },
    { v: "fini",      label: "Fini",      ic: "✅" },
    { v: "abandonne", label: "Abandonné", ic: "🚪" },
  ];
  const statutValide = v => STATUTS.some(x => x.v === v);
  function statuses() { const m = read(STATUS, {}); return m && typeof m === "object" ? m : {}; }
  function status(id) { const v = statuses()[id]; return statutValide(v) ? v : null; }
  // v vide ou inconnu = retirer la série de la liste.
  function setStatus(id, v) {
    const m = statuses();
    if (statutValide(v)) m[id] = v; else delete m[id];
    write(STATUS, m);
    try { localStorage.setItem("lt-status-t", String(Date.now())); } catch {}
    window.LTsync && window.LTsync.pushStatuses && window.LTsync.pushStatuses();
    return status(id);
  }

  /* — Journal de l'année, pour le bilan de décembre (js/bilan.js) —
       La progression ne garde que le DERNIER chapitre ouvert par série :
       impossible d'en déduire combien on en a lu. Ce journal note chaque
       chapitre terminé (une fois), l'heure et le jour où on le finit, et le
       temps de lecture active. Il reste sur l'appareil, comme le reste du
       stockage local, et seules les deux dernières années sont gardées. */
  const JOURNAL = "lt-journal";
  function journal() { const j = read(JOURNAL, {}); return j && typeof j === "object" ? j : {}; }
  function annee(j) {
    const y = String(new Date().getFullYear());
    if (!j[y]) {
      j[y] = { debut: new Date().toISOString().slice(0, 10), lus: {}, heures: Array(24).fill(0), jours: Array(7).fill(0), sec: 0 };
      Object.keys(j).sort().slice(0, -2).forEach(k => { delete j[k]; });
    }
    return j[y];
  }
  // Pas d'événement lt:store : rien à redessiner, et la page de lecture
  // n'a pas à se recalculer à chaque chapitre fini.
  const garder = j => { try { localStorage.setItem(JOURNAL, JSON.stringify(j)); } catch {} };
  function logRead(manga, num) {
    const j = journal(), a = annee(j), L = a.lus[manga] || (a.lus[manga] = []);
    if (L.includes(String(num))) return;
    L.push(String(num));
    const d = new Date();
    a.heures[d.getHours()]++;
    a.jours[d.getDay()]++;
    garder(j);
  }
  function logTime(sec) {
    const j = journal();
    annee(j).sec += sec;
    garder(j);
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
    progress, setProgress, history, recents, addRecent, clearRecents,
    STATUTS, statuses, status, setStatus,
    journal, logRead, logTime
  };
})();
