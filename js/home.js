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

      thumbsEl.innerHTML = feat.map((s, i) => `<button class="sl-thumb" data-i="${i}" aria-label="${s.title}"><img src="${s.cover}" alt="${s.title}" loading="lazy"></button>`).join("");
      const thumbs = [...thumbsEl.children];
      thumbs.forEach(b => b.addEventListener("click", () => { show(+b.dataset.i); restart(); }));

      function show(i) {
        cur = (i + feat.length) % feat.length;
        const s = feat[cur];
        spot.style.setProperty("--accent", s.accent);
        g("sl-bg").style.backgroundImage = `url('${s.cover}')`;
        const slImg = g("sl-img");
        slImg.src = s.cover; slImg.alt = s.title;
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
        window.LTpalette.get(s.cover).then(hex => { if (hex && cur === i) spot.style.setProperty("--accent", hex); });
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
          return `<a class="rel" href="${href}" style="--accent:${s.accent}" data-colorize data-cover="${s.cover}">
            <img src="${s.cover}" alt="${s.title}" data-fade loading="lazy">
            <div class="ri">
              <h4>${s.title}</h4>
              <div class="meta"><span class="ch">Ch. ${r.chapters}</span><span>·</span><span class="when ${lbl.soon ? "soon" : ""}">${lbl.text}</span></div>
            </div>
            <span class="badge-st ${stCls}">${r.status}</span>
          </a>`;
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
          return `<a class="rc" href="${href}" data-colorize data-cover="${s.cover}" style="--accent:${s.accent}">
            <img src="${s.cover}" alt="${s.title}" data-fade loading="lazy">
            <div class="info"><h4>${s.title}</h4><span class="ch">Chapitre ${p.chapter}</span><div class="pbar"><i style="width:${pct}%"></i></div></div>
            <span class="play">${playIcon()}</span>
          </a>`;
        }).join("");
      }
    }

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
          <img src="${r.s.cover}" alt="${r.s.title}" loading="lazy">
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
    setCounter("stat-oneshots", oneshots);
    setCounter("stat-readers", 12, "k+");

    /* — Marquee de genres — */
    const mq = document.getElementById("genre-track");
    if (mq) {
      const genres = [...new Set(S.flatMap(s => s.genres))].filter(g => g !== "LanorTrad");
      const pills = genres.map(g => `<span class="pill">${g}</span>`).join("");
      mq.innerHTML = pills + pills; // doublé pour boucle continue
    }

    // re-scan tilt + reveals
    document.dispatchEvent(new Event("lt:cards"));
    window.LT && window.LT._scanReveals && window.LT._scanReveals();
  }

  function playIcon() { return `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`; }

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
