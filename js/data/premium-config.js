/* =========================================================================
   LanorTrad — Configuration Premium (partagée reader / manga / premium).
   • bucket        : bucket privé Supabase Storage des chapitres en avance.
   • freeDelayDays : délai avant qu'un chapitre en avance devienne gratuit.
   ⚠️  freeDelayDays sert UNIQUEMENT à l'affichage (cadenas / compte à rebours).
       La vraie règle est côté serveur : premium_free_delay() dans
       supabase/premium.sql. Gardez les deux valeurs identiques.
   Convention de chemin d'un objet du bucket : <manga_id>/<chapter_num>/NNN.webp
   ========================================================================= */
window.LT_PREMIUM = {
  bucket: "premium-chapters",
  freeDelayDays: 7,
  signedUrlTTL: 7200   // durée de vie d'une signed URL (secondes)
};
