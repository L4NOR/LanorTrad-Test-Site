/* =========================================================================
   LanorTrad — L'atelier : l'avancement du prochain chapitre.

   Tant qu'une série est en cours, le lecteur ne voit rien entre deux sorties.
   Ce module rend visible ce qui se passe entre les deux : pages trouvées →
   clean → traduction → edit → q-check → sortie.

   Données : js/data/atelier.js (window.ATELIER).
   API : window.LTatelier
     .STEPS            liste des étapes (ordre du pipeline)
     .get(id)          entrée normalisée d'une série, ou null
     .all()            toutes les entrées visibles, de la plus avancée à la moins
     .card(e, opts)    bloc complet (fiche série, planning)
     .mini(e)          ligne compacte (accueil, calendrier hebdo)
   ========================================================================= */
(function () {
  "use strict";

  const STEPS = [
    { id: "pages",  label: "Pages trouvées", short: "Pages",   ico: "📥",
      desc: "Les pages japonaises sont récupérées et remises au propre." },
    { id: "clean",  label: "Clean",          short: "Clean",   ico: "🧽",
      desc: "On efface les textes d'origine et on redessine ce qui passe dessous." },
    { id: "trad",   label: "Traduction",     short: "Trad",    ico: "💬",
      desc: "Le chapitre passe du japonais au français, réplique par réplique." },
    { id: "edit",   label: "Edit",           short: "Edit",    ico: "✍️",
      desc: "Le texte français est placé dans les bulles, avec les bonnes polices." },
    { id: "qcheck", label: "Q-check",        short: "Qcheck",  ico: "🔍",
      desc: "Dernière relecture : fautes, sens, cohérence, oublis." },
    { id: "sortie", label: "Sortie",         short: "Sortie",  ico: "🎉",
      desc: "C'est en ligne. Bonne lecture !" }
  ];

  const IDX = {};
  STEPS.forEach((s, i) => IDX[s.id] = i);

  // Une sortie reste affichée quelques jours, le temps que tout le monde la voie.
  const KEEP_DAYS = 3;
  const DAY = 86400000;

  /* ---------- Normalisation ---------- */
  function stepIndex(v) {
    if (typeof v === "number") return Math.max(0, Math.min(STEPS.length - 1, v - 1));
    const i = IDX[String(v || "").toLowerCase()];
    return i == null ? 0 : i;
  }

  /* ---------- Du retard ? ----------
     Une jauge qui n'avance plus ne dit rien au lecteur : il voit « Q-check
     5/6 » et en deduit que ca sort demain. Au bout de trois semaines, ce
     silence passe pour de l'abandon. Mieux vaut l'admettre franchement --
     c'est aussi ce qu'on aimerait lire en tant que lecteur.

     Deux facons de le savoir, dans cet ordre :
       - la date visee est passee. C'est le signal le plus net, et il vient de
         la team elle-meme ;
       - pas de date visee, mais plus rien n'a bouge depuis SILENCE_JOURS. On
         ne juge alors que ce qu'on sait : l'etape n'a pas change depuis un
         mois. Une entree qui a une `eta` encore a venir n'est PAS en retard,
         meme si son dernier point d'etape date : la team a donne sa parole la
         plus recente, elle fait foi. */
  const SILENCE_JOURS = 30;

  function retardDe(raw, done) {
    if (done) return null;
    const minuit = d => new Date(d).setHours(0, 0, 0, 0);
    const today = new Date().setHours(0, 0, 0, 0);
    if (raw.eta) {
      const j = Math.round((today - minuit(raw.eta)) / DAY);
      return j > 0 ? { jours: j, cause: "eta" } : null;
    }
    if (raw.updated) {
      const j = Math.round((today - minuit(raw.updated)) / DAY);
      return j > SILENCE_JOURS ? { jours: j, cause: "silence" } : null;
    }
    return null;
  }

  /* Le plus grand numero declare (« 45-45.5-46 » -> 46) est-il deja publie ? */
  function dejaPublie(id, chapitre) {
    const nums = String(chapitre == null ? "" : chapitre)
      .split(/[^0-9.]+/).map(parseFloat).filter(n => !isNaN(n));
    if (!nums.length) return false;
    const vise = Math.max.apply(null, nums);
    const liste = (window.CHAPTERS || {})[id] || [];
    return liste.some(c => parseFloat(c.num) >= vise);
  }

  function get(id) {
    const raw = (window.ATELIER || {})[id];
    const s = window.LT && window.LT.seriesById(id);
    if (!raw || !s) return null;

    const i = stepIndex(raw.step);
    const done = i === STEPS.length - 1;
    // Le chapitre annonce est-il DEJA en ligne ? Alors cette entree ment.
    //
    // L'atelier est tenu a la main, la liste des chapitres est generee : les
    // deux divergent des qu'une sortie part sans que le fichier suive. Le site
    // affichait alors « Ch. 168 a venir » sur le planning pendant que le
    // catalogue proposait de lire le 168 — deux pages du meme site en
    // desaccord, sans la moindre erreur nulle part.
    //
    // On tranche par les donnees : le plus grand numero annonce est-il dans la
    // liste publiee ? Un lot (« 248-249-250 ») n'est fini que quand son dernier
    // chapitre est sorti. C'est la meme logique que l'expiration ci-dessus :
    // une entree perimee disparait toute seule plutot que d'induire en erreur.
    if (dejaPublie(id, raw.chapter)) return null;

    // Une sortie annoncée il y a longtemps n'a plus rien à faire ici.
    if (done && raw.updated && Date.now() - new Date(raw.updated).getTime() > KEEP_DAYS * DAY) return null;

    return {
      s, id,
      chapter: String(raw.chapter == null ? "" : raw.chapter),
      i, step: STEPS[i], done,
      pct: Math.round(((i + 1) / STEPS.length) * 100),
      updated: raw.updated || "",
      eta: raw.eta || "",
      note: raw.note || "",
      retard: retardDe(raw, done)
    };
  }

  function all() {
    return Object.keys(window.ATELIER || {})
      .map(get).filter(Boolean)
      .sort((a, b) => b.i - a.i || (a.s.title > b.s.title ? 1 : -1));
  }

  /* ---------- Rendu ---------- */
  const esc = v => String(v == null ? "" : v).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const plural = ch => /[-–,]/.test(ch);   // "45-46" → « Chapitres »

  function chapLabel(e) {
    return `Chapitre${plural(e.chapter) ? "s" : ""} ${esc(e.chapter)}`;
  }

  function frDate(d) {
    try { return new Date(d).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }); }
    catch { return d; }
  }

  // Pied de bloc : quand ça a bougé pour la dernière fois, et la sortie visée.
  function foot(e) {
    const bits = [];
    if (e.updated && window.LT) {
      const ago = window.LT.timeAgo(e.updated);
      if (ago) bits.push(`Dernier point d'étape ${ago}`);
    }
    // La date visee n'est rappelee ici que si elle est encore devant nous :
    // une fois depassee, c'est le bloc « du retard » qui la reprend, et la
    // repeter deux fois dans la meme carte n'ajoute rien.
    if (e.eta && !e.done && !(e.retard && e.retard.cause === "eta")) {
      const left = Math.ceil((new Date(e.eta).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / DAY);
      bits.push(left === 0 ? "Visé pour aujourd'hui"
        : left === 1 ? "Visé pour demain"
        : `Visé pour le ${frDate(e.eta)}`);
    }
    return bits.length ? `<div class="atl-foot">${bits.join(" · ")}</div>` : "";
  }

  /* Ce qu'on dit quand ca traine. Une note ecrite par la team est TOUJOURS
     preferee a cette phrase generique : elle dit la vraie raison, et c'est la
     voix de l'equipe plutot qu'un message automatique. */
  function motDeRetard(e) {
    const r = e.retard;
    if (!r) return "";
    const pourquoi = "Soit le chapitre demande plus de travail que prévu, soit nos boulots ne nous laissent pas le temps d'avancer en ce moment.";
    return r.cause === "eta"
      ? `On visait le ${frDate(e.eta)} et on a débordé. ${pourquoi} Merci de patienter.`
      : `Rien n'a bougé ici depuis ${r.jours} jours. ${pourquoi} Merci de patienter.`;
  }

  /* Bloc complet : jauge + les 6 étapes.
     opts.series : true → ajoute la couverture et le titre (planning).
     opts.link   : true → le titre renvoie vers la fiche série. */
  function card(e, opts) {
    if (!e) return "";
    const o = opts || {};
    const steps = STEPS.map((st, k) => {
      const state = k < e.i ? "done" : k === e.i ? "now" : "todo";
      return `<li class="atl-step ${state}"${state === "now" ? ' aria-current="step"' : ""}>
        <span class="atl-dot" aria-hidden="true">${state === "done" ? "✓" : st.ico}</span>
        <span class="atl-lbl"><b>${st.label}</b><i>${st.short}</i></span>
      </li>`;
    }).join("");

    const head = o.series ? `<a class="atl-serie" href="${esc(window.LT.urlSeries(e.s))}">
        <img src="${window.LT.cover(e.s.cover, 120)}" alt="${esc(e.s.title)}" data-fade loading="lazy" width="46" height="64">
        <span class="atl-serie-t">${esc(e.s.title)}</span>
      </a>` : "";

    // « Lire maintenant » seulement si le chapitre est VRAIMENT en ligne :
    // marquer « sortie » avant d'avoir lancé build-data.py ne doit pas
    // fabriquer un lien mort.
    const first = e.chapter.split(/[-–,]/)[0].trim();
    const online = e.done && ((window.CHAPTERS || {})[e.s.id] || []).some(c => String(c.num) === first);
    const cta = online
      ? `<a class="atl-go" href="${window.LT.urlChapter(e.s, first)}">Lire maintenant →</a>`
      : "";

    const late = e.retard;
    return `<div class="atl${e.done ? " is-done" : ""}${late ? " is-late" : ""}" style="--accent:${esc(e.s.accent)}">
      <div class="atl-top">
        ${head}
        <div class="atl-id">
          <span class="atl-eyebrow">${e.done ? "Tout frais" : late ? "Du retard" : "En préparation"}</span>
          <strong>${chapLabel(e)}</strong>
        </div>
        <span class="atl-badge">${e.step.ico} ${esc(e.step.label)}<i>${e.i + 1}/${STEPS.length}</i></span>
      </div>
      <div class="atl-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${e.pct}"
           aria-label="Avancement de ${chapLabel(e).toLowerCase()} : ${esc(e.step.label)}">
        <i style="width:${e.pct}%"></i>
      </div>
      <ol class="atl-steps">${steps}</ol>
      <p class="atl-desc">${esc(e.step.desc)}</p>
      ${late ? `<p class="atl-late">${esc(e.note || motDeRetard(e))}</p>`
              : e.note ? `<p class="atl-note">${esc(e.note)}</p>` : ""}
      ${foot(e)}${cta}
    </div>`;
  }

  /* Ligne compacte : une jauge fine + l'étape en cours (cartes de l'accueil,
     cellules du calendrier). Volontairement muette si aucune donnée. */
  function mini(e) {
    if (!e) return "";
    // L'etiquette est deja serree (nowrap + ellipsis) : le retard se lit a la
    // couleur et dans l'infobulle, pas en rallongeant le texte.
    return `<span class="atl-mini${e.done ? " is-done" : ""}${e.retard ? " is-late" : ""}" title="${chapLabel(e)} · ${esc(e.step.label)} (étape ${e.i + 1} sur ${STEPS.length})${e.retard ? " — du retard" : ""}">
      <span class="atl-mini-bar"><i style="width:${e.pct}%"></i></span>
      <span class="atl-mini-lbl">${e.step.ico} ${esc(e.step.short)} · ${e.i + 1}/${STEPS.length}</span>
    </span>`;
  }

  window.LTatelier = { STEPS, get, all, card, mini };
})();
