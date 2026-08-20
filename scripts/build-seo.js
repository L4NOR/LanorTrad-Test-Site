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

/* --------------------------- notes lecteurs ---------------------------
   Les etoiles dans les resultats Google viennent d'un aggregateRating. Il
   n'existait que cote navigateur (js/manga.js), donc invisible au premier
   passage de Googlebot, qui ne rend pas le JS. On prend ici un instantane des
   VRAIES notes (vue publique series_rating_stats, lisible avec la cle anon) et
   on l'embarque dans og-meta.json pour que l'edge function le serve.

   On n'utilise JAMAIS le champ `rating` de series.js comme aggregateRating :
   c'est une appreciation editoriale, pas une moyenne de votes. Le faire
   passer pour tel, c'est de la fausse note d'avis — sanctionne par Google,
   et malhonnete envers les lecteurs.

   Toute panne (Supabase injoignable, vue absente, tables non deployees)
   renvoie {} : on perd les etoiles, jamais le build. */
async function fetchRatings() {
  let cfg;
  try { cfg = loadGlobal("js/supabase-config.js", "LT_SUPABASE"); }
  catch { return {}; }
  if (!cfg || !cfg.url || !cfg.anonKey || /VOTRE_|YOUR_/i.test(cfg.url + cfg.anonKey)) return {};
  try {
    const res = await fetch(`${cfg.url}/rest/v1/series_rating_stats?select=manga_id,score,votes`, {
      headers: { apikey: cfg.anonKey, Authorization: "Bearer " + cfg.anonKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const map = {};
    for (const r of await res.json()) {
      const s = Number(r.score), v = Number(r.votes);
      // Une seule voix ne fait pas une moyenne, et Google rejette les notes
      // hors bornes.
      if (v >= 2 && s > 0 && s <= 5) map[r.manga_id] = { s: Math.round(s * 10) / 10, v };
    }
    console.log(`[seo] notes lecteurs — ${Object.keys(map).length} série(s) avec assez de votes`);
    return map;
  } catch (e) {
    console.log("[seo] notes lecteurs indisponibles (" + e.message + ") — pas d'aggregateRating");
    return {};
  }
}

/* -------------------- chapitres officiels et bonus --------------------
   Un numero decimal (246.5, 23.25) designe un chapitre BONUS : une histoire
   annexe, pas un chapitre de l'histoire principale. Ce qu'on annonce partout —
   flux, donnees structurees, vignettes de partage — c'est l'avancement de
   l'HISTOIRE, donc le compte officiel.

   Le compte se fait sur la liste reelle des chapitres et non sur le champ
   `chapters` de series.js, tenu a la main : les deux avaient deja diverge.
   Meme regle que js/core.js (chapCount) et tools/build-og.py. */
const estBonus = n => { const v = parseFloat(n); return Number.isFinite(v) && v !== Math.trunc(v); };
const nbOfficiels = (s, chapters) => {
  const L = (chapters || {})[s.id] || [];
  if (!L.length) return s.chapters || 0;
  return L.reduce((n, c) => n + (estBonus(c.num) ? 0 : 1), 0);
};

/* ----------------------------- feed.xml ----------------------------- */
function buildFeed(series, chapters) {
  const items = series
    .filter(s => s.lastUpdate)
    .sort((a, b) => String(b.lastUpdate).localeCompare(String(a.lastUpdate)))
    .slice(0, 30)
    .map(s => {
      const link = uSerie(s.id);
      const title = `${s.title} — chapitre ${nbOfficiels(s, chapters)}`;
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

/* ---------------------------- sitemap.xml ---------------------------
   sitemap.xml est un INDEX qui pointe vers un fichier par série, plus un
   fichier pour les pages fixes. Un seul gros sitemap marche aussi, mais la
   Search Console ne sait alors dire que « 562 URLs, 431 indexées » : impossible
   de voir QUELLE série n'est pas indexée. Découpé, chaque série a sa propre
   ligne de couverture.

   Les fiches série portent aussi leur couverture en <image:image>, sans quoi
   les couvertures n'ont aucune chance de remonter dans Google Images. Les pages
   de chapitre, elles, n'exposent pas leurs planches : ce sont les images de
   l'éditeur, on ne les pousse pas à l'indexation. */
const slugFile = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Za-z0-9]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "").toLowerCase() || "serie";

/* ----------------------------- adresses lisibles -----------------------------
   Ce que le sitemap, le flux et IndexNow declarent, ce sont les adresses
   PROPRES (/manga/tougen-anki/chapitre-240/) : ce sont elles que les pages
   posent en canonical, et elles seules doivent circuler.
   Les anciennes (?id=) restent servies, mais ne sont plus declarees nulle part.
   La regle de slug est partagee avec js/core.js (slugify) et
   netlify/edge-functions/og.js — les trois doivent rester d'accord, sinon le
   sitemap pointe des URLs dont le canonical designe autre chose. */
const uSerie    = id => SITE + "/manga/" + slugFile(id) + "/";
const uChapitre = (id, n) => uSerie(id) + "chapitre-" + enc(n) + "/";
const uGenre    = g => SITE + "/genre/" + slugFile(g) + "/";

function buildSitemap(series, chapters) {
  const today = new Date().toISOString().slice(0, 10);
  const url = (loc, freq, prio, lastmod, image) =>
    `  <url><loc>${esc(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}` +
    `<changefreq>${freq}</changefreq><priority>${prio}</priority>` +
    (image ? `<image:image><image:loc>${esc(image)}</image:loc></image:image>` : "") +
    `</url>`;

  const wrap = rows => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${rows.join("\n")}
</urlset>
`;
  const written = [];
  const write = (name, rows, lastmod) => {
    fs.writeFileSync(path.join(ROOT, name), wrap(rows), "utf8");
    written.push({ name, lastmod, count: rows.length });
  };

  /* --- pages fixes --- */
  const fixed = [];
  // L'accueil est servi sur « / » : c'est cette URL-là qui est canonique,
  // pas /index.html (sinon Google voit deux fois la même page).
  fixed.push(url(SITE + "/", "daily", "1.0"));
  const pages = [
    // bibliotheque.html n'est pas listée : elle est en noindex (contenu
    // purement personnel, vide pour un robot).
    ["catalogue.html", "daily", "0.9"],
    ["planning.html", "daily", "0.8"],
    ["equipe.html", "monthly", "0.6"], ["forum.html", "daily", "0.7"],
    ["classement.html", "weekly", "0.6"],
    ["mentions-legales.html", "yearly", "0.2"],
    ["confidentialite.html", "yearly", "0.2"],
  ];
  pages.forEach(([p, f, pr]) => fixed.push(url(abs(p), f, pr)));

  /* Vues par genre (catalogue.html?genre=X).
     « manga d'horreur en français » est une requête réelle, et le filtre du
     catalogue y répond déjà — il lui manquait juste une URL déclarée.

     SEUIL DÉLIBÉRÉ : on n'inscrit que les genres portant au moins 2 séries.
     Sur 20 genres, 12 n'en ont qu'une : les déclarer ferait autant de pages
     quasi vides, que Google traite en « contenu pauvre » — ça dessert le site
     au lieu de l'aider. Elles restent accessibles et se rempliront d'elles-mêmes
     quand le catalogue grandira.
     `Collaboration` est une étiquette interne, pas un genre : elle n'a rien à
     faire dans un résultat de recherche.
     Même liste côté site (js/core.js, TAGS_INTERNES) : les deux doivent rester
     d'accord. */
  const INTERNES = new Set(["Collaboration"]);
  const parGenre = {};
  series.forEach(s => (s.genres || []).forEach(g => {
    if (!INTERNES.has(g)) (parGenre[g] = parGenre[g] || []).push(s);
  }));
  const genresPublies = Object.keys(parGenre).filter(g => parGenre[g].length >= 2).sort();
  genresPublies.forEach(g => fixed.push(url(uGenre(g), "weekly", "0.7")));

  write("sitemap-pages.xml", fixed, today);
  const ecartes = Object.keys(parGenre).length - genresPublies.length;
  console.log(`[seo] genres — ${genresPublies.length} déclaré(s) : ${genresPublies.join(", ")}`
    + ` (${ecartes} écarté(s), moins de 2 séries)`);

  /* --- une série par fichier --- */
  let total = fixed.length;
  series.forEach(s => {
    // Pas de repli sur `today` : une série sans lastUpdate se redaterait à
    // chaque déploiement, ce qui est exactement le bruit qu'on veut supprimer.
    const rows = [
      url(uSerie(s.id), "weekly", s.featured ? "0.9" : "0.6",
        s.lastUpdate || "", s.cover ? abs(encodeURI(s.cover)) : ""),
    ];
    // lastmod par chapitre. `c.d` est la date de sortie reelle, figee par
    // tools/build-data.py le jour ou le chapitre apparait. Le chapitre le plus
    // recent (index 0) peut retomber sur s.lastUpdate, qui designe justement sa
    // date. Pour les autres, on prefere PAS de lastmod a un faux : dater tous
    // les chapitres du jour du deploiement, c'est se faire ignorer par Google.
    (chapters[s.id] || []).forEach((c, i) =>
      rows.push(url(uChapitre(s.id, c.num),
        "monthly", "0.5", c.d || (i === 0 ? s.lastUpdate : ""))));
    total += rows.length;
    write(`sitemap-${slugFile(s.id)}.xml`, rows, s.lastUpdate || "");
  });

  /* --- l'index --- */
  const index = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${written.map(w => `  <sitemap><loc>${abs(w.name)}</loc>${w.lastmod ? `<lastmod>${w.lastmod}</lastmod>` : ""}</sitemap>`).join("\n")}
</sitemapindex>
`;
  fs.writeFileSync(path.join(ROOT, "sitemap.xml"), index, "utf8");

  // Une série renommée ou supprimée laisserait son fichier derrière elle, et
  // l'index n'y renvoyant plus, Google le garderait en mémoire un moment.
  const keep = new Set(written.map(w => w.name));
  for (const f of fs.readdirSync(ROOT)) {
    if (/^sitemap-.*\.xml$/.test(f) && !keep.has(f)) {
      fs.unlinkSync(path.join(ROOT, f));
      console.log(`[seo] sitemap orphelin retiré : ${f}`);
    }
  }
  console.log(`[seo] sitemap.xml — index de ${written.length} fichiers, ${total} URLs`);
}

/* --------------------------- og-meta.json ---------------------------
   Lu par l'edge function OG (netlify/edge-functions/og.js) pour les fiches
   séries ET les pages de chapitre. La liste `chapters` (numéro + nb de pages,
   du plus récent au plus ancien) sert à fabriquer un titre, une description et
   des liens précédent/suivant propres pour chaque chapitre. */
/* Chemin de la vignette de partage d'une serie, si elle a ete generee.
   Les reseaux sociaux affichent un rectangle 1200x630 : leur envoyer une
   couverture portrait revient a partager une bande recadree au centre. */
function ogCard(id) {
  const rel = `images/og/series/${slugFile(id)}.jpg`;
  return fs.existsSync(path.join(ROOT, rel)) ? rel : "";
}

/* Notes d'un chapitre, aplaties pour l'edge function : [{p, t}].
   Même tolérance que js/notes.js (une note peut être une simple chaîne), pour
   qu'un fichier écrit à la main ne se retrouve pas silencieusement ignoré. */
function notesOf(notes, serieId, num) {
  const e = ((notes || {})[serieId] || {})[String(num)];
  if (!e) return null;
  const brut = Array.isArray(e) ? e : (e.notes || []);
  const list = brut
    .map(n => (typeof n === "string" ? { text: n } : n))
    .filter(n => n && n.text && String(n.text).trim())
    .map(n => (n.page ? { p: String(n.page), t: String(n.text) } : { t: String(n.text) }));
  if (!list.length) return null;
  const intro = (Array.isArray(e) ? "" : e.intro || "").trim();
  return intro ? { i: intro, n: list } : { n: list };
}

function buildOgMeta(series, chapters, ratings, notes) {
  const map = {};
  series.forEach(s => {
    map[s.id] = {
      title: s.title,
      type: s.type === "oneshot" ? "oneshot" : "serie",
      status: s.status,
      genres: (s.genres || []).filter(g => g !== "Collaboration"),
      description: s.description,
      cover: s.cover,
      updated: s.lastUpdate || "",
      author: s.author || "",
      artist: s.artist || "",
      year: s.year || 0,
      accent: s.accent || "",
      // Vignette de partage 1200x630 (tools/build-og.py). Absente tant que la
      // vignette n'a pas ete generee : on retombe alors sur la couverture.
      og: ogCard(s.id),
      // Nombre de chapitres de l'oeuvre (numberOfEpisodes du JSON-LD).
      // Compte OFFICIEL : c'est lui que portent numberOfEpisodes et les
      // vignettes de partage (voir nbOfficiels ci-dessus).
      count: nbOfficiels(s, chapters),
      // Instantane des vraies notes ; absent s'il n'y en a pas assez.
      rating: ratings[s.id] || null,
      chapters: (chapters[s.id] || []).map(c => {
        const row = { n: c.num, p: c.pages || 0, d: c.d || "" };
        // Les notes de traduction sont le seul texte original du site : c'est
        // précisément ce qu'il faut donner à lire aux moteurs.
        const nt = notesOf(notes, s.id, c.num);
        if (nt) row.nt = nt;
        return row;
      }),
    };
  });
  const nbCh = Object.values(map).reduce((a, s) => a + s.chapters.length, 0);
  fs.writeFileSync(path.join(ROOT, "og-meta.json"), JSON.stringify(map), "utf8");
  console.log(`[seo] og-meta.json — ${Object.keys(map).length} séries, ${nbCh} chapitres`);
}

/* --------------------- adresses absolues des pages ---------------------
   Les pages HTML portent en dur https://lanortrad.com dans leur `canonical`,
   leur `og:url` et surtout leur `og:image`.

   Sur un deploiement qui n'est PAS ce domaine, les robots de partage vont donc
   chercher la vignette sur un site qui n'existe pas encore : Discord, X ou
   Facebook recoivent un 404 et n'affichent AUCUNE image. C'est exactement ce
   qui se passait sur lanortradtest.netlify.app, alors que les fichiers etaient
   bel et bien deployes.

   Les pages servies par l'edge function (series, chapitres, genres) n'avaient
   pas le probleme : elle construit ses adresses a partir de l'origine reelle
   de la requete. Ce sont donc les pages statiques, et elles seules, qu'il faut
   recibler.

   On reecrit ici, au build, vers le domaine reellement servi. Sur
   lanortrad.com l'operation ne change rien : c'est deja la bonne adresse.
   Ce sont les fichiers du DEPLOIEMENT qui sont modifies, pas le depot. */
const PROD = "https://lanortrad.com";

function recibleHtml() {
  if (SITE === PROD) {
    console.log("[seo] adresses absolues — deja sur " + PROD + ", rien a faire");
    return;
  }
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));
  let touchees = 0, refs = 0;
  for (const f of pages) {
    const p = path.join(ROOT, f);
    const src = fs.readFileSync(p, "utf8");
    const n = src.split(PROD).length - 1;
    if (!n) continue;
    fs.writeFileSync(p, src.split(PROD).join(SITE), "utf8");
    touchees++; refs += n;
  }
  console.log(`[seo] adresses absolues — ${refs} reciblee(s) sur ${SITE} dans ${touchees} page(s)`);
}

/* ---------------------------- robots.txt ----------------------------
   Le fichier est GÉNÉRÉ, parce que la bonne réponse dépend du domaine servi.

   Un déploiement de test est une copie quasi identique du site public, avec
   ses propres canonical qui pointent vers lui-même. Laissé indexable, il
   concurrence lanortrad.com sur ses propres pages — c'est du contenu dupliqué,
   et Google n'a aucune raison de deviner lequel des deux compte.

   La bascule se fait donc sur le domaine, et pas à la main : le jour où ce
   dépôt sert lanortrad.com, l'indexation se rouvre toute seule. */
const DOMAINE_PROD = /^(www\.)?lanortrad\.com$/i;

function buildRobots() {
  const host = new URL(SITE).host;
  const prod = DOMAINE_PROD.test(host);
  const txt = prod
    ? `User-agent: *
Allow: /
# Outil de team (etat des scripts SQL), en noindex : rien a indexer ici.
Disallow: /diag.html

Sitemap: ${abs("sitemap.xml")}
`
    : `# Généré par scripts/build-seo.js — ne pas éditer à la main.
#
# Ce déploiement (${host}) n'est pas le site public. C'en est une copie
# quasi identique : laissée indexable, elle ferait concurrence à
# lanortrad.com sur ses propres pages, avec en prime des canonical qui
# pointent ici plutôt que là-bas.
#
# L'indexation se rouvrira d'elle-même le jour où ce dépôt servira le
# domaine public : la règle porte sur le domaine, pas sur une case à cocher.
User-agent: *
Disallow: /
`;
  fs.writeFileSync(path.join(ROOT, "robots.txt"), txt, "utf8");
  console.log(`[seo] robots.txt — ${prod ? "indexation autorisée" : "indexation BLOQUÉE (déploiement de test)"} — ${host}`);
}

/* ------------------------------ IndexNow ------------------------------
   Un sitemap dit « voici mes URLs », il ne dit pas « celle-ci vient de
   changer ». Bing, Yandex et quelques autres acceptent qu'on les prévienne
   directement : la page est connue en minutes au lieu de jours. Google ne
   participe pas au protocole ; pour lui, c'est le sitemap qui fait foi.

   On ne pousse QUE les nouveautés du jour — les chapitres que build-data.py
   vient de dater — plus les pages qui les listent. Envoyer les 562 URLs à
   chaque déploiement serait du spam, et ça se retourne contre le site.

   Sans la variable d'environnement INDEXNOW_KEY, l'étape est simplement
   sautée : rien à casser, rien à configurer pour développer. */
async function pingIndexNow(series, chapters) {
  const key = (process.env.INDEXNOW_KEY || "").trim();
  if (!key) return;
  if (!/^[a-zA-Z0-9-]{8,128}$/.test(key)) {
    console.log("[seo] INDEXNOW_KEY invalide (8 à 128 caractères alphanumériques) — ignorée");
    return;
  }
  // Les déploiements de préversion ne doivent surtout pas être signalés.
  if (process.env.CONTEXT && process.env.CONTEXT !== "production") {
    console.log(`[seo] IndexNow ignoré (contexte « ${process.env.CONTEXT} »)`);
    return;
  }
  // Ni les déploiements de test : chez Netlify, un site de test est lui aussi
  // en contexte « production ». Sans ce garde-fou, on demanderait à Bing
  // d'indexer une copie du site — l'inverse exact du but recherché.
  const host = new URL(SITE).host;
  if (!DOMAINE_PROD.test(host)) {
    console.log(`[seo] IndexNow ignoré (déploiement de test : ${host})`);
    return;
  }

  // Le protocole exige que la clé soit vérifiable à la racine du site.
  fs.writeFileSync(path.join(ROOT, `${key}.txt`), key, "utf8");

  const today = new Date().toISOString().slice(0, 10);
  const urls = new Set();
  series.forEach(s => {
    const fresh = (chapters[s.id] || []).filter(c => c.d === today);
    fresh.forEach(c => urls.add(uChapitre(s.id, c.num)));
    if (fresh.length) urls.add(uSerie(s.id));
  });
  if (!urls.size) { console.log("[seo] IndexNow — aucune nouveauté aujourd'hui"); return; }
  // Les pages qui listent les sorties ont changé elles aussi.
  [SITE + "/", abs("catalogue.html"), abs("planning.html")].forEach(u => urls.add(u));

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: new URL(SITE).host,
        key,
        keyLocation: abs(`${key}.txt`),
        urlList: [...urls],
      }),
      signal: AbortSignal.timeout(10000),
    });
    // 200 = pris en compte, 202 = accepté, clé en cours de vérification.
    console.log(`[seo] IndexNow — ${urls.size} URL(s) signalée(s), réponse ${res.status}`);
  } catch (e) {
    console.log("[seo] IndexNow injoignable (" + e.message + ") — sans conséquence");
  }
}

