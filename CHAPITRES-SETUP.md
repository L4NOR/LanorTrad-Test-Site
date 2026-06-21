# Ajouter un chapitre (sans coder)

Un petit serveur **local** avec interface web te permet d'ajouter des chapitres
en glissant simplement les images. Aucune ligne de commande, aucun code.

## Lancer l'outil
- **Double-clique** sur `tools/Ajouter-Chapitre.bat`.
  (Ou en ligne de commande : `node tools/upload-server.js`.)
- Ton navigateur s'ouvre sur **http://localhost:4599**.
- Laisse la fenêtre noire ouverte tant que tu t'en sers ; ferme-la pour arrêter.

> Prérequis : **Node.js** installé (c'est déjà le cas sur ta machine).

## Ajouter un chapitre
1. **Série** : choisis-la dans la liste (= dossiers de `/Manga`) ou tape un nom
   exact pour une nouvelle série.
2. **N° de chapitre** : ex. `19` (ou `138.5` pour un demi-chapitre).
3. **Pages** : glisse-dépose toutes les images du chapitre. Elles sont rangées
   **dans l'ordre du nom de fichier** (nomme-les `001`, `002`, … ou `01`, `02`).
4. Clique **Publier le chapitre**. L'outil :
   - crée `Manga/<Série>/Chapitres/Chapitre NN/`,
   - y range les pages renommées `001.jpg`, `002.jpg`, …,
   - régénère `js/data/chapters.js` (le catalogue lu par le lecteur).

## Voir le résultat
- **En local** : recharge le site, le chapitre est lisible.
- **En ligne** (pour les visiteurs) : envoie les nouveaux fichiers sur ton hébergeur
  (les images de `Manga/…` **et** `js/data/chapters.js`). Avec Netlify + GitHub :
  un `git add . && git commit && git push` suffit.

## Bon à savoir
- Pour une **nouvelle série**, pense aussi à l'ajouter dans `js/data/series.js`
  (titre, couverture, genres…) pour qu'elle apparaisse au catalogue.
- L'ancien script `py tools/build-data.py` fonctionne toujours et fait la même
  régénération (+ la galerie). Les deux outils sont compatibles.
- L'outil n'écoute que sur `127.0.0.1` (ta machine) : rien n'est exposé sur Internet.
