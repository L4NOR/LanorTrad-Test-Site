#!/usr/bin/env node
/* =========================================================================
   LanorTrad — Épisodes des animés : titres, dates et images.

   Lancer :  node tools/build-anime.js            (ne récupère que ce qui manque)
             node tools/build-anime.js --force    (tout refaire)
             node tools/build-anime.js --saison tougen-anki-nikko-kegon-falls-arc

   POURQUOI
   L'onglet « Anime » n'affichait que des numéros dans des cases. Un numéro ne
   dit pas de quoi parle l'épisode, ni où on en est. Aniverse, lui, connaît le
   titre FRANÇAIS, la date et l'image de chaque épisode.

   Ce script les lit une fois et les écrit dans js/data/anime-episodes.js. Le
   site n'appelle donc JAMAIS Aniverse au chargement : il lit un fichier local.
   Seules les images restent chez eux (cdn.onefy.me) — on pointe la source
   qu'on met en avant plutôt que d'en recopier les visuels, et l'onglet retombe
   sur l'affiche de l'entrée, puis sur une case numérotée, si une image manque.

   DEUX SOURCES, DANS CET ORDRE
   1. La page de la série, /anime/<slug> : sa charge utile embarque la liste
      COMPLÈTE des épisodes (titre, image, date). Une seule requête par entrée,
      et c'est la seule source qui donne le visuel d'un film — une page de
      lecture de film n'a pas de fiche d'épisode.
   2. À défaut (page illisible, structure changée) : les blocs JSON-LD
      schema.org/TVEpisode des pages /watch/<slug>?ep=<n>, une par épisode.
      Plus lent, mais c'est de la donnée standard, qui bouge rarement.

   Pas besoin de relancer ce script chaque vendredi pour que les liens de la
   saison en cours marchent : js/manga.js déduit tout seul les épisodes sortis
   du calendrier déclaré dans js/data/anime.js. Le relancer ne sert qu'à
   récupérer le titre et l'image des nouveaux épisodes.

   Le fichier produit est un cumul : rien n'est effacé si Aniverse répond mal
   un jour. Les épisodes écrits à la main dans js/data/anime.js (champ `eps`)
   ne passent pas par ici — le site les met devant tout le reste.
   ========================================================================= */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "js", "data", "anime.js");
const OUT = path.join(ROOT, "js", "data", "anime-episodes.js");

const SERIE = "https://aniverse.fr/anime/";
const WATCH = "https://aniverse.fr/watch/";
// Un UA de navigateur : un UA exotique se fait filtrer en amont du site. On y
// accroche le nom de l'outil pour rester identifiable côté Aniverse.
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36 LanorTrad-build/1.0 (+https://lanortrad.com)";
const PAUSE = 350;   // ms entre deux requêtes : on ne martèle pas un site tiers
const ESSAIS = 3;

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const SEULE = (() => { const i = args.indexOf("--saison"); return i >= 0 ? args[i + 1] : null; })();

const dodo = ms => new Promise(r => setTimeout(r, ms));
const log = m => console.log(m);

/* ---------- 1. Ce qu'il faut aller chercher -------------------------------
   La liste des entrées vient de js/data/anime.js : une seule source de vérité.
   On le charge comme le fait scripts/check.js (le fichier pose window.ANIME). */
function entreesAChercher() {
  const w = {};
  new Function("window", fs.readFileSync(SRC, "utf8"))(w);
  const out = [];
  for (const [serie, a] of Object.entries(w.ANIME || {})) {
    for (const se of a.seasons || []) {
      if (!se.avSlug || !se.episodes) continue;
      if (SEULE && se.avSlug !== SEULE) continue;
      // Un film ou un bonus n'a pas de numero de saison : on le nomme par son
      // type, sinon le journal annonce « saison undefined ».
      const quoi = se.n ? `saison ${se.n}` : (se.kind || "entree");
      out.push({ serie, quoi, slug: se.avSlug, episodes: se.episodes, kind: se.kind || null });
    }
  }
  return out;
}

/* ---------- 2. Réseau ----------------------------------------------------- */
async function page(url) {
  let dernier;
  for (let essai = 1; essai <= ESSAIS; essai++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "fr-FR,fr;q=0.9" },
        signal: AbortSignal.timeout(30000)
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) {
      dernier = e;
      if (essai < ESSAIS) await dodo(1500 * essai);
    }
  }
  throw dernier;
}

