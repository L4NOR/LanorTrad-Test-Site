/* =========================================================================
   LanorTrad — Forum via Giscus (GitHub Discussions, gratuit, sans serveur).
   ⚙️  CONFIG : remplissez repoId + categoryId depuis https://giscus.app
       (après avoir : rendu le dépôt PUBLIC, activé l'onglet "Discussions",
        et installé l'app giscus sur le dépôt). Voir FORUM-SETUP.md.
   ========================================================================= */
(function () {
  "use strict";

  const CFG = {
    repo:       "L4NOR/LanorTrad-Test-Site",   // votre dépôt GitHub
    repoId:     "R_kgDOS_xMqg",                  // ← À REMPLIR (donné par giscus.app)
    category:   "General",             // catégorie de Discussions
    categoryId: "DIC_kwDOS_xMqs4C_i4A",                  // ← À REMPLIR (donné par giscus.app)
    mapping:    "specific",
    term:       "Forum LanorTrad",
    theme:      "dark_dimmed",       // thème giscus (sombre)
    lang:       "fr"
  };

  function init() {
    const mount = document.getElementById("giscus-mount");
    if (!mount) return;
    if (!CFG.repoId || !CFG.categoryId) { mount.innerHTML = setupCard(); window.LT && window.LT._scanReveals && window.LT._scanReveals(); return; }
    const s = document.createElement("script");
    s.src = "https://giscus.app/client.js"; s.async = true; s.crossOrigin = "anonymous";
    const A = {
      "data-repo": CFG.repo, "data-repo-id": CFG.repoId, "data-category": CFG.category,
      "data-category-id": CFG.categoryId, "data-mapping": CFG.mapping, "data-term": CFG.term,
      "data-strict": "0", "data-reactions-enabled": "1", "data-emit-metadata": "0",
      "data-input-position": "top", "data-theme": CFG.theme, "data-lang": CFG.lang, "data-loading": "lazy"
    };
    Object.entries(A).forEach(([k, v]) => s.setAttribute(k, v));
    mount.appendChild(s);
  }

  function setupCard() {
    return `
      <div class="setup-card" data-reveal>
        <div class="setup-ico">💬</div>
        <h2>Forum bientôt en ligne</h2>
        <p>Le forum est prêt côté design. Pour l'activer (gratuit, ~5 min), il suffit de configurer <b>Giscus</b> :</p>
        <ol class="setup-steps">
          <li>Rendre votre dépôt GitHub <b>public</b> (Settings → General → Danger Zone).</li>
          <li>Activer l'onglet <b>Discussions</b> du dépôt (Settings → Features → Discussions).</li>
          <li>Installer l'app <b>giscus</b> : <a href="https://github.com/apps/giscus" target="_blank" rel="noopener">github.com/apps/giscus</a> sur votre dépôt.</li>
          <li>Aller sur <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a>, entrer votre dépôt → copier le <b>repo-id</b> et le <b>category-id</b>.</li>
          <li>Les coller dans <code>js/forum.js</code> (variables <code>repoId</code> et <code>categoryId</code>).</li>
        </ol>
        <p class="setup-note">Le forum s'affichera alors ici, intégré au site, avec connexion via GitHub — sans pub et sans serveur.</p>
        <a class="btn btn-primary" href="https://giscus.app" target="_blank" rel="noopener" style="position:relative">Configurer sur giscus.app</a>
      </div>`;
  }

  document.addEventListener("lt:ready", init);
})();
