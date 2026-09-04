/* =========================================================================
   LanorTrad — Tests de l'edge function OG (netlify/edge-functions/og.js).
   Verifie le titre, le canonical, l'OpenGraph, le JSON-LD, les liens
   precedent/suivant et le pre-rendu servis aux robots, sur un chapitre du
   milieu, les deux bornes, un chapitre decimal, un oneshot, un chapitre
   inexistant et une fiche serie. Verifie aussi l'echappement HTML.

   Prerequis : og-meta.json a jour (node scripts/build-seo.js).
   Lancer    : node scripts/test-og.mjs
   ========================================================================= */
import { readFileSync } from "node:fs";
import { _seriesPage, _chapterPage, _genrePage, _inject as inject, _BOTS as BOTS,
         _lireAdresse as lireAdresse, _slugify as slugify } from "../netlify/edge-functions/og.js";

const meta = JSON.parse(readFileSync(new URL("../og-meta.json", import.meta.url), "utf8"));
const SITE = "https://lanortrad.com";
const shellReader = `<!DOCTYPE html><html lang="fr"><head><title>Lecture — LanorTrad</title></head><body><div id="reader-root"></div></body></html>`;
const shellSeries = `<!DOCTYPE html><html lang="fr"><head><title>Série — LanorTrad</title></head><body><main id="series-root"></main></body></html>`;

let fails = 0;
const check = (label, cond, extra = "") => {
  if (!cond) { fails++; console.log("  ECHEC : " + label + (extra ? " -- " + extra : "")); }
  else console.log("  ok    : " + label);
};

