/* =========================================================================
   LanorTrad — « X lecteurs en ce moment ».

   Tous les autres compteurs du site sont froids : des totaux, des tendances,
   de l'agrégat calculé après coup. Celui-ci dit qu'il y a quelqu'un d'autre,
   là, maintenant, sur la même page.

   Comme js/views.js et js/pulse.js : API REST en fetch, pas de supabase-js.
   Charger 212 Ko pour un entier n'aurait aucun sens — surtout ici, où le
   visiteur type est anonyme et vient de Google.

   Ce qui part d'ici : un identifiant tiré au hasard par le navigateur (aucun
   rapport avec un compte) et la page regardée. Voir supabase/presence.sql
   pour ce que la base en garde — deux minutes, et rien d'autre.

   Silencieux par construction : sans le SQL déployé, l'appel échoue et rien
   ne s'affiche. Et on n'affiche jamais « 1 lecteur » : ce lecteur, c'est toi.
   ========================================================================= */
(function () {
  "use strict";

  const CLE = "lt-presence-id";
  const RYTHME = 45000;      // un signe de vie toutes les 45 s (la base oublie à 90 s)
  const MINI = 2;            // en dessous, il n'y a personne d'autre : on se tait

  const cfg = () => window.LT_SUPABASE || {};
  const ok = () => {
    const c = cfg();
    return !!(c.url && c.anonKey && !/VOTRE_|YOUR_/i.test(c.url + c.anonKey));
  };

  /* Identifiant de navigateur, tiré au sort une fois. Il ne sert qu'à ne pas
     se compter deux fois : deux onglets ouverts, ce n'est pas deux lecteurs.
     Si le stockage local est refusé, on en tire un pour la session — la
     présence marche quand même, elle est juste oubliée au rechargement. */
  let _id = null;
  function moi() {
    if (_id) return _id;
    try { _id = localStorage.getItem(CLE); } catch {}
    if (!_id) {
      _id = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now().toString(36));
      try { localStorage.setItem(CLE, _id); } catch {}
    }
    return _id;
  }

  async function ping(scope) {
    const res = await fetch(cfg().url + "/rest/v1/rpc/presence_ping", {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: cfg().anonKey, Authorization: "Bearer " + cfg().anonKey },
      body: JSON.stringify({ p_id: moi(), p_scope: scope }),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return Number(await res.json()) || 0;
  }

  /* ------------------------------------------------------------------
     Suit une page tant que l'onglet est visible.
     `rendre(n)` reçoit le nombre de présents (soi compris), ou 0 si on ne
     sait pas / s'il n'y a personne d'autre.
     ------------------------------------------------------------------ */
  function suivre(scope, rendre) {
    if (!ok() || !scope) return () => {};
    let timer = 0, vivant = true;

    async function battre() {
      if (!vivant || document.hidden) return;
      try {
        const n = await ping(scope);
        if (vivant) rendre(n >= MINI ? n : 0);
      } catch {
        // Réseau coupé, SQL pas déployé : on se tait et on réessaiera.
        if (vivant) rendre(0);
      }
    }

    function relancer() {
      clearInterval(timer);
      if (document.hidden) return;         // onglet en arrière-plan : on ne compte pas
      battre();
      timer = setInterval(battre, RYTHME);
    }

    document.addEventListener("visibilitychange", relancer);
    relancer();

    return function arreter() {
      vivant = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", relancer);
    };
  }

  /* Branche directement un élément : il se remplit, ou reste vide. */
  function afficher(scope, el, gabarit) {
    if (!el) return () => {};
    const texte = gabarit || (n => `👀 ${n} lecteurs en ce moment`);
    return suivre(scope, n => {
      el.textContent = n ? texte(n) : "";
      el.hidden = !n;
      // Un point séparateur juste avant, s'il y en a un (fiche série).
      const p = el.previousElementSibling;
      if (p && p.classList.contains("dot")) p.hidden = !n;
    });
  }

  const serie = id => "serie:" + id;

  window.LTpresence = { suivre, afficher, serie, dispo: ok };
})();
