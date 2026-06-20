/* =========================================================================
   LanorTrad — Forum communautaire (comptes maison via Supabase).
   Comptes email/mot de passe (sans GitHub), catégories → sujets → réponses,
   profils, modération. Tout le rendu est échappé (anti-XSS). RLS = sécurité.
   ⚙️  CONFIG : js/supabase-config.js   ·   BASE : supabase/schema.sql
   ========================================================================= */
(function () {
  "use strict";

  const LT      = window.LT || {};
  const el      = LT.el || (h => { const t = document.createElement("template"); t.innerHTML = h.trim(); return t.content.firstChild; });
  const toast   = LT.toast || (m => alert(m));
  const timeAgo = LT.timeAgo || (d => new Date(d).toLocaleDateString("fr-FR"));
  const rescan  = () => LT._scanReveals && LT._scanReveals();

  const CFG = window.LT_SUPABASE || {};
  let sb = null, me = null, profile = null, booted = false;

  /* ---------- Client Supabase (null si non configuré) ---------- */
  function client() {
    if (sb) return sb;
    const ok = window.supabase && CFG.url && CFG.anonKey && !/VOTRE_|YOUR_/i.test(CFG.url + CFG.anonKey);
    if (!ok) return null;
    sb = window.supabase.createClient(CFG.url, CFG.anonKey);
    return sb;
  }

  /* ---------- Helpers ---------- */
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  // Rendu sûr d'un message : échappe tout, conserve les sauts de ligne,
  // transforme les URLs en liens (sur du texte DÉJÀ échappé).
  function richBody(s) {
    return esc(s)
      .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener nofollow">$1</a>')
      .replace(/\n/g, "<br>");
  }

  function avatar(p, size = 40) {
    const name = (p && p.username) || "?";
    if (p && p.avatar_url) return `<img class="fo-av" src="${esc(p.avatar_url)}" alt="" style="width:${size}px;height:${size}px">`;
    const initials = name.slice(0, 2).toUpperCase();
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return `<span class="fo-av" style="width:${size}px;height:${size}px;font-size:${size * .38}px;background:linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 50) % 360} 70% 45%))">${esc(initials)}</span>`;
  }

  const roleBadge = r =>
    r === "admin"     ? '<span class="fo-role admin">Admin</span>' :
    r === "moderator" ? '<span class="fo-role mod">Modo</span>'    : "";

  const isStaff = () => profile && (profile.role === "admin" || profile.role === "moderator");
  const canEdit = authorId => !!(me && (me.id === authorId || isStaff()));

  const app = () => document.getElementById("forum-app");
  const setBusy = on => { const a = app(); if (a) a.setAttribute("aria-busy", on ? "true" : "false"); };

  /* =======================================================================
     AUTH
     ===================================================================== */
  function renderBar() {
    const bar = document.getElementById("forum-bar");
    if (!bar) return;
    if (me && profile) {
      bar.innerHTML = `
        <a class="btn btn-primary btn-sm" href="#/new">+ Nouveau sujet</a>
        <div class="fo-user">
          ${avatar(profile, 34)}
          <span class="fo-uname">${esc(profile.username)}</span>${roleBadge(profile.role)}
          <button class="icon-btn" id="fo-logout" title="Se déconnecter" aria-label="Se déconnecter">⏻</button>
        </div>`;
      bar.querySelector("#fo-logout").addEventListener("click", doLogout);
    } else {
      bar.innerHTML = `
        <button class="btn btn-ghost btn-sm" data-auth="login">Connexion</button>
        <button class="btn btn-primary btn-sm" data-auth="signup">Créer un compte</button>`;
      bar.querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => openAuth(b.dataset.auth)));
    }
  }

  let authModal = null;
  function openAuth(mode = "login") {
    closeAuth();
    authModal = el(`
      <div class="fo-overlay" id="fo-overlay">
        <div class="fo-modal" role="dialog" aria-modal="true" aria-label="Connexion">
          <button class="fo-x" aria-label="Fermer">&times;</button>
          <div class="fo-tabs">
            <button data-mode="login"  class="${mode === "login" ? "on" : ""}">Connexion</button>
            <button data-mode="signup" class="${mode === "signup" ? "on" : ""}">Inscription</button>
          </div>
          <form class="fo-form" autocomplete="on">
            <label class="fav-field sup-only" hidden>
              <span>Pseudo</span>
              <input name="username" type="text" minlength="3" maxlength="24" placeholder="Votre pseudo public" autocomplete="username">
            </label>
            <label class="fav-field">
              <span>Email</span>
              <input name="email" type="email" required placeholder="vous@exemple.com" autocomplete="email">
            </label>
            <label class="fav-field">
              <span>Mot de passe</span>
              <input name="password" type="password" required minlength="6" placeholder="Au moins 6 caractères" autocomplete="current-password">
            </label>
            <p class="fo-msg" hidden></p>
            <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center"></button>
            <button class="fo-link" type="button" data-forgot hidden>Mot de passe oublié ?</button>
          </form>
        </div>
      </div>`);
    document.body.append(authModal);
    document.body.style.overflow = "hidden";

    const form = authModal.querySelector("form");
    const msg  = authModal.querySelector(".fo-msg");
    const setMode = m => {
      authModal.querySelectorAll(".fo-tabs button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
      authModal.querySelectorAll(".sup-only").forEach(n => n.hidden = m !== "signup");
      authModal.querySelector("[data-forgot]").hidden = m !== "login";
      form.querySelector("input[name=password]").autocomplete = m === "signup" ? "new-password" : "current-password";
      form.querySelector("button[type=submit]").textContent = m === "signup" ? "Créer mon compte" : "Se connecter";
      form.dataset.mode = m;
      msg.hidden = true;
    };
    setMode(mode);

    const showMsg = (t, ok = false) => { msg.textContent = t; msg.hidden = false; msg.classList.toggle("ok", ok); };
    authModal.querySelectorAll(".fo-tabs button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
    authModal.querySelector(".fo-x").addEventListener("click", closeAuth);
    authModal.addEventListener("click", e => { if (e.target === authModal) closeAuth(); });

    authModal.querySelector("[data-forgot]").addEventListener("click", async () => {
      const email = form.email.value.trim();
      if (!email) return showMsg("Entrez d'abord votre email ci-dessus.");
      const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: location.href.split("#")[0] + "#/" });
      showMsg(error ? error.message : "Email de réinitialisation envoyé ✓", !error);
    });

    form.addEventListener("submit", async e => {
      e.preventDefault();
      const c = client();
      const email = form.email.value.trim(), pass = form.password.value;
      const btn = form.querySelector("button[type=submit]");
      btn.disabled = true;
      try {
        if (form.dataset.mode === "signup") {
          const username = form.username.value.trim();
          if (username.length < 3) return showMsg("Choisissez un pseudo (3 caractères min).");
          const { data: taken } = await c.from("profiles").select("id").eq("username", username).maybeSingle();
          if (taken) return showMsg("Ce pseudo est déjà pris.");
          const { data, error } = await c.auth.signUp({
            email, password: pass,
            options: { data: { username }, emailRedirectTo: location.href.split("#")[0] + "#/" }
          });
          if (error) return showMsg(traduire(error.message));
          if (data.session) { closeAuth(); toast("Bienvenue " + username + " 🎉"); }
          else showMsg("Compte créé ✓ Vérifiez vos emails pour confirmer votre adresse.", true);
        } else {
          const { error } = await c.auth.signInWithPassword({ email, password: pass });
          if (error) return showMsg(traduire(error.message));
          closeAuth(); toast("Connecté ✓");
        }
      } finally { btn.disabled = false; }
    });

    setTimeout(() => form.querySelector(mode === "signup" ? "input[name=username]" : "input[name=email]").focus(), 60);
  }
  function closeAuth() { if (authModal) { authModal.remove(); authModal = null; document.body.style.overflow = ""; } }

  // Messages d'erreur Supabase → français
  function traduire(m) {
    if (/already registered|already exists/i.test(m)) return "Un compte existe déjà avec cet email.";
    if (/Invalid login/i.test(m))                     return "Email ou mot de passe incorrect.";
    if (/Email not confirmed/i.test(m))               return "Confirmez d'abord votre email (lien reçu par mail).";
    if (/at least 6|password should be/i.test(m))     return "Mot de passe trop court (6 caractères min).";
    return m;
  }

  async function doLogout() { await client().auth.signOut(); toast("Déconnecté"); }

  function requireAuth() {
    if (me) return true;
    openAuth("login");
    return false;
  }

  /* =======================================================================
     ROUTAGE  (#/  ·  #/c/<slug>  ·  #/t/<id>  ·  #/new[?cat=<slug>])
     ===================================================================== */
  function router() {
    if (!client() || !app()) return;
    const raw = location.hash.replace(/^#/, "") || "/";
    const [path, qs] = raw.split("?");
    const parts = path.split("/").filter(Boolean);
    const q = new URLSearchParams(qs || "");
    if (parts[0] === "c")   return viewCategory(parts[1]);
    if (parts[0] === "t")   return viewTopic(parts[1]);
    if (parts[0] === "new") return viewNewTopic(q.get("cat"));
    return viewHome();
  }

  function crumbs(items) {
    return `<nav class="fo-crumbs">` + items.map((it, i) =>
      i === items.length - 1
        ? `<span>${esc(it.label)}</span>`
        : `<a href="${it.href}">${esc(it.label)}</a><span class="sep">›</span>`
    ).join("") + `</nav>`;
  }
  const errBox = m => `<div class="fo-empty">⚠️ ${esc(m)}</div>`;

  /* ---------- Vue : liste des catégories (accueil) ---------- */
  async function viewHome() {
    setBusy(true);
    const c = client();
    const [{ data: cats, error }, { data: stats }] = await Promise.all([
      c.from("categories").select("*").order("position"),
      c.from("category_stats").select("*")
    ]);
    if (error) { app().innerHTML = errBox(error.message); setBusy(false); return; }
    const sById = Object.fromEntries((stats || []).map(s => [s.id, s]));
    app().innerHTML = `
      <div class="fo-cats">
        ${(cats || []).map(cat => {
          const st = sById[cat.id] || {};
          const n = st.topic_count || 0;
          return `
          <a class="fo-cat" data-reveal href="#/c/${esc(cat.slug)}" style="--cat:${esc(cat.color || "#a855f7")}">
            <span class="fo-cat-ico">${esc(cat.icon || "💬")}</span>
            <span class="fo-cat-main">
              <span class="fo-cat-name">${esc(cat.name)}</span>
              <span class="fo-cat-desc">${esc(cat.description || "")}</span>
              <span class="fo-cat-meta">${n} sujet${n > 1 ? "s" : ""}${st.last_activity ? " · dernier post " + timeAgo(st.last_activity) : ""}</span>
            </span>
            <span class="fo-cat-go">›</span>
          </a>`;
        }).join("")}
      </div>`;
    setBusy(false); rescan();
  }

  /* ---------- Vue : sujets d'une catégorie ---------- */
  async function viewCategory(slug) {
    setBusy(true);
    const c = client();
    const { data: cat } = await c.from("categories").select("*").eq("slug", slug).maybeSingle();
    if (!cat) { app().innerHTML = errBox("Catégorie introuvable."); setBusy(false); return; }
    const { data: topics, error } = await c.from("topics")
      .select("id,title,pinned,locked,reply_count,created_at,last_activity,author:profiles(username,avatar_url,role)")
      .eq("category_id", cat.id)
      .order("pinned", { ascending: false })
      .order("last_activity", { ascending: false });
    if (error) { app().innerHTML = errBox(error.message); setBusy(false); return; }

    app().innerHTML = `
      ${crumbs([{ label: "Forum", href: "#/" }, { label: cat.name }])}
      <div class="fo-cathead" style="--cat:${esc(cat.color || "#a855f7")}">
        <span class="fo-cat-ico">${esc(cat.icon || "💬")}</span>
        <div class="fo-cathead-txt"><h2>${esc(cat.name)}</h2><p>${esc(cat.description || "")}</p></div>
        <a class="btn btn-primary btn-sm" href="#/new?cat=${esc(cat.slug)}">+ Nouveau sujet</a>
      </div>
      ${(topics && topics.length)
        ? `<div class="fo-topics">${topics.map(topicRow).join("")}</div>`
        : `<div class="fo-empty">Aucun sujet pour l'instant. Lancez la discussion !</div>`}`;
    setBusy(false); rescan();
  }

  function topicRow(t) {
    const a = t.author || {};
    const n = t.reply_count;
    return `
      <a class="fo-topic" data-reveal href="#/t/${t.id}">
        ${avatar(a, 42)}
        <span class="fo-topic-main">
          <span class="fo-topic-title">
            ${t.pinned ? '<span class="fo-tag pin">📌</span>' : ""}
            ${t.locked ? '<span class="fo-tag lock">🔒</span>' : ""}
            ${esc(t.title)}
          </span>
          <span class="fo-topic-meta">par ${esc(a.username || "?")}${roleBadge(a.role)} · ${timeAgo(t.created_at)}</span>
        </span>
        <span class="fo-topic-stat"><b>${n}</b><i>réponse${n > 1 ? "s" : ""}</i></span>
        <span class="fo-topic-last">${timeAgo(t.last_activity)}</span>
      </a>`;
  }

  /* ---------- Vue : un sujet (message d'origine + réponses) ---------- */
  async function viewTopic(id) {
    setBusy(true);
    const c = client();
    const { data: t, error } = await c.from("topics")
      .select("*, category:categories(slug,name), author:profiles(username,avatar_url,role)")
      .eq("id", id).maybeSingle();
    if (error || !t) { app().innerHTML = errBox("Sujet introuvable."); setBusy(false); return; }
    const { data: posts } = await c.from("posts")
      .select("*, author:profiles(username,avatar_url,role)")
      .eq("topic_id", id).order("created_at");

    const head = `
      ${crumbs([{ label: "Forum", href: "#/" }, { label: t.category.name, href: "#/c/" + t.category.slug }, { label: t.title }])}
      <div class="fo-topic-head">
        <h2>${t.pinned ? "📌 " : ""}${esc(t.title)}${t.locked ? ' <span class="fo-tag lock">🔒 Verrouillé</span>' : ""}</h2>
        ${isStaff() ? `<div class="fo-mod">
          <button data-mod="pin">${t.pinned ? "Désépingler" : "Épingler"}</button>
          <button data-mod="lock">${t.locked ? "Déverrouiller" : "Verrouiller"}</button>
        </div>` : ""}
      </div>`;

    const op = postCard({ id: "op", body: t.body, created_at: t.created_at, author: t.author, author_id: t.author_id }, true);
    const replies = (posts || []).map(p => postCard(p, false)).join("");

    const composer = t.locked
      ? `<div class="fo-empty">🔒 Ce sujet est verrouillé, on ne peut plus répondre.</div>`
      : me
        ? `<form class="fo-composer" id="fo-reply">
             <textarea name="body" rows="3" maxlength="10000" placeholder="Écrire une réponse…" required></textarea>
             <button class="btn btn-primary" type="submit">Répondre</button>
           </form>`
        : `<div class="fo-empty">Connectez-vous pour répondre. <button class="fo-link" data-auth="login">Connexion</button></div>`;

    app().innerHTML = head + `<div class="fo-posts">${op}${replies}</div>` + composer;
    wireTopic(t, id);
    setBusy(false); rescan();
  }

  function postCard(p, isOp) {
    const a = p.author || {};
    return `
      <article class="fo-post${isOp ? " op" : ""}" data-post="${isOp ? "op" : p.id}" data-reveal>
        <div class="fo-post-side">${avatar(a, 46)}<span class="fo-post-name">${esc(a.username || "?")}</span>${roleBadge(a.role)}</div>
        <div class="fo-post-body">
          <div class="fo-post-meta">${isOp ? "Auteur du sujet" : "A répondu"} · ${timeAgo(p.created_at)}
            ${canEdit(p.author_id) ? `<span class="fo-post-actions">
              <button data-act="edit">Modifier</button><button data-act="del">Supprimer</button>
            </span>` : ""}
          </div>
          <div class="fo-post-text" data-raw="${esc(p.body)}">${richBody(p.body)}</div>
        </div>
      </article>`;
  }

  function wireTopic(t, id) {
    const c = client();
    app().querySelectorAll("[data-auth]").forEach(b => b.addEventListener("click", () => openAuth(b.dataset.auth)));

    const reply = app().querySelector("#fo-reply");
    if (reply) reply.addEventListener("submit", async e => {
      e.preventDefault();
      if (!requireAuth()) return;
      const body = reply.body.value.trim();
      if (!body) return;
      reply.querySelector("button").disabled = true;
      const { error } = await c.from("posts").insert({ topic_id: t.id, author_id: me.id, body });
      if (error) { toast("Erreur : " + error.message); reply.querySelector("button").disabled = false; return; }
      viewTopic(id);
    });

    app().querySelectorAll("[data-mod]").forEach(b => b.addEventListener("click", async () => {
      const patch = b.dataset.mod === "pin" ? { pinned: !t.pinned } : { locked: !t.locked };
      const { error } = await c.from("topics").update(patch).eq("id", t.id);
      if (error) return toast("Erreur : " + error.message);
      viewTopic(id);
    }));

    app().querySelectorAll(".fo-post").forEach(card => {
      const pid = card.dataset.post;
      card.querySelector('[data-act="del"]')?.addEventListener("click", async () => {
        if (!confirm(pid === "op" ? "Supprimer ce sujet et toutes ses réponses ?" : "Supprimer ce message ?")) return;
        const res = pid === "op"
          ? await c.from("topics").delete().eq("id", t.id)
          : await c.from("posts").delete().eq("id", pid);
        if (res.error) return toast("Erreur : " + res.error.message);
        if (pid === "op") location.hash = "#/c/" + t.category.slug; else viewTopic(id);
      });
      card.querySelector('[data-act="edit"]')?.addEventListener("click", () => {
        const textEl = card.querySelector(".fo-post-text");
        const raw = textEl.dataset.raw || textEl.textContent;
        const ed = el(`<form class="fo-composer"><textarea rows="4" maxlength="10000">${esc(raw)}</textarea>
          <div style="display:flex;gap:8px"><button class="btn btn-primary" type="submit">Enregistrer</button>
          <button class="btn btn-ghost" type="button" data-cancel>Annuler</button></div></form>`);
        textEl.replaceWith(ed);
        ed.querySelector("[data-cancel]").addEventListener("click", () => viewTopic(id));
        ed.addEventListener("submit", async e => {
          e.preventDefault();
          const body = ed.querySelector("textarea").value.trim();
          if (!body) return;
          const res = pid === "op"
            ? await c.from("topics").update({ body }).eq("id", t.id)
            : await c.from("posts").update({ body }).eq("id", pid);
          if (res.error) return toast("Erreur : " + res.error.message);
          viewTopic(id);
        });
      });
    });
  }

  /* ---------- Vue : nouveau sujet ---------- */
  async function viewNewTopic(preselect) {
    if (!requireAuth()) { location.hash = "#/"; return; }
    setBusy(true);
    const c = client();
    const { data: cats } = await c.from("categories").select("*").order("position");
    const options = (cats || []).map(cat =>
      `<option value="${cat.id}" ${cat.slug === preselect ? "selected" : ""}>${esc(cat.icon || "")} ${esc(cat.name)}</option>`).join("");
    app().innerHTML = `
      ${crumbs([{ label: "Forum", href: "#/" }, { label: "Nouveau sujet" }])}
      <form class="fo-composer fo-newtopic" id="fo-new">
        <label class="fav-field"><span>Catégorie</span><select name="category">${options}</select></label>
        <label class="fav-field"><span>Titre</span><input name="title" type="text" minlength="3" maxlength="140" required placeholder="Titre de votre sujet"></label>
        <label class="fav-field"><span>Message</span><textarea name="body" rows="7" maxlength="10000" required placeholder="Développez votre sujet…"></textarea></label>
        <div style="display:flex;gap:10px">
          <button class="btn btn-primary" type="submit">Publier le sujet</button>
          <a class="btn btn-ghost" href="#/">Annuler</a>
        </div>
      </form>`;
    const form = app().querySelector("#fo-new");
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!requireAuth()) return;
      const payload = {
        category_id: Number(form.category.value),
        author_id: me.id,
        title: form.title.value.trim(),
        body: form.body.value.trim()
      };
      form.querySelector("button").disabled = true;
      const { data, error } = await c.from("topics").insert(payload).select("id").single();
      if (error) { toast("Erreur : " + error.message); form.querySelector("button").disabled = false; return; }
      toast("Sujet publié ✓");
      location.hash = "#/t/" + data.id;
    });
    setBusy(false); rescan();
  }

  /* =======================================================================
     SETUP (si Supabase pas encore configuré)
     ===================================================================== */
  function setupCard() {
    return `
      <div class="setup-card" data-reveal>
        <div class="setup-ico">🗨️</div>
        <h2>Forum bientôt en ligne</h2>
        <p>Le forum (comptes maison, sans GitHub) est prêt côté code. Pour l'activer (gratuit, ~10 min), configurez <b>Supabase</b> :</p>
        <ol class="setup-steps">
          <li>Créez un compte + projet sur <a href="https://supabase.com" target="_blank" rel="noopener">supabase.com</a>.</li>
          <li>SQL Editor → collez le contenu de <code>supabase/schema.sql</code> → Run.</li>
          <li>Project Settings → API → copiez <b>Project URL</b> et la clé <b>anon public</b>.</li>
          <li>Collez-les dans <code>js/supabase-config.js</code>.</li>
        </ol>
        <p class="setup-note">Le forum s'affichera alors ici, intégré au site, avec inscription par email — sans serveur à gérer.</p>
        <a class="btn btn-primary" href="https://supabase.com/dashboard" target="_blank" rel="noopener" style="position:relative">Ouvrir Supabase</a>
      </div>`;
  }

  /* =======================================================================
     BOOT
     ===================================================================== */
  function init() {
    const mount = document.getElementById("forum-mount");
    if (!mount || booted) return;
    booted = true;

    if (!client()) { mount.innerHTML = setupCard(); rescan(); return; }

    mount.innerHTML = `<div class="fo-bar" id="forum-bar"></div><div id="forum-app" class="fo-app" aria-busy="true"></div>`;
    renderBar();

    client().auth.onAuthStateChange((event, session) => {
      me = session ? session.user : null;
      if (event === "PASSWORD_RECOVERY") return promptNewPassword();
      // Reporté hors du callback : Supabase déconseille d'appeler ses propres
      // méthodes (await) directement dans onAuthStateChange (risque de blocage).
      setTimeout(() => { loadProfile().then(() => { renderBar(); router(); }); }, 0);
    });

    refreshSession();
    window.addEventListener("hashchange", router);
  }

  async function refreshSession() {
    const { data: { session } } = await client().auth.getSession();
    me = session ? session.user : null;
    await loadProfile();
    renderBar();
    router();
  }

  async function loadProfile() {
    profile = null;
    if (!me) return;
    const { data } = await client().from("profiles").select("id,username,avatar_url,role").eq("id", me.id).maybeSingle();
    profile = data || null;
  }

  function promptNewPassword() {
    const pw = prompt("Nouveau mot de passe (6 caractères min) :");
    if (!pw || pw.length < 6) return toast("Mot de passe trop court.");
    client().auth.updateUser({ password: pw }).then(({ error }) =>
      toast(error ? "Erreur : " + error.message : "Mot de passe mis à jour ✓"));
  }

  document.addEventListener("lt:ready", init);
  // Filet de sécurité : si le noyau a déjà émis "lt:ready" avant qu'on attache
  // l'écouteur (selon l'ordre de chargement), on initialise quand même.
  // _scanReveals n'existe qu'une fois le boot de core.js terminé.
  if (window.LT && window.LT._scanReveals) init();
})();