/* ---- chapitre du milieu ---- */
const s = meta["Tougen Anki"];
const p = _chapterPage(s, "Tougen Anki", "240", SITE);
const html = inject(shellReader, p);
console.log("\n== Chapitre 240 de Tougen Anki ==");
console.log("titre :", p.title);
check("titre contient le numero de chapitre", /Chapitre 240/.test(p.title));
// &amp; est l'echappement HTML correct de & dans un attribut : le navigateur
// et les crawlers le relisent comme &.
check("canonical par chapitre", html.includes('rel="canonical" href="https://lanortrad.com/manga/tougen-anki/chapitre-240/"'));
// og:image doit etre la carte de partage 1200x630, pas la couverture portrait
// (que les reseaux sociaux recadreraient au centre).
check("og:image absolue", /og:image" content="https:\/\/lanortrad\.com\/images\//.test(html));
check("og:image = carte de partage paysage",
  !s.og || html.includes(`og:image" content="https://lanortrad.com/${s.og}"`),
  s.og ? "" : "vignette non generee : lance py tools/build-og.py");
check("twitter:card present", html.includes('name="twitter:card"'));
check("lien prev", html.includes('rel="prev"'));
check("lien next", html.includes('rel="next"'));
check("prerendu injecte dans reader-root", /<div id="reader-root"><article><h1>/.test(html));
check("h1 lisible", /<h1>Tougen Anki — Chapitre 240<\/h1>/.test(html));
check("lien vers la fiche serie", html.includes("/manga/tougen-anki/"));
const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check("JSON-LD present", !!ld);
if (ld) {
  const parsed = JSON.parse(ld[1].replace(/\\u003c/g, "<"));
  check("JSON-LD valide, type Chapter", parsed["@graph"][0]["@type"] === "Chapter");
  check("JSON-LD isPartOf Book", parsed["@graph"][0].isPartOf.name === "Tougen Anki");
  check("JSON-LD fil d'Ariane", parsed["@graph"][1]["@type"] === "BreadcrumbList");
}
check("plus de titre generique", !html.includes("<title>Lecture — LanorTrad</title>"));

/* ---- premier et dernier chapitre (pas de prev / pas de next) ---- */
const first = s.chapters[s.chapters.length - 1], last = s.chapters[0];
const pFirst = _chapterPage(s, "Tougen Anki", first.n, SITE);
const pLast = _chapterPage(s, "Tougen Anki", last.n, SITE);
console.log("\n== Bornes ==");
check(`chapitre le plus ancien (${first.n}) : pas de rel=prev`, !pFirst.head.includes('rel="prev"'));
check(`chapitre le plus ancien (${first.n}) : a un rel=next`, pFirst.head.includes('rel="next"'));
check(`chapitre le plus recent (${last.n}) : pas de rel=next`, !pLast.head.includes('rel="next"'));
check(`chapitre le plus recent (${last.n}) : a un rel=prev`, pLast.head.includes('rel="prev"'));

/* ---- chapitre decimal ---- */
const dec = s.chapters.find(c => c.n.includes("."));
const pDec = _chapterPage(s, "Tougen Anki", dec.n, SITE);
console.log("\n== Chapitre decimal", dec.n, "==");
check("chapitre decimal gere", pDec && pDec.title.includes(dec.n));
check("position numerique correcte", pDec.head.includes(`"position":${parseFloat(dec.n)}`));

/* ---- oneshot ---- */
const one = Object.entries(meta).find(([, v]) => v.type === "oneshot");
console.log("\n== Oneshot :", one[0], "==");
const pOne = _chapterPage(one[1], one[0], one[1].chapters[0].n, SITE);
console.log("titre :", pOne.title);
check("oneshot : pas de 'Chapitre N' dans le titre", !/Chapitre \d/.test(pOne.title));
check("oneshot : mention (oneshot)", pOne.title.includes("(oneshot)"));

/* ---- chapitre inexistant ---- */
console.log("\n== Cas limites ==");
check("chapitre inexistant -> null (page d'origine servie)", _chapterPage(s, "Tougen Anki", "99999", SITE) === null);

/* ---- fiche serie ---- */
const ps = _seriesPage(s, "Tougen Anki", SITE);
const hs = inject(shellSeries, ps);
console.log("\n== Fiche serie ==");
check("titre de fiche", /Tougen Anki — Scan VF/.test(ps.title));
check("liste des chapitres pre-rendue", (hs.match(/<li><a href/g) || []).length > 100);
check("canonical de fiche", hs.includes('rel="canonical" href="https://lanortrad.com/manga/tougen-anki/"'));
check("prerendu injecte dans series-root", /<main id="series-root"><article>/.test(hs));
const lds = hs.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check("JSON-LD de fiche present", !!lds);
if (lds) {
  const g = JSON.parse(lds[1].replace(/\\u003c/g, "<"))["@graph"];
  check("oeuvre ComicSeries en tete du graphe", g[0]["@type"] === "ComicSeries");
  check("auteur present", g[0].author && g[0].author.name === s.author);
  check("nombre de chapitres present", g[0].numberOfEpisodes > 0);
  check("editeur present", g[0].publisher.name === "LanorTrad");
  // Le JSON-LD doit porter la COUVERTURE, pas la carte de partage.
  check("image du JSON-LD = couverture", /\/images\/Cover\//.test(g[0].image));
  check("fil d'Ariane conserve", g[1]["@type"] === "BreadcrumbList");
  // Les etoiles ne doivent apparaitre QUE s'il existe de vraies notes.
  check(
    s.rating ? "aggregateRating pose (vraies notes)" : "aggregateRating absent (pas de votes) — attendu",
    s.rating ? !!g[0].aggregateRating : !g[0].aggregateRating
  );
}
/* Une note editoriale ne doit jamais devenir un aggregateRating : seul le
   champ `rating` (instantane des votes) y donne droit. */
const gNoted = JSON.parse(
  inject(shellSeries, _seriesPage({ ...s, rating: { s: 4.7, v: 38 } }, "Tougen Anki", SITE))
    .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<")
)["@graph"][0];
check("avec de vraies notes -> aggregateRating complet",
  gNoted.aggregateRating.ratingValue === 4.7 && gNoted.aggregateRating.ratingCount === 38);
check("une seule voix ne suffit pas",
  !JSON.parse(inject(shellSeries, _seriesPage({ ...s, rating: { s: 5, v: 1 } }, "Tougen Anki", SITE))
    .match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<"))["@graph"][0].aggregateRating);

/* ---- catalogue par genre ---- */
console.log("\n== Catalogue par genre ==");
const shellCat = `<!DOCTYPE html><html lang="fr"><head><title>Catalogue — LanorTrad</title></head><body><main><section>filtres</section></main></body></html>`;
const pg = _genrePage(meta, "Horreur", SITE);
const hg = inject(shellCat, pg);
console.log("titre :", pg.title);
check("titre oriente requete", /Manga Horreur en français/.test(pg.title));
check("h1 present", /<h1>Catalogue Horreur<\/h1>/.test(hg));
check("les series du genre sont listees", (hg.match(/<li><a href/g) || []).length >= 2);
check("canonical du genre", hg.includes('rel="canonical" href="https://lanortrad.com/genre/horreur/"'));
check("plus de titre generique", !hg.includes("<title>Catalogue — LanorTrad</title>"));
// Chaque genre a sa propre carte de partage (tools/build-og-pages.py) : sans
// elle, les 17 vues par genre partageaient la vignette generique du site.
check("carte de partage du genre",
  hg.includes('og:image" content="https://lanortrad.com/images/og/genres/horreur.jpg"'));
check("dimensions de la carte declarees", hg.includes('og:image:width" content="1200"'));
check("carte du genre accentue", _genrePage(meta, "mystere", SITE).head.includes("/images/og/genres/mystere.jpg"));
const ldg = JSON.parse(hg.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<"))["@graph"];
check("JSON-LD CollectionPage", ldg[0]["@type"] === "CollectionPage");
check("ItemList non vide", ldg[0].mainEntity.numberOfItems >= 2);
check("fil d'Ariane a 3 niveaux", ldg[1].itemListElement.length === 3);
// L'URL peut arriver sans accent ni majuscule (liens, partages, saisie manuelle).
check("accents et casse tolerés", !!_genrePage(meta, "mystere", SITE));
check("le libelle affiché reste le vrai", /Mystère/.test(_genrePage(meta, "mystere", SITE).title));
check("genre inconnu -> null (page d'origine servie)", _genrePage(meta, "Cuisine", SITE) === null);

/* ---- adresses lisibles ----
   Tout le SEO repose sur une seule regle de slug, ecrite a TROIS endroits :
   js/core.js (le site), scripts/build-seo.js (le sitemap) et og.js (ce qui est
   servi aux robots). Si l'une derive, le sitemap declare des URLs dont le
   canonical designe autre chose — le pire des deux mondes. */
console.log("\n== Adresses lisibles ==");
check("slug d'une serie a espaces", slugify("Tougen Anki") === "tougen-anki");
check("slug sans accent ni ponctuation", slugify("Mystère & Cie") === "mystere-cie");
const slugs = Object.keys(meta).map(slugify);
check("un slug unique par serie", new Set(slugs).size === slugs.length, slugs.join(", "));

const lu = u => lireAdresse(new URL(u, SITE));
check("/manga/tougen-anki/ -> fiche",
  lu("/manga/tougen-anki/").type === "serie" && lu("/manga/tougen-anki/").id === "tougen-anki");
check("sans barre finale aussi", lu("/manga/tougen-anki").type === "serie");
check("/manga/tougen-anki/chapitre-240/ -> chapitre",
  lu("/manga/tougen-anki/chapitre-240/").type === "chapitre" && lu("/manga/tougen-anki/chapitre-240/").chapitre === "240");
check("chapitre decimal dans le chemin", lu("/manga/tougen-anki/chapitre-246.5/").chapitre === "246.5");
check("/lecture/ = chapitre sans numero",
  lu("/manga/tougen-anki/lecture/").type === "chapitre" && lu("/manga/tougen-anki/lecture/").chapitre === null);
check("/genre/horreur/ -> genre", lu("/genre/horreur/").genre === "horreur");
check("ancienne adresse de chapitre toujours comprise",
  lu("/reader.html?manga=Tougen%20Anki&chapter=240").chapitre === "240");
/* Les adresses de l'ANCIEN site (celui qui servait lanortrad.com avant cette
   version) : « /manga/tougen anki/chapitre 247 » -- minuscules, espaces, pas
   de tiret. Ce sont les ~550 adresses que Google a en index, et elles doivent
   continuer de mener au bon chapitre. Le separateur tolerant vit en double,
   ici pour les robots et dans js/core.js pour les lecteurs : les deux tests
   ci-dessous echouent si l'un des deux repart en arriere. */
check("ancienne forme du site precedent : la serie",
  lu("/manga/tougen%20anki").type === "serie" && lu("/manga/tougen%20anki").id === "tougen anki");
check("ancienne forme du site precedent : le chapitre",
  lu("/manga/tougen%20anki/chapitre%20247").chapitre === "247");
check("ancienne forme, chapitre a un chiffre",
  lu("/manga/ao%20no%20exorcist/chapitre%201").chapitre === "1");
check("ancienne forme, chapitre decimal",
  lu("/manga/tougen%20anki/chapitre%20246.5").chapitre === "246.5");
check("ancienne adresse de fiche toujours comprise",
  lu("/manga.html?id=Tougen%20Anki").id === "Tougen Anki");
check("catalogue sans genre : page inchangee", lu("/catalogue.html").type === "rien");
check("page quelconque : page inchangee", lu("/planning.html").type === "rien");
// Les images vivent sous /Manga/<Serie>/... : elles ne doivent JAMAIS etre
// prises pour une adresse de serie.
check("une image n'est pas une fiche", lu("/Manga/Tougen%20Anki/240/001.webp").type === "rien");
// Le slug de l'URL doit ramener a la vraie cle de og-meta.json.
const parSlug = inject(shellSeries, _seriesPage(meta["Tougen Anki"], "Tougen Anki", SITE));
check("les liens internes du prerendu sont propres",
  parSlug.includes('href="https://lanortrad.com/manga/tougen-anki/chapitre-'));
check("le lien « lire » pointe /lecture/", parSlug.includes("/manga/tougen-anki/lecture/"));

/* ---- pas de balises en double ----
   Les fichiers HTML portent des valeurs par defaut (og:image generique,
   canonical du catalogue...). Si l'edge function se contente d'ajouter les
   siennes, la page en contient deux, et les robots retiennent la PREMIERE,
   c'est-a-dire la valeur par defaut. */
console.log("\n== Pas de doublons dans le <head> ==");
const shellComplet = `<!DOCTYPE html><html lang="fr"><head>
  <title>Série — LanorTrad</title>
  <meta name="description" content="Description par defaut.">
  <link rel="canonical" href="https://lanortrad.com/catalogue.html">
  <meta property="og:title" content="Titre par defaut">
  <meta property="og:image" content="https://lanortrad.com/images/og/lanortrad.jpg">
  <meta name="twitter:image" content="https://lanortrad.com/images/og/lanortrad.jpg">
</head><body><main id="series-root"></main></body></html>`;
const hd = inject(shellComplet, _seriesPage(s, "Tougen Anki", SITE));
const compte = re => (hd.match(re) || []).length;
check("une seule og:image", compte(/<meta property="og:image"/g) === 1,
  compte(/<meta property="og:image"/g) + " trouvée(s)");
check("une seule og:title", compte(/<meta property="og:title"/g) === 1);
check("un seul canonical", compte(/<link rel="canonical"/g) === 1);
check("une seule description", compte(/<meta name="description"/g) === 1);
check("une seule twitter:image", compte(/<meta name="twitter:image"/g) === 1);
check("la valeur par defaut a bien disparu", !hd.includes("images/og/lanortrad.jpg"));
check("c'est la vignette de la serie qui reste", !s.og || hd.includes(s.og));

/* ---- detection des robots ----
   Tout le pre-rendu repose sur cette regex : un robot qui n'y figure pas ne
   voit qu'une coquille vide, et un navigateur qui y figurerait par erreur
   recevrait 32 Ko de HTML inutile. Elle merite donc des tests. */
console.log("\n== Detection des robots ==");
const doitPasser = [
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["Bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
  ["Qwant (moteur francais)", "Mozilla/5.0 (compatible; Qwantify/2.0; +https://www.qwant.com/)"],
  ["Discord", "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)"],
  ["Facebook", "facebookexternalhit/1.1"],
  ["Twitter/X", "Twitterbot/1.0"],
  ["WhatsApp", "WhatsApp/2.19.81 A"],
  ["Mastodon", "http.rb/5.1.1 (Mastodon/4.2.1; +https://mastodon.social/)"],
  ["Bluesky", "Mozilla/5.0 (compatible; Bluesky Cardyb/1.1)"],
  ["Applebot", "Mozilla/5.0 (compatible; Applebot/0.1)"],
];
const doitPasPasser = [
  ["Chrome bureau", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"],
  ["Safari iPhone", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"],
  ["Firefox", "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0"],
  ["Chrome Android", "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36"],
  // Exclus deliberement : donner le contenu aux robots d'IA est un choix
  // editorial, pas technique. Si ce test casse, c'est que quelqu'un les a
  // ajoutes — volontairement ou non.
  ["GPTBot (exclu volontairement)", "Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)"],
  ["ClaudeBot (exclu volontairement)", "Mozilla/5.0 (compatible; ClaudeBot/1.0)"],
];
doitPasser.forEach(([n, ua]) => check(`recoit le prerendu : ${n}`, BOTS.test(ua)));
doitPasPasser.forEach(([n, ua]) => check(`page inchangee : ${n}`, !BOTS.test(ua)));

/* ---- echappement ---- */
console.log("\n== Securite ==");
const evil = { ...s, title: 'A"><script>alert(1)</script>', description: "<img onerror=x>" };
const pe = _chapterPage(evil, "X", evil.chapters[0].n, SITE);
check("titre echappe", !/<script>alert/.test(inject(shellReader, pe)));

console.log(fails ? `\n${fails} echec(s)` : "\nTous les tests passent");
process.exit(fails ? 1 : 0);
