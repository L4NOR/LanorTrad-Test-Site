# Mode Premium — guide de mise en service

Le Premium est **lié au compte** (le même que le forum, via Supabase) et donne :
- **Chapitres en avance** réellement verrouillés (voir plus bas) ;
- sans publicité, badge doré, thème « Or ».

Fonctionnement du verrouillage : les chapitres en avance sont stockés dans un
**bucket privé Supabase**. Une règle serveur (RLS) autorise la lecture d'un
chapitre **uniquement si** il a dépassé le délai gratuit **OU** si le membre est
premium. Le lecteur génère des liens signés courts. Impossible d'y accéder par
URL directe sans droit — et après le délai, le chapitre devient gratuit pour tous
**automatiquement**.

---

## 1. Base de données (une seule fois)

Supabase → **SQL Editor** → collez et exécutez, dans l'ordre :
1. `supabase/schema.sql` (si pas déjà fait — c'est le forum/les comptes)
2. `supabase/premium.sql`

Cela crée : la colonne `profiles.premium_until`, la table `premium_chapters`,
les codes `premium_codes` + la fonction `redeem_code()`, le bucket privé
`premium-chapters` et sa règle d'accès.

**Délai gratuit** : par défaut **7 jours**. Pour le changer, éditez la fonction
`premium_free_delay()` dans `supabase/premium.sql` **et** `freeDelayDays` dans
`js/data/premium-config.js` (les deux doivent être identiques).

## 2. La clé service_role (sur votre PC, jamais committée)

Les scripts d'upload ont besoin de la clé **service_role** (Supabase → Settings
→ API Keys → `service_role`). Définissez-la en variable d'environnement :

```
# Windows (PowerShell/cmd) — rouvrez le terminal ensuite
setx SUPABASE_SERVICE_KEY "sb_secret_..."
# bash
export SUPABASE_SERVICE_KEY="sb_secret_..."
```

⚠️ Ne la mettez **jamais** dans le code ni sur GitHub. La clé publique
(`sb_publishable_…`) reste, elle, dans `js/supabase-config.js` (c'est normal).

## 3. Le paiement

Créez une page de paiement (**Tipeee / Ko-fi / Patreon**) et remplacez les
`href="#"` des boutons `data-pay` dans `premium.html` par votre lien.

## 4. Donner l'accès à un membre (après paiement)

Créez-lui un code (Supabase → SQL Editor) :
```sql
insert into public.premium_codes (code, months) values ('LANOR-AB12', 1);
```
Le membre : se connecte sur `premium.html` (même compte que le forum) → entre son
code → `premium_until` est prolongé de `months` mois.

Pour tester sans code : `update public.profiles set premium_until = now() + interval '1 month' where username = 'TON_PSEUDO';`

---

## Publier un chapitre EN AVANCE

1. Convertissez les pages en WebP (comme d'habitude) et placez-les dans
   `Manga/<Série>/Premium/Chapitre <num>/` *(ce dossier est ignoré par git : il ne
   partira pas sur GitHub — c'est voulu)*.
2. Uploadez-le + enregistrez-le :
   ```
   py tools/premium-upload.py "<Série>" <num>
   ex : py tools/premium-upload.py "Tougen Anki" 167
   ```
3. C'est tout : le chapitre apparaît avec un cadenas ✦ pour les non-premium, et
   se débloque tout seul après le délai gratuit. (Rien à rebuild : la fiche et le
   lecteur lisent la liste depuis Supabase.)

## (Optionnel) Alléger Supabase quand un chapitre devient gratuit

Un chapitre devenu gratuit est toujours servi depuis Supabase (bande passante).
Pour le republier en statique sur Netlify et le retirer du bucket :
```
py tools/premium-promote.py            # promeut tout ce qui a dépassé le délai
py tools/premium-promote.py --dry-run  # aperçu sans rien changer
```
Puis committez/poussez les nouveaux chapitres publics (`git add/commit/push`).

---

## Sécurité — à savoir
- Le **contenu** (chapitres en avance) est protégé **côté serveur** (RLS) : c'est
  du vrai verrouillage, pas contournable par un drapeau local.
- Les avantages **cosmétiques** (sans-pub, badge, thème) suivent le vrai statut
  premium, mais restent pilotés côté navigateur : un petit malin peut se masquer
  ses propres pubs sans payer — sans aucune conséquence (aucun contenu en jeu).
- Un lien signé reste partageable jusqu'à son expiration (~2 h) : protection
  « souple », inhérente à tout accès anticipé.
