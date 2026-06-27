/* =========================================================================
   LanorTrad — Génère les artefacts SEO à partir des données du site :
     • feed.xml      — flux RSS des dernières sorties (par série)
     • sitemap.xml   — pages + chaque fiche série + chaque chapitre
     • og-meta.json  — métadonnées par série, lues par l'edge function OG
   Lancé automatiquement par Netlify au déploiement (voir netlify.toml),
   ou à la main :  node scripts/build-seo.js
   N'utilise que des modules Node natifs.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = (process.env.URL || process.env.DEPLOY_PRIME_URL || "https://lanortrad.com")
  .replace(/\/+$/, "");

/* Exécute un fichier « window.X = … » avec un faux window et renvoie X. */
function loadGlobal(relPath, key) {
  const code = fs.readFileSync(path.join(ROOT, relPath), "utf8");
  const win = {};
  new Function("window", code)(win);
  return win[key];
}
const esc = s => String(s).replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const rfc822 = d => new Date(d + "T12:00:00Z").toUTCString();
const enc = encodeURIComponent;
const abs = p => SITE + "/" + String(p).replace(/^\/+/, "");

/* ----------------------------- feed.xml ----------------------------- */
function buildFeed(series) {
  const items = series
    .filter(s => s.lastUpdate)
    .sort((a, b) => String(b.lastUpdate).localeCompare(String(a.lastUpdate)))
    .slice(0, 30)
    .map(s => {
      const link = abs("manga.html?id=" + enc(s.id));
      const title = `${s.title} — chapitre ${s.chapters}`;
      return `    <item>
      <title>${esc(title)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="false">${esc(s.id + "#" + s.chapters)}</guid>
      <pubDate>${rfc822(s.lastUpdate)}</pubDate>
      <description>${esc(`Nouveau chapitre de ${s.title} disponible sur LanorTrad.`)}</description>
    </item>`;
    }).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>LanorTrad — Nouveaux chapitres</title>
    <link>${SITE}/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Les dernières sorties de l'équipe de scantrad LanorTrad.</description>
    <language>fr</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
  fs.writeFileSync(path.join(ROOT, "feed.xml"), xml, "utf8");
  console.log(`[seo] feed.xml — ${(xml.match(/<item>/g) || []).length} entrées`);
}

/* ---------------------------- sitemap.xml --------------------------- */
function buildSitemap(series, chapters) {
  const today = new Date().toISOString().slice(0, 10);
  const url = (loc, freq, prio, lastmod) =>
    `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}<changefreq>${freq}</changefreq><priority>${prio}</priority></url>`;

  const rows = [];
  const pages = [
    ["index.html", "daily", "1.0"], ["catalogue.html", "daily", "0.9"],
    ["planning.html", "daily", "0.8"], ["bibliotheque.html", "weekly", "0.5"],
    ["equipe.html", "monthly", "0.6"], ["forum.html", "daily", "0.7"],
    ["premium.html", "monthly", "0.7"],
  ];
  pages.forEach(([p, f, pr]) => rows.push(url(abs(p), f, pr)));

  series.forEach(s => {
    rows.push(url(abs("manga.html?id=" + enc(s.id)), "weekly",
      s.featured ? "0.9" : "0.6", s.lastUpdate || today));
    (chapters[s.id] || []).forEach(c =>
      rows.push(url(abs(`reader.html?manga=${enc(s.id)}&chapter=${enc(c.num)}`),
        "monthly", "0.5", s.lastUpdate || today)));
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join("\n")}
</urlset>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), xml, "utf8");
  console.log(`[seo] sitemap.xml — ${rows.length} URLs`);
}

/* --------------------------- og-meta.json --------------------------- */
function buildOgMeta(series) {
  const map = {};
  series.forEach(s => {
    map[s.id] = {
      title: s.title,
      type: s.type === "oneshot" ? "oneshot" : "serie",
      status: s.status,
      genres: (s.genres || []).filter(g => g !== "LanorTrad" && g !== "Collaboration"),
      description: s.description,
      cover: s.cover,
    };
  });
  fs.writeFileSync(path.join(ROOT, "og-meta.json"), JSON.stringify(map), "utf8");
  console.log(`[seo] og-meta.json — ${Object.keys(map).length} séries`);
}

/* ------------------------------- main ------------------------------- */
(function main() {
  let series, chapters;
  try { series = loadGlobal("js/data/series.js", "SERIES") || []; }
  catch (e) { console.error("[seo] series.js illisible :", e.message); return; }
  try { chapters = loadGlobal("js/data/chapters.js", "CHAPTERS") || {}; }
  catch { chapters = {}; }

  buildFeed(series);
  buildSitemap(series, chapters);
  buildOgMeta(series);
  console.log(`[seo] terminé (site ${SITE})`);
})();
