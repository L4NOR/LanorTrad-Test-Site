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
4. [Ajouter une nouvelle série](#4-ajouter-une-nouvelle-série)
5. [Forum — configuration (Supabase)](#5-forum--configuration-supabase)
6. [Gamification (XP / niveaux)](#6-gamification-xp--niveaux)
7. [Visite guidée (tutoriel première visite)](#7-visite-guidée-tutoriel-première-visite)
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
        forum, classement, xp, views, perf, store, palette, tour
js/data/series.js     ← métadonnées des séries (À ÉDITER À LA MAIN)
js/data/chapters.js   ← pages par chapitre (GÉNÉRÉ, ne pas éditer)
images/ couvertures, logos, icônes
Manga/  <Série>/Chapitres/Chapitre NN/001.webp …
tools/build-data.py         ← scanner qui régénère chapters.js
tools/Ajouter-Chapitre.bat  ← interface web locale pour ajouter un chapitre
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
   *Prérequis : Node.js installé (déjà le cas sur ta machine).*
2. **Série** : choisis-la dans la liste (= dossiers de `/Manga`) ou tape un nom
   exact pour une nouvelle série.
3. **N° de chapitre** : ex. `19` (ou `138.5` pour un demi-chapitre).
4. **Pages** : glisse-dépose toutes les images du chapitre. Elles sont rangées
   **dans l'ordre du nom de fichier** (nomme-les `001`, `002`, … ou `01`, `02`).
5. Clique **Publier le chapitre**. L'outil :
   - crée `Manga/<Série>/Chapitres/Chapitre NN/`,
   - y range les pages renommées `001.jpg`, `002.jpg`, …,
   - régénère `js/data/chapters.js` (le catalogue lu par le lecteur).

> L'outil n'écoute que sur `127.0.0.1` (ta machine) : rien n'est exposé sur
> Internet.

### B. En ligne de commande (Python)

1. Copier les pages dans `Manga/<Série>/Chapitres/Chapitre NN/`
   (`001.jpg`, `002.jpg`, …).
2. Convertir en WebP : `py tools/jpg-to-webp.py "Manga/<Série>"`
   (puis supprimer les JPG).
3. Régénérer le manifeste : `py tools/build-data.py`
4. C'est tout — le lecteur et les fiches se mettent à jour automatiquement.

### Voir le résultat

- **En local** : recharge le site, le chapitre est lisible.
- **En ligne** (pour les visiteurs) : envoie les nouveaux fichiers sur ton
  hébergeur (les images de `Manga/…` **et** `js/data/chapters.js`). Avec Netlify +
  GitHub, un `git add . && git commit && git push` suffit.

---

## 4. Ajouter une nouvelle série

Pour une **nouvelle série**, en plus des chapitres :

1. Ajoute une entrée dans `js/data/series.js` (titre, couverture, genres, statut…).
   L'`id` doit être **identique** au nom du dossier dans `Manga/`.
2. Lance le scanner (`py tools/build-data.py`) ou publie un chapitre via l'outil
   web — la série apparaîtra alors au catalogue.

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
- **PWA** : `manifest.json` + `sw.js` (lecture hors-ligne des chapitres déjà lus).
  Installable.
- **SEO** : `sitemap.xml`, `robots.txt`, données structurées JSON-LD (ComicSeries).
- **Analytics** : Google Analytics + AdSense (chargés uniquement en production).
- **Accessibilité / confort** : thèmes Sombre / OLED / Clair, mode **Fluidité**
  (léger) pour les appareils modestes, `prefers-reduced-motion` respecté.
