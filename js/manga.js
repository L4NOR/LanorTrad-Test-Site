/* =========================================================================
   LanorTrad — Fiche série : rendu data-driven + liste de chapitres
   ========================================================================= */
(function () {
  "use strict";

  function init() {
    const id = new URLSearchParams(location.search).get("id");
    const s = window.LT.seriesById(id);
    const root = document.getElementById("series-root");
    if (!root) return;

    if (!s) {
      root.innerHTML = `<div class="wrap empty" style="padding-top:160px"><div class="big">📭</div><p>Série introuvable.</p><a class="btn btn-primary" href="catalogue.html" style="margin-top:18px">Retour au catalogue</a></div>`;
      window.LT._scanReveals && window.LT._scanReveals();
      return;
    }

    document.title = `${s.title} — LanorTrad`;
    setSeo(s);
    window.LTstore.markSeen(s.id);   // consulter la fiche « consomme » la nouveauté
    const chapters = (window.CHAPTERS || {})[s.id] || [];
    const progress = window.LTstore.progress(s.id);
    const gallery = (window.GALLERY || {})[s.id] || null;
    const hasGallery = !!(gallery && ((gallery.tomes && gallery.tomes.length) || (gallery.colors && gallery.colors.length)));
    let activeBlock = null;

    // En-tête
    root.innerHTML = `
      <section class="series-hero" style="--accent:${s.accent}">
        <div class="series-backdrop" style="background-image:url('${s.cover}')"></div>
        <div class="wrap">
          <div class="series-top">
            <div class="series-cover m-card" data-reveal="left">
              <div class="inner" style="view-transition-name:cover-active"><img src="${s.cover}" alt="${s.title}"></div>
            </div>
            <div class="series-info" data-reveal="right">
              <span class="eyebrow">${s.type === "oneshot" ? "Oneshot" : "Série"} · ${s.status}</span>
              <h1>${s.title}</h1>
              <div class="series-meta">
                <span>${window.LT.stars(s.rating)} <b>${s.rating}</b></span><span class="dot"></span>
                <span>Par <b>${s.author}</b></span><span class="dot"></span>
                <span><b>${s.chapters}</b> chapitre${s.chapters > 1 ? "s" : ""}</span><span class="dot"></span>
                <span>MàJ ${window.LT.timeAgo(s.lastUpdate) || "—"}</span>
              </div>
              <div class="tag-row">${s.genres.map(g => `<a class="tag" href="catalogue.html?q=${encodeURIComponent(g)}">${g}</a>`).join("")}</div>
              <p class="series-desc">${s.description}</p>
              <div class="series-actions" id="series-actions"></div>
              <div id="collab-block"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="section" style="padding-top:30px">
        <div class="wrap">
          <div class="tabs" id="series-tabs">
            <button class="tab on" data-tab="chapitres">Chapitres</button>
            ${hasGallery ? `<button class="tab" data-tab="galerie">Galerie</button>` : ""}
          </div>

          <div class="tab-panel" id="panel-chapitres">
            <div class="chap-bar">
              <div class="f-search">
                <span class="ico"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg></span>
                <input type="search" id="chap-search" placeholder="N° de chapitre…">
              </div>
              <div class="select order"><select id="chap-order"><option value="desc">Plus récents</option><option value="asc">Plus anciens</option></select></div>
            </div>
            <div id="chap-notice"></div>
            <div class="chap-ranges" id="chap-ranges"></div>
            <div class="chap-list" id="chap-list"></div>
          </div>

          <div class="tab-panel" id="panel-galerie" hidden></div>
        </div>
      </section>

      <section class="section" id="related-section" style="padding-top:0;display:none">
        <div class="wrap">
          <div class="section-head" data-reveal><div><span class="eyebrow">Dans le même esprit</span><h2>Séries similaires</h2></div></div>
          <div class="card-grid cards-row" id="related-grid" data-reveal data-delay="1"></div>
        </div>
      </section>`;

    // Boutons d'action
    const actions = document.getElementById("series-actions");
    if (chapters.length) {
      const first = chapters[chapters.length - 1].num;
      actions.innerHTML =
        `<a class="btn btn-primary" href="reader.html?manga=${enc(s.id)}&chapter=${first}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg> Commencer le chapitre ${first}</a>`;
      if (progress) actions.innerHTML =
        `<a class="btn btn-primary" href="reader.html?manga=${enc(s.id)}&chapter=${progress.chapter}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg> Reprendre le chapitre ${progress.chapter}</a>` +
        `<a class="btn btn-ghost" href="reader.html?manga=${enc(s.id)}&chapter=${first}">Recommencer</a>`;
    } else {
      actions.innerHTML = `<a class="btn btn-ghost" href="https://discord.gg/md37S7nhkZ" target="_blank" rel="noopener">📢 Suivre les sorties sur Discord</a>`;
    }

    // Liste de chapitres (avec pagination par tranches si > 50)
    const search = document.getElementById("chap-search");
    const order = document.getElementById("chap-order");
    const list = document.getElementById("chap-list");
    const notice = document.getElementById("chap-notice");
    const rangesEl = document.getElementById("chap-ranges");
    const RANGE = 50;
    const blockOf = num => Math.floor((Math.ceil(parseFloat(num)) - 1) / RANGE);

    if (!chapters.length) {
      notice.innerHTML = `<div class="notice">⏳ Les chapitres de cette série arrivent bientôt. <b>${s.chapters}</b> chapitres au total.</div>`;
    }

    function render() {
      const term = search.value.trim();
      const base = chapters.length ? chapters
        : Array.from({ length: s.chapters }, (_, i) => ({ num: String(s.chapters - i), pages: 0, locked: true }));
      let data = base.slice();
      const useRanges = !term && base.length > RANGE;

      if (useRanges) {
        const blocks = [...new Set(base.map(c => blockOf(c.num)))].sort((a, b) => b - a);
        if (activeBlock === null || !blocks.includes(activeBlock)) activeBlock = blocks[0];
        rangesEl.style.display = "flex";
        rangesEl.innerHTML = blocks.map(b =>
          `<button class="range-chip ${b === activeBlock ? "on" : ""}" data-b="${b}">${b * RANGE + 1}–${b * RANGE + RANGE}</button>`).join("");
        rangesEl.querySelectorAll(".range-chip").forEach(ch =>
          ch.addEventListener("click", () => { activeBlock = +ch.dataset.b; render(); }));
        data = data.filter(c => blockOf(c.num) === activeBlock);
      } else {
        rangesEl.style.display = "none";
        if (term) data = data.filter(c => c.num.includes(term));
      }
      if (order.value === "asc") data = data.slice().reverse();

      list.innerHTML = data.map(c => {
        if (c.locked) return `<div class="chap-item locked"><span class="n">Ch. ${c.num}</span><span class="pages">🔒</span></div>`;
        const isRead = progress && parseFloat(c.num) < parseFloat(progress.chapter);
        const isCur = progress && c.num === progress.chapter;
        return `<a class="chap-item ${isRead ? "read" : ""}" href="reader.html?manga=${enc(s.id)}&chapter=${c.num}">
            <span class="n">Ch. ${c.num}</span>
            ${isCur ? `<span class="resume-dot" title="Reprise"></span>` : `<span class="pages">${c.pages} p.</span>`}
          </a>`;
      }).join("");
      document.dispatchEvent(new Event("lt:cards"));
    }
    search.addEventListener("input", render);
    order.addEventListener("change", render);
    render();

    // Onglets Chapitres / Galerie
    if (hasGallery) {
      renderGallery(gallery, s.id);
      document.querySelectorAll("#series-tabs .tab").forEach(t => t.addEventListener("click", () => {
        document.querySelectorAll("#series-tabs .tab").forEach(x => x.classList.toggle("on", x === t));
        document.getElementById("panel-chapitres").hidden = t.dataset.tab !== "chapitres";
        document.getElementById("panel-galerie").hidden = t.dataset.tab !== "galerie";
      }));
    }

    // Bouton « Suivre » (repérer les nouveaux chapitres → Bibliothèque)
    actions.insertAdjacentHTML("beforeend",
      `<button class="btn btn-ghost follow-toggle" id="follow-toggle">
        <svg class="bicon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        <span class="follow-lbl"></span></button>`);
    const followBtn = document.getElementById("follow-toggle");
    const syncFollow = () => {
      const on = window.LTstore.isFollowing(s.id);
      followBtn.classList.toggle("on", on);
      followBtn.querySelector(".follow-lbl").textContent = on ? "Suivi" : "Suivre";
    };
    followBtn.addEventListener("click", () => {
      const added = window.LTstore.toggleFollow(s.id);
      syncFollow();
      followBtn.classList.remove("pop"); void followBtn.offsetWidth; followBtn.classList.add("pop");
      window.LT.toast(added ? "🔔 Série suivie — retrouvez les nouveautés dans la Bibliothèque" : "Suivi retiré");
    });
    syncFollow();

    // Collaboration : équipes partenaires (hors LanorTrad)
    if (s.partners && s.partners.length) {
      const cards = s.partners.map(p => {
        const ini = p.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase();
        const c = p.color || "#a855f7";
        const inner = `<span class="collab-ava">${ini}</span>
            <span class="collab-info"><b>${p.name}</b><span>Team partenaire</span></span>
            ${p.url ? `<span class="collab-go">↗</span>` : ""}`;
        return p.url
          ? `<a class="collab-card" style="--c:${c}" href="${p.url}" target="_blank" rel="noopener">${inner}</a>`
          : `<div class="collab-card" style="--c:${c}">${inner}</div>`;
      }).join("");
      document.getElementById("collab-block").innerHTML = `
        <div class="collab">
          <div class="collab-head">${handshake()} En collaboration avec
            <span class="collab-note">— ces équipes ne font pas partie de LanorTrad</span>
          </div>
          <div class="collab-list">${cards}</div>
        </div>`;
    }

    // Accent extrait de la couverture
    window.LTpalette.get(s.cover).then(hex => { if (hex) document.querySelector(".series-hero").style.setProperty("--accent", hex); });

    // Séries similaires (≥ 1 genre commun)
    const rel = (window.SERIES || []).filter(o => o.id !== s.id && o.genres.some(g => g !== "LanorTrad" && s.genres.includes(g)));
    if (rel.length) {
      document.getElementById("related-section").style.display = "";
      document.getElementById("related-grid").innerHTML = rel.slice(0, 6).map(LTcard).join("");
    }

    document.dispatchEvent(new Event("lt:cards"));
    window.LT._scanReveals && window.LT._scanReveals();
  }

  function enc(x) { return encodeURIComponent(x); }
  function handshake() { return `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="m11 17 2 2a1 1 0 0 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 0 0 3-3l-3.9-3.9a2 2 0 0 0-2.8 0l-1.6 1.6a2 2 0 0 1-2.8 0l-2-2a1 1 0 0 1 0-1.4l3.4-3.4a4 4 0 0 1 5.6 0l5.6 5.6"/><path d="m2 13 2.5 2.5a1 1 0 0 0 3-3L4 8"/></svg>`; }

  /* ---------- Galerie (tomes + colors) ---------- */
  function renderGallery(g, sid) {
    const panel = document.getElementById("panel-galerie");
    panel.innerHTML = galSection("Tomes", g.tomes, "tomes", sid) + galSection("Colors Lanor", g.colors, "colors", sid);
    const items = [...panel.querySelectorAll(".gal-item")];
    const srcs = items.map(b => b.dataset.src);
    items.forEach((b, i) => b.addEventListener("click", () => openLightbox(srcs, i)));
    document.dispatchEvent(new Event("lt:cards"));
  }
  function galSection(title, imgs, kind, sid) {
    if (kind === "colors" && (!imgs || !imgs.length))
      return `<div class="gal-block"><div class="gal-head"><h3>${title}</h3></div>
        <div class="gal-empty">🎨 Aucune color pour l'instant. Ajoutez vos images dans <code>images/Galerie/${sid}/Colors/</code> puis relancez <code>tools/build-data.py</code>.</div></div>`;
    if (!imgs || !imgs.length) return "";
    const n = imgs.length;
    const sub = kind === "tomes" ? `${n} volume${n > 1 ? "s" : ""}` : `${n} illustration${n > 1 ? "s" : ""}`;
    return `<div class="gal-block">
      <div class="gal-head"><h3>${title}</h3><span class="gal-count">${sub}</span></div>
      <div class="gal-grid ${kind}">${imgs.map((src, i) =>
        `<button class="gal-item" data-src="${src}"><img src="${encodeURI(src)}" alt="${title} ${i + 1}" loading="lazy"><span class="gal-zoom">⤢</span></button>`).join("")}</div>
    </div>`;
  }
  function openLightbox(srcs, idx) {
    let i = idx;
    const lb = document.createElement("div");
    lb.className = "lightbox";
    lb.innerHTML = `<button class="lb-close" aria-label="Fermer">&times;</button>
      <button class="lb-nav prev" aria-label="Précédent">‹</button>
      <img class="lb-img" alt="">
      <button class="lb-nav next" aria-label="Suivant">›</button>
      <div class="lb-count"></div>`;
    document.body.appendChild(lb);
    document.body.style.overflow = "hidden";
    const img = lb.querySelector(".lb-img"), count = lb.querySelector(".lb-count");
    const show = () => { img.src = encodeURI(srcs[i]); count.textContent = `${i + 1} / ${srcs.length}`; };
    const close = () => { lb.classList.remove("open"); setTimeout(() => lb.remove(), 250); document.body.style.overflow = ""; document.removeEventListener("keydown", key); };
    const prev = () => { i = (i - 1 + srcs.length) % srcs.length; show(); };
    const next = () => { i = (i + 1) % srcs.length; show(); };
    lb.querySelector(".lb-close").onclick = close;
    lb.querySelector(".prev").onclick = prev;
    lb.querySelector(".next").onclick = next;
    lb.addEventListener("click", e => { if (e.target === lb) close(); });
    function key(e) { if (e.key === "Escape") close(); else if (e.key === "ArrowLeft") prev(); else if (e.key === "ArrowRight") next(); }
    document.addEventListener("keydown", key);
    if (srcs.length < 2) lb.querySelectorAll(".lb-nav").forEach(n => n.style.display = "none");
    requestAnimationFrame(() => lb.classList.add("open"));
    show();
  }

  function setSeo(s) {
    setMeta("description", `Lisez ${s.title} en français sur LanorTrad. ${s.description}`);
    setProp("og:title", `${s.title} — LanorTrad`);
    setProp("og:description", s.description);
    setProp("og:image", new URL(s.cover, location.href).href);
    setProp("og:type", "book");
    const ld = {
      "@context": "https://schema.org", "@type": "ComicSeries",
      name: s.title, genre: s.genres.filter(g => g !== "LanorTrad"),
      author: { "@type": "Person", name: s.author }, inLanguage: "fr",
      numberOfEpisodes: s.chapters, image: new URL(s.cover, location.href).href,
      description: s.description, url: location.href,
      aggregateRating: { "@type": "AggregateRating", ratingValue: s.rating, bestRating: 5, ratingCount: 120 }
    };
    let e = document.getElementById("ld-json");
    if (!e) { e = document.createElement("script"); e.type = "application/ld+json"; e.id = "ld-json"; document.head.appendChild(e); }
    e.textContent = JSON.stringify(ld);
  }
  function setMeta(name, content) { let m = document.querySelector(`meta[name="${name}"]`); if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); } m.content = content; }
  function setProp(prop, content) { let m = document.querySelector(`meta[property="${prop}"]`); if (!m) { m = document.createElement("meta"); m.setAttribute("property", prop); document.head.appendChild(m); } m.setAttribute("content", content); }

  document.addEventListener("lt:ready", init);
})();
