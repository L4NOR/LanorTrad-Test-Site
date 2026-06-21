/* =========================================================================
   LanorTrad — Configuration des notifications push (Web Push).
   ⚙️  À REMPLIR : colle ici ta CLÉ PUBLIQUE VAPID.
       Génère la paire de clés avec :  npx web-push generate-vapid-keys
       • "Public Key"  → ici (vapidPublicKey)  — peut être publique/committée.
       • "Private Key" → variable d'env Netlify VAPID_PRIVATE (JAMAIS ici).
   Voir PUSH-SETUP.md pour le guide complet.
   ========================================================================= */
window.LT_PUSH = {
  vapidPublicKey: "VOTRE_CLE_PUBLIQUE_VAPID"
};
