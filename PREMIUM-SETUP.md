# Mode Premium — guide de mise en service

Le **front-end est prêt** : page `premium.html`, bouton Premium dans la barre,
badge, masquage des pubs, thème « Or », et activation par **code**.

Ce qui marche déjà (sans rien faire) :
- La page Premium, les tarifs, le badge, le thème Or.
- L'activation par code en **aperçu local** : tapez le code `DEMO2026` pour
  tester l'expérience membre (sans pub + thème Or + badge).

## Pour que ce soit RÉEL en ligne (3 étapes)

### 1. Le paiement
Créez une page de paiement (au choix) : **Tipeee**, **Ko-fi** ou **Patreon**.
Puis dans `premium.html`, remplacez les `href="#"` des deux boutons
(`data-pay`) par le lien de votre page de paiement.

### 2. Les codes membres (validation serveur)
Le code est vérifié par une petite fonction serveur déjà écrite :
`netlify/functions/unlock.js`. Sur Netlify :
1. Déployez le dossier (la fonction est prise en compte via `netlify.toml`).
2. Site settings → **Environment variables** → ajoutez :
   `PREMIUM_CODES = LANOR-AB12, LANOR-CD34, ...` (les codes valides, séparés par des virgules).
3. Donnez un code à chaque membre après son paiement. Il l'entre sur `premium.html`.

> Astuce : générez un code par membre pour pouvoir en révoquer un (retirez-le de la liste).

### 3. (Optionnel) Les chapitres en avance — vrai verrouillage
C'est la partie la plus avancée. Principe :
- Stockez les chapitres « en avance » **hors** du dossier public (ils ne doivent pas
  être accessibles par URL directe).
- La fonction `unlock.js` (ou une seconde fonction) renvoie les images **seulement**
  si le code/membre est valide.
- Côté site, on affiche un cadenas « Premium » sur ces chapitres pour les non-membres.

Cette partie demande un peu de développement supplémentaire : dites-le-moi quand
vous serez prêt (paiement + Netlify en place) et je la branche.

## Sécurité — à savoir
L'activation locale stocke un drapeau sur l'appareil (comme les favoris). C'est
parfait pour « sans pub / badge / thème ». Le **vrai** verrouillage de contenu
(chapitres en avance) repose sur la fonction serveur + le stockage privé ci-dessus.
