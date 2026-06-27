/* =========================================================================
   LanorTrad — Lecteur v2 (reconstruit de zéro)
   - Modes : webtoon (défilement) / page / double
   - Chrome escamotable (tap central), navigation clavier + tactile + swipe
   - Dock de navigation avec barre de pages (scrubber) + aperçu
   - Préférences mémorisées, reprise de lecture, préchargement, zoom
   - Téléchargement ZIP, écran de fin + commentaires Supabase
   ========================================================================= */
(function () {
  "use strict";

  /* ---------------------------------------------------------------- Données */
  const TEAM = [
    { role: "Traduction", who: "LanorTrad" },
    { role: "Clean",      who: "LanorTrad" },
    { role: "Edit",       who: "LanorTrad" },
    { role: "QC",         who: "LanorTrad" },
  ];
  const DISCORD = "https://discord.gg/md37S7nhkZ";

  const PREF_KEY = "lt-reader-prefs";
  const DEFAULTS = { mode: "webtoon", dir: "ltr", fit: "height", width: 820, gap: 0, bright: 1, bg: "#0b0b16" };
  const SWATCHES = ["#0b0b16", "#000000", "#11111f", "#1a1410", "#e9dcc3", "#f5f5f7"];
  const NARROW = 760;   // sous cette largeur, « double » → page simple

  /* ---------------------------------------------------------------- État */
  const A = {
    manga: null, S: null, chapters: [], chap: null,
    imgs: [], idx: 0, total: 0, view: "webtoon", lastDir: 1,
    chromeOff: false, autoOn: false, autoRAF: 0, autoSpeed: 1.4,
    preloadIO: null, trackIO: null, scrollPending: false,
    prefetched: null, sb: null, me: null, resumePage: 0,
  };
  let prefs = loadPrefs();

  const $ = (id) => document.getElementById(id);
  const effMode = () => (prefs.mode === "double" && innerWidth < NARROW) ? "page" : prefs.mode;

  /* ========================================================================
     INITIALISATION
     ===================================================================== */
  function init() {
    const p = new URLSearchParams(location.search);
    A.manga = p.get("manga");
    A.S = window.LT.seriesById(A.manga);
    A.chapters = (window.CHAPTERS || {})[A.manga] || [];

    document.body.classList.add("reader-body");
    applyVars();

    const root = $("reader-root");
    if (!A.S) { root.innerHTML = `<div class="rd">${emptyHTML("Série introuvable.")}</div>`; window.LT._scanReveals?.(); return; }

    document.title = `${A.S.title} — Lecture — LanorTrad`;
    window.LTstore && window.LTstore.markSeen(A.manga);

    // Chapitre demandé : URL > reprise > plus ancien dispo (chapitre 1)
    let wantNum = p.get("chapter");
    const saved = loadProgress();
    if (!wantNum && saved && A.chapters.some(c => c.num === saved.chapter)) { wantNum = saved.chapter; A.resumePage = saved.page || 0; }
    if (!wantNum && A.chapters.length) wantNum = A.chapters[A.chapters.length - 1].num;
    A.chap = A.chapters.find(c => c.num === wantNum);

    root.innerHTML = shellHTML();
    const rd = $("rd");
    rd.className = "rd";

    // Sélecteur de chapitres
    const sel = $("rd-chap-select");
    sel.innerHTML = A.chapters.map(c => `<option value="${c.num}">Chapitre ${c.num}</option>`).join("");
    sel.addEventListener("change", () => goChapter(sel.value));

    wireControls();
    wirePrefs();

    if (!A.chap) {
      $("rd-viewer").innerHTML = emptyHTML(
        A.chapters.length
          ? `Le chapitre ${wantNum || ""} n'est pas encore disponible dans cette démo.`
          : `Les chapitres de « ${A.S.title} » seront bientôt disponibles.`);
      return;
    }
    loadChapter();
  }

  /* ========================================================================
     SQUELETTE HTML
     ===================================================================== */
  function shellHTML() {
    return `
    <div class="rd" id="rd">
      <div class="rd-progress" id="rd-progress"></div>

      <header class="rd-top" id="rd-top">
        <a class="rd-back" href="${A.S.url}">${ic("left")}<span class="lbl">Fiche</span></a>
        <div class="rd-heading">
          <div class="t">${esc(A.S.title)}</div>
          <div class="c" id="rd-chap-label"></div>
        </div>
        <div class="rd-select"><select id="rd-chap-select" aria-label="Choisir un chapitre"></select></div>
        <button class="rd-icon-btn" id="rd-open-prefs" title="Préférences" aria-label="Préférences">${ic("gear")}</button>
      </header>

      <main class="rd-viewer" id="rd-viewer"><div class="rd-track" id="rd-track"></div></main>

      <div class="rd-hint l" aria-hidden="true">${ic("left")}</div>
      <div class="rd-hint r" aria-hidden="true">${ic("right")}</div>

      <div class="rd-rail" id="rd-rail">
        <button class="rd-fab" id="rd-auto" title="Défilement auto (A)" aria-label="Défilement automatique">${ic("auto")}</button>
        <button class="rd-fab" id="rd-full" title="Plein écran (F)" aria-label="Plein écran">${ic("full")}</button>
        <button class="rd-fab" id="rd-dl" title="Télécharger le chapitre" aria-label="Télécharger">${ic("dl")}</button>
        <button class="rd-fab" id="rd-help-btn" title="Aide (?)" aria-label="Aide">${ic("help")}</button>
        <button class="rd-fab rd-fab-top" id="rd-top-btn" title="Haut de page" aria-label="Haut de page">${ic("up")}</button>
      </div>

      <nav class="rd-dock" id="rd-dock">
        <button class="rd-chap" id="rd-prev" title="Chapitre précédent">${ic("left")}<span class="lbl">Préc.</span></button>
        <div class="rd-scrub">
          <div class="rd-preview" id="rd-preview" hidden><img id="rd-preview-img" alt=""><span id="rd-preview-num"></span></div>
          <input type="range" class="rd-range" id="rd-range" min="1" max="1" value="1" step="1" aria-label="Aller à une page">
          <div class="rd-count" id="rd-count">1 / 1</div>
        </div>
        <button class="rd-chap primary" id="rd-next" title="Chapitre suivant"><span class="lbl">Suiv.</span>${ic("right")}</button>
      </nav>

      <div class="rd-veil" id="rd-veil"></div>
      ${sheetHTML()}
      ${helpHTML()}
    </div>`;
  }

  function sheetHTML() {
    return `
    <aside class="rd-sheet" id="rd-sheet" role="dialog" aria-label="Préférences de lecture">
      <div class="rd-sheet-head">
        <h3>Préférences</h3>
        <button class="rd-sheet-close" id="rd-sheet-close" aria-label="Fermer">${ic("close")}</button>
      </div>
      <div class="rd-sheet-body">
        <p class="sub">Réglages mémorisés sur cet appareil.</p>

        <div class="rd-grp"><div class="lab">Mode de lecture</div>
          <div class="rd-seg" id="seg-mode">
            <button data-v="webtoon">Défilement</button>
            <button data-v="page">Page</button>
            <button data-v="double">Double</button>
          </div>
        </div>

        <div class="rd-grp"><div class="lab">Sens de lecture</div>
          <div class="rd-seg" id="seg-dir">
            <button data-v="ltr">Gauche → Droite</button>
            <button data-v="rtl">Droite → Gauche</button>
          </div>
        </div>

        <div class="rd-grp" id="grp-fit"><div class="lab">Ajustement (mode page)</div>
          <div class="rd-seg" id="seg-fit">
            <button data-v="height">Hauteur</button>
            <button data-v="width">Largeur</button>
            <button data-v="orig">Réel</button>
          </div>
        </div>

        <div class="rd-grp"><div class="lab">Largeur des pages <span class="val" id="val-width"></span></div>
          <input type="range" id="rg-width" min="560" max="1200" step="20">
        </div>

        <div class="rd-grp" id="grp-gap"><div class="lab">Espacement (défilement) <span class="val" id="val-gap"></span></div>
          <input type="range" id="rg-gap" min="0" max="40" step="2">
        </div>

        <div class="rd-grp"><div class="lab">Luminosité <span class="val" id="val-bright"></span></div>
          <input type="range" id="rg-bright" min="0.4" max="1.2" step="0.05">
        </div>

        <div class="rd-grp"><div class="lab">Fond du lecteur</div>
          <div class="rd-swatches" id="sw-bg">
            ${SWATCHES.map(c => `<button data-c="${c}" style="background:${c}" aria-label="Fond ${c}"></button>`).join("")}
          </div>
        </div>

        <button class="rd-reset" id="rd-reset">Réinitialiser les préférences</button>
      </div>
    </aside>`;
  }

  function helpHTML() {
    return `
    <div class="rd-help" id="rd-help">
      <div class="rd-help-card">
        <button class="x" id="rd-help-close" aria-label="Fermer">${ic("close")}</button>
        <h3>Raccourcis</h3>
        <div class="row"><span>Page suivante / précédente</span><span><kbd>→</kbd> <kbd>←</kbd></span></div>
        <div class="row"><span>Défiler (mode page)</span><span><kbd>Espace</kbd> <kbd>↑</kbd> <kbd>↓</kbd></span></div>
        <div class="row"><span>Masquer / afficher l'interface</span><kbd>Tap central</kbd></div>
        <div class="row"><span>Défilement automatique</span><kbd>A</kbd></div>
        <div class="row"><span>Plein écran</span><kbd>F</kbd></div>
        <div class="row"><span>Zoom (mode page)</span><span>double-clic / molette</span></div>
        <div class="row"><span>Cette aide</span><kbd>?</kbd></div>
      </div>
    </div>`;
  }

  /* ========================================================================
     CHARGEMENT D'UN CHAPITRE
     ===================================================================== */
  function loadChapter() {
    A.idx = 0; A.total = A.chap.pages; A.prefetched = null;
    $("rd-chap-label").textContent = `Chapitre ${A.chap.num} · ${A.chap.pages} pages`;
    $("rd-chap-select").value = A.chap.num;
    history.replaceState(null, "", `reader.html?manga=${encodeURIComponent(A.manga)}&chapter=${A.chap.num}`);

    const track = $("rd-track");
    const base = `Manga/${A.manga}/${A.chap.folder}/`;
    A.imgs = (A.chap.files || []).map((f, i) => {
      const im = document.createElement("img");
      im.src = encodeURI(base + f);
      im.alt = `${A.S.title} — Chapitre ${A.chap.num} — page ${i + 1}`;
      im.loading = i < 2 ? "eager" : "lazy";
      im.decoding = "async";
      im.dataset.i = i;
      const done = () => im.classList.add("loaded");
      if (im.complete && im.naturalWidth) done();
      else { im.addEventListener("load", done, { once: true }); im.addEventListener("error", done, { once: true }); }
      return im;
    });

    track.innerHTML = "";
    A.imgs.forEach(im => track.appendChild(im));
    track.appendChild(endScreen());

    const range = $("rd-range");
    range.max = Math.max(1, A.total); range.value = 1;

    updateChapBtns();
    applyMode();

    // Reprise de lecture (uniquement au premier chargement de la session)
    const resumeAt = A.resumePage; A.resumePage = 0;
    if (resumeAt > 0 && resumeAt < A.total) {
      if (prefs.mode === "webtoon") requestAnimationFrame(() => A.imgs[resumeAt]?.scrollIntoView({ block: "start" }));
      else showPage(resumeAt);
      window.LT.toast(`Reprise à la page ${resumeAt + 1}`);
    } else {
      scrollTo({ top: 0 });
      if (prefs.mode !== "webtoon") showPage(0);
    }

    saveProgress();
    updateScrub();
    updateProgress();
    loadComments();
  }

  /* ========================================================================
     MODES
     ===================================================================== */
  function applyMode() {
    A.view = effMode();
    const rd = $("rd");
    rd.classList.remove("mode-webtoon", "mode-page", "mode-double", "dir-ltr", "dir-rtl",
                        "fit-height", "fit-width", "fit-orig", "scrolled");
    rd.classList.add("mode-" + A.view, "dir-" + prefs.dir, "fit-" + prefs.fit);
    setChrome(true);   // un changement de mode réaffiche toujours l'interface

    // Le réglage « ajustement » ne concerne que le mode page
    $("grp-fit").style.display = (A.view === "page") ? "" : "none";
    $("grp-gap").style.display = (prefs.mode === "webtoon") ? "" : "none";

    if (A.view !== "webtoon") {
      showPage(A.idx);
    } else {
      A.imgs.forEach(im => { im.classList.remove("cur"); resetZoom(im); });
      $("rd-end")?.classList.remove("cur");
      rd.classList.remove("rd-zoomed");
    }
    setupPreload();
    updateProgress();
    updateScrub();
  }

  /* -------- Préchargement glissant (webtoon) -------- */
  function setupPreload() {
    if (A.preloadIO) { A.preloadIO.disconnect(); A.preloadIO = null; }
    if (A.trackIO) { A.trackIO.disconnect(); A.trackIO = null; }
    if (A.view !== "webtoon") return;
    A.preloadIO = new IntersectionObserver(ents => {
      ents.forEach(en => {
        if (!en.isIntersecting) return;
        const i = +en.target.dataset.i;
        for (let k = i; k <= i + 4; k++) eager(k);
      });
    }, { rootMargin: "1400px 0px 2400px 0px" });
    A.imgs.forEach(im => A.preloadIO.observe(im));
  }
  function eager(k) { const im = A.imgs[k]; if (im) { im.loading = "eager"; im.decode && im.decode().catch(() => {}); } }

  /* ========================================================================
     NAVIGATION PAGE (mode page / double)
     ===================================================================== */
  function showPage(i) {
    const end = $("rd-end");
    const step = A.view === "double" ? 2 : 1;
    A.idx = Math.max(0, Math.min(i, A.total));

    A.imgs.forEach(im => { im.classList.remove("cur"); resetZoom(im); });
    end.classList.remove("cur");

    if (A.idx >= A.total) {
      end.classList.add("cur");
    } else {
      A.imgs[A.idx].classList.add("cur");
      if (step === 2 && A.imgs[A.idx + 1]) A.imgs[A.idx + 1].classList.add("cur");
      attachZoom(A.imgs[A.idx]);
    }
    for (let k = A.idx - 1; k <= A.idx + 3; k++) eager(k);
    $("rd-viewer").scrollTo({ top: 0 });
    saveProgress(); updateProgress(); updateScrub(); maybePrefetch();
  }

  function nextPage() {
    A.lastDir = 1;
    const step = A.view === "double" ? 2 : 1;
    if (A.idx >= A.total) return nextChapter();
    showPage(A.idx + step);
  }
  function prevPage() {
    A.lastDir = -1;
    const step = A.view === "double" ? 2 : 1;
    if (A.idx <= 0) return prevChapter();
    showPage(A.idx - step);
  }

  /* ========================================================================
     NAVIGATION CHAPITRE  (liste triée décroissante : index-1 = suivant)
     ===================================================================== */
  function goChapter(num) {
    const c = A.chapters.find(x => x.num === num);
    if (!c) return;
    A.chap = c; toggleAuto(false); loadChapter();
  }
  function nextChapter() {
    const i = A.chapters.indexOf(A.chap);
    if (i > 0) goChapter(A.chapters[i - 1].num);
    else window.LT.toast("Vous êtes au dernier chapitre disponible 🎉");
  }
  function prevChapter() {
    const i = A.chapters.indexOf(A.chap);
    if (i < A.chapters.length - 1) goChapter(A.chapters[i + 1].num);
    else window.LT.toast("C'est le premier chapitre.");
  }
  function updateChapBtns() {
    const i = A.chapters.indexOf(A.chap);
    $("rd-prev").disabled = i >= A.chapters.length - 1;
    $("rd-next").disabled = i <= 0;
  }

  /* -------- Préchargement du chapitre suivant (silencieux) -------- */
  function prefetchNext() {
    const i = A.chapters.indexOf(A.chap);
    const next = i > 0 ? A.chapters[i - 1] : null;
    if (!next || A.prefetched === next.num) return;
    A.prefetched = next.num;
    const base = `Manga/${A.manga}/${next.folder}/`;
    (next.files || []).slice(0, 6).forEach(f => {
      const l = document.createElement("link");
      l.rel = "prefetch"; l.as = "image"; l.href = encodeURI(base + f);
      document.head.appendChild(l);
    });
  }
  function maybePrefetch() {
    let near;
    if (A.view === "webtoon") { const h = document.documentElement.scrollHeight - innerHeight; near = h > 0 && scrollY / h > 0.65; }
    else near = A.total > 0 && A.idx >= A.total - 3;
    if (near) prefetchNext();
  }

  /* ========================================================================
     BARRE DE PAGES (scrubber) + progression
     ===================================================================== */
  function currentWebtoonIndex() {
    const line = scrollY + innerHeight * 0.45;
    for (let i = 0; i < A.imgs.length; i++) {
      const r = A.imgs[i].getBoundingClientRect();
      const top = r.top + scrollY;
      if (r.height > 1 && line < top + r.height) return i;
    }
    // Repli (images pas encore mises en page) : fraction de défilement
    const h = document.documentElement.scrollHeight - innerHeight;
    const frac = h > 0 ? scrollY / h : 0;
    return Math.round(frac * Math.max(0, A.total - 1));
  }
  function updateScrub() {
    const range = $("rd-range"), count = $("rd-count");
    if (!range || !A.total) return;
    const cur = A.view === "webtoon" ? currentWebtoonIndex() : Math.min(A.idx, A.total - 1);
    if (document.activeElement !== range) range.value = cur + 1;
    count.textContent = (cur + 1) + " / " + A.total;
  }
  function scrubPreview(i) {
    const box = $("rd-preview"), img = $("rd-preview-img"), num = $("rd-preview-num"), range = $("rd-range");
    if (!A.imgs[i]) return;
    img.src = A.imgs[i].src; num.textContent = (i + 1) + " / " + A.total;
    box.hidden = false;
    const ratio = A.total > 1 ? i / (A.total - 1) : 0;
    box.style.left = (range.offsetLeft + ratio * range.offsetWidth) + "px";
  }
  function hidePreview() { setTimeout(() => { const b = $("rd-preview"); if (b) b.hidden = true; }, 500); }
  function scrubJump(i, live) {
    i = Math.max(0, Math.min(i, A.total - 1));
    if (A.view === "webtoon") A.imgs[i] && A.imgs[i].scrollIntoView({ block: "start", behavior: live ? "auto" : "smooth" });
    else showPage(i);
  }
  function updateProgress() {
    const bar = $("rd-progress");
    let pct = 0;
    if (A.view === "webtoon") { const h = document.documentElement.scrollHeight - innerHeight; pct = h > 0 ? scrollY / h : 0; }
    else pct = A.total ? Math.min(A.idx, A.total) / A.total : 0;
    bar.style.transform = `scaleX(${pct})`;
  }

  /* ========================================================================
     CONTRÔLES (clavier, tactile, dock, rail)
     ===================================================================== */
  function wireControls() {
    $("rd-open-prefs").addEventListener("click", openSheet);
    $("rd-top-btn").addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
    $("rd-full").addEventListener("click", toggleFull);
    $("rd-dl").addEventListener("click", downloadChapter);
    $("rd-auto").addEventListener("click", () => toggleAuto());
    $("rd-help-btn").addEventListener("click", () => toggleHelp());
    $("rd-help-close").addEventListener("click", () => toggleHelp(false));
    $("rd-help").addEventListener("click", e => { if (e.target.id === "rd-help") toggleHelp(false); });

    $("rd-prev").addEventListener("click", prevChapter);
    $("rd-next").addEventListener("click", nextChapter);

    const range = $("rd-range");
    range.addEventListener("input", () => { const i = +range.value - 1; scrubPreview(i); if (A.view === "webtoon") scrubJump(i, true); });
    range.addEventListener("change", () => { const i = +range.value - 1; if (A.view !== "webtoon") scrubJump(i); hidePreview(); });
    range.addEventListener("pointerup", hidePreview);
    range.addEventListener("mouseleave", () => { $("rd-preview").hidden = true; });

    // Défilement : progression + scrubber + masquage du chrome (descente)
    let lastY = 0;
    addEventListener("scroll", () => {
      if (A.scrollPending) return;
      A.scrollPending = true;
      requestAnimationFrame(() => {
        A.scrollPending = false;
        updateProgress(); updateScrub(); maybePrefetch();
        $("rd").classList.toggle("scrolled", scrollY > 600);
        if (A.view === "webtoon") {
          const down = scrollY > lastY && scrollY > 200;
          setChrome(!down);   // descente → masque, montée → affiche
          lastY = scrollY;
        }
      });
    }, { passive: true });

    // Gestes : tap (toggle/zone), swipe horizontal (mode page)
    wireViewerGestures();

    // Re-bascule double <-> page quand on franchit le seuil de largeur
    let rz;
    addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(() => { if (effMode() !== A.view) applyMode(); }, 150); }, { passive: true });

    // Clavier
    addEventListener("keydown", e => {
      if ($("rd-sheet").classList.contains("open") || $("rd-help").classList.contains("open")) {
        if (e.key === "Escape") { closeSheet(); toggleHelp(false); } return;
      }
      if (document.querySelector(".cmdk-overlay.open")) return;
      if (/input|textarea|select/i.test(document.activeElement.tagName)) return;
      const k = e.key.toLowerCase();
      if (e.key === "ArrowRight") prefs.dir === "rtl" ? prevPage() : nextPage();
      else if (e.key === "ArrowLeft") prefs.dir === "rtl" ? nextPage() : prevPage();
      else if (e.key === "ArrowDown" || e.key === " ") { if (A.view !== "webtoon") { e.preventDefault(); nextPage(); } }
      else if (e.key === "ArrowUp") { if (A.view !== "webtoon") { e.preventDefault(); prevPage(); } }
      else if (k === "f") toggleFull();
      else if (k === "a") toggleAuto();
      else if (e.key === "?") toggleHelp();
      else if (e.key === "Escape") setChrome(true);
    });
  }

  /* -------- Gestes sur la visionneuse : tap + swipe -------- */
  function wireViewerGestures() {
    const viewer = $("rd-viewer");
    let sx = 0, sy = 0, moved = false, multi = false, t0 = 0;

    viewer.addEventListener("pointerdown", e => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      sx = e.clientX; sy = e.clientY; moved = false; t0 = Date.now();
      multi = false;
    });
    viewer.addEventListener("pointermove", e => {
      if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) moved = true;
    });
    viewer.addEventListener("pointercancel", () => { multi = true; });
    viewer.addEventListener("pointerup", e => {
      if (multi) return;
      // Cibles interactives : laisser le comportement natif
      if (e.target.closest("a, button, input, textarea, select")) return;
      if ($("rd").classList.contains("rd-zoomed")) return;

      const dx = e.clientX - sx, dy = e.clientY - sy;

      // Swipe horizontal (mode page/double)
      if (A.view !== "webtoon" && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        dx < 0 ? (prefs.dir === "rtl" ? prevPage() : nextPage())
               : (prefs.dir === "rtl" ? nextPage() : prevPage());
        return;
      }
      // Tap (pas de glissement)
      if (moved || Date.now() - t0 > 500) return;
      const zone = e.clientX / innerWidth;   // 0..1
      if (A.view === "webtoon") { toggleChrome(); return; }
      if (zone < 0.33) prefs.dir === "rtl" ? nextPage() : prevPage();
      else if (zone > 0.67) prefs.dir === "rtl" ? prevPage() : nextPage();
      else toggleChrome();
    });
  }

  /* -------- Chrome (interface escamotable) -------- */
  function setChrome(visible) {
    A.chromeOff = !visible;
    $("rd").classList.toggle("chrome-off", A.chromeOff);
  }
  function toggleChrome() { setChrome(A.chromeOff); }

  function toggleFull() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }
  function toggleHelp(force) {
    const o = $("rd-help");
    o.classList.toggle("open", force === undefined ? !o.classList.contains("open") : force);
  }

  /* -------- Défilement automatique (webtoon) -------- */
  function toggleAuto(force) {
    A.autoOn = force === undefined ? !A.autoOn : force;
    $("rd-auto").classList.toggle("on", A.autoOn);
    if (A.autoOn) {
      if (prefs.mode !== "webtoon") return (toggleAuto(false), window.LT.toast("Le défilement auto fonctionne en mode Défilement."));
      window.LT.toast("Défilement auto · molette pour la vitesse");
      const tick = () => {
        if (!A.autoOn) return;
        scrollBy(0, A.autoSpeed);
        if (innerHeight + scrollY >= document.body.scrollHeight - 2) toggleAuto(false);
        else A.autoRAF = requestAnimationFrame(tick);
      };
      A.autoRAF = requestAnimationFrame(tick);
      addEventListener("wheel", autoWheel, { passive: true });
    } else {
      cancelAnimationFrame(A.autoRAF);
      removeEventListener("wheel", autoWheel);
    }
  }
  function autoWheel(e) { A.autoSpeed = Math.max(0.4, Math.min(6, A.autoSpeed + (e.deltaY > 0 ? 0.3 : -0.3))); }

  /* ========================================================================
     ZOOM (mode page / double)
     ===================================================================== */
  function attachZoom(img) {
    if (!img || A.view === "webtoon" || img._zoom) return;
    img._zoom = { scale: 1, x: 0, y: 0, drag: null, pts: new Map(), pd: 0 };
    img.classList.add("zoomable");
    const z = img._zoom;
    const apply = (anim) => {
      img.classList.toggle("zoom-anim", !!anim);
      img.style.transform = `translate(${z.x}px,${z.y}px) scale(${z.scale})`;
      img.classList.toggle("zoomed", z.scale > 1.01);
      $("rd").classList.toggle("rd-zoomed", z.scale > 1.01);
    };
    img.addEventListener("dblclick", e => { e.preventDefault(); if (z.scale > 1.01) { z.scale = 1; z.x = z.y = 0; } else z.scale = 2.4; apply(true); });
    img.addEventListener("wheel", e => {
      if (!e.ctrlKey && z.scale <= 1.01) return;
      e.preventDefault();
      z.scale = Math.max(1, Math.min(4, z.scale + (e.deltaY > 0 ? -0.2 : 0.2)));
      if (z.scale === 1) z.x = z.y = 0; apply(true);
    }, { passive: false });
    img.addEventListener("pointerdown", e => {
      z.pts.set(e.pointerId, e);
      if (z.pts.size === 1 && z.scale > 1.01) { z.drag = { x: e.clientX - z.x, y: e.clientY - z.y }; img.setPointerCapture(e.pointerId); }
    });
    img.addEventListener("pointermove", e => {
      if (!z.pts.has(e.pointerId)) return;
      z.pts.set(e.pointerId, e);
      if (z.pts.size === 2) {
        const [a, b] = [...z.pts.values()];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (z.pd) { z.scale = Math.max(1, Math.min(4, z.scale * (d / z.pd))); apply(false); }
        z.pd = d;
      } else if (z.drag && z.scale > 1.01) { z.x = e.clientX - z.drag.x; z.y = e.clientY - z.drag.y; apply(false); }
    });
    const up = e => { z.pts.delete(e.pointerId); z.drag = null; z.pd = 0; };
    img.addEventListener("pointerup", up);
    img.addEventListener("pointercancel", up);
    // Double-tap tactile
    let lastTap = 0, txy = null;
    img.addEventListener("pointerdown", e => { if (e.pointerType === "touch" && z.pts.size <= 1) txy = { x: e.clientX, y: e.clientY }; });
    img.addEventListener("pointerup", e => {
      if (e.pointerType !== "touch" || !txy) return;
      const moved = Math.hypot(e.clientX - txy.x, e.clientY - txy.y); txy = null;
      if (moved > 12) return;
      const now = Date.now();
      if (now - lastTap < 300) { if (z.scale > 1.01) { z.scale = 1; z.x = z.y = 0; } else z.scale = 2.4; apply(true); lastTap = 0; }
      else lastTap = now;
    });
  }
  function resetZoom(img) {
    if (img && img._zoom) { img._zoom.scale = 1; img._zoom.x = img._zoom.y = 0; img.style.transform = ""; img.classList.remove("zoomed"); }
  }

  /* ========================================================================
     PRÉFÉRENCES
     ===================================================================== */
  function applyVars() {
    const r = document.documentElement.style;
    r.setProperty("--rd-w", prefs.width + "px");
    r.setProperty("--rd-gap", prefs.gap + "px");
    r.setProperty("--rd-bright", prefs.bright);
    r.setProperty("--rd-bg", prefs.bg);
    if (A.S && A.S.accent) r.setProperty("--rd-accent", A.S.accent);
    document.body.style.background = prefs.bg;
    const tc = document.querySelector('meta[name="theme-color"]'); if (tc) tc.content = prefs.bg;
  }

  function openSheet() { $("rd-veil").classList.add("open"); $("rd-sheet").classList.add("open"); }
  function closeSheet() { $("rd-veil").classList.remove("open"); $("rd-sheet").classList.remove("open"); }

  function wirePrefs() {
    $("rd-sheet-close").addEventListener("click", closeSheet);
    $("rd-veil").addEventListener("click", closeSheet);

    bindSeg("seg-mode", v => {
      prefs.mode = v; savePrefs(); applyMode();
      if (v === "double" && innerWidth < NARROW) window.LT.toast("Petit écran : « double » s'affiche en page simple.");
    });
    bindSeg("seg-dir", v => { prefs.dir = v; savePrefs(); applyMode(); });
    bindSeg("seg-fit", v => { prefs.fit = v; savePrefs(); applyMode(); });

    bindRange("rg-width", "val-width", "width", v => v + " px");
    bindRange("rg-gap", "val-gap", "gap", v => v + " px");
    bindRange("rg-bright", "val-bright", "bright", v => Math.round(v * 100) + " %");

    document.querySelectorAll("#sw-bg button").forEach(b => {
      b.classList.toggle("on", b.dataset.c === prefs.bg);
      b.addEventListener("click", () => {
        prefs.bg = b.dataset.c; savePrefs(); applyVars();
        document.querySelectorAll("#sw-bg button").forEach(x => x.classList.toggle("on", x === b));
      });
    });

    $("rd-reset").addEventListener("click", () => {
      prefs = { ...DEFAULTS }; savePrefs(); applyVars(); syncPrefUI(); applyMode();
      document.querySelectorAll("#sw-bg button").forEach(x => x.classList.toggle("on", x.dataset.c === prefs.bg));
      window.LT.toast("Préférences réinitialisées.");
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
  function bindRange(id, valId, key, fmt) {
    const el = $(id);
    el.addEventListener("input", () => { prefs[key] = parseFloat(el.value); $(valId).textContent = fmt(prefs[key]); savePrefs(); applyVars(); });
  }
  function syncPrefUI() {
    setSeg("seg-mode", prefs.mode); setSeg("seg-dir", prefs.dir); setSeg("seg-fit", prefs.fit);
    setRange("rg-width", "val-width", prefs.width, v => v + " px");
    setRange("rg-gap", "val-gap", prefs.gap, v => v + " px");
    setRange("rg-bright", "val-bright", prefs.bright, v => Math.round(v * 100) + " %");
  }
  function setSeg(id, v) { document.querySelectorAll(`#${id} button`).forEach(b => b.classList.toggle("on", b.dataset.v === v)); }
  function setRange(id, valId, v, fmt) { const el = $(id); if (!el) return; el.value = v; $(valId).textContent = fmt(v); }

  /* ========================================================================
     TÉLÉCHARGEMENT ZIP
     ===================================================================== */
  async function downloadChapter() {
    if (typeof JSZip === "undefined") return window.LT.toast("Téléchargement indisponible.");
    window.LT.toast("Préparation du téléchargement…");
    const zip = new JSZip();
    const base = `Manga/${A.manga}/${A.chap.folder}/`;
    try {
      await Promise.all((A.chap.files || []).map(async f => {
        const res = await fetch(encodeURI(base + f));
        zip.file(f, await res.blob());
      }));
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${A.S.title} - Chapitre ${A.chap.num}.zip`;
      a.click(); URL.revokeObjectURL(a.href);
      window.LT.toast("Téléchargement prêt ✓");
    } catch { window.LT.toast("Échec du téléchargement."); }
  }

  /* ========================================================================
     ÉCRAN DE FIN + indispo
     ===================================================================== */
  function endScreen() {
    const wrap = window.LT.el(`
      <div class="rd-end" id="rd-end">
        <div class="thanks">Fin du chapitre ${A.chap.num}</div>
        <div class="title">${esc(A.S.title)}</div>
        <div class="rd-credits">${TEAM.map(t => `<div class="cr"><div class="role">${t.role}</div><div class="who">${t.who}</div></div>`).join("")}</div>
        <div class="rd-end-nav">
          <button class="btn btn-ghost" id="rd-end-prev">${ic("left")} Précédent</button>
          <a class="btn btn-primary" href="${DISCORD}" target="_blank" rel="noopener">Rejoindre le Discord</a>
          <button class="btn btn-ghost" id="rd-end-next">Suivant ${ic("right")}</button>
        </div>
        <div class="rd-comments" id="rd-comments"></div>
      </div>`);
    setTimeout(() => {
      wrap.querySelector("#rd-end-prev")?.addEventListener("click", prevChapter);
      wrap.querySelector("#rd-end-next")?.addEventListener("click", nextChapter);
    }, 0);
    return wrap;
  }
  function emptyHTML(msg) {
    return `<div class="rd-empty"><div class="big">🚧</div><p>${esc(msg)}</p>
      <div class="acts">
        <a class="btn btn-ghost" href="${A.S ? A.S.url : "catalogue.html"}">Retour à la fiche</a>
        <a class="btn btn-primary" href="index.html">Accueil</a>
      </div></div>`;
  }

  /* ========================================================================
     COMMENTAIRES PAR CHAPITRE (Supabase) — conservé de l'ancien lecteur
     ===================================================================== */
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;"); }
  const comBody = s => esc(s).replace(/(^|[\s(])@([A-Za-z0-9_]{3,24})/g, '$1<span class="rd-com-mention">@$2</span>').replace(/\n/g, "<br>");

  function sbClient() {
    if (A.sb) return A.sb;
    const C = window.LT_SUPABASE || {};
    if (!window.supabase || !C.url || !C.anonKey || /VOTRE_|YOUR_/i.test(C.url + C.anonKey)) return null;
    A.sb = window.supabase.createClient(C.url, C.anonKey);
    return A.sb;
  }
  function comAvatar(p, size = 34) {
    const name = (p && p.username) || "?";
    const initials = name.slice(0, 2).toUpperCase();
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return `<span class="rd-com-av" style="width:${size}px;height:${size}px;background:linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 50) % 360} 70% 45%))">${esc(initials)}</span>`;
  }
  async function loadComments() {
    const box = $("rd-comments");
    if (!box) return;
    const c = sbClient();
    if (!c) { box.innerHTML = ""; return; }
    box.innerHTML = `<h3 class="rd-com-h">💬 Commentaires du chapitre</h3><div class="rd-com-list" id="rd-com-list">Chargement…</div><div id="rd-com-form"></div>`;
    const { data: { session } } = await c.auth.getSession();
    A.me = session ? session.user : null;
    const { data, error } = await c.from("chapter_comments")
      .select("id,body,created_at,author_id,author:profiles(username,avatar_url,role)")
      .eq("manga_id", A.manga).eq("chapter_num", A.chap.num).order("created_at", { ascending: true });
    const list = $("rd-com-list");
    if (!list) return;
    if (error) { list.innerHTML = `<div class="rd-com-empty">Les commentaires seront bientôt disponibles.</div>`; renderComForm(); return; }
    list.innerHTML = (data && data.length) ? data.map(comRow).join("") : `<div class="rd-com-empty">Aucun commentaire. Lance la discussion !</div>`;
    renderComForm();
  }
  function comRow(m) {
    const a = m.author || {};
    const role = a.role === "admin" ? ' <span class="rd-com-role">Admin</span>' : a.role === "moderator" ? ' <span class="rd-com-role">Modo</span>' : "";
    const del = (A.me && A.me.id === m.author_id) ? `<button class="rd-com-del" data-id="${m.id}">Supprimer</button>` : "";
    return `<div class="rd-com">${comAvatar(a)}<div class="rd-com-b">
      <div class="rd-com-head"><b>${esc(a.username || "?")}</b>${role} <span class="rd-com-t">${window.LT.timeAgo(m.created_at)}</span>${del}</div>
      <div class="rd-com-txt">${comBody(m.body)}</div></div></div>`;
  }
  function renderComForm() {
    const wrap = $("rd-com-form");
    if (!wrap) return;
    if (A.me) {
      wrap.innerHTML = `<form class="rd-com-new"><textarea maxlength="5000" rows="2" placeholder="Votre commentaire sur ce chapitre…" required></textarea><button class="btn btn-primary" type="submit">Commenter</button></form>`;
      wrap.querySelector("form").addEventListener("submit", postComment);
    } else {
      wrap.innerHTML = `<div class="rd-com-login">Pour commenter, <a href="forum.html">connecte-toi sur le forum</a> (même compte).</div>`;
    }
    document.querySelectorAll(".rd-com-del").forEach(b => b.addEventListener("click", async () => {
      if (!confirm("Supprimer ce commentaire ?")) return;
      const { error } = await sbClient().from("chapter_comments").delete().eq("id", b.dataset.id);
      if (error) return window.LT.toast("Erreur : " + error.message);
      loadComments();
    }));
  }
  async function postComment(e) {
    e.preventDefault();
    const c = sbClient(); if (!c || !A.me) return;
    const ta = e.target.querySelector("textarea");
    const body = ta.value.trim(); if (!body) return;
    e.target.querySelector("button").disabled = true;
    const { error } = await c.from("chapter_comments").insert({ manga_id: A.manga, chapter_num: A.chap.num, author_id: A.me.id, body });
    if (error) { window.LT.toast("Erreur : " + error.message); e.target.querySelector("button").disabled = false; return; }
    ta.value = ""; loadComments();
  }

  /* ========================================================================
     PERSISTANCE
     ===================================================================== */
  function loadPrefs() { try { return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(PREF_KEY) || "{}")); } catch { return { ...DEFAULTS }; } }
  function savePrefs() { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }
  function saveProgress() { try { localStorage.setItem("lt-progress-" + A.manga, JSON.stringify({ chapter: A.chap.num, page: A.idx, t: Date.now() })); } catch {} }
  function loadProgress() { try { return JSON.parse(localStorage.getItem("lt-progress-" + A.manga) || "null"); } catch { return null; } }

  /* ========================================================================
     ICÔNES
     ===================================================================== */
  function ic(name) {
    const S = { w: 18, sw: 2 };
    const svg = (inner, w = S.w) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${S.sw}" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    switch (name) {
      case "left":  return svg(`<path d="M19 12H5M11 6l-6 6 6 6"/>`);
      case "right": return svg(`<path d="M5 12h14M13 6l6 6-6 6"/>`);
      case "up":    return svg(`<path d="M12 19V5M5 12l7-7 7 7"/>`);
      case "close": return svg(`<path d="M6 6l12 12M18 6 6 18"/>`, 20);
      case "full":  return svg(`<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>`);
      case "auto":  return svg(`<path d="M12 5v14M6 13l6 6 6-6"/>`);
      case "dl":    return svg(`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>`, 20);
      case "help":  return svg(`<circle cx="12" cy="12" r="9"/><path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.5-2.8 2.5"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>`);
      case "gear":  return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 19l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4 13.6H3.9a2 2 0 1 1 0-4H4a1.6 1.6 0 0 0 1.5-2.6l-.1-.1A2 2 0 1 1 8.1 4l.1.1A1.6 1.6 0 0 0 10 4.4V4a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1A2 2 0 1 1 19.7 8l-.1.1a1.6 1.6 0 0 0-.2 1.7"/></svg>`;
      default: return "";
    }
  }

  document.addEventListener("lt:ready", init);
})();
