# Gamification (XP / niveaux) — guide de mise en service

Système d'engagement par **XP** lié au compte (le même que le forum, via Supabase).
Récompenses **cosmétiques + statut uniquement** — aucun avantage de lecture, la pub
reste active pour tous. Remplace l'ancien Premium payant (retiré).

> État : **tranche 1** — la base de données et la fonction d'attribution. Le
> branchement des gains (fin de chapitre, commentaires…), la page profil, le
> classement, les missions et les cosmétiques arrivent dans les tranches suivantes.

---

## 1. Base de données (une seule fois)

Supabase → **SQL Editor** → collez et exécutez, dans l'ordre :
1. `supabase/schema.sql` (si pas déjà fait — c'est le forum/les comptes)
2. `supabase/forum-reactions-notifications.sql` (si pas déjà fait — table des réactions)
3. `supabase/gamification.sql` — ⚠️ **à ré-exécuter** si tu l'avais déjà collé : il a
   été enrichi (compteurs `reads_count`…, attribution **automatique** des succès).
   Idempotent, sans risque ; le rattrapage débloque les succès déjà mérités.
4. `supabase/gamification-triggers.sql` (XP des **réactions reçues** — déclencheur)
5. `supabase/leaderboard.sql` (le **classement** — `leaderboard_weekly`, `my_rank`)
6. `supabase/missions.sql` (les **missions hebdomadaires** — `weekly_missions`, `claim_mission`)
7. `supabase/cosmetics.sql` (les **cosmétiques** — couleur de pseudo, cadre d'avatar ;
   + la liste blanche `grant_client_achievement` pour les succès détectés côté site)
8. `supabase/views.sql` (les **compteurs de lectures** — table `series_views` + `bump_view` ;
   indépendant, alimente « X lectures » et la section Tendances)
9. `supabase/push.sql` (les **abonnements aux notifications push** — table
   `push_subscriptions` + `save/delete_push_subscription` ; bloc 4)

Cela crée, de façon **idempotente** (ré-exécutable sans danger) :
- les colonnes `xp`, `streak`, `streak_best`, `last_active`, `streak_freeze_week`,
  `leaderboard_opt_out`, `equipped` sur `profiles` ;
- un **verrou** empêchant tout membre de modifier lui-même son XP/streak ;
- la fonction `level_from_xp()` — courbe `XP cumulé(N) = 20·N·(N−1)` ;
- la table-journal `xp_events` (idempotente par `(user, kind, ref)`) ;
- les tables `achievements` (catalogue) + `user_achievements` (obtentions) ;
- la fonction `award_xp(kind, ref)` — **le barème est côté serveur**, le client ne
  choisit jamais le montant (anti-triche : plafonds journaliers + idempotence) ;
- les règles RLS et le catalogue de succès de départ.

### Barème appliqué par `award_xp`
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

---

## 2. (Optionnel) Nettoyer l'ancien Premium côté Supabase

Le code Premium a été retiré du site, mais votre base peut encore contenir les
objets créés par l'ancien `premium.sql`. Pour tout supprimer **définitivement**
(⚠️ irréversible — ne le faites que si vous abandonnez bien le Premium) :

```sql
-- Fonctions + tables de codes / chapitres en avance
drop function if exists public.redeem_code(text);
drop function if exists public.premium_free_delay();
drop table if exists public.premium_chapters cascade;
drop table if exists public.premium_codes cascade;

-- Colonne de statut premium sur les profils
alter table public.profiles drop column if exists premium_until;

-- Bucket privé des chapitres en avance (le vider d'abord dans Storage,
-- sinon la suppression échoue s'il contient des objets)
delete from storage.buckets where id = 'premium-chapters';
```

---

## 3. Vérifier

Après avoir exécuté `gamification.sql`, testez la courbe et la fonction :

```sql
select public.level_from_xp(0),    -- 1
       public.level_from_xp(40),   -- 2
       public.level_from_xp(1800), -- 10  (Flamme)
       public.level_from_xp(49000);-- 50  (Astre)

-- Simuler un gain (en étant connecté côté API ; en SQL Editor auth.uid() est nul,
-- c'est normal — le vrai test se fera depuis le site en tranche 2).
```

---

## Notes
- L'attribution automatique des **succès** et l'**XP des réactions reçues**
  (déclencheur) arrivent en tranche 5.
- L'historique de lecture devient **côté serveur** (`xp_events`) → permettra la
  synchro multi-appareils plus tard.
- Les agrégats du **classement** passeront par une vue/fonction dédiée en tranche 4
  (pour ne pas exposer le détail des événements des autres membres).

---

## Notifications push (bloc 4) — mise en service

Prévient les lecteurs (via une notif navigateur) quand une série qu'ils suivent
sort un chapitre. Envoi **manuel** depuis `admin.html`.

### 1. Générer les clés VAPID
```
npx web-push generate-vapid-keys
```
- **Public Key** → dans `js/supabase-config.js` (`window.LT_VAPID_PUBLIC`). Déjà fait.
- **Private Key** → NE PAS committer ; elle va en variable d'env Netlify (ci-dessous).

### 2. Déployer le SQL
SQL Editor → coller `supabase/push.sql` (table `push_subscriptions` + RPC).

### 3. Variables d'environnement Netlify
Site settings → Environment variables → ajouter :

| Variable | Valeur |
|---|---|
| `VAPID_PUBLIC` | la clé **publique** VAPID (même que `LT_VAPID_PUBLIC`) |
| `VAPID_PRIVATE` | la clé **privée** VAPID (⚠️ secrète) |
| `VAPID_SUBJECT` | `mailto:lanortradprofessionnel@gmail.com` |
| `SUPABASE_URL` | l'URL du projet Supabase |
| `SUPABASE_SERVICE_ROLE` | la clé **service_role** (⚠️ secrète, `sb_secret_…`) |
| `PUSH_SECRET` | un mot de passe **fort** (protège l'envoi) |

*(Ce sont les noms que tu as déjà sur Netlify. Le code accepte aussi les anciens
noms `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `SUPABASE_SERVICE_KEY` / `ADMIN_SECRET`
en repli, mais inutile d'y toucher.)*

Netlify installe `web-push` automatiquement (via `package.json`) et déploie
`netlify/functions/notify.js`. (La clé publique VAPID est exclue du scan de secrets
dans `netlify.toml` — c'est normal, elle est publique.)

### 4. Envoyer
- Les lecteurs cliquent **« 🔔 Être prévenu des sorties »** sur la Bibliothèque
  (le bouton n'apparaît qu'une fois la clé publique en place).
- Toi : va sur **`/admin.html`**, choisis la série + le n° de chapitre, entre le
  `ADMIN_SECRET`, clique **Envoyer**. La notif part aux abonnés qui suivent la série.
