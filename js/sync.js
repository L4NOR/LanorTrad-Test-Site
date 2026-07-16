/* =========================================================================
   LanorTrad — Synchro multi-appareils (progression de lecture + suivis).
   Additif : localStorage reste la source de vérité locale ; pour les membres
   connectés on réconcilie avec Supabase, règle « le plus récent gagne »
   (horodatage client `t`). No-op si déconnecté ou Supabase absent.
   Dépend de : supabase-config.js + supabase-js + core.js (window.LTsb).
   Chargé sur : reader, manga, bibliotheque, forum, classement.
   ========================================================================= */
(function () {
  "use strict";

  const FT_KEY = "lt-follows-t";
  const sb = () => (window.LTsb && window.LTsb()) || null;

  let sess = null;
  async function session() {
    const c = sb(); if (!c) return null;
    try { sess = (await c.auth.getSession()).data.session || null; } catch { sess = null; }
    return sess;
  }

  const readLS = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  /* ---------- Progression : push (débouncé + filet keepalive) ---------- */
  const queued = new Set();
  let timer = null;

  function queueProgress(id) {
    if (!id) return;
    queued.add(id);
    clearTimeout(timer);
    timer = setTimeout(flush, 2500);
  }

  function rowsFromQueue() {
    const rows = [...queued].map(id => {
      const p = readLS("lt-progress-" + id, null);
      return p && {
        user_id: sess.user.id, manga_id: id, chapter: String(p.chapter),
        page: p.page || 0, t: p.t || 0, updated_at: new Date().toISOString()
      };
    }).filter(Boolean);
    queued.clear();
    return rows;
  }

  async function flush() {
    if (!queued.size || !(await session())) return;
    const c = sb(); if (!c) return;
    const rows = rowsFromQueue();
    if (rows.length) try { await c.from("reading_progress").upsert(rows); } catch {}
  }

  // Quand l'onglet se cache (fermeture, changement d'app sur mobile), on ne
  // peut plus attendre le débounce : envoi immédiat avec keepalive.
  function flushBeacon() {
    if (!queued.size || !sess) return;
    const C = window.LT_SUPABASE || {};
    const rows = rowsFromQueue();
    if (!rows.length || !C.url) return;
    try {
      fetch(`${C.url}/rest/v1/reading_progress`, {
        method: "POST", keepalive: true,
        headers: {
          "Content-Type": "application/json", apikey: C.anonKey,
          Authorization: "Bearer " + sess.access_token,
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify(rows)
      });
    } catch {}
  }

  /* ---------- Suivis : la liste complète, « le plus récent gagne » ---------- */
  async function pushFollows() {
    if (!(await session())) return;
    const c = sb(); if (!c) return;
    const t = +localStorage.getItem(FT_KEY) || Date.now();
    try { localStorage.setItem(FT_KEY, String(t)); } catch {}
    try {
      await c.from("user_follows").upsert({
        user_id: sess.user.id, follows: readLS("lt-follows", []),
        t, updated_at: new Date().toISOString()
      });
    } catch {}
  }

  /* ---------- Réconciliation au chargement (et à la connexion) ---------- */
  let pulled = false;
  async function pull() {
    if (pulled || !(await session())) return;
    pulled = true;
    let changed = false;

    const c = sb();
    try {
      const { data: rows } = await c.from("reading_progress").select("manga_id,chapter,page,t");
      const onServer = new Set();
      (rows || []).forEach(r => {
        onServer.add(r.manga_id);
        const local = readLS("lt-progress-" + r.manga_id, null);
        if (!local || (r.t || 0) > (local.t || 0)) {
          writeLS("lt-progress-" + r.manga_id, { chapter: r.chapter, page: r.page || 0, t: r.t || 0 });
          changed = true;
        } else if ((local.t || 0) > (r.t || 0)) queued.add(r.manga_id);
      });
      // Progression locale que le serveur ne connaît pas encore → à pousser
      (window.SERIES || []).forEach(s => {
        if (!onServer.has(s.id) && readLS("lt-progress-" + s.id, null)) queued.add(s.id);
      });
      if (queued.size) flush();
    } catch {}

    try {
      const { data: f } = await c.from("user_follows").select("follows,t").maybeSingle();
      const localT = +localStorage.getItem(FT_KEY) || 0;
      const srvT = f ? (f.t || 0) : -1;   // -1 = aucune ligne serveur
      if (srvT > localT) {
        writeLS("lt-follows", Array.isArray(f.follows) ? f.follows : []);
        try { localStorage.setItem(FT_KEY, String(srvT)); } catch {}
        changed = true;
      } else if (localT > Math.max(srvT, 0) || (srvT < 0 && readLS("lt-follows", []).length)) {
        pushFollows();
      }
    } catch {}

    if (changed) document.dispatchEvent(new Event("lt:store"));
  }

  function boot() {
    pull();
    const c = sb();
    if (c) c.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_IN") { pulled = false; pull(); } });
  }

  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushBeacon(); });
  window.addEventListener("pagehide", flushBeacon);

  window.LTsync = { queueProgress, pushFollows, pull, flush };
  document.addEventListener("lt:ready", boot);
})();
