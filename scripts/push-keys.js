/* =========================================================================
   LanorTrad — Génère la paire de clés VAPID des notifications push.
   À lancer UNE SEULE FOIS, sur ta machine :   node scripts/push-keys.js

   Ce que ça sort :
     • une clé PUBLIQUE  → à coller dans js/push-config.js (elle est publique,
       elle part dans le navigateur de chaque visiteur, c'est normal) ;
     • une clé PRIVÉE    → à coller dans Netlify, variable VAPID_PRIVATE.
       Celle-là ne doit apparaître NULLE PART dans le dépôt : c'est elle qui
       prouve aux services de push (Google, Mozilla, Apple) que l'envoi vient
       bien de toi. Qui l'a peut notifier tes lecteurs à ta place.

   Si tu regénères la paire un jour, TOUS les abonnements existants deviennent
   inutilisables (ils sont liés à la clé publique de l'époque) : il faudrait
   vider la table push_subs et laisser les lecteurs se réabonner. Donc : on la
   génère une fois, et on la garde.

   N'utilise que des modules Node natifs.
   ========================================================================= */
"use strict";
const crypto = require("node:crypto");

const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });

// Formats attendus par le Web Push (RFC 8292) : le point public NON COMPRESSÉ
// sur 65 octets, et la valeur privée brute sur 32 octets, tous deux en
// base64url. Les DER exportés par Node portent un en-tête de longueur fixe
// qu'on retire ici (26 octets pour SPKI, 36 pour PKCS8 sur cette courbe).
const pub = publicKey.export({ type: "spki", format: "der" }).subarray(26);
const priv = privateKey.export({ type: "pkcs8", format: "der" }).subarray(36, 68);

if (pub.length !== 65 || priv.length !== 32) {
  console.error("Format inattendu — clés non générées. Version de Node trop ancienne ?");
  process.exit(1);
}

console.log(`
================ CLÉS DE NOTIFICATION LANORTRAD ================

1) Clé PUBLIQUE — à coller dans js/push-config.js :

   self.LT_PUSH = {
     publicKey: "${pub.toString("base64url")}"
   };

2) Clé PRIVÉE — Netlify → Site configuration → Environment variables :

   VAPID_PRIVATE = ${priv.toString("base64url")}

   Ajoute aussi, au même endroit :
   VAPID_SUBJECT = mailto:lanortradprofessionnel@gmail.com
   PUSH_SECRET   = ${crypto.randomBytes(24).toString("base64url")}
   SUPABASE_URL           = (l'URL de ton projet Supabase)
   SUPABASE_SERVICE_ROLE  = (Supabase → Project Settings → API → service_role)

⚠️  Ne committe JAMAIS la clé privée. Ne la regénère pas une fois le site en
    ligne : tous les abonnements en cours deviendraient muets.

================================================================
`);
