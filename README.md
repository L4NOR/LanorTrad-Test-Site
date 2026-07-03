# LanorTrad — Nouveau site (v2)

Site statique refait à neuf : design sombre/violet, héros 3D, lecteur moderne
(webtoon / page / double), transitions et animations. 100 % HTML/CSS/JS, sans
dépendance lourde — déployable tel quel sur Netlify ou GitHub Pages.

## Structure

```
index.html         Accueil (héros 3D, séries, derniers chapitres)
catalogue.html     Catalogue + filtres (genre, statut, type, tri)
manga.html         Fiche série (data-driven : ?id=Nom)
reader.html        Lecteur (?manga=Nom&chapter=N)
bibliotheque.html  Reprise de lecture (stockage local)
planning.html      Planning des sorties (calendrier hebdo)
equipe.html        Équipe (membres réels)

css/    base, components, animations, home, catalogue, manga, reader, pages
js/     core (shell), cards, tilt, hero, home, catalogue, manga, reader
js/data/series.js     ← métadonnées des séries (À ÉDITER À LA MAIN)
js/data/chapters.js   ← pages par chapitre (GÉNÉRÉ, ne pas éditer)
images/ couvertures, logos, icônes
Manga/  <Série>/Chapitres/Chapitre NN/001.webp …
tools/build-data.py   ← scanner qui régénère chapters.js
```

## Ajouter / mettre à jour des chapitres

1. Copier les pages dans `Manga/<Série>/Chapitres/Chapitre NN/` (`001.jpg`, `002.jpg`, …).
2. Convertir en WebP : `py tools/jpg-to-webp.py "Manga/<Série>"` (puis supprimer les JPG).
3. Régénérer le manifeste : `py tools/build-data.py`
4. C'est tout — le lecteur et les fiches se mettent à jour automatiquement.

Pour ajouter une **nouvelle série** : ajoutez une entrée dans `js/data/series.js`
(l'`id` doit être identique au nom du dossier dans `Manga/`), puis lancez le scanner.

## État actuel (site complet)

- **Toutes les séries + oneshots** sont convertis en WebP (~5,5 Go, ~14 000 pages) et lisibles.
- Manifeste : **536 chapitres** sur 10 séries (régénéré par `tools/build-data.py`).
- Pages **Planning** (calendrier hebdo + dernières sorties) et **Équipe** (membres réels) complètes.
- **PWA** : `manifest.json` + `sw.js` (lecture hors-ligne des chapitres déjà lus). Installable.
- **SEO** : `sitemap.xml`, `robots.txt`, données structurées JSON-LD (ComicSeries) sur les fiches.
- **Analytics** : Google Analytics + AdSense (chargés uniquement en production, pas en local).
- `netlify.toml` prêt pour le déploiement (cache des images).

## Déploiement

Le dossier `F:\LanorTrad-Test-Site` est autonome et prêt à déployer (Netlify : glisser-déposer
le dossier, ou pointer le dépôt dessus). Les IDs GA/AdSense sont ceux de l'ancien site.

## Aperçu en local

Servez le dossier avec le serveur de dev fourni (sans cache, depuis la racine du projet) :

```
py serve.py
```

puis ouvrez http://localhost:8779/ (ou `py -m http.server 8779` pour un serveur minimal).
