/* =========================================================================
   LanorTrad — Edge function : métadonnées et pré-rendu pour les robots.

   Le site est rendu côté navigateur : sans JavaScript, /manga.html et
   /reader.html sont des coquilles vides. Or les robots des réseaux sociaux
   (Discord, X, Facebook…) n'exécutent aucun JS, et les moteurs de recherche
   n'en exécutent qu'au second passage, avec un budget limité.

   Ici, pour ces robots uniquement, on injecte les vraies balises (titre,
   description, canonical, OpenGraph, JSON-LD) et un pré-rendu minimal du
   contenu, lus dans /og-meta.json (généré au build par scripts/build-seo.js).
   Le contenu injecté est un sous-ensemble fidèle de ce que voit un visiteur :
   aucun texte n'est réservé aux robots.

   Les vrais visiteurs passent sans surcoût — la page leur est servie
   inchangée, et leur JavaScript fait le reste.
   ========================================================================= */
const BOTS = /facebookexternalhit|Twitterbot|Discordbot|Slackbot|WhatsApp|LinkedInBot|TelegramBot|Pinterest|redditbot|Googlebot|Google-InspectionTool|bingbot|DuckDuckBot|Applebot|YandexBot|embedly|vkShare|SkypeUriPreview|W3C_Validator/i;

const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const clean = x => String(x == null ? "" : x).replace(/\s+/g, " ").trim();
const cut = (x, n) => (x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

/* Remplace <title>, ajoute des balises avant </head>, remplit le conteneur. */
function inject(html, { title, head, mountRe, body }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`)
                .replace(/<\/head>/i, head + "</head>");
  if (mountRe && body) out = out.replace(mountRe, body);
  return out;
}

function ldTag(obj) {
  // </script> ne peut pas apparaître tel quel à l'intérieur d'un <script>.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

function metaTags({ title, desc, image, url, type }) {
  return `
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="LanorTrad">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:url" content="${esc(url)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${esc(image)}">
`;
}

/* ------------------------------ fiche série ------------------------------ */
function seriesPage(s, id, site) {
  const title = `${s.title} — Scan VF à lire en ligne | LanorTrad`;
  const genres = (s.genres || []).join(", ");
  const desc = cut(clean(`Lis ${s.title} en français, gratuitement. ${s.description || ""}`), 300);
  const url = `${site}/manga.html?id=${encodeURIComponent(id)}`;
  const image = site + "/" + encodeURI(s.cover || "");
  const readUrl = `${site}/reader.html?manga=${encodeURIComponent(id)}`;

  const last = (s.chapters || [])[0];
  const body = `<article>`
    + `<h1>${esc(s.title)}</h1>`
    + (s.status ? `<p><strong>Statut :</strong> ${esc(s.status)}</p>` : "")
    + (s.author ? `<p><strong>Auteur :</strong> ${esc(s.author)}</p>` : "")
    + (genres ? `<p><strong>Genres :</strong> ${esc(genres)}</p>` : "")
    + `<p>${esc(clean(s.description))}</p>`
    + `<p><a href="${esc(readUrl)}">Lire ${esc(s.title)} en ligne</a></p>`
    + ((s.chapters || []).length
      ? `<h2>Chapitres (${s.chapters.length})</h2><ul>` + s.chapters.slice(0, 300).map(c =>
          `<li><a href="${esc(`${site}/reader.html?manga=${encodeURIComponent(id)}&chapter=${encodeURIComponent(c.n)}`)}">${esc(s.title)} chapitre ${esc(c.n)}</a></li>`
        ).join("") + `</ul>`
      : "")
    + `</article>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: site + "/" },
      { "@type": "ListItem", position: 2, name: "Catalogue", item: site + "/catalogue.html" },
      { "@type": "ListItem", position: 3, name: s.title, item: url },
    ],
  };

  return {
    title,
    head: metaTags({ title, desc, image, url, type: "book" }) + "  " + ldTag(ld) + "\n",
    mountRe: /<main id="series-root">\s*<\/main>/i,
    body: `<main id="series-root">${body}</main>`,
    lastmod: last ? s.updated : s.updated,
  };
}

/* --------------------------- page de chapitre ---------------------------
   C'est là que se joue la longue traîne : « <série> chapitre 240 vf ».
   Sans ce pré-rendu, les ~540 URLs de lecture du sitemap étaient des pages
   vides partageant toutes le même titre. */
