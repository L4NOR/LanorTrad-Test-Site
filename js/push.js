/* =========================================================================
   LanorTrad — Notifications push (côté navigateur).
   Ajoute une cloche 🔔 dans la barre de nav : active/désactive les
   notifications de sorties. L'abonnement est envoyé à la fonction Netlify
   /.netlify/functions/push-subscribe (qui l'enregistre dans Supabase).
   Ne s'affiche que si : push supporté + clé VAPID configurée + service worker
   enregistré (donc en ligne, pas en local sans HTTPS). Voir PUSH-SETUP.md.
   ========================================================================= */
(function () {
  "use strict";
  const CFG = window.LT_PUSH || {};
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const configured = CFG.vapidPublicKey && !/VOTRE_|YOUR_/i.test(CFG.vapidPublicKey);
  if (!supported || !configured) return;

  const toast = m => window.LT && window.LT.toast ? window.LT.toast(m) : 0;

  function b64ToU8(s) {
    const pad = "=".repeat((4 - (s.length % 4)) % 4);
    const b = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(b), a = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) a[i] = raw.charCodeAt(i);
    return a;
  }
  function bell(on) {
    return on
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 1 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1Z"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>`;
  }

  let btn;
  async function inject() {
    const right = document.querySelector(".nav-right");
    if (!right || document.getElementById("lt-push-btn")) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;                       // pas de SW (local) → pas de bouton
    btn = document.createElement("button");
    btn.id = "lt-push-btn"; btn.className = "icon-btn hide-mobile";
    btn.title = "Notifications de sorties"; btn.setAttribute("aria-label", "Notifications de sorties");
    btn.innerHTML = bell(false);
    right.insertBefore(btn, right.querySelector(".burger") || null);
    btn.addEventListener("click", toggle);
    refresh();
  }
  function setOn(on) {
    if (!btn) return;
    btn.classList.toggle("is-on", on);
    btn.innerHTML = bell(on);
    btn.title = on ? "Notifications activées (cliquer pour désactiver)" : "Activer les notifications de sorties";
  }
  async function refresh() {
    try { const reg = await navigator.serviceWorker.ready; setOn(!!(await reg.pushManager.getSubscription())); }
    catch { setOn(false); }
  }

  let busy = false;
  async function toggle() {
    if (busy) return; busy = true;
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
        setOn(false); toast("Notifications désactivées");
      } else {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") { toast("Autorise les notifications dans le navigateur."); return; }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(CFG.vapidPublicKey) });
        let userId = null;
        try {
          if (window.supabase && window.LT_SUPABASE) {
            const c = window.supabase.createClient(window.LT_SUPABASE.url, window.LT_SUPABASE.anonKey);
            const { data: { session } } = await c.auth.getSession();
            userId = session ? session.user.id : null;
          }
        } catch {}
        const j = sub.toJSON();
        const res = await fetch("/.netlify/functions/push-subscribe", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: userId })
        });
        if (!res.ok) throw new Error("save failed");
        setOn(true); toast("Notifications de sorties activées 🔔");
      }
    } catch (e) { toast("Notifications indisponibles ici."); }
    finally { busy = false; }
  }

  if (document.querySelector(".nav-right")) inject();
  else document.addEventListener("lt:ready", inject);
})();
