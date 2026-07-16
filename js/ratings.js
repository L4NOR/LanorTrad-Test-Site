/* =========================================================================
   LanorTrad — Notes réelles des lecteurs (1 à 5 étoiles) par série.
   Agrégats publics lus via l'API REST Supabase en fetch (comme views.js),
   cache localStorage pour un affichage instantané. Poser sa note demande un
   compte (supabase-js via window.LTsb — chargé sur la fiche série).
   Expose window.LTratings. Ne dépend que de supabase-config.js (+ core.js).
   ========================================================================= */
(function () {
  "use strict";

  const CACHE_KEY = "lt-ratings-cache";
  const C = {};   // manga_id → { s: score (moyenne /5), v: votes }
  try { Object.assign(C, JSON.parse(localStorage.getItem(CACHE_KEY) || "{}")); } catch {}

  let loaded = false;
  const waiters = [];

  const cfg = () => window.LT_SUPABASE || {};
  const ok = () => { const c = cfg(); return !!(c.url && c.anonKey && !/VOTRE_|YOUR_/i.test(c.url + c.anonKey)); };
  const headers = () => { const c = cfg(); return { apikey: c.anonKey, Authorization: "Bearer " + c.anonKey }; };
  const sb = () => (window.LTsb && window.LTsb()) || null;

  function save() { try { localStorage.setItem(CACHE_KEY, JSON.stringify(C)); } catch {} }
  function flush() { while (waiters.length) { try { waiters.shift()(); } catch {} } }

  async function load() {
    if (ok()) {
      try {
        const res = await fetch(`${cfg().url}/rest/v1/series_rating_stats?select=manga_id,score,votes`, { headers: headers() });
        if (res.ok) { (await res.json()).forEach(r => { C[r.manga_id] = { s: r.score, v: r.votes }; }); save(); }
      } catch {}
    }
    loaded = true; flush();
    document.dispatchEvent(new Event("lt:ratings"));
  }

  const get = id => C[id] || null;

  async function session() {
    const c = sb(); if (!c) return null;
    try { return (await c.auth.getSession()).data.session || null; } catch { return null; }
  }

  // Sa propre note (null si non connecté ou pas encore noté).
  async function my(id) {
    const c = sb(); if (!c || !id || !(await session())) return null;
    try {
      const { data } = await c.from("series_ratings").select("rating").eq("manga_id", id).maybeSingle();
      return data ? data.rating : null;
    } catch { return null; }
  }

  // Poser / changer sa note. Renvoie {s, v} à jour, ou null (non connecté, erreur).
  async function rate(id, n) {
    const c = sb(); if (!c || !id || !(await session())) return null;
    try {
      const { data, error } = await c.rpc("rate_series", { p_manga: id, p_rating: n });
      if (error || !data || !data.ok) return null;
      C[id] = { s: data.score, v: data.votes }; save();
      document.dispatchEvent(new Event("lt:ratings"));
      return C[id];
    } catch { return null; }
  }

  // Widget « Ta note » : 5 étoiles cliquables + message d'état.
  function widget(root, id) {
    if (!root || !ok()) return;
    root.innerHTML = `
      <div class="rate-box">
        <span class="rate-label">Ta note</span>
        <span class="rate-stars" role="radiogroup" aria-label="Noter cette série">
          ${[1, 2, 3, 4, 5].map(n => `<button type="button" class="rate-star" data-n="${n}" aria-label="${n} étoile${n > 1 ? "s" : ""}">★</button>`).join("")}
        </span>
        <span class="rate-hint" aria-live="polite"></span>
      </div>`;
    const stars = [...root.querySelectorAll(".rate-star")];
    const hint = root.querySelector(".rate-hint");
    let mine = 0, busy = false;
    const paint = h => stars.forEach(b => b.classList.toggle("on", +b.dataset.n <= h));

    stars.forEach(b => {
      b.addEventListener("mouseenter", () => paint(+b.dataset.n));
      b.addEventListener("mouseleave", () => paint(mine));
      b.addEventListener("click", async () => {
        if (busy) return;
        if (!(await session())) {
          hint.innerHTML = `<a href="forum.html">Connecte-toi</a> pour noter (compte du forum).`;
          return;
        }
        busy = true;
        const n = +b.dataset.n;
        const r = await rate(id, n);
        busy = false;
        if (r) { mine = n; paint(mine); hint.textContent = "Merci pour ta note !"; }
        else hint.textContent = "Impossible d'enregistrer, réessaie plus tard.";
      });
    });

    my(id).then(n => { if (n) { mine = n; paint(mine); } });
  }

  window.LTratings = {
    get, my, rate, widget, load,
    ready: fn => { loaded ? fn() : waiters.push(fn); }
  };
  document.addEventListener("lt:ready", load);
})();
