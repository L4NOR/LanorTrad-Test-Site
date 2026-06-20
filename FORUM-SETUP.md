# Forum — guide de mise en service (Giscus)

Le forum utilise **Giscus** : les discussions sont hébergées gratuitement sur les
**GitHub Discussions** de votre dépôt, mais affichées **dans le site** avec votre design.
Pas de serveur, pas de pub.

La page `forum.html` est prête. Tant que ce n'est pas configuré, elle affiche un
guide. Voici les ~5 minutes de configuration :

1. **Dépôt public** : votre dépôt GitHub doit être public
   (GitHub → votre dépôt → Settings → General → tout en bas, « Change visibility »).
2. **Activer Discussions** : Settings → Features → cochez **Discussions**.
3. **Installer l'app giscus** : ouvrez https://github.com/apps/giscus →
   « Install » → choisissez votre dépôt.
4. **Récupérer les identifiants** : allez sur https://giscus.app
   - Entrez votre dépôt (ex : `L4NOR/LanorTrad`).
   - Choisissez « Discussion title contains page pathname » ou « specific ».
   - giscus.app affiche un bloc `<script ...>` : copiez-y **`data-repo-id`** et **`data-category-id`**.
5. **Coller dans le site** : ouvrez `js/forum.js` et remplissez :
   ```js
   repoId:     "VOTRE_REPO_ID",
   categoryId: "VOTRE_CATEGORY_ID",
   category:   "Forum",   // le nom de la catégorie choisie
   ```

C'est tout ! Le forum s'affiche alors sur la page, les visiteurs se connectent
avec leur compte GitHub pour discuter.

> Thème : par défaut `dark_dimmed` (sombre). Vous pouvez changer `theme` dans
> `js/forum.js` (ex : `transparent_dark`) ou fournir un thème personnalisé plus tard.
