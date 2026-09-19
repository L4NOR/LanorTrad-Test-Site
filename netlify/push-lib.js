/* =========================================================================
   LanorTrad — Envoi des notifications de sortie (Web Push, côté serveur).

   Utilisé par netlify/functions/push-watch.js (toutes les 15 min) et
   push-send.js (déclenchement manuel). Aucune dépendance npm : tout tient
   avec les modules natifs de Node, comme le reste des scripts du site.

   COMMENT MARCHE UN ENVOI PUSH
   Chaque abonné a une ADRESSE fournie par son navigateur (Google pour Chrome,
   Mozilla pour Firefox, Apple pour Safari). Pour y déposer un message, il faut
   prouver qu'on est bien le site auquel le lecteur s'est abonné : on signe un
   jeton (VAPID) avec la clé privée, dont la clé publique est celle que le
   navigateur a mémorisée à l'abonnement. Pas de compte, pas de Firebase.

   POURQUOI LE MESSAGE EST VIDE
   Le contenu d'un push doit être chiffré de bout en bout (RFC 8291). C'est une
   centaine de lignes de cryptographie à tenir à jour pour transmettre… ce que
   le site publie déjà. On envoie donc un ping vide, et le service worker va
   lire push/latest.json pour composer le texte (voir sw.js).

   VARIABLES D'ENVIRONNEMENT (Netlify → Site configuration → Environment) :
     VAPID_PRIVATE          clé privée (node scripts/push-keys.js)
     VAPID_SUBJECT          mailto:… — adresse de contact, exigée par la norme
     SUPABASE_URL           https://xxxx.supabase.co
     SUPABASE_SERVICE_ROLE  clé service_role (passe au-dessus de RLS)
     PUSH_SECRET            mot de passe du déclenchement manuel
   ========================================================================= */
"use strict";
const crypto = require("node:crypto");

const SUPABASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "";

const configure = () => !!(SUPABASE && SERVICE && VAPID_PRIVATE && VAPID_SUBJECT);

function manque() {
  const m = [];
  if (!SUPABASE) m.push("SUPABASE_URL");
  if (!SERVICE) m.push("SUPABASE_SERVICE_ROLE");
  if (!VAPID_PRIVATE) m.push("VAPID_PRIVATE");
  if (!VAPID_SUBJECT) m.push("VAPID_SUBJECT");
  return m;
}

/* ------------------------------------------------------------- Les clés
   On ne stocke QUE la clé privée : le point public s'en redéduit par
   multiplication sur la courbe. Une variable d'environnement de moins à
   garder synchronisée, et surtout aucun risque de dépareiller la paire. */
function contexteSignature() {
  const d = Buffer.from(VAPID_PRIVATE, "base64url");
  if (d.length !== 32) throw new Error("VAPID_PRIVATE invalide (32 octets attendus, " + d.length + " lus)");
  const ec = crypto.createECDH("prime256v1");
  ec.setPrivateKey(d);
  const pub = ec.getPublicKey();                     // 65 octets, format non compressé
  const cle = crypto.createPrivateKey({
    format: "jwk",
    key: {
      kty: "EC", crv: "P-256",
      d: d.toString("base64url"),
      x: pub.subarray(1, 33).toString("base64url"),
      y: pub.subarray(33, 65).toString("base64url"),
    },
  });
  return { cle, pub: pub.toString("base64url") };
}

/* Jeton VAPID : « c'est bien LanorTrad qui parle ». Valable 11 h, refait à
   chaque service de push (l'audience est l'origine du destinataire). */
function jeton(audience, cle) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const debut = b64({ typ: "JWT", alg: "ES256" }) + "." +
                b64({ aud: audience, exp: Math.floor(Date.now() / 1000) + 11 * 3600, sub: VAPID_SUBJECT });
  // ieee-p1363 : signature brute r||s, le format attendu par JWT. Le défaut de
  // Node est le DER, que les services de push refusent.
  const sig = crypto.sign("sha256", Buffer.from(debut), { key: cle, dsaEncoding: "ieee-p1363" });
  return debut + "." + sig.toString("base64url");
}

/* ------------------------------------------------------------- Supabase */
async function sb(chemin, opts) {
  const o = opts || {};
  const r = await fetch(SUPABASE + "/rest/v1/" + chemin, {
    method: o.method || "GET",
    headers: Object.assign({
      apikey: SERVICE,
      Authorization: "Bearer " + SERVICE,
      "Content-Type": "application/json",
    }, o.headers || {}),
    body: o.body,
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error("Supabase " + r.status + " sur " + chemin + " — " + (await r.text()).slice(0, 200));
  return r;
}

/* Tous les abonnements, par pages de 1000 (PostgREST plafonne les réponses). */
async function abonnes() {
  const out = [];
  for (let debut = 0; ; debut += 1000) {
    const r = await sb("push_subs?select=endpoint,follows", {
      headers: { Range: debut + "-" + (debut + 999), "Range-Unit": "items" },
    });
    const page = await r.json();
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

async function lireEtat(k) {
  const r = await sb("push_state?k=eq." + encodeURIComponent(k) + "&select=v");
  const l = await r.json();
  return l.length ? l[0].v : null;
}

async function ecrireEtat(k, v) {
  await sb("push_state", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ k, v, updated_at: new Date().toISOString() }),
  });
}

/* Un abonnement mort (404/410) ne guérit jamais : appli désinstallée, profil
   du navigateur effacé. On le retire, sinon la table gonfle et chaque envoi
   traîne des destinataires fantômes. */
async function oublier(endpoint) {
  try { await sb("push_subs?endpoint=eq." + encodeURIComponent(endpoint), { method: "DELETE" }); }
  catch { /* on réessaiera au prochain envoi */ }
}

/* ---------------------------------------------------------------- Envoi */
async function pousser(endpoint, ctx) {
  let audience;
  try { audience = new URL(endpoint).origin; }
  catch { return { statut: 0, mort: true }; }

  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        TTL: "86400",                                  // gardé 24 h si l'appareil est éteint
        Urgency: "normal",
        Authorization: "vapid t=" + jeton(audience, ctx.cle) + ", k=" + ctx.pub,
      },
      signal: AbortSignal.timeout(10000),
    });
    return { statut: r.status, mort: r.status === 404 || r.status === 410 };
  } catch (e) {
    return { statut: 0, mort: false, erreur: e.message };
  }
}

