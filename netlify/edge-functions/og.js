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
/* Robots qui reçoivent le pré-rendu.

   C'est le point faible de cette approche : un robot absent de cette liste ne
   voit qu'une coquille vide. Elle doit donc rester à jour — c'est cinq minutes
   de travail, contre plusieurs jours pour l'alternative (pages statiques, ce
   qui imposerait de changer toutes les URLs).

   Volontairement ABSENTS : les robots d'IA (GPTBot, ClaudeBot, PerplexityBot,
   CCBot…). Ils crawlent déjà le site, mais leur donner en plus le contenu
   pré-rendu relève d'un choix éditorial sur du scantrad, pas d'une décision
   technique. À ajouter ici si la team le décide. */
const BOTS = new RegExp([
  // Moteurs de recherche
  "Googlebot", "Google-InspectionTool", "Storebot-Google", "AdsBot-Google",
  "bingbot", "BingPreview", "DuckDuckBot", "YandexBot", "Applebot",
  "Baiduspider", "Sogou", "SeznamBot", "MojeekBot", "Yeti",
  // Qwant et Exalead : moteurs français, notre public
  "Qwantify", "ExaBot",
  // Aperçus de partage
  "facebookexternalhit", "facebookcatalog", "Twitterbot", "Discordbot",
  "Slackbot", "WhatsApp", "LinkedInBot", "TelegramBot", "Pinterest",
  "redditbot", "SkypeUriPreview", "vkShare", "embedly",
  // Fediverse et Bluesky : de vrais canaux de partage aujourd'hui
  "Mastodon", "Misskey", "Akkoma", "Pleroma", "Cardyb", "Bluesky",
  "Discourse Forum Onebox",
  // Archivage et validation
  "archive.org_bot", "ia_archiver", "W3C_Validator",
].join("|"), "i");

