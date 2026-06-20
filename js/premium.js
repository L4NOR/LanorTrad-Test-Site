/* =========================================================================
   LanorTrad — Page Premium : activation par code (validé côté serveur via
   une Netlify Function) + gestion de l'espace membre. Voir PREMIUM-SETUP.md.
   ========================================================================= */
(function () {
  "use strict";
  const UNLOCK_URL = "/.netlify/functions/unlock"; // fonction déployée sur Netlify
  const PREVIEW_CODE = "DEMO2026";                  // code de test EN LOCAL uniquement

  function init() { renderState(); document.addEventListener("lt:premium", renderState); }

  function renderState() {
    const memberBox = document.getElementById("member-box");
    const buyBox = document.getElementById("buy-box");
    if (!memberBox || !buyBox) return;
    const on = window.LTpremium.isActive();
    memberBox.style.display = on ? "" : "none";
    buyBox.style.display = on ? "none" : "";
    on ? wireMember() : wireCode();
  }

  function wireCode() {
    const form = document.getElementById("code-form");
    if (!form || form.dataset.w) return; form.dataset.w = "1";
    const input = document.getElementById("code-input");
    const msg = document.getElementById("code-msg");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      const code = (input.value || "").trim().toUpperCase();
      if (!code) return;
      msg.className = "code-msg"; msg.textContent = "Vérification…";
      let ok = false, serverReached = false;
      try {
        const res = await fetch(UNLOCK_URL + "?code=" + encodeURIComponent(code));
        serverReached = res.ok || res.status === 403;
        if (res.ok) { const d = await res.json().catch(() => ({})); ok = d.valid === true; }
      } catch { /* fonction non déployée (ex : aperçu local) */ }
      if (!serverReached && code === PREVIEW_CODE) ok = true; // aperçu local
      if (ok) { window.LTpremium.set(true); msg.className = "code-msg ok"; msg.textContent = "Bienvenue, membre Premium ✦"; window.LT.toast("Premium activé ✦"); }
      else if (serverReached) { msg.className = "code-msg err"; msg.textContent = "Code invalide ou expiré."; }
      else { msg.className = "code-msg err"; msg.textContent = `Validation serveur indisponible. En local, testez avec « ${PREVIEW_CODE} ».`; }
    });
  }

  function wireMember() {
    const aurum = document.getElementById("btn-aurum");
    if (aurum && !aurum.dataset.w) {
      aurum.dataset.w = "1";
      const sync = () => { aurum.textContent = document.documentElement.getAttribute("data-theme") === "aurum" ? "Revenir au thème sombre" : "✦ Activer le thème Or"; };
      aurum.addEventListener("click", () => {
        const cur = document.documentElement.getAttribute("data-theme");
        const next = cur === "aurum" ? "dark" : "aurum";
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("lt-theme", next); } catch {}
        sync();
      });
      sync();
    }
    const off = document.getElementById("btn-off");
    if (off && !off.dataset.w) {
      off.dataset.w = "1";
      off.addEventListener("click", () => { window.LTpremium.set(false); window.LT.toast("Premium désactivé sur cet appareil"); });
    }
  }

  document.addEventListener("lt:ready", init);
})();
