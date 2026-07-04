/* =========================================================================
   LanorTrad — Notifications push (client) : abonnement via le service worker,
   stockage de l'abonnement dans Supabase (RPC REST). L'envoi se fait depuis une
   page admin + fonction Netlify (bloc serveur). Expose window.LTpush.
   Nécessite : supabase-config.js (LT_SUPABASE + LT_VAPID_PUBLIC), store.js (suivis).
   ========================================================================= */
(function () {
  "use strict";

  const cfg = () => window.LT_SUPABASE || {};
  const vapid = () => window.LT_VAPID_PUBLIC || "";
  function configured() {
    const c = cfg();
    return !!(c.url && c.anonKey) && !!vapid() && !/REMPLACER|VOTRE_|YOUR_/i.test(vapid());
  }
  function supported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }

  function urlB64ToUint8(base64) {
    const pad = "=".repeat((4 - (base64.length % 4)) % 4);
    const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
  }

  async function reg() {
    return (await navigator.serviceWorker.getRegistration()) ||
           (await navigator.serviceWorker.register("sw.js"));
  }
  async function currentSub() {
    if (!supported()) return null;
    const r = await reg();
    return r ? r.pushManager.getSubscription() : null;
  }
  async function isSubscribed() { return !!(await currentSub()); }

  function followedSeries() {
    try { return (window.LTstore && window.LTstore.follows()) || []; } catch { return []; }
  }

  async function rpc(fn, body) {
    const c = cfg();
    return fetch(`${c.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.anonKey, Authorization: "Bearer " + c.anonKey },
      body: JSON.stringify(body)
    });
  }
  async function store(sub) {
    const j = sub.toJSON();
    return rpc("save_push_subscription", {
      p_endpoint: sub.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_series: followedSeries()
    });
  }

  async function subscribe() {
    if (!supported()) return { ok: false, error: "unsupported" };
    if (!configured()) return { ok: false, error: "not_configured" };
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return { ok: false, error: "denied" };
    try {
      const r = await reg();
      const sub = await r.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8(vapid())
      });
      await store(sub);
      return { ok: true };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  }

  async function unsubscribe() {
    const sub = await currentSub();
    if (!sub) return { ok: true };
    try { await rpc("delete_push_subscription", { p_endpoint: sub.endpoint }); } catch {}
    try { await sub.unsubscribe(); } catch {}
    return { ok: true };
  }

  // Met à jour la liste des séries suivies rattachées à l'abonnement (si abonné).
  async function syncSeries() {
    if (!configured()) return;
    const sub = await currentSub();
    if (sub) { try { await store(sub); } catch {} }
  }

  window.LTpush = { supported, configured, isSubscribed, subscribe, unsubscribe, syncSeries };
})();
