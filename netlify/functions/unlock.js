/* =========================================================================
   LanorTrad — Validation des codes Premium (Netlify Function).
   Définissez la variable d'environnement PREMIUM_CODES sur Netlify
   (Site settings → Environment variables), ex :
       PREMIUM_CODES = LANOR-AB12, LANOR-CD34, LANOR-EF56
   Donnez un code à chaque membre après son paiement (Tipeee/Ko-fi/Patreon).
   ========================================================================= */
exports.handler = async (event) => {
  const code = ((event.queryStringParameters && event.queryStringParameters.code) || "").trim().toUpperCase();
  const valid = (process.env.PREMIUM_CODES || "")
    .split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
  const ok = !!code && valid.includes(code);
  return {
    statusCode: ok ? 200 : 403,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ valid: ok })
  };
};
