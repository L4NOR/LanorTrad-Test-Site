/* =========================================================================
   LanorTrad — Déclenchement MANUEL des notifications.

   À quoi ça sert : tester que la chaîne marche sans attendre le prochain
   passage du guetteur, et rattraper un envoi raté. Rien d'autre — le cas
   normal est automatique (push-watch.js).

   Protégée par PUSH_SECRET : sans ce mot de passe, la fonction ne fait rien.
   Sinon, n'importe qui pourrait faire sonner tous les téléphones abonnés.

   USAGE (remplace <secret> et <site>) :

     # Est-ce que tout est branché ? (ne notifie personne)
     curl "https://<site>/.netlify/functions/push-send?secret=<secret>&etat=1"

     # Envoyer maintenant, s'il y a du nouveau (comme le guetteur)
     curl -X POST "https://<site>/.netlify/functions/push-send?secret=<secret>"

     # Forcer un envoi à TOUS les abonnés (test réel : ça sonne vraiment)
     curl -X POST "https://<site>/.netlify/functions/push-send?secret=<secret>&forcer=1"

     # Annonce Discord : reposter la dernière sortie dans le salon (test)
     curl -X POST "https://<site>/.netlify/functions/push-send?secret=<secret>&discord=1&forcer=1"
   ========================================================================= */
"use strict";
const push = require("../push-lib.js");

exports.handler = async (event) => {
  const q = (event && event.queryStringParameters) || {};
  const attendu = process.env.PUSH_SECRET || "";
  const donne = q.secret || (event.headers && (event.headers["x-push-secret"] || event.headers["X-Push-Secret"])) || "";

  const refus = { statusCode: 401, body: JSON.stringify({ ok: false, raison: "secret invalide" }) };
  if (!attendu) return { statusCode: 503, body: JSON.stringify({ ok: false, raison: "PUSH_SECRET non configuré" }) };
  if (donne.length !== attendu.length) return refus;
  // Comparaison à temps constant : une comparaison ordinaire laisse deviner le
  // secret caractère par caractère, en mesurant le temps de réponse.
  const a = Buffer.from(donne), b = Buffer.from(attendu);
  if (a.length !== b.length || !require("node:crypto").timingSafeEqual(a, b)) return refus;

  // Mode « état » : dit ce qui manque, sans rien envoyer.
  if (q.etat) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: push.configure(),
        manque: push.manque(),
        abonnes: push.configure() ? (await push.abonnes().catch(() => [])).length : null,
        discord_manque: require("../discord-lib.js").manque(),
        site: process.env.URL || null,
      }, null, 1),
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ ok: false, raison: "POST attendu (ou ?etat=1)" }) };
  }

  // Annonce Discord (netlify/discord-lib.js) plutôt que push. Avec &forcer=1,
  // reposte la dernière sortie même déjà annoncée : c'est le test.
  if (q.discord) {
    const journal = [];
    const d = await require("../discord-lib.js").annoncer({ forcer: !!q.forcer, journal: m => { journal.push(m); console.log("[discord] " + m); } });
    return {
      statusCode: d.ok ? 200 : 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ journal }, d), null, 1),
    };
  }

  const lignes = [];
  const r = await push.guetter({ forcer: !!q.forcer, journal: m => { lignes.push(m); console.log("[push] " + m); } });
  return {
    statusCode: r.ok ? 200 : 500,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ journal: lignes }, r), null, 1),
  };
};
