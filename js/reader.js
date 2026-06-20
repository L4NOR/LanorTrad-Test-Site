/* =========================================================================
   LanorTrad — Lecteur. Modes webtoon / page / double, préférences,
   navigation clavier + tactile, progression, téléchargement, crédits.
   ========================================================================= */
(function () {
  "use strict";

  const TEAM = [
    { role: "Traduction", who: "LanorTrad" },
    { role: "Clean", who: "LanorTrad" },
    { role: "Edit", who: "LanorTrad" },
    { role: "QC", who: "LanorTrad" },
  ];

  const PREF_KEY = "lt-reader-prefs";
  const DEFAULT_PREFS = { mode: "webtoon", dir: "ltr", width: 860, gap: 0, bright: 1, bg: "#07070d" };
  let prefs = loadPrefs();

  // état
  let S, manga, chapters, chap, imgs = [], idx = 0, total = 0;
  let lastDir = 1, autoOn = false, autoRAF = null, autoSpeed = 1.4;

  function init() {
    const p = new URLSearchParams(location.search);
    manga = p.get("manga");
    S = window.LT.seriesById(manga);
    chapters = (window.CHAPTERS || {})[manga] || [];
    const root = document.getElementById("reader-root");
    document.body.classList.add("reader-body");
    applyVars();

    if (!S) { root.innerHTML = unavailable("Série introuvable."); window.LT._scanReveals?.(); return; }
    document.title = `${S.title} — Lecture — LanorTrad`;

    let wantNum = p.get("chapter");
    if (!wantNum && chapters.length) wantNum = chapters[chapters.length - 1].num; // 1er dispo
    chap = chapters.find(c => c.num === wantNum);

    // Squelette commun
    root.innerHTML = `
      <div class="r-progress" id="r-prog"></div>
      <div class="r-bar" id="r-bar">
        <a class="r-back" href="${S.url}">${arrow("left")}<span>Fiche</span></a>
        <div class="r-title"><div class="t">${S.title}</div><div class="c" id="r-chap-label"></div></div>
        <div class="spacer"></div>
        <div class="r-chap-select"><select id="r-chap-select" aria-label="Choisir un chapitre"></select></div>
        <button class="icon-btn" id="r-settings" title="Préférences">${gear()}</button>
      </div>
      <div class="r-stage" id="r-stage"><div class="r-pages" id="r-pages"></div></div>
      <div class="r-tapzones"><div class="z left" id="z-left"></div><div class="z mid"></div><div class="z right" id="z-right"></div></div>
      <div class="r-fab" id="r-fab">
        <button class="fab" id="fab-help" title="Raccourcis (?)">${qIcon()}</button>
        <button class="fab" id="fab-auto" title="Défilement auto (A)">${autoIcon()}</button>
        <button class="fab" id="fab-top" title="Haut de page">${arrow("up")}</button>
        <button class="fab" id="fab-dl" title="Télécharger le chapitre">${dlIcon()}</button>
        <button class="fab" id="fab-full" title="Plein écran (F)">${fsIcon()}</button>
        <button class="fab primary" id="fab-next" title="Chapitre suivant">${arrow("right")}</button>
      </div>
      <div class="r-help-overlay" id="r-help-overlay"><div class="r-help">
        <button class="close" id="r-help-close" aria-label="Fermer">&times;</button>
        <h3>Raccourcis clavier</h3>
        <div class="kb"><span>Page suivante / précédente</span><span><kbd>→</kbd> <kbd>←</kbd></span></div>
        <div class="kb"><span>Défiler (mode page)</span><span><kbd>Espace</kbd> <kbd>↑</kbd> <kbd>↓</kbd></span></div>
        <div class="kb"><span>Défilement automatique</span><kbd>A</kbd></div>
        <div class="kb"><span>Plein écran</span><kbd>F</kbd></div>
        <div class="kb"><span>Zoom (mode page)</span><span>double-clic / molette</span></div>
        <div class="kb"><span>Cette aide</span><kbd>?</kbd></div>
      </div></div>
      ${prefsPanel()}`;

    // remplir le select des chapitres
    const sel = document.getElementById("r-chap-select");
    sel.innerHTML = chapters.map(c => `<option value="${c.num}">Chapitre ${c.num}</option>`).join("");
    sel.addEventListener("change", () => goChapter(sel.value));

    wirePrefs();
    wireControls();

    if (!chap) { document.getElementById("r-pages").innerHTML = ""; document.getElementById("r-stage").insertAdjacentHTML("beforeend", unavailable(
      chapters.length ? `Le chapitre ${wantNum || ""} n'est pas encore disponible dans cette démo.` :
      `Les chapitres de « ${S.title} » seront disponibles après la copie complète (étape 2).`)); return; }

    loadChapter();
  }

  /* ---------------- Chargement d'un chapitre ---------------- */
  function loadChapter() {
    idx = 0; total = chap.pages;
    document.getElementById("r-chap-label").textContent = `Chapitre ${chap.num} · ${chap.pages} pages`;
    document.getElementById("r-chap-select").value = chap.num;
    history.replaceState(null, "", `reader.html?manga=${encodeURIComponent(manga)}&chapter=${chap.num}`);

    const pagesEl = document.getElementById("r-pages");
    const base = `Manga/${manga}/${chap.folder}/`;
    imgs = (chap.files || []).map((f, i) => {
      const im = document.createElement("img");
      im.src = encodeURI(base + f);
      im.alt = `${S.title} — Chapitre ${chap.num} — page ${i + 1}`;
      im.loading = i < 2 ? "eager" : "lazy";
      im.dataset.i = i;
      return im;
    });
    pagesEl.innerHTML = "";
    imgs.forEach(im => pagesEl.appendChild(im));

    // splash de fin
    const splash = endSplash();
    pagesEl.appendChild(splash);

    applyMode();
    saveProgress();
    scrollTo({ top: 0 });
    if (prefs.mode === "page" || prefs.mode === "double") showPage(0);
  }

  /* ---------------- Modes ---------------- */
  function applyMode() {
    const stage = document.getElementById("r-stage");
    stage.className = "r-stage mode-" + prefs.mode + (prefs.dir === "rtl" ? " rtl" : "");
    if (prefs.mode === "page" || prefs.mode === "double") showPage(idx);
    else { imgs.forEach(im => { im.classList.remove("cur"); resetZoom(im); }); document.getElementById("r-stage").classList.remove("reader-zoomed"); document.getElementById("r-end")?.classList.remove("cur"); }
    updateProgress();
  }

  function showPage(i) {
    const splash = document.getElementById("r-end");
    const pagesEl = document.getElementById("r-pages");
    const step = prefs.mode === "double" ? 2 : 1;
    idx = Math.max(0, Math.min(i, total));
    pagesEl.style.setProperty("--flip-deg", (lastDir * (prefs.dir === "rtl" ? -16 : 16)) + "deg");
    imgs.forEach(im => { im.classList.remove("cur"); resetZoom(im); });
    splash.classList.remove("cur");
    if (idx >= total) { splash.classList.add("cur"); }
    else {
      imgs[idx].classList.add("cur");
      if (step === 2 && imgs[idx + 1]) imgs[idx + 1].classList.add("cur");
      attachZoom(imgs[idx]);
    }
    preload(idx);
    saveProgress();
    updateProgress();
  }

  // précharge la fenêtre autour de la page courante (tournes instantanées)
  function preload(i) {
    for (let k = i - 1; k <= i + 3; k++) if (imgs[k]) { imgs[k].loading = "eager"; imgs[k].decode && imgs[k].decode().catch(() => {}); }
  }

  function nextPage() {
    const step = prefs.mode === "double" ? 2 : 1;
    lastDir = 1;
    if (idx >= total) { return nextChapter(); }
    showPage(idx + step);
  }
  function prevPage() {
    const step = prefs.mode === "double" ? 2 : 1;
    lastDir = -1;
    if (idx <= 0) return prevChapter();
    showPage(idx - step);
  }

  /* ---------------- Navigation chapitre ---------------- */
  function goChapter(num) {
    const c = chapters.find(x => x.num === num);
    if (!c) return;
    chap = c; loadChapter();
  }
  function nextChapter() {
    const i = chapters.indexOf(chap);
    if (i > 0) goChapter(chapters[i - 1].num);          // liste triée desc
    else window.LT.toast("Vous êtes au dernier chapitre disponible 🎉");
  }
  function prevChapter() {
    const i = chapters.indexOf(chap);
    if (i < chapters.length - 1) { goChapter(chapters[i + 1].num); }
    else window.LT.toast("C'est le premier chapitre.");
  }

  /* ---------------- Progression ---------------- */
  function updateProgress() {
    const bar = document.getElementById("r-prog");
    let pct = 0;
    if (prefs.mode === "webtoon") {
      const h = document.documentElement.scrollHeight - innerHeight;
      pct = h > 0 ? (scrollY / h) * 100 : 0;
    } else {
      pct = total ? (Math.min(idx, total) / total) * 100 : 0;
    }
    bar.style.width = pct + "%";
  }
  function saveProgress() {
    try { localStorage.setItem("lt-progress-" + manga, JSON.stringify({ chapter: chap.num, page: idx, t: Date.now() })); } catch {}
  }

  /* ---------------- Préférences ---------------- */
  function applyVars() {
    const r = document.documentElement.style;
    r.setProperty("--reader-w", prefs.width + "px");
    r.setProperty("--reader-gap", prefs.gap + "px");
    r.setProperty("--reader-bright", prefs.bright);
    r.setProperty("--reader-bg", prefs.bg);
    document.body.style.background = prefs.bg;
  }
  function wirePrefs() {
    const overlay = document.getElementById("r-prefs-overlay");
    const panel = document.getElementById("r-prefs");
    const open = () => { overlay.classList.add("open"); panel.classList.add("open"); };
    const close = () => { overlay.classList.remove("open"); panel.classList.remove("open"); };
    document.getElementById("r-settings").addEventListener("click", open);
    overlay.addEventListener("click", close);
    document.getElementById("r-prefs-close").addEventListener("click", close);

    // segments
    bindSeg("seg-mode", v => { prefs.mode = v; savePrefs(); applyMode(); });
    bindSeg("seg-dir", v => { prefs.dir = v; savePrefs(); applyMode(); });
    // sliders
    bindRange("rg-width", "width", v => v + "px", applyVars);
    bindRange("rg-gap", "gap", v => v + "px", applyVars);
    bindRange("rg-bright", "bright", v => Math.round(v * 100) + "%", applyVars);
    // swatches
    document.querySelectorAll("#sw-bg button").forEach(b => {
      b.classList.toggle("on", b.dataset.c === prefs.bg);
      b.addEventListener("click", () => {
        prefs.bg = b.dataset.c; savePrefs(); applyVars();
        document.querySelectorAll("#sw-bg button").forEach(x => x.classList.toggle("on", x === b));
      });
    });
    syncPrefUI();
  }
  function bindSeg(id, cb) {
    document.querySelectorAll(`#${id} button`).forEach(b =>
      b.addEventListener("click", () => {
        document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle("on", x === b));
        cb(b.dataset.v);
      }));
  }
  function bindRange(id, key, fmt, cb) {
    const el = document.getElementById(id);
    el.addEventListener("input", () => { prefs[key] = parseFloat(el.value); el.previousElementSibling.querySelector(".val").textContent = fmt(prefs[key]); savePrefs(); cb(); });
  }
  function syncPrefUI() {
    setSeg("seg-mode", prefs.mode); setSeg("seg-dir", prefs.dir);
    setRange("rg-width", prefs.width, v => v + "px");
    setRange("rg-gap", prefs.gap, v => v + "px");
    setRange("rg-bright", prefs.bright, v => Math.round(v * 100) + "%");
  }
  function setSeg(id, v) { document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle("on", b.dataset.v === v)); }
  function setRange(id, v, fmt) { const el = document.getElementById(id); el.value = v; el.previousElementSibling.querySelector(".val").textContent = fmt(v); }

  /* ---------------- Contrôles ---------------- */
  function wireControls() {
    document.getElementById("fab-top").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    document.getElementById("fab-next").addEventListener("click", nextChapter);
    document.getElementById("fab-full").addEventListener("click", toggleFull);
    document.getElementById("fab-dl").addEventListener("click", downloadChapter);
    document.getElementById("fab-auto").addEventListener("click", () => toggleAuto());
    document.getElementById("fab-help").addEventListener("click", () => toggleHelp());
    document.getElementById("r-help-close").addEventListener("click", () => toggleHelp(false));
    document.getElementById("r-help-overlay").addEventListener("click", e => { if (e.target.id === "r-help-overlay") toggleHelp(false); });
    document.getElementById("z-left").addEventListener("click", () => prefs.dir === "rtl" ? nextPage() : prevPage());
    document.getElementById("z-right").addEventListener("click", () => prefs.dir === "rtl" ? prevPage() : nextPage());

    // masquage de la barre au scroll (webtoon)
    let last = 0;
    addEventListener("scroll", () => {
      updateProgress();
      const bar = document.getElementById("r-bar");
      if (scrollY > last && scrollY > 160) bar.classList.add("hidden-up"); else bar.classList.remove("hidden-up");
      last = scrollY;
    }, { passive: true });

    addEventListener("keydown", e => {
      if (document.querySelector(".cmdk-overlay.open, .r-prefs.open, .r-help-overlay.open")) return;
      if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight") { prefs.dir === "rtl" ? prevPage() : nextPage(); }
      else if (e.key === "ArrowLeft") { prefs.dir === "rtl" ? nextPage() : prevPage(); }
      else if (e.key === "ArrowDown" || e.key === " ") { if (prefs.mode !== "webtoon") { e.preventDefault(); nextPage(); } }
      else if (e.key === "ArrowUp") { if (prefs.mode !== "webtoon") { e.preventDefault(); prevPage(); } }
      else if (e.key.toLowerCase() === "f") toggleFull();
      else if (e.key.toLowerCase() === "a") toggleAuto();
      else if (e.key === "?") toggleHelp();
    });
  }
  function toggleFull() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  function toggleHelp(force) {
    const o = document.getElementById("r-help-overlay");
    o.classList.toggle("open", force === undefined ? !o.classList.contains("open") : force);
  }

  /* ---------- Défilement automatique (webtoon) ---------- */
  function toggleAuto(force) {
    autoOn = force === undefined ? !autoOn : force;
    document.getElementById("fab-auto").classList.toggle("on", autoOn);
    if (autoOn) {
      if (prefs.mode !== "webtoon") window.LT.toast("Le défilement auto fonctionne en mode Défilement");
      window.LT.toast("Défilement auto activé · molette pour la vitesse");
      const tick = () => {
        if (!autoOn) return;
        scrollBy(0, autoSpeed);
        if (innerHeight + scrollY >= document.body.scrollHeight - 2) { toggleAuto(false); }
        else autoRAF = requestAnimationFrame(tick);
      };
      autoRAF = requestAnimationFrame(tick);
      addEventListener("wheel", autoWheel, { passive: true });
    } else {
      cancelAnimationFrame(autoRAF);
      removeEventListener("wheel", autoWheel);
    }
  }
  function autoWheel(e) { autoSpeed = Math.max(0.4, Math.min(6, autoSpeed + (e.deltaY > 0 ? 0.3 : -0.3))); }

  /* ---------- Zoom (mode page) ---------- */
  function attachZoom(img) {
    if (!img || prefs.mode === "webtoon" || img._zoom) return;
    img._zoom = { scale: 1, x: 0, y: 0, drag: null, pts: new Map(), pd: 0 };
    img.classList.add("zoomable");
    const z = img._zoom;
    const apply = (anim) => {
      img.classList.toggle("zoom-anim", !!anim);
      img.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.scale})`;
      img.classList.toggle("zoomed", z.scale > 1.01);
      document.getElementById("r-stage").classList.toggle("reader-zoomed", z.scale > 1.01);
    };

    img.addEventListener("dblclick", e => {
      e.preventDefault();
      if (z.scale > 1.01) { z.scale = 1; z.x = z.y = 0; } else { z.scale = 2.4; }
      apply(true);
    });
    img.addEventListener("wheel", e => {
      if (!e.ctrlKey && z.scale <= 1.01) return;       // molette normale = scroll quand non zoomé
      e.preventDefault();
      z.scale = Math.max(1, Math.min(4, z.scale + (e.deltaY > 0 ? -0.2 : 0.2)));
      if (z.scale === 1) z.x = z.y = 0;
      apply(true);
    }, { passive: false });
    img.addEventListener("pointerdown", e => {
      z.pts.set(e.pointerId, e);
      if (z.pts.size === 1 && z.scale > 1.01) { z.drag = { x: e.clientX - z.x, y: e.clientY - z.y }; img.setPointerCapture(e.pointerId); }
    });
    img.addEventListener("pointermove", e => {
      if (!z.pts.has(e.pointerId)) return;
      z.pts.set(e.pointerId, e);
      if (z.pts.size === 2) {                            // pincement
        const [a, b] = [...z.pts.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (z.pd) { z.scale = Math.max(1, Math.min(4, z.scale * (d / z.pd))); apply(false); }
        z.pd = d;
      } else if (z.drag && z.scale > 1.01) {
        z.x = e.clientX - z.drag.x; z.y = e.clientY - z.drag.y; apply(false);
      }
    });
    const up = e => { z.pts.delete(e.pointerId); z.drag = null; z.pd = 0; };
    img.addEventListener("pointerup", up);
    img.addEventListener("pointercancel", up);
  }
  function resetZoom(img) {
    if (img && img._zoom) { img._zoom.scale = 1; img._zoom.x = img._zoom.y = 0; img.style.transform = ""; img.classList.remove("zoomed"); }
  }

  /* ---------------- Téléchargement ZIP ---------------- */
  async function downloadChapter() {
    if (typeof JSZip === "undefined") { window.LT.toast("Téléchargement indisponible."); return; }
    window.LT.toast("Préparation du téléchargement…");
    const zip = new JSZip();
    const base = `Manga/${manga}/Chapitres/${chap.folder}/`;
    try {
      await Promise.all((chap.files || []).map(async f => {
        const res = await fetch(encodeURI(base + f));
        zip.file(f, await res.blob());
      }));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${S.title} - Chapitre ${chap.num}.zip`;
      a.click(); URL.revokeObjectURL(a.href);
      window.LT.toast("Téléchargement prêt ✓");
    } catch { window.LT.toast("Échec du téléchargement."); }
  }

  /* ---------------- Fragments ---------------- */
  function endSplash() {
    const wrap = window.LT.el(`
      <div class="r-end" id="r-end">
        <div class="thanks">Merci d'avoir lu — Chapitre ${chap.num}</div>
        <h2 class="glowtitle grad-text">${S.title}</h2>
        <div class="r-credits">${TEAM.map(t => `<div class="cr"><div class="role">${t.role}</div><div class="who">${t.who}</div></div>`).join("")}</div>
        <div class="r-navchap">
          <button class="btn btn-ghost" id="end-prev">${arrow("left")} Précédent</button>
          <a class="btn btn-primary" href="https://discord.gg/md37S7nhkZ" target="_blank" rel="noopener">Rejoindre le Discord</a>
          <button class="btn btn-ghost" id="end-next">Suivant ${arrow("right")}</button>
        </div>
      </div>`);
    setTimeout(() => {
      wrap.querySelector("#end-prev")?.addEventListener("click", prevChapter);
      wrap.querySelector("#end-next")?.addEventListener("click", nextChapter);
    }, 0);
    return wrap;
  }
  function prefsPanel() {
    return `
      <div class="r-prefs-overlay" id="r-prefs-overlay"></div>
      <aside class="r-prefs" id="r-prefs">
        <button class="close" id="r-prefs-close" aria-label="Fermer">&times;</button>
        <h3>Préférences de lecture</h3>
        <div class="sub">Réglages mémorisés sur cet appareil.</div>

        <div class="grp"><label>Mode de lecture</label>
          <div class="seg" id="seg-mode">
            <button data-v="webtoon">Défilement</button>
            <button data-v="page">Page</button>
            <button data-v="double">Double</button>
          </div>
        </div>
        <div class="grp"><label>Sens de lecture</label>
          <div class="seg" id="seg-dir">
            <button data-v="ltr">Gauche → Droite</button>
            <button data-v="rtl">Droite → Gauche</button>
          </div>
        </div>
        <div class="grp"><label>Largeur des pages <span class="val"></span></label>
          <input type="range" id="rg-width" min="560" max="1200" step="20">
        </div>
        <div class="grp"><label>Espacement (webtoon) <span class="val"></span></label>
          <input type="range" id="rg-gap" min="0" max="40" step="2">
        </div>
        <div class="grp"><label>Luminosité <span class="val"></span></label>
          <input type="range" id="rg-bright" min="0.4" max="1.2" step="0.05">
        </div>
        <div class="grp"><label>Fond du lecteur</label>
          <div class="swatches" id="sw-bg">
            <button data-c="#07070d" style="background:#07070d"></button>
            <button data-c="#000000" style="background:#000"></button>
            <button data-c="#11111f" style="background:#11111f"></button>
            <button data-c="#f5f5f5" style="background:#f5f5f5"></button>
            <button data-c="#e8d8b0" style="background:#e8d8b0"></button>
          </div>
        </div>
      </aside>`;
  }
  function unavailable(msg) {
    return `<div class="wrap empty" style="padding-top:120px"><div class="big">🚧</div><p>${msg}</p>
      <div style="margin-top:18px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a class="btn btn-ghost" href="${S ? S.url : "catalogue.html"}">Retour à la fiche</a>
        <a class="btn btn-primary" href="index.html">Accueil</a></div></div>`;
  }

  /* ---------------- Persistance ---------------- */
  function loadPrefs() { try { return Object.assign({}, DEFAULT_PREFS, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch { return { ...DEFAULT_PREFS }; } }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }

  /* ---------------- Icônes ---------------- */
  function arrow(d) {
    const p = { left: "M19 12H5M11 6l-6 6 6 6", right: "M5 12h14M13 6l6 6-6 6", up: "M12 19V5M5 12l7-7 7 7" }[d];
    return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${p}"/></svg>`;
  }
  function gear() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.6H3.9a2 2 0 1 1 0-4H4a1.6 1.6 0 0 0 1.5-2.6l-.1-.1A2 2 0 1 1 8.1 4l.1.1A1.6 1.6 0 0 0 10 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1A2 2 0 1 1 19.7 8l-.1.1a1.6 1.6 0 0 0-.2 1.7"/></svg>`; }
  function dlIcon() { return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`; }
  function fsIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>`; }
  function autoIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>`; }
  function qIcon() { return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.5-2.8 2.5" stroke-linecap="round"/><circle cx="12" cy="17" r=".6" fill="currentColor"/></svg>`; }

  document.addEventListener("lt:ready", init);
})();
