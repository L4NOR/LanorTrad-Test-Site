# Forum LanorTrad — Configuration (Supabase)

Le forum utilise **Supabase** : comptes **email / mot de passe** (sans GitHub),
catégories → sujets → réponses, profils et modération. Gratuit, sans serveur à
administrer. Côté code, tout est déjà prêt — il reste 4 étapes (~10 min).

---

## 1. Créer le projet Supabase
1. Va sur **https://supabase.com** → *Start your project* → connecte-toi.
2. **New project** : nom (ex. `lanortrad`), un mot de passe de base de données
   (note-le quelque part), région **Europe (West)** de préférence. Crée.
3. Attends ~1 min que le projet démarre.

## 2. Installer la base de données
1. Dans le projet : menu de gauche → **SQL Editor** → **New query**.
2. Copie **tout** le contenu de [`supabase/schema.sql`](supabase/schema.sql),
   colle-le, puis clique **Run**.
3. Tu dois voir « Success ». (Crée les tables, la sécurité RLS, les triggers et
   les 5 catégories de départ.)
4. **(Réactions + notifications + mentions)** Refais une **New query** et exécute
   aussi [`supabase/forum-reactions-notifications.sql`](supabase/forum-reactions-notifications.sql).
   Sans ce script, le forum marche, mais les 👍 / 🔔 / @mentions seront inactifs.
5. **(Profils enrichis : sexe, âge, lectures, genres préférés)** Si ta base a été
   créée avant cette fonctionnalité, lance une **New query** avec
   [`supabase/forum-profile-fields.sql`](supabase/forum-profile-fields.sql).
   Sans ce script, l'enregistrement du profil échouera (colonnes manquantes).
   *(Une installation neuve via `schema.sql` les inclut déjà : rien à faire.)*
6. **(Photos de profil)** Pour autoriser l'upload d'avatars, lance une **New query**
   avec [`supabase/storage-avatars.sql`](supabase/storage-avatars.sql). Il crée le
   bucket public `avatars` et ses règles. Sans lui, le champ « Photo de profil »
   affichera une erreur « bucket avatars créé ? » à l'enregistrement.

## 3. Récupérer les 2 clés
1. Menu de gauche → **Project Settings** (roue crantée) → **API**.
2. Copie :
   - **Project URL** → ex. `https://abcd1234.supabase.co`
   - clé **anon public** (longue chaîne `eyJ...`).
3. Ouvre [`js/supabase-config.js`](js/supabase-config.js) et colle ces 2 valeurs :
   ```js
   window.LT_SUPABASE = {
     url:     "https://abcd1234.supabase.co",
     anonKey: "eyJ...la clé anon..."
   };
   ```
   > La clé *anon* est **publique** par conception (elle vit dans le navigateur).
   > Ce sont les règles **RLS** de `schema.sql` qui protègent les données.
   > La clé `service_role`, elle, ne doit **JAMAIS** être mise ici.

## 4. Autoriser ton site (emails de confirmation)
1. Menu → **Authentication** → **URL Configuration**.
2. **Site URL** : l'adresse de ton site (ex. `https://lanortrad.netlify.app`).
3. **Redirect URLs** : ajoute la même URL + `https://lanortrad.netlify.app/forum.html`.
   (En local, ajoute aussi `http://localhost:8080` ou ton port.)

C'est fini : ouvre `forum.html`, crée un compte, le forum est en ligne. 🎉

---

## Devenir administrateur
Après ta 1re inscription, dans **SQL Editor** :
```sql
update public.profiles set role = 'admin' where username = 'TON_PSEUDO';
```
Un admin (ou `moderator`) peut **épingler**, **verrouiller** et **supprimer**
n'importe quel sujet/message.

## Gérer les catégories
Dans **Table Editor → categories** : ajoute / modifie / réordonne (`position`),
change l'icône (emoji) et la couleur (`color`, hex). Aucune ligne de code.

## Bon à savoir
- **Emails** : Supabase envoie les mails de confirmation / mot de passe oublié.
  Le quota gratuit est limité ; pour un vrai trafic, configure un SMTP
  (Authentication → Emails) ou désactive la confirmation pour tester
  (Authentication → Providers → Email → *Confirm email* = off).
- **Spam / modération** : l'inscription est ouverte → surveille les contenus.
  Tu peux bannir un membre en changeant son `role` ou en le supprimant dans
  **Authentication → Users**.
- **Langue des emails** : personnalisable dans Authentication → Email Templates.
