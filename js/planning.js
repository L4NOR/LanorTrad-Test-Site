/* =========================================================================
   LanorTrad — Planning : calendrier hebdo (jour de sortie habituel) + timeline
   ========================================================================= */
(function () {
  "use strict";
  const DAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

  function init() {
    const S = (window.SERIES || []).filter(s => s.type === "manga" && s.status && s.status.toLowerCase().includes("cours"));
    const C = window.CHAPTERS || {};

    /* — Calendrier hebdo : la SEMAINE EN COURS, du lundi au dimanche —

       Ce calendrier placait chaque serie sur le jour de semaine de sa DERNIERE
       mise a jour, puis ecrivait « Ch. 169 a venir » dessus. Autrement dit il
       fabriquait une promesse de sortie a partir d'une date passee : la
       section annonce « cette semaine », le lecteur lit qu'un chapitre arrive
       samedi, et rien ne sort. Une serie mise a jour un 11 juillet occupait
       encore le samedi de toutes les semaines suivantes.

       On ne pose donc plus que des dates REELLES, et seulement celles qui
       tombent dans la semaine en cours. Trois sources, aucune deduction :
       ce qui est deja sorti, ce qui est annonce, ce qui est vise. Quand la
       semaine est vide, on le dit en une phrase au lieu d'afficher sept
       colonnes de « Pas de sortie prevue ». */
    // « 1er septembre », jamais « 1 septembre » : le premier du mois est le seul
    // ordinal en francais, et il tombe forcement dans une semaine sur quatre.
    const dateCourte = d => {
      const jour = d.getDate() === 1 ? "1er" : String(d.getDate());
      return jour + " " + d.toLocaleDateString("fr-FR", { month: "short" });
    };

    const week = document.getElementById("week");
    if (week) {
      const JOUR = 86400000;
      const minuit = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
      const today = minuit(new Date());
      // Lundi de la semaine en cours (getDay : 0 = dimanche, d'ou le +6 % 7).
      const lundi = minuit(today.getTime() - ((today.getDay() + 6) % 7) * JOUR);
      const jours = Array.from({ length: 7 }, (_, k) => minuit(lundi.getTime() + k * JOUR));
      const cle = d => minuit(d).getTime();
      const dansLaSemaine = d => {
        const t = cle(d);
        return !isNaN(t) && t >= jours[0].getTime() && t <= jours[6].getTime();
      };

      const parJour = {};
      const poser = (date, item) => { (parJour[cle(date)] = parJour[cle(date)] || []).push(item); };
      const dejaPose = (date, id) => (parJour[cle(date)] || []).some(x => x.s.id === id);

      // 1. Ce qui est SORTI cette semaine.
      S.forEach(s => {
        if (!s.lastUpdate || !dansLaSemaine(s.lastUpdate)) return;
        poser(s.lastUpdate, { s, num: C[s.id] ? C[s.id][0].num : null, etat: "sorti" });
      });

      // 2. Ce qui est ANNONCE cette semaine (js/data/schedule.js).
      (window.SCHEDULE || []).forEach(r => {
        const s = r && window.LT.seriesById(r.id);
        if (!s || !r.date || !dansLaSemaine(r.date) || dejaPose(r.date, s.id)) return;
        poser(r.date, { s, num: r.chapters, etat: "prevu", statut: r.status });
      });

      // 3. Ce qui est VISE cette semaine : la date `eta` de l'atelier. C'est une
      //    intention datee par la team, pas une deduction — elle a sa place ici,
      //    mais annoncee comme telle (« vise »), jamais comme une sortie confirmee.
      (window.SERIES || []).forEach(s => {
        const a = window.LTatelier && window.LTatelier.get(s.id);
        if (!a || !a.eta || !dansLaSemaine(a.eta) || dejaPose(a.eta, s.id)) return;
        poser(a.eta, { s, num: a.chapter, etat: "vise", atl: a });
      });

      const total = Object.keys(parJour).reduce((n, k) => n + parJour[k].length, 0);

      if (!total) {
        week.classList.add("is-empty");
        week.innerHTML = `<p class="week-none">Aucune sortie n'est prévue cette semaine.
          Ce qui avance en ce moment est juste en dessous, à l'atelier.</p>`;
      } else {
        week.classList.remove("is-empty");
        const LIB = { sorti: "sorti", prevu: "prévu", vise: "visé" };
        week.innerHTML = jours.map(d => {
          const liste = parJour[cle(d)] || [];
          const estAujourdhui = cle(d) === today.getTime();
          const items = liste.length ? liste.map(it => {
            const s = it.s;
            const atl = it.atl || (window.LTatelier ? window.LTatelier.get(s.id) : null);
            // La jauge n'accompagne que ce qui n'est pas encore sorti, et
            // seulement si l'atelier parle bien du meme chapitre.
            const gauge = atl && it.etat !== "sorti" && String(atl.chapter) === String(it.num)
              ? window.LTatelier.mini(atl) : "";
            const peek = window.LTpreview ? window.LTpreview.btnFor(s, it.num) : "";
            const href = it.etat === "sorti" && it.num != null
              ? window.LT.urlChapter(s, it.num) : window.LT.urlSeries(s);
            const libelle = it.num == null ? LIB[it.etat]
              : `Ch. ${it.num} ${it.statut === "Reporté" ? "reporté" : LIB[it.etat]}`;
            return `<div class="pl-cell${peek ? " has-peek" : ""}${gauge ? " has-atl" : ""}" style="--accent:${s.accent}">
              <a class="pl-item is-${it.etat}" href="${href}" style="--accent:${s.accent}" data-colorize data-cover="${window.LT.cover(s.cover, 120)}">
              <img src="${window.LT.cover(s.cover, 120)}" alt="${s.title}" data-fade loading="lazy">
              <div><div class="t">${s.title}</div><div class="c">${libelle}</div></div></a>${gauge}${peek}</div>`;
          }).join("") : `<div class="empty-d">Rien ce jour-là</div>`;
          return `<div class="day ${estAujourdhui ? "today" : ""}">
            <div class="dh"><span class="name">${DAYS[d.getDay()]}</span>
              <span class="dnum">${dateCourte(d)}</span>
              ${estAujourdhui ? `<span class="tag">Aujourd'hui</span>` : ""}</div>
            ${items}</div>`;
        }).join("");
      }
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
        const last = C[s.id] ? C[s.id][0].num : window.LT.nbChapitres(s);
        const href = window.LT.playable(s) ? window.LT.urlChapter(s, last) : window.LT.urlSeries(s);
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
