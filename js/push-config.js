/* =========================================================================
   LanorTrad — Clé publique des notifications (Web Push / VAPID).

   ⚙️  À REMPLIR une seule fois. Génère la paire de clés avec :
           node scripts/push-keys.js
       • la clé PUBLIQUE se colle ici (elle est faite pour le navigateur) ;
       • la clé PRIVÉE se colle dans Netlify → Site settings → Environment
         variables, sous le nom VAPID_PRIVATE. Elle ne doit JAMAIS finir ici.

   Tant que `publicKey` est vide, le site se comporte comme avant : le bouton
   « Notifications » ne s'affiche pas du tout. Rien à désactiver ailleurs.

   `self` et pas `window` : ce fichier est lu par les pages ET par le service
   worker (sw.js l'importe pour pouvoir se réabonner tout seul), et dans un
   service worker `window` n'existe pas. Dans une page, `self` EST `window`.
   ========================================================================= */
self.LT_PUSH = {
  publicKey: "BKInRWytYCgFF3VDAywQA0pQwvHn9rtLXRfo60TEat0AGkf_XKdXwnwuXH7DPAkEljUGaE6ymdY4D0AvQ716dKQ"   // ← colle ici la clé publique (une longue chaîne en base64url)
};
