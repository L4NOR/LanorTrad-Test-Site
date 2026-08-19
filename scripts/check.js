/* =========================================================================
   LanorTrad — Vérification d'intégrité du site.

   Lancer :  node scripts/check.js
   Retour :  0 si tout va bien, 1 s'il y a au moins une erreur.

   POURQUOI
   Le site est statique, alimenté par des fichiers générés (js/data/*) et par
   14 000 images. Rien, dans ce montage, ne prévient quand ça se désaccorde :
   un chapitre déclaré dont les pages n'ont pas été poussées, une couverture
   renommée, un fichier de données rendu invalide par une accolade en trop.
   La page s'affiche quand même — vide, ou à moitié. C'est arrivé : le bloc
   d'exemple de js/data/notes.js a été décommenté avec ses lignes de repère,
   le fichier est devenu illisible, et plus AUCUNE note de traduction ne s'est
   affichée nulle part pendant plusieurs jours. Le build le signalait sur une
   ligne, sans échouer.

   Ce script pose donc les questions qu'on ne pense pas à se poser après une
   sortie de chapitre. Il tourne au build Netlify (donc à chaque déploiement)
   et sur GitHub Actions (voir .github/workflows/verifications.yml).

   Les images (Manga/, ~5,5 Go) ne sont pas toujours là — un checkout partiel
   en CI ne les récupère pas. Les vérifications qui en dépendent sont alors
   SAUTÉES et annoncées comme telles : sauter n'est pas réussir.
   ========================================================================= */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const R = p => path.join(ROOT, p);
const existe = p => fs.existsSync(R(p));

let erreurs = 0, alertes = 0, sautes = 0;
const titre = t => console.log("\n== " + t + " ==");
const ok = m => console.log("  ok      : " + m);
const err = m => { erreurs++; console.log("  ERREUR  : " + m); };
const warn = m => { alertes++; console.log("  alerte  : " + m); };
const saute = m => { sautes++; console.log("  sauté   : " + m); };

/* Charge un fichier de données du site (ils posent tous window.X). C'est aussi
   le test le plus utile du lot : si le fichier n'est pas du JavaScript valide,
   on le sait ici plutôt qu'en production. */
function charger(rel, cle, fenetre) {
  const w = fenetre || {};
  new Function("window", fs.readFileSync(R(rel), "utf8"))(w);
  return cle ? w[cle] : w;
}

/* ------------------------------------------------------------------------
   1. Les fichiers de données sont-ils du JavaScript valide ?
   ------------------------------------------------------------------------ */
titre("Fichiers de données");
const fenetre = {};
const DONNEES = [
  ["js/data/series.js", "SERIES"], ["js/data/chapters.js", "CHAPTERS"],
  ["js/data/covers.js", "COVERS"], ["js/data/notes.js", "NOTES"],
  ["js/data/schedule.js", null], ["js/data/gallery.js", null],
  ["js/data/atelier.js", null], ["js/data/anime.js", null],
];
for (const [f, cle] of DONNEES) {
  if (!existe(f)) { warn(`${f} absent`); continue; }
  try {
    charger(f, null, fenetre);
    if (cle && fenetre[cle] === undefined) err(`${f} se charge mais ne définit pas window.${cle}`);
    else ok(f);
  } catch (e) {
    err(`${f} illisible — ${e.message}`);
  }
}

const SERIES = fenetre.SERIES || [];
const CHAPTERS = fenetre.CHAPTERS || {};
const COVERS = fenetre.COVERS || {};
const CHAPTER_PAGES = fenetre.CHAPTER_PAGES || {};

if (!SERIES.length) {
  console.log("\njs/data/series.js n'a rien donné : impossible de continuer.");
  process.exit(1);
}

/* ------------------------------------------------------------------------
   2. Les listes de pages
   ------------------------------------------------------------------------ */
