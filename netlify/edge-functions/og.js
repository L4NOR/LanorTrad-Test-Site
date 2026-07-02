/* =========================================================================
   LanorTrad — Edge function OpenGraph (fiche série).
   Les robots des réseaux sociaux (Discord, Twitter/X, Facebook…) n'exécutent
   pas le JavaScript : sans ça, le partage d'une fiche montrerait toujours
   l'aperçu générique. Ici, pour ces robots uniquement, on injecte les balises
   OG/Twitter de la bonne série (lues dans /og-meta.json généré au build).
   Les vrais visiteurs passent sans surcoût (le JS de la page gère leur cas).
   ========================================================================= */
const BOTS = /facebookexternalhit|Twitterbot|Discordbot|Slackbot|WhatsApp|LinkedInBot|TelegramBot|Pinterest|redditbot|Googlebot|bingbot|DuckDuckBot|Applebot|embedly|vkShare|SkypeUriPreview|W3C_Validator/i;

const esc = x => String(x).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export default async (request, context) => {
  const ua = request.headers.get("user-agent") || "";
  if (!BOTS.test(ua)) return;                       // visiteur normal → page inchangée

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return;

  try {
    const metaRes = await fetch(new URL("/og-meta.json", url.origin), { headers: { "cache-control": "max-age=300" } });
    if (!metaRes.ok) return;
    const s = (await metaRes.json())[id];
    if (!s) return;

    const res = await context.next();
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("text/html")) return res;

    const site = url.origin;
    const title = `${s.title} — LanorTrad`;
    const desc = `Lisez ${s.title} en français sur LanorTrad. ${(s.description || "").replace(/\s+/g, " ")}`.slice(0, 200);
    const image = site + "/" + encodeURI(s.cover);
    const pageUrl = site + "/manga.html?id=" + encodeURIComponent(id);
    const genresList = (s.genres || []).join(", ");

    // Pré-rendu minimal (titre + synopsis + genres) injecté dans le <main> pour
    // que les crawlers voient un vrai contenu sans exécuter le JS.
    const prerender = `<article>`
      + `<h1>${esc(s.title)}</h1>`
      + (s.status ? `<p><strong>Statut :</strong> ${esc(s.status)}</p>` : "")
      + (genresList ? `<p><strong>Genres :</strong> ${esc(genresList)}</p>` : "")
      + `<p>${esc((s.description || "").replace(/\s+/g, " "))}</p>`
      + `<p><a href="${esc(site + "/reader.html?manga=" + encodeURIComponent(id))}">Lire ${esc(s.title)} en ligne</a></p>`
      + `</article>`;

    const tags = `
  <link rel="canonical" href="${esc(pageUrl)}">
  <meta property="og:type" content="book">
  <meta property="og:site_name" content="LanorTrad">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${esc(pageUrl)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(image)}">
`;

    let html = await res.text();
    html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
               .replace(/<\/head>/i, tags + "</head>")
               .replace(/<main id="series-root">\s*<\/main>/i, `<main id="series-root">${prerender}</main>`);

    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(html, { status: res.status, headers });
  } catch (_) {
    return;                                          // en cas de pépin : page d'origine
  }
};