/* ------------------------------- main ------------------------------- */
(async function main() {
  let series, chapters;
  try { series = loadGlobal("js/data/series.js", "SERIES") || []; }
  catch (e) { console.error("[seo] series.js illisible :", e.message); return; }
  try { chapters = loadGlobal("js/data/chapters.js", "CHAPTERS") || {}; }
  catch { chapters = {}; }

  // Notes de traduction (js/data/notes.js, tenu à la main). Fichier absent ou
  // mal formé : on continue sans, ce n'est pas une raison de casser le build.
  let notes;
  try { notes = loadGlobal("js/data/notes.js", "NOTES") || {}; }
  catch (e) { notes = {}; console.log("[seo] notes.js illisible (" + e.message + ") — ignoré"); }
  const nbNotes = Object.values(notes).reduce((a, s) => a + Object.keys(s || {}).length, 0);
  if (nbNotes) console.log(`[seo] notes de traduction — ${nbNotes} chapitre(s) commenté(s)`);

  const ratings = await fetchRatings();

  recibleHtml();
  buildRobots();
  buildFeed(series, chapters);
  buildSitemap(series, chapters);
  buildOgMeta(series, chapters, ratings, notes);
  await pingIndexNow(series, chapters);
  console.log(`[seo] terminé (site ${SITE})`);
})();
