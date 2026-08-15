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
import { _seriesPage, _chapterPage, _genrePage, _inject as inject } from "../netlify/edge-functions/og.js";

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
check("canonical par chapitre", html.includes('rel="canonical" href="https://lanortrad.com/reader.html?manga=Tougen%20Anki&amp;chapter=240"'));
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
check("lien vers la fiche serie", html.includes("manga.html?id=Tougen%20Anki"));
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
check("canonical de fiche", hs.includes('rel="canonical" href="https://lanortrad.com/manga.html?id=Tougen%20Anki"'));
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
check("canonical du genre", hg.includes('rel="canonical" href="https://lanortrad.com/catalogue.html?genre=Horreur"'));
check("plus de titre generique", !hg.includes("<title>Catalogue — LanorTrad</title>"));
const ldg = JSON.parse(hg.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1].replace(/\\u003c/g, "<"))["@graph"];
check("JSON-LD CollectionPage", ldg[0]["@type"] === "CollectionPage");
check("ItemList non vide", ldg[0].mainEntity.numberOfItems >= 2);
check("fil d'Ariane a 3 niveaux", ldg[1].itemListElement.length === 3);
// L'URL peut arriver sans accent ni majuscule (liens, partages, saisie manuelle).
check("accents et casse tolerés", !!_genrePage(meta, "mystere", SITE));
check("le libelle affiché reste le vrai", /Mystère/.test(_genrePage(meta, "mystere", SITE).title));
check("genre inconnu -> null (page d'origine servie)", _genrePage(meta, "Cuisine", SITE) === null);

/* ---- echappement ---- */
console.log("\n== Securite ==");
const evil = { ...s, title: 'A"><script>alert(1)</script>', description: "<img onerror=x>" };
const pe = _chapterPage(evil, "X", evil.chapters[0].n, SITE);
check("titre echappe", !/<script>alert/.test(inject(shellReader, pe)));

console.log(fails ? `\n${fails} echec(s)` : "\nTous les tests passent");
process.exit(fails ? 1 : 0);
