/* =========================================================================
   LanorTrad — Envoi d'une notification de sortie à tous les abonnés (Netlify).
   À appeler quand un nouveau chapitre est publié (voir PUSH-SETUP.md).
   POST JSON : { "secret": "...", "manga_id": "Tougen Anki", "chapter_num": "242", "title": "..." }
   Variables d'env Netlify requises :
     SUPABASE_URL, SUPABASE_SERVICE_ROLE
     VAPID_PUBLIC, VAPID_PRIVATE   (npx web-push generate-vapid-keys)
     VAPID_SUBJECT  (ex: mailto:lanortradprofessionnel@gmail.com)
     PUSH_SECRET    (un mot de passe que toi seul connais, pour autoriser l'envoi)
   ========================================================================= */
const webpush = require("web-push");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE, VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, PUSH_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE || !VAPID_PUBLIC || !VAPID_PRIVATE)
    return { statusCode: 500, body: JSON.stringify({ error: "Config manquante (env)" }) };

  let b;
  try { b = JSON.parse(event.body || "{}"); } catch { return { statusCode: 400, body: "bad json" }; }
  if (!PUSH_SECRET || b.secret !== PUSH_SECRET) return { statusCode: 403, body: JSON.stringify({ error: "secret invalide" }) };

  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:contact@lanortrad", VAPID_PUBLIC, VAPID_PRIVATE);

  const auth = { apikey: SUPABASE_SERVICE_ROLE, Authorization: "Bearer " + SUPABASE_SERVICE_ROLE };
  const r = await fetch(SUPABASE_URL + "/rest/v1/push_subscriptions?select=endpoint,p256dh,auth", { headers: auth });
  const subs = r.ok ? await r.json() : [];

  const payload = JSON.stringify({
    title: b.title || "Nouveau chapitre ! 📖",
    body: (b.manga_id || "Une série") + (b.chapter_num ? " — Chapitre " + b.chapter_num : "") + " est disponible.",
    url: b.manga_id
      ? "reader.html?manga=" + encodeURIComponent(b.manga_id) + (b.chapter_num ? "&chapter=" + encodeURIComponent(b.chapter_num) : "")
      : "index.html"
  });

  let sent = 0, pruned = 0;
  await Promise.all(subs.map(async s => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        pruned++;
        await fetch(SUPABASE_URL + "/rest/v1/push_subscriptions?endpoint=eq." + encodeURIComponent(s.endpoint), { method: "DELETE", headers: auth });
      }
    }
  }));

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ ok: true, total: subs.length, sent, pruned })
  };
};
