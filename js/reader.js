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
  let webtoonIO = null;            // préchargement glissant (mode webtoon)
  let prefetchedNext = null;       // n° du chapitre suivant déjà préchargé
  let _sb = null, _me = null;      // client + session Supabase (commentaires)

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
    window.LTstore && window.LTstore.markSeen(manga);   // lire « consomme » la nouveauté

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
      </div>
      <div class="r-dock" id="r-dock">
        <button class="r-dock-chap" id="dock-prev" title="Chapitre précédent">${arrow("left")}</button>
        <div class="r-scrub">
          <div class="r-scrub-preview" id="scrub-preview" hidden><img id="scrub-preview-img" alt=""><span id="scrub-preview-num"></span></div>
          <input type="range" id="scrub" min="1" max="1" value="1" step="1" aria-label="Aller à une page">
          <div class="r-scrub-count" id="scrub-count">1 / 1</div>
        </div>
        <button class="r-dock-chap primary" id="dock-next" title="Chapitre suivant">${arrow("right")}</button>
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
    idx = 0; total = chap.pages; prefetchedNext = null;
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
    imgs.forEach(im => {
      pagesEl.appendChild(im);
      // fondu d'apparition quand l'image est chargée (mode webtoon)
      const done = () => im.classList.add("loaded");
      if (im.complete && im.naturalWidth) done();
      else { im.addEventListener("load", done, { once: true }); im.addEventListener("error", done, { once: true }); }
    });

    // splash de fin
    const splash = endSplash();
    pagesEl.appendChild(splash);

    // scrubber : borne sur le nombre de pages
    const scrub = document.getElementById("scrub");
    scrub.max = total; scrub.value = 1;

    applyMode();
    saveProgress();
    scrollTo({ top: 0 });
    if (prefs.mode === "page" || prefs.mode === "double") showPage(0);
    updateScrub();
    loadComments();
  }

  /* ---------------- Modes ---------------- */
  function applyMode() {
    const stage = document.getElementById("r-stage");
    stage.className = "r-stage mode-" + prefs.mode + (prefs.dir === "rtl" ? " rtl" : "");
    if (prefs.mode === "page" || prefs.mode === "double") showPage(idx);
    else { imgs.forEach(im => { im.classList.remove("cur"); resetZoom(im); }); document.getElementById("r-stage").classList.remove("reader-zoomed"); document.getElementById("r-end")?.classList.remove("cur"); }
    setupWebtoonPreload();
    updateProgress();
    updateScrub();
  }

  /* ---------- Préchargement glissant (mode webtoon) ---------- */
  function setupWebtoonPreload() {
    if (webtoonIO) { webtoonIO.disconnect(); webtoonIO = null; }
    if (prefs.mode !== "webtoon") return;
    webtoonIO = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        const i = +en.target.dataset.i;
        for (let k = i; k <= i + 4; k++) if (imgs[k]) { imgs[k].loading = "eager"; imgs[k].decode && imgs[k].decode().catch(() => {}); }
      });
    }, { rootMargin: "1500px 0px 2500px 0px" });
    imgs.forEach(im => webtoonIO.observe(im));
  }

  /* ---------- Scrubber (barre de pages avec aperçu) ---------- */
  function currentWebtoonIndex() {
    const mid = scrollY + innerHeight / 2;
    let lastBottom = 0;
    for (let i = 0; i < imgs.length; i++) {
      const r = imgs[i].getBoundingClientRect();
      const top = r.top + scrollY, bottom = top + r.height;
      if (mid >= top && mid <= bottom) return i;
      lastBottom = bottom;
    }
    if (imgs.length && mid > lastBottom) return imgs.length - 1;  // au-delà de la dernière page (splash)
    return 0;
  }
  function updateScrub() {
    const scrub = document.getElementById("scrub"), count = document.getElementById("scrub-count");
    if (!scrub || !total) return;
    const cur = prefs.mode === "webtoon" ? currentWebtoonIndex() : Math.min(idx, total - 1);
    if (document.activeElement !== scrub) scrub.value = cur + 1;
    count.textContent = (cur + 1) + " / " + total;
  }
  function scrubPreview(i) {
    const box = document.getElementById("scrub-preview");
    const img = document.getElementById("scrub-preview-img");
    const num = document.getElementById("scrub-preview-num");
    if (!imgs[i]) return;
    img.src = imgs[i].src; num.textContent = (i + 1) + " / " + total;
    box.hidden = false;
    const scrub = document.getElementById("scrub");
    const ratio = total > 1 ? i / (total - 1) : 0;
    box.style.left = (scrub.offsetLeft + ratio * scrub.offsetWidth) + "px";
  }
  function scrubJump(i, live) {
    i = Math.max(0, Math.min(i, total - 1));
    if (prefs.mode === "webtoon") { imgs[i] && imgs[i].scrollIntoView({ block: "start", behavior: live ? "auto" : "smooth" }); }
    else showPage(i);
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
    updateScrub();
    maybePrefetchNext();
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

  /* ---------- Préchargement du chapitre suivant (silencieux) ----------
     Quand on approche de la fin, on précharge les pages du chapitre suivant
     (priorité basse, via <link rel=prefetch>) → il s'ouvre instantanément.
     Le service worker met aussi ces images en cache au passage. */
  function prefetchNextChapter() {
    const i = chapters.indexOf(chap);
    const next = i > 0 ? chapters[i - 1] : null;       // liste triée desc → suivant = index-1
    if (!next || prefetchedNext === next.num) return;
    prefetchedNext = next.num;
    const base = `Manga/${manga}/${next.folder}/`;
    (next.files || []).forEach(f => {
      const l = document.createElement("link");
      l.rel = "prefetch"; l.as = "image"; l.href = encodeURI(base + f);
      document.head.appendChild(l);
    });
  }
  function maybePrefetchNext() {
    let nearEnd;
    if (prefs.mode === "webtoon") {
      const h = document.documentElement.scrollHeight - innerHeight;
      nearEnd = h > 0 && scrollY / h > 0.6;
    } else {
      nearEnd = total > 0 && idx >= total - 3;
    }
    if (nearEnd) prefetchNextChapter();
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
    document.getElementById("fab-full").addEventListener("click", toggleFull);

    // Dock bas : chapitre précédent / suivant (collant) + scrubber
    document.getElementById("dock-prev").addEventListener("click", prevChapter);
    document.getElementById("dock-next").addEventListener("click", nextChapter);
    const scrub = document.getElementById("scrub");
    scrub.addEventListener("input", () => { const i = +scrub.value - 1; scrubPreview(i); if (prefs.mode === "webtoon") scrubJump(i, true); });
    scrub.addEventListener("change", () => { const i = +scrub.value - 1; if (prefs.mode !== "webtoon") scrubJump(i); setTimeout(() => { document.getElementById("scrub-preview").hidden = true; }, 600); });
    scrub.addEventListener("pointerup", () => setTimeout(() => { document.getElementById("scrub-preview").hidden = true; }, 600));
    scrub.addEventListener("mouseleave", () => { document.getElementById("scrub-preview").hidden = true; });
    document.getElementById("fab-dl").addEventListener("click", downloadChapter);
    document.getElementById("fab-auto").addEventListener("click", () => toggleAuto());
    document.getElementById("fab-help").addEventListener("click", () => toggleHelp());
    document.getElementById("r-help-close").addEventListener("click", () => toggleHelp(false));
    document.getElementById("r-help-overlay").addEventListener("click", e => { if (e.target.id === "r-help-overlay") toggleHelp(false); });
    document.getElementById("z-left").addEventListener("click", () => prefs.dir === "rtl" ? nextPage() : prevPage());
    document.getElementById("z-right").addEventListener("click", () => prefs.dir === "rtl" ? prevPage() : nextPage());

    // masquage de la barre au scroll (webtoon) + MAJ scrubber
    let last = 0;
    addEventListener("scroll", () => {
      updateProgress();
      updateScrub();
      maybePrefetchNext();
      const bar = document.getElementById("r-bar");
      const dock = document.getElementById("r-dock");
      const down = scrollY > last && scrollY > 160;
      bar.classList.toggle("hidden-up", down);
      dock.classList.toggle("hidden-down", down);
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

    // Double-tap tactile (en plus du dblclick souris) → zoom / dézoom
    let lastTap = 0, tapXY = null;
    img.addEventListener("pointerdown", e => { if (e.pointerType === "touch" && z.pts.size <= 1) tapXY = { x: e.clientX, y: e.clientY }; });
    img.addEventListener("pointerup", e => {
      if (e.pointerType !== "touch" || !tapXY) return;
      const moved = Math.hypot(e.clientX - tapXY.x, e.clientY - tapXY.y); tapXY = null;
      if (moved > 12) return;                       // glissement, pas un tap
      const now = Date.now();
      if (now - lastTap < 300) { if (z.scale > 1.01) { z.scale = 1; z.x = z.y = 0; } else { z.scale = 2.4; } apply(true); lastTap = 0; }
      else lastTap = now;
    });
  }
  function resetZoom(img) {
    if (img && img._zoom) { img._zoom.scale = 1; img._zoom.x = img._zoom.y = 0; img.style.transform = ""; img.classList.remove("zoomed"); }
  }

  /* ---------------- Téléchargement ZIP ---------------- */
  async function downloadChapter() {
    if (typeof JSZip === "undefined") { window.LT.toast("Téléchargement indisponible."); return; }
    window.LT.toast("Préparation du téléchargement…");
    const zip = new JSZip();
    const base = `Manga/${manga}/${chap.folder}/`;
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
        <div class="r-comments" id="r-comments"></div>
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

  /* ---------------- Commentaires par chapitre (Supabase) ---------------- */
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  // Rendu d'un commentaire : échappé, mentions @pseudo surlignées, sauts de ligne.
  const comBody = s => esc(s)
    .replace(/(^|[\s(])@([A-Za-z0-9_]{3,24})/g, '$1<span class="r-com-mention">@$2</span>')
    .replace(/\n/g, "<br>");

  function sbClient() {
    if (_sb) return _sb;
    const C = window.LT_SUPABASE || {};
    if (!window.supabase || !C.url || !C.anonKey || /VOTRE_|YOUR_/i.test(C.url + C.anonKey)) return null;
    _sb = window.supabase.createClient(C.url, C.anonKey);
    return _sb;
  }
  function comAvatar(p, size = 34) {
    const name = (p && p.username) || "?";
    const initials = name.slice(0, 2).toUpperCase();
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return `<span class="r-com-av" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 50) % 360} 70% 45%))">${esc(initials)}</span>`;
  }
  async function loadComments() {
    const box = document.getElementById("r-comments");
    if (!box) return;
    const c = sbClient();
    if (!c) { box.innerHTML = ""; return; }               // Supabase non configuré
    box.innerHTML = `<h3 class="r-com-h">💬 Commentaires du chapitre</h3><div class="r-com-list" id="r-com-list">Chargement…</div><div id="r-com-form"></div>`;
    const { data: { session } } = await c.auth.getSession();
    _me = session ? session.user : null;
    const { data, error } = await c.from("chapter_comments")
      .select("id,body,created_at,author_id,author:profiles(username,avatar_url,role)")
      .eq("manga_id", manga).eq("chapter_num", chap.num).order("created_at", { ascending: true });
    const list = document.getElementById("r-com-list");
    if (error) { list.innerHTML = `<div class="r-com-empty">Les commentaires seront bientôt disponibles.</div>`; renderComForm(); return; }
    list.innerHTML = (data && data.length) ? data.map(comRow).join("")
      : `<div class="r-com-empty">Aucun commentaire. Lance la discussion !</div>`;
    renderComForm();
  }
  function comRow(m) {
    const a = m.author || {};
    const role = a.role === "admin" ? ' <span class="r-com-role">Admin</span>' : a.role === "moderator" ? ' <span class="r-com-role">Modo</span>' : "";
    const del = (_me && _me.id === m.author_id) ? `<button class="r-com-del" data-id="${m.id}">Supprimer</button>` : "";
    return `<div class="r-com">${comAvatar(a)}<div class="r-com-b">
      <div class="r-com-head"><b>${esc(a.username || "?")}</b>${role} <span class="r-com-t">${window.LT.timeAgo(m.created_at)}</span>${del}</div>
      <div class="r-com-txt">${comBody(m.body)}</div></div></div>`;
  }
  function renderComForm() {
    const wrap = document.getElementById("r-com-form");
    if (!wrap) return;
    if (_me) {
      wrap.innerHTML = `<form class="r-com-new"><textarea maxlength="5000" rows="2" placeholder="Votre commentaire sur ce chapitre…" required></textarea><button class="btn btn-primary" type="submit">Commenter</button></form>`;
      wrap.querySelector("form").addEventListener("submit", postComment);
    } else {
      wrap.innerHTML = `<div class="r-com-login">Pour commenter, <a href="forum.html">connecte-toi sur le forum</a> (même compte).</div>`;
    }
    document.querySelectorAll(".r-com-del").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Supprimer ce commentaire ?")) return;
      const { error } = await sbClient().from("chapter_comments").delete().eq("id", b.dataset.id);
      if (error) return window.LT.toast("Erreur : " + error.message);
      loadComments();
    }));
  }
  async function postComment(e) {
    e.preventDefault();
    const c = sbClient(); if (!c || !_me) return;
    const ta = e.target.querySelector("textarea");
    const body = ta.value.trim(); if (!body) return;
    e.target.querySelector("button").disabled = true;
    const { error } = await c.from("chapter_comments").insert({ manga_id: manga, chapter_num: chap.num, author_id: _me.id, body });
    if (error) { window.LT.toast("Erreur : " + error.message); e.target.querySelector("button").disabled = false; return; }
    ta.value = ""; loadComments();
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
