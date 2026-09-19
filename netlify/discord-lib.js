/* =========================================================================
   LanorTrad — Annonce des sorties sur Discord (webhook).

   Utilisé par netlify/functions/discord-watch.js (toutes les 15 min) et par
   push-send.js (?discord=1, pour tester). Même principe que les
   notifications : on compare le carnet des sorties publiées
   (push/latest.json) à ce qui a déjà été annoncé, et on ne poste que le neuf.

   POURQUOI UN WEBHOOK
   C'est l'adresse qu'un salon Discord donne pour qu'on y poste : pas de bot à
   héberger, pas de compte, pas de dépendance. Discord → Paramètres du salon →
   Intégrations → Webhooks → Nouveau webhook → « Copier l'URL ».

   VARIABLES D'ENVIRONNEMENT (Netlify → Site configuration → Environment) :
     DISCORD_WEBHOOK        l'URL copiée ci-dessus (c'est un SECRET : qui la
                            connaît peut poster dans le salon)
     DISCORD_ROLE           (facultatif) l'identifiant d'un rôle à mentionner,
                            par exemple un rôle « Notifs sorties »
     SUPABASE_URL           déjà posées pour les notifications push : la
     SUPABASE_SERVICE_ROLE  mémoire des annonces vit dans la table push_state
   ========================================================================= */
"use strict";
const push = require("./push-lib.js");

const WEBHOOK = process.env.DISCORD_WEBHOOK || "";
const ROLE = (process.env.DISCORD_ROLE || "").replace(/\D/g, "");   // chiffres seulement
const CLE = "discord";          // clé de la mémoire dans push_state

function manque() {
  const m = [];
  if (!WEBHOOK) m.push("DISCORD_WEBHOOK");
  if (!push.supabasePret()) m.push("SUPABASE_URL / SUPABASE_SERVICE_ROLE");
  return m;
}

/* Une carte par série sortie. Discord accepte jusqu'à 10 cartes par message :
   au-delà (ça n'arrive qu'après une longue coupure), on garde les plus récentes. */
function carte(s, site) {
  const couleur = /^#[0-9a-f]{6}$/i.test(s.accent || "") ? parseInt(s.accent.slice(1), 16) : 0xa855f7;
  const c = {
    title: `${s.titre} — chapitre ${s.num}`,
    url: site + s.url,
    description: `Le chapitre ${s.num} est en ligne. Bonne lecture !`,
    color: couleur,
    footer: { text: "LanorTrad · traduit à la main" },
    timestamp: new Date().toISOString(),
  };
  if (s.image) c.image = { url: site + "/" + s.image.replace(/^\/+/, "") };
  return c;
}

async function poster(sorties, site) {
  const corps = {
    username: "LanorTrad",
    avatar_url: site + "/images/icons/icon-192x192.png",
    content: ROLE ? `<@&${ROLE}>` : "",
    embeds: sorties.slice(0, 10).map(s => carte(s, site)),
    // Personne n'est mentionné par accident : seul le rôle choisi peut sonner.
    allowed_mentions: ROLE ? { roles: [ROLE] } : { parse: [] },
  };
  const r = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corps),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error("Discord " + r.status + " — " + (await r.text()).slice(0, 200));
}

/* AMORÇAGE — au premier passage, la mémoire est vide : tout paraîtrait neuf et
   le salon recevrait dix annonces d'un coup, dont des chapitres de mars. On
   mémorise l'état du jour sans rien poster (sauf envoi forcé, pour tester). */
async function annoncer(opts) {
  const o = opts || {};
  const site = (o.site || process.env.URL || "").replace(/\/+$/, "");
  const journal = o.journal || (() => {});
  const m = manque();
  if (m.length) return { ok: false, raison: "variables manquantes : " + m.join(", ") };

  let sorties;
  try { sorties = await push.lireSorties(site); }
  catch (e) { return { ok: false, raison: "push/latest.json illisible (" + e.message + ")" }; }
  if (!sorties.length) return { ok: false, raison: "aucune sortie dans push/latest.json" };

  const courant = {};
  sorties.forEach(s => { courant[s.id] = s.sig; });

  const memoire = await push.lireEtat(CLE);
  if (!memoire || !memoire.sigs) {
    await push.ecrireEtat(CLE, { sigs: courant });
    journal("discord : amorçage, état du jour mémorisé");
    if (!o.forcer) return { ok: true, amorcage: true };
  }

  const connues = (memoire && memoire.sigs) || courant;
  let nouvelles = sorties.filter(s => connues[s.id] !== s.sig);
  // Envoi forcé sans nouveauté : on reposte la toute dernière sortie, c'est
  // le seul moyen de voir à quoi ressemble l'annonce sans attendre.
  if (!nouvelles.length && o.forcer) nouvelles = sorties.slice(0, 1);
  if (!nouvelles.length) return { ok: true, rien: true };

  try { await poster(nouvelles, site); }
  catch (e) { return { ok: false, raison: e.message }; }
  journal("discord : " + nouvelles.map(s => s.sig).join(", "));

  // Mémoire mise à jour seulement APRÈS un envoi réussi : un Discord en panne
  // ne fait pas perdre l'annonce, elle repartira au passage suivant.
  await push.ecrireEtat(CLE, { sigs: Object.assign({}, connues, courant) });
  return { ok: true, annonces: nouvelles.map(s => ({ serie: s.id, chapitre: s.num })) };
}

module.exports = { annoncer, manque };
