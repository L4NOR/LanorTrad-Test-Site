/* =========================================================================
   LanorTrad — Le guetteur Discord (fonction PLANIFIÉE).

   Même horloge et même logique que push-watch.js : Netlify la réveille
   toute seule (voir netlify.toml), elle compare les sorties publiées à ce
   qui a déjà été annoncé, et ne poste dans le salon que le neuf.

   Séparée de push-watch exprès : le salon Discord doit être prévenu même si
   les notifications push sont coupées, et une panne de Discord ne doit pas
   retarder les notifications (ni l'inverse).

   Pour tester sans attendre : push-send.js avec ?discord=1.
   ========================================================================= */
"use strict";
const discord = require("../discord-lib.js");

exports.handler = async () => {
  const lignes = [];
  const r = await discord.annoncer({ journal: m => { lignes.push(m); console.log("[discord] " + m); } });
  if (!r.ok) console.log("[discord] rien posté — " + r.raison);
  else if (r.rien) console.log("[discord] aucune sortie nouvelle");
  return { statusCode: 200, body: JSON.stringify(Object.assign({ journal: lignes }, r)) };
};
