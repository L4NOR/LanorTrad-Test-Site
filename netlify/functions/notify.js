/* =========================================================================
   LanorTrad — Fonction Netlify : envoi des notifications push (bloc 4).
   Déclenchée manuellement depuis admin.html. Envoie aux abonnés qui suivent
   la série. Protégée par ADMIN_SECRET.

   Variables d'environnement Netlify requises (Site settings → Environment) :
     VAPID_PUBLIC          — la clé publique VAPID (même que LT_VAPID_PUBLIC)
     VAPID_PRIVATE         — la clé privée VAPID (SECRÈTE)
     VAPID_SUBJECT         — une adresse de contact, ex "mailto:ton-email@exemple.com"
     SUPABASE_URL          — l'URL du projet Supabase
     SUPABASE_SERVICE_ROLE — la clé service_role (SECRÈTE, bypass RLS)
     PUSH_SECRET           — un mot de passe fort pour autoriser l'envoi
   (Les anciens noms VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / SUPABASE_SERVICE_KEY /
    ADMIN_SECRET restent acceptés en repli.)
   ========================================================================= */
const webpush = require("web-push");

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return resp(204, "");
  if (event.httpMethod !== "POST") return json(405, { error: "method_not_allowed" });

  let body;
  try { body = JSON.parse(event.body || "{}"); } catch { return json(400, { error: "bad_json" }); }

  const { admin_secret, manga_id, chapter, message } = body;
  const SECRET = process.env.PUSH_SECRET || process.env.ADMIN_SECRET;
  if (!SECRET || admin_secret !== SECRET)
    return json(401, { error: "unauthorized" });
  if (!manga_id) return json(400, { error: "manga_id_required" });

  const PUB = process.env.VAPID_PUBLIC || process.env.VAPID_PUBLIC_KEY;
  const PRIV = process.env.VAPID_PRIVATE || process.env.VAPID_PRIVATE_KEY;
  const SUBJECT = process.env.VAPID_SUBJECT || "mailto:contact@lanortrad.com";
  const SB_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
  const SB_KEY = process.env.SUPABASE_SERVICE_ROLE || process.env.SUPABASE_SERVICE_KEY;
  if (!PUB || !PRIV || !SB_URL || !SB_KEY) return json(500, { error: "server_not_configured" });

  webpush.setVapidDetails(SUBJECT, PUB, PRIV);

  // Abonnements suivant cette série (service_role → contourne la RLS).
  const filter = encodeURIComponent(`cs.{"${String(manga_id).replace(/"/g, '\\"')}"}`);
  const readUrl = `${SB_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth&series=${filter}`;
  let subs;
  try {
    const r = await fetch(readUrl, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
    if (!r.ok) return json(502, { error: "supabase_read", detail: await r.text() });
    subs = await r.json();
  } catch (e) { return json(502, { error: "supabase_unreachable", detail: String(e && e.message || e) }); }

  const chapTxt = chapter ? `chapitre ${chapter}` : "un nouveau chapitre";
  const payload = JSON.stringify({
    title: "LanorTrad — nouvelle sortie",
    body: message || `${manga_id} — ${chapTxt} est disponible !`,
    url: `reader.html?manga=${encodeURIComponent(manga_id)}${chapter ? "&chapter=" + encodeURIComponent(chapter) : ""}`,
    tag: `lanor-${manga_id}-${chapter || ""}`
  });

  let sent = 0;
  const gone = [];
  await Promise.all((subs || []).map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) gone.push(s.endpoint);
    }
  }));

  // Nettoie les abonnements expirés (410 Gone / 404).
  await Promise.all(gone.map(ep =>
    fetch(`${SB_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(ep)}`, {
      method: "DELETE", headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }
    }).catch(() => {})
  ));

  return json(200, { ok: true, sent, targeted: (subs || []).length, cleaned: gone.length });
};

function resp(status, bodyStr) {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS"
    },
    body: bodyStr
  };
}
function json(status, obj) { return resp(status, JSON.stringify(obj)); }
