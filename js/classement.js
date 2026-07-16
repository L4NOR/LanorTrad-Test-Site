/* =========================================================================
   LanorTrad — Classement : hebdomadaire (RPC leaderboard_weekly) + all-time
   (lecture directe de profiles). Rang perso via RPC my_rank. Tout échappé.
   Dépend de : core.js (window.LT, window.LTsb), xp.js (window.LTxp), supabase-js.
   ========================================================================= */
(function () {
  "use strict";

  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  function sb() { return (window.LTsb && window.LTsb()) || null; }

  function avatar(p, size = 42) {
    const name = (p && p.username) || "?";
    const fr = window.LTxp ? window.LTxp.frameClass(p && p.equipped) : "";
    if (p && p.avatar_url) return `<img class="lb-av${fr}" src="${esc(p.avatar_url)}" alt="" style="width:${size}px;height:${size}px">`;
    const initials = name.slice(0, 2).toUpperCase();
    const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
    return `<span class="lb-av${fr}" style="width:${size}px;height:${size}px;font-size:${size * .38}px;background:linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 50) % 360} 70% 45%))">${esc(initials)}</span>`;
  }

  let me = null, mount = null, tab = "week";

  async function init() {
    mount = $("#lb-mount");
    if (!mount) return;
    const c = sb();
    if (!c) {
      mount.innerHTML = `<div class="lb-empty">Le classement s'affichera une fois la communauté connectée (Supabase).</div>`;
      window.LT._scanReveals && window.LT._scanReveals();
      return;
    }
    try { const { data: { session } } = await c.auth.getSession(); me = session ? session.user : null; } catch {}

    mount.innerHTML = `
      <div id="lb-missions"></div>
      <div class="lb-tabs" id="lb-tabs" role="tablist">
        <button class="lb-tab on" data-tab="week" role="tab">Cette semaine</button>
        <button class="lb-tab" data-tab="alltime" role="tab">All-time</button>
      </div>
      <div id="lb-self"></div>
      <div class="lb-list" id="lb-list" aria-busy="true"></div>`;

    $("#lb-tabs").addEventListener("click", e => {
      const b = e.target.closest(".lb-tab");
      if (!b || b.dataset.tab === tab) return;
      tab = b.dataset.tab;
      $$(".lb-tab").forEach(x => x.classList.toggle("on", x === b));
      render();
    });

    loadMissions();
    loadSelf();
    render();
  }

  /* ---------- Missions de la semaine ---------- */
  async function loadMissions() {
    const box = $("#lb-missions");
    if (!box) return;
    const c = sb();
    let data;
    try { ({ data } = await c.rpc("weekly_missions")); } catch { box.innerHTML = ""; return; }
    if (!data || !data.missions || !data.missions.length) { box.innerHTML = ""; return; }
    box.innerHTML = `
      <div class="lb-mtitle">
        <h2>Missions de la semaine</h2>
        ${me ? "" : `<span class="lb-mnote">Connecte-toi pour gagner l'XP</span>`}
      </div>
      <div class="lb-missions">${data.missions.map(missionCard).join("")}</div>`;
    box.querySelectorAll("[data-claim]").forEach(b =>
      b.addEventListener("click", () => claim(b.dataset.claim, b)));
  }

  function missionCard(m) {
    const pct = Math.min(100, Math.round(m.progress / m.target * 100));
    const action = m.claimed
      ? `<span class="lb-mclaimed">Réclamé ✓</span>`
      : (m.done && me)
        ? `<button class="btn btn-primary btn-sm" data-claim="${esc(m.key)}">Réclamer +50 XP</button>`
        : `<span class="lb-mcount">${m.progress}/${m.target}</span>`;
    return `<div class="lb-mission${m.claimed ? " claimed" : m.done ? " done" : ""}">
      <div class="lb-mission-head"><span class="lb-mcat">${esc(m.category)}</span>${action}</div>
      <div class="lb-mlabel">${esc(m.label)}</div>
      <div class="lb-mbar"><div class="lb-mfill" style="width:${pct}%"></div></div>
    </div>`;
  }

  async function claim(key, btn) {
    if (!me) return;
    btn.disabled = true;
    try {
      const { data } = await sb().rpc("claim_mission", { p_key: key });
      if (data && data.ok) {
        window.LT.toast(data.already ? "Déjà réclamé."
          : data.perfect ? "🌟 Semaine parfaite · +100 XP !"
          : "✨ Mission accomplie · +50 XP");
        loadMissions(); loadSelf();
        if (tab === "alltime") render();
      } else {
        window.LT.toast("Pas si vite ! Termine la mission d'abord 😉");
        btn.disabled = false;
      }
    } catch { btn.disabled = false; }
  }

  async function loadSelf() {
    const box = $("#lb-self");
    if (!box || !me) return;
    const c = sb();
    try {
      const { data } = await c.rpc("my_rank");
      if (!data || !data.ok) return;
      box.innerHTML = `
        <div class="lb-self">
          <span class="lb-self-lbl">Ton rang</span>
          <span class="lb-self-chip">Semaine <b>#${data.week_rank}</b> · +${data.week_xp} XP</span>
          <span class="lb-self-chip">All-time <b>#${data.alltime_rank}</b> · ${data.alltime_xp} XP</span>
        </div>`;
    } catch {}
  }

  function medal(idx) {
    if (idx === 0) return `<span class="lb-medal g">1</span>`;
    if (idx === 1) return `<span class="lb-medal s">2</span>`;
    if (idx === 2) return `<span class="lb-medal b">3</span>`;
    return `<span class="lb-num">${idx + 1}</span>`;
  }

  function row(r, idx, isMe, badge, xpLabel) {
    return `<a class="lb-row${isMe ? " me" : ""}${idx < 3 ? " top" : ""}" href="forum.html#/u/${encodeURIComponent(r.username)}">
      <span class="lb-pos">${medal(idx)}</span>
      ${avatar(r)}
      <span class="lb-name"><span class="${window.LTxp ? window.LTxp.nameClass(r.equipped).trim() : ""}">${esc(r.username)}</span>${badge}</span>
      <span class="lb-xp">${xpLabel}</span>
    </a>`;
  }

  async function render() {
    const list = $("#lb-list");
    if (!list) return;
    list.setAttribute("aria-busy", "true");
    list.innerHTML = `<div class="lb-loading">Chargement…</div>`;
    const c = sb();
    const X = window.LTxp;

    if (tab === "week") {
      const { data, error } = await c.rpc("leaderboard_weekly", { p_limit: 25 });
      if (error) { list.innerHTML = `<div class="lb-empty">Classement indisponible pour le moment.</div>`; return; }
      if (!data || !data.length) { list.innerHTML = `<div class="lb-empty">🔥 Personne n'a encore gagné d'XP cette semaine. Sois le premier !</div>`; return; }
      list.innerHTML = data.map(r =>
        row(r, r.rnk - 1, me && r.id === me.id, X ? X.rankBadgeForLevel(r.lvl) : "", `+${r.xp} XP`)
      ).join("");
    } else {
      const { data, error } = await c.from("profiles")
        .select("id,username,avatar_url,xp,equipped")
        .eq("leaderboard_opt_out", false).gt("xp", 0)
        .order("xp", { ascending: false }).limit(25);
      if (error) { list.innerHTML = `<div class="lb-empty">Classement indisponible pour le moment.</div>`; return; }
      if (!data || !data.length) { list.innerHTML = `<div class="lb-empty">Le classement se remplira dès les premiers XP gagnés.</div>`; return; }
      list.innerHTML = data.map((r, i) =>
        row(r, i, me && r.id === me.id, X ? X.rankBadge(r.xp) : "", `${r.xp} XP`)
      ).join("");
    }

    list.setAttribute("aria-busy", "false");
    window.LT._scanReveals && window.LT._scanReveals();
  }

  document.addEventListener("lt:ready", init);
  if (window.LT && window.LT._scanReveals) init();   // filet si lt:ready déjà émis
})();
