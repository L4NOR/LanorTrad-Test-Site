/* =========================================================================
   LanorTrad — Fil « En ce moment » de l'accueil (activité récente publique :
   commentaires, sujets du forum, succès, nouveaux membres).
   Tape l'API REST Supabase en fetch (pas besoin de la lib supabase-js),
   comme views.js. Section cachée tant qu'il n'y a rien à montrer.
   ⚙️  CONFIG : js/supabase-config.js  ·  🗄️  BASE : supabase/activity.sql
   ========================================================================= */
(function () {
  "use strict";

  const cfg = () => window.LT_SUPABASE || {};
  const ok = () => { const c = cfg(); return !!(c.url && c.anonKey && !/VOTRE_|YOUR_/i.test(c.url + c.anonKey)); };

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function line(it) {
    const u = `<a class="pu-user" href="forum.html#/u/${encodeURIComponent(it.username)}">${esc(it.username)}</a>`;
    const when = `<span class="pu-when">${window.LT.timeAgo(it.at)}</span>`;
    switch (it.type) {
      case "comment": {
        const s = window.LT.seriesById && window.LT.seriesById(it.ref);
        const title = s ? s.title : it.ref;
        const href = `reader.html?manga=${encodeURIComponent(it.ref)}&chapter=${encodeURIComponent(it.ref2)}`;
        return `<div class="pu-item" data-reveal><span class="pu-ico">💬</span><p>${u} a commenté
          <a href="${href}">${esc(title)} · ch. ${esc(it.ref2)}</a></p>${when}</div>`;
      }
      case "topic":
        return `<div class="pu-item" data-reveal><span class="pu-ico">🗣️</span><p>${u} a ouvert
          <a href="forum.html#/t/${esc(it.ref2)}">« ${esc(it.ref)} »</a> sur le forum</p>${when}</div>`;
      case "achievement":
        return `<div class="pu-item" data-reveal><span class="pu-ico">🏆</span><p>${u} a débloqué
          <b>« ${esc(it.ref)} »</b></p>${when}</div>`;
      case "member":
        return `<div class="pu-item" data-reveal><span class="pu-ico">👋</span><p>${u} a rejoint la communauté
          — bienvenue !</p>${when}</div>`;
      default: return "";
    }
  }

  async function load() {
    const sec = document.getElementById("pulse-section");
    const box = document.getElementById("pulse-feed");
    if (!sec || !box || !ok()) return;
    try {
      const c = cfg();
      const res = await fetch(`${c.url}/rest/v1/rpc/recent_activity`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: c.anonKey, Authorization: "Bearer " + c.anonKey },
        body: JSON.stringify({ p_limit: 8 })
      });
      if (!res.ok) return;
      const data = await res.json();
      const items = (data && data.ok && data.items) || [];
      if (items.length < 2) return;                       // trop calme → on n'affiche rien
      box.innerHTML = items.map(line).join("");
      sec.style.display = "";
      window.LT && window.LT._scanReveals && window.LT._scanReveals();
    } catch {}
  }

  document.addEventListener("lt:ready", load);
})();
