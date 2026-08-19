/* =========================================================================
   LanorTrad — Catalogue : filtres, tri, recherche
   ========================================================================= */
(function () {
  "use strict";

  function init() {
    const S = window.SERIES || [];
    const grid = document.getElementById("cat-grid");
    if (!grid) return;

    const fSearch = document.getElementById("f-search");
    const fStatus = document.getElementById("f-status");
    const fType   = document.getElementById("f-type");
    const fGenre  = document.getElementById("f-genre");
    const fSort   = document.getElementById("f-sort");
    const count   = document.getElementById("f-count");

    // Remplir le filtre genres
    const genres = [...new Set(S.flatMap(s => s.genres))].sort((a, b) => a.localeCompare(b, "fr"));
    fGenre.innerHTML = `<option value="">Tous les genres</option>` +
      genres.map(g => `<option value="${g}">${g}</option>`).join("");

    // Préremplir depuis l'URL : ?q= (recherche) et ?genre= (filtre).
    const params = new URLSearchParams(location.search);
    const q = params.get("q");
    if (q) fSearch.value = q;
    // On accepte l'écriture sans accent ni casse (« mystere » -> « Mystère ») :
    // ces URLs finissent dans des liens et des partages, elles doivent pardonner.
    const gWanted = window.LT.route().genre;
    if (gWanted) {
      const found = genres.find(g => window.LT.norm(g) === window.LT.norm(gWanted));
      if (found) fGenre.value = found;
    }

    function apply() {
      // Meme normalisation que la palette (sans accent, sans ponctuation) :
      // « comedie » doit trouver « Comédie », « ao-no » doit trouver « Ao No ».
      const term = window.LT.norm(fSearch.value);
      const st = fStatus.value, ty = fType.value, ge = fGenre.value, so = fSort.value;

      let list = S.filter(s => {
        if (term && !window.LT.matches(s, term)) return false;
        if (st && s.status !== st) return false;
        if (ty && s.type !== ty) return false;
        if (ge && !s.genres.includes(ge)) return false;
        return true;
      });

      const sorters = {
        recent: (a, b) => new Date(b.lastUpdate || 0) - new Date(a.lastUpdate || 0),
        rating: (a, b) => (b.rating || 0) - (a.rating || 0),
        chapters: (a, b) => (b.chapters || 0) - (a.chapters || 0),
        az: (a, b) => a.title.localeCompare(b.title, "fr"),
        za: (a, b) => b.title.localeCompare(a.title, "fr"),
      };
      list.sort(sorters[so] || sorters.recent);

      count.textContent = `${list.length} résultat${list.length > 1 ? "s" : ""}`;
      if (!list.length) {
        grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="big">🔍</div><p>Rien avec ces filtres. Élargis un peu : la pépite n'est pas loin.</p></div>`;
      } else {
        grid.innerHTML = list.map(LTcard).join("");
      }
      document.dispatchEvent(new Event("lt:cards"));
      window.LT && window.LT._scanReveals && window.LT._scanReveals();
      syncUrl(ge, list.length);
    }

    /* ---- L'URL suit le filtre de genre ----
       Deux raisons. D'abord un filtre qu'on ne peut pas partager ne sert qu'à
       celui qui l'a cliqué. Ensuite et surtout, « manga d'horreur en français »
       est une recherche courante, et sans URL propre il n'y a rien à indexer.
       On donne donc à la vue filtrée son titre, sa description et son
       canonical — pas une page de plus, la même page qui se décrit
       correctement. replaceState : filtrer ne doit pas remplir l'historique,
       sinon le bouton Retour oblige à défaire les filtres un par un. */
    function syncUrl(genre, n) {
      // Le genre vit desormais dans le CHEMIN (/genre/horreur/), pas dans la
      // requete : c'est l'adresse que declarent le sitemap et le canonical.
      // Les autres filtres (dont ?q=) restent en requete, ils ne sont pas
      // indexables et n'ont pas a l'etre.
      const url = new URL(location.href);
      url.searchParams.delete("genre");
      url.pathname = genre ? window.LT.urlGenre(genre) : "/catalogue.html";
      if (url.href !== location.href) history.replaceState(null, "", url);

      const base = "https://lanortrad.com/catalogue.html";
      if (genre) {
        document.title = `Manga ${genre} en français — Catalogue LanorTrad`;
        setMeta("description",
          `${n} série${n > 1 ? "s" : ""} de manga ${genre.toLowerCase()} traduite${n > 1 ? "s" : ""} en français par LanorTrad, à lire gratuitement en ligne.`);
        setCanonical("https://lanortrad.com" + window.LT.urlGenre(genre));
        setH1(`Catalogue ${genre}`);
      } else {
        document.title = "Catalogue — LanorTrad";
        setMeta("description", "Parcourez tout le catalogue LanorTrad : mangas et oneshots traduits en français. Filtrez par genre, statut et popularité.");
        setCanonical(base);
        setH1("Catalogue");
      }
    }
    function setMeta(name, content) {
      let m = document.querySelector(`meta[name="${name}"]`);
      if (!m) { m = document.createElement("meta"); m.name = name; document.head.appendChild(m); }
      m.content = content;
    }
    function setCanonical(href) {
      let l = document.querySelector('link[rel="canonical"]');
      if (!l) { l = document.createElement("link"); l.rel = "canonical"; document.head.appendChild(l); }
      l.href = href;
    }
    function setH1(text) {
      const h = document.querySelector(".page-head h1");
      if (h && h.textContent !== text) h.textContent = text;
    }

    [fSearch, fStatus, fType, fGenre, fSort].forEach(elm =>
      elm.addEventListener("input", apply));
    apply();

    // « Surprends-moi » : ouvre une série au hasard (lecture si dispo, sinon fiche)
    const rnd = document.getElementById("cat-random");
    if (rnd) rnd.addEventListener("click", () => {
      const playable = S.filter(s => window.LT.playable(s));
      const pool = playable.length ? playable : S;
      const s = pool[Math.floor(Math.random() * pool.length)];
      if (s) location.href = window.LT.playable(s) ? window.LT.urlChapter(s) : window.LT.urlSeries(s);
    });
  }

  document.addEventListener("lt:ready", init);
})();
