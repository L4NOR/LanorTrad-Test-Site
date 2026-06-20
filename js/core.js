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

  /* ---------- Shell : fond + navbar + drawer + footer ---------- */
  const minimal = document.body.dataset.shell === "minimal";

  function buildShell() {
    // Veil + toast host (toujours présents)
    document.body.append(el(`<div class="page-veil" id="veil"></div>`));
    document.body.append(el(`<div class="toast-host" id="toast-host"></div>`));

    if (minimal) { syncThemeIcon(); return; } // lecteur : pas de nav/footer/fond

    // Fond animé
    const fx = el(`<div class="bg-fx" aria-hidden="true"><span class="bg-blob b1"></span><span class="bg-blob b2"></span><span class="bg-blob b3"></span></div>`);
    const grain = el(`<div class="bg-grain" aria-hidden="true"></div>`);
    document.body.prepend(grain);
    document.body.prepend(fx);

    // Navbar
    const links = NAV.map(n =>
      `<a href="${n.href}" class="${n.href === page ? "active" : ""}">${n.label}</a>`).join("");
    const nav = el(`
      <nav class="nav" id="nav">
        <div class="wrap">
          <a href="index.html" class="brand"><span class="mark">L</span><span>Lanor<span class="grad-text">Trad</span></span></a>
          <div class="nav-links">${links}</div>
          <div class="nav-right">
            <div class="search-box">
              <span class="ico">${icon("search")}</span>
              <input type="search" id="nav-search" placeholder="Rechercher…" autocomplete="off" aria-label="Rechercher un manga">
            </div>
            <button class="icon-btn" id="theme-btn" title="Changer de thème" aria-label="Changer de thème"><span class="theme-ico">☀</span></button>
            <a href="premium.html" class="btn btn-premium btn-sm hide-mobile" id="premium-btn">✦ Premium</a>
            <a href="${DISCORD}" target="_blank" rel="noopener" class="icon-btn hide-mobile" title="Discord" aria-label="Discord">${icon("discord")}</a>
            <button class="icon-btn burger" id="burger" aria-label="Menu">${icon("menu")}</button>
          </div>
        </div>
      </nav>`);
    document.body.prepend(nav);

    // Drawer mobile
    const drawerLinks = NAV.map(n =>
      `<a href="${n.href}" class="d-link">${n.label}</a>`).join("");
    const overlay = el(`<div class="drawer-overlay" id="drawer-overlay"></div>`);
    const drawer = el(`
      <aside class="drawer" id="drawer">
        <div class="drawer-head">
          <span class="brand"><span class="mark">L</span>Lanor<span class="grad-text">Trad</span></span>
          <button class="d-close" id="drawer-close" aria-label="Fermer">&times;</button>
        </div>
        <div class="search-box" style="display:block;margin-bottom:18px">
          <span class="ico">${icon("search")}</span>
          <input type="search" id="drawer-search" placeholder="Rechercher…" style="width:100%">
        </div>
        ${drawerLinks}
        <a href="premium.html" class="btn btn-premium" style="margin-top:auto;justify-content:center">✦ Passer Premium</a>
        <a href="${DISCORD}" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:12px;justify-content:center">Rejoindre le Discord</a>
      </aside>`);
    document.body.append(overlay, drawer);

    // Footer
    const yr = new Date().getFullYear();
    const footer = el(`
      <footer class="footer">
        <div class="wrap grid">
          <div>
            <a href="index.html" class="brand" style="font-size:1.5rem"><span class="mark">L</span>Lanor<span class="grad-text">Trad</span></a>
            <p style="margin-top:14px">Une équipe passionnée qui traduit vos mangas préférés avec précision et créativité. Lecture gratuite, en français, partout.</p>
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
              <li>5 séries traduites</li>
              <li>500+ chapitres</li>
              <li>5 oneshots</li>
              <li><a href="${DISCORD}" target="_blank" rel="noopener">Signaler un problème</a></li>
            </ul>
          </div>
        </div>
        <div class="copy">© 2024–${yr} LanorTrad — Fait avec passion. Tous droits réservés.</div>
      </footer>`);
    document.body.append(footer);

    wireShell();
    syncThemeIcon();
  }

  function wireShell() {
    const nav = $("#nav");
    if (!nav) return;
    $("#theme-btn").addEventListener("click", cycleTheme);

    // Burger / drawer
    const drawer = $("#drawer"), overlay = $("#drawer-overlay");
    const open = () => { drawer.classList.add("open"); overlay.classList.add("open"); document.body.style.overflow = "hidden"; };
    const close = () => { drawer.classList.remove("open"); overlay.classList.remove("open"); document.body.style.overflow = ""; };
    $("#burger").addEventListener("click", open);
    $("#drawer-close").addEventListener("click", close);
    overlay.addEventListener("click", close);
    document.addEventListener("keydown", e => { if (e.key === "Escape") close(); });

    // Scroll : classe scrolled + masquage descendant
    let last = 0;
    addEventListener("scroll", () => {
      const y = scrollY;
      nav.classList.toggle("scrolled", y > 24);
      if (y > last && y > 260) nav.classList.add("hidden-up");
      else nav.classList.remove("hidden-up");
      last = y;
    }, { passive: true });

    // Recherche → ouvre la palette ⌘K
    [$("#nav-search"), $("#drawer-search")].forEach(inp => {
      if (!inp) return;
      inp.setAttribute("readonly", "");
      inp.addEventListener("focus", () => { inp.blur(); openPalette(); });
      inp.addEventListener("click", openPalette);
    });
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
      if (e.target.closest(".fav-btn")) return;
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

  /* ---------- Favoris (délégué) ---------- */
  function wireFavorites() {
    document.addEventListener("click", e => {
      const btn = e.target.closest(".fav-btn");
      if (!btn) return;
      e.preventDefault(); e.stopImmediatePropagation();
      const added = window.LTstore.toggleFav(btn.dataset.fav);
      $$(`.fav-btn[data-fav="${cssAttr(btn.dataset.fav)}"]`).forEach(b => b.classList.toggle("on", added));
      btn.classList.remove("pop"); void btn.offsetWidth; btn.classList.add("pop");
      toast(added ? "♥ Ajouté aux favoris" : "Retiré des favoris");
    }, true);
  }
  function cssAttr(v) { return (window.CSS && CSS.escape) ? CSS.escape(v) : v.replace(/"/g, '\\"'); }

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
  function choosePal(it) { window.LTstore.addRecent(it.title); closePalette(); location.href = it.url; }
  function renderPalette() {
    const term = (palInput.value || "").trim().toLowerCase();
    const S = window.SERIES || [];
    palItems = !term ? [] : S.filter(s =>
      s.title.toLowerCase().includes(term) || s.genres.join(" ").toLowerCase().includes(term) || (s.author || "").toLowerCase().includes(term)
    ).slice(0, 8);
    palActive = -1;
    if (!term) {
      const rec = window.LTstore.recents();
      const trend = [...S].sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 5);
      palList.innerHTML =
        (rec.length ? `<div class="cmdk-sec">Récent</div><div style="padding:4px 8px">${rec.map(r => `<span class="cmdk-recent" data-term="${r}">${icon("clock")} ${r}</span>`).join("")}</div>` : "") +
        `<div class="cmdk-sec">Tendances</div>` + trend.map(palRow).join("");
      palItems = trend;
      $$(".cmdk-recent", palList).forEach(c => c.addEventListener("click", () => { palInput.value = c.dataset.term; renderPalette(); palInput.focus(); }));
    } else if (!palItems.length) {
      palList.innerHTML = `<div class="cmdk-empty">Aucun résultat pour « ${palInput.value} »</div>`;
    } else {
      palList.innerHTML = `<div class="cmdk-sec">Séries</div>` + palItems.map(palRow).join("");
    }
    $$(".cmdk-item", palList).forEach((r, k) => {
      r.addEventListener("click", () => choosePal(palItems[k]));
      r.addEventListener("mousemove", () => setPalActive(k));
    });
  }
  function palRow(s) {
    return `<div class="cmdk-item"><img src="${s.cover}" alt=""><div><div class="ci-t">${s.title}</div><div class="ci-m">${s.status} · ${s.genres.slice(0,2).join(", ")}</div></div><span class="ci-go">↵</span></div>`;
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

  /* ---------- Premium (statut local : badge + sans pub + thème) ---------- */
  function premiumActive() { try { return localStorage.getItem("lt-premium") === "1"; } catch { return false; } }
  function applyPremium() {
    const on = premiumActive();
    document.documentElement.classList.toggle("premium", on);
    const btn = $("#premium-btn");
    if (btn) { btn.innerHTML = on ? "✦ Membre" : "✦ Premium"; btn.classList.toggle("is-on", on); }
  }
  window.LTpremium = {
    isActive: premiumActive,
    set(v) { try { localStorage.setItem("lt-premium", v ? "1" : "0"); } catch {} applyPremium(); document.dispatchEvent(new Event("lt:premium")); }
  };

  /* ---------- mini utils ---------- */
  function el(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstChild; }
  function icon(name) {
    const I = {
      search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>`,
      menu:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
      discord:`<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.3 5.3A17 17 0 0 0 15 4l-.2.4a12 12 0 0 1 3.6 1.8c-3.6-1.9-8.2-1.9-11.8 0A12 12 0 0 1 10.2 4.4L10 4a17 17 0 0 0-4.3 1.3C2.9 9.4 2.1 13.4 2.5 17.4a17 17 0 0 0 5.2 2.6l.4-1.4c-.7-.3-1.4-.6-2-1l.5-.4c3.8 1.8 8 1.8 11.8 0l.5.4c-.6.4-1.3.7-2 1l.4 1.4a17 17 0 0 0 5.2-2.6c.5-4.7-.8-8.6-3.5-12.1ZM9 14.7c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Zm6 0c-.8 0-1.5-.8-1.5-1.7s.7-1.7 1.5-1.7 1.5.8 1.5 1.7-.7 1.7-1.5 1.7Z"/></svg>`,
      x:      `<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.2 2H21l-6.5 7.5L22 22h-6.8l-4.5-6-5.2 6H2.6l7-8L2 2h6.9l4 5.5L18.2 2Zm-1.2 18h1.6L7.1 3.7H5.4L17 20Z"/></svg>`,
      clock:  `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    };
    return I[name] || "";
  }

  const playable = s => !!(((window.CHAPTERS || {})[s.id] || []).length);
  window.LT = { $, $$, el, icon, go, toast, timeAgo, stars, seriesById, page, playable, openPalette: () => openPalette() };

  /* ---------- PWA + analytics ---------- */
  function wireHead() {
    // Manifest + icône Apple (toujours)
    if (!document.querySelector('link[rel="manifest"]')) {
      const m = document.createElement("link"); m.rel = "manifest"; m.href = "manifest.json"; document.head.appendChild(m);
    }
    if (!document.querySelector('link[rel="apple-touch-icon"]')) {
      const a = document.createElement("link"); a.rel = "apple-touch-icon"; a.href = "images/icons/icon-180x180.png"; document.head.appendChild(a);
    }
    const isProd = /^https?:/.test(location.protocol) && !/^(localhost|127\.|0\.0\.0\.0|\[?::1)/.test(location.hostname);
    if (!isProd) return; // pas de SW / analytics / pub en local

    // Service worker (PWA + hors-ligne)
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

    // Google Analytics
    const ga = document.createElement("script"); ga.async = true; ga.src = "https://www.googletagmanager.com/gtag/js?id=G-2MZGH30P4J"; document.head.appendChild(ga);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag("js", new Date()); gtag("config", "G-2MZGH30P4J");

    // AdSense
    const ad = document.createElement("script"); ad.async = true; ad.crossOrigin = "anonymous";
    ad.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5673170839903363";
    document.head.appendChild(ad);
  }

  /* ---------- Boot ---------- */
  function boot() {
    wireHead();
    buildShell();
    applyPremium();
    buildPalette();
    wireFavorites();
    wirePageTransitions();
    wireReveals();
    hideLoader();
    // raccourci clavier ⌘K / Ctrl+K + Échap
    document.addEventListener("keydown", e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal && pal.classList.contains("open") ? closePalette() : openPalette(); }
      else if (e.key === "Escape" && pal && pal.classList.contains("open")) closePalette();
      else if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
    });
    document.dispatchEvent(new Event("lt:ready"));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
