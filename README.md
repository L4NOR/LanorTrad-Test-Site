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
5. [Forum — configuration (Supabase)](#5-forum--configuration-supabase)
6. [Gamification (XP / niveaux)](#6-gamification-xp--niveaux)
7. [Visite guidée (tutoriel première visite)](#7-visite-guidée-tutoriels-première-visite)
   · [7 bis. Mode hors ligne + mini-jeu](#7-bis-mode-hors-ligne--mini-jeu--oni-runner-)
8. [Déploiement](#8-déploiement)
9. [État actuel du site](#9-état-actuel-du-site)

---

## 1. Structure du projet

```
index.html         Accueil (héros 3D, séries, derniers chapitres)
catalogue.html     Catalogue + filtres (genre, statut, type, tri)
manga.html         Fiche série (data-driven : ?id=Nom)
reader.html        Lecteur (?manga=Nom&chapter=N)
bibliotheque.html  Reprise de lecture (stockage local)
planning.html      Planning des sorties (calendrier hebdo)
forum.html         Forum communautaire (comptes Supabase)
classement.html    Classement XP / gamification
equipe.html        Équipe (membres réels)

css/    base, components, animations, home, catalogue, manga, reader, pages,
        extras, forum, classement, planning, perf, ambiance, tour
js/     core (shell), cards, tilt, hero, home, catalogue, manga, reader,
        forum, classement, xp, views, perf, store, palette, tour, offline
offline.html          ← page de repli hors ligne (avec le mini-jeu)
js/data/series.js     ← métadonnées des séries (à la main OU via Modifier-Series.bat)
js/data/chapters.js   ← pages par chapitre (GÉNÉRÉ, ne pas éditer)
images/ couvertures, logos, icônes
Manga/  <Série>/Chapitres/Chapitre NN/001.webp …
tools/build-data.py         ← scanner qui régénère chapters.js
tools/Ajouter-Chapitre.bat  ← interface web locale pour ajouter un chapitre
tools/Modifier-Series.bat   ← interface web locale pour éditer les fiches séries
supabase/*.sql              ← schémas Supabase (forum + gamification)
```

---

## 2. Aperçu en local

Servez le dossier avec le serveur de dev fourni (sans cache, depuis la racine) :

```
py serve.py
```

puis ouvrez <http://localhost:8779/> (ou `py -m http.server 8779` pour un serveur
minimal). En local, le service worker, Google Analytics et AdSense sont
automatiquement désactivés.

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
4. C'est tout — le lecteur et les fiches se mettent à jour automatiquement.

### Voir le résultat

- **En local** : recharge le site, le chapitre est lisible.
- **En ligne** (pour les visiteurs) : envoie les nouveaux fichiers sur ton
  hébergeur (les images de `Manga/…` **et** `js/data/chapters.js`). Avec Netlify +
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
   *Prérequis : Node.js. Les deux outils peuvent tourner en même temps
   (ports 4599 et 4600).*
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
(cache des images). Les IDs GA / AdSense sont ceux de l'ancien site.

---

## 9. État actuel du site

- **Toutes les séries + oneshots** sont convertis en WebP (~5,5 Go, ~14 000 pages)
  et lisibles.
- Manifeste : **536 chapitres** sur 10 séries (régénéré par `tools/build-data.py`).
- Pages **Planning** (calendrier hebdo + dernières sorties) et **Équipe** (membres
  réels) complètes.
- **Forum** + **Gamification (XP / classement / missions / cosmétiques)** branchés
  sur Supabase.
- **Visite guidée** au premier passage (rejouable).
- **Hors ligne** : bandeau d'alerte + mini-jeu **Oni Runner** (façon dino Chrome)
  et page de repli `offline.html` quand une page non cachée est demandée.
- **PWA** : `manifest.json` + `sw.js` (lecture hors-ligne des chapitres déjà lus,
  cache images persistant entre les versions). Bouton « Lire hors connexion » dans
  le rail du lecteur : pré-télécharge le chapitre entier dans ce cache.
  Installable.
- **SEO** : `sitemap.xml`, `robots.txt`, données structurées JSON-LD (ComicSeries).
- **Analytics** : Google Analytics + AdSense (chargés uniquement en production).
- **Accessibilité / confort** : thèmes Sombre / OLED / Clair, mode **Fluidité**
  (léger) pour les appareils modestes, `prefers-reduced-motion` respecté.