titre("Listes de pages (js/data/pages/)");
const FICHIERS = {};
for (const s of SERIES) {
  const src = CHAPTER_PAGES[s.id];
  const nb = (CHAPTERS[s.id] || []).length;
  if (!nb) { ok(`${s.id} — aucun chapitre déclaré, rien à vérifier`); continue; }
  if (!src) { err(`${s.id} — ${nb} chapitre(s) déclaré(s) mais aucune liste de pages (CHAPTER_PAGES)`); continue; }
  if (!existe(src)) { err(`${s.id} — ${src} déclaré mais introuvable`); continue; }
  try {
    const w = {};
    charger(src, null, w);
    FICHIERS[s.id] = (w.CHAPTER_FILES || {})[s.id];
    if (!FICHIERS[s.id]) err(`${src} ne définit pas CHAPTER_FILES["${s.id}"] (nom de série différent ?)`);
    else ok(`${s.id} — ${Object.keys(FICHIERS[s.id]).length} chapitre(s) listé(s)`);
  } catch (e) {
    err(`${src} illisible — ${e.message}`);
  }
}

/* ------------------------------------------------------------------------
   3. Index des chapitres ↔ listes de pages
   Le piège classique : un chapitre ajouté à l'index sans que build-data.py
   ait régénéré la liste de ses pages. Le lecteur s'ouvre alors sur du vide.
   ------------------------------------------------------------------------ */
titre("Chapitres ↔ pages");
let ecarts = 0;
for (const s of SERIES) {
  const liste = CHAPTERS[s.id] || [];
  const f = FICHIERS[s.id];
  if (!liste.length || !f) continue;
  for (const c of liste) {
    const e = f[c.num];
    if (!e || !Array.isArray(e.f) || !e.f.length) {
      err(`${s.id} chapitre ${c.num} — déclaré, mais aucune page listée`);
      ecarts++;
    } else if (c.pages && e.f.length !== c.pages) {
      err(`${s.id} chapitre ${c.num} — ${c.pages} page(s) annoncée(s), ${e.f.length} listée(s)`);
      ecarts++;
    }
  }
  // L'inverse est bénin : des pages listées pour un chapitre retiré de
  // l'index ne s'affichent nulle part. On le signale sans bloquer.
  const orphelins = Object.keys(f).filter(n => !liste.some(c => c.num === n));
  if (orphelins.length) warn(`${s.id} — ${orphelins.length} chapitre(s) listé(s) mais absent(s) de l'index : ${orphelins.slice(0, 5).join(", ")}`);
}
if (!ecarts) ok(`aucun écart sur ${SERIES.reduce((a, s) => a + (CHAPTERS[s.id] || []).length, 0)} chapitres`);

/* ------------------------------------------------------------------------
   4. Les images sont-elles vraiment là ?
   ------------------------------------------------------------------------ */
titre("Images");
if (!existe("Manga")) {
  saute("dossier Manga/ absent (checkout partiel) — pages de chapitre non vérifiées");
} else {
  let manquantes = 0, verifiees = 0;
  for (const s of SERIES) {
    const liste = CHAPTERS[s.id] || [];
    const f = FICHIERS[s.id];
    if (!f) continue;
    for (const c of liste) {
      const e = f[c.num];
      if (!e || !Array.isArray(e.f)) continue;
      for (const nom of e.f) {
        verifiees++;
        if (!existe(path.join("Manga", s.id, c.folder, nom))) {
          if (manquantes < 10) err(`image absente — Manga/${s.id}/${c.folder}/${nom}`);
          manquantes++;
        }
      }
    }
  }
  if (manquantes > 10) err(`… et ${manquantes - 10} autre(s) image(s) absente(s)`);
  if (!manquantes) ok(`${verifiees} pages de chapitre présentes sur le disque`);
}

// Couvertures et vignettes de partage : peu de fichiers, gros impact (une
// couverture manquante, c'est une carte vide sur l'accueil et dans Discord).
let couv = 0;
for (const s of SERIES) {
  if (!s.cover) { warn(`${s.id} — aucune couverture déclarée`); continue; }
  if (!existe(s.cover)) err(`couverture absente — ${s.cover} (${s.id})`);
  else couv++;
}
if (couv === SERIES.length) ok(`${couv} couvertures présentes`);

for (const [src, v] of Object.entries(COVERS)) {
  if (!existe(src)) { warn(`covers.js décrit ${src}, qui n'existe plus`); continue; }
  for (const w of (v.widths || [])) {
    const rel = `${v.base}-${w}.webp`;
    if (!existe(rel)) { warn(`variante responsive absente — ${rel}`); break; }
  }
}

