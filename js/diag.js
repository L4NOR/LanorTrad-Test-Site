/* =========================================================================
   LanorTrad — Diagnostic Supabase.

   Le site est construit pour DÉGRADER EN SILENCE : une brique dont le SQL
   n'est pas déployé ne casse rien, elle se cache. C'est le bon comportement
   pour un visiteur — mais côté team, ça veut dire qu'on ne peut pas savoir,
   en regardant le site, ce qui est réellement en place.

   Cette page pose la question à la base elle-même : une sonde par script SQL,
   en lecture seule. Aucune sonde n'écrit quoi que ce soit — les fonctions qui
   modifient la base (bump_view, rate_series, claim_mission…) ne sont jamais
   appelées ; on interroge à la place la table ou la fonction de lecture
   qu'elles accompagnent.

   Comme js/views.js et js/pulse.js, ce module tape l'API REST en fetch : pas
   besoin de supabase-js (212 Ko) pour poser une question fermée.
   ========================================================================= */
(function () {
  "use strict";

  /* ------------------------------------------------------------------
     Ce qu'on vérifie, dans l'ordre de déploiement (README § 6.1).
     `cibles` : ce qui prouve que le script est passé.
       table / vue  -> select limit=0 (rien n'est ramené, on veut le statut)
       colonne      -> select d'UNE colonne : distingue « table absente » de
                       « script à ré-exécuter »
       fonction     -> appel avec des arguments inoffensifs
     ------------------------------------------------------------------ */
  const SCRIPTS = [
    {
      f: "schema.sql", titre: "Forum et comptes",
      pour: "Comptes, catégories, sujets, messages. Prérequis de tout le reste.",
      cibles: [{ k: "table", n: "profiles" }, { k: "table", n: "topics" }, { k: "table", n: "posts" }],
    },
    {
      f: "forum-profile-fields.sql", titre: "Champs de profil",
      pour: "Sexe, âge, types lus et genres préférés sur la fiche de profil.",
      cibles: [{ k: "col", n: "profiles", c: "fav_genres" }],
    },
    {
      f: "forum-reactions-notifications.sql", titre: "Réactions et notifications",
      pour: "Réactions aux messages du forum, mentions, cloche de notifications.",
      cibles: [{ k: "table", n: "reactions" }, { k: "table", n: "notifications" }],
    },
    {
      f: "reader-comments.sql", titre: "Commentaires de chapitre",
      pour: "Le fil de discussion en bas de chaque chapitre.",
      cibles: [{ k: "table", n: "chapter_comments" }],
    },
    {
      f: "storage-avatars.sql", titre: "Avatars",
      pour: "Photo de profil (bucket public « avatars »).",
      cibles: [{ k: "bucket", n: "avatars" }],
    },
    {
      f: "gamification.sql", titre: "XP, niveaux et succès",
      pour: "Barème d'XP côté serveur, streak, succès. Cœur de la gamification.",
      cibles: [
        { k: "table", n: "achievements" },
        { k: "table", n: "xp_events" },
        // Ajoutée par la MISE À JOUR du script (compteurs + succès
        // automatiques). Sa seule absence veut dire : à ré-exécuter.
        { k: "col", n: "profiles", c: "reads_count", maj: "gamification.sql a été déployé dans sa première version : le ré-exécuter active les compteurs et l'attribution automatique des succès" },
      ],
    },
    {
      f: "gamification-triggers.sql", titre: "XP des réactions reçues",
      pour: "Crédite l'auteur d'un message quand on réagit à son message.",
      // Ce script n'est fait que d'un trigger et d'une fonction fermée au
      // client : vu de l'API, « existe » et « n'existe pas » se ressemblent
      // exactement. Seul lt_diag() (supabase/diag.sql) peut trancher.
      cibles: [], aveugle: true,
    },
    {
      f: "leaderboard.sql", titre: "Classement hebdomadaire",
      pour: "L'onglet « Cette semaine » du classement, et « ton rang ».",
      cibles: [{ k: "fn", n: "leaderboard_weekly", args: { p_limit: 1 } }],
    },
    {
      f: "missions.sql", titre: "Missions de la semaine",
      pour: "Les 3 missions hebdomadaires en haut du classement.",
      cibles: [{ k: "fn", n: "weekly_missions", args: {} }],
    },
    {
      f: "cosmetics.sql", titre: "Cosmétiques",
      pour: "Couleurs de pseudo et cadres d'avatar débloqués par le rang.",
      cibles: [{ k: "table", n: "cosmetics" }],
    },
    {
      f: "views.sql", titre: "Compteurs de lectures",
      pour: "« X lectures » sur les fiches, badge « Tendance », section Tendances.",
      cibles: [{ k: "table", n: "series_views" }],
    },
    {
      f: "ratings.sql", titre: "Notes des lecteurs",
      pour: "Les 5 étoiles sur la fiche série — et les étoiles dans Google.",
      cibles: [{ k: "vue", n: "series_rating_stats" }],
    },
    {
      f: "sync.sql", titre: "Synchro multi-appareils",
      pour: "Progression de lecture et séries suivies, partagées entre appareils.",
      cibles: [{ k: "table", n: "reading_progress" }, { k: "table", n: "user_follows" }],
    },
    {
      f: "chapter-mood.sql", titre: "Réactions de fin de chapitre",
      pour: "« Ce chapitre t'a fait quoi ? » sous la dernière page.",
      cibles: [{ k: "fn", n: "chapter_mood", args: { p_manga: "diagnostic", p_chapter: "0" } }],
    },
    {
      f: "forum-polls.sql", titre: "Sondages du forum",
      pour: "Le sondage optionnel attaché à un sujet.",
      cibles: [{ k: "table", n: "polls" }, { k: "fn", n: "poll_for_topic", args: { p_topic: 0 } }],
    },
    {
      f: "quiz.sql", titre: "Quiz de la semaine",
      pour: "Les 5 questions hebdomadaires, sur la page Classement.",
      cibles: [{ k: "fn", n: "weekly_quiz", args: {} }],
    },
    {
      f: "activity.sql", titre: "Fil d'activité",
      pour: "« Ça bouge sur LanorTrad » sur l'accueil.",
      cibles: [{ k: "fn", n: "recent_activity", args: { p_limit: 1 } }],
    },
    {
      f: "presence.sql", titre: "Lecteurs en ce moment",
      pour: "« 👀 3 lecteurs en ce moment » sur la fiche série et dans le lecteur.",
      // presence_ping écrit — mais seulement après ses garde-fous : un
      // identifiant trop court le fait sortir avant la moindre écriture.
      // La sonde reste donc en lecture seule, comme les autres.
      cibles: [{ k: "fn", n: "presence_ping", args: { p_id: "", p_scope: "" } }],
    },
    {
      f: "podium.sql", titre: "Couronne du podium",
      pour: "Le 👑 des trois premiers de la semaine passée.",
      cibles: [{ k: "fn", n: "podium_last_week", args: {} }],
    },
  ];

  /* ---------------------------------------------------------------- Outils */
  const cfg = () => window.LT_SUPABASE || {};
  const configure = () => {
    const c = cfg();
    return !!(c.url && c.anonKey && !/VOTRE_|YOUR_/i.test(c.url + c.anonKey));
  };
  const entetes = () => {
    const c = cfg();
    return { apikey: c.anonKey, Authorization: "Bearer " + c.anonKey };
  };
  const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function corps(res) {
    try { return await res.json(); } catch { return {}; }
  }

  /* ------------------------------------------------------------- Une sonde
     Trois réponses possibles, et une seule est une mauvaise nouvelle :
       ok      — l'objet existe (y compris quand l'accès nous est refusé :
                 un refus prouve justement qu'il y a quelque chose à refuser)
       absent  — le script n'a pas été exécuté
       erreur  — la base répond autre chose ; on affiche son message tel quel
     ---------------------------------------------------------------------- */
  async function sonder(cible) {
    const base = cfg().url + "/rest/v1/";
    try {
      if (cible.k === "bucket") {
        // Un bucket public se prouve en listant : la policy de lecture de
        // storage-avatars.sql suffit, la clé publique aussi.
        const r = await fetch(cfg().url + "/storage/v1/object/list/" + cible.n, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...entetes() },
          body: JSON.stringify({ prefix: "", limit: 1 }),
        });
        if (r.ok) return { etat: "ok" };
        if (r.status === 404 || r.status === 400) return { etat: "absent", detail: "bucket « " + cible.n + " » introuvable" };
        return { etat: "erreur", detail: "HTTP " + r.status };
      }

      if (cible.k === "fn") {
        const r = await fetch(base + "rpc/" + cible.n, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...entetes() },
          body: JSON.stringify(cible.args || {}),
        });
        if (r.ok) return { etat: "ok" };
        const j = await corps(r);
        if (r.status === 404 || j.code === "PGRST202")
          return { etat: "absent", detail: "fonction " + cible.n + "() absente" };
        if (r.status === 401 || r.status === 403 || j.code === "42501")
          return { etat: "ok", detail: "présente — accès client volontairement fermé" };
        return { etat: "erreur", detail: "HTTP " + r.status + (j.message ? " — " + j.message : "") };
      }

      // table / vue / colonne
      const sel = cible.k === "col" ? cible.c : "*";
      const r = await fetch(base + encodeURIComponent(cible.n) + "?select=" + encodeURIComponent(sel) + "&limit=0", { headers: entetes() });
      if (r.ok) return { etat: "ok" };
      const j = await corps(r);
      if (cible.k === "col" && j.code === "42703")
        return { etat: "absent", detail: "colonne " + cible.c + " absente", maj: cible.maj };
      if (r.status === 404 || j.code === "42P01" || j.code === "PGRST205" || j.code === "PGRST205")
        return { etat: "absent", detail: (cible.k === "vue" ? "vue " : "table ") + cible.n + " absente" };
      if (r.status === 401 || r.status === 403 || j.code === "42501")
        return { etat: "ok", detail: "présente — lecture fermée au client" };
      return { etat: "erreur", detail: "HTTP " + r.status + (j.message ? " — " + j.message : "") };
    } catch (e) {
      // Réseau coupé, CORS, projet en pause : ce n'est pas « absent ».
      return { etat: "erreur", detail: e.message || "requête impossible" };
    }
  }

  /* ------------------------------------------------- Réponse de la base
     Quand supabase/diag.sql est déployé, la base répond elle-même, et sa
     réponse fait autorité : elle voit les triggers et les fonctions fermées,
     que l'API ne montre pas. Sinon on retombe sur les sondes ci-dessus. */
  async function reponseDeLaBase() {
    try {
      const r = await fetch(cfg().url + "/rest/v1/rpc/lt_diag", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...entetes() },
        body: "{}",
      });
      if (!r.ok) return null;
      const j = await r.json();
      return j && typeof j === "object" ? j : null;
    } catch { return null; }
  }

  /* ------------------------------------------------------------ Une ligne */
  const PUCE = { ok: "✅", absent: "⭕", partiel: "⚠️", erreur: "❌", inconnu: "❔" };
  const MOT = { ok: "en place", absent: "à déployer", partiel: "à ré-exécuter", erreur: "erreur", inconnu: "invérifiable d'ici" };

  function ligneHTML(s, r) {
    const detail = r.cibles.map(c =>
      `<li class="dg-c dg-${c.etat}">${PUCE[c.etat]} <code>${esc(c.nom)}</code>${c.detail ? " — " + esc(c.detail) : ""}</li>`).join("");
    const aFaire = r.etat !== "ok" && r.etat !== "inconnu"
      ? `<div class="dg-todo">
           <p>${esc(r.consigne)}</p>
           <div class="dg-actions">
             <button class="btn btn-primary dg-copy" data-f="${esc(s.f)}">Copier le SQL</button>
             <a class="btn btn-ghost" href="supabase/${esc(s.f)}" target="_blank" rel="noopener">Ouvrir le fichier</a>
           </div>
         </div>`
      : "";
    return `<article class="dg-item dg-${r.etat}">
      <header>
        <span class="dg-badge">${PUCE[r.etat]} ${MOT[r.etat]}</span>
        <h3>${esc(s.titre)}</h3>
        <code class="dg-f">supabase/${esc(s.f)}</code>
      </header>
      <p class="dg-pour">${esc(s.pour)}</p>
      <ul class="dg-cibles">${detail}</ul>
      ${aFaire}
    </article>`;
  }

  /* --------------------------------------------------------------- Rendu */
  async function lancer() {
    const mount = document.getElementById("dg-mount");
    const resume = document.getElementById("dg-resume");
    if (!mount) return;

    if (!configure()) {
      resume.innerHTML = `<div class="dg-alerte">js/supabase-config.js n'est pas rempli : aucune vérification possible.</div>`;
      mount.innerHTML = "";
      return;
    }

    mount.innerHTML = `<p class="dg-attente">Interrogation de la base…</p>`;
    resume.innerHTML = "";

    const exact = await reponseDeLaBase();

    const resultats = [];
    for (const s of SCRIPTS) {
      let etat, cibles = [], maj = null;

      if (exact && s.f in exact) {
        const pose = exact[s.f] === true;
        const majOk = !(s.f + ":maj" in exact) || exact[s.f + ":maj"] === true;
        etat = !pose ? "absent" : majOk ? "ok" : "partiel";
        cibles = [{ nom: s.f, etat: etat === "partiel" ? "partiel" : etat, detail: "réponse de la base (lt_diag)" }];
        if (etat === "partiel") maj = { maj: "gamification.sql a été déployé dans sa première version : le ré-exécuter active les compteurs et l'attribution automatique des succès" };
      } else if (s.aveugle) {
        etat = "inconnu";
        cibles = [{ nom: s.f, etat: "inconnu", detail: "trigger + fonction fermée : invisibles depuis l'API" }];
      } else {
        for (const c of s.cibles) {
          const r = await sonder(c);
          cibles.push({ nom: c.k === "col" ? c.n + "." + c.c : c.n, ...r });
        }
        const ok = cibles.filter(c => c.etat === "ok").length;
        const err = cibles.some(c => c.etat === "erreur");
        // Une seule cible manquante sur plusieurs = le script est passé, mais
        // dans une version plus ancienne (cas de gamification.sql).
        etat = err ? "erreur" : ok === cibles.length ? "ok" : ok === 0 ? "absent" : "partiel";
        maj = cibles.find(c => c.maj) || null;
      }

      const consigne = etat === "partiel" && maj
        ? maj.maj
        : etat === "erreur"
          ? "La base a répondu autre chose qu'un simple « ça n'existe pas ». Regarde le détail ci-dessus avant de recoller le script."
          : "À coller dans Supabase → SQL Editor → New query → Run.";
      resultats.push({ s, r: { etat, cibles, consigne } });
    }

    const n = resultats.filter(x => x.r.etat === "ok").length;
    const manquants = resultats.filter(x => x.r.etat !== "ok" && x.r.etat !== "inconnu");
    const aveugles = resultats.filter(x => x.r.etat === "inconnu").length;
    resume.innerHTML = `
      <div class="dg-score ${n === SCRIPTS.length ? "dg-plein" : ""}">
        <b>${n}</b> / ${SCRIPTS.length} script${SCRIPTS.length > 1 ? "s" : ""} en place
      </div>
      ${manquants.length
        ? `<p class="dg-suite">Prochaine étape : <code>supabase/${esc(manquants[0].s.f)}</code> — ${esc(manquants[0].s.pour)}</p>`
        : aveugles
          ? `<p class="dg-suite">Rien à déployer parmi ce qui est vérifiable d'ici.</p>`
          : `<p class="dg-suite">Tout est déployé. Rien à faire.</p>`}
      ${exact
        ? `<p class="dg-suite dg-exact">Diagnostic exact : la base répond elle-même (<code>lt_diag</code>).</p>`
        : `<div class="dg-alerte dg-conseil">
             <p><b>Diagnostic approximatif.</b> Les réponses ci-dessous viennent de sondes
                envoyées à l'API : elles voient les tables, les vues et les fonctions
                ouvertes — mais ni les triggers, ni les fonctions dont l'accès client
                est fermé. Déploie <code>supabase/diag.sql</code> une fois, et la base
                répondra elle-même.</p>
             <div class="dg-actions">
               <button class="btn btn-primary dg-copy" data-f="diag.sql">Copier diag.sql</button>
               <a class="btn btn-ghost" href="supabase/diag.sql" target="_blank" rel="noopener">Ouvrir le fichier</a>
             </div>
           </div>`}`;

    mount.innerHTML = resultats.map(x => ligneHTML(x.s, x.r)).join("");
  }

  /* Copie le contenu du .sql : le fichier est servi avec le site (Netlify
     publie la racine du dépôt), donc un fetch suffit — plus besoin d'aller
     l'ouvrir dans l'éditeur pour le coller dans Supabase. */
  async function copier(btn) {
    const f = btn.dataset.f;
    const avant = btn.textContent;
    try {
      const res = await fetch("supabase/" + f);
      if (!res.ok) throw new Error("HTTP " + res.status);
      await navigator.clipboard.writeText(await res.text());
      btn.textContent = "Copié ✔";
      window.LT && window.LT.toast("SQL copié — colle-le dans Supabase → SQL Editor");
    } catch (e) {
      btn.textContent = "Échec — ouvre le fichier";
    }
    setTimeout(() => { btn.textContent = avant; }, 2500);
  }

  function init() {
    document.addEventListener("click", e => {
      const c = e.target.closest(".dg-copy");
      if (c) { copier(c); return; }
      if (e.target.closest("#dg-refaire")) lancer();
    });
    lancer();
  }

  document.addEventListener("lt:ready", init);
})();
