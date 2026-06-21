# Notifications push de sorties — Configuration

Notifie tes lecteurs **même quand le site est fermé**, à chaque nouveau chapitre.
Ça nécessite un petit serveur (déjà écrit : 2 fonctions Netlify) + des clés VAPID.
Tout le code est prêt ; il reste la configuration (≈15 min) et un déploiement.

> ⚠️ Le push ne marche **qu'en ligne (HTTPS)**, pas en local. Teste sur le vrai site.
> Sur iPhone, l'utilisateur doit d'abord **installer le site sur l'écran d'accueil**.

---

## 1. Générer les clés VAPID
Dans un terminal (Node installé) :
```
npx web-push generate-vapid-keys
```
Ça affiche une **Public Key** et une **Private Key**. Garde-les sous la main.

## 2. Coller la clé publique dans le site
Ouvre [`js/push-config.js`](js/push-config.js) et colle la **Public Key** :
```js
window.LT_PUSH = { vapidPublicKey: "BPbN...la_public_key..." };
```
(La clé publique peut être committée. La privée, **jamais** — elle va dans Netlify.)

## 3. Base de données
Supabase → SQL Editor → New query → colle [`supabase/push.sql`](supabase/push.sql) → Run.

## 4. Variables d'environnement Netlify
Netlify → Site settings → **Environment variables** → ajoute :

| Variable | Valeur |
|---|---|
| `SUPABASE_URL` | `https://xxxx.supabase.co` (Supabase → Settings → API) |
| `SUPABASE_SERVICE_ROLE` | la clé **service_role** (Settings → API) — **secrète** |
| `VAPID_PUBLIC` | la Public Key de l'étape 1 |
| `VAPID_PRIVATE` | la Private Key de l'étape 1 — **secrète** |
| `VAPID_SUBJECT` | `mailto:lanortradprofessionnel@gmail.com` |
| `PUSH_SECRET` | un mot de passe au choix (pour autoriser l'envoi) |

## 5. Déployer
`git push` (Netlify installe `web-push` via `package.json` et publie les fonctions).

## 6. Tester
Ouvre le site en ligne → une **cloche 🔔** apparaît dans la barre → clique → autorise.
Tu es abonné. (La cloche n'apparaît pas en local : normal.)

## 7. Envoyer la notif quand un chapitre sort
« Activer la cloche » sur le site ne fait qu'**inscrire** les lecteurs. Cette
étape, c'est **l'envoi réel** : à refaire **à chaque nouveau chapitre**.

### ✅ Méthode simple (recommandée) — depuis l'outil d'ajout de chapitre
1. Dans `tools/`, copie `notify-config.example.json` en **`notify-config.json`**
   et remplis :
   ```json
   { "siteUrl": "https://ton-site.netlify.app", "pushSecret": "TON_PUSH_SECRET" }
   ```
   (Même `PUSH_SECRET` que dans les variables Netlify. Fichier local, jamais mis en ligne.)
2. Lance `tools/Ajouter-Chapitre.bat`. Une case **« 🔔 Notifier les abonnés de la
   sortie »** apparaît. Publie ton chapitre comme d'habitude : la notification
   part automatiquement. C'est tout.

### Méthode manuelle (alternative) — `curl`
```
curl -X POST https://TON-SITE.netlify.app/.netlify/functions/push-send ^
  -H "Content-Type: application/json" ^
  -d "{\"secret\":\"TON_SECRET\",\"manga_id\":\"Tougen Anki\",\"chapter_num\":\"242\"}"
```
Réponse : `{ "ok": true, "total": N, "sent": N, "pruned": 0 }`.
Tous les abonnés reçoivent la notification, et un clic ouvre le chapitre.

## Dépannage
- **Pas de cloche** : clé VAPID non remplie (étape 2) ou tu es en local.
- **`secret invalide`** : `PUSH_SECRET` ne correspond pas.
- **`Config manquante`** : une variable d'env Netlify manque (étape 4).
- **`sent: 0`** : personne n'est encore abonné, ou les abonnements ont expiré (`pruned`).