/* ------------------------------------------------------------------------
   5. Ce que les pages HTML référencent existe-t-il ?
   Un fichier renommé, une page oubliée dans un lien : ça ne casse pas le
   build, ça casse la navigation.
   ------------------------------------------------------------------------ */
titre("Pages HTML");
const HTML = fs.readdirSync(ROOT).filter(f => f.endsWith(".html"));
let casses = 0;
for (const page of HTML) {
  const src = fs.readFileSync(R(page), "utf8");
  const refs = new Set();
  for (const m of src.matchAll(/(?:src|href)="([^"#?][^"]*)"/g)) refs.add(m[1]);
  for (const ref of refs) {
    if (/^(https?:|mailto:|data:|#|\/\/)/.test(ref)) continue;
    // Adresse construite par du JavaScript inline : sa valeur n'existe qu'à
    // l'exécution, il n'y a rien à vérifier ici.
    if (ref.includes("${")) continue;
    // La racine, et les adresses lisibles : servies par une réécriture, pas
    // par un fichier (voir netlify.toml).
    if (ref === "/" || /^\/(manga|genre)\//.test(ref)) continue;
    const rel = ref.replace(/^\//, "").split(/[?#]/)[0];
    if (!rel || !existe(rel)) { err(`${page} référence ${ref}, introuvable`); casses++; }
  }
}
if (!casses) ok(`${HTML.length} pages — tous les fichiers référencés existent`);

/* ------------------------------------------------------------------------
   6. Le service worker précache-t-il des fichiers qui existent ?
   Une entrée fausse fait échouer addAll() EN ENTIER : plus de mode hors
   ligne du tout, sans le moindre message.
   ------------------------------------------------------------------------ */
titre("Service worker");
const sw = fs.readFileSync(R("sw.js"), "utf8");
const bloc = sw.match(/const SHELL = \[([\s\S]*?)\];/);
if (!bloc) err("sw.js — liste SHELL introuvable (le format a changé ?)");
else {
  const entrees = [...bloc[1].matchAll(/"([^"]+)"/g)].map(m => m[1]);
  const absents = entrees.filter(f => !existe(f) && f !== "OFFLINE_PAGE");
  if (absents.length) absents.forEach(f => err(`sw.js précache ${f}, qui n'existe pas — addAll() échouerait en entier`));
  else ok(`${entrees.length} fichiers précachés, tous présents`);
  const version = sw.match(/const CACHE = "lanortrad-v(\d+)"/);
  if (!version) err("sw.js — numéro de version du cache introuvable");
  else ok(`version du cache : v${version[1]}`);
}

/* ------------------------------------------------------------------------
   7. Le manifeste PWA
   ------------------------------------------------------------------------ */
titre("Manifeste PWA");
try {
  const man = JSON.parse(fs.readFileSync(R("manifest.json"), "utf8"));
  let n = 0;
  for (const i of man.icons || []) { if (!existe(i.src)) err(`manifest.json — icône absente : ${i.src}`); else n++; }
  ok(`${n} icône(s) présente(s)`);
} catch (e) {
  err("manifest.json illisible — " + e.message);
}

/* ------------------------------------------------------------------------
   8. Le sitemap dit-il la même chose que les données ?
   Et surtout : la règle de slug est écrite à trois endroits (js/core.js pour
   le site, scripts/build-seo.js pour le sitemap, og.js pour ce que voient les
   robots). Si l'une dérive, le sitemap déclare des URLs dont le canonical
   désigne autre chose — le pire des deux mondes.
   ------------------------------------------------------------------------ */
titre("Sitemap et adresses");
const slugCore = (() => {
  const src = fs.readFileSync(R("js/core.js"), "utf8");
  const m = src.match(/function slugify\(x\) \{[\s\S]*?\r?\n  \}/);
  if (!m) return null;
  try { return new Function("return (" + m[0] + ")")(); } catch { return null; }
})();
const slugBuild = (() => {
  const src = fs.readFileSync(R("scripts/build-seo.js"), "utf8");
  const m = src.match(/const slugFile = [\s\S]*?;\r?\n/);
  if (!m) return null;
  try { return new Function(m[0] + " return slugFile;")(); } catch { return null; }
})();

if (!slugCore) err("js/core.js — fonction slugify introuvable (renommée ?)");
if (!slugBuild) err("scripts/build-seo.js — slugFile introuvable (renommée ?)");
if (slugCore && slugBuild) {
  const divergents = SERIES.map(s => s.id).filter(id => slugCore(id) !== slugBuild(id));
  if (divergents.length) divergents.forEach(id => err(`slug divergent pour « ${id} » : site=${slugCore(id)}, sitemap=${slugBuild(id)}`));
  else ok("le site et le sitemap fabriquent le même slug pour les " + SERIES.length + " séries");
  const slugs = SERIES.map(s => slugCore(s.id));
  const doublons = slugs.filter((x, i) => slugs.indexOf(x) !== i);
  if (doublons.length) err(`deux séries partagent le même slug : ${[...new Set(doublons)].join(", ")}`);
  else ok("un slug unique par série");
}

if (!existe("sitemap.xml")) {
  saute("sitemap.xml absent — lance d'abord node scripts/build-seo.js");
} else {
  const index = fs.readFileSync(R("sitemap.xml"), "utf8");
  const fichiers = [...index.matchAll(/<loc>[^<]*\/(sitemap[^<\/]*\.xml)<\/loc>/g)].map(m => m[1]);
  let urls = [];
  for (const f of fichiers) {
    if (!existe(f)) { err(`sitemap.xml annonce ${f}, qui n'existe pas`); continue; }
    urls = urls.concat([...fs.readFileSync(R(f), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]));
  }
  /* On compare des CHEMINS, jamais des URLs entières : le domaine du sitemap
     est celui du déploiement (scripts/build-seo.js lit process.env.URL), donc
     lanortradtest.netlify.app sur le site de test et lanortrad.com en
     production. Comparer les URLs entières faisait échouer le build de test
     sur les 554 pages à la fois — ce que le domaine vaut ne regarde pas cette
     vérification, qui porte sur ce qui est déclaré. */
  const chemins = new Set();
  const origines = new Set();
  for (const u of urls) {
    try { const x = new URL(u); chemins.add(x.pathname); origines.add(x.origin); }
    catch { err(`URL invalide dans le sitemap : ${u}`); }
  }
  if (origines.size > 1) err(`le sitemap mélange plusieurs domaines : ${[...origines].join(", ")}`);
  else if (origines.size) ok(`sitemap servi pour ${[...origines][0]}`);

  const attendus = [];
  if (slugCore) {
    for (const s of SERIES) {
      attendus.push(`/manga/${slugCore(s.id)}/`);
      for (const c of CHAPTERS[s.id] || [])
        attendus.push(`/manga/${slugCore(s.id)}/chapitre-${encodeURIComponent(c.num)}/`);
    }
    const absents = attendus.filter(u => !chemins.has(u));
    if (absents.length) {
      absents.slice(0, 5).forEach(u => err(`absent du sitemap : ${u}`));
      if (absents.length > 5) err(`… et ${absents.length - 5} autre(s) URL(s) absente(s) du sitemap`);
    } else ok(`${attendus.length} URLs de séries et de chapitres déclarées`);
  }
  const anciennes = urls.filter(u => /\.html\?(id|manga|genre)=/.test(u));
  if (anciennes.length) err(`${anciennes.length} URL(s) du sitemap sont encore à l'ancienne forme (?id=…)`);
  else ok("aucune adresse à l'ancienne forme dans le sitemap");
}

/* ------------------------------------------------------------------------
   Bilan
   ------------------------------------------------------------------------ */
console.log("");
if (sautes) console.log(`${sautes} vérification(s) sautée(s) — fichiers absents de ce checkout.`);
if (alertes) console.log(`${alertes} alerte(s) : à regarder, mais rien de bloquant.`);
if (erreurs) {
  console.log(`${erreurs} ERREUR(S). Le site serait publié dans cet état.`);
  process.exit(1);
}
console.log("Tout est cohérent.");
