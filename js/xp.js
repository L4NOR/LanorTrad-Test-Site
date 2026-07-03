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
      if (!data.duplicate && data.awarded > 0) feedback(data);
      document.dispatchEvent(new CustomEvent("lt:xp", { detail: data }));
      return data;
    } catch { return null; }
    finally { _pending.delete(key); }
  }

  function feedback(d) {
    if (d.leveled_up) {
      const r = rankOf(d.level);
      toast(`🎉 Niveau ${d.level} — ${r.name} !`);
    } else {
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
  // « chip » réutilisé sur le forum, les commentaires de chapitre et le profil.
  function rankBadge(xp) {
    const level = levelFromXp(xp || 0);
    const r = rankOf(level);
    return `<span class="lt-rank r-${r.key}" title="${r.name} · niveau ${level}">${r.name}<b>${level}</b></span>`;
  }

  window.LTxp = { award, me, rankOf, levelFromXp, xpForLevel, rankBadge, ranks: RANKS };
})();
