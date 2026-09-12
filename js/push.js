/* =========================================================================
   LanorTrad — Notifications de sortie (Web Push).

   CE QUE ÇA FAIT
   Le lecteur clique « Activer », le navigateur lui demande son accord, et à
   partir de là il reçoit une notification quand un chapitre sort — site fermé,
   navigateur fermé sur téléphone. Aucun compte, aucune adresse email : ce qui
   est enregistré, c'est l'adresse de push que son navigateur fabrique.

   TROIS CHOSES À SAVOIR (elles expliquent la moitié du code)
   1. On ne demande JAMAIS la permission tout seul. Une demande non sollicitée
      est refusée par réflexe, et un refus est DÉFINITIF : le navigateur ne
      reposera plus la question. D'où le panneau qui explique avant.
   2. Sur iPhone / iPad, le push n'existe QUE si le site a été ajouté à l'écran
      d'accueil (décision d'Apple, iOS 16.4+). On le détecte et on explique,
      plutôt que d'afficher un bouton qui ne marchera pas.
   3. Le service worker (sw.js) doit pouvoir décider quoi afficher alors
      qu'AUCUNE page n'est ouverte — il n'a donc pas accès à localStorage. On
      lui laisse un miroir de l'état dans le Cache API, qu'il sait lire.

   Chargé à la demande par js/core.js (clic sur la cloche) ou par la page
   Bibliothèque. La clé publique vit dans js/push-config.js.
   ========================================================================= */
