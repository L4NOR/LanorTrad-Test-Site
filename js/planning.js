/* =========================================================================
   LanorTrad — Planning : calendrier hebdo (jour de sortie habituel) + timeline
   ========================================================================= */
(function () {
  "use strict";
  const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const ORDER = [1, 2, 3, 4, 5, 6, 0]; // affiche Lundi → Dimanche

  function init() {
    const S = (window.SERIES || []).filter(s => s.type === "manga" && s.status && s.status.toLowerCase().includes("cours"));
    const C = window.CHAPTERS || {};

    // — Calendrier hebdo : chaque série sur le jour de semaine de sa dernière MàJ —
    const week = document.getElementById("week");
    if (week) {
      const todayDow = new Date().getDay();
      const byDay = {};
      S.forEach(s => {
        const d = s.lastUpdate ? new Date(s.lastUpdate).getDay() : 6;
        (byDay[d] = byDay[d] || []).push(s);
      });
      week.innerHTML = ORDER.map(dow => {
        const list = (byDay[dow] || []);
        const items = list.length ? list.map(s => {
          // L'atelier fait autorité sur le numéro à venir quand il est déclaré ;
          // sinon on déduit le suivant du dernier chapitre paru.
          const atl = window.LTatelier ? window.LTatelier.get(s.id) : null;
          const next = atl ? atl.chapter : (C[s.id] ? parseFloat(C[s.id][0].num) + 1 : s.chapters + 1);
          // Aperçu : le chapitre à venir n'a pas encore de pages, on montre
          // donc la première page du dernier chapitre paru (libellé explicite).
          const peek = window.LTpreview ? window.LTpreview.btnFor(s, next) : "";
          const gauge = atl ? window.LTatelier.mini(atl) : "";
          return `<div class="pl-cell${peek ? " has-peek" : ""}${gauge ? " has-atl" : ""}" style="--accent:${s.accent}">
            <a class="pl-item" href="${s.url}" style="--accent:${s.accent}" data-colorize data-cover="${window.LT.cover(s.cover, 120)}">
            <img src="${window.LT.cover(s.cover, 120)}" alt="${s.title}" data-fade loading="lazy">
            <div><div class="t">${s.title}</div><div class="c">Ch. ${next} à venir</div></div></a>${gauge}${peek}</div>`;
        }).join("") : `<div class="empty-d">Pas de sortie prévue</div>`;
        return `<div class="day ${dow === todayDow ? "today" : ""}">
          <div class="dh"><span class="name">${DAYS[dow]}</span>${dow === todayDow ? `<span class="tag">Aujourd'hui</span>` : ""}</div>
          ${items}</div>`;
      }).join("");
    }

    // — À l'atelier : l'avancement des chapitres en fabrication —
    const atlSec = document.getElementById("atelier-section");
    const atlGrid = document.getElementById("atelier-grid");
    if (atlGrid && window.LTatelier) {
      const rows = window.LTatelier.all();
      if (rows.length) {
        atlSec.style.display = "";
        atlGrid.innerHTML = rows.map(e => window.LTatelier.card(e, { series: true })).join("");
      }
    }

    // — Timeline des dernières sorties —
    const tl = document.getElementById("timeline");
    if (tl) {
      const rows = (window.SERIES || []).filter(s => s.lastUpdate)
        .sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate)).slice(0, 8);
      tl.innerHTML = rows.map(s => {
        const last = C[s.id] ? C[s.id][0].num : s.chapters;
        const href = window.LT.playable(s) ? `reader.html?manga=${encodeURIComponent(s.id)}&chapter=${last}` : s.url;
        const peek = window.LTpreview ? window.LTpreview.btnFor(s, last) : "";
        return `<div class="tl-row${peek ? " has-peek" : ""}" style="--accent:${s.accent}" data-reveal="left">
          <a class="tl-card" href="${href}" data-colorize data-cover="${window.LT.cover(s.cover, 120)}">
            <img src="${window.LT.cover(s.cover, 120)}" alt="${s.title}" data-fade loading="lazy">
            <div class="ti"><h4>${s.title}</h4><div class="ch">Chapitre ${last}</div><div class="dt">${frDate(s.lastUpdate)} · ${window.LT.timeAgo(s.lastUpdate)}</div></div>
          </a>${peek}</div>`;
      }).join("");
    }

    document.dispatchEvent(new Event("lt:cards"));
    window.LT._scanReveals && window.LT._scanReveals();
  }

  function frDate(s) {
    try { return new Date(s).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return s; }
  }

  document.addEventListener("lt:ready", init);
})();
