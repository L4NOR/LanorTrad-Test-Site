/* =========================================================================
   LanorTrad — Enregistre un abonnement push (Netlify Function).
   Le navigateur POSTe ici son abonnement ; on l'écrit dans Supabase via la
   clé service_role (qui contourne la RLS — donc à garder SECRÈTE côté serveur).
   Variables d'env Netlify requises :
     SUPABASE_URL           = https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE  = la clé "service_role" (Settings → API)
   ========================================================================= */
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE;
  if (!url || !key) return { statusCode: 500, body: JSON.stringify({ error: "Supabase non configuré (env)" }) };

  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "bad json" }; }
  if (!b.endpoint || !b.p256dh || !b.auth) return { statusCode: 400, body: JSON.stringify({ error: "champs manquants" }) };

  const res = await fetch(url + "/rest/v1/push_subscriptions?on_conflict=endpoint", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key, Authorization: "Bearer " + key,
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify({ endpoint: b.endpoint, p256dh: b.p256dh, auth: b.auth, user_id: b.user_id || null })
  });

  return {
    statusCode: res.ok ? 200 : 500,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: res.ok })
  };
};
