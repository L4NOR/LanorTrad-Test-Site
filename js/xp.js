/* =========================================================================
   LanorTrad — Client XP : attribution des points + retour visuel (toast,
   montée de niveau). Sûr quand non connecté ou Supabase absent (no-op).
   L'attribution réelle et le barème vivent CÔTÉ SERVEUR (RPC award_xp) :
   ici on ne fait que déclencher et afficher le résultat.
   Dépend de : core.js (window.LT, window.LTsb) + supabase-js.
   ========================================================================= */
(function () {
  "use strict";

  // Rangs « Aura » : palier minimal → nom (du plus élevé au plus bas).
  const RANKS = [
    { min: 50, name: "Astre Lanor", key: "astre" },
    { min: 30, name: "Aurore",      key: "aurore" },
    { min: 20, name: "Brasier",     key: "brasier" },
    { min: 10, name: "Flamme",      key: "flamme" },
    { min: 5,  name: "Lueur",       key: "lueur" },
    { min: 1,  name: "Étincelle",   key: "etincelle" },
  ];
  function rankOf(level) { return RANKS.find(r => level >= r.min) || RANKS[RANKS.length - 1]; }

  // Même courbe que level_from_xp() côté SQL : XP cumulé(N) = 20·N·(N−1).
  function levelFromXp(xp) {
    return Math.max(1, Math.floor((1 + Math.sqrt(1 + Math.max(xp, 0) / 5)) / 2));
  }
  function xpForLevel(level) { return 20 * level * (level - 1); }   // seuil d'entrée du niveau

  function sb() { return (window.LTsb && window.LTsb()) || null; }
  const toast = m => (window.LT && window.LT.toast) ? window.LT.toast(m) : null;

  const _pending = new Set();   // évite deux appels concurrents avec la même clé

  async function award(kind, ref) {
    const c = sb();
    if (!c) return null;
    ref = String(ref == null ? "" : ref);
    const key = kind + "|" + ref;
    if (_pending.has(key)) return null;
    _pending.add(key);
    try {
      const { data: { session } } = await c.auth.getSession();
      if (!session) return null;                       // non connecté → pas d'XP
      const { data, error } = await c.rpc("award_xp", { p_kind: kind, p_ref: ref });
      if (error || !data || !data.ok) return null;
      const gotAch = data.new_achievements && data.new_achievements.length;
      if (!data.duplicate && (data.awarded > 0 || gotAch)) feedback(data);
      document.dispatchEvent(new CustomEvent("lt:xp", { detail: data }));
      return data;
    } catch { return null; }
    finally { _pending.delete(key); }
  }

  function feedback(d) {
    if (d.new_achievements && d.new_achievements.length)
      d.new_achievements.forEach(n => toast(`🏆 Succès débloqué : ${n}`));
    if (d.leveled_up) {
      const r = rankOf(d.level);
      toast(`🎉 Niveau ${d.level} — ${r.name} !`);
    } else if (d.awarded > 0) {
      const s = d.streak_bonus > 0 ? ` · série ${d.streak} j` : "";
      toast(`✨ +${d.awarded} XP${s}`);
    }
  }

  // Stat courante du membre connecté (pour la barre d'XP / le chip). null sinon.
  async function me() {
    const c = sb();
    if (!c) return null;
    const { data: { session } } = await c.auth.getSession();
    if (!session) return null;
    const { data } = await c.from("profiles")
      .select("xp,streak,streak_best").eq("id", session.user.id).maybeSingle();
    if (!data) return null;
    const level = levelFromXp(data.xp);
    return {
      xp: data.xp, streak: data.streak, streak_best: data.streak_best,
      level, rank: rankOf(level),
      xpInto: data.xp - xpForLevel(level),               // progression dans le niveau
      xpSpan: xpForLevel(level + 1) - xpForLevel(level)  // largeur du niveau
    };
  }

  // Badge de rang (HTML — données contrôlées, aucune entrée utilisateur) pour le
  // « chip » réutilisé sur le forum, les commentaires de chapitre, le profil et
  // le classement.
  function rankBadgeForLevel(level) {
    const r = rankOf(level);
    return `<span class="lt-rank r-${r.key}" title="${r.name} · niveau ${level}">${r.name}<b>${level}</b></span>`;
  }
  function rankBadge(xp) { return rankBadgeForLevel(levelFromXp(xp || 0)); }

  // Cosmétiques équipés → suffixes de classe CSS (pseudo coloré, cadre d'avatar).
  function nameClass(eq) { const c = eq && eq.name_color;   return c ? " lt-nc-" + c : ""; }
  function frameClass(eq) { const f = eq && eq.avatar_frame; return f ? " lt-fr-" + f : ""; }

  // Attribution d'un succès détecté CÔTÉ CLIENT (le serveur applique une liste
  // blanche : series_1, library_full, early_10, marathon_2h). No-op si non connecté.
  async function grantClient(key) {
    const c = sb();
    if (!c) return null;
    try {
      const { data: { session } } = await c.auth.getSession();
      if (!session) return null;
      const { data, error } = await c.rpc("grant_client_achievement", { p_key: key });
      if (error || !data || !data.ok) return null;
      if (data.granted && data.name) toast(`🏆 Succès débloqué : ${data.name}`);
      return data;
    } catch { return null; }
  }

  window.LTxp = { award, me, rankOf, levelFromXp, xpForLevel, rankBadge, rankBadgeForLevel,
                  nameClass, frameClass, grantClient, ranks: RANKS };
})();