/* ---------- 3. La page d'une série, source principale ---------------------
   Le site est en Next.js : la page arrive avec sa charge utile en JavaScript,
   `self.__next_f.push([1,"…"])`. Chaque morceau est une CHAÎNE JSON : on la
   décode avec JSON.parse plutôt qu'en retirant les antislashs à la main, sinon
   un titre contenant un guillemet casse tout le reste. */
function chargesNext(html) {
  const out = [];
  const re = /self\.__next_f\.push\(\[1,\s*("(?:[^"\\]|\\[\s\S])*")\s*\]\)/g;
  let m;
  while ((m = re.exec(html))) {
    try { out.push(JSON.parse(m[1])); } catch { /* morceau illisible : au suivant */ }
  }
  return out;
}

/* L'objet JSON qui commence à cette position, en comptant les accolades — et
   en ignorant celles qui sont dans une chaîne, sinon un titre à accolade
   tronque l'objet. */
function objetDepuis(txt, deb) {
  let prof = 0, dansTexte = false, echappe = false;
  for (let k = deb; k < txt.length; k++) {
    const c = txt[k];
    if (echappe) { echappe = false; continue; }
    if (c === "\\") { echappe = true; continue; }
    if (c === '"') { dansTexte = !dansTexte; continue; }
    if (dansTexte) continue;
    if (c === "{") prof++;
    else if (c === "}" && --prof === 0) return txt.slice(deb, k + 1);
  }
  return null;
}

/* TOUS les objets introduits par cette clé. Il en faut plusieurs : la charge
   utile contient aussi `"episodes":12` (le compte de la fiche) et
   `"episodes":[]` (la liste des sous-titres Crunchyroll). S'arrêter au premier
   « episodes » venu, c'est rater la vraie liste qui suit dans le même morceau. */
function objetsApres(txt, cle) {
  const out = [];
  let i = 0;
  while ((i = txt.indexOf(cle, i)) >= 0) {
    const deb = i + cle.length;
    if (txt[deb] === "{") {
      const brut = objetDepuis(txt, deb);
      if (brut) out.push(brut);
    }
    i = deb;
  }
  return out;
}

/* La liste des épisodes telle que la page de la série la connaît.

   ATTENTION : la page n'envoie que la PREMIÈRE TRANCHE de la liste (seize
   épisodes environ) — la suite se charge au défilement. Elle annonce en
   revanche le total dans `maxEpisodes`. Un épisode absent de `items` n'est
   donc pas un épisode qui n'existe pas : c'est juste la suite de la liste,
   qu'on ira chercher page par page. */
async function listeEpisodes(slug) {
  const html = await page(`${SERIE}${slug}`);
  for (const charge of chargesNext(html)) {
    for (const brut of objetsApres(charge, '"episodes":')) {
      try {
        const d = JSON.parse(brut);
        if (Array.isArray(d.items)) return { items: d.items, max: +d.maxEpisodes || null, html };
      } catch { /* ce n'etait pas le bon bloc : on continue */ }
    }
  }
  return { items: null, max: null, html };
}

/* ---------- 4. Le détail d'un épisode (source de secours) ----------------- */
function episodeJsonLd(html) {
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) {
    try {
      const d = JSON.parse(m[1]);
      if (d["@type"] === "TVEpisode") return d;
    } catch { /* un bloc illisible n'empêche pas de lire les suivants */ }
  }
  return null;
}

/* « Épisode 7 » n'est pas un titre, c'est l'absence de titre : Aniverse le met
   tant que le titre officiel n'est pas connu. On préfère ne rien dire. */
const titreGenerique = t => !t || /^\s*(épisode|episode|ep\.?)\s*\d+\s*$/i.test(t);

/* Une vraie image D'ÉPISODE, pas l'affiche de la série servie par défaut :
   la même affiche répétée douze fois serait pire qu'une case numérotée. */
const vraieMiniature = u => typeof u === "string" && /\/episodes\/[^/]+$/.test(u);

const dateCourte = d => {
  const s = String(d || "");
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

/* ---------- 5. Les infos de l'entrée -------------------------------------
   Langues réellement proposées et prochain épisode annoncé : c'est dans la
   charge utile de la page de lecture, pas dans le JSON-LD. On lit au plus
   simple, sans prétendre comprendre tout le reste du blob. */
function infosEntree(html) {
  const brut = html.replace(/\\/g, "");
  const info = {};
  const audio = brut.match(/"allowed":\{"sub":\[([^\]]*)\],"dub":\[([^\]]*)\]\}/);
  if (audio) {
    const compte = s => s.split(",").filter(x => x.trim() !== "").length;
    info.vostfr = compte(audio[1]);
    info.vf = compte(audio[2]);
  }
  const suite = brut.match(/"nextEpisodeNumber":(\d+),"nextEpisodeAirDate":"\$D([^"]+)"/);
  if (suite) info.suivant = { n: +suite[1], le: suite[2] };
  return info;
}

