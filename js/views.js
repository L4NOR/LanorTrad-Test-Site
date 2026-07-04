/* =========================================================================
   LanorTrad — Compteurs de lectures (preuve sociale + tendances).
   Tape l'API REST Supabase en fetch (pas besoin de la lib supabase-js).
   Cache localStorage pour un affichage instantané ; rafraîchi en arrière-plan.
   Expose window.LTviews. Ne dépend que de supabase-config.js.
   ========================================================================= */
(function () {
  "use strict";

  const CACHE_KEY = "lt-views-cache";
  const C = {};
  try { Object.assign(C, JSON.parse(localStorage.getItem(CACHE_KEY) || "{}")); } catch {}

  let loaded = false, _top = null;
  const waiters = [];

  const cfg = () => window.LT_SUPABASE || {};
  const ok = () => { const c = cfg(); return !!(c.url && c.anonKey && !/VOTRE_|YOUR_/i.test(c.url + c.anonKey)); };
  const headers = () => { const c = cfg(); return { apikey: c.anonKey, Authorization: "Bearer " + c.anonKey }; };

  function save() { _top = null; try { localStorage.setItem(CACHE_KEY, JSON.stringify(C)); } catch {} }
  function flush() { while (waiters.length) { try { waiters.shift()(); } catch {} } }

  async function load() {
    if (ok()) {
      try {
        const res = await fetch(`${cfg().url}/rest/v1/series_views?select=manga_id,views`, { headers: headers() });
        if (res.ok) { (await res.json()).forEach(r => { C[r.manga_id] = r.views; }); save(); }
      } catch {}
    }
    loaded = true; flush();
    document.dispatchEvent(new Event("lt:views"));
    decorate();
  }

  // 1 vue par série par jour et par navigateur (déduplication côté client).
  async function bump(id) {
    if (!ok() || !id) return;
    const key = "lt-viewed-" + id, today = new Date().toISOString().slice(0, 10);
    try { if (localStorage.getItem(key) === today) return; localStorage.setItem(key, today); } catch {}
    try {
      await fetch(`${cfg().url}/rest/v1/rpc/bump_view`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers() },
        body: JSON.stringify({ p_manga: id })
      });
      C[id] = (C[id] || 0) + 1; save();
    } catch {}
  }

  function fmt(n) {
    if (n == null) return "";
    n = +n;
    if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "") + "k";
    return "" + n;
  }
  function trending(n = 6) {
    return Object.keys(C).filter(id => C[id] > 0).sort((a, b) => (C[b] || 0) - (C[a] || 0)).slice(0, n);
  }
  function topSet() { if (!_top) _top = new Set(trending(3).filter(id => (C[id] || 0) >= 5)); return _top; }
  function isTrending(id) { return topSet().has(id); }

  const eye = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>`;

  // Ajoute badge « Tendance » + compteur de vues aux cartes déjà rendues.
  function decorate() {
    document.querySelectorAll(".m-card[data-id]").forEach(card => {
      const id = card.dataset.id, v = C[id];
      const flags = card.querySelector(".card-flags");
      if (flags && isTrending(id) && !flags.querySelector(".trend"))
        flags.insertAdjacentHTML("afterbegin", `<span class="badge trend">🔥 Tendance</span>`);
      const row = card.querySelector(".meta .row");
      if (row && v != null && !row.querySelector(".views"))
        row.insertAdjacentHTML("beforeend", `<span class="views" title="${v} lectures">${eye} ${fmt(v)}</span>`);
    });
  }

  window.LTviews = {
    get: id => C[id], fmt, trending, isTrending, eye,
    ready: fn => { loaded ? fn() : waiters.push(fn); },
    load, bump, decorate
  };
  document.addEventListener("lt:cards", decorate);
  document.addEventListener("lt:ready", load);
})();
