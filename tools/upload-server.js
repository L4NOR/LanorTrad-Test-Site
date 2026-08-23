/* =========================================================================
   LanorTrad — Serveur LOCAL d'ajout de chapitres (sans coder).
   Lance :  node tools/upload-server.js   (ou double-clic sur Ajouter-Chapitre.bat)
   Puis ouvre : http://localhost:4599

   Ce qu'il fait :
   1. Liste tes séries (dossiers de /Manga).
   2. Tu choisis une série + numéro de chapitre, tu glisses les images des pages
      (JPG/PNG accepté tel quel — pas besoin de convertir avant).
   3. Il crée Manga/<Série>/Chapitres/Chapitre NN/ et y range les pages (001, 002…).
   4. Il convertit automatiquement les pages en WebP QUALITÉ 90 (via
      tools/jpg-to-webp.py), SANS toucher aux couleurs ni aux tons (une case
      optionnelle, décochée par défaut, permet une simple netteté légère),
      puis supprime les JPG sources.
      La qualité 90 est le réglage de tout le catalogue depuis la passe
      tools/webp-alleger.py : un chapitre de vingt pages pèse ~11 Mo au lieu
      de ~22 Mo en sans perte. Un nouveau chapitre converti autrement
      arriverait deux fois plus lourd que ses voisins, pour l'œil le même.
   5. Il régénère js/data/chapters.js → le chapitre est lisible sur le site.

   Onglet « Gérer » (façon manager de l'ancien site) :
   - liste les chapitres d'une série (nb de pages),
   - éditeur de chapitre : miniatures des pages, suppression d'une page,
     insertion de pages à une position, remplacement complet des pages,
     changement de numéro, suppression du chapitre,
   - toute modification renumérote les pages (001, 002…) et régénère chapters.js.

   Prérequis conversion : Python + Pillow  (py -m pip install pillow)

   ⚠️  Outil LOCAL uniquement (écoute sur 127.0.0.1). N'expose rien sur Internet.
       Après publication, pense à mettre ton site en ligne (git push / Netlify)
       pour que les visiteurs voient le nouveau chapitre.
   ========================================================================= */
"use strict";
const http  = require("http");
const fs    = require("fs");
const path  = require("path");
const { spawn, spawnSync } = require("child_process");

const ROOT      = path.join(__dirname, "..");
const MANGA_DIR = path.join(ROOT, "Manga");
const OUT       = path.join(ROOT, "js", "data", "chapters.js");
const PREV_NAME = "preview";                       // Manga/preview/<Serie>/<Chapitre>/
const isSeriesDir = n => n.toLowerCase() !== PREV_NAME;
const PORT      = Number(process.env.PORT) || 4599;
const IMG_EXT   = [".jpg", ".jpeg", ".png", ".webp", ".avif"];

/* Qualité WebP des pages converties.
   Doit rester alignée sur tools/webp-alleger.py (--qualite, défaut 90), qui a
   réencodé tout le catalogue existant. Les deux outils écrivent les mêmes
   pages : les désaccorder ferait cohabiter des chapitres au poids double. */
const WEBP_QUALITY = 90;

/* ----------------------------- utils ----------------------------- */
const safeName = s => String(s || "").replace(/[\/\\]/g, "").replace(/\.\./g, "").trim();
const isImg    = f => IMG_EXT.includes(path.extname(f).toLowerCase());
const imagesIn = d => fs.readdirSync(d).filter(isImg)
  .sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }));

function chapFolderName(ch) {
  ch = String(ch).trim();
  const m = ch.match(/^(\d+)(\.\d+)?$/);
  if (!m) return null;
  let intp = m[1];
  if (intp.length < 2) intp = "0" + intp;           // 5 -> 05 (joli tri fichiers)
  return "Chapitre " + intp + (m[2] || "");
}
const fmtNum = n => (n === Math.trunc(n) ? String(Math.trunc(n)) : ("" + n));

/* Dossier disque d'un chapitre. chapter = numéro ("19", "138.5") ou "oneshot". */
function chapterDir(series, chapter) {
  const serie = safeName(series);
  if (!serie) return null;
  if (String(chapter || "").trim().toLowerCase() === "oneshot")
    return path.join(MANGA_DIR, serie, "Oneshot");
  const folder = chapFolderName(chapter);
  return folder ? path.join(MANGA_DIR, serie, "Chapitres", folder) : null;
}

/* Renomme les pages en 001, 002… selon l'ordre donné (rename en 2 phases
   pour éviter toute collision entre anciens et nouveaux noms). */