const esc = x => String(x == null ? "" : x).replace(/[&<>"]/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const clean = x => String(x == null ? "" : x).replace(/\s+/g, " ").trim();

/* Adresses lisibles (voir netlify.toml). Le slug est la SEULE chose que
   transporte l'URL : « Tougen Anki » y devient « tougen-anki ». Meme regle
   exactement que js/core.js (slugify) et scripts/build-seo.js — si l'une des
   trois derive, les canonical ne pointent plus sur les pages du sitemap. */
const slugify = x => String(x == null ? "" : x).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/[^A-Za-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").toLowerCase();
const uSerie    = (site, id) => `${site}/manga/${slugify(id)}/`;
const uChapitre = (site, id, n) => `${uSerie(site, id)}chapitre-${encodeURIComponent(n)}/`;
const uGenre    = (site, g) => `${site}/genre/${slugify(g)}/`;
/* L'URL ne porte que le slug : on retrouve la cle reelle de og-meta.json. */
function resoudreId(meta, key) {
  if (!key) return null;
  if (meta[key]) return key;
  const k = slugify(key);
  return Object.keys(meta).find(x => slugify(x) === k) || null;
}
/* Chapitre affiche quand l'adresse n'en precise aucun (/manga/<slug>/lecture/) :
   le PLUS ANCIEN, exactement ce qu'ouvre le lecteur dans ce cas. */
const chapitreParDefaut = s => (s.chapters || [])[(s.chapters || []).length - 1];
const cut = (x, n) => (x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");

/* Remplace <title>, ajoute des balises avant </head>, remplit le conteneur.

   Les balises que l'on s'apprete a reecrire sont d'abord RETIREES. Sans ca,
   celles du fichier HTML restent en place, et comme elles sont ecrites plus
   haut dans le <head>, ce sont ELLES que les robots retiennent : Discord et
   Facebook prennent la premiere og:image trouvee. Resultat, la vignette
   generique du site s'affichait a la place de la carte de la serie, et la
   fiche partageait le titre generique.
   Pire sur le catalogue, qui a un canonical statique : deux canonical
   contradictoires dans la meme page. */
const AVIRER = [
  /[ \t]*<meta\s+property="og:[^"]*"[^>]*>[ \t]*\r?\n?/gi,
  /[ \t]*<meta\s+name="twitter:[^"]*"[^>]*>[ \t]*\r?\n?/gi,
  /[ \t]*<meta\s+name="description"[^>]*>[ \t]*\r?\n?/gi,
  /[ \t]*<link\s+rel="canonical"[^>]*>[ \t]*\r?\n?/gi,
];

function inject(html, { title, head, mountRe, body }) {
  let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  for (const re of AVIRER) out = out.replace(re, "");
  out = out.replace(/<\/head>/i, head + "</head>");
  if (mountRe && body) out = out.replace(mountRe, body);
  return out;
}

function ldTag(obj) {
  // </script> ne peut pas apparaître tel quel à l'intérieur d'un <script>.
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

function metaTags({ title, desc, image, url, type, card }) {
  return `
  <meta name="description" content="${esc(desc)}">
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="${type}">
  <meta property="og:site_name" content="LanorTrad">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:image" content="${esc(image)}">
` + (card ? `  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(title)}">
` : "") + `  <meta property="og:url" content="${esc(url)}">
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
  const url = uSerie(site, id);
  // Vignette de partage paysage si elle existe (tools/build-og.py) : les
  // reseaux sociaux affichent un 1200x630 et recadrent brutalement une
  // couverture portrait. Repli sur la couverture si la vignette manque.
  const image = site + "/" + encodeURI(s.og || s.cover || "");
  const cover = site + "/" + encodeURI(s.cover || "");
  const readUrl = url + "lecture/";

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
          `<li><a href="${esc(uChapitre(site, id, c.n))}">${esc(s.title)} chapitre ${esc(c.n)}</a></li>`
        ).join("") + `</ul>`
      : "")
    + `</article>`;

  /* Donnees structurees de l'oeuvre. Elles n'existaient que cote navigateur
     (js/manga.js) : Googlebot, qui ne rend pas le JS au premier passage, ne
     voyait qu'un fil d'Ariane. On reproduit ici le MEME objet, notes de
     lecteurs comprises — c'est ce qui declenche les etoiles dans les
     resultats de recherche.
     L'aggregateRating n'est pose que s'il y a de vraies notes (instantane pris
     au build, voir scripts/build-seo.js) : jamais la note editoriale de
     series.js, qui n'est pas une moyenne de votes. */
  const oneshot = s.type === "oneshot";
  const work = {
    "@type": oneshot ? "Book" : "ComicSeries",
    name: s.title,
    genre: s.genres || [],
    inLanguage: "fr",
    // Ici c'est bien la COUVERTURE : Google veut l'image de l'oeuvre, pas la
    // carte de partage qui n'existe que pour les reseaux sociaux.
    image: cover,
    description: clean(s.description),
    url,
  };
  if (s.author) work.author = { "@type": "Person", name: s.author };
  if (s.artist && s.artist !== s.author) work.illustrator = { "@type": "Person", name: s.artist };
  if (s.year) work.datePublished = String(s.year);
  if (oneshot) work.bookFormat = "https://schema.org/GraphicNovel";
  else if (s.count) work.numberOfEpisodes = s.count;
  if (s.rating && s.rating.v >= 2) {
    work.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: s.rating.s, bestRating: 5, worstRating: 1, ratingCount: s.rating.v,
    };
  }
  if (last && s.updated) work.dateModified = s.updated;
  work.publisher = { "@type": "Organization", name: "LanorTrad", url: site + "/" };

  const crumbs = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: site + "/" },
      { "@type": "ListItem", position: 2, name: "Catalogue", item: site + "/catalogue.html" },
      { "@type": "ListItem", position: 3, name: s.title, item: url },
    ],
  };
  const ld = { "@context": "https://schema.org", "@graph": [work, crumbs] };

  return {
    title,
    head: metaTags({ title, desc, image, url, type: "book", card: !!s.og }) + "  " + ldTag(ld) + "\n",
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
  /* Description : quand la team a laissé une note d'intro sur ce chapitre, on
     la met en avant. Sans elle, les ~540 chapitres partagent une phrase
     quasi identique ; avec, chaque chapitre a un extrait qui lui est propre —
     c'est ce qui s'affiche sous le lien dans les résultats de recherche. */
  const desc = cut(clean(
    (oneshot
      ? `Lis ${s.title} en français, gratuitement, sur LanorTrad. ${c.p ? c.p + " pages, " : ""}traduit et édité par la team.`
      : `Lis le chapitre ${c.n} de ${s.title} en français, gratuitement, sur LanorTrad. ${c.p ? c.p + " pages, " : ""}traduites et éditées par la team.`)
    + (c.nt && c.nt.i ? " " + c.nt.i : "")
  ), 300);
  const url = uChapitre(site, id, c.n);
  const image = site + "/" + encodeURI(s.og || s.cover || "");
  const seriesUrl = uSerie(site, id);
  const chapUrl = n => uChapitre(site, id, n);

  /* Notes de traduction. C'est le seul texte ORIGINAL d'une page de lecture :
     tout le reste est une image. Un moteur n'a donc rien a se mettre sous la
     dent sur les ~540 pages de chapitre, sauf ici. C'est aussi, litteralement,
     ce que le lecteur voit en bas du chapitre. */
  const nt = c.nt;
  const notesHtml = nt
    ? `<section><h2>Notes de traduction</h2>`
      + (nt.i ? `<p>${esc(nt.i)}</p>` : "")
      + `<ul>` + nt.n.map(x =>
          `<li>${x.p ? `p. ${esc(x.p)} — ` : ""}${esc(x.t)}</li>`).join("") + `</ul>`
      + `</section>`
    : "";

  const body = `<div id="reader-root"><article>`
    + `<h1>${esc(label)}</h1>`
    + `<p>${esc(desc)}</p>`
    + `<p><a href="${esc(seriesUrl)}">Fiche de ${esc(s.title)}</a></p>`
    + notesHtml
    + `<nav>`
    + (prev ? `<a rel="prev" href="${esc(chapUrl(prev.n))}">Chapitre ${esc(prev.n)}</a> ` : "")
    + (next ? `<a rel="next" href="${esc(chapUrl(next.n))}">Chapitre ${esc(next.n)}</a>` : "")
    + `</nav>`
    + `</article></div>`;

  const head = metaTags({ title, desc, image, url, type: "article", card: !!s.og })
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
          // Date de sortie reelle, figee le jour ou le chapitre est apparu
          // (tools/build-data.py). Absente pour l'historique anterieur : mieux
          // vaut rien qu'une date inventee.
          datePublished: c.d || undefined,
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

/* --------------------------- catalogue par genre ---------------------------
   /catalogue.html?genre=Horreur repond a une vraie requete (« manga d'horreur
   en francais »). Mais la grille est remplie par JavaScript : sans pre-rendu,
   un robot n'y voit qu'un formulaire de filtres et rien d'autre.
   On lui sert donc le titre, la description et la LISTE des series du genre —
   exactement ce que le visiteur voit une fois le JS execute. */
function genrePage(meta, genre, site) {
  // On retrouve le genre quelle que soit la casse ou les accents de l'URL.
  // La ponctuation saute aussi : l'adresse propre d'un genre est un slug
  // (« science-fiction »), la requete historique un libelle (« Science-Fiction »).
  const norm = x => String(x).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "");
  const cible = norm(genre);
  const hits = [];
  let libelle = null;
  for (const [id, s] of Object.entries(meta)) {
    const g = (s.genres || []).find(x => norm(x) === cible);
    if (g) { libelle = libelle || g; hits.push([id, s]); }
  }
  if (!libelle || !hits.length) return null;

  hits.sort((a, b) => String(b[1].updated || "").localeCompare(String(a[1].updated || "")));
  const n = hits.length;
  const title = `Manga ${libelle} en français — Catalogue LanorTrad`;
  const desc = cut(clean(`${n} série${n > 1 ? "s" : ""} de manga ${libelle.toLowerCase()} traduite${n > 1 ? "s" : ""} en français par LanorTrad, à lire gratuitement en ligne : `
    + hits.map(h => h[1].title).join(", ") + "."), 300);
  const url = uGenre(site, libelle);

  const body = `<main><article><h1>Catalogue ${esc(libelle)}</h1>`
    + `<p>${esc(desc)}</p><ul>`
    + hits.map(([id, s]) =>
        `<li><a href="${esc(uSerie(site, id))}">${esc(s.title)}</a>`
        + (s.status ? ` — ${esc(s.status)}` : "")
        + (s.chapters && s.chapters.length ? ` (${s.chapters.length} chapitres)` : "")
        + `</li>`).join("")
    + `</ul></article></main>`;

  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage", name: title, url, inLanguage: "fr", description: desc,
        mainEntity: {
          "@type": "ItemList",
          numberOfItems: n,
          itemListElement: hits.map(([id, s], i) => ({
            "@type": "ListItem", position: i + 1, name: s.title,
            url: uSerie(site, id),
          })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: site + "/" },
          { "@type": "ListItem", position: 2, name: "Catalogue", item: site + "/catalogue.html" },
          { "@type": "ListItem", position: 3, name: libelle, item: url },
        ],
      },
    ],
  };

  /* Carte de partage du genre (tools/build-og-pages.py). Sans elle, les 17
     vues par genre partageaient toutes la vignette generique du site. */
  return {
    title,
    head: metaTags({
        title, desc, url, type: "website", card: true,
        image: `${site}/images/og/genres/${slugify(libelle)}.jpg`,
      })
      + "  " + ldTag(ld) + "\n",
    mountRe: /<main>[\s\S]*?<\/main>/i,
    body,
  };
}

/* ------------------------------ vrais 404 ------------------------------
   /manga.html?id=NImporteQuoi répondait 200 avec une coquille vide : pour un
   moteur, c'est un « soft 404 ». Google les détecte, les signale dans la Search
   Console, et surtout il continue de recrawler ces URLs fantômes au lieu des
   vraies pages. Un lien mort, un vieux partage, une série renommée en fabrique
   sans arrêt.

   Ici on renvoie un vrai 404, avec la page 404 du site comme corps. */
async function notFound(origin) {
  let body = "<!doctype html><html lang=fr><meta charset=utf-8>"
    + "<title>Page introuvable — LanorTrad</title>"
    + "<meta name=robots content=noindex>"
    + "<h1>Page introuvable</h1>"
    + '<p><a href="/catalogue.html">Voir le catalogue</a></p>';
  try {
    const res = await fetch(new URL("/404.html", origin));
    if (res.ok) body = await res.text();
  } catch (_) { /* la page 404 du site est inaccessible : le corps minimal suffit */ }
  return new Response(body, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" },
  });
}

/* Exportés pour scripts/test-og.mjs (`node scripts/test-og.mjs`). */
export { seriesPage as _seriesPage, chapterPage as _chapterPage, genrePage as _genrePage, inject as _inject, BOTS as _BOTS, lireAdresse as _lireAdresse, slugify as _slugify };

/* --------------------------- lecture de l'adresse ---------------------------
   La meme page arrive sous deux formes : l'ancienne (manga.html?id=...) et la
   nouvelle (/manga/<slug>/chapitre-240/). Selon que la reecriture declaree dans
   netlify.toml s'applique avant ou apres l'edge function, c'est l'une OU
   l'autre qui se presente ici : les deux sont donc traitees. */
function lireAdresse(url) {
  let chemin = url.pathname;
  try { chemin = decodeURIComponent(chemin); } catch (_) { /* adresse mal encodee : telle quelle */ }

  const propre = /^\/manga\/([^/]+?)(?:\/([^/]+?))?\/?$/i.exec(chemin);
  if (propre) {
    const seg = propre[2] || "";
    return {
      type: seg ? "chapitre" : "serie",
      id: propre[1],
      // /manga/<slug>/lecture/ : aucun chapitre precis. Le lecteur ouvrira le
      // plus ancien, c'est donc celui-la qu'on decrit.
      chapitre: seg && !/^lecture$/i.test(seg) ? seg.replace(/^chapitre[- _]+/i, "") : null,
    };
  }
  const genrePropre = /^\/genre\/([^/]+)\/?$/i.exec(chemin);
  if (genrePropre) return { type: "genre", genre: genrePropre[1] };

  if (/\/catalogue\.html$/i.test(chemin)) {
    const g = url.searchParams.get("genre");
    // Le catalogue sans filtre est une vraie page, deja servie telle quelle :
    // on ne s'en mele que s'il y a un genre a mettre en avant.
    return g ? { type: "genre", genre: g } : { type: "rien" };
  }
  if (/\/reader\.html$/i.test(chemin))
    return { type: "chapitre", id: url.searchParams.get("manga"), chapitre: url.searchParams.get("chapter") };
  if (/\/manga\.html$/i.test(chemin))
    return { type: "serie", id: url.searchParams.get("id") };
  return { type: "rien" };
}

/* --------------------------------- main --------------------------------- */
export default async (request, context) => {
  const ua = request.headers.get("user-agent") || "";
  if (!BOTS.test(ua)) return;                        // visiteur normal → page inchangée

  const url = new URL(request.url);
  const cible = lireAdresse(url);
  if (cible.type === "rien") return;

  const isCatalogue = cible.type === "genre";
  const isReader = cible.type === "chapitre";
  const genre = cible.genre || null;
  const id = cible.id || null;
  // Sans identifiant, la page n'a aucun contenu à montrer à un robot.
  if (!isCatalogue && !id) return notFound(url.origin);

  try {
    const metaRes = await fetch(new URL("/og-meta.json", url.origin), {
      headers: { "cache-control": "max-age=300" },
    });
    // Métadonnées injoignables : on ne sait pas si la série existe, donc on ne
    // décrète surtout pas qu'elle est absente. La page d'origine est servie.
    if (!metaRes.ok) return;
    const meta = await metaRes.json();
    const site = url.origin;

    let plan;
    if (isCatalogue) {
      plan = genrePage(meta, genre, site);
      // Genre inexistant : le catalogue complet reste une reponse valable,
      // on sert donc la page telle quelle plutot qu'un 404.
      if (!plan) return;
    } else {
      // L'adresse propre ne transporte que le slug : on remonte a la vraie cle.
      const cle = resoudreId(meta, id);
      const s = cle ? meta[cle] : null;
      if (!s) return notFound(url.origin);           // série inconnue → 404
      plan = isReader
        ? chapterPage(s, cle, cible.chapitre || chapitreParDefaut(s)?.n, site)
        : seriesPage(s, cle, site);
      if (!plan) return notFound(url.origin);        // chapitre inconnu → 404
    }

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
