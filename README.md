# LanorTrad — Documentation du site (v2)

Site statique refait à neuf : design sombre/violet, héros 3D, lecteur moderne
(webtoon / page / double), transitions, animations et **visite guidée** pour les
nouveaux visiteurs. 100 % HTML/CSS/JS, sans dépendance lourde — déployable tel
quel sur Netlify ou GitHub Pages.

> Ce fichier regroupe **toute** la documentation du projet (structure, ajout de
> chapitres, forum, gamification, déploiement). Les anciens fichiers
> `CHAPITRES-SETUP.md`, `FORUM-SETUP.md` et `GAMIFICATION-SETUP.md` ont été
> fusionnés ici.

---

## Sommaire

1. [Structure du projet](#1-structure-du-projet)
2. [Aperçu en local](#2-aperçu-en-local)
3. [Ajouter / mettre à jour des chapitres](#3-ajouter--mettre-à-jour-des-chapitres)
4. [Ajouter / modifier une série (fiches)](#4-ajouter--modifier-une-série-fiches)
   · [4 bis. L'atelier — avancement du prochain chapitre](#4-bis-latelier--avancement-du-prochain-chapitre)
5. [Forum — configuration (Supabase)](#5-forum--configuration-supabase)
6. [Gamification (XP / niveaux)](#6-gamification-xp--niveaux)
7. [Visite guidée (tutoriel première visite)](#7-visite-guidée-tutoriels-première-visite)
   · [7 bis. Mode hors ligne + mini-jeu](#7-bis-mode-hors-ligne--mini-jeu--oni-runner-)
8. [Déploiement](#8-déploiement) · [depuis ta machine](#déployer-depuis-ta-machine-et-pourquoi)
   · [8 bis. Vérifications automatiques](#8-bis-vérifications-automatiques)
9. [État actuel du site](#9-état-actuel-du-site)
10. [Diagnostic — quels scripts SQL sont déployés ?](#10-diagnostic--quels-scripts-sql-sont-déployés-)

---

## 1. Structure du projet

```
index.html         Accueil (héros 3D, séries, derniers chapitres)
catalogue.html     Catalogue + filtres (genre, statut, type, tri)
manga.html         Fiche série (data-driven)   → /manga/<slug>/
reader.html        Lecteur                      → /manga/<slug>/chapitre-<N>/
bibliotheque.html  Reprise de lecture (stockage local)
planning.html      Planning des sorties (calendrier hebdo)
forum.html         Forum communautaire (comptes Supabase)
classement.html    Classement XP / gamification
equipe.html        Équipe (membres réels)
diag.html          Outil de team : quels scripts SQL sont déployés (§ 10)

fonts/  Inter + Sora auto-hébergées (woff2, licence SIL OFL)
css/    base, fonts, components, animations, home, catalogue, manga, reader, pages,
        extras, forum, classement, planning, preview, perf, ambiance, tour, atelier
js/     core (shell), cards, tilt, hero, home, catalogue, manga, reader,
        preview, atelier, forum, classement, xp, views, perf, store, palette, tour, offline
offline.html          ← page de repli hors ligne (avec le mini-jeu)
js/data/series.js     ← métadonnées des séries (à la main OU via Modifier-Series.bat)
js/data/chapters.js   ← INDEX des chapitres + dimensions (GÉNÉRÉ, ne pas éditer)
js/data/pages/<Série>.js ← liste des pages, chargée par le lecteur (GÉNÉRÉ)
js/data/covers.js     ← variantes responsives des couvertures (GÉNÉRÉ)
js/data/schedule.js   ← dates des prochaines sorties (à la main)
js/data/atelier.js    ← avancement du chapitre en fabrication (à la main, § 4 bis)
images/ couvertures, logos, icônes
Manga/  <Série>/Chapitres/Chapitre NN/001.webp …
Manga/preview/  <Série>/<Chapitre NN>/001.webp ← vignettes d'aperçu (GÉNÉRÉES)
tools/build-data.py         ← scanner : chapters.js + js/data/pages/
tools/build-covers.py       ← variantes légères des couvertures (images/Cover/rs/)
tools/build-og.py           ← vignettes de partage des SÉRIES (images/og/series/)
tools/build-og-pages.py     ← vignettes des PAGES et des GENRES (images/og/pages|genres/)
tools/og-maquettes.py       ← les maquettes dessinées de ces vignettes (module)
tools/build-previews.py     ← vignettes de la 1re page (appelé par build-data.py)
tools/Ajouter-Chapitre.bat  ← interface web locale pour ajouter un chapitre
tools/Modifier-Series.bat   ← interface web locale pour éditer les fiches séries
tools/Modifier-Atelier.bat  ← interface web locale pour l'avancement des chapitres
tools/jpg-to-webp.py        ← conversion des planches JPG → WebP (sans perte)
tools/deployer.py           ← déploiement depuis cette machine (§ 8)
tools/Deployer.bat          ← le même, en double-clic
supabase/*.sql              ← schémas Supabase (forum + gamification)
scripts/build-seo.js        ← sitemap, flux RSS, og-meta.json, robots.txt
scripts/check.js            ← vérifie la cohérence du site (§ 8 bis)
scripts/test-og.mjs         ← tests du pré-rendu servi aux robots
```

### Les adresses du site

Chaque série et chaque chapitre a sa propre adresse, lisible :

```
/manga/tougen-anki/                 la fiche
/manga/tougen-anki/lecture/         « lire maintenant » (reprend ou commence)
/manga/tougen-anki/chapitre-240/    un chapitre
/genre/horreur/                     le catalogue filtré
```

Ce ne sont pas des fichiers : ce sont des **réécritures** déclarées dans
`netlify.toml`, qui servent `manga.html` / `reader.html` / `catalogue.html` sans
changer l'adresse affichée. Trois conséquences, toutes traitées dans le code :

- l'adresse affichée reste la jolie, donc **`location.search` est vide** — tout
  ce qui lisait `?id=` passe par `LT.route()` (`js/core.js`), qui comprend les
  deux formes ;
- l'URL ne transporte que le **slug** (`tougen-anki`) alors que les données sont
  indexées par le nom réel (`Tougen Anki`) — `LT.seriesById()` accepte les deux ;
- le navigateur se croit dans un sous-dossier, d'où le `<base href="/">` en tête
  de ces trois pages : sans lui, `css/base.css` deviendrait
  `/manga/tougen-anki/css/base.css`. La balise est **écrite en dur** (le
  préchargeur du navigateur lit le `<head>` avant d'exécuter le moindre script :
  une balise posée par JS arriverait trop tard, et tous les fichiers seraient
  déjà demandés à la mauvaise adresse). Un petit script inline la **retire**
  quand l'adresse n'est pas réécrite — sinon, ouvrir la page directement depuis
  le disque donnerait `file:///F:/css/base.css`, et la page s'afficherait sans
  aucun style.

Les anciennes adresses (`manga.html?id=…`) **fonctionnent toujours** — un vieux
lien, un vieux partage restent valables — mais ne sont plus déclarées nulle
part : sitemap, flux, IndexNow, `canonical` et liens internes pointent la
nouvelle forme.

La règle de slug est écrite à **trois** endroits qui doivent rester d'accord :
`js/core.js` (le site), `scripts/build-seo.js` (le sitemap) et
`netlify/edge-functions/og.js` (ce que voient les robots). `scripts/check.js`
vérifie qu'ils ne divergent pas ; en cas de dérive, le sitemap déclarerait des
URLs dont le `canonical` désigne autre chose.

`serve.py` rejoue les mêmes réécritures en local, pour que ça se teste sans
déployer.

Tous les scripts de `tools/` sont **versionnés** : ils font partie du travail
courant décrit ici, et le site ne se maintient pas sans eux. Seuls restent hors
dépôt ce qu'ils *produisent* et qui se régénère (`tools/.dims-cache.json`,
`tools/.backups/`, `__pycache__/`).

---

## 2. Aperçu en local

Servez le dossier avec le serveur de dev fourni (sans cache, depuis la racine) :

```
py serve.py
```

puis ouvrez <http://localhost:8779/> (ou `py -m http.server 8779` pour un serveur
minimal). En local, le service worker et la mesure d'audience sont
automatiquement désactivés (même si tu cliques « Accepter » pour tester le
bandeau de consentement).

---

## 3. Ajouter / mettre à jour des chapitres

Deux méthodes, au choix.

### A. Sans coder (interface web locale) — recommandé

Un petit serveur **local** avec interface web permet d'ajouter des chapitres en
glissant simplement les images. Aucune ligne de commande, aucun code.

1. **Double-clique** sur `tools/Ajouter-Chapitre.bat`
   (ou en ligne de commande : `node tools/upload-server.js`).
   Ton navigateur s'ouvre sur <http://localhost:4599>. Laisse la fenêtre noire
   ouverte tant que tu t'en sers ; ferme-la pour arrêter.
   *Prérequis : Node.js + Python avec Pillow (`py -m pip install pillow`),
   déjà le cas sur ta machine.*
2. **Série** : choisis-la dans la liste (= dossiers de `/Manga`) ou tape un nom
   exact pour une nouvelle série.
3. **N° de chapitre** : ex. `19` (ou `138.5` pour un demi-chapitre).
4. **Pages** : glisse-dépose toutes les images du chapitre **en JPG/PNG, telles
   quelles** (pas besoin de convertir avant). Elles sont rangées **dans l'ordre
   du nom de fichier** (nomme-les `001`, `002`, … ou `01`, `02`).
5. La conversion est **100 % fidèle** : couleurs et tons ne sont jamais
   modifiés. La case **🔪 Netteté légère** (décochée par défaut) applique
   uniquement un léger renfort du trait, pour les scans un peu flous — inutile
   sur des pages propres.
6. Clique **Publier le chapitre**. L'outil :
   - crée `Manga/<Série>/Chapitres/Chapitre NN/`,
   - y range les pages renommées `001`, `002`, …,
   - les **convertit automatiquement en WebP** (qualité 85) avec, si la case est
     cochée, l'amélioration du rendu — puis supprime les JPG/PNG sources,
   - fabrique la **vignette d'aperçu** de la page 1 (voir plus bas),
   - régénère `js/data/chapters.js` (le catalogue lu par le lecteur).
   La conversion peut prendre 1 à 2 minutes selon le nombre de pages.

L'onglet **🛠️ Gérer** permet de modifier un chapitre existant :

- **Liste des chapitres** d'une série (avec nombre de pages), y compris les
  oneshots ;
- **Éditeur de chapitre** avec miniatures des pages :
  - ✕ sur une miniature → supprime la page (renumérotation automatique) ;
  - **➕ Ajouter des pages** → insère des JPG/PNG à la position de ton choix
    (début, fin, ou après la page N), convertis en WebP comme à l'ajout ;
  - **♻️ Remplacer toutes les pages** → repart de zéro avec de nouvelles images ;
  - **🔢 Changer le n°** → renomme le chapitre (ex. `19` → `19.5`) ;
  - **🗑️ Supprimer le chapitre** → efface le dossier entier (confirmation
    demandée).
  Pour corriger une seule page : supprime-la, puis « Ajouter des pages » à sa
  position. Chaque action met à jour `chapters.js` automatiquement.

> L'outil n'écoute que sur `127.0.0.1` (ta machine) : rien n'est exposé sur
> Internet.

### B. En ligne de commande (Python)

1. Copier les pages dans `Manga/<Série>/Chapitres/Chapitre NN/`
   (`001.jpg`, `002.jpg`, …).
2. Convertir en WebP : `py tools/jpg-to-webp.py "Manga/<Série>"`
   (puis supprimer les JPG). Options utiles : `--enhance` (netteté légère du
   trait, sans jamais toucher aux tons), `--delete-src` (supprime les sources
   après conversion), `--include-png`, `--quality N` (défaut 80).
3. Régénérer le manifeste : `py tools/build-data.py`
   (génère aussi les vignettes d'aperçu — voir juste en dessous).
4. C'est tout — le lecteur et les fiches se mettent à jour automatiquement.

### Aperçus de la première page

Sur la fiche d'une série, chaque chapitre a un petit **œil** : survole-le à la
souris pour voir la première page en bulle, clique/tape dessus pour l'ouvrir en
grand avec un bouton de lecture. Même chose sur le **planning** (calendrier
hebdo + dernières sorties) et sur les **prochaines sorties** de l'accueil.

- Une page pèse 1,2 Mo en moyenne (jusqu'à 8,9 Mo) : on ne l'affiche jamais
  telle quelle. `tools/build-previews.py` fabrique une vignette de ~35 Ko par
  chapitre, rangée comme le chapitre lui-même — un dossier par chapitre, une
  page dedans : `Manga/preview/<Série>/<Chapitre NN>/001.webp` (et
  `Manga/preview/<Série>/Oneshot/001.webp` pour les oneshots). Elle n'est
  chargée qu'au survol/tap. Total : 19 Mo pour 543 chapitres.
- **Rien à faire à la main** : `py tools/build-data.py` (et l'interface
  `Ajouter-Chapitre.bat`) la génèrent pour chaque nouveau chapitre, oneshots
  compris, et posent le chemin dans le champ `thumb` de `chapters.js`. Les
  vignettes des chapitres supprimés sont nettoyées automatiquement.
- Commandes utiles :
  - `py tools/build-previews.py "Tougen Anki"` — une seule série ;
  - `py tools/build-previews.py --force` — tout régénérer (après un changement
    de réglage : largeur 360 px, qualité 68, haut de planche gardé pour les
    webtoons) ;
  - `Manga/preview/` n'est jamais vu comme une série : les scanners
    (`build-data.py`, `upload-server.js`, `series-server.js`) l'ignorent ;
  - `py tools/build-data.py --no-previews` — manifeste seul, plus rapide ;
  - `py tools/build-data.py --no-dims` — saute la mesure des pages.
- Un chapitre **annoncé mais pas encore sorti** n'a évidemment pas de pages :
  le planning montre alors la première page du **dernier chapitre paru**, avec
  la mention correspondante. Dès que le chapitre sort, l'aperçu devient le sien.

### Ce que `build-data.py` écrit (et pourquoi deux fichiers)

- **`js/data/chapters.js`** — l'**index** : pour chaque chapitre, son numéro,
  son dossier, son nombre de pages, sa vignette et les **dimensions** des
  planches. Chargé sur toutes les pages du site, donc gardé le plus léger
  possible : **~15 Ko** (contre 70 Ko avant compactage).

  Il est écrit sous forme **compacte**, avec une petite fonction d'expansion en
  tête du fichier. 67 % de l'ancien poids était en effet devinable : la vignette
  se déduit du dossier, le dossier suit un ou deux motifs par série
  (`Chapitres/Chapitre 44` ou `Chapitres/44`), et les dimensions sont presque
  toujours identiques d'un chapitre à l'autre. On ne stocke donc, par chapitre,
  que le numéro, le nombre de pages et **ce qui s'écarte** des valeurs par
  défaut de la série.

  L'objet reconstruit à l'exécution est **exactement** l'ancien
  (`{num, folder, pages, w, h, thumb, d}`) : aucun code lisant `window.CHAPTERS`
  n'a eu à changer. Ce fichier est aussi la **mémoire des dates de sortie**
  (champ `d`) — voir plus bas.
- **`js/data/pages/<Série>.js`** — la **liste des fichiers** de chaque page.
  C'est la partie lourde, et seul le lecteur en a besoin : il ne charge que le
  fichier de la série ouverte. Avant, tout était dans `chapters.js` (305 Ko
  chargés jusque sur l'accueil et le forum).

Les **dimensions** servent au lecteur à réserver la place de chaque planche
avant qu'elle n'arrive. Sans elles, en mode webtoon, le scroll sautait sous les
doigts à chaque image chargée (score CLS mesuré : 4,49 → 0,002).

Elles sont mises en cache dans `tools/.dims-cache.json`, donc seules les pages
**nouvelles** sont mesurées : le premier passage prend quelques minutes (14 000
pages), les suivants sont instantanés. `--no-dims` saute complètement l'étape —
le lecteur retombe alors sur son ancien comportement, sans rien casser.

### Les dates de sortie (champ `d`)

Le sitemap a besoin de savoir **quand** chaque chapitre est sorti. Cette date ne
se devine pas : les dates de dossier sont toutes groupées au jour de la
conversion WebP, et dater 544 chapitres du même jour revient à se faire ignorer
par Google. La règle est donc simple, et elle n'invente rien :

- un chapitre **absent** du passage précédent vient d'arriver → il est daté
  d'aujourd'hui, et cette date est **figée définitivement** ;
- une date déjà connue est reconduite telle quelle ;
- un chapitre antérieur à ce système reste **sans date**, et le sitemap omet
  simplement son `lastmod`.

`chapters.js` est la seule mémoire de ces dates. **Ne le supprime pas** pour
« repartir propre » : tu perdrais l'historique, sans moyen de le reconstituer.

### Voir le résultat

- **En local** : recharge le site, le chapitre est lisible.
- **En ligne** (pour les visiteurs) : envoie les nouveaux fichiers sur ton
  hébergeur (les images de `Manga/…`, aperçus de `Manga/preview/…` compris,
  **et** `js/data/chapters.js` ainsi que `js/data/pages/`). Avec Netlify +
  GitHub, un `git add . && git commit && git push` suffit.

---

## 4. Ajouter / modifier une série (fiches)

Les **infos** d'une série (description, genres, auteur, artiste, année, note,
statut, couverture…) vivent dans `js/data/series.js`. Les **images** des
chapitres, elles, se gèrent avec l'outil de la section 3.

### A. Sans coder (interface web locale) — recommandé

1. **Double-clique** sur `tools/Modifier-Series.bat`
   (ou en ligne de commande : `node tools/series-server.js`).
   Ton navigateur s'ouvre sur <http://localhost:4600>. Laisse la fenêtre noire
   ouverte tant que tu t'en sers ; ferme-la pour arrêter.
   *Prérequis : Node.js. Les trois outils peuvent tourner en même temps
   (ports 4599, 4600 et 4601 — voir aussi § 4 bis pour l'atelier).*
2. La liste montre **toutes les fiches** dans l'ordre où elles apparaissent sur
   le site. Les flèches **↑ ↓** changent cet ordre, **✏️ Modifier** ouvre la
   fiche, **➕ Nouvelle fiche** en crée une.
3. Dans le formulaire :
   - **Identifiant** : doit être **identique** au nom du dossier dans `Manga/`
     (l'outil te dit s'il le trouve, et combien de chapitres y sont scannés) ;
   - **Titre, type** (série / oneshot), **statut**, **note /5** ;
   - **Nombre de chapitres** et **date de MàJ** : un lien sous le champ propose
     la valeur réelle lue dans `chapters.js` / dans les dossiers, en un clic ;
   - **Année de parution**, **auteur** (scénario) et **artiste** (dessin, si
     c'est quelqu'un d'autre) ;
   - **Genres** : clique sur les genres déjà utilisés pour les ajouter, ou tape
     le tien puis Entrée ; ✕ pour en retirer un ;
   - **Description**, **couverture** (choisie parmi `images/Cover/`, avec
     aperçu), **couleur d'accent** (l'ambiance de la fiche) ;
   - **Équipes partenaires** pour les collaborations (nom, lien, couleur) ;
   - **⭐ Mise en avant** (héros et sélections de l'accueil) et **📖 demo**.
   Un aperçu en haut de page se met à jour pendant que tu tapes.
4. **💾 Enregistrer** réécrit `js/data/series.js`. Avant chaque écriture, une
   copie de l'ancienne version est rangée dans `tools/.backups/`
   (les 30 dernières sont conservées) — en cas de bêtise, tu recopies le
   fichier voulu par-dessus.
5. **🗑️ Supprimer la fiche** retire la série du site **sans toucher** aux images
   ni aux dossiers de `Manga/`.

> L'outil n'écoute que sur `127.0.0.1` (ta machine) : rien n'est exposé sur
> Internet. Il réécrit le fichier dans le même style qu'à la main ; en revanche
> les commentaires que tu aurais ajoutés toi-même dans `series.js` ne sont pas
> conservés (l'en-tête, le séparateur « ONESHOTS » et la note « partenaires », si).

### B. À la main

Ajoute ou modifie une entrée dans `js/data/series.js` (titre, couverture,
genres, statut…). L'`id` doit être **identique** au nom du dossier dans
`Manga/`. Lance ensuite le scanner (`py tools/build-data.py`) ou publie un
chapitre via l'outil web — la série apparaîtra alors au catalogue.

Champs reconnus : `id`, `title`, `type` (`manga` / `oneshot`), `genres`,
`status`, `chapters`, `lastUpdate` (AAAA-MM-JJ), `rating`, `author`, `artist`,
`year`, `accent`, `partners`, `description`, `cover`, `url`, `demo`, `featured`.
`artist` et `year` sont facultatifs : quand ils sont remplis, la fiche affiche
« Dessin <artiste> » et l'année à côté du statut.

### C. Nouvelle couverture → relancer `build-covers.py`

Dépose la couverture dans `images/Cover/` (JPG ou PNG, pleine résolution), puis :

```bash
py tools/build-covers.py
```

L'outil écrit des variantes WebP légères dans `images/Cover/rs/` (120, 240, 480
et 720 px) et met à jour le manifeste `js/data/covers.js`. Le site sert ensuite
la bonne taille selon l'écran, au lieu d'envoyer une image de 2 Mo dans une
carte de 230 px.

- **Les originaux ne sont jamais modifiés ni supprimés** : ils restent la source
  des variantes et de la vignette de partage (voir D).
- **Oublier de lancer l'outil ne casse rien** : une couverture absente du
  manifeste est simplement servie en pleine résolution, comme avant.
- À relancer aussi si tu **remplaces** une couverture existante (l'outil détecte
  les fichiers plus récents ; `--force` régénère tout).

### D. Vignettes de partage → `build-og.py`

Quand un lien du site est collé sur Discord, X ou Facebook, ces plateformes
affichent un rectangle **1200 × 630**. Leur envoyer la couverture, qui est
portrait, revient à partager une bande recadrée au milieu — souvent illisible.
Cet outil fabrique une vraie carte paysage par série (couverture entière à
gauche, titre, genres et nombre de chapitres à droite, fond tiré de la
couverture) :

```bash
node scripts/build-seo.js && py tools/build-og.py && node scripts/build-seo.js
```

Le double appel n'est pas une erreur : `build-seo.js` fabrique le `og-meta.json`
dont l'outil a besoin, puis le relit pour **référencer** les vignettes créées.

- Sortie : `images/og/series/<serie>.jpg`, à **committer** (Netlify ne lance pas
  Python — comme pour `build-covers.py`).
- Sans vignette, le site retombe tout seul sur la couverture : rien ne casse.
- `--force` régénère tout. Modifier `build-og.py` suffit à périmer les cartes.
- Pour la typo exacte du site, une fois : `py -m pip install fonttools brotli`
  (les `.woff2` sont des polices variables, illisibles par Pillow sans ça).
  Sans ces modules, l'outil bascule sur une police système et le dit.

### D bis. Vignettes des autres pages → `build-og-pages.py`

`build-og.py` ne couvre que les séries. Tout le reste du site — accueil,
catalogue, planning, forum, classement, bibliothèque, équipe, pages légales —
partageait **la même image générique**, et les 17 vues par genre aussi. Sur
Discord, un lien vers le planning et un lien vers le forum se ressemblaient
trait pour trait.

```bash
node scripts/build-seo.js && py tools/build-og-pages.py
```

- Sortie : `images/og/pages/<page>.jpg` et `images/og/genres/<genre>.jpg`, à
  **committer** (Netlify ne lance pas Python).
- Même charte que les cartes de série — le dessin est littéralement le même
  moteur, importé depuis `build-og.py`. Le filet du bas reprend le **dégradé**
  du site plutôt que la couleur d'une série.
- Chaque page montre une **maquette de ce qu'elle contient**
  (`tools/og-maquettes.py`) : une discussion pour le forum, une semaine pour le
  planning, une grille filtrable pour le catalogue et les genres, un tableau de
  rangs pour le classement, des lectures en cours pour la bibliothèque, les
  trois membres pour l'équipe. Un empilement de couvertures dit « manga » ; il
  ne dit pas ce qu'on trouve sur la page.
- **Aucun emoji** n'est dessinable : les polices du site sont des sous-ensembles
  latins, un emoji y sortirait en carré vide. Pastilles, jauges, médailles et
  avatars sont donc dessinés.
- **Chapitres bonus** : un numéro décimal (`246.5`, `23.25`) désigne une
  histoire annexe, pas un chapitre de l'histoire principale. Les cartes
  l'annoncent donc à part — « 246 chapitres (3 bonus) » — et une sortie bonus
  est signalée comme telle. Les compter ensemble laisserait croire que
  l'histoire est plus avancée qu'elle ne l'est. La règle vit dans
  `tools/build-og.py` (`est_bonus`, `compte_chapitres`), et compte sur la
  **liste réelle** des chapitres, pas sur le champ `chapters` de `series.js`
  qui peut avoir pris du retard.
- **Ce qui est vrai sur ces cartes** : séries, numéros de chapitres, jours de
  parution, catégories du forum, membres et rôles de l'équipe (lus directement
  dans `equipe.html`), noms des rangs. Le sous-titre est la
  `<meta name="description">` réelle de la page.
  **Ce qui est illustratif, et ne peut pas ne pas l'être** : les pseudos des
  lecteurs (forum, classement) et l'avancement de lecture (bibliothèque), qui
  est propre à chaque visiteur. Le seul message attribué à un membre réel est
  une annonce de sortie — ce que la team publie effectivement.
- Chaque page prend un **trio de couvertures différent** en fond : sept cartes
  identiques au titre près se suivraient sinon dans un fil Discord.
- Les genres sont tous couverts, pas seulement les 8 déclarés au sitemap :
  l'edge function fabrique une page pour n'importe quel genre existant, et une
  carte manquante donnerait un partage cassé. `scripts/check.js` le vérifie.
- `manga.html` et `reader.html` gardent l'image générique par défaut, et c'est
  voulu : leur vraie carte (celle de la série) est posée par l'edge function.

### E. Notes de traduction → `js/data/notes.js`

Expliquer un jeu de mots intraduisible, une référence culturelle, un nom gardé
en japonais. C'est ce que les lecteurs réclament le plus à une team — et c'est,
accessoirement, **le seul texte original du site** : le reste, ce sont des
images, que Google ne peut pas lire. Trois lignes écrites sur un chapitre valent
plus, pour le référencement, que n'importe quel réglage technique.

Le fichier s'édite **à la main**, aucun outil ni étape de build :

```javascript
window.NOTES = {
  "Tougen Anki": {
    "247": {
      intro: "Un chapitre bavard, avec deux passages coriaces.",
      notes: [
        { page: 6, text: "« Oni » est gardé tel quel : « démon » renvoie à un imaginaire chrétien qui n'a rien à voir." },
        "Une note peut aussi s'écrire en simple texte, sans numéro de page."
      ]
    }
  }
};
```

- La clé de série doit être **identique** à l'`id` dans `series.js`, et le
  numéro de chapitre identique à celui affiché (`"247"`, `"246.5"`).
- Les notes apparaissent **en bas du chapitre**, dans l'écran de fin. Un
  chapitre sans notes n'affiche rien du tout — ni titre, ni « aucune note ».
- Elles sont aussi servies aux robots (pré-rendu de l'edge function), et l'`intro`
  enrichit la description du chapitre dans les résultats de recherche : sans
  elle, les ~540 chapitres partagent une phrase quasi identique.
- Après édition, relance `node scripts/build-seo.js` pour que les robots les
  voient (le site, lui, les affiche immédiatement).

### F. IndexNow (facultatif) → prévenir Bing dès la sortie

Un sitemap dit « voici mes URLs » ; il ne dit pas « celle-ci vient de sortir ».
IndexNow le dit, et Bing/Yandex indexent alors en quelques minutes. Google ne
participe pas au protocole : pour lui, c'est toujours le sitemap qui fait foi.

Pour l'activer, une seule chose à faire : ajouter dans **Netlify → Site
configuration → Environment variables** une variable `INDEXNOW_KEY` contenant
une chaîne aléatoire de 8 à 128 caractères (lettres, chiffres, tirets). Par
exemple :

```bash
node -e "console.log(require('crypto').randomUUID().replace(/-/g,''))"
```

Le build s'occupe du reste : il dépose le fichier de vérification à la racine et
signale les nouveautés. Sans la variable, l'étape est simplement sautée.

- Seuls sont signalés **les chapitres datés du jour** plus les pages qui les
  listent (accueil, catalogue, planning) — jamais les 562 URLs, ce qui serait
  du spam et se retournerait contre le site.
- Les déploiements de préversion sont ignorés (`CONTEXT != production`).
- Une panne d'IndexNow n'interrompt jamais le déploiement.

> Ceci ne concerne que les couvertures, éléments d'interface affichés petit.
> Les **pages de manga** restent converties par `tools/jpg-to-webp.py` en
> lossless, sans aucun redimensionnement ni retouche.

---

## 4 bis. L'atelier — avancement du prochain chapitre

Entre deux sorties, le lecteur ne voit rien bouger. « L'atelier » montre où en
est le chapitre en cours de fabrication, en 6 étapes :

**Pages trouvées → Clean → Traduction → Edit → Q-check → Sortie**

### A. Sans coder (interface web locale) — recommandé

Double-clic sur **`tools/Modifier-Atelier.bat`** (ou `node tools/atelier-server.js`),
puis <http://localhost:4601>. Une ligne par série, les 6 étapes cliquables :

- **un clic sur une étape** = c'est enregistré, et la date du jour est posée
  automatiquement (c'est elle qui alimente « dernier point d'étape il y a 2 j ») ;
- **« ▶ Étape suivante »** fait avancer d'un cran sans rien retaper, **« ◀ Reculer »**
  corrige une fausse manip ;
- **« ➕ Mettre à l'atelier »** part du numéro du chapitre suivant, deviné d'après
  `js/data/chapters.js` ;
- les champs *chapitre / sortie visée / note* se modifient sans changer la date ;
- **« 🗑️ Retirer de l'atelier »** enlève la jauge du site.

L'outil réécrit `js/data/atelier.js` proprement (même mise en forme qu'à la main,
séries dans l'ordre de `series.js`), après une **copie de sécurité** dans
`tools/.backups/` — et restaure l'ancien fichier si l'écriture produit quelque
chose d'illisible. Comme les deux autres outils, il n'écoute que sur `127.0.0.1`.

### B. À la main

Tout se pilote depuis **`js/data/atelier.js`** — un fichier, une ligne par série,
rien d'autre à toucher :

```js
window.ATELIER = {
  "Tougen Anki": { chapter: "250", step: "trad", updated: "2026-08-01", eta: "2026-08-07" },
  "Catenaccio":  { chapter: "57",  step: "pages", updated: "2026-07-28",
                   note: "Chapitre double côté japonais, on prend le temps." }
};
```

| Champ | Obligatoire | À quoi ça sert |
|---|---|---|
| clé | oui | l'`id` de la série, **exactement** comme dans `series.js` |
| `chapter` | oui | numéro(s) en fabrication : `"250"` ou `"45-46"` |
| `step` | oui | étape en cours : `pages`, `clean`, `trad`, `edit`, `qcheck`, `sortie` (ou 1 à 6) |
| `updated` | oui | date du dernier changement d'étape → « dernier point d'étape il y a 2 j » |
| `eta` | non | date de sortie visée → « visé pour demain », « visé pour le 7 août » |
| `note` | non | une phrase libre (retard, galère de raw, chapitre double…) |

Où ça s'affiche :

- **Fiche série** (`manga.html`) : le bloc complet, au-dessus de la liste des
  chapitres — c'est là que le lecteur se pose la question.
- **Planning** : la section **« À l'atelier »** rassemble toutes les séries en
  fabrication, et le calendrier hebdo affiche une mini-jauge sous chaque titre.
- **Accueil** : la mini-jauge apparaît sur la carte « Prochaines sorties » quand
  le chapitre annoncé dans `schedule.js` est **le même** que celui de l'atelier.

Bon à savoir :

- Une série **sans entrée** ici n'affiche simplement rien (aucun bloc vide).
- Une entrée calée sur `"sortie"` passe en vert, propose « Lire maintenant » puis
  **disparaît toute seule 3 jours** après sa date `updated`.
- `schedule.js` (les *dates*) et `atelier.js` (l'*avancement*) sont indépendants :
  tu peux n'utiliser que l'un des deux.

---

## 5. Forum — configuration (Supabase)

Le forum utilise **Supabase** : comptes **email / mot de passe**, catégories →
sujets → réponses, profils et modération. Gratuit, sans serveur à administrer.
Côté code, tout est déjà prêt — il reste 4 étapes (~10 min).

### 5.1 Créer le projet Supabase

1. Va sur <https://supabase.com> → *Start your project* → connecte-toi.
2. **New project** : nom (ex. `lanortrad`), un mot de passe de base de données
   (note-le), région **Europe (West)** de préférence. Crée.
3. Attends ~1 min que le projet démarre.

### 5.2 Installer la base de données

Menu de gauche → **SQL Editor** → **New query**, puis exécute dans l'ordre :

1. Tout le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Tu dois voir « Success ». (Crée les tables, la sécurité RLS, les triggers et
   les 5 catégories de départ.)
2. **(Réactions + notifications + mentions)**
   [`supabase/forum-reactions-notifications.sql`](supabase/forum-reactions-notifications.sql).
   Sans ce script, le forum marche, mais les 👍 / 🔔 / @mentions seront inactifs.
3. **(Profils enrichis : sexe, âge, lectures, genres préférés)** Si ta base a été
   créée avant cette fonctionnalité, lance
   [`supabase/forum-profile-fields.sql`](supabase/forum-profile-fields.sql).
   *(Une installation neuve via `schema.sql` les inclut déjà.)*
4. **(Photos de profil)** [`supabase/storage-avatars.sql`](supabase/storage-avatars.sql)
   crée le bucket public `avatars` et ses règles.

### 5.3 Récupérer les 2 clés

1. Menu → **Project Settings** (roue crantée) → **API**.
2. Copie **Project URL** (`https://abcd1234.supabase.co`) et la clé **anon public**
   (longue chaîne `eyJ...`).
3. Ouvre [`js/supabase-config.js`](js/supabase-config.js) et colle-les :
   ```js
   window.LT_SUPABASE = {
     url:     "https://abcd1234.supabase.co",
     anonKey: "eyJ...la clé anon..."
   };
   ```
   > La clé *anon* est **publique** par conception (elle vit dans le navigateur).
   > Ce sont les règles **RLS** de `schema.sql` qui protègent les données.
   > La clé `service_role`, elle, ne doit **JAMAIS** être mise ici.

### 5.4 Autoriser ton site (emails de confirmation)

1. Menu → **Authentication** → **URL Configuration**.
2. **Site URL** : l'adresse de ton site (ex. `https://lanortrad.netlify.app`).
3. **Redirect URLs** : la même URL + `…/forum.html`
   (en local, ajoute aussi `http://localhost:8779`).

C'est fini : ouvre `forum.html`, crée un compte, le forum est en ligne. 🎉

### 5.5 Devenir administrateur

Après ta 1re inscription, dans **SQL Editor** :
```sql
update public.profiles set role = 'admin' where username = 'TON_PSEUDO';
```
Un admin (ou `moderator`) peut **épingler**, **verrouiller** et **supprimer**
n'importe quel sujet / message.

### 5.6 Bon à savoir

- **Catégories** : Table Editor → `categories` (ajoute / réordonne via `position`,
  change l'emoji et la couleur `color`). Aucune ligne de code.
- **Emails** : quota gratuit limité. Pour un vrai trafic, configure un SMTP
  (Authentication → Emails) ou désactive la confirmation pour tester
  (Authentication → Providers → Email → *Confirm email* = off).
- **Modération** : l'inscription est ouverte → surveille les contenus. Bannis un
  membre via son `role` ou dans **Authentication → Users**.
- **Langue des emails** : Authentication → Email Templates.

---

## 6. Gamification (XP / niveaux)

Système d'engagement par **XP** lié au compte (le même que le forum, via Supabase).
Récompenses **cosmétiques + statut uniquement** — aucun avantage de lecture, la pub
reste active pour tous. Remplace l'ancien Premium payant (retiré).

### 6.1 Base de données (une seule fois)

Supabase → **SQL Editor** → colle et exécute, dans l'ordre :

1. `supabase/schema.sql` (si pas déjà fait — le forum / les comptes)
2. `supabase/forum-reactions-notifications.sql` (si pas déjà fait — table des réactions)
3. `supabase/gamification.sql` — ⚠️ **à ré-exécuter** si tu l'avais déjà collé : il a
   été enrichi (compteurs `reads_count`…, attribution **automatique** des succès).
   Idempotent, sans risque ; le rattrapage débloque les succès déjà mérités.
4. `supabase/gamification-triggers.sql` (XP des **réactions reçues**)
5. `supabase/leaderboard.sql` (le **classement** — `leaderboard_weekly`, `my_rank`)
6. `supabase/missions.sql` (les **missions hebdomadaires** — `weekly_missions`, `claim_mission`)
7. `supabase/cosmetics.sql` (les **cosmétiques** — couleur de pseudo, cadre d'avatar ;
   + la liste blanche `grant_client_achievement`)
8. `supabase/views.sql` (les **compteurs de lectures** — table `series_views` + `bump_view`)
9. `supabase/ratings.sql` (les **notes des lecteurs** — table `series_ratings`,
   vue publique `series_rating_stats`, RPC `rate_series` ; le widget « Ta note »
   de la fiche série et l'`aggregateRating` du JSON-LD ne s'activent qu'avec lui)
10. `supabase/sync.sql` (la **synchro multi-appareils** — progression de lecture
    `reading_progress` + suivis `user_follows`, RLS « ses lignes uniquement » ;
    pour les membres connectés, reprise et bibliothèque suivent d'un appareil à
    l'autre, règle « le plus récent gagne »)
11. `supabase/chapter-mood.sql` (les **réactions d'ambiance** « Ce chapitre t'a
    fait quoi ? » sur l'écran de fin — table `chapter_moods`, RPC `chapter_mood`
    + `set_chapter_mood` ; 1 réaction par membre et par chapitre, agrégat public)
12. `supabase/forum-polls.sql` (les **sondages du forum** — un sondage optionnel
    par sujet, créé avec lui ; RPC `create_poll` + `poll_for_topic` + `vote_poll` ;
    1 vote par membre, modifiable, votes anonymes, agrégat public)
13. `supabase/quiz.sql` (le **quiz de la semaine** sur la page Classement —
    5 questions en rotation hebdo, 1 tentative/membre, +10 XP par bonne réponse
    +25 si sans-faute ; les solutions restent côté serveur. Pour ajouter des
    questions : Table Editor → `quiz_questions`, mode d'emploi en tête du fichier)
14. `supabase/activity.sql` (le fil **« Ça bouge sur LanorTrad »** de l'accueil —
    RPC `recent_activity` : derniers commentaires, sujets du forum, succès
    débloqués, nouveaux membres ; uniquement des infos déjà publiques)
15. `supabase/podium.sql` (la **couronne 👑 du top 3** — RPC `podium_last_week` :
    les 3 meilleurs de la semaine passée portent une couronne la semaine
    suivante, sur le classement et le forum ; respecte `leaderboard_opt_out`)
16. `supabase/presence.sql` (**« X lecteurs en ce moment »** sur la fiche série et
    dans le lecteur — table `presence` + RPC `presence_ping`. Une ligne par
    onglet ouvert : identifiant tiré au hasard par le navigateur, série
    regardée, heure. Ni IP, ni identifiant de compte ; effacée au bout de deux
    minutes sans signe de vie. La RPC ne renvoie qu'un **nombre**, jamais une
    liste)
17. `supabase/diag.sql` (facultatif mais recommandé — la fonction `lt_diag()`
    qui permet à `diag.html` de répondre exactement, triggers compris. Voir § 10)

**Tu ne sais plus lesquels sont passés ?** Ouvre `/diag.html` sur le site : elle
te le dit script par script (§ 10).

Cela crée, de façon **idempotente** (ré-exécutable sans danger) :

- les colonnes `xp`, `streak`, `streak_best`, `last_active`, `streak_freeze_week`,
  `leaderboard_opt_out`, `equipped` sur `profiles` ;
- un **verrou** empêchant tout membre de modifier lui-même son XP / streak ;
- la fonction `level_from_xp()` — courbe `XP cumulé(N) = 20·N·(N−1)` ;
- la table-journal `xp_events` (idempotente par `(user, kind, ref)`) ;
- les tables `achievements` (catalogue) + `user_achievements` (obtentions) ;
- la fonction `award_xp(kind, ref)` — **le barème est côté serveur**, le client ne
  choisit jamais le montant (anti-triche : plafonds journaliers + idempotence) ;
- les règles RLS et le catalogue de succès de départ.

### 6.2 Barème appliqué par `award_xp`

| kind | XP | plafond/jour |
|------|----|--------------|
| `read` | 20 | 600 (30 chapitres) |
| `comment` | 5 | 25 |
| `forum` | 10 | 30 |
| `reaction` | 2 | 20 |
| `series_complete` | 100 | — (1×/série) |

Le **bonus de streak** (1re activité du jour) est ajouté automatiquement :
+10, puis +20 (3 j), +40 (7 j), +75 (30 j). Un **gel** tolère un jour manqué par
semaine. Fuseau de référence : `Europe/Paris`.

### 6.3 Vérifier

```sql
select public.level_from_xp(0),     -- 1
       public.level_from_xp(40),    -- 2
       public.level_from_xp(1800),  -- 10  (Flamme)
       public.level_from_xp(49000); -- 50  (Astre)
```

### 6.4 (Optionnel) Nettoyer l'ancien Premium côté Supabase

Le code Premium a été retiré du site, mais la base peut encore contenir les objets
créés par l'ancien `premium.sql`. Pour tout supprimer **définitivement**
(⚠️ irréversible — seulement si tu abandonnes bien le Premium) :

```sql
drop function if exists public.redeem_code(text);
drop function if exists public.premium_free_delay();
drop table if exists public.premium_chapters cascade;
drop table if exists public.premium_codes cascade;
alter table public.profiles drop column if exists premium_until;
-- Vider d'abord le bucket dans Storage, sinon la suppression échoue :
delete from storage.buckets where id = 'premium-chapters';
```

---

## 7. Visite guidée (tutoriels première visite)

À sa **première visite**, l'utilisateur est accueilli par une **visite guidée**
façon jeu vidéo : un projecteur éclaire tour à tour chaque fonctionnalité, avec
une petite carte d'explication et des boutons *Précédent / Suivant / Passer*.
Il existe **deux tutoriels** partageant le même moteur :

- **Accueil** (`index.html`) : bouton de lecture → menu de navigation (le vrai
  menu radial est ouvert pour présenter chaque page) → recherche → bibliothèque →
  forum & classement → thème → mode Fluidité.
- **Forum** (`forum.html`) : **création de compte** → catégories → publier /
  répondre → **les badges** (une légende montre les vrais badges de rôle
  *Admin / Modo* et les rangs *Aura* liés à l'XP) → notifications & profil.

Détails techniques :

- **Fichiers** : [`js/tour.js`](js/tour.js) (moteur générique, une config par
  page) + [`css/tour.css`](css/tour.css). Inclus sur `index.html` et `forum.html`.
- **Déclenchement** : automatique une seule fois par page, mémorisé dans
  `localStorage` (clés `lt-tour-v1` pour l'accueil, `lt-tour-forum-v1` pour le
  forum — **indépendants** : voir le tuto du forum même si on a déjà vu celui de
  l'accueil).
- **Rejouer** : lien en pied de page (« 🧭 Revoir la visite guidée » sur l'accueil,
  « 🧭 Revoir le tuto du forum » sur le forum), `?tour=1` dans l'URL, ou
  `LTtour.start()` dans la console.
- **Responsive** : chaque projecteur est calculé en direct avec
  `getBoundingClientRect()`, et la carte se replace automatiquement selon la place
  disponible → identique sur **téléphone, tablette, PC portable et PC**. Un
  élément absent (ex. bouton visible seulement une fois connecté) bascule
  proprement en étape centrée.
- **Réinitialiser** pour re-tester : `LTtour.reset()` (efface les deux clés) puis
  recharge.

---

## 7 bis. Mode hors ligne + mini-jeu « Oni Runner »

Quand la connexion tombe **en pleine navigation** (métro, ascenseur, forfait
épuisé), le site ne casse pas : il le dit, et il propose de patienter en jouant —
l'équivalent maison du dinosaure de Chrome.

**Ce que voit le lecteur**

1. **Bandeau « Connexion perdue »** en bas de l'écran (au-dessus du menu radial et
   du dock du lecteur, il ne bloque jamais la navigation) : il rappelle que les
   chapitres déjà lus restent lisibles, avec un bouton **🎮 Jouer** et une croix.
2. **Oni Runner** : un petit Oni court, **saute** les piles de tomes et **se
   baisse** sous les corbeaux. La vitesse augmente avec le score, le décor bascule
   en **mode nuit** tous les 700 points, et le **record** est gardé en local
   (`lt-oni-best`, parties comptées dans `lt-oni-plays`).
   Commandes : **Espace / ↑ / W** ou tape le haut de l'écran pour sauter,
   **↓ / S** ou tape le bas pour te baisser, **Échap** pour fermer.
   Le saut est plus court si tu relâches tôt (comme le dino).
3. **Retour de la connexion** : le bandeau devient vert. Si une partie est en
   cours, **elle n'est pas coupée** — un bandeau propose juste « Reprendre la
   lecture ».
4. **Page jamais visitée demandée hors ligne** : le service worker sert
   [`offline.html`](offline.html) (explications + liens + le jeu qui s'ouvre tout
   seul) au lieu de l'erreur du navigateur.

**Détails techniques**

- **Fichiers** : [`js/offline.js`](js/offline.js) (détection + jeu en canvas) et
  [`css/offline.css`](css/offline.css), inclus sur **toutes** les pages ;
  [`offline.html`](offline.html) pour le repli de navigation.
- **Détection** : événements `online` / `offline` du navigateur + `navigator.onLine`
  au chargement. Le message vert n'apparaît que si la connexion est réellement
  tombée pendant la visite.
- **Service worker** : `offline.html`, `css/offline.css` et `js/offline.js` sont
  **précachés** (sinon impossible d'aller les chercher au moment où on en a
  besoin). Le repli navigation est dans `sw.js` (`req.mode === "navigate"`).
  Toute modification de ces fichiers demande de **monter la version du cache**
  (`const CACHE = "lanortrad-vNN"` en haut de `sw.js`).
- **Performance** : le jeu suit le mode **Fluidité** — en `data-perf="lite"`,
  plus d'étoiles, de collines ni de poussière, et rendu en DPR 1. La partie se met
  en pause si l'onglet passe en arrière-plan.
- **Ouvrir le jeu à la demande** (hors panne) : `?jeu=1` dans l'URL, un bouton
  `data-play-offline` (il y en a un sur la page **404**), ou `LToffline.open()`
  dans la console. `LToffline.best()` rend le record.
- **Tester sans couper le wifi** : ouvre la console et lance
  `window.dispatchEvent(new Event("offline"))` (puis `"online"` pour le retour).
  Le repli `offline.html`, lui, ne se teste qu'**en ligne réelle** (le service
  worker est volontairement désactivé en local, cf. §1).

---

## 8. Déploiement

Le dossier `F:\LanorTrad-Test-Site` est autonome et prêt à déployer (Netlify :
glisser-déposer le dossier, ou pointer le dépôt dessus). `netlify.toml` est prêt
(cache des images, réécritures des adresses lisibles, edge function).

La commande de build enchaîne trois étapes :

```
node scripts/build-seo.js && node scripts/check.js && node scripts/test-og.mjs
```

Les deux dernières **font échouer le déploiement** si elles trouvent une
incohérence. C'est délibéré (voir § 8 bis).

---

### Déployer depuis ta machine (et pourquoi)

Netlify clone le dépôt à chaque déploiement dont le cache est froid. Le dépôt
pèse **15 Go de pages de chapitre** (28 Go avec l'historique) et le stade
`preparing repo` est **tué au bout de 30 minutes** : le déploiement échoue avant
même que la commande de build ne démarre. Ce n'est pas un accident de parcours,
ça se reproduit dès que Netlify perd son cache, et ça empire à chaque série.

On inverse donc : la machine qui possède déjà les fichiers les téléverse
elle-même. Netlify compare les empreintes et ne redemande que ce qu'il n'a pas —
un chapitre de plus, c'est vingt fichiers, pas quinze giga-octets.

**Une seule fois :**

```bash
npm install -g netlify-cli
```

Puis, **depuis ce dossier** :

```bash
py tools/deployer.py --connexion
```

Le navigateur s'ouvre pour l'authentification — c'est toi qui valides — puis le
dossier est relié au site.

> **Pourquoi passer par le script plutôt que taper `netlify login`.** La commande
> `netlify` n'est pas toujours visible depuis une console, même après un
> redémarrage : c'est arrivé sur cette machine alors que l'exécutable était bien
> installé et le `PATH` correct au registre. Le script ne dépend pas du `PATH` —
> il demande à npm où il range ses paquets globaux et appelle l'exécutable par
> son chemin complet. Une variable d'environnement capricieuse ne doit pas
> empêcher de publier un site.

**À chaque fois :**

```bash
py tools/deployer.py
```

ou double-clic sur `tools/Deployer.bat`. Le script rejoue exactement la chaîne de
`netlify.toml` — fichiers SEO, cohérence, tests du pré-rendu — **s'arrête net si
une vérification échoue**, téléverse, puis remet le dépôt dans son état d'origine.
`--essai` déploie sur une URL temporaire au lieu de la production.

> **Le piège que le script désamorce.** `build-seo.js` recible les adresses
> absolues sur le domaine réellement servi, qu'il lit dans la variable `URL`.
> Netlify la fournit, ta machine non. Sans elle, les pages partiraient en
> annonçant leurs vignettes sur `lanortrad.com`, qui ne sert pas encore le
> site : plus aucune image de partage sur Discord. Le script la pose
> (`LT_SITE_URL`, une seule ligne à changer le jour du basculement).

### Un déploiement qui n'est pas `lanortrad.com`

Les pages HTML portent le domaine de production **en dur** dans leur
`canonical`, leur `og:url` et leur `og:image`. Sur un déploiement de test, les
robots de partage iraient donc chercher la vignette sur un site qui n'existe pas
encore : Discord et X reçoivent un 404 et n'affichent **aucune image**, alors
que les fichiers sont bel et bien déployés.

`scripts/build-seo.js` **recible** donc ces adresses vers le domaine réellement
servi (`process.env.URL`), au build, dans les fichiers du déploiement — pas dans
le dépôt. Sur `lanortrad.com`, l'opération ne change rien.

Les pages servies par l'edge function (séries, chapitres, genres) n'ont jamais
eu le problème : elle construit ses adresses à partir de l'origine réelle de la
requête.

---

## 8 bis. Vérifications automatiques

Le site tient sur des fichiers générés et 14 000 images, et rien ne prévenait
quand les deux se désaccordaient : la page s'affichait quand même, vide ou à
moitié. Ça s'est produit — `js/data/notes.js` est devenu du JavaScript invalide,
`window.NOTES` n'existait plus, et plus **aucune** note de traduction ne
s'affichait nulle part. Le build le signalait sur une ligne, sans échouer.

```bash
node scripts/check.js
```

Ce qu'il regarde :

- les fichiers de `js/data/` sont-ils du JavaScript valide, et définissent-ils
  bien ce qu'on attend d'eux ;
- chaque chapitre déclaré a-t-il sa liste de pages, et le nombre annoncé
  correspond-il au nombre réel ;
- les pages, couvertures et variantes responsives sont-elles sur le disque ;
- les pages HTML référencent-elles des fichiers qui existent ;
- le service worker ne précache-t-il que des fichiers présents — **une seule**
  entrée fausse fait échouer `addAll()` en entier, donc plus de mode hors ligne
  du tout, sans le moindre message ;
- le sitemap déclare-t-il exactement les séries et chapitres des données ;
- la règle de slug est-elle la même dans le site et dans le sitemap.

Sortie `0` si tout va bien, `1` s'il y a une erreur. Les alertes (« signalé,
mais pas bloquant ») ne font pas échouer.

`.github/workflows/verifications.yml` rejoue le tout à chaque push, **sans
télécharger les 5,5 Go d'images** (checkout partiel). `check.js` annonce alors
les vérifications qu'il saute, plutôt que de les compter comme réussies : c'est
au build Netlify, où le dépôt est complet, que la présence des images est
vérifiée.

---

## 9. État actuel du site

- **Toutes les séries + oneshots** sont convertis en WebP (~5,5 Go, ~14 000 pages)
  et lisibles.
- Manifeste : **536 chapitres** sur 10 séries (régénéré par `tools/build-data.py`).
- Pages **Planning** (calendrier hebdo + « À l'atelier » + dernières sorties) et
  **Équipe** (membres réels) complètes.
- **L'atelier** : avancement du prochain chapitre en 6 étapes (§ 4 bis), visible
  sur la fiche série, le planning et l'accueil.
- **Forum** + **Gamification (XP / classement / missions / cosmétiques)** branchés
  sur Supabase.
- **Visite guidée** au premier passage (rejouable).
- **Hors ligne** : bandeau d'alerte + mini-jeu **Oni Runner** (façon dino Chrome)
  et page de repli `offline.html` quand une page non cachée est demandée.
- **PWA** : `manifest.json` + `sw.js` (lecture hors-ligne des chapitres déjà lus,
  cache images persistant entre les versions). Bouton « Lire hors connexion » dans
  le rail du lecteur : pré-télécharge le chapitre entier dans ce cache.
  Installable.
- **Adresses lisibles** : `/manga/tougen-anki/chapitre-240/` plutôt que
  `reader.html?manga=…&chapter=…` (§ 1). Réécritures Netlify, anciennes adresses
  toujours valables, `canonical` vers la nouvelle forme.
- **« X lecteurs en ce moment »** sur la fiche série et dans le lecteur
  (`js/presence.js`, `supabase/presence.sql`). Anonyme, oublié au bout de deux
  minutes, jamais affiché en dessous de 2 — le premier lecteur, c'est toi.
- **Vérifications automatiques** au déploiement et à chaque push (§ 8 bis).
- **Vignettes de partage partout** : une carte 1200 × 630 par série, par page
  et par genre (§ 4.D et 4.D bis) — plus aucune page ne partage l'image
  générique du site.
- **Chapitres officiels et bonus** : un numéro décimal (`246.5`) désigne une
  histoire annexe. Ce que le site annonce, c'est l'avancement de **l'histoire**
  — Tougen Anki 246, Ao No Exorcist 167, Tokyo Underworld 38 — et les bonus
  sont mentionnés à part sur la fiche. Le compte se fait sur la liste réelle
  des chapitres (`LT.chapCount`, js/core.js), pas sur le champ `chapters` de
  `series.js`, tenu à la main : les deux avaient déjà divergé. Même règle côté
  build (`scripts/build-seo.js`) et côté vignettes (`tools/build-og.py`), donc
  flux RSS, données structurées et cartes disent tous la même chose.
- **SEO** : sitemap **index** (un fichier par série, couvertures déclarées en
  `image:image`), `robots.txt`, flux RSS, données structurées JSON-LD
  (ComicSeries / Chapter / CollectionPage / BreadcrumbList) servies aux robots
  *sans* JS par l'edge function, vignettes de partage 1200×630, vrais 404 sur
  les URLs fantômes, et signalement **IndexNow** des nouveautés (voir ci-dessous).
- **Pré-rendu pour les robots** (`netlify/edge-functions/og.js`) : le site étant
  rendu côté navigateur, `/manga.html?id=…` et `/reader.html?…` sont des
  coquilles vides sans JavaScript. L'edge function injecte, **pour les robots
  seulement**, les vraies balises et un pré-rendu du contenu.

  <details><summary>Pourquoi ne pas servir des pages statiques à tout le monde ?</summary>

  Parce que les URLs sont en `?id=…`. Il n'existe donc qu'**un seul fichier**
  `manga.html` pour toutes les séries, et un fichier statique ne peut pas
  contenir dix contenus différents. Les URLs propres (`/manga/tougen-anki/`) ne
  sont pas un bonus du pré-rendu statique : elles en sont la **condition**.

  Servir le pré-rendu à tout le monde sans changer les URLs coûterait +32 Ko par
  page (et un passage par l'edge function à chaque visite) pour un contenu que
  **personne ne voit** : le `.loader` est un calque opaque plein écran jusqu'à ce
  que le JS ait fini.

  Google ne recommande plus le *dynamic rendering*, mais ne le sanctionne pas
  tant que le contenu servi aux robots correspond à celui des visiteurs — ce qui
  est le cas ici, aucun texte ne leur est réservé. Le seul vrai risque est
  **qu'un robot manque à la liste** : elle est en tête de `og.js` et couverte par
  16 cas de test dans `scripts/test-og.mjs`. La tenir à jour prend cinq minutes.
  </details>

  Les **robots d'IA** (GPTBot, ClaudeBot, PerplexityBot…) en sont volontairement
  absents : leur donner le contenu pré-rendu est un choix éditorial sur du
  scantrad, pas une décision technique. Un test vérifie qu'ils restent exclus,
  pour que l'ajout soit forcément délibéré.
- **Vues par genre** : `catalogue.html?genre=Horreur` est une page à part
  entière — titre, description, `canonical` et liste pré-rendue pour les robots
  — parce que « manga d'horreur en français » est une requête réelle. C'est le
  filtre existant qui gagne une URL, pas une page de plus à maintenir.
  Le sitemap ne déclare que les genres portant **au moins 2 séries** : en
  déclarer un qui n'en a qu'une créerait une page quasi vide, que Google traite
  en « contenu pauvre ». Le seuil est dans `scripts/build-seo.js`.
  Les URL pardonnent accents et majuscules (`?genre=mystere` fonctionne) et le
  `canonical` renvoie toujours vers la forme unique.
- **Analytics** : Google Analytics (chargé uniquement en production **et** après
  consentement). Avec lui vient `js/vitals.js`, qui relève les **Core Web Vitals
  réels** (LCP, CLS, INP) chez les vrais visiteurs et les envoie en un seul
  événement `web_vitals` au départ de la page, avec le type de page et le tier
  de fluidité. C'est ce que Lighthouse ne peut pas dire : ce que vit un lecteur
  sur un vieux téléphone en 4G. Le fichier n'est pas téléchargé si le
  consentement est refusé.
- **Accessibilité / confort** : thèmes Sombre / OLED / Clair, mode **Fluidité**
  (léger) pour les appareils modestes, `prefers-reduced-motion` respecté.
- **Aucun script tiers** : `supabase-js` et `JSZip` venaient de jsDelivr et
  cdnjs, à qui le navigateur de chaque visiteur signalait donc sa visite. Ils
  sont désormais dans **`js/vendor/`**, avec leur numéro de version dans le nom
  du fichier (donc cache d'un an). `script-src` n'autorise plus que `'self'` et
  `googletagmanager`, qui n'intervient qu'après consentement.
  **Mettre à jour une bibliothèque** = déposer le nouveau fichier versionné dans
  `js/vendor/`, puis changer la référence (les `<script>` des pages pour
  supabase-js, `loadJSZip()` dans `js/reader.js` pour JSZip).
  JSZip (95 Ko) n'est d'ailleurs plus chargé qu'**au clic** sur « Télécharger le
  chapitre » : inutile de le faire payer à tous les lecteurs.
- **`supabase-js` chargé à la demande** (212 Ko). Sur la fiche série, le lecteur
  et la bibliothèque, il ne sert qu'aux visiteurs **connectés** : synchroniser la
  progression, gagner de l'XP, poser une note. Un visiteur anonyme — donc la
  quasi-totalité du trafic venu de Google — ne le télécharge plus du tout.
  Savoir si quelqu'un est connecté ne demande pas la bibliothèque : supabase-js
  range sa session dans `localStorage` (clé `sb-<ref>-auth-token`), et
  `core.js` se contente de regarder si la clé existe. Si oui, il charge les
  212 Ko **et retarde le démarrage** jusqu'à ce qu'ils soient là — sans quoi
  `sync.js`, `xp.js` et `ratings.js`, qui appellent `LTsb()` dès `lt:ready` et
  se contentent silencieusement d'un `null`, cesseraient de fonctionner sans le
  moindre message. Un garde-fou de 2,5 s évite qu'un fichier qui ne répond pas
  bloque la page.
  **`forum.html` et `classement.html` gardent leur `<script>`** : chez eux la
  bibliothèque sert à *afficher* le contenu, pas à l'enrichir.
- **Préchargement spéculatif** (`js/core.js`, `wireSpeculation`) : au survol d'un
  lien, le navigateur va chercher la page suivante. La fiche série est
  **pré-rendue** (page construite entièrement), le reste est simplement
  **préchargé** (document seul, sans exécuter son JS, donc sans effet de bord).
  Désactivé en mode Fluidité et quand l'économiseur de données est actif.
  Les actions qui laissent une trace (marquer une série vue, compter une
  lecture) passent par `LT.whenActive()` et attendent l'ouverture réelle : un
  survol ne doit jamais gonfler un compteur public.

---

## 10. Diagnostic — quels scripts SQL sont déployés ?

Le site est fait pour **dégrader en silence** : une brique dont le SQL n'est pas
passé ne casse rien, elle se cache. C'est ce qu'il faut pour un lecteur, mais
côté team ça veut dire qu'on ne peut pas savoir, en regardant le site, ce qui
est réellement en place. Il y a **17 scripts**.

Ouvre **`/diag.html`** (page en `noindex`, hors sitemap, interdite dans
`robots.txt`). Elle donne, script par script : son état, ce qu'il active, et
pour ceux qui manquent un bouton qui **copie le SQL** — prêt à coller dans
Supabase → SQL Editor.

Toutes les vérifications sont en **lecture seule**. Les fonctions qui écrivent
(`bump_view`, `rate_series`, `claim_mission`…) ne sont jamais appelées : on
interroge la table ou la fonction de lecture qui les accompagne.

### Pourquoi `supabase/diag.sql`

Deux choses échappent à l'API, et pas qu'un peu : un **trigger** ne s'y expose
pas, et une fonction dont l'accès client est volontairement fermé répond
« inconnue » — exactement comme si elle n'existait pas. C'est tout
`gamification-triggers.sql`.

`supabase/diag.sql` installe `lt_diag()`, qui répond depuis l'intérieur de la
base sur une liste d'objets **écrite en dur** (aucune donnée, aucune exploration
de schéma). La page l'utilise dès qu'elle existe ; sinon elle le dit franchement
plutôt que d'afficher un « à déployer » qu'elle ne peut pas prouver.
