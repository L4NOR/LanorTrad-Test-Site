/* =========================================================================
   LanorTrad — Aperçu de la première page (« peek »)

   Un seul module pour toutes les surfaces : liste des chapitres d'une fiche,
   planning hebdo, dernières sorties, prochaines sorties de l'accueil.

   Principe : on n'affiche JAMAIS la vraie page (jusqu'à 5 Mo) mais la vignette
   générée par tools/build-previews.py (~35 Ko), et seulement à la demande.
     • survol de l'œil (souris)  → bulle d'aperçu à côté du bouton
     • clic / tap                → fenêtre plus grande + bouton de lecture

   Utilisation depuis un rendu :
     html += LTpreview.btn({ src, title, sub, href, cta, accent });
   ========================================================================= */
(function () {
  "use strict";

  const CAN_HOVER = matchMedia("(hover:hover) and (pointer:fine)").matches;
  const DELAY = 140;              // anti-déclenchement quand on balaye la liste
  let pop = null, popFor = null, timer = 0, modal = null, lastFocus = null, restoring = false;

  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  const eyeSvg = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;

  /* ---------- Bouton déclencheur (à insérer dans un rendu HTML) ---------- */
  function btn(d) {
    if (!d || !d.src) return "";
    const label = d.label || `Aperçu de la première page — ${d.title || ""}`;
    return `<button type="button" class="peek-btn${d.cls ? " " + d.cls : ""}"
      aria-label="${esc(label)}" title="Aperçu de la première page"
      data-peek="${esc(d.src)}"
      data-peek-title="${esc(d.title || "")}"
      data-peek-sub="${esc(d.sub || "")}"
      ${d.href ? `data-peek-href="${esc(d.href)}"` : ""}
      ${d.cta ? `data-peek-cta="${esc(d.cta)}"` : ""}
      ${d.accent ? `data-peek-accent="${esc(d.accent)}"` : ""}>${eyeSvg}</button>`;
  }

  /* Aperçu d'une série pour le planning : on montre le chapitre visé s'il est
     DÉJÀ paru, sinon le dernier paru (un chapitre annoncé n'a pas de pages —
     on ne fait pas semblant, le libellé le dit). */
  function forSeries(s, wanted) {
    if (!s) return null;
    const list = (window.CHAPTERS || {})[s.id] || [];
    if (!list.length) return null;
    const want = wanted != null ? String(wanted).split(/[^\d.]+/).filter(Boolean)[0] : "";
    const hit = want ? list.find(c => c.num === want) : null;
    const c = hit || list[0];
    if (!c.thumb) return null;
    const oneshot = s.type === "oneshot";
    return {
      src: c.thumb, accent: s.accent, title: s.title,
      sub: oneshot ? `${c.pages} pages`
        : (hit ? `Chapitre ${c.num} · ${c.pages} pages` : `Dernier paru : chapitre ${c.num}`),
      href: `reader.html?manga=${encodeURIComponent(s.id)}&chapter=${c.num}`,
      cta: oneshot ? "Lire le oneshot" : `Lire le chapitre ${c.num}`,
      label: oneshot ? `Aperçu de la première page — ${s.title}`
        : `Aperçu de la première page — ${s.title}, chapitre ${c.num}`
    };
  }

  /* Raccourci pour les rendus du planning : bouton prêt à coller, ou "" */
  function btnFor(s, wanted, cls) {
    const d = forSeries(s, wanted);
    return d ? btn(Object.assign(d, { cls: cls || "peek-over" })) : "";
  }

  function read(el) {
    return {
      src: el.dataset.peek,
      title: el.dataset.peekTitle || "",
      sub: el.dataset.peekSub || "",
      href: el.dataset.peekHref || "",
      cta: el.dataset.peekCta || "Lire ce chapitre",
      accent: el.dataset.peekAccent || ""
    };
  }

  /* Image + squelette de chargement, partagés bulle et fenêtre */
  function shot(d, alt) {
    return `<div class="peek-shot skeleton"><img src="${esc(encodeURI(d.src))}" alt="${esc(alt)}" decoding="async"></div>`;
  }
  function wireShot(root) {
    const box = root.querySelector(".peek-shot"), img = box && box.querySelector("img");
    if (!img) return;
    const done = () => { box.classList.remove("skeleton"); img.classList.add("in"); };
    const fail = () => { box.classList.remove("skeleton"); box.classList.add("err"); box.innerHTML = `<span class="peek-err">Aperçu indisponible</span>`; };
    if (img.complete && img.naturalWidth) done();
    else { img.addEventListener("load", done, { once: true }); img.addEventListener("error", fail, { once: true }); }
  }

  /* ------------------------------ bulle ------------------------------ */
  function showPop(el) {
    const d = read(el);
    if (!d.src) return;
    if (popFor === el && pop) return;
    hidePop();
    popFor = el;
    pop = document.createElement("div");
    pop.className = "peek-pop";
    if (d.accent) pop.style.setProperty("--accent", d.accent);
    pop.innerHTML = shot(d, d.title) +
      `<div class="peek-cap"><b>${esc(d.title)}</b>${d.sub ? `<span>${esc(d.sub)}</span>` : ""}</div>`;
    document.body.appendChild(pop);
    wireShot(pop);
    place(el);
    requestAnimationFrame(() => pop && pop.classList.add("open"));
  }

  function place(el) {
    if (!pop) return;
    const r = el.getBoundingClientRect();
    const w = pop.offsetWidth, h = pop.offsetHeight, M = 10;
    // à droite si la place le permet, sinon à gauche, sinon centré au-dessus
    let left = r.right + M;
    if (left + w > innerWidth - M) left = r.left - w - M;
    if (left < M) left = Math.min(Math.max(M, r.left + r.width / 2 - w / 2), innerWidth - w - M);
    let top = r.top + r.height / 2 - h / 2;
    top = Math.min(Math.max(M, top), innerHeight - h - M);
    pop.style.left = Math.round(left) + "px";
    pop.style.top = Math.round(top) + "px";
  }

  function hidePop() {
    clearTimeout(timer);
    popFor = null;
    if (!pop) return;
    const dead = pop; pop = null;
    dead.classList.remove("open");
    setTimeout(() => dead.remove(), 180);
  }

  /* ----------------------------- fenêtre ----------------------------- */
  function open(d) {
    if (!d || !d.src) return;
    hidePop();
    close();
    lastFocus = document.activeElement;
    modal = document.createElement("div");
    modal.className = "peek-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", `Aperçu — ${d.title || "première page"}`);
    if (d.accent) modal.style.setProperty("--accent", d.accent);
    modal.innerHTML = `
      <div class="peek-card">
        <button type="button" class="peek-x" aria-label="Fermer">&times;</button>
        <div class="peek-head"><b>${esc(d.title)}</b>${d.sub ? `<span>${esc(d.sub)}</span>` : ""}</div>
        ${shot(d, d.title)}
        <div class="peek-foot">
          <span class="peek-note">Aperçu de la page 1</span>
          ${d.href ? `<a class="btn btn-primary peek-go" href="${esc(d.href)}">${esc(d.cta || "Lire ce chapitre")}</a>` : ""}
        </div>
      </div>`;
    document.body.appendChild(modal);
    wireShot(modal);
    document.body.style.overflow = "hidden";
    modal.addEventListener("click", e => { if (e.target === modal) close(); });
    modal.querySelector(".peek-x").addEventListener("click", close);
    requestAnimationFrame(() => modal && modal.classList.add("open"));
    (modal.querySelector(".peek-go") || modal.querySelector(".peek-x")).focus({ preventScroll: true });
  }

  function close() {
    if (!modal) return;
    const dead = modal; modal = null;
    dead.classList.remove("open");
    setTimeout(() => dead.remove(), 220);
    document.body.style.overflow = "";
    // Le focus revient sur l'œil d'où l'on vient, sans rouvrir la bulle
    // (sinon fermer la fenêtre fait aussitôt réapparaître un aperçu).
    if (lastFocus && lastFocus.isConnected) {
      restoring = true;
      lastFocus.focus({ preventScroll: true });
      setTimeout(() => { restoring = false; }, 0);
    }
    lastFocus = null;
  }

  /* --------------------------- branchements --------------------------- */
  document.addEventListener("pointerover", e => {
    if (!CAN_HOVER || modal) return;
    const t = e.target.closest && e.target.closest("[data-peek]");
    if (!t) { if (popFor) hidePop(); return; }
    // Déplacement à l'intérieur du bouton (svg → bouton) : on annule la
    // fermeture programmée par le pointerout, sinon la bulle clignote.
    if (t === popFor) { clearTimeout(timer); return; }
    clearTimeout(timer);
    timer = setTimeout(() => showPop(t), DELAY);
  });
  document.addEventListener("pointerout", e => {
    const t = e.target.closest && e.target.closest("[data-peek]");
    if (t && t === popFor) { clearTimeout(timer); timer = setTimeout(hidePop, 60); }
    else if (t) clearTimeout(timer);
  });
  document.addEventListener("focusin", e => {
    if (restoring) return;
    const t = e.target.closest && e.target.closest("[data-peek]");
    if (t) showPop(t); else if (!e.target.closest(".peek-modal")) hidePop();
  });
  document.addEventListener("click", e => {
    const t = e.target.closest && e.target.closest("[data-peek]");
    if (!t) return;
    e.preventDefault();
    open(read(t));
  });
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (modal) close(); else hidePop();
  });
  addEventListener("scroll", () => { if (pop) hidePop(); }, { passive: true });
  addEventListener("resize", () => { if (popFor) place(popFor); });

  window.LTpreview = { btn, btnFor, forSeries, open, close, hide: hidePop };
})();
