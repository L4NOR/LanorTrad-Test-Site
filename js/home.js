/* =========================================================================
   LanorTrad — Accueil : grilles, derniers chapitres, compteurs, marquee
   ========================================================================= */
(function () {
  "use strict";

  function init() {
    const S = window.SERIES || [];
    const C = window.CHAPTERS || {};

    /* — À la une : carrousel vedette (spotlight) — */
    const spot = document.getElementById("spotlight");
    if (spot) {
      const featAll = S.filter(s => s.featured);
      const feat = (featAll.length ? featAll : [...S].sort((a, b) => (b.rating || 0) - (a.rating || 0))).slice(0, 6);
      const g = id => document.getElementById(id);
      const elInfo = spot.querySelector(".sl-info");
      const thumbsEl = g("sl-thumbs");
      let cur = 0, timer = null;

      thumbsEl.innerHTML = feat.map((s, i) => `<button class="sl-thumb" data-i="${i}" aria-label="${s.title}"><img src="${window.LT.cover(s.cover, 120)}" alt="${s.title}" loading="lazy"></button>`).join("");
      const thumbs = [...thumbsEl.children];
      thumbs.forEach(b => b.addEventListener("click", () => { show(+b.dataset.i); restart(); }));

      function show(i) {
        cur = (i + feat.length) % feat.length;
        const s = feat[cur];
        spot.style.setProperty("--accent", s.accent);
        // Fond flou : une petite variante suffit largement.
        g("sl-bg").style.backgroundImage = `url('${window.LT.cover(s.cover, 240)}')`;
        const slImg = g("sl-img");
        window.LT.applyCover(slImg, s.cover, "(max-width:900px) 55vw, 330px");
        slImg.alt = s.title;
        g("sl-cover").href = s.url; g("sl-more").href = s.url;
        g("sl-genres").innerHTML = s.genres.slice(0, 3).map(x => `<span>${x}</span>`).join("");
        g("sl-title").textContent = s.title;
        g("sl-rating").innerHTML = `${window.LT.stars(s.rating)} <b>${s.rating}</b> <span>·</span> ${s.chapters} chapitres <span>·</span> ${s.status}`;
        g("sl-syn").textContent = s.description;
        const read = g("sl-read");
        if (window.LT.playable(s)) { read.href = `reader.html?manga=${encodeURIComponent(s.id)}`; read.querySelector("span").textContent = "Lire maintenant"; }
        else { read.href = s.url; read.querySelector("span").textContent = "Voir l'œuvre"; }
        thumbs.forEach((b, k) => b.classList.toggle("on", k === cur));
        elInfo.classList.remove("swap"); void elInfo.offsetWidth; elInfo.classList.add("swap");
        window.LTpalette.get(window.LT.cover(s.cover, 120)).then(hex => { if (hex && cur === i) spot.style.setProperty("--accent", hex); });
      }
      function restart() { clearInterval(timer); timer = setInterval(() => show(cur + 1), 6000); }
      spot.addEventListener("pointerenter", () => clearInterval(timer));
      spot.addEventListener("pointerleave", restart);
      show(0); restart();
    }

    /* — Prochaines sorties (calendrier) — */
    const rel = document.getElementById("releases");
    if (rel) {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const list = (window.SCHEDULE || [])
        .map(r => ({ r, s: window.LT.seriesById(r.id), d: new Date(r.date) }))
        .filter(x => x.s && x.d >= today)
        .sort((a, b) => a.d - b.d)
        .slice(0, 6);
      const relSec = document.getElementById("releases-section");
      if (!list.length) { if (relSec) relSec.style.display = "none"; }
      else {
        rel.innerHTML = list.map(({ r, s, d }) => {
          const lbl = dateLabel(d, today);
          const stCls = r.status === "Confirmé" ? "ok" : r.status === "Reporté" ? "late" : "est";
          const href = window.LT.playable(s) ? `manga.html?id=${encodeURIComponent(s.id)}` : s.url;
          // Aperçu : première page du chapitre annoncé s'il est déjà sorti,
          // sinon celle du dernier paru.
          const peek = window.LTpreview ? window.LTpreview.btnFor(s, r.chapters) : "";
          // Avancement du chapitre en fabrication (atelier), s'il est déclaré.
          const atl = window.LTatelier ? window.LTatelier.get(s.id) : null;
          const gauge = atl && atl.chapter === String(r.chapters) ? window.LTatelier.mini(atl) : "";
          return `<div class="rel-cell${peek ? " has-peek" : ""}">
            <a class="rel" href="${href}" style="--accent:${s.accent}" data-colorize data-cover="${window.LT.cover(s.cover, 120)}">
            <img src="${window.LT.cover(s.cover, 120)}" alt="${s.title}" data-fade loading="lazy">
            <div class="ri">
              <h4>${s.title}</h4>
              <div class="meta"><span class="ch">Ch. ${r.chapters}</span><span>·</span><span class="when ${lbl.soon ? "soon" : ""}">${lbl.text}</span></div>
              ${gauge ? `<div class="rel-atl">${gauge}</div>` : ""}
            </div>
            <span class="badge-st ${stCls}">${r.status}</span>
          </a>${peek}</div>`;
        }).join("");
      }
    }

    /* — Continuer la lecture (rail) — */
    const contSec = document.getElementById("continue-section");
    const rail = document.getElementById("continue-rail");
    if (rail) {
      const hist = window.LTstore.history();
      if (!hist.length) { if (contSec) contSec.style.display = "none"; }
      else {
        if (contSec) contSec.style.display = "";
        rail.innerHTML = hist.slice(0, 10).map(({ s, p }) => {
          const chs = C[s.id] || [];
          const ch = chs.find(c => c.num === p.chapter);
          const pct = ch && ch.pages ? Math.min(100, Math.round(((p.page || 0) / ch.pages) * 100)) : 0;
          const href = window.LT.playable(s) ? `reader.html?manga=${encodeURIComponent(s.id)}&chapter=${p.chapter}` : s.url;
          return `<a class="rc" href="${href}" data-colorize data-cover="${window.LT.cover(s.cover, 120)}" style="--accent:${s.accent}">
            <img src="${window.LT.cover(s.cover, 240)}" alt="${s.title}" data-fade loading="lazy">
            <div class="info"><h4>${s.title}</h4><span class="ch">Chapitre ${p.chapter}</span><div class="pbar"><i style="width:${pct}%"></i></div></div>
            <span class="play">${playIcon()}</span>
          </a>`;
        }).join("");
      }
    }

    /* — Pour toi : recommandations selon les genres suivis / déjà lus — */
    const fySec = document.getElementById("foryou-section");
    const fyGrid = document.getElementById("foryou-grid");
    if (fyGrid) {
      const recs = recommendFor(S);
      if (recs.length) { if (fySec) fySec.style.display = ""; fyGrid.innerHTML = recs.map(LTcard).join(""); }
      else if (fySec) fySec.style.display = "none";
    }

    /* — Tendances : top des séries les plus lues (compteurs Supabase) — */
    const trSec = document.getElementById("trending-section");
    const trGrid = document.getElementById("trending-grid");
    if (trGrid && window.LTviews) window.LTviews.ready(() => {
      const list = window.LTviews.trending(6).map(id => window.LT.seriesById(id)).filter(Boolean);
      if (list.length >= 3) {
        if (trSec) trSec.style.display = "";
        trGrid.innerHTML = list.map(LTcard).join("");
        document.dispatchEvent(new Event("lt:cards"));
      } else if (trSec) trSec.style.display = "none";
    });

    /* — Séries populaires (mangas d'abord) — */
    const pop = document.getElementById("popular-grid");
    if (pop) {
      const ordered = [...S].sort((a, b) => (b.rating || 0) - (a.rating || 0));
      pop.innerHTML = ordered.map(LTcard).join("");
    }

    /* — Derniers chapitres — */
    const latest = document.getElementById("latest-grid");
    if (latest) {
      const rows = [];
      S.forEach(s => {
        const list = C[s.id];
        if (list && list.length) {
          list.slice(0, 2).forEach(ch =>
            rows.push({ s, num: ch.num, date: s.lastUpdate, sort: new Date(s.lastUpdate || 0).getTime() + parseFloat(ch.num) }));
        } else if (s.type === "manga") {
          rows.push({ s, num: s.chapters, date: s.lastUpdate, sort: new Date(s.lastUpdate || 0).getTime() });
        }
      });
      rows.sort((a, b) => b.sort - a.sort);
      latest.innerHTML = rows.slice(0, 6).map(r => {
        const href = window.LT.playable(r.s) ? `reader.html?manga=${encodeURIComponent(r.s.id)}&chapter=${r.num}` : r.s.url;
        return `
        <a class="latest" href="${href}">
          <img src="${window.LT.cover(r.s.cover, 120)}" alt="${r.s.title}" loading="lazy">
          <div class="info">
            <h4>${r.s.title}</h4>
            <span class="ch">Chapitre ${r.num}</span>
            <span class="when">${window.LT.timeAgo(r.date)}</span>
          </div>
        </a>`;
      }).join("");
    }

    /* — Compteurs animés — */
    const mangas = S.filter(s => s.type === "manga").length;
    const oneshots = S.filter(s => s.type === "oneshot").length;
    const totalCh = S.reduce((n, s) => n + (s.chapters || 0), 0);
    setCounter("stat-series", mangas);
    setCounter("stat-chapters", totalCh, "+");

    /* — Marquee de genres — */
    const mq = document.getElementById("genre-track");
    if (mq) {
      const genres = [...new Set(S.flatMap(s => s.genres))].filter(g => g !== "LanorTrad");
      // Des liens, pas des <span> : c'est le seul chemin qu'un robot a pour
      // découvrir les vues par genre depuis l'accueil, et ça rend enfin le
      // bandeau cliquable — il ne servait à rien jusqu'ici.
      const pills = genres.map(g =>
        `<a class="pill" href="catalogue.html?genre=${encodeURIComponent(g)}">${g}</a>`).join("");
      mq.innerHTML = pills + pills; // doublé pour boucle continue
    }

    // re-scan tilt + reveals
    document.dispatchEvent(new Event("lt:cards"));
    window.LT && window.LT._scanReveals && window.LT._scanReveals();
  }

  function playIcon() { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`; }

  // Recommandations : score les séries non suivies/non lues par affinité de genre
  // avec ce que le lecteur suit ou a déjà commencé. Vide si aucune donnée.
  function recommendFor(S) {
    const store = window.LTstore;
    if (!store) return [];
    const seeds = new Set([...store.follows(), ...store.history().map(h => h.s.id)]);
    if (!seeds.size) return [];
    const weight = {};
    S.filter(s => seeds.has(s.id)).forEach(s =>
      s.genres.forEach(g => { if (g !== "LanorTrad") weight[g] = (weight[g] || 0) + 1; }));
    return S.filter(s => !seeds.has(s.id))
      .map(s => ({ s, score: s.genres.reduce((n, g) => n + (weight[g] || 0), 0) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score || (b.s.rating || 0) - (a.s.rating || 0))
      .slice(0, 6).map(x => x.s);
  }

  function dateLabel(d, today) {
    const diff = Math.round((d.setHours(0, 0, 0, 0) - today.getTime()) / 86400000);
    if (diff <= 0) return { text: "Aujourd'hui", soon: true };
    if (diff === 1) return { text: "Demain", soon: true };
    return { text: new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "long" }), soon: diff <= 6 };
  }

  function setCounter(id, target, suffix = "") {
    const el = document.getElementById(id);
    if (!el) return;
    const io = new IntersectionObserver((ents) => {
      ents.forEach(e => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const dur = 1400, t0 = performance.now();
        (function tick(now) {
          const p = Math.min((now - t0) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * eased).toLocaleString("fr-FR") + (p === 1 ? suffix : "");
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: .5 });
    io.observe(el);
  }

  document.addEventListener("lt:ready", init);
})();
