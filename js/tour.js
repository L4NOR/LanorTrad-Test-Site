/* =========================================================================
   LanorTrad — Visites guidées (onboarding « façon jeu vidéo »)
   Un moteur générique (projecteur + carte) partagé par plusieurs visites :
     • Accueil (index.html)  → clé "lt-tour-v1"      → tour du site
     • Forum   (forum.html)  → clé "lt-tour-forum-v1"→ tour du forum
   - Se lance UNE fois au 1er passage sur la page (flag localStorage).
   - Rejouable : ?tour=1, lien en pied de page, ou LTtour.start().
   - 100 % responsive : positions calculées via getBoundingClientRect() ;
     une cible absente bascule proprement en étape centrée (texte seul).
   ========================================================================= */
(function () {
  "use strict";

  const $     = (s, r = document) => r.querySelector(s);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PAGE = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const IS_HOME = PAGE === "" || PAGE === "index.html";
  const IS_FORUM = PAGE === "forum.html";

  // Attend qu'un sélecteur apparaisse (contenu chargé en asynchrone), avec délai max.
  function waitFor(sel, timeout = 2500) {
    return new Promise(res => {
      const t0 = Date.now();
      (function poll() {
        if (document.querySelector(sel) || Date.now() - t0 > timeout) return res();
        requestAnimationFrame(poll);
      })();
    });
  }

  /* ==================== Aides menu radial (visite d'accueil) ==================== */
  function menuIsOpen() { return document.body.classList.contains("rn-open"); }
  function setMenu(open) {
    const toggle = $("#rn-toggle");
    if (!toggle) return;
    if (open && !menuIsOpen()) toggle.click();
    else if (!open && menuIsOpen()) toggle.click();
  }
  function ensureMenu(open) {                       // renvoie le délai d'attente conseillé
    const was = menuIsOpen();
    setMenu(open);
    return (open && !was && !reduce) ? 460 : 60;    // laisser l'arc se déployer
  }
  function unionRect(els) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top);
      x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
    });
    if (x1 === Infinity) return null;
    return { top: y1, left: x1, width: x2 - x1, height: y2 - y1 };
  }
  function navArcRect() {
    const items = [...document.querySelectorAll("#radial-nav .rn-item")];
    const toggle = $("#rn-toggle");
    return unionRect(toggle ? items.concat(toggle) : items);
  }

  /* ==================== Légende des badges (visite du forum) ==================== */
  function badgeLegend() {
    const roles = `<span class="fo-role admin">Admin</span> <span class="fo-role mod">Modo</span>`;
    let ranks = "";
    if (window.LTxp && LTxp.rankBadgeForLevel)
      ranks = [1, 10, 50].map(l => LTxp.rankBadgeForLevel(l)).join(" ");
    else
      ranks = `<span class="lt-rank r-etincelle">Étincelle<b>1</b></span>`;
    return `
      <div class="lt-tour-legend">
        <div class="lt-tour-leg"><span class="lt-tour-chips">${roles}</span>
          <span>L'<strong>équipe</strong> et les <strong>modérateurs</strong> (ils peuvent épingler / verrouiller).</span></div>
        <div class="lt-tour-leg"><span class="lt-tour-chips">${ranks}</span>
          <span>Votre <strong>rang « Aura »</strong> : il grimpe avec l'<strong>XP</strong> gagné en lisant, en postant et en réagissant.</span></div>
      </div>`;
  }

  /* ============================= Moteur générique ============================= */
  let overlay, hole, card, elEye, elTitle, elBody, dotsWrap, btnPrev, btnNext, btnSkip;
  let steps = [], i = 0, key = "", cfg = null, active = false, seq = 0, showT, rt;

  function build() {
    overlay = document.createElement("div");
    overlay.className = "lt-tour";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Visite guidée");
    overlay.innerHTML = `
      <div class="lt-tour-hole" aria-hidden="true"></div>
      <div class="lt-tour-card" role="document">
        <div class="lt-tour-eyebrow"></div>
        <h3 class="lt-tour-title"></h3>
        <div class="lt-tour-body"></div>
        <div class="lt-tour-dots"></div>
        <div class="lt-tour-foot">
          <button type="button" class="lt-tour-skip">Passer</button>
          <div class="lt-tour-actions">
            <button type="button" class="lt-tour-btn ghost lt-tour-prev">Précédent</button>
            <button type="button" class="lt-tour-btn primary lt-tour-next">Suivant</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    hole     = $(".lt-tour-hole", overlay);
    card     = $(".lt-tour-card", overlay);
    elEye    = $(".lt-tour-eyebrow", overlay);
    elTitle  = $(".lt-tour-title", overlay);
    elBody   = $(".lt-tour-body", overlay);
    dotsWrap = $(".lt-tour-dots", overlay);
    btnPrev  = $(".lt-tour-prev", overlay);
    btnNext  = $(".lt-tour-next", overlay);
    btnSkip  = $(".lt-tour-skip", overlay);

    btnPrev.addEventListener("click", () => go(i - 1));
    btnNext.addEventListener("click", () => (i >= steps.length - 1 ? finish() : go(i + 1)));
    btnSkip.addEventListener("click", finish);
    addEventListener("resize", onResize, { passive: true });
    document.addEventListener("keydown", onKey, true);
  }

  function onResize() {
    if (!active) return;
    clearTimeout(rt);
    rt = setTimeout(() => position(steps[i]), 120);
  }
  function onKey(e) {
    if (!active) return;
    if (e.key === "Escape") { e.preventDefault(); finish(); }
    else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); i >= steps.length - 1 ? finish() : go(i + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); go(i - 1); }
  }

  function targetRect(step) {
    let el = null;
    if (typeof step.rect === "function") { const r = step.rect(); if (r) return r; }
    let t = step.target;
    if (typeof t === "function") el = t();
    else if (typeof t === "string") el = $(t);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    if (r.bottom < 0 || r.top > innerHeight) return null;   // hors écran → centré
    return { top: r.top, left: r.left, width: r.width, height: r.height };
  }

  function position(step) {
    const r = targetRect(step);
    if (!r) { overlay.classList.add("dim-all"); return; }   // pas de cible → étape centrée
    overlay.classList.remove("dim-all");
    const pad = step.round ? 10 : 12;
    hole.style.top = (r.top - pad) + "px";
    hole.style.left = (r.left - pad) + "px";
    hole.style.width = (r.width + pad * 2) + "px";
    hole.style.height = (r.height + pad * 2) + "px";
    hole.style.borderRadius = step.round ? "50%" : ((step.radius || 16) + "px");
    placeCard({ top: r.top - pad, left: r.left - pad, right: r.left + r.width + pad,
                bottom: r.top + r.height + pad, width: r.width + pad * 2, height: r.height + pad * 2 });
  }

  function placeCard(box) {
    const vw = innerWidth, vh = innerHeight, gap = 16, m = 12;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const below = vh - box.bottom, above = box.top, right = vw - box.right, left = box.left;
    const cx = () => clamp(box.left + box.width / 2 - cw / 2, m, vw - cw - m);
    const cy = () => clamp(box.top + box.height / 2 - ch / 2, m, vh - ch - m);
    let top, lft;
    if (below >= ch + gap + m)      { top = box.bottom + gap;    lft = cx(); }
    else if (above >= ch + gap + m) { top = box.top - gap - ch;  lft = cx(); }
    else if (right >= cw + gap + m) { lft = box.right + gap;     top = cy(); }
    else if (left >= cw + gap + m)  { lft = box.left - gap - cw; top = cy(); }
    else {
      top = below >= above ? clamp(box.bottom + gap, m, vh - ch - m) : clamp(box.top - gap - ch, m, vh - ch - m);
      lft = clamp(cx(), m, vw - cw - m);
    }
    card.style.top = top + "px";
    card.style.left = lft + "px";
  }

  async function go(n) {
    i = clamp(n, 0, steps.length - 1);
    const step = steps[i], my = ++seq;

    // Contenu
    elEye.textContent = step.eyebrow || "Visite guidée";
    elTitle.textContent = step.title;
    elBody.innerHTML = typeof step.body === "function" ? step.body() : step.body;
    [...dotsWrap.children].forEach((d, k) => {
      d.classList.toggle("active", k === i);
      d.classList.toggle("done", k < i);
    });
    btnPrev.hidden = i === 0;
    btnNext.textContent = i >= steps.length - 1 ? "Terminer" : "Suivant";

    // Préparation de l'étape (ouvrir un menu, attendre un rendu asynchrone…)
    card.classList.remove("show");
    let delay = 40;
    if (typeof step.menu === "boolean") delay = ensureMenu(step.menu);
    if (step.before) { const d = await step.before(); if (typeof d === "number") delay = Math.max(delay, d); }

    clearTimeout(showT);
    await sleep(delay);
    if (my !== seq || !active) return;               // étape dépassée entre-temps
    position(step);
    card.classList.add("show");
    try { btnNext.focus({ preventScroll: true }); } catch { btnNext.focus(); }
  }

  function run(config) {
    if (!config || active) return;
    cfg = config; steps = config.steps; key = config.key;
    if (!overlay) build();
    dotsWrap.innerHTML = steps.map(() => "<i></i>").join("");
    active = true;
    document.body.classList.add("lt-tour-active");
    overlay.classList.add("on");
    go(0);
  }

  function finish() {
    if (!active) return;
    active = false; seq++;
    try { localStorage.setItem(key, "1"); } catch {}
    overlay.classList.remove("on");
    document.body.classList.remove("lt-tour-active");
    if (cfg && cfg.cleanup) cfg.cleanup();
    if (cfg && cfg.doneToast && window.LT && LT.toast) LT.toast(cfg.doneToast);
  }

  /* ============================= Étapes : ACCUEIL ============================= */
  const HOME = {
    key: "lt-tour-v1",
    doneToast: "Visite terminée — bonne lecture ✨",
    cleanup: () => setMenu(false),
    steps: [
      { menu: false, eyebrow: "Bienvenue 👋", title: "Bienvenue sur LanorTrad",
        body: "On te fait le tour du site en 30 secondes : lire, naviguer, chercher et suivre tes séries." },
      { target: ".hero-actions", menu: false, radius: 16, eyebrow: "Lecture", title: "Commence à lire",
        body: "Le bouton violet <strong>lance le dernier chapitre</strong> de la série à la une. Juste à côté, <strong>« Explorer le catalogue »</strong> ouvre toute la bibliothèque." },
      { rect: navArcRect, menu: true, radius: 34, eyebrow: "Navigation", title: "Ta boussole",
        body: "Ce bouton, <strong>toujours en bas de l'écran</strong>, ouvre le menu. Toutes les pages sont là : Catalogue, Planning, Bibliothèque, Forum, Classement, Équipe." },
      { target: '.rn-item[data-action="search"]', menu: true, round: true, eyebrow: "Recherche", title: "Trouve une série en un éclair",
        body: "Cherche par <strong>titre</strong> ou par <strong>genre</strong>. Astuce clavier : appuie sur <strong>/</strong> n'importe où pour ouvrir la recherche." },
      { target: '.rn-item[href="bibliotheque.html"]', menu: true, round: true, eyebrow: "Ton espace", title: "Bibliothèque & suivis",
        body: "Reprends ta lecture là où tu l'avais laissée, et <strong>suis tes séries</strong> (🔔) pour repérer les nouveaux chapitres d'un coup d'œil." },
      { target: '.rn-item[href="forum.html"]', menu: true, round: true, eyebrow: "Communauté", title: "Forum, XP & classement",
        body: "Crée un compte gratuit pour <strong>discuter sur le forum</strong>, gagner de l'<strong>XP</strong> en lisant et grimper au <strong>classement</strong>." },
      { target: '.rn-item[data-action="theme"]', menu: true, round: true, eyebrow: "Confort", title: "Choisis ton ambiance",
        body: "Bascule le thème d'un tap : <strong>Sombre</strong>, <strong>OLED</strong> (noir pur, idéal la nuit) ou <strong>Clair</strong>." },
      { target: '.rn-item[data-action="perf"]', menu: true, round: true, eyebrow: "Fluidité", title: "Ça rame ? Passe en mode léger",
        body: "Le bouton <strong>Fluidité</strong> allège les animations pour rester fluide sur les téléphones et PC modestes. En mode « Automatique », le site s'adapte tout seul." },
      { menu: false, eyebrow: "C'est parti 🎉", title: "Tu es prêt !",
        body: "Bonne lecture ✨ Tu peux <strong>revoir cette visite</strong> à tout moment via le lien « 🧭 Revoir la visite guidée » en bas de page." },
    ],
  };

  /* ============================== Étapes : FORUM ============================== */
  const FORUM = {
    key: "lt-tour-forum-v1",
    doneToast: "Bon forum ✨",
    steps: [
      { eyebrow: "Bienvenue 💬", title: "Le forum LanorTrad",
        body: "L'endroit pour <strong>discuter des chapitres</strong>, proposer des séries et échanger avec l'équipe. Voici comment ça marche (~30 s).",
        before: () => waitFor("#forum-bar [data-auth], #forum-bar .fo-user, .fo-setup", 3000) },
      { target: '#forum-bar [data-auth="signup"]', radius: 22, eyebrow: "1re étape", title: "Crée ton compte",
        body: "Clique sur <strong>« Créer un compte »</strong> : choisis un <strong>pseudo</strong>, un <strong>email</strong> et un mot de passe. Tu reçois un email de confirmation, puis tu te connectes via <strong>« Connexion »</strong>. C'est gratuit et indispensable pour publier, réagir et gagner de l'XP." },
      { target: "#forum-app .fo-cat", radius: 18, eyebrow: "S'y retrouver", title: "Les catégories",
        body: "Chaque <strong>catégorie</strong> regroupe un thème (annonces, discussions, propositions de séries…). Clique sur l'une d'elles pour voir ses <strong>sujets</strong>, puis sur un sujet pour lire la discussion." },
      { eyebrow: "Participer", title: "Lancer un sujet, répondre",
        body: "Une fois connecté, <strong>« + Nouveau sujet »</strong> lance une discussion. Dans un sujet, écris ton message puis <strong>« Répondre »</strong>. Tu peux <strong>mentionner</strong> quelqu'un avec <strong>@pseudo</strong> et <strong>réagir</strong> aux messages avec des emojis 👍." },
      { eyebrow: "À quoi ça sert ?", title: "Comprendre les badges",
        body: () => "<p>Les petits badges à côté d'un pseudo indiquent <strong>qui parle</strong> :</p>" + badgeLegend() +
                    "<p>Plus tu es actif, plus ton rang monte. Il est aussi visible au <strong>classement</strong>.</p>" },
      { target: "#fo-bell", round: true, eyebrow: "Rester au courant", title: "Notifications & profil",
        body: "La <strong>cloche 🔔</strong> te prévient des réponses à tes sujets et des <strong>@mentions</strong>. À côté de ton pseudo, l'<strong>engrenage ⚙️</strong> ouvre ton profil (avatar, âge, genres préférés…). Ces infos apparaissent quand on clique sur ton nom.",
        before: () => waitFor("#fo-bell", 1200) },
      { eyebrow: "À toi de jouer 🎉", title: "Bienvenue dans la communauté",
        body: "Une règle d'or : <strong>respect</strong> et <strong>pas de spoilers</strong> sans prévenir. Tu peux revoir ce tuto via le lien « 🧭 Revoir le tuto du forum » en bas de page. Bon forum !" },
    ],
  };

  /* ============================= Déclenchement ============================= */
  function pageConfig() { return IS_FORUM ? FORUM : (IS_HOME ? HOME : null); }

  function init() {
    const config = pageConfig();
    if (!config) return;                       // page sans visite définie
    const forced = new URLSearchParams(location.search).get("tour") === "1";
    if (forced) { try { history.replaceState(null, "", location.pathname + location.hash); } catch {} }
    let done = false;
    try { done = localStorage.getItem(config.key) === "1"; } catch {}
    if (forced || !done) {
      // Laisse le loader disparaître (et le forum charger ses données)
      const delay = forced ? 250 : (IS_FORUM ? 1300 : 1100);
      setTimeout(() => run(config), delay);
    }
  }

  window.LTtour = {
    start() { run(pageConfig()); },
    finish,
    reset() { ["lt-tour-v1", "lt-tour-forum-v1"].forEach(k => { try { localStorage.removeItem(k); } catch {} }); },
  };

  if (window.__ltReady) init();
  else document.addEventListener("lt:ready", init, { once: true });
})();
