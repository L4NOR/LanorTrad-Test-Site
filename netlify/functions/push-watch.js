/* =========================================================================
   LanorTrad — Le guetteur de sorties (fonction PLANIFIÉE).

   Netlify la réveille toute seule (voir netlify.toml : [functions."push-watch"]
   schedule). Elle compare les sorties publiées à ce qui a déjà été annoncé, et
   n'envoie des notifications que s'il y a vraiment du nouveau.

   POURQUOI UNE HORLOGE ET PAS LE DÉPLOIEMENT
   Le plus simple aurait été d'envoyer à la fin du build. Mais à ce moment-là
   le site n'est pas encore en ligne : les lecteurs cliqueraient sur une
   notification annonçant un chapitre que le serveur ne sert pas encore. En
   passant par une horloge, on n'annonce que ce qui est réellement publié.

   Une fonction planifiée n'est PAS joignable depuis l'extérieur : c'est voulu.
   Pour la déclencher à la main (test), voir push-send.js.
   ========================================================================= */
"use strict";
const push = require("../push-lib.js");

exports.handler = async () => {
  const lignes = [];
  const journal = m => { lignes.push(m); console.log("[push] " + m); };

  const r = await push.guetter({ journal });

  if (!r.ok) console.log("[push] rien envoyé — " + r.raison);
  else if (r.rien) console.log("[push] aucune sortie nouvelle");
  else if (!r.amorcage) console.log("[push] " + r.envoyes + " envoyée(s), " + r.morts + " abonnement(s) mort(s) retiré(s), " + r.echecs + " échec(s)");

  return { statusCode: 200, body: JSON.stringify(Object.assign({ journal: lignes }, r)) };
};