function chapterPage(s, id, num, site) {
  const list = s.chapters || [];
  const i = list.findIndex(c => String(c.n) === String(num));
  if (i < 0) return null;
  const c = list[i];
  const oneshot = s.type === "oneshot";
  // La liste va du plus récent au plus ancien.
  const next = list[i - 1], prev = list[i + 1];

  const label = oneshot ? `${s.title} (oneshot)` : `${s.title} — Chapitre ${c.n}`;
  const title = `${label} VF à lire en ligne | LanorTrad`;
  const desc = cut(clean(
    oneshot
      ? `Lis ${s.title} en français, gratuitement, sur LanorTrad. ${c.p ? c.p + " pages, " : ""}traduit et édité par la team.`
      : `Lis le chapitre ${c.n} de ${s.title} en français, gratuitement, sur LanorTrad. ${c.p ? c.p + " pages, " : ""}traduites et éditées par la team.`
  ), 300);
  const url = `${site}/reader.html?manga=${encodeURIComponent(id)}&chapter=${encodeURIComponent(c.n)}`;
  const image = site + "/" + encodeURI(s.cover || "");
  const seriesUrl = `${site}/manga.html?id=${encodeURIComponent(id)}`;
  const chapUrl = n => `${site}/reader.html?manga=${encodeURIComponent(id)}&chapter=${encodeURIComponent(n)}`;

  const body = `<div id="reader-root"><article>`
    + `<h1>${esc(label)}</h1>`
    + `<p>${esc(desc)}</p>`
    + `<p><a href="${esc(seriesUrl)}">Fiche de ${esc(s.title)}</a></p>`
    + `<nav>`
    + (prev ? `<a rel="prev" href="${esc(chapUrl(prev.n))}">Chapitre ${esc(prev.n)}</a> ` : "")
    + (next ? `<a rel="next" href="${esc(chapUrl(next.n))}">Chapitre ${esc(next.n)}</a>` : "")
    + `</nav>`
    + `</article></div>`;

  const head = metaTags({ title, desc, image, url, type: "article" })
    + (prev ? `  <link rel="prev" href="${esc(chapUrl(prev.n))}">\n` : "")
    + (next ? `  <link rel="next" href="${esc(chapUrl(next.n))}">\n` : "")
    + "  " + ldTag({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Chapter",
          name: label,
          url,
          inLanguage: "fr",
          position: Number(c.n) || undefined,
          isPartOf: { "@type": "Book", name: s.title, url: seriesUrl, inLanguage: "fr" },
          publisher: { "@type": "Organization", name: "LanorTrad", url: site + "/" },
        },
        {
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Accueil", item: site + "/" },
            { "@type": "ListItem", position: 2, name: s.title, item: seriesUrl },
            { "@type": "ListItem", position: 3, name: oneshot ? "Lecture" : `Chapitre ${c.n}`, item: url },
          ],
        },
      ],
    }) + "\n";

  return { title, head, mountRe: /<div id="reader-root">\s*<\/div>/i, body };
}

/* Exportés pour scripts/test-og.mjs (`node scripts/test-og.mjs`). */
export { seriesPage as _seriesPage, chapterPage as _chapterPage, inject as _inject };

/* --------------------------------- main --------------------------------- */
export default async (request, context) => {
  const ua = request.headers.get("user-agent") || "";
  if (!BOTS.test(ua)) return;                        // visiteur normal → page inchangée

  const url = new URL(request.url);
  const isReader = /\/reader\.html$/i.test(url.pathname);
  const id = url.searchParams.get(isReader ? "manga" : "id");
  if (!id) return;

  try {
    const metaRes = await fetch(new URL("/og-meta.json", url.origin), {
      headers: { "cache-control": "max-age=300" },
    });
    if (!metaRes.ok) return;
    const s = (await metaRes.json())[id];
    if (!s) return;

    const site = url.origin;
    const plan = isReader
      ? chapterPage(s, id, url.searchParams.get("chapter") || (s.chapters || [])[0]?.n, site)
      : seriesPage(s, id, site);
    if (!plan) return;                               // chapitre inconnu → page d'origine

    const res = await context.next();
    if (!(res.headers.get("content-type") || "").includes("text/html")) return res;

    const html = inject(await res.text(), plan);
    const headers = new Headers(res.headers);
    headers.delete("content-length");
    return new Response(html, { status: res.status, headers });
  } catch (_) {
    return;                                          // en cas de pépin : page d'origine
  }
};
