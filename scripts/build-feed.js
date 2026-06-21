/* =========================================================================
   LanorTrad — Génère feed.xml (RSS 2.0) à partir de js/data/series.js.
   • Lancé automatiquement par Netlify au déploiement (voir netlify.toml).
   • Ou à la main :  node scripts/build-feed.js
   Une entrée par série ayant une date de dernière sortie (lastUpdate),
   triée du plus récent au plus ancien. N'utilise que des modules Node natifs.
   ========================================================================= */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SITE = (process.env.URL || process.env.DEPLOY_PRIME_URL || "https://lanortradtest.netlify.app")
  .replace(/\/+$/, "");

function loadSeries() {
  const code = fs.readFileSync(path.join(ROOT, "js", "data", "series.js"), "utf8");
  // series.js fait « window.SERIES = [...] » : on l'exécute avec un faux window.
  const win = {};
  new Function("window", code)(win);
  return win.SERIES || [];
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
}
function rfc822(dateStr) { return new Date(dateStr + "T12:00:00Z").toUTCString(); }

function build() {
  let series;
  try { series = loadSeries(); }
  catch (e) { console.error("[feed] lecture de series.js impossible :", e.message); return; }

  const items = series
    .filter(s => s.lastUpdate)
    .sort((a, b) => String(b.lastUpdate).localeCompare(String(a.lastUpdate)))
    .slice(0, 30)
    .map(s => {
      const link = SITE + "/manga.html?id=" + encodeURIComponent(s.id);
      const title = `${s.title} — chapitre ${s.chapters}`;
      const desc = `Nouveau chapitre de ${s.title} disponible sur LanorTrad.`;
      return [
        "    <item>",
        `      <title>${esc(title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="false">${esc(s.id + "#" + s.chapters)}</guid>`,
        `      <pubDate>${rfc822(s.lastUpdate)}</pubDate>`,
        `      <description>${esc(desc)}</description>`,
        "    </item>"
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
  console.log(`[feed] OK -> feed.xml (${(xml.match(/<item>/g) || []).length} entrées, site ${SITE})`);
}

build();