(function () {
  "use strict";

  const CLE_LOCALE   = "lt-push-v1";        // état côté page
  const CACHE_MIROIR = "lanortrad-push";    // miroir lu par le service worker
  const URL_MIROIR   = "/lt-push-etat";     // clé interne du cache (pas un fichier réel)
  const CLE_FOLLOWS  = "lt-follows";        // la même que js/store.js

  /* --------------------------------------------------------------- Outils */
  const cfg = () => self.LT_PUSH || {};
  const T = (m) => (window.LT && window.LT.toast ? window.LT.toast(m) : null);

  const lire = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v === null ? d : v; } catch { return d; } };
  const ecrire = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const etatLocal = () => lire(CLE_LOCALE, { on: false, endpoint: "", tous: false });
  // Les suivis sont lus directement dans le stockage local plutôt que via
  // LTstore : ce fichier est chargé à la demande, y compris sur des pages qui
  // n'embarquent pas store.js. Même clé, même vérité.
  const suivis = () => { const f = lire(CLE_FOLLOWS, []); return Array.isArray(f) ? f : []; };

  // iPad récent : se présente comme un Mac, mais avec un écran tactile.
  const iOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
              (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const installe = () => (window.matchMedia && matchMedia("(display-mode: standalone)").matches) ||
                          navigator.standalone === true;

  // Meme regle que js/core.js : en local, le service worker est desinscrit
  // volontairement (sinon l'ancien CSS resterait servi depuis le cache). Sans
  // service worker, pas de push — autant le dire plutot que de laisser un
  // bouton tourner dans le vide.
  const enLocal = () => /^(localhost|127\.|0\.0\.0\.0|\[?::1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname) ||
                        /\.local$/.test(location.hostname);

  function supporte() {
    return !!(cfg().publicKey && "serviceWorker" in navigator && "PushManager" in window &&
              "Notification" in window && self.isSecureContext && !enLocal());
  }

  // La clé publique voyage en base64url ; l'API la veut en octets.
  function cleEnOctets(b64) {
    const p = "=".repeat((4 - (b64.length % 4)) % 4);
    const brut = atob((b64 + p).replace(/-/g, "+").replace(/_/g, "/"));
    const out = new Uint8Array(brut.length);
    for (let i = 0; i < brut.length; i++) out[i] = brut.charCodeAt(i);
    return out;
  }

  /* ------------------------------------------------------------- Supabase
     La table des abonnements est fermée au navigateur (RLS sans policy) : on
     passe par les fonctions de supabase/push.sql, seules portes ouvertes. */
  async function chargerSupabase() {
    if (window.LT_SUPABASE) return window.LT_SUPABASE;
    await new Promise((ok, ko) => {
      const s = document.createElement("script");
      // Chemin depuis la racine, et non relatif : ce fichier peut etre charge
      // depuis une adresse profonde (/manga/x/chapitre-12/, ou une page 404 sur
      // n'importe quelle URL). Un chemin relatif irait chercher le fichier a
      // cote de cette adresse-la.
      s.src = "/js/supabase-config.js"; s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    }).catch(() => {});
    return window.LT_SUPABASE;
  }

  async function rpc(nom, corps) {
    const c = await chargerSupabase();
    if (!c || !c.url || !c.anonKey) throw new Error("Supabase non configuré");
    const r = await fetch(c.url + "/rest/v1/rpc/" + nom, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: c.anonKey, Authorization: "Bearer " + c.anonKey },
      body: JSON.stringify(corps || {}),
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  }

  /* --------------------------------------------------------------- Miroir
     Ce que le service worker a le droit de savoir pour composer sa
     notification : les séries suivies, et la liste de ce qui a DÉJÀ été
     annoncé (sinon, au premier réveil, il annoncerait les 30 dernières
     sorties d'un coup). Le miroir est semé à l'abonnement avec l'état actuel
     du site : à partir de là, la différence est exacte. */
  async function ecrireMiroir(maj) {
    if (!window.caches) return;
    try {
      const c = await caches.open(CACHE_MIROIR);
      const actuel = await lireMiroir();
      const suite = Object.assign({ follows: [], tous: false, annonces: [] }, actuel || {}, maj);
      await c.put(URL_MIROIR, new Response(JSON.stringify(suite), { headers: { "Content-Type": "application/json" } }));
    } catch { /* navigation privée, quota : le SW retombera sur un message générique */ }
  }

  async function lireMiroir() {
    if (!window.caches) return null;
    try {
      const c = await caches.open(CACHE_MIROIR);
      const r = await c.match(URL_MIROIR);
      return r ? await r.json() : null;
    } catch { return null; }
  }

  // Signatures des sorties connues aujourd'hui : « je pars de cet état-là ».
  async function sortiesConnues() {
    try {
      const r = await fetch("/push/latest.json", { cache: "no-store" });
      if (!r.ok) return [];
      const j = await r.json();
      return (j.sorties || []).map(s => s.sig).filter(Boolean);
    } catch { return []; }
  }

  /* ------------------------------------------------------- Abonner / couper */
  async function abonner(tous) {
    if (!supporte()) throw new Error("non supporté");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error(perm === "denied" ? "refusé" : "ignoré");

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,                      // obligatoire : chaque push affiche quelque chose
        applicationServerKey: cleEnOctets(cfg().publicKey),
      });
    }
    const j = sub.toJSON();
    const f = tous ? [] : suivis();
    await rpc("push_subscribe", {
      p_endpoint: sub.endpoint,
      p_p256dh: (j.keys && j.keys.p256dh) || "",
      p_auth: (j.keys && j.keys.auth) || "",
      p_follows: f,
    });
    ecrire(CLE_LOCALE, { on: true, endpoint: sub.endpoint, tous: !!tous });
    await ecrireMiroir({ follows: f, tous: !!tous, annonces: await sortiesConnues() });
    return true;
  }

  async function couper() {
    const e = etatLocal();
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await rpc("push_unsubscribe", { p_endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      } else if (e.endpoint) {
        await rpc("push_unsubscribe", { p_endpoint: e.endpoint }).catch(() => {});
      }
    } catch { /* déjà parti */ }
    ecrire(CLE_LOCALE, { on: false, endpoint: "", tous: false });
    await ecrireMiroir({ follows: [], tous: false });
  }

  /* Les suivis ont changé → le serveur doit le savoir, sinon on réveille les
     gens pour des séries qu'ils ne lisent plus. Groupé : cocher 5 séries
     d'affilée ne fait qu'un appel. */
  let minuteur = 0;
  function replanifierSync() {
    const e = etatLocal();
    if (!e.on || e.tous) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return;
        await envoyerAbonnement(sub, false);
      } catch { /* réessayé à la prochaine visite */ }
    }, 1500);
  }

  async function envoyerAbonnement(sub, tous) {
    const j = sub.toJSON(), f = tous ? [] : suivis();
    await rpc("push_subscribe", {
      p_endpoint: sub.endpoint,
      p_p256dh: (j.keys && j.keys.p256dh) || "",
      p_auth: (j.keys && j.keys.auth) || "",
      p_follows: f,
    });
    ecrire(CLE_LOCALE, { on: true, endpoint: sub.endpoint, tous: !!tous });
    await ecrireMiroir({ follows: f, tous: !!tous });
  }

  /* Vérification au chargement : l'abonnement a-t-il survécu ? Un navigateur
     peut le révoquer (données du site effacées, permission retirée). Dans ce
     cas on nettoie l'état local, sinon l'interface ment. */
  async function verifier() {
    const e = etatLocal();
    if (!e.on || !supporte()) return;
    if (Notification.permission !== "granted") { ecrire(CLE_LOCALE, { on: false, endpoint: "", tous: false }); return; }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) { ecrire(CLE_LOCALE, { on: false, endpoint: "", tous: false }); return; }
      // Adresse renouvelée par le navigateur : on réenregistre la nouvelle.
      if (sub.endpoint !== e.endpoint) await envoyerAbonnement(sub, e.tous).catch(() => {});
    } catch { /* pas grave */ }
  }

  /* ------------------------------------------------------------- Panneau */
  function etatCourant() {
    if (!cfg().publicKey) return "absent";                 // clé pas encore posée par l'équipe
    if (iOS && !installe()) return "ios";
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return "impossible";
    if (enLocal()) return "local";
    if (!self.isSecureContext) return "impossible";
    if (Notification.permission === "denied") return "refuse";
    return etatLocal().on ? "actif" : "pret";
  }

  function corpsPanneau() {
    const st = etatCourant(), nb = suivis().length, e = etatLocal();
    if (st === "ios") return `
      <p class="push-p">Sur iPhone et iPad, Apple n'autorise les notifications que pour les sites
      <strong>ajoutés à l'écran d'accueil</strong>. C'est gratuit et ça prend 5 secondes :</p>
      <ol class="push-ol">
        <li>Appuie sur <strong>Partager</strong> (le carré avec une flèche, en bas de Safari).</li>
        <li>Choisis <strong>« Sur l'écran d'accueil »</strong>, puis <strong>Ajouter</strong>.</li>
        <li>Ouvre LanorTrad depuis cette nouvelle icône, et reviens ici. 🔔</li>
      </ol>`;
    if (st === "refuse") return `
      <p class="push-p">Les notifications ont été <strong>bloquées</strong> pour LanorTrad dans ce navigateur.
      Lui seul peut revenir en arrière :</p>
      <ol class="push-ol">
        <li>Clique sur le <strong>cadenas</strong> (ou l'icône à gauche de l'adresse du site).</li>
        <li>Cherche <strong>Notifications</strong> et remets sur <em>Autoriser</em> / <em>Demander</em>.</li>
        <li>Recharge la page, puis reviens ici.</li>
      </ol>`;
    if (st === "impossible") return `
      <p class="push-p">Ce navigateur ne sait pas recevoir de notifications
      (ou le site n'est pas ouvert en HTTPS). Tu peux suivre les sorties par le
      <a href="feed.xml">flux RSS</a> ou sur le Discord.</p>`;
    if (st === "absent") return `
      <p class="push-p">Les notifications ne sont pas encore ouvertes. Reviens bientôt !</p>`;
    if (st === "local") return `
      <p class="push-p">Aperçu local : le service worker est désactivé exprès ici
      (sinon l'ancien CSS resterait servi depuis le cache). Les notifications se
      testent sur le site en ligne.</p>`;

    const choix = `
      <div class="push-choix" role="radiogroup" aria-label="Ce dont tu veux être prévenu">
        <label class="push-opt">
          <input type="radio" name="push-quoi" value="suivis" ${!e.tous && nb ? "checked" : ""} ${nb ? "" : "disabled"}>
          <span><strong>Mes séries suivies</strong>
          <em>${nb ? nb + (nb > 1 ? " séries suivies" : " série suivie") + " — le ❤️ sur une fiche" : "aucune pour l'instant : mets un ❤️ sur une fiche série"}</em></span>
        </label>
        <label class="push-opt">
          <input type="radio" name="push-quoi" value="tous" ${e.tous || !nb ? "checked" : ""}>
          <span><strong>Toutes les sorties</strong><em>chaque nouveau chapitre, toutes séries confondues</em></span>
        </label>
      </div>`;

    if (st === "actif") return `
      <p class="push-p push-ok">✅ Les notifications sont <strong>activées sur cet appareil</strong>.</p>
      ${choix}
      <button type="button" class="btn btn-ghost push-go" data-push-act="maj">Enregistrer ce choix</button>
      <button type="button" class="push-off" data-push-act="off">Désactiver les notifications</button>`;

    return `
      <p class="push-p">Tu seras prévenu·e dès qu'un chapitre sort — même site fermé.
      Ni compte, ni adresse email : on n'enregistre que l'adresse que ton navigateur fabrique,
      et tu peux couper d'un clic.</p>
      ${choix}
      <button type="button" class="btn btn-primary push-go" data-push-act="on">Activer les notifications</button>`;
  }

  let panneau = null;
  function fermer() {
    if (!panneau) return;
    panneau.remove(); panneau = null;
    document.body.classList.remove("push-open");
    document.removeEventListener("keydown", surEchap);
  }
  function surEchap(e) { if (e.key === "Escape") fermer(); }

  function rendre() {
    if (!panneau) return;
    panneau.querySelector(".push-corps").innerHTML = corpsPanneau();
  }

  function ouvrir() {
    if (panneau) return;
    document.body.classList.add("push-open");
    panneau = document.createElement("div");
    panneau.className = "push-modal";
    panneau.innerHTML = `
      <div class="push-scrim" data-push-act="fermer"></div>
      <div class="push-box" role="dialog" aria-modal="true" aria-labelledby="push-titre">
        <button type="button" class="push-x" data-push-act="fermer" aria-label="Fermer">✕</button>
        <div class="push-cloche" aria-hidden="true">🔔</div>
        <h2 id="push-titre">Être prévenu des sorties</h2>
        <div class="push-corps">${corpsPanneau()}</div>
        <p class="push-note">Envoyé par ton navigateur, pas par mail. Tu peux revenir ici à tout moment pour couper.</p>
      </div>`;
    document.body.appendChild(panneau);
    const premier = panneau.querySelector(".push-go") || panneau.querySelector(".push-x");
    if (premier) premier.focus();

    panneau.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-push-act]");
      if (!b) return;
      const act = b.dataset.pushAct;
      if (act === "fermer") return fermer();
      const tous = !!panneau.querySelector('input[value="tous"]:checked');

      if (act === "off") {
        b.disabled = true;
        await couper();
        T("Notifications désactivées.");
        rendre(); majCloche();
        return;
      }
      if (act === "on" || act === "maj") {
        b.disabled = true; b.textContent = "Un instant…";
        try {
          await abonner(tous);
          T(tous ? "🔔 C'est bon : tu seras prévenu·e de chaque sortie."
                 : "🔔 C'est bon : tu seras prévenu·e pour tes séries suivies.");
          rendre(); majCloche();
          if (act === "on") setTimeout(fermer, 1400);
        } catch (err) {
          const m = String(err && err.message);
          T(m === "refusé" ? "Refusé par le navigateur — voir les explications."
            : m === "ignoré" ? "Demande fermée : rien n'a été activé."
            : "Échec de l'activation. Réessaie dans un instant.");
          rendre();
        }
      }
    });
    document.addEventListener("keydown", surEchap);
  }

  /* ------------------------------------- Cloche du menu + bannière biblio */
  function majCloche() {
    const b = document.querySelector('.rn-item[data-action="push"]');
    if (!b) return;
    const on = etatCourant() === "actif";
    const nom = on ? "Notifications : activées" : "Notifications";
    b.dataset.name = nom; b.setAttribute("aria-label", nom);
    b.classList.toggle("push-on", on);
  }

  /* Bannière discrète sur la Bibliothèque : c'est là que quelqu'un vient
     précisément pour ses séries suivies — le seul endroit où la proposition
     tombe au bon moment. Masquée une fois, elle ne revient pas. */
  function banniere() {
    const hote = document.getElementById("push-mount");
    if (!hote) return;
    const st = etatCourant();
    if (st === "actif" || st === "absent" || st === "impossible" || st === "local") return;
    if (lire("lt-push-banniere", null) === "non") return;
    hote.innerHTML = `
      <div class="push-bandeau">
        <span class="push-bandeau-ic" aria-hidden="true">🔔</span>
        <div class="push-bandeau-txt">
          <strong>Être prévenu·e quand un chapitre sort</strong>
          <span>Une notification sur cet appareil, même site fermé. Sans compte ni email.</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm" data-push-b="on">Activer</button>
        <button type="button" class="push-bandeau-x" data-push-b="non" aria-label="Masquer">✕</button>
      </div>`;
    hote.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-push-b]");
      if (!b) return;
      if (b.dataset.pushB === "non") { ecrire("lt-push-banniere", "non"); hote.innerHTML = ""; return; }
      ouvrir();
    });
  }

  /* --------------------------------------------------------------- Départ */
  window.LTpush = {
    supporte, ouvrir, fermer,
    etat: etatCourant,
    activer: abonner,
    desactiver: couper,
  };

  document.addEventListener("lt:store", replanifierSync);
  majCloche();
  banniere();
  verifier().then(majCloche);
})();