/* Envoi groupé, 20 à la fois : assez pour ne pas y passer la journée, assez
   peu pour ne pas se faire limiter par les services de push. */
async function envoyerA(cibles, journal) {
  const ctx = contexteSignature();
  const bilan = { envoyes: 0, morts: 0, echecs: 0 };
  for (let i = 0; i < cibles.length; i += 20) {
    const lot = cibles.slice(i, i + 20);
    const res = await Promise.all(lot.map(c => pousser(c.endpoint, ctx)));
    for (let j = 0; j < res.length; j++) {
      const r = res[j];
      if (r.mort) { bilan.morts++; await oublier(lot[j].endpoint); }
      else if (r.statut >= 200 && r.statut < 300) bilan.envoyes++;
      else {
        bilan.echecs++;
        if (journal) journal("push refusé (" + r.statut + (r.erreur ? " " + r.erreur : "") + ")");
      }
    }
  }
  return bilan;
}

/* ------------------------------------------------------------ Le guetteur
   Compare les sorties publiées (push/latest.json, écrit au déploiement) à ce
   qui a déjà été annoncé. Rien de nouveau : rien n'est envoyé.

   AMORÇAGE — au tout premier passage, la mémoire est vide : TOUT paraîtrait
   nouveau et les abonnés recevraient dix notifications d'affilée. On se
   contente donc d'enregistrer l'état du jour et on n'envoie rien. */
async function guetter(opts) {
  const o = opts || {};
  const site = (o.site || process.env.URL || "").replace(/\/+$/, "");
  const journal = o.journal || (() => {});
  if (!configure()) return { ok: false, raison: "variables manquantes : " + manque().join(", ") };

  let sorties;
  try {
    const r = await fetch(site + "/push/latest.json", { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    sorties = (await r.json()).sorties || [];
  } catch (e) {
    return { ok: false, raison: "push/latest.json illisible (" + e.message + ")" };
  }
  if (!sorties.length) return { ok: false, raison: "aucune sortie dans push/latest.json" };

  const courant = {};
  sorties.forEach(s => { courant[s.id] = s.sig; });

  const memoire = await lireEtat("last");
  if (!memoire || !memoire.sigs) {
    await ecrireEtat("last", { sigs: courant });
    journal("amorçage : état du jour mémorisé");
    // Sauf demande expresse : un envoi forcé sert justement à vérifier que la
    // chaîne marche, on ne va pas lui répondre « reviens plus tard ». Sans ce
    // cas, la toute première commande de test ne sonne jamais et on la croit
    // cassée.
    if (!o.forcer) return { ok: true, amorcage: true, series: Object.keys(courant).length };
  }

  const connues = (memoire && memoire.sigs) || courant;
  const nouvelles = sorties.filter(s => connues[s.id] !== s.sig);
  if (!nouvelles.length && !o.forcer) return { ok: true, rien: true };

  const concernees = new Set(nouvelles.map(s => s.id));
  const tous = await abonnes();
  // Chacun ne reçoit que ce qu'il a demandé : « toutes les sorties » (liste de
  // suivis vide) ou une série qu'il suit. Un téléphone réveillé pour rien,
  // c'est un désabonnement.
  const cibles = o.forcer ? tous : tous.filter(s => {
    const f = Array.isArray(s.follows) ? s.follows : [];
    return !f.length || f.some(x => concernees.has(x));
  });

  journal((o.forcer ? "envoi forcé" : nouvelles.map(s => s.sig).join(", ")) +
          " → " + cibles.length + " abonné(s) sur " + tous.length);

  const bilan = cibles.length ? await envoyerA(cibles, journal) : { envoyes: 0, morts: 0, echecs: 0 };

  // La mémoire est mise à jour même si des envois ont échoué : réessayer
  // dans 15 min notifierait deux fois ceux que ça a atteint.
  if (nouvelles.length) await ecrireEtat("last", { sigs: courant });

  return {
    ok: true,
    nouvelles: nouvelles.map(s => ({ serie: s.id, chapitre: s.num })),
    abonnes: tous.length,
    cibles: cibles.length,
    ...bilan,
  };
}

/* ------------------------------------------ Partagé avec l'annonce Discord
   (netlify/discord-lib.js) : le même carnet de sorties et la même table de
   mémoire, sous une autre clé. Discord n'a besoin que de Supabase, pas des
   clés VAPID — il doit pouvoir marcher même si le push est coupé. */
const supabasePret = () => !!(SUPABASE && SERVICE);

async function lireSorties(site) {
  const r = await fetch(site.replace(/\/+$/, "") + "/push/latest.json", { signal: AbortSignal.timeout(10000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return (await r.json()).sorties || [];
}

module.exports = { configure, manque, guetter, abonnes, envoyerA, contexteSignature,
                   supabasePret, lireSorties, lireEtat, ecrireEtat };
