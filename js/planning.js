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
          const next = (C[s.id] ? parseFloat(C[s.id][0].num) + 1 : s.chapters + 1);
          return `<a class="pl-item" href="${s.url}" style="--accent:${s.accent}" data-colorize data-cover="${s.cover}">
            <img src="${s.cover}" alt="${s.title}" data-fade loading="lazy">
            <div><div class="t">${s.title}</div><div class="c">Ch. ${next} à venir</div></div></a>`;
        }).join("") : `<div class="empty-d">Pas de sortie prévue</div>`;
        return `<div class="day ${dow === todayDow ? "today" : ""}">
          <div class="dh"><span class="name">${DAYS[dow]}</span>${dow === todayDow ? `<span class="tag">Aujourd'hui</span>` : ""}</div>
          ${items}</div>`;
      }).join("");
    }

    // — Timeline des dernières sorties —
    const tl = document.getElementById("timeline");
    if (tl) {
      const rows = (window.SERIES || []).filter(s => s.lastUpdate)
        .sort((a, b) => new Date(b.lastUpdate) - new Date(a.lastUpdate)).slice(0, 8);
      tl.innerHTML = rows.map(s => {
        const last = C[s.id] ? C[s.id][0].num : s.chapters;
        const href = window.LT.playable(s) ? `reader.html?manga=${encodeURIComponent(s.id)}&chapter=${last}` : s.url;
        return `<div class="tl-row" style="--accent:${s.accent}" data-reveal="left">
          <a class="tl-card" href="${href}" data-colorize data-cover="${s.cover}">
            <img src="${s.cover}" alt="${s.title}" data-fade loading="lazy">
            <div class="ti"><h4>${s.title}</h4><div class="ch">Chapitre ${last}</div><div class="dt">${frDate(s.lastUpdate)} · ${window.LT.timeAgo(s.lastUpdate)}</div></div>
          </a></div>`;
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
