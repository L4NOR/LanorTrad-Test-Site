/* =========================================================================
   LanorTrad — Page Premium : compte Supabase + activation par code.
   Le Premium est lié au compte (profiles.premium_until) et donne accès aux
   chapitres en avance (protégés par la RLS Storage). Ici : connexion,
   rédemption du code (RPC redeem_code) et espace membre. Voir PREMIUM-SETUP.md.
   ========================================================================= */
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const sb = () => (window.LTsb ? window.LTsb() : null);

  async function init() {
    if (window.LTpremium) { try { await window.LTpremium.refresh(); } catch {} }
    render();
    // render() lit seulement le statut → pas de nouvelle validation → pas de boucle
    document.addEventListener("lt:premium", render);
  }

  // Revalide le statut auprès de Supabase puis met à jour l'UI (après une action).
  async function revalidate() {
    if (window.LTpremium) { try { await window.LTpremium.refresh(); } catch {} }
    render();
  }

  async function render() {
    const memberBox = $("member-box"), buyBox = $("buy-box");
    if (!memberBox || !buyBox) return;
    const st = window.LTpremium ? window.LTpremium.status() : { active: false, until: null };
    memberBox.style.display = st.active ? "" : "none";
    buyBox.style.display = st.active ? "none" : "";
    if (st.active) wireMember(st);
    else await wireBuy();
  }

  /* ---------------- Membre Premium actif ---------------- */
  function wireMember(st) {
    const exp = $("prem-expiry");
    if (exp) exp.textContent = st.until
      ? "Premium actif jusqu'au " + new Date(st.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) + "."
      : "";

    const aurum = $("btn-aurum");
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
    const off = $("btn-off");
    if (off && !off.dataset.w) {
      off.dataset.w = "1";
      off.textContent = "Se déconnecter";
      off.addEventListener("click", async () => {
        const c = sb(); if (c) { try { await c.auth.signOut(); } catch {} }
        window.LT.toast("Déconnecté");
        revalidate();
      });
    }
  }

  /* ---------------- Non premium : connexion puis code ---------------- */
  async function wireBuy() {
    const box = $("code-box");
    if (!box) return;
    const c = sb();
    if (!c) { box.innerHTML = `<h3>Déjà membre ?</h3><div class="code-msg err">Service indisponible (Supabase non configuré).</div>`; return; }
    let session = null;
    try { session = (await c.auth.getSession()).data.session; } catch {}
    session ? renderRedeem(box, c) : renderAuth(box, c);
  }

  function renderRedeem(box, c) {
    box.innerHTML = `
      <h3>Activer votre abonnement</h3>
      <p>Entrez le code reçu après votre paiement pour débloquer vos avantages Premium.</p>
      <form class="code-form" id="code-form">
        <input type="text" id="code-input" placeholder="VOTRE-CODE" autocomplete="off" aria-label="Code Premium">
        <button class="btn btn-premium" type="submit">Activer</button>
      </form>
      <div class="code-msg" id="code-msg"></div>
      <button class="btn btn-ghost" id="prem-signout" style="margin-top:14px">Se déconnecter</button>`;
    $("prem-signout").addEventListener("click", async () => { try { await c.auth.signOut(); } catch {} revalidate(); });
    $("code-form").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("code-msg");
      const code = ($("code-input").value || "").trim().toUpperCase();
      if (!code) return;
      msg.className = "code-msg"; msg.textContent = "Vérification…";
      const { data, error } = await c.rpc("redeem_code", { p_code: code });
      if (error) { msg.className = "code-msg err"; msg.textContent = traduire(error.message); return; }
      msg.className = "code-msg ok"; msg.textContent = "Premium activé ✦ Merci pour votre soutien !";
      window.LT.toast("Premium activé ✦");
      revalidate();
    });
  }

  function renderAuth(box, c) {
    box.innerHTML = `
      <h3>Connexion</h3>
      <p>Le Premium est lié à votre compte LanorTrad (le même que le forum). Connectez-vous, puis entrez votre code.</p>
      <form class="code-form prem-auth" id="auth-form">
        <input type="email" id="auth-email" placeholder="Email" autocomplete="email" required>
        <input type="password" id="auth-pass" placeholder="Mot de passe (6 caractères min.)" autocomplete="current-password" required minlength="6">
        <input type="text" id="auth-user" placeholder="Pseudo public" autocomplete="username" minlength="3" maxlength="24" style="display:none">
        <button class="btn btn-premium" type="submit" id="auth-submit">Se connecter</button>
      </form>
      <div class="code-msg" id="auth-msg"></div>
      <button class="btn btn-ghost" id="auth-toggle" style="margin-top:14px">Pas encore de compte ? Créer un compte</button>`;
    let mode = "login";
    const userInput = $("auth-user"), submit = $("auth-submit"), toggle = $("auth-toggle");
    toggle.addEventListener("click", () => {
      mode = mode === "login" ? "signup" : "login";
      userInput.style.display = mode === "signup" ? "" : "none";
      submit.textContent = mode === "signup" ? "Créer mon compte" : "Se connecter";
      toggle.textContent = mode === "signup" ? "Déjà un compte ? Se connecter" : "Pas encore de compte ? Créer un compte";
    });
    $("auth-form").addEventListener("submit", async e => {
      e.preventDefault();
      const msg = $("auth-msg");
      const email = $("auth-email").value.trim(), pass = $("auth-pass").value;
      msg.className = "code-msg"; msg.textContent = "…";
      try {
        if (mode === "signup") {
          const username = userInput.value.trim();
          if (username.length < 3) { msg.className = "code-msg err"; msg.textContent = "Choisissez un pseudo (3 caractères min)."; return; }
          const { data, error } = await c.auth.signUp({ email, password: pass, options: { data: { username }, emailRedirectTo: location.href.split("#")[0] } });
          if (error) { msg.className = "code-msg err"; msg.textContent = traduire(error.message); return; }
          if (!data.session) { msg.className = "code-msg ok"; msg.textContent = "Compte créé ! Confirmez via l'email reçu, puis revenez activer votre code."; return; }
        } else {
          const { error } = await c.auth.signInWithPassword({ email, password: pass });
          if (error) { msg.className = "code-msg err"; msg.textContent = traduire(error.message); return; }
        }
        revalidate();
      } catch (err) { msg.className = "code-msg err"; msg.textContent = traduire(err.message); }
    });
  }

  function traduire(m) {
    m = String(m || "");
    if (/Invalid login credentials/i.test(m)) return "Email ou mot de passe incorrect.";
    if (/already registered|already exists/i.test(m)) return "Cet email a déjà un compte.";
    if (/Password should be/i.test(m)) return "Mot de passe trop court (6 caractères min.).";
    if (/rate limit|too many/i.test(m)) return "Trop de tentatives, réessayez plus tard.";
    return m; // les messages de redeem_code sont déjà en français
  }

  document.addEventListener("lt:ready", init);
})();
