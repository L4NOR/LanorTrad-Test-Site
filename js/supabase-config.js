/* =========================================================================
   LanorTrad — Configuration Supabase (forum + comptes).
   ⚙️  À REMPLIR : colle ici les 2 valeurs de ton projet Supabase.
       • url     = "Project URL"  → bouton vert "Connect" (en haut) OU
                   Settings → Data API.
       • anonKey = la "Publishable key" (sb_publishable_…) → Settings → API Keys.
                   (= remplaçante de l'ancienne clé "anon public" eyJ…, qui
                    reste dispo sous l'onglet "Legacy anon, service_role".)
   ℹ️  Cette clé est PUBLIQUE par conception (faite pour le navigateur) : ce sont
       les règles RLS (voir supabase/schema.sql) qui protègent les données. Tu
       peux donc la committer. ⚠️  NE METS JAMAIS la "Secret key" (sb_secret_…).
   ========================================================================= */
window.LT_SUPABASE = {
  url:     "https://orjhwwtyceouhxelcejq.supabase.co",   // ← Project URL
  anonKey: "sb_publishable_3Uo_f0zb5aQ70NLoZJ04mQ_4bu3bCns"               // ← clé "anon public"
};