/* L'affiche de l'entrée : image de repli pour les cartes sans visuel propre.
   On prend l'AFFICHE plutôt que le « cover » large : le cover d'une fiche est
   parfois une image d'archive sans rapport (c'est le cas sur la fiche du film
   Blue Exorcist), alors que l'affiche est toujours la bonne. La carte la
   recadre en 16/9. */
function afficheDe(html) {
  const art = /cdn\.onefy\.me\/t\/artwork\/anime\/[0-9a-f-]+\/(?:poster|cover)-[^"\\ ]+/g;
  const vus = html.match(art) || [];
  const choix = vus.find(u => /\/poster-/.test(u)) || vus[0];
  if (!choix) return null;
  /* Les originaux pèsent jusqu'à 1,4 Mo pour une carte de 214 px. Le CDN sait
     redimensionner à la volée : w_500 suffit même sur un écran 2x. */
  return "https://" + choix.replace("/t/artwork/", "/t/w_500,c_limit/artwork/");
}

/* ---------- 6. Ce qu'on sait déjà ----------------------------------------- */
function dejaConnu() {
  if (!fs.existsSync(OUT) || FORCE) return {};
  try {
    const w = {};
    new Function("window", fs.readFileSync(OUT, "utf8"))(w);
    return w.ANIME_EPISODES || {};
  } catch (e) {
    log("  (fichier existant illisible, on repart de zéro : " + e.message + ")");
    return {};
  }
}

/* ---------- 7. Écriture --------------------------------------------------- */
function ecrire(data) {
  const entete = `// === LanorTrad - Episodes des animes (titres, dates, images) ===
// FICHIER GENERE par tools/build-anime.js - ne pas editer a la main.
// Source : les pages d'Aniverse (aniverse.fr).
// Cle : le slug Aniverse de l'entree (champ avSlug dans js/data/anime.js).
//   t   : titre francais de l'episode       d : date de diffusion (AAAA-MM-JJ)
//   img : image de l'episode                maj : date de la derniere recolte
//   affiche : image de l'entree, servie aux cartes sans visuel propre
//   langs   : nombre d'episodes dispos en VOSTFR / VF
//   suivant : prochain episode annonce {n, le} - indicatif, il vieillit vite
//
// Rien ici n'est indispensable : sans ce fichier, l'onglet Anime affiche des
// cases numerotees et tous les liens marchent quand meme.
window.ANIME_EPISODES = {
`;
  const corps = Object.entries(data).map(([slug, s]) => {
    const eps = Object.entries(s.eps || {})
      .sort((a, b) => +a[0] - +b[0])
      .map(([n, e]) => `      "${n}": ${JSON.stringify(e)}`)
      .join(",\n");
    const tete = [
      `    maj: ${JSON.stringify(s.maj)}`,
      s.affiche ? `    affiche: ${JSON.stringify(s.affiche)}` : null,
      s.langs ? `    langs: ${JSON.stringify(s.langs)}` : null,
      s.suivant ? `    suivant: ${JSON.stringify(s.suivant)}` : null
    ].filter(Boolean).join(",\n");
    return `  ${JSON.stringify(slug)}: {\n${tete},\n    eps: ${eps ? `{\n${eps}\n    }` : "{}"}\n  }`;
  }).join(",\n\n");
  fs.writeFileSync(OUT, entete + corps + "\n};\n", "utf8");
}

/* ---------- 8. Déroulé ---------------------------------------------------- */
(async () => {
  const entrees = entreesAChercher();
  if (!entrees.length) { log("Aucune entree avec un slug Aniverse dans js/data/anime.js."); return; }

  const data = dejaConnu();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  let recoltes = 0, manquants = 0;

  for (const se of entrees) {
    const fiche = data[se.slug] || (data[se.slug] = { maj: aujourdhui, eps: {} });
    fiche.eps = fiche.eps || {};
    log(`\n== ${se.serie} - ${se.quoi} (${se.slug}, ${se.episodes} ep.) ==`);

    const garde = (n, e) => {
      if (!Object.keys(e).length) return false;
      fiche.eps[String(n)] = e;
      fiche.maj = aujourdhui;
      recoltes++;
      log(`  ep. ${n} : ${e.t || "(sans titre)"}${e.img ? " + image" : ""}`);
      return true;
    };

    // — Source 1 : la liste de la page de la serie, en une requete —
    let items = null, maxAniverse = null;
    try {
      const r = await listeEpisodes(se.slug);
      items = r.items;
      maxAniverse = r.max;
      const aff = afficheDe(r.html);
      if (aff) fiche.affiche = aff;
      if (!items) log("  (liste des episodes illisible sur la page de la serie)");
    } catch (e) {
      log(`  liste des episodes : echec reseau (${e.message})`);
    }
    await dodo(PAUSE);

    if (items) {
      for (const it of items) {
        const n = +it.episodeNumber;
        if (!n || n > se.episodes) continue;
        const connu = fiche.eps[String(n)];
        if (connu && (connu.t || connu.img) && !FORCE) continue;
        const e = {};
        const t = it.titleFr || it.episodeTitle;
        if (!titreGenerique(t)) e.t = t;
        const d = dateCourte(it.releaseDate);
        if (d) e.d = d;
        if (vraieMiniature(it.episodeImage)) e.img = it.episodeImage;
        if (!garde(n, e)) manquants++;
      }
    }

    // Ce qu'Aniverse n'a pas encore publie : inutile d'aller frapper a la porte.
    const dispo = maxAniverse ? Math.min(se.episodes, maxAniverse) : se.episodes;
    if (dispo < se.episodes) {
      manquants += se.episodes - dispo;
      log(`  ep. ${dispo + 1} a ${se.episodes} : pas encore publie(s) chez Aniverse`);
    }

    /* — Infos de l'entree : langues et prochain episode (page de lecture).
         Relue a chaque passage, meme quand tout est deja connu : « prochain
         episode » vieillit vite. — */
    let htmlUn = null;
    try {
      htmlUn = await page(`${WATCH}${se.slug}?ep=1`);
      const infos = infosEntree(htmlUn);
      if (infos.vostfr !== undefined) fiche.langs = { vostfr: infos.vostfr, vf: infos.vf };
      if (infos.suivant) fiche.suivant = infos.suivant; else delete fiche.suivant;
      if (!fiche.affiche) {
        const aff = afficheDe(htmlUn);
        if (aff) fiche.affiche = aff;
      }
    } catch (e) {
      log(`  infos d'entree : echec reseau (${e.message}) - on garde ce qu'on avait`);
    }
    await dodo(PAUSE);

    /* — Source 2 : une page par episode, pour ce qui manque encore. C'est le
         cas de la fin des longues saisons (la liste s'arrete a seize) et de
         tout le reste si la page de la serie etait illisible. — */
    for (let n = 1; n <= dispo; n++) {
      const connu = fiche.eps[String(n)];
      if (connu && (connu.t || connu.img)) continue;

      let html = n === 1 ? htmlUn : null;   // déjà lue pour les infos d'entrée
      if (!html) {
        try {
          html = await page(`${WATCH}${se.slug}?ep=${n}`);
        } catch (e) {
          log(`  ep. ${n} : echec reseau (${e.message}) - on garde ce qu'on avait`);
          manquants++;
          await dodo(PAUSE);
          continue;
        }
        await dodo(PAUSE);
      }

      const d = episodeJsonLd(html);
      // Aniverse renvoie le dernier épisode publié quand on en demande un qui
      // n'existe pas encore : numéro différent = épisode pas encore sorti.
      if (!d || d.episodeNumber !== n) {
        log(`  ep. ${n} : pas encore publie chez Aniverse`);
        manquants++;
        continue;
      }
      const e = {};
      if (!titreGenerique(d.name)) e.t = d.name;
      const quand = dateCourte(d.datePublished);
      if (quand) e.d = quand;
      if (vraieMiniature(d.image)) e.img = d.image;
      if (!garde(n, e)) { log(`  ep. ${n} : rien d'exploitable`); manquants++; }
    }
  }

  ecrire(data);
  log(`\n${recoltes} episode(s) recolte(s), ${manquants} laisse(s) de cote.`);
  log(`Ecrit : ${path.relative(ROOT, OUT)}`);
})().catch(e => { console.error("\nEchec : " + e.stack); process.exit(1); });
