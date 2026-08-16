/* =========================================================================
   LanorTrad — Notes de traduction (fin de chapitre).

   Données : js/data/notes.js (window.NOTES), édité à la main par la team.

   Le bloc n'apparaît QUE si le chapitre a des notes. Pas d'en-tête vide, pas
   de « aucune note pour ce chapitre » : un lecteur n'a pas à apprendre qu'il
   n'y a rien à lire.

   API : window.LTnotes
     .get(serie, chapitre)   l'entrée normalisée, ou null
     .html(entree)           le bloc HTML prêt à insérer
   ========================================================================= */
(function () {
  "use strict";

  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* Renvoie {intro, notes:[{page,text}]} ou null.
     Tolérant sur la forme : une note peut être écrite en toutes lettres
     ("une simple chaîne") plutôt qu'en objet — c'est un fichier tenu à la
     main, autant qu'il pardonne. */
  function get(serie, chapitre) {
    const parSerie = (window.NOTES || {})[serie];
    if (!parSerie) return null;
    const e = parSerie[String(chapitre)];
    if (!e) return null;

    const brut = Array.isArray(e) ? e : (e.notes || []);
    const notes = brut
      .map(n => (typeof n === "string" ? { text: n } : n))
      .filter(n => n && n.text && String(n.text).trim());
    if (!notes.length) return null;

    return { intro: (Array.isArray(e) ? "" : e.intro || "").trim(), notes };
  }

  function html(e) {
    if (!e) return "";
    return `
      <section class="rd-notes" aria-labelledby="rd-notes-t">
        <h3 id="rd-notes-t">Notes de traduction</h3>
        ${e.intro ? `<p class="rd-notes-intro">${esc(e.intro)}</p>` : ""}
        <ul>
          ${e.notes.map(n => `<li>${n.page ? `<span class="rd-note-p">p. ${esc(n.page)}</span>` : ""}${esc(n.text)}</li>`).join("")}
        </ul>
      </section>`;
  }

  window.LTnotes = { get, html };
})();
