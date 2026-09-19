/* =========================================================================
   LanorTrad — Fiches personnages, sans spoil.

   Données : js/data/personnages.js (window.PERSONNAGES), écrit à la main par
   la team. Chaque personnage porte le chapitre où il entre en scène ; on ne
   montre que ceux que le lecteur a déjà croisés, et seulement ce qu'on sait
   d'eux à ce stade (les `suite` ont leur propre chapitre).

   Une série sans fiches n'affiche rien : les appelants testent `has()`.

   API : window.LTperso
     .has(serie)                   la série a-t-elle des fiches ?
     .split(serie, jusqua, strict) { vus, caches } — jusqua = n° de chapitre
                                   (null = rien lu : seul le chapitre 1 compte)
                                   strict = exclut le chapitre `jusqua` lui-même
     .html(liste, accent, chap)    la grille de cartes (chap = afficher le
                                   chapitre d'entrée de chaque fiche)
     .list(serie)                  toutes les fiches, sans filtre
   ========================================================================= */
(function () {
  "use strict";

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const num = x => { const v = parseFloat(x); return Number.isFinite(v) ? v : Infinity; };

  // Liste normalisée ; tolérante sur la forme (fichier tenu à la main), mais
  // un personnage sans nom ou sans chapitre d'entrée est ignoré : afficher
  // quelqu'un « depuis toujours » par erreur, c'est exactement le spoiler
  // que ce module existe pour éviter.
  function list(serie) {
    const brut = (window.PERSONNAGES || {})[serie];
    if (!Array.isArray(brut)) return [];
    return brut
      .filter(p => p && String(p.nom || "").trim() && String(p.depuis || "").trim())
      .map(p => ({
        nom: String(p.nom).trim(),
        depuis: String(p.depuis).trim(),
        role: String(p.role || "").trim(),
        texte: String(p.texte || "").trim(),
        image: String(p.image || "").trim(),
        suite: (Array.isArray(p.suite) ? p.suite : [])
          .filter(x => x && String(x.texte || "").trim() && String(x.depuis || "").trim())
          .map(x => ({ depuis: String(x.depuis).trim(), texte: String(x.texte).trim() })),
      }))
      .sort((a, b) => num(a.depuis) - num(b.depuis));
  }

  const has = serie => list(serie).length > 0;

  function split(serie, jusqua, strict) {
    const lim = jusqua == null || jusqua === "" ? 1 : num(jusqua);
    const connu = d => strict ? num(d) < lim : num(d) <= lim;
    const vus = [], caches = [];
    list(serie).forEach(p => {
      if (connu(p.depuis)) vus.push(Object.assign({}, p, { suite: p.suite.filter(x => connu(x.depuis)) }));
      else caches.push(p);
    });
    return { vus, caches };
  }

  function initiales(nom) {
    const m = nom.split(/\s+/).filter(Boolean);
    return ((m[0] || "?")[0] + (m.length > 1 ? m[m.length - 1][0] : "")).toUpperCase();
  }

  // `montrerChap` : sur la vue « tout afficher », chaque fiche dit d'où elle vient.
  function carte(p, accent, montrerChap) {
    const av = p.image
      ? `<img class="perso-av" src="${esc(p.image)}" alt="" loading="lazy">`
      : `<span class="perso-av perso-ini" style="--c:${esc(accent || "#a855f7")}">${esc(initiales(p.nom))}</span>`;
    return `<article class="perso">
      ${av}
      <div class="perso-b">
        <h3 class="perso-nom">${esc(p.nom)}${p.role ? ` <span class="perso-role">${esc(p.role)}</span>` : ""}</h3>
        ${montrerChap ? `<span class="perso-ch">Dès le ch. ${esc(p.depuis)}</span>` : ""}
        ${p.texte ? `<p>${esc(p.texte)}</p>` : ""}
        ${p.suite.map(x => `<p class="perso-suite"><span class="perso-ch">Ch. ${esc(x.depuis)}</span> ${esc(x.texte)}</p>`).join("")}
      </div>
    </article>`;
  }

  function html(liste, accent, montrerChap) {
    return `<div class="perso-grid">${liste.map(p => carte(p, accent, montrerChap)).join("")}</div>`;
  }

  window.LTperso = { has, split, html, list };
})();