function renumberChapter(dir, order) {
  order.forEach((f, i) => fs.renameSync(path.join(dir, f),
    path.join(dir, "__ren__" + i + path.extname(f).toLowerCase())));
  order.forEach((f, i) => fs.renameSync(
    path.join(dir, "__ren__" + i + path.extname(f).toLowerCase()),
    path.join(dir, String(i + 1).padStart(3, "0") + path.extname(f).toLowerCase())));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function sendJSON(res, code, obj) {
  const b = Buffer.from(JSON.stringify(obj));
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(b);
}

/* ---------------- conversion WebP (tools/jpg-to-webp.py) ---------------- */
function runPy(cmd, args) {
  return new Promise(resolve => {
    let out = "", failed = false;
    let ps;
    try { ps = spawn(cmd, args, { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }); }
    catch { return resolve({ spawned: false }); }
    ps.on("error", () => { failed = true; resolve({ spawned: false }); });
    ps.stdout.on("data", d => out += d);
    ps.stderr.on("data", d => out += d);
    ps.on("close", code => { if (!failed) resolve({ spawned: true, ok: code === 0, log: out }); });
  });
}

async function convertChapter(dir, enhance) {
  const args = [path.join(ROOT, "tools", "jpg-to-webp.py"), dir,
    "--delete-src", "--include-png", "--quality", String(WEBP_QUALITY)];
  if (enhance) args.push("--enhance");
  for (const cmd of ["py", "python", "python3"]) {
    const r = await runPy(cmd, args);
    if (r.spawned) return r;
  }
  return { spawned: false, ok: false,
    log: "Python introuvable. Installe Python puis :  py -m pip install pillow" };
}

/* ------------------- regeneration de l'index des chapitres -------------
   Ce fichier ne s'ecrit PLUS ici.

   js/data/chapters.js n'est qu'un INDEX (numeros, dossiers, nb de pages,
   vignettes, dimensions) ; la liste des fichiers de chaque chapitre vit dans
   js/data/pages/<Serie>.js, et l'index y renvoie par window.CHAPTER_PAGES.
   Cet outil, lui, ecrivait encore l'ancien format « tout dans un seul
   fichier ». Resultat, a chaque chapitre televerse : CHAPTER_PAGES
   disparaissait, le lecteur ne trouvait plus aucune liste de pages et
   affichait « La liste des pages n'a pas pu etre chargee » sur TOUS les
   chapitres de TOUTES les series — et l'index repassait de 15 Ko a 310 Ko,
   charges sur chaque page du site. C'est arrive le 2026-08-23.

   Un seul generateur desormais : tools/build-data.py. Il fait aussi les
   apercus (build-previews.py) et les dimensions, donc l'appel separe a
   build-previews.py a disparu avec le reste. Les deux sont mis en cache :
   un chapitre de plus ne remesure pas les 14 000 pages.

   Si Python manque, on echoue franchement. Ecrire un index a moitie juste
   serait pire : le site partirait en ligne illisible sans que rien ne le
   signale. */
function rebuildChapters() {
  const args = [path.join(ROOT, "tools", "build-data.py")];
  let lance = false, sortie = "";
  for (const cmd of ["py", "python", "python3"]) {
    const r = spawnSync(cmd, args, { windowsHide: true, cwd: ROOT, encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" } });
    if (r.error) continue;
    lance = true;
    sortie = String(r.stdout || "") + String(r.stderr || "");
    if (r.status === 0) return compterChapitres();
    break;
  }
  if (!lance)
    throw new Error("Python est introuvable : l'index des chapitres n'a pas ete " +
                    "regenere. Installe Python (https://nodejs.org pour Node, " +
                    "https://python.org pour Python) puis lance : py tools/build-data.py");
  const extrait = sortie.trim().split(/\r?\n/).slice(-15).join("\n");
  throw new Error("tools/build-data.py a echoue, l'index n'a pas ete regenere :" +
                  "\n" + extrait);
}

/* Compte ce que build-data.py vient d'ecrire, plutot que ce qu'on croit avoir
   demande : les chiffres affiches viennent du fichier reellement produit. */
function compterChapitres() {
  const w = {};
  new Function("window", fs.readFileSync(OUT, "utf8"))(w);
  const data = w.CHAPTERS || {};
  return { series: Object.keys(data).length,
           chapters: Object.values(data).reduce((n, v) => n + v.length, 0) };
}
/* ------------------------------ routes ------------------------------ */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const p = u.pathname;

    if (p === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE);
    }

    // État : liste des séries + chapitres existants
    if (p === "/api/state" && req.method === "GET") {
      const series = [];
      if (fs.existsSync(MANGA_DIR)) {
        for (const s of fs.readdirSync(MANGA_DIR).sort()) {
          const sp = path.join(MANGA_DIR, s);
          if (!fs.statSync(sp).isDirectory() || !isSeriesDir(s)) continue;
          const chapRoot = path.join(sp, "Chapitres");
          let chaps = [];
          if (fs.existsSync(chapRoot))
            chaps = fs.readdirSync(chapRoot)
              .map(e => (e.match(/(\d+(?:\.\d+)?)/) || [])[1]).filter(Boolean);
          series.push({ id: s, chapters: chaps });
        }
      }
      return sendJSON(res, 200, { series });
    }

    // Crée le dossier du chapitre
    if (p === "/api/chapter-init" && req.method === "POST") {
      const { series, chapter } = JSON.parse((await readBody(req)).toString() || "{}");
      if (!safeName(series)) return sendJSON(res, 400, { error: "Série invalide." });
      const dir = chapterDir(series, chapter);
      if (!dir) return sendJSON(res, 400, { error: "Numéro de chapitre invalide (ex : 19, 138.5 ou oneshot)." });
      if (fs.existsSync(dir) && imagesIn(dir).length)
        return sendJSON(res, 409, { error: "Ce chapitre existe déjà et contient des images. Passe par l'onglet « Gérer » pour le modifier." });
      fs.mkdirSync(dir, { recursive: true });
      return sendJSON(res, 200, { ok: true, folder: path.basename(dir) });
    }

    // Enregistre une page (corps = binaire de l'image).
    // tmp=1 : page en attente d'insertion (préfixe zzz-tmp-, cf. /api/pages-insert)
    if (p === "/api/page" && req.method === "POST") {
      const dir = chapterDir(u.searchParams.get("series"), u.searchParams.get("chapter"));
      const seq = String(u.searchParams.get("seq") || "").padStart(3, "0");
      const tmp = u.searchParams.get("tmp") === "1";
      let ext   = (u.searchParams.get("ext") || "jpg").toLowerCase().replace(/[^a-z]/g, "");
      if (!IMG_EXT.includes("." + ext)) ext = "jpg";
      if (!dir || !/^\d{3,}$/.test(seq))
        return sendJSON(res, 400, { error: "Paramètres de page invalides." });
      fs.mkdirSync(dir, { recursive: true });
      const buf = await readBody(req);
      if (!buf.length) return sendJSON(res, 400, { error: "Fichier vide." });
      const name = (tmp ? "zzz-tmp-" : "") + seq + "." + ext;
      fs.writeFileSync(path.join(dir, name), buf);
      return sendJSON(res, 200, { ok: true, file: name });
    }

    // Finalise le chapitre : conversion WebP (+ amélioration) puis chapters.js
    if (p === "/api/finalize" && req.method === "POST") {
      const { series, chapter, enhance } = JSON.parse((await readBody(req)).toString() || "{}");
      const dir = chapterDir(series, chapter);
      if (!dir) return sendJSON(res, 400, { error: "Paramètres invalides." });
      if (!fs.existsSync(dir)) return sendJSON(res, 400, { error: "Chapitre introuvable." });
      const conv = await convertChapter(dir, !!enhance);
      if (!conv.ok)
        return sendJSON(res, 500, { error: "Conversion WebP échouée :\n" + conv.log });
      const stats = rebuildChapters();
      return sendJSON(res, 200, { ok: true, log: conv.log, ...stats });
    }

    // ---- Onglet « Gérer » : lecture ----

    // Chapitres d'une série, avec nb de pages
    if (p === "/api/series-chapters" && req.method === "GET") {
      const serie = safeName(u.searchParams.get("series"));
      const sp = path.join(MANGA_DIR, serie);
      if (!serie || !fs.existsSync(sp)) return sendJSON(res, 404, { error: "Série introuvable." });
      const items = [];
      const chapRoot = path.join(sp, "Chapitres");
      if (fs.existsSync(chapRoot) && fs.statSync(chapRoot).isDirectory()) {
        for (const entry of fs.readdirSync(chapRoot)) {
          const cdir = path.join(chapRoot, entry);
          if (!fs.statSync(cdir).isDirectory()) continue;
          const m = entry.match(/(\d+(?:\.\d+)?)/);
          if (!m) continue;
          const n = parseFloat(m[1]);
          items.push({ id: fmtNum(n), sort: n, label: "Chapitre " + fmtNum(n),
            pages: imagesIn(cdir).length });
        }
      }
      const one = path.join(sp, "Oneshot");
      if (fs.existsSync(one) && fs.statSync(one).isDirectory())
        items.push({ id: "oneshot", sort: -1, label: "Oneshot", pages: imagesIn(one).length });
      items.sort((a, b) => b.sort - a.sort);
      items.forEach(x => delete x.sort);
      return sendJSON(res, 200, { chapters: items });
    }

    // Pages d'un chapitre
    if (p === "/api/chapter" && req.method === "GET") {
      const dir = chapterDir(u.searchParams.get("series"), u.searchParams.get("chapter"));
      if (!dir || !fs.existsSync(dir)) return sendJSON(res, 404, { error: "Chapitre introuvable." });
      return sendJSON(res, 200, { pages: imagesIn(dir) });
    }

    // Sert une image de page (miniatures de l'éditeur)
    if (p === "/api/img" && req.method === "GET") {
      const dir  = chapterDir(u.searchParams.get("series"), u.searchParams.get("chapter"));
      const file = String(u.searchParams.get("file") || "");
      if (!dir || /[\/\\]|\.\./.test(file) || !isImg(file)) { res.writeHead(400); return res.end(); }
      const fp = path.join(dir, file);
      if (!fs.existsSync(fp)) { res.writeHead(404); return res.end(); }
      const types = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".avif": "image/avif" };
      res.writeHead(200, { "Content-Type": types[path.extname(file).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store" });
      return fs.createReadStream(fp).on("error", () => res.end()).pipe(res);
    }

    // ---- Onglet « Gérer » : modifications ----

    // Supprime des pages puis renumérote
    if (p === "/api/pages-delete" && req.method === "POST") {
      const { series, chapter, files } = JSON.parse((await readBody(req)).toString() || "{}");
      const dir = chapterDir(series, chapter);
      if (!dir || !fs.existsSync(dir) || !Array.isArray(files) || !files.length)
        return sendJSON(res, 400, { error: "Paramètres invalides." });
      for (const f of files) {
        if (typeof f !== "string" || /[\/\\]|\.\./.test(f) || !isImg(f))
          return sendJSON(res, 400, { error: "Nom de fichier invalide : " + f });
        const fp = path.join(dir, f);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      renumberChapter(dir, imagesIn(dir));
      const stats = rebuildChapters();
      return sendJSON(res, 200, { ok: true, pages: imagesIn(dir).length, ...stats });
    }

    // Convertit les pages en attente (zzz-tmp-*) et les insère à la position donnée
    if (p === "/api/pages-insert" && req.method === "POST") {
      const { series, chapter, after, enhance } = JSON.parse((await readBody(req)).toString() || "{}");
      const dir = chapterDir(series, chapter);
      if (!dir || !fs.existsSync(dir)) return sendJSON(res, 400, { error: "Chapitre introuvable." });
      const conv = await convertChapter(dir, !!enhance);
      if (!conv.ok) return sendJSON(res, 500, { error: "Conversion WebP échouée :\n" + conv.log });
      const all  = imagesIn(dir);
      const olds = all.filter(f => !f.startsWith("zzz-tmp-"));
      const news = all.filter(f => f.startsWith("zzz-tmp-"));
      const pos  = Math.max(0, Math.min(olds.length, parseInt(after, 10) || 0));
      renumberChapter(dir, olds.slice(0, pos).concat(news, olds.slice(pos)));
      const stats = rebuildChapters();
      return sendJSON(res, 200, { ok: true, log: conv.log, pages: all.length, ...stats });
    }

    // Vide un chapitre (préalable au remplacement complet des pages)
    if (p === "/api/chapter-clear" && req.method === "POST") {
      const { series, chapter } = JSON.parse((await readBody(req)).toString() || "{}");
      const dir = chapterDir(series, chapter);
      if (!dir || !fs.existsSync(dir)) return sendJSON(res, 400, { error: "Chapitre introuvable." });
      for (const f of fs.readdirSync(dir)) if (isImg(f)) fs.unlinkSync(path.join(dir, f));
      return sendJSON(res, 200, { ok: true });
    }

    // Supprime un chapitre entier
    if (p === "/api/chapter-delete" && req.method === "POST") {
      const { series, chapter } = JSON.parse((await readBody(req)).toString() || "{}");
      const dir = chapterDir(series, chapter);
      if (!dir || !fs.existsSync(dir)) return sendJSON(res, 400, { error: "Chapitre introuvable." });
      fs.rmSync(dir, { recursive: true, force: true });
      const stats = rebuildChapters();
      return sendJSON(res, 200, { ok: true, ...stats });
    }

    // Change le numéro d'un chapitre
    if (p === "/api/chapter-rename" && req.method === "POST") {
      const { series, chapter, newChapter } = JSON.parse((await readBody(req)).toString() || "{}");
      if (String(chapter || "").trim().toLowerCase() === "oneshot")
        return sendJSON(res, 400, { error: "Un oneshot ne se renumérote pas." });
      const dir    = chapterDir(series, chapter);
      const folder = chapFolderName(newChapter);
      if (!dir || !fs.existsSync(dir) || !folder)
        return sendJSON(res, 400, { error: "Paramètres invalides (nouveau numéro : ex 19 ou 138.5)." });
      const dst = path.join(MANGA_DIR, safeName(series), "Chapitres", folder);
      if (fs.existsSync(dst)) return sendJSON(res, 409, { error: "Le chapitre " + newChapter + " existe déjà." });
      fs.renameSync(dir, dst);
      const stats = rebuildChapters();
      return sendJSON(res, 200, { ok: true, folder, ...stats });
    }

    // Régénère chapters.js
    if (p === "/api/rebuild" && req.method === "POST") {
      const stats = rebuildChapters();
      return sendJSON(res, 200, { ok: true, ...stats });
    }

    res.writeHead(404); res.end("Not found");
  } catch (e) {
    sendJSON(res, 500, { error: String(e && e.message || e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n  LanorTrad — Ajout de chapitres");
  console.log("  ▶  Ouvre dans ton navigateur :  http://localhost:" + PORT + "\n");
  console.log("  (Laisse cette fenêtre ouverte. Ferme-la pour arrêter.)\n");
});

/* ------------------------ interface web (HTML) ------------------------ */
const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LanorTrad — Ajouter un chapitre</title>
<style>
  :root{--vio:#a855f7;--grad:linear-gradient(135deg,#6366f1,#a855f7 55%,#d946ef)}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b0b16;color:#eef;
    min-height:100vh;display:flex;justify-content:center;padding:32px 16px}
  .card{width:100%;max-width:680px}
  h1{font-size:1.6rem;margin:0 0 4px}.sub{color:#9a98c0;margin:0 0 24px;font-size:.92rem}
  label{display:block;font-size:.82rem;font-weight:600;color:#bdbce0;margin:16px 0 6px}
  input,select{width:100%;padding:12px 14px;border-radius:11px;border:1px solid #2a2a44;
    background:#11111f;color:#eef;font:inherit}
  input:focus,select:focus{outline:none;border-color:var(--vio);box-shadow:0 0 0 3px rgba(168,85,247,.2)}
  .row{display:grid;grid-template-columns:2fr 1fr;gap:14px}
  #drop{margin-top:8px;border:2px dashed #34345a;border-radius:16px;padding:30px;text-align:center;
    color:#9a98c0;cursor:pointer;transition:.2s;background:#0e0e1c}
  #drop.over{border-color:var(--vio);background:rgba(168,85,247,.08);color:#eef}
  #grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:8px;margin-top:14px}
  .thumb{position:relative;border-radius:8px;overflow:hidden;aspect-ratio:2/3;background:#181830}
  .thumb img{width:100%;height:100%;object-fit:cover}
  .thumb b{position:absolute;left:3px;top:3px;background:#000a;border-radius:6px;font-size:.7rem;padding:1px 5px}
  button.go{margin-top:22px;width:100%;padding:14px;border:none;border-radius:12px;cursor:pointer;
    background:var(--grad);color:#fff;font-weight:700;font-size:1rem}
  button.go:disabled{opacity:.5;cursor:not-allowed}
  #log{margin-top:18px;font-size:.85rem;white-space:pre-wrap;color:#bdbce0;
    background:#0e0e1c;border:1px solid #2a2a44;border-radius:11px;padding:12px;min-height:20px;display:none}
  .bar{height:8px;border-radius:6px;background:#1c1c34;overflow:hidden;margin-top:14px;display:none}
  .bar i{display:block;height:100%;width:0;background:var(--grad);transition:width .2s}
  .ok{color:#6ee7b7}.err{color:#fca5a5}
  a.tip{color:var(--vio)}
  .chk{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:.9rem;color:#bdbce0;cursor:pointer}
  .chk input{width:18px;height:18px;accent-color:var(--vio);cursor:pointer;flex:none}
  .tabs{display:flex;gap:8px;margin:0 0 20px}
  .tabs button{flex:1;padding:11px;border-radius:11px;border:1px solid #2a2a44;background:#11111f;
    color:#bdbce0;font:inherit;font-weight:600;cursor:pointer}
  .tabs button.on{background:var(--grad);color:#fff;border-color:transparent}
  .chrow{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid #2a2a44;
    border-radius:11px;background:#0e0e1c;margin-top:8px}
  .chrow b{flex:1;font-weight:600}.chrow small{color:#9a98c0}
  .btn{padding:8px 12px;border-radius:9px;border:1px solid #2a2a44;background:#181830;color:#eef;
    cursor:pointer;font:inherit;font-size:.82rem}
  .btn:hover{border-color:var(--vio)}
  .btn.red{border-color:#7f1d1d;color:#fca5a5}.btn.red:hover{background:rgba(127,29,29,.25)}
  #m-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:10px;margin-top:14px}
  .pg{position:relative;border-radius:8px;overflow:hidden;aspect-ratio:2/3;background:#181830;border:1px solid #2a2a44}
  .pg img{width:100%;height:100%;object-fit:cover}
  .pg b{position:absolute;left:4px;top:4px;background:#000a;border-radius:6px;font-size:.7rem;padding:1px 5px}
  .pg button{position:absolute;right:4px;top:4px;width:22px;height:22px;border:none;border-radius:6px;
    background:#dc2626;color:#fff;cursor:pointer;font-size:.8rem;line-height:1}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  h2.small{font-size:1.05rem;margin:20px 0 0}
</style></head><body><div class="card">
  <h1>📚 LanorTrad — Chapitres</h1>
  <p class="sub">Ajoute, modifie ou supprime des chapitres. Les JPG/PNG sont convertis
    automatiquement en WebP qualité 90, comme le reste du catalogue. Aucun code à écrire.</p>

  <div class="tabs">
    <button id="tab-add" class="on">➕ Ajouter</button>
    <button id="tab-manage">🛠️ Gérer</button>
  </div>

  <div id="view-add">
    <div class="row">
      <div>
        <label>Série</label>
        <input id="series" list="serieslist" placeholder="Nom exact de la série" autocomplete="off">
      </div>
      <div>
        <label>N° de chapitre</label>
        <input id="chapter" placeholder="ex : 19" autocomplete="off">
      </div>
    </div>
    <small id="exists" style="color:#9a98c0"></small>

    <label>Pages (images)</label>
    <div id="drop">📥 Glisse-dépose les images ici (JPG, PNG…), ou clique pour choisir<br>
      <small>Rangées dans l'ordre du nom de fichier (001, 002, …), puis converties en WebP qualité 90.</small></div>
    <input id="file" type="file" accept="image/*" multiple hidden>
    <div id="grid"></div>

    <label class="chk"><input type="checkbox" id="enhance">
      🔪 Netteté légère (optionnel, pour scans un peu flous — les couleurs et
      les tons ne sont jamais modifiés ; laisse décoché pour une conversion
      100 % fidèle)</label>

    <button class="go" id="go" disabled>Publier le chapitre</button>
  </div>

  <div id="view-manage" style="display:none">
    <label>Série</label>
    <input id="m-series" list="serieslist" placeholder="Nom exact de la série" autocomplete="off">
    <div id="m-list"></div>

    <div id="m-editor" style="display:none">
      <h2 class="small" id="m-title"></h2>
      <div class="toolbar">
        <button class="btn" id="m-back">← Retour à la liste</button>
        <button class="btn" id="m-addpages">➕ Ajouter des pages</button>
        <button class="btn" id="m-replace">♻️ Remplacer toutes les pages</button>
        <button class="btn" id="m-rename">🔢 Changer le n°</button>
        <button class="btn red" id="m-delchap">🗑️ Supprimer le chapitre</button>
      </div>
      <p class="sub" style="margin:10px 0 0">Survole une page et clique ✕ pour la supprimer
        (les pages sont renumérotées automatiquement). Pour corriger une page : supprime-la,
        puis « Ajouter des pages » à sa position.</p>
      <label class="chk"><input type="checkbox" id="m-enhance">
        🔪 Netteté légère sur les pages ajoutées (optionnel — tons jamais modifiés)</label>
      <div id="m-pages"></div>
      <input id="m-file" type="file" accept="image/*" multiple hidden>
      <input id="m-rfile" type="file" accept="image/*" multiple hidden>
    </div>
  </div>

  <datalist id="serieslist"></datalist>
  <div class="bar" id="bar"><i></i></div>
  <div id="log"></div>
</div>
<script>
const $=s=>document.querySelector(s);
let files=[], state={series:[]};
const elSeries=$("#series"), elChap=$("#chapter"), elGo=$("#go"), elGrid=$("#grid"),
      elLog=$("#log"), elBar=$("#bar"), elBarI=elBar.querySelector("i"), elExists=$("#exists");

function log(msg,cls){ elLog.style.display="block"; elLog.innerHTML+=(cls?'<span class="'+cls+'">':'<span>')+msg+"</span>\\n"; elLog.scrollTop=elLog.scrollHeight; }
function logReset(){ elLog.innerHTML=""; elLog.style.display="none"; }
function refreshGo(){ elGo.disabled=!(elSeries.value.trim() && elChap.value.trim() && files.length); }

/* onglets */
const tabAdd=$("#tab-add"), tabMan=$("#tab-manage");
function showTab(t){
  tabAdd.classList.toggle("on",t==="add"); tabMan.classList.toggle("on",t!=="add");
  $("#view-add").style.display = t==="add" ? "" : "none";
  $("#view-manage").style.display = t==="add" ? "none" : "";
}
tabAdd.addEventListener("click",()=>showTab("add"));
tabMan.addEventListener("click",()=>showTab("manage"));

async function loadState(){
  state=await (await fetch("/api/state")).json();
  $("#serieslist").innerHTML=state.series.map(s=>'<option value="'+s.id.replace(/"/g,'&quot;')+'">').join("");
}
function checkExists(){
  const s=state.series.find(x=>x.id===elSeries.value.trim());
  elExists.textContent = s && s.chapters.length ? ("Chapitres déjà présents : "+s.chapters.sort((a,b)=>a-b).join(", ")) : "";
}
elSeries.addEventListener("input",()=>{checkExists();refreshGo();});
elChap.addEventListener("input",refreshGo);

/* fichiers */
const drop=$("#drop"), fileInput=$("#file");
drop.addEventListener("click",()=>fileInput.click());
fileInput.addEventListener("change",()=>addFiles(fileInput.files));
["dragover","dragenter"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over");}));
["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over");}));
drop.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
function addFiles(list){
  files=[...list].filter(f=>f.type.startsWith("image/"))
    .sort((a,b)=>a.name.localeCompare(b.name,"fr",{numeric:true}));
  elGrid.innerHTML="";
  files.forEach((f,i)=>{ const d=document.createElement("div"); d.className="thumb";
    d.innerHTML='<b>'+(i+1)+'</b>'; const img=document.createElement("img");
    img.src=URL.createObjectURL(f); d.appendChild(img); elGrid.appendChild(d); });
  refreshGo();
}

/* publication */
elGo.addEventListener("click",async()=>{
  const series=elSeries.value.trim(), chapter=elChap.value.trim();
  elGo.disabled=true; logReset(); elLog.style.display="block"; elBar.style.display="block"; elBarI.style.width="0";
  try{
    log("Création du chapitre "+chapter+" pour « "+series+" »…");
    let r=await fetch("/api/chapter-init",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({series,chapter})});
    let j=await r.json(); if(!r.ok) throw new Error(j.error||"Erreur");
    log("Envoi de "+files.length+" page(s)…");
    for(let i=0;i<files.length;i++){
      const f=files[i], ext=(f.name.split(".").pop()||"jpg");
      const q="series="+encodeURIComponent(series)+"&chapter="+encodeURIComponent(chapter)+"&seq="+(i+1)+"&ext="+encodeURIComponent(ext);
      const pr=await fetch("/api/page?"+q,{method:"POST",body:f});
      const pj=await pr.json(); if(!pr.ok) throw new Error(pj.error||"Erreur page "+(i+1));
      elBarI.style.width=Math.round(((i+1)/files.length)*100)+"%";
    }
    const enhance=$("#enhance").checked;
    log("Conversion des pages en WebP qualité 90"+(enhance?" + netteté légère":"")+" (tons inchangés)… (peut prendre 1 à 2 min)");
    r=await fetch("/api/finalize",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({series,chapter,enhance})});
    j=await r.json(); if(!r.ok) throw new Error(j.error||"Erreur");
    if(j.log) log(j.log.trim());
    log("✅ Terminé ! "+j.chapters+" chapitres au total sur "+j.series+" séries.","ok");
    log("Recharge ton site en local pour voir le chapitre. Pour le mettre en ligne : envoie les fichiers (git push / Netlify).","ok");
    files=[]; elGrid.innerHTML=""; loadState();
  }catch(e){ log("❌ "+e.message,"err"); }
  finally{ elGo.disabled=false; }
});

/* ============================ onglet Gérer ============================ */
let mCur=null;   // {series, chapter, label, pages:[...]}
const mSeries=$("#m-series"), mList=$("#m-list"), mEd=$("#m-editor"), mPages=$("#m-pages");
const postJSON=(url,body)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body)});
const sortImgs=list=>[...list].filter(f=>f.type.startsWith("image/"))
  .sort((a,b)=>a.name.localeCompare(b.name,"fr",{numeric:true}));

mSeries.addEventListener("input",loadChapters);
async function loadChapters(){
  mEd.style.display="none"; mList.style.display=""; mList.innerHTML=""; mCur=null;
  const s=mSeries.value.trim();
  if(!state.series.some(x=>x.id===s)) return;
  const r=await fetch("/api/series-chapters?series="+encodeURIComponent(s));
  const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  if(!j.chapters.length){ mList.innerHTML='<p class="sub" style="margin-top:12px">Aucun chapitre.</p>'; return; }
  j.chapters.forEach(c=>{
    const d=document.createElement("div"); d.className="chrow";
    const b=document.createElement("b"); b.textContent=c.label; d.appendChild(b);
    const sm=document.createElement("small"); sm.textContent=c.pages+" page(s)"; d.appendChild(sm);
    const e=document.createElement("button"); e.className="btn"; e.textContent="✏️ Gérer";
    e.addEventListener("click",()=>openEditor(s,c)); d.appendChild(e);
    const x=document.createElement("button"); x.className="btn red"; x.textContent="🗑️"; x.title="Supprimer le chapitre";
    x.addEventListener("click",()=>delChapter(s,c)); d.appendChild(x);
    mList.appendChild(d);
  });
}

async function openEditor(s,c){
  const r=await fetch("/api/chapter?series="+encodeURIComponent(s)+"&chapter="+encodeURIComponent(c.id));
  const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  mCur={series:s, chapter:c.id, label:c.label, pages:j.pages};
  mList.style.display="none"; mEd.style.display="";
  renderEditor();
}
function renderEditor(){
  $("#m-title").textContent=mCur.series+" — "+mCur.label+" ("+mCur.pages.length+" pages)";
  mPages.innerHTML="";
  mCur.pages.forEach((f,i)=>{
    const d=document.createElement("div"); d.className="pg";
    const n=document.createElement("b"); n.textContent=i+1; d.appendChild(n);
    const img=document.createElement("img"); img.loading=i<12?"eager":"lazy";
    img.src="/api/img?series="+encodeURIComponent(mCur.series)+"&chapter="+encodeURIComponent(mCur.chapter)
      +"&file="+encodeURIComponent(f)+"&v="+Date.now();
    d.appendChild(img);
    const x=document.createElement("button"); x.textContent="✕"; x.title="Supprimer cette page";
    x.addEventListener("click",()=>delPage(f,i+1)); d.appendChild(x);
    mPages.appendChild(d);
  });
}
async function refreshEditor(){
  const r=await fetch("/api/chapter?series="+encodeURIComponent(mCur.series)+"&chapter="+encodeURIComponent(mCur.chapter));
  const j=await r.json();
  if(!r.ok){ loadChapters(); return; }
  mCur.pages=j.pages; renderEditor();
}
$("#m-back").addEventListener("click",loadChapters);

async function delPage(f,n){
  if(!confirm("Supprimer la page "+n+" ("+f+") ?\\nLes pages suivantes seront renumérotées.")) return;
  logReset();
  const r=await postJSON("/api/pages-delete",{series:mCur.series,chapter:mCur.chapter,files:[f]});
  const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  log("✅ Page "+n+" supprimée, pages renumérotées. Catalogue mis à jour.","ok");
  await refreshEditor();
}

async function delChapter(s,c){
  if(!confirm("Supprimer DÉFINITIVEMENT « "+s+" — "+c.label+" » ("+c.pages+" pages) ?")) return;
  logReset();
  const r=await postJSON("/api/chapter-delete",{series:s,chapter:c.id});
  const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  log("✅ "+c.label+" supprimé. "+j.chapters+" chapitres au total sur "+j.series+" séries.","ok");
  loadChapters(); loadState();
}
$("#m-delchap").addEventListener("click",()=>{
  if(mCur) delChapter(mCur.series,{id:mCur.chapter,label:mCur.label,pages:mCur.pages.length});
});

$("#m-rename").addEventListener("click",async()=>{
  if(!mCur) return;
  if(mCur.chapter==="oneshot"){ alert("Un oneshot ne se renumérote pas."); return; }
  const nv=prompt("Nouveau numéro de chapitre :",mCur.chapter);
  if(nv===null||!nv.trim()||nv.trim()===mCur.chapter) return;
  logReset();
  const r=await postJSON("/api/chapter-rename",{series:mCur.series,chapter:mCur.chapter,newChapter:nv.trim()});
  const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  log("✅ "+mCur.label+" renommé en Chapitre "+nv.trim()+". Catalogue mis à jour.","ok");
  mCur.chapter=nv.trim(); mCur.label="Chapitre "+nv.trim();
  await refreshEditor();
});

/* ajout de pages à une position */
$("#m-addpages").addEventListener("click",()=>{ if(mCur) $("#m-file").click(); });
$("#m-file").addEventListener("change",async()=>{
  const fl=sortImgs($("#m-file").files); $("#m-file").value="";
  if(!fl.length||!mCur) return;
  let pos=prompt("Insérer les "+fl.length+" page(s) après quelle page ?\\n(0 = tout début, "+mCur.pages.length+" = à la fin)",mCur.pages.length);
  if(pos===null) return;
  pos=parseInt(pos,10); if(isNaN(pos)||pos<0) pos=mCur.pages.length;
  logReset();
  try{
    log("Envoi de "+fl.length+" page(s)…");
    for(let i=0;i<fl.length;i++){
      const f=fl[i], ext=(f.name.split(".").pop()||"jpg");
      const q="series="+encodeURIComponent(mCur.series)+"&chapter="+encodeURIComponent(mCur.chapter)
        +"&seq="+(i+1)+"&ext="+encodeURIComponent(ext)+"&tmp=1";
      const r=await fetch("/api/page?"+q,{method:"POST",body:f});
      const j=await r.json(); if(!r.ok) throw new Error(j.error||"Erreur page "+(i+1));
    }
    log("Conversion WebP + insertion en position "+pos+"…");
    const r=await postJSON("/api/pages-insert",{series:mCur.series,chapter:mCur.chapter,
      after:pos,enhance:$("#m-enhance").checked});
    const j=await r.json(); if(!r.ok) throw new Error(j.error||"Erreur");
    if(j.log) log(j.log.trim());
    log("✅ Pages insérées ("+j.pages+" au total). Catalogue mis à jour.","ok");
    await refreshEditor();
  }catch(e){ log("❌ "+e.message,"err"); }
});

/* remplacement complet des pages */
$("#m-replace").addEventListener("click",()=>{ if(mCur) $("#m-rfile").click(); });
$("#m-rfile").addEventListener("change",async()=>{
  const fl=sortImgs($("#m-rfile").files); $("#m-rfile").value="";
  if(!fl.length||!mCur) return;
  if(!confirm("Remplacer TOUTES les pages de "+mCur.label+" par les "+fl.length+" image(s) choisies ?\\nLes "+mCur.pages.length+" pages actuelles seront supprimées.")) return;
  logReset();
  try{
    log("Suppression des anciennes pages…");
    let r=await postJSON("/api/chapter-clear",{series:mCur.series,chapter:mCur.chapter});
    let j=await r.json(); if(!r.ok) throw new Error(j.error||"Erreur");
    log("Envoi de "+fl.length+" page(s)…");
    for(let i=0;i<fl.length;i++){
      const f=fl[i], ext=(f.name.split(".").pop()||"jpg");
      const q="series="+encodeURIComponent(mCur.series)+"&chapter="+encodeURIComponent(mCur.chapter)
        +"&seq="+(i+1)+"&ext="+encodeURIComponent(ext);
      const pr=await fetch("/api/page?"+q,{method:"POST",body:f});
      const pj=await pr.json(); if(!pr.ok) throw new Error(pj.error||"Erreur page "+(i+1));
    }
    log("Conversion des pages en WebP qualité 90"+($("#m-enhance").checked?" + netteté légère":"")+" (tons inchangés)…");
    r=await postJSON("/api/finalize",{series:mCur.series,chapter:mCur.chapter,enhance:$("#m-enhance").checked});
    j=await r.json(); if(!r.ok) throw new Error(j.error||"Erreur");
    if(j.log) log(j.log.trim());
    log("✅ Pages remplacées. Catalogue mis à jour.","ok");
    await refreshEditor();
  }catch(e){ log("❌ "+e.message,"err"); }
});

loadState();
</script></body></html>`;
