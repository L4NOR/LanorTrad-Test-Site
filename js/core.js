/* =========================================================================
   LanorTrad — Noyau partagé : shell (nav/footer/fond), thème, reveals,
   transitions de page, recherche, helpers. Chargé sur toutes les pages.
   ========================================================================= */
(function () {
  "use strict";

  const NAV = [
    { label: "Accueil",      href: "index.html" },
    { label: "Catalogue",    href: "catalogue.html" },
    { label: "Planning",     href: "planning.html" },
    { label: "Forum",        href: "forum.html" },
    { label: "Classement",   href: "classement.html" },
    { label: "Bibliothèque", href: "bibliotheque.html" },
    { label: "Équipe",       href: "equipe.html" },
  ];
  const DISCORD = "https://discord.gg/md37S7nhkZ";
  const TWITTER = "https://x.com/LanorTrad";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ---------- Thème ---------- */
  const THEMES = ["dark", "oled", "light"];
  const THEME_ICON = { dark: "☾", oled: "●", light: "☀" };
  const THEME_LABEL = { dark: "Sombre", oled: "OLED (noir pur)", light: "Clair" };
  const savedTheme = localStorage.getItem("lt-theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  function cycleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = THEMES[(THEMES.indexOf(cur) + 1) % THEMES.length];
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("lt-theme", next);
    syncThemeIcon();
    toast("Thème : " + THEME_LABEL[next]);
  }
  function syncThemeIcon() {
    const t = document.documentElement.getAttribute("data-theme") || "dark";
    $$(".theme-ico").forEach(el => el.textContent = THEME_ICON[t] || "☾");
  }

  /* ---------- Fluidité (mode léger pour PC modestes, géré par perf.js) ---------- */
  const PERF_LABEL = { auto: "Automatique", high: "Qualité maximale", lite: "Mode léger" };
  function cyclePerf() {
    if (!window.LTperf) return;
    const mode = window.LTperf.cycle();
    const suffix = mode === "auto" ? ` (${window.LTperf.get() === "lite" ? "léger" : "complet"})` : "";
    syncPerfIcon();
    toast("Fluidité : " + (PERF_LABEL[mode] || mode) + suffix);
  }
  function syncPerfIcon() {
    if (!window.LTperf) return;
    const btn = $('.rn-item[data-action="perf"]');
    if (!btn) return;
    const name = "Fluidité : " + (PERF_LABEL[window.LTperf.mode()] || "Automatique");
    btn.dataset.name = name;
    btn.setAttribute("aria-label", name);
    btn.classList.toggle("perf-lite", window.LTperf.get() === "lite");
  }

  /* ---------- Shell : fond + navbar + drawer + footer ---------- */
  const minimal = document.body.dataset.shell === "minimal";

  function buildShell() {
    // Lien d'évitement (accessibilité clavier) : 1er élément focusable
    const mainEl = document.querySelector("main") || document.getElementById("reader-root");
    if (mainEl) { if (!mainEl.id) mainEl.id = "main-content"; mainEl.setAttribute("tabindex", "-1"); }
    document.body.prepend(el(`<a href="#${mainEl ? mainEl.id : "main-content"}" class="skip-link">Aller au contenu</a>`));

    // Veil + toast host (toujours présents)
    document.body.append(el(`<div class="page-veil" id="veil"></div>`));
    document.body.append(el(`<div class="toast-host" id="toast-host"></div>`));

    if (minimal) { syncThemeIcon(); return; } // lecteur : pas de nav/footer/fond

    // Fond animé
    const fx = el(`<div class="bg-fx" aria-hidden="true"><span class="bg-blob b1"></span><span class="bg-blob b2"></span><span class="bg-blob b3"></span></div>`);
    const grain = el(`<div class="bg-grain" aria-hidden="true"></div>`);
    document.body.prepend(grain);
    document.body.prepend(fx);

    // Navigation radiale : un bouton rond en bas-centre, les pages jaillissent en bulles
    const RN = [
      { label: "Accueil",      href: "index.html",        ic: "home" },
      { label: "Catalogue",    href: "catalogue.html",    ic: "grid" },
      { label: "Planning",     href: "planning.html",     ic: "calendar" },
      { label: "Bibliothèque", href: "bibliotheque.html", ic: "library" },
      { label: "Forum",        href: "forum.html",        ic: "chat" },
      { label: "Classement",   href: "classement.html",   ic: "trophy" },
      { label: "Équipe",       href: "equipe.html",       ic: "users" },
      { type: "search", label: "Recherche", ic: "search" },
      { type: "theme",  label: "Thème",     ic: "theme" },
      { type: "perf",   label: "Fluidité",  ic: "gauge" },
      { label: "Discord", href: DISCORD, ic: "discord", external: true },
    ];
    // Bulles : icône seule (le nom s'affiche dans la légende au survol/appui).
    const rnItem = (it, i) => {
      const attr = `style="--i:${i}" data-name="${it.label}" aria-label="${it.label}"`;
      if (it.type === "search")
        return `<button type="button" class="rn-item rn-action" data-action="search" ${attr}><span class="rn-ic">${icon("search")}</span></button>`;
      if (it.type === "theme")
        return `<button type="button" class="rn-item rn-action" data-action="theme" ${attr}><span class="rn-ic"><span class="theme-ico">☾</span></span></button>`;
      if (it.type === "perf")
        return `<button type="button" class="rn-item rn-action" data-action="perf" ${attr}><span class="rn-ic">${icon("gauge")}</span></button>`;
      if (it.external)
        return `<a class="rn-item" href="${it.href}" target="_blank" rel="noopener" data-external ${attr}><span class="rn-ic">${icon(it.ic)}</span></a>`;
      const cls = `rn-item ${it.href === page ? "current" : ""}`;
      const badge = it.href === "bibliotheque.html" ? `<span class="nav-badge rn-badge" data-follow-badge hidden></span>` : "";
      return `<a class="${cls}" href="${it.href}" ${attr}><span class="rn-ic">${icon(it.ic)}</span>${badge}</a>`;
    };
    const radial = el(`
      <nav class="radial-nav" id="radial-nav" aria-label="Navigation principale">
        <div class="rn-scrim" id="rn-scrim"></div>
        <div class="rn-caption" id="rn-caption" aria-live="polite"></div>
        <div class="rn-items" id="rn-items" style="--n:${RN.length}">${RN.map(rnItem).join("")}</div>
        <button type="button" class="rn-toggle" id="rn-toggle" aria-label="Ouvrir le menu" aria-expanded="false" aria-haspopup="menu">
          <span class="rn-ico rn-ico-open">${icon("apps")}</span>
          <span class="rn-ico rn-ico-close">${icon("close")}</span>
        </button>
      </nav>`);
    document.body.append(radial);

    // Bouton de recherche toujours visible (raccourci vers la palette ⌘K)
    document.body.append(el(`<button type="button" class="search-fab" data-open-search aria-label="Rechercher" title="Rechercher (/)">${icon("search")}</button>`));

    // Footer
    const yr = new Date().getFullYear();
    const fS = window.SERIES || [];
    const fSeries = fS.filter(s => s.type === "manga").length;
    const fChapters = fS.reduce((a, s) => a + (s.chapters || 0), 0);
    const footer = el(`
      <footer class="footer">
        <div class="wrap grid">
          <div>
            <a href="index.html" class="brand" style="font-size:1.5rem"><img class="brand-logo" src="images/icons/icon-96x96.png" alt="LanorTrad" width="44" height="44"><span class="brand-name">Lanor<span class="grad-text">Trad</span></span></a>
            <p style="margin-top:14px">Trois fans qui traduisent, nettoient et vérifient chaque page sur leur temps libre. Gratuit, en français, pour toi.</p>
            <div class="socials">
              <a href="${DISCORD}" target="_blank" rel="noopener" class="icon-btn">${icon("discord")}</a>
              <a href="${TWITTER}" target="_blank" rel="noopener" class="icon-btn">${icon("x")}</a>
            </div>
          </div>
          <div>
            <h4>Navigation</h4>
            <ul>${NAV.map(n => `<li><a href="${n.href}">${n.label}</a></li>`).join("")}</ul>
          </div>
          <div>
            <h4>LanorTrad</h4>
            <ul>
              <li>${fSeries || 5} séries traduites</li>
              <li>${fChapters ? fChapters + "+" : "500+"} chapitres</li>
              <li><a href="feed.xml">📡 Flux RSS des sorties</a></li>
              <li><a href="${page === "forum.html" ? "forum.html?tour=1" : "index.html?tour=1"}">🧭 ${page === "forum.html" ? "Revoir le tuto du forum" : "Revoir la visite guidée"}</a></li>
              <li><a href="${DISCORD}" target="_blank" rel="noopener">Signaler un problème</a></li>
            </ul>
          </div>
          <div>
            <h4>Le site</h4>
            <ul>
              <li><a href="mentions-legales.html">Mentions légales</a></li>
              <li><a href="confidentialite.html">Confidentialité</a></li>
              <li><a href="mentions-legales.html#signalement">Signaler un contenu</a></li>
              <li><button type="button" class="link-btn" data-reopen-consent>Mesure d'audience</button></li>
            </ul>
          </div>
        </div>
        <div class="copy">© 2024–${yr} LanorTrad — traduit à la main, souvent tard le soir.</div>
      </footer>`);
    document.body.append(footer);

    wireShell();
    syncThemeIcon();
    syncPerfIcon();
  }

  function wireShell() {
    const rn = $("#radial-nav");
    if (!rn) return;
    const toggle = $("#rn-toggle"), scrim = $("#rn-scrim");
    const items = $$(".rn-item", rn);

    // Arc unique régulier au-dessus du bouton : bulles identiques, sans libellé.
    const RAD = Math.PI / 180;
    const layout = () => {
      const n = items.length, w = innerWidth, narrow = w < 560;
      const spread = narrow ? 166 : 150, start = 90 + spread / 2, step = spread / (n - 1);
      const bubbleR = narrow ? 22 : 28, margin = 12;
      const maxX = w / 2 - margin - bubbleR;
      const R = Math.max(124, Math.min(narrow ? 200 : 300, maxX / Math.sin((spread / 2) * RAD)));
      items.forEach((it, i) => {
        const a = (start - i * step) * RAD;
        it.style.setProperty("--x", (Math.cos(a) * R).toFixed(1) + "px");
        it.style.setProperty("--y", (-Math.sin(a) * R).toFixed(1) + "px");
      });
    };
    layout();
    addEventListener("resize", layout, { passive: true });

    // Légende : nom de la page survolée / appuyée (par défaut, la page courante).
    const caption = $("#rn-caption");
    const resetCaption = () => {
      const cur = items.find(it => it.classList.contains("current"));
      caption.textContent = cur ? cur.dataset.name : "Naviguer";
    };
    items.forEach(it => {
      const show = () => caption.textContent = it.dataset.name;
      it.addEventListener("pointerenter", show);
      it.addEventListener("focus", show);
      it.addEventListener("pointerleave", resetCaption);
      it.addEventListener("blur", resetCaption);
    });

    let open = false;
    const setOpen = v => {
      open = v;
      rn.classList.toggle("open", v);
      document.body.classList.toggle("rn-open", v);
      toggle.setAttribute("aria-expanded", String(v));
      toggle.setAttribute("aria-label", v ? "Fermer le menu" : "Ouvrir le menu");
      if (v) resetCaption();
    };
    toggle.addEventListener("click", () => setOpen(!open));
    scrim.addEventListener("click", () => setOpen(false));
    document.addEventListener("keydown", e => { if (e.key === "Escape" && open) setOpen(false); });

    items.forEach(it => it.addEventListener("click", e => {
      const act = it.dataset.action;
      if (act === "theme")  { e.preventDefault(); cycleTheme(); return; }      // garde le menu ouvert
      if (act === "perf")   { e.preventDefault(); cyclePerf(); return; }        // garde le menu ouvert
      if (act === "search") { e.preventDefault(); setOpen(false); openPalette(); return; }
      if (it.classList.contains("current")) e.preventDefault();                // déjà sur cette page
      setOpen(false);                                                          // page → transition + ferme
    }));
  }

  /* ---------- Transitions de page (View Transitions + fallback) ---------- */
  const VT = !!(window.CSS && CSS.supports && CSS.supports("view-transition-name", "x"));
  function go(href) {
    const veil = $("#veil");
    if (veil) veil.classList.add("in");
    setTimeout(() => (location.href = href), 440);
  }
  function isInternal(a) {
    const href = a.getAttribute("href");
    if (!href || a.target === "_blank" || /^(https?:|#|mailto:|tel:)/.test(href)) return false;
    return !a.hasAttribute("data-external");
  }
  function wirePageTransitions() {
    if (!VT) document.documentElement.classList.add("no-vt");
    document.addEventListener("click", e => {
      if (e.target.closest(".follow-btn")) return;
      const a = e.target.closest("a");
      if (!a) return;
      // couverture qui se transforme vers la fiche
      if (isInternal(a) && /manga\.html/.test(a.getAttribute("href"))) {
        const morph = a.querySelector("[data-morph]") || (a.matches("[data-morph]") ? a : null);
        if (morph) morph.style.viewTransitionName = "cover-active";
      }
      if (VT) return;                       // navigation native → View Transitions
      if (!isInternal(a)) return;
      e.preventDefault();
      go(a.getAttribute("href"));
    });
    if (!VT) {
      document.body.classList.add("fade-enter");
      const veil = $("#veil");
      if (veil) { veil.classList.add("in"); requestAnimationFrame(() => { veil.classList.remove("in"); veil.classList.add("out"); setTimeout(() => veil.classList.remove("out"), 520); }); }
    }
  }

  /* ---------- Suivis (délégué) ---------- */
  function wireFollows() {
    document.addEventListener("click", e => {
      const btn = e.target.closest(".follow-btn");
      if (!btn) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const id = btn.dataset.follow;
      const added = window.LTstore.toggleFollow(id);
      $$(`.follow-btn[data-follow="${cssAttr(id)}"]`).forEach(b => {
        b.classList.toggle("on", added);
        b.title = added ? "Suivi" : "Suivre";
        b.setAttribute("aria-label", added ? "Ne plus suivre" : "Suivre cette série");
      });
      btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
      toast(added ? "🔔 Série suivie" : "Suivi retiré");
    }, true);
  }
  function cssAttr(v) { return (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/"/g, '\\"'); }

  /* ---------- Pastille « nouveautés » sur Bibliothèque ---------- */
  function updateFollowBadge() {
    if (!window.LTstore) return;
    const n = window.LTstore.followedNewCount();
    $$("[data-follow-badge]").forEach(b => {
      b.textContent = n > 99 ? "99+" : n;
      b.hidden = n === 0;
    });
  }

  /* ---------- Palette de recherche ⌘K ---------- */
  let pal, palInput, palList, palItems = [], palActive = -1;
  function buildPalette() {
    pal = el(`
      <div class="cmdk-overlay" id="cmdk">
        <div class="cmdk" role="dialog" aria-label="Recherche">
          <div class="cmdk-input">
            ${icon("search")}
            <input type="search" id="cmdk-input" placeholder="Rechercher une série, un genre…" autocomplete="off" aria-label="Rechercher">
            <kbd>Échap</kbd>
          </div>
          <div class="cmdk-list" id="cmdk-list"></div>
        </div>
      </div>`);
    document.body.append(pal);
    palInput = $("#cmdk-input", pal);
    palList = $("#cmdk-list", pal);
    pal.addEventListener("click", e => { if (e.target === pal) closePalette(); });
    palInput.addEventListener("input", renderPalette);
    palInput.addEventListener("keydown", palKeys);
    renderPalette();
  }
  function openPalette() { if (!pal) return; pal.classList.add("open"); document.body.style.overflow = "hidden"; setTimeout(() => palInput.focus(), 40); renderPalette(); }
  function closePalette() { if (!pal) return; pal.classList.remove("open"); document.body.style.overflow = ""; palInput.value = ""; }
  function palKeys(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); setPalActive(palActive + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setPalActive(palActive - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const it = palItems[palActive] || palItems[0]; if (it) choosePal(it); }
  }
  function setPalActive(i) {
    const rows = $$(".cmdk-item", palList);
    if (!rows.length) return;
    palActive = (i + rows.length) % rows.length;
    rows.forEach((r, k) => r.classList.toggle("active", k === palActive));
    rows[palActive].scrollIntoView({ block: "nearest" });
  }
  function choosePal(it) { window.LTstore.addRecent(it.term || it.title); closePalette(); location.href = it.url; }

  /* Normalisation pour la recherche : sans accent, sans ponctuation, en
     minuscules. « Épouvante », « epouvante » et « EPOUVANTE » deviennent le
     même texte, et « ao-no exorcist » retrouve « Ao No Exorcist ». */
  const norm = s => String(s == null ? "" : s)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

  /* « tougen 240 », « ao no exorcist chapitre 166 », « satsudou ch 5 » :
     on isole le numéro de chapitre pour pouvoir proposer un lien direct. */
  function splitChapter(term) {
    const m = term.match(/^(.*?)(?:\s+(?:chapitres?|chap|ch|episode|ep|#))?\s+(\d+(?:\.\d+)?)$/i)
           || term.match(/^(.*?)\s*(?:chapitres?|chap|ch|#)\s*(\d+(?:\.\d+)?)$/i);
    if (!m || !m[1].trim()) return { base: term, num: null };
    return { base: m[1].trim(), num: m[2] };
  }

  function matches(s, q) {
    if (!q) return true;
    const hay = norm([s.title, s.id, (s.genres || []).join(" "), s.author, s.artist].join(" "));
    return q.split(" ").every(w => hay.includes(w));
  }

  function renderPalette() {
    const raw = (palInput.value || "").trim();
    const S = window.SERIES || [];
    palActive = -1;

    if (!raw) {
      const rec = window.LTstore.recents();
      const trend = [...S].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
      palItems = trend.map(serieItem);
      palList.innerHTML =
        (rec.length ? `<div class="cmdk-sec">Récent</div><div style="padding:4px 8px">${rec.map(r => `<span class="cmdk-recent" data-term="${r}">${icon("clock")} ${r}</span>`).join("")}</div>` : "") +
        `<div class="cmdk-sec">Tendances</div>` + palItems.map(palRow).join("");
      $$(".cmdk-recent", palList).forEach(c => c.addEventListener("click", () => { palInput.value = c.dataset.term; renderPalette(); palInput.focus(); }));
      wirePalRows();
      return;
    }

    const { base, num } = splitChapter(norm(raw));
    // Le numéro n'est retenu que s'il ne fait pas partie du titre lui-même
    // (« Countdown 2 » ne doit pas perdre son « 2 » s'il existe une telle série).
    const byFull = S.filter(s => matches(s, norm(raw)));
    const byBase = num ? S.filter(s => matches(s, base)) : [];
    const useChapter = num && !byFull.length && byBase.length;

    const rows = [];
    if (useChapter) {
      byBase.slice(0, 3).forEach(s => {
        const ch = ((window.CHAPTERS || {})[s.id] || []).find(c => String(c.num) === String(num));
        if (ch) rows.push(chapterItem(s, ch, raw));
      });
    }
    (byFull.length ? byFull : byBase).slice(0, 8).forEach(s => rows.push(serieItem(s)));

    palItems = rows;
    if (!rows.length) {
      palList.innerHTML = `<div class="cmdk-empty">Rien pour « ${escAttr(raw)} »… essaie un titre, un genre ou un auteur.</div>`;
      return;
    }
    let html = "", section = null;
    rows.forEach(it => {
      if (it.kind !== section) { section = it.kind; html += `<div class="cmdk-sec">${section === "chapitre" ? "Aller au chapitre" : "Séries"}</div>`; }
      html += palRow(it);
    });
    palList.innerHTML = html;
    wirePalRows();
  }

  function wirePalRows() {
    $$(".cmdk-item", palList).forEach((r, k) => {
      r.addEventListener("click", () => choosePal(palItems[k]));
      r.addEventListener("mousemove", () => setPalActive(k));
    });
  }

  const escAttr = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function serieItem(s) {
    return { kind: "serie", title: s.title, url: s.url, cover: s.cover,
             sub: `${s.status} · ${(s.genres || []).slice(0, 2).join(", ")}` };
  }
  function chapterItem(s, ch, term) {
    return { kind: "chapitre", title: `${s.title} — chapitre ${ch.num}`, term,
             url: `reader.html?manga=${encodeURIComponent(s.id)}&chapter=${encodeURIComponent(ch.num)}`,
             cover: s.cover, sub: `${ch.pages} pages · lire tout de suite` };
  }
  function palRow(it) {
    return `<div class="cmdk-item"><img src="${cover(it.cover, 120)}" alt="" loading="lazy"><div><div class="ci-t">${escAttr(it.title)}</div><div class="ci-m">${escAttr(it.sub)}</div></div><span class="ci-go">↵</span></div>`;
  }

  /* ---------- Reveals ---------- */
  function wireReveals() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: "0px 0px -8% 0px" });
    const scan = () => $$("[data-reveal]:not(.in)").forEach(n => io.observe(n));
    scan();
    window.LT && (window.LT._scanReveals = scan);
  }

  /* ---------- Loader ---------- */
  function hideLoader() {
    const l = $(".loader");
    if (!l) return;
    setTimeout(() => l.classList.add("done"), 350);
  }

  /* ---------- Helpers exposés ---------- */
  function toast(msg) {
    const host = $("#toast-host"); if (!host) return;
    const t = el(`<div class="toast">${msg}</div>`);
    host.append(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transform = "translateY(12px)"; setTimeout(() => t.remove(), 350); }, 2600);
  }
  function timeAgo(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr), now = new Date();
    const days = Math.floor((now - d) / 86400000);
    if (days <= 0) return "aujourd'hui";
    if (days === 1) return "hier";
    if (days < 30) return `il y a ${days} j`;
    const m = Math.floor(days / 30);
    if (m < 12) return `il y a ${m} mois`;
    return `il y a ${Math.floor(m / 12)} an${m >= 24 ? "s" : ""}`;
  }
  function stars(r) {
    const full = Math.round(r);
    return `<span class="stars" title="${r}/5">${"★".repeat(full)}${"☆".repeat(5 - full)}</span>`;
  }
  function seriesById(id) { return (window.SERIES || []).find(s => s.id === id); }

  /* ---------- Client Supabase partagé (ou null si non chargé / non configuré) ----
     Recréé tant qu'il n'existe pas : sur certaines pages core.js s'exécute avant
     le <script> supabase-js, donc on ne met PAS en cache l'échec. */
  let _sb = null;
  function sbClient() {
    if (_sb) return _sb;
    try {
      const C = window.LT_SUPABASE || {};
      if (window.supabase && C.url && C.anonKey && !/VOTRE_|YOUR_/i.test(C.url + C.anonKey))
        _sb = window.supabase.createClient(C.url, C.anonKey);
    } catch { _sb = null; }
    return _sb;
  }

  /* ---------- Chargement à la demande de supabase-js ----------
     La bibliothèque pèse 212 Ko — de loin le plus gros fichier du site après
     les planches. Sur la fiche série, le lecteur et la bibliothèque, elle ne
     sert QU'aux visiteurs connectés : synchroniser la progression, gagner de
     l'XP, poser une note. Un visiteur anonyme — c'est-à-dire l'immense
     majorité, et la totalité du trafic venu de Google — la téléchargeait pour
     rien.

     Le forum et le classement, eux, gardent leur <script> : chez eux la
     bibliothèque sert à AFFICHER le contenu, pas à l'enrichir.

     Savoir si quelqu'un est connecté ne demande pas la bibliothèque :
     supabase-js range sa session dans localStorage. On regarde donc la clé, et
     on ne charge les 212 Ko que si elle existe. */
  const SB_SRC = "js/vendor/supabase-js-2.112.3.min.js";
  let _sbLoad = null;
  function sbLoad() {
    if (window.supabase) return Promise.resolve(true);
    if (!_sbLoad) {
      _sbLoad = new Promise(done => {
        const s = document.createElement("script");
        s.src = SB_SRC;
        s.onload = () => done(true);
        // Un échec ne doit pas condamner la page : on repart sans, et on
        // autorise une nouvelle tentative plus tard.
        s.onerror = () => { _sbLoad = null; done(false); };
        document.head.appendChild(s);
      });
    }
    return _sbLoad;
  }
  function sbHasSession() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        if (/^sb-.+-auth-token$/.test(localStorage.key(i) || "")) return true;
      }
    } catch { /* stockage bloqué : on considère qu'il n'y a pas de session */ }
    return false;
  }

  window.LTsb = sbClient;
  window.LTsb.load = sbLoad;          // pour charger avant une action connectée
  window.LTsb.hasSession = sbHasSession;

  /* ---------- mini utils ---------- */
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function icon(name) {
    const I = {
      search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>`,
      menu:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
      discord:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.3 5.3A17 17 0 0 0 15 4l-.2.4a12 12 0 0 1 3.6 1.8c-3.6-1.9-8.2-1.9-11.8 0A12 12 0 0 1 10.2 4.4L10 4a17 17 0 0 0-4.3 1.3C2.9 9.4 2.1 13.4 2.5 17.4a17 17 0 0 0 5.2 2.6l.4-1.4c-.7-.3-1.4-.6-2-1l.5-.4c3.8 1.8 8 1.8 11.8 0l.5.4c-.6.4-1.3.7-2 1l.4 1.4a17 17 0 0 0 5.2-2.6c.5-4.7-.8-8.6-3.5-12.1ZM9 14.7c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Zm6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Z"/></svg>`,
      x:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.5 7.5L22 22h-6.8l-4.5-6-5.2 6H2.6l7-8L2 2h6.9l4 5.5L18.2 2Zm-1.2 18h1.6L7.1 3.7H5.4L17 20Z"/></svg>`,
      clock:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
      home:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/></svg>`,
      grid:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`,
      calendar:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>`,
      library:`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h11a2 2 0 0 1 2 2v14H8a2 2 0 0 1-2-2V4Z"/><path d="M6 18a2 2 0 0 0-2 2"/><path d="M6 4a2 2 0 0 0-2 2v12"/></svg>`,
      chat:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8 8 0 0 1-11.6 7.1L4 20l1.4-5.4A8 8 0 1 1 21 11.5Z"/></svg>`,
      users:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3.4 19a5.6 5.6 0 0 1 11.2 0"/><path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.4"/><path d="M17.8 13.4a5.6 5.6 0 0 1 2.8 4.9"/></svg>`,
      trophy: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>`,
      more:   `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>`,
      chevron:`<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>`,
      apps:   `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>`,
      close:  `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>`,
      sparkle:`<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2l1.9 5.1 5.1 1.9-5.1 1.9L12 16.2l-1.9-5.1L5 9.2l5.1-1.9z"/><path d="M18.5 14l.85 2.3 2.3.85-2.3.85L18.5 20.3l-.85-2.3-2.3-.85 2.3-.85z"/></svg>`,
      gauge:  `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 17.5a9 9 0 1 1 15 0"/><path d="M12 13a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 12 13Z"/><path d="m13.2 10.4 3-3"/></svg>`,
    };
    return I[name] || "";
  }

  /* ---------- Couvertures responsives ----------
     Les variantes WebP sont generees par tools/build-covers.py, qui ecrit le
     manifeste js/data/covers.js. Une couverture absente du manifeste retombe
     sur son fichier d'origine : ajouter une serie sans relancer l'outil
     n'affiche jamais d'image cassee, juste l'ancienne (grosse) version. */
  function coverInfo(src) { return (window.COVERS || {})[src] || null; }

  // URL de la plus petite variante au moins aussi large que `want`.
  function cover(src, want) {
    const c = coverInfo(src);
    if (!c) return src;
    return `${c.base}-${c.w.find(w => w >= want) || c.w[c.w.length - 1]}.webp`;
  }

  // Attributs src/srcset/sizes prets a coller dans un template d'<img>.
  // `sizes` decrit la largeur d'affichage CSS (ex: "(max-width:700px) 45vw, 230px").
  function coverAttrs(src, sizes) {
    const c = coverInfo(src);
    if (!c) return `src="${src}"`;
    const set = c.w.map(w => `${c.base}-${w}.webp ${w}w`).join(", ");
    // src = repli pour les (tres) vieux navigateurs qui ignorent srcset.
    return `src="${cover(src, 480)}" srcset="${set}" sizes="${sizes}"`;
  }

  // Meme chose sur une <img> deja dans le DOM (carrousels qui changent d'image).
  function applyCover(img, src, sizes) {
    if (!img) return;
    const c = coverInfo(src);
    if (!c) { img.removeAttribute("srcset"); img.src = src; return; }
    img.sizes = sizes;
    img.srcset = c.w.map(w => `${c.base}-${w}.webp ${w}w`).join(", ");
    img.src = cover(src, 480);
  }

  /* ---------- Vignette de partage (OpenGraph) ----------
     Carte 1200x630 generee par tools/build-og.py. Les reseaux sociaux
     affichent un rectangle paysage : leur donner la couverture, qui est
     portrait, revient a partager une bande recadree au milieu.
     Ce que voient reellement Discord, X ou Facebook vient de l'edge function
     (netlify/edge-functions/og.js), qui lit le meme chemin dans og-meta.json ;
     on le reproduit ici pour que la page soit coherente une fois le JS execute. */
  function ogCard(id) {
    const slug = String(id).normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").toLowerCase();
    return slug ? `images/og/series/${slug}.jpg` : "";
  }

  /* ---------- Effets de bord et pré-rendu ----------
     Pendant un prerender (voir wireSpeculation), la page est construite alors
     que le visiteur n'a encore rien ouvert : il a juste survolé un lien. Tout
     ce qui laisse une trace — marquer une série comme vue, compter une lecture,
     accorder de l'XP — doit donc attendre que la page soit réellement affichée,
     sinon on enregistre des visites qui n'ont jamais eu lieu.
     Hors pré-rendu (cas normal, et tous les navigateurs sans l'API), le travail
     est fait immédiatement : le comportement ne change pas. */
  function whenActive(fn) {
    if (!document.prerendering) return fn();
    document.addEventListener("prerenderingchange", () => fn(), { once: true });
  }

  /* ---------- Étiquettes internes ----------
     Certaines entrées de `genres` ne sont pas des genres : elles servent à
     nous, en interne. Elles n'ont donc rien à faire dans le bandeau de
     l'accueil, dans les recommandations, ni dans un résultat de recherche.
     « LanorTrad » en faisait partie et a été retirée des données ;
     « Collaboration » reste.
     Même liste côté build (scripts/build-seo.js, constante INTERNES) : les deux
     doivent rester d'accord. */
  const TAGS_INTERNES = new Set(["Collaboration"]);
  const isGenre = g => !TAGS_INTERNES.has(g);
  const publicGenres = s => (s.genres || []).filter(isGenre);

  const playable = s => !!(((window.CHAPTERS || {})[s.id] || []).length);
  window.LT = { $, $$, el, icon, go, toast, timeAgo, stars, seriesById, page, playable, cover, coverAttrs, applyCover, ogCard, whenActive, isGenre, publicGenres, norm, matches, openPalette: () => openPalette() };

  /* ---------- PWA + analytics ---------- */
  // « Local » = localhost / IP de boucle, OU IP privée de réseau (test depuis un
  // téléphone via http://192.168.x.x:port). En local on désactive le service
  // worker (sinon il sert un cache obsolète pendant le développement) et la
  // mesure d'audience — y compris si on clique « Accepter » pour tester le
  // bandeau.
  function isProd() {
    const host = location.hostname;
    const local = /^(localhost|127\.|0\.0\.0\.0|\[?::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || /\.local$/.test(host);
    return /^https?:/.test(location.protocol) && !local;
  }

  /* ---------- Préchargement spéculatif ----------
     Le navigateur peut aller chercher la page suivante pendant que le visiteur
     hésite encore sur le lien (`eagerness: moderate` = au survol). Au clic, la
     page est déjà là.

     Deux niveaux, et la différence compte :
       • prefetch  — récupère le document, SANS exécuter son JavaScript.
         Aucun effet de bord possible, donc c'est le réglage par défaut ici.
       • prerender — construit la page entière en arrière-plan, JS compris.
         Beaucoup plus impressionnant, mais tout ce que la page fait au
         chargement se produit pour de bon. On ne l'autorise que sur la fiche
         série, dont le seul effet (marquer la série comme vue) est justement
         mis en attente d'activation — voir whenActive().

     Le lecteur reste en prefetch : son ouverture compte une lecture (LTviews)
     et alimente l'XP. Prérendre une page qu'on n'ouvrira peut-être jamais
     fausserait les compteurs de toute la team. */
  function wireSpeculation() {
    // Chrome/Edge uniquement pour l'instant ; ailleurs, la balise est ignorée.
    if (!HTMLScriptElement.supports || !HTMLScriptElement.supports("speculationrules")) return;
    // Mode Fluidité : machine modeste ou connexion limitée. On ne va pas
    // dépenser sa bande passante et son CPU pour des pages non demandées.
    if (document.documentElement.getAttribute("data-perf") === "lite") return;
    if (navigator.connection && navigator.connection.saveData) return;

    const rules = {
      prerender: [{
        where: { href_matches: "/manga.html?*" },
        eagerness: "moderate"
      }],
      prefetch: [{
        where: {
          and: [
            { href_matches: "/*" },
            // Déjà couverte par la règle de prerender ci-dessus.
            { not: { href_matches: "/manga.html?*" } },
            // Page personnelle : rien à y gagner, et elle lit le stockage local.
            { not: { href_matches: "/bibliotheque.html*" } },
            { not: { selector_matches: "[rel~=nofollow]" } },
            { not: { selector_matches: "[target=_blank]" } }
          ]
        },
        eagerness: "moderate"
      }]
    };
    const el = document.createElement("script");
    el.type = "speculationrules";
    el.textContent = JSON.stringify(rules);
    document.head.appendChild(el);
  }

  function wireHead() {
    // Manifest + icône Apple (toujours)
    if (!document.querySelector('link[rel="manifest"]')) {
      const m = document.createElement("link"); m.rel = "manifest"; m.href = "manifest.json"; document.head.appendChild(m);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const a = document.createElement("link"); a.rel = "apple-touch-icon"; a.href = "images/icons/icon-180x180.png"; document.head.appendChild(a);
    }
    // Flux RSS des sorties (découvrable par les lecteurs de flux)
    if (!document.querySelector('link[rel="alternate"][type="application/rss+xml"]')) {
      const r = document.createElement("link");
      r.rel = "alternate"; r.type = "application/rss+xml";
      r.title = "LanorTrad — Nouveaux chapitres"; r.href = "feed.xml";
      document.head.appendChild(r);
    }

    // Données structurées du site (Organization + WebSite + recherche)
    if (!document.getElementById("ld-site") && /^https?:/.test(location.protocol)) {
      const site = location.origin + "/";
      const ld = { "@context": "https://schema.org", "@graph": [
        { "@type": "Organization", name: "LanorTrad", url: site,
          logo: location.origin + "/images/icons/icon-512x512.png", sameAs: [DISCORD, TWITTER] },
        { "@type": "WebSite", name: "LanorTrad", url: site, inLanguage: "fr",
          potentialAction: { "@type": "SearchAction",
            target: site + "catalogue.html?q={search_term_string}",
            "query-input": "required name=search_term_string" } }
      ] };
      const e = document.createElement("script");
      e.type = "application/ld+json"; e.id = "ld-site"; e.textContent = JSON.stringify(ld);
      document.head.appendChild(e);
    }
    if (!isProd()) {
      // Nettoyage : retire un éventuel service worker + caches résiduels d'une
      // visite précédente (sinon l'ancien CSS/JS reste servi depuis le cache).
      if ("serviceWorker" in navigator) navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
      if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
      return; // pas de SW / analytics / pub en local
    }

    // Service worker (PWA + hors-ligne)
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

    // Mesure d'audience : chargée seulement si le visiteur a dit oui.
    if (consentGet() === "yes") loadAnalytics();
    else if (!consentGet()) showConsentBar();
  }

  /* ---------- Consentement (mesure d'audience) ----------
     Google Analytics dépose des identifiants et transmet des données à un
     tiers : en France, ça demande un consentement libre, éclairé et aussi
     facile à refuser qu'à accepter. Tant que le visiteur n'a pas répondu,
     AUCUN script de mesure n'est chargé. Le choix est révocable à tout
     moment (lien « Cookies » en pied de page).
     Le reste du site (thème, progression de lecture, séries suivies) vit
     dans le stockage local du navigateur : ce sont des réglages strictement
     nécessaires au service demandé, ils ne partent nulle part. */
  const CONSENT_KEY = "lt-consent-v1";
  const GA_ID = "G-2MZGH30P4J";

  function consentGet() { try { return localStorage.getItem(CONSENT_KEY); } catch { return null; } }
  function consentSet(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch {}
    if (v === "yes") loadAnalytics();
    toast(v === "yes" ? "Merci ! Mesure d'audience activée." : "C'est noté : aucune mesure d'audience.");
  }

  let gaLoaded = false;
  function loadAnalytics() {
    if (gaLoaded || !isProd()) return;
    gaLoaded = true;
    const ga = document.createElement("script");
    ga.async = true; ga.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(ga);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date());
    gtag("config", GA_ID, { anonymize_ip: true });

    // Mesure des Core Web Vitals réels (js/vitals.js). Chargée ici et nulle
    // part ailleurs : elle voyage avec le consentement à la mesure d'audience,
    // et qui refuse ne télécharge même pas le fichier.
    const v = document.createElement("script");
    v.defer = true; v.src = "js/vitals.js";
    document.head.appendChild(v);
  }

  function showConsentBar() {
    if ($(".lt-consent")) return;
    const bar = el(`
      <div class="lt-consent" role="dialog" aria-label="Mesure d'audience" aria-live="polite">
        <div class="lt-consent-in">
          <p>On aimerait mesurer la fréquentation du site (Google Analytics) pour savoir
             ce qui vous plaît. C'est toi qui vois — le site marche pareil dans les deux cas.
             <a href="confidentialite.html">En savoir plus</a></p>
          <div class="lt-consent-btns">
            <button type="button" class="btn btn-ghost btn-sm" data-consent="no">Refuser</button>
            <button type="button" class="btn btn-primary btn-sm" data-consent="yes">Accepter</button>
          </div>
        </div>
      </div>`);
    bar.addEventListener("click", e => {
      const b = e.target.closest("[data-consent]");
      if (!b) return;
      consentSet(b.dataset.consent);
      bar.classList.add("gone");
      setTimeout(() => bar.remove(), 320);
    });
    document.body.appendChild(bar);
    requestAnimationFrame(() => bar.classList.add("in"));
  }

  // Rouvrir le choix depuis le pied de page.
  function reopenConsent() {
    try { localStorage.removeItem(CONSENT_KEY); } catch {}
    gaLoaded = false;
    showConsentBar();
  }
  window.LTconsent = { get: consentGet, set: consentSet, reopen: reopenConsent };

  /* ---------- Boot ---------- */
  function boot() {
    wireHead();
    wireSpeculation();
    buildShell();
    buildPalette();
    // Points d'entrée visibles vers la recherche (barre du héros, bouton global…)
    document.addEventListener("click", e => {
      if (e.target.closest("[data-open-search]")) { e.preventDefault(); openPalette(); }
      if (e.target.closest("[data-reopen-consent]")) { e.preventDefault(); reopenConsent(); }
    });
    wireFollows();
    updateFollowBadge();
    document.addEventListener("lt:store", updateFollowBadge);
    document.addEventListener("lt:perf", syncPerfIcon);   // la sonde FPS peut basculer en léger
    wirePageTransitions();
    wireReveals();
    hideLoader();
    // raccourci clavier ⌘K / Ctrl+K + Échap
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal && pal.classList.contains("open") ? closePalette() : openPalette(); }
      else if (e.key === "Escape" && pal && pal.classList.contains("open")) closePalette();
      else if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
    });
    window.__ltReady = true;
    document.dispatchEvent(new Event("lt:ready"));
  }
  /* Les scripts du site sont chargés en `defer` : quand celui-ci s'exécute, le
     document est déjà parsé et readyState vaut "interactive" — pas "loading".
     Tester "loading" faisait donc démarrer le site TOUT DE SUITE, et lt:ready
     partait avant que home.js, manga.js & co aient eu la moindre chance de s'y
     abonner : l'accueil restait vide.
     "complete" est le seul état qui garantit que DOMContentLoaded est déjà
     passé ; dans tous les autres cas on l'attend, ce qui laisse les scripts
     différés finir de s'enregistrer. */
  /* Un visiteur CONNECTÉ a besoin de supabase-js dès le départ : sync.js,
     xp.js et ratings.js appellent LTsb() dès `lt:ready` et se contentent
     silencieusement d'un null. Sans cette attente, sa progression ne se
     synchroniserait plus et son XP ne monterait plus — sans le moindre message.
     On retarde donc le démarrage, mais pour lui seul.
     Le Promise.race est un filet : si le fichier ne répond pas, le site part
     quand même au bout de 2,5 s, exactement comme pour un visiteur anonyme. */
  function start() {
    if (!sbHasSession() || window.supabase) return boot();
    Promise.race([sbLoad(), new Promise(r => setTimeout(r, 2500))]).then(boot, boot);
  }
  if (document.readyState === "complete") start();
  else document.addEventListener("DOMContentLoaded", start);
})();
