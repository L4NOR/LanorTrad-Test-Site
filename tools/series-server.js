/* =========================================================================
   LanorTrad — Serveur LOCAL d'édition des fiches séries / oneshots.
   Lance :  node tools/series-server.js   (ou double-clic sur Modifier-Series.bat)
   Puis ouvre : http://localhost:4600

   Pendant que l'outil « Ajouter un chapitre » (upload-server.js) gère les
   IMAGES, celui-ci gère les INFOS de chaque fiche :
   titre, type, genres, statut, nb de chapitres, date de MàJ, note, auteur,
   artiste (dessin), année, couleur d'accent, description, couverture,
   équipes partenaires, mise en avant…

   Ce qu'il fait :
   1. Lit js/data/series.js (window.SERIES) et liste toutes les fiches.
   2. Tu modifies dans un formulaire (ou tu crées / supprimes / réordonnes).
   3. Il réécrit js/data/series.js proprement, dans le même style qu'à la main,
      après avoir mis une copie de sécurité dans tools/.backups/.

   Bonus :
   - suggestions automatiques du nombre de chapitres et de la date de MàJ,
     lues dans js/data/chapters.js et dans les dossiers de /Manga ;
   - avertissement si l'id ne correspond à aucun dossier de /Manga
     (= aucun chapitre ne serait lisible) ;
   - choix de la couverture parmi les fichiers d'images/Cover, avec aperçu.

   ⚠️  Outil LOCAL uniquement (écoute sur 127.0.0.1). N'expose rien sur Internet.
       Après modification, pense à mettre ton site en ligne (git push / Netlify).

   ⚠️  Les commentaires que tu aurais écrits À LA MAIN dans series.js ne sont pas
       conservés par la réécriture (l'en-tête du fichier, le séparateur
       « ONESHOTS » et la note sur les partenaires, si, ils sont réécrits).
   ========================================================================= */
"use strict";
const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT         = path.join(__dirname, "..");
const SERIES_FILE  = path.join(ROOT, "js", "data", "series.js");
const CHAPTERS_FILE= path.join(ROOT, "js", "data", "chapters.js");
const MANGA_DIR    = path.join(ROOT, "Manga");
// Manga/preview/ = vignettes d'apercu (tools/build-previews.py), pas une serie
const isSeriesDir  = n => n.toLowerCase() !== "preview";
const COVER_DIR    = path.join(ROOT, "images", "Cover");
const BACKUP_DIR   = path.join(__dirname, ".backups");
const PORT         = Number(process.env.PORT) || 4600;
const IMG_EXT      = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
const MAX_BACKUPS  = 30;

/* ------------------------- lecture des fichiers ------------------------- */

/* Exécute un fichier « window.X = … » dans un faux window et rend la valeur. */
function loadWindowVar(file, name) {
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, "utf8");
  const win = {};
  new Function("window", src)(win);          // fichiers locaux, écrits par nous
  return win[name] === undefined ? null : win[name];
}

function loadSeries() {
  const list = loadWindowVar(SERIES_FILE, "SERIES");
  if (!Array.isArray(list)) throw new Error("js/data/series.js ne définit pas window.SERIES (tableau).");
  return list;
}

/* Nb de chapitres réellement présents + date du plus récent dossier, par série. */
function chapterStats() {
  const stats = {};
  let manifest = null;
  try { manifest = loadWindowVar(CHAPTERS_FILE, "CHAPTERS"); } catch { manifest = null; }
  if (manifest) for (const id of Object.keys(manifest))
    stats[id] = { count: (manifest[id] || []).length, last: "" };

  if (fs.existsSync(MANGA_DIR)) {
    for (const serie of fs.readdirSync(MANGA_DIR)) {
      const sp = path.join(MANGA_DIR, serie);
      if (!fs.statSync(sp).isDirectory() || !isSeriesDir(serie)) continue;
      const st = stats[serie] || (stats[serie] = { count: 0, last: "" });
      st.folder = true;
      let newest = 0;
      const chapRoot = path.join(sp, "Chapitres");
      const dirs = fs.existsSync(chapRoot)
        ? fs.readdirSync(chapRoot).map(e => path.join(chapRoot, e))
        : [path.join(sp, "Oneshot")];
      for (const d of dirs) {
        if (!fs.existsSync(d) || !fs.statSync(d).isDirectory()) continue;
        const m = fs.statSync(d).mtimeMs;
        if (m > newest) newest = m;
      }
      if (newest) st.last = new Date(newest).toISOString().slice(0, 10);
    }
  }
  return stats;
}

const isImg = f => IMG_EXT.includes(path.extname(f).toLowerCase());
function coverFiles() {
  if (!fs.existsSync(COVER_DIR)) return [];
  return fs.readdirSync(COVER_DIR).filter(isImg)
    .sort((a, b) => a.localeCompare(b, "fr", { numeric: true, sensitivity: "base" }))
    .map(f => "images/Cover/" + f);
}
function mangaFolders() {
  if (!fs.existsSync(MANGA_DIR)) return [];
  return fs.readdirSync(MANGA_DIR)
    .filter(f => fs.statSync(path.join(MANGA_DIR, f)).isDirectory() && isSeriesDir(f)).sort();
}

/* -------------------- validation / normalisation ------------------------ */

const KEY_ORDER = ["id", "title", "type", "genres", "status", "chapters", "lastUpdate",
  "rating", "author", "artist", "year", "accent", "partners", "description",
  "cover", "url", "demo", "featured"];

const str = v => (v === undefined || v === null) ? "" : String(v).trim();

function normalize(raw, previous) {
  const e = {};
  const id = str(raw.id);
  if (!id) throw new Error("L'identifiant (id) est obligatoire.");
  if (/[\/\\]|\.\./.test(id)) throw new Error("L'identifiant ne peut pas contenir / \\ ou « .. ».");
  e.id = id;
  e.title = str(raw.title) || id;
  e.type = raw.type === "oneshot" ? "oneshot" : "manga";

  const genres = (Array.isArray(raw.genres) ? raw.genres : str(raw.genres).split(","))
    .map(str).filter(Boolean);
  e.genres = [...new Set(genres)];
  if (!e.genres.length) throw new Error("Mets au moins un genre.");

  e.status = str(raw.status) || "En cours";

  const ch = Number(raw.chapters);
  if (!isFinite(ch) || ch < 0) throw new Error("Nombre de chapitres invalide.");
  e.chapters = Math.round(ch);

  const last = str(raw.lastUpdate);
  if (last) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(last)) throw new Error("Date de mise à jour invalide (format AAAA-MM-JJ).");
    e.lastUpdate = last;
  }

  const rating = Number(raw.rating);
  if (!isFinite(rating) || rating < 0 || rating > 5) throw new Error("La note doit être entre 0 et 5.");
  e.rating = Math.round(rating * 10) / 10;

  e.author = str(raw.author) || "—";
  const artist = str(raw.artist);
  if (artist) e.artist = artist;

  const year = str(raw.year);
  if (year) {
    const y = Number(year);
    if (!Number.isInteger(y) || y < 1900 || y > 2999) throw new Error("Année invalide (ex : 2019).");
    e.year = y;
  }

  const accent = str(raw.accent).toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(accent)) throw new Error("Couleur d'accent invalide (format #rrggbb).");
  e.accent = accent;

  const partners = (Array.isArray(raw.partners) ? raw.partners : [])
    .map(p => ({ name: str(p && p.name), url: str(p && p.url), color: str(p && p.color).toLowerCase() }))
    .filter(p => p.name);
  for (const p of partners) {
    if (p.url && !/^https?:\/\//i.test(p.url)) throw new Error("Lien de partenaire invalide (" + p.name + ") : il doit commencer par http:// ou https://");
    if (!/^#[0-9a-f]{6}$/.test(p.color)) p.color = "#a855f7";
  }
  if (partners.length) e.partners = partners;

  e.description = str(raw.description);
  if (!e.description) throw new Error("La description est obligatoire.");

  e.cover = str(raw.cover);
  if (!e.cover) throw new Error("Indique une couverture (ex : images/Cover/MonManga.jpg).");

  e.url = str(raw.url) || ("manga.html?id=" + encodeURIComponent(id));
  e.demo = !!raw.demo;
  e.featured = !!raw.featured;

  // Champs « maison » ajoutés à la main dans series.js : on les garde.
  if (previous) for (const k of Object.keys(previous))
    if (!KEY_ORDER.includes(k) && e[k] === undefined) e[k] = previous[k];

  return e;
}

/* ------------------------- écriture de series.js ------------------------ */

const HEADER = [
  "// === LanorTrad - Source unique des metadonnees de series ===",
  "// Editez ce fichier a la main OU via l'outil local :",
  "//   node tools/series-server.js   (ou tools/Modifier-Series.bat)",
  "// Le manifeste des pages (nombre de pages par chapitre) est genere a part",
  "// par tools/build-data.py.",
  "//",
  "// id        : doit correspondre EXACTEMENT au dossier dans /Manga (pour le lecteur)",
  "// accent    : couleur d'accent utilisee pour le glow / theme 3D de la fiche",
  "// demo      : true => chapitres reellement copies et lisibles dans cette version",
  "window.SERIES = ["
].join("\n");

const q = s => JSON.stringify(String(s));

function serializeValue(v) {
  if (Array.isArray(v)) return "[" + v.map(serializeValue).join(", ") + "]";
  if (v && typeof v === "object")
    return "{ " + Object.keys(v).map(k => k + ": " + serializeValue(v[k])).join(", ") + " }";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return q(v);
}

function serializeEntry(e) {
  const keys = KEY_ORDER.filter(k => e[k] !== undefined)
    .concat(Object.keys(e).filter(k => !KEY_ORDER.includes(k)));
  const chunks = keys.map(k => {
    const v = e[k];
    if (k === "description") return "    description:\n      " + q(v);
    if (k === "partners" && Array.isArray(v) && v.length)
      return "    // Équipes partenaires (hors LanorTrad) qui collaborent sur cette série\n" +
        "    partners: [\n" +
        v.map(p => "      { name: " + q(p.name) + ", url: " + q(p.url) + ", color: " + q(p.color) + " }").join(",\n") +
        "\n    ]";
    return "    " + k + ": " + serializeValue(v);
  });
  return "  {\n" + chunks.join(",\n") + "\n  }";
}

function renderFile(list) {
  let body = "", sawOneshot = false;
  list.forEach((e, i) => {
    if (!sawOneshot && e.type === "oneshot") { sawOneshot = true; body += "  // === ONESHOTS ===\n"; }
    body += serializeEntry(e) + (i < list.length - 1 ? ",\n" : "\n");
  });
  return HEADER + "\n" + body + "];\n";
}

function backup() {
  if (!fs.existsSync(SERIES_FILE)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  let dst = path.join(BACKUP_DIR, "series-" + stamp + ".js");
  for (let n = 2; fs.existsSync(dst); n++)                 // 2 écritures dans la même seconde
    dst = path.join(BACKUP_DIR, "series-" + stamp + "-" + n + ".js");
  fs.copyFileSync(SERIES_FILE, dst);
  const olds = fs.readdirSync(BACKUP_DIR).filter(f => /^series-.*\.js$/.test(f)).sort();
  while (olds.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, olds.shift()));
  return path.basename(dst);
}

/* Écrit après relecture-vérification : si le fichier produit n'est pas
   relisible, on restaure immédiatement l'ancien. */
function saveSeries(list) {
  const before = fs.existsSync(SERIES_FILE) ? fs.readFileSync(SERIES_FILE, "utf8") : "";
  const bak = backup();
  fs.writeFileSync(SERIES_FILE, renderFile(list), "utf8");
  try {
    const check = loadSeries();
    if (check.length !== list.length) throw new Error("relecture incohérente");
  } catch (e) {
    if (before) fs.writeFileSync(SERIES_FILE, before, "utf8");
    throw new Error("Écriture annulée (fichier restauré) : " + (e.message || e));
  }
  return bak;
}

/* --------------------------- petits helpers ---------------------------- */
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
const idxOf = (list, id) => list.findIndex(s => s.id === id);

/* ------------------------------ routes --------------------------------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const p = u.pathname;

    if (p === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE);
    }

    // État complet : fiches + aides à la saisie
    if (p === "/api/state" && req.method === "GET") {
      const series = loadSeries();
      const genres = [...new Set(series.flatMap(s => s.genres || []))]
        .sort((a, b) => a.localeCompare(b, "fr"));
      const statuses = [...new Set(series.map(s => s.status).filter(Boolean))];
      return sendJSON(res, 200, {
        series, genres, statuses,
        covers: coverFiles(), folders: mangaFolders(), stats: chapterStats()
      });
    }

    // Crée ou met à jour une fiche. originalId vide/absent => création.
    if (p === "/api/save" && req.method === "POST") {
      const { originalId, entry } = JSON.parse((await readBody(req)).toString() || "{}");
      const list = loadSeries();
      const orig = str(originalId);
      const at = orig ? idxOf(list, orig) : -1;
      if (orig && at < 0) return sendJSON(res, 404, { error: "Fiche introuvable : " + orig });

      let norm;
      try { norm = normalize(entry || {}, at >= 0 ? list[at] : null); }
      catch (err) { return sendJSON(res, 400, { error: err.message || String(err) }); }
      const clash = idxOf(list, norm.id);
      if (clash >= 0 && clash !== at)
        return sendJSON(res, 409, { error: "Une fiche utilise déjà l'identifiant « " + norm.id + " »." });

      if (at >= 0) {
        list[at] = norm;
      } else if (norm.type === "oneshot") {
        list.push(norm);                                   // oneshots en fin de liste
      } else {
        const firstOne = list.findIndex(s => s.type === "oneshot");
        firstOne < 0 ? list.push(norm) : list.splice(firstOne, 0, norm);
      }
      const bak = saveSeries(list);
      return sendJSON(res, 200, { ok: true, id: norm.id, created: at < 0, backup: bak, count: list.length });
    }

    // Supprime une fiche (ne touche pas aux images ni aux dossiers /Manga)
    if (p === "/api/delete" && req.method === "POST") {
      const { id } = JSON.parse((await readBody(req)).toString() || "{}");
      const list = loadSeries();
      const at = idxOf(list, str(id));
      if (at < 0) return sendJSON(res, 404, { error: "Fiche introuvable." });
      list.splice(at, 1);
      const bak = saveSeries(list);
      return sendJSON(res, 200, { ok: true, backup: bak, count: list.length });
    }

    // Réordonne (l'ordre du fichier = ordre d'affichage au catalogue)
    if (p === "/api/move" && req.method === "POST") {
      const { id, dir } = JSON.parse((await readBody(req)).toString() || "{}");
      const list = loadSeries();
      const at = idxOf(list, str(id));
      const to = at + (dir === "up" ? -1 : 1);
      if (at < 0) return sendJSON(res, 404, { error: "Fiche introuvable." });
      if (to < 0 || to >= list.length) return sendJSON(res, 200, { ok: true, moved: false });
      list.splice(to, 0, list.splice(at, 1)[0]);
      const bak = saveSeries(list);
      return sendJSON(res, 200, { ok: true, moved: true, backup: bak });
    }

    // Aperçu d'une couverture (images/Cover/… uniquement)
    if (p === "/api/cover" && req.method === "GET") {
      const rel = String(u.searchParams.get("file") || "").replace(/\\/g, "/");
      const abs = path.resolve(ROOT, rel);
      if (!abs.startsWith(path.resolve(ROOT) + path.sep) || !isImg(abs) || !fs.existsSync(abs)) {
        res.writeHead(404); return res.end();
      }
      const types = { ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
        ".png": "image/png", ".avif": "image/avif", ".gif": "image/gif" };
      res.writeHead(200, { "Content-Type": types[path.extname(abs).toLowerCase()] || "application/octet-stream",
        "Cache-Control": "no-store" });
      return fs.createReadStream(abs).on("error", () => res.end()).pipe(res);
    }

    res.writeHead(404); res.end("Not found");
  } catch (e) {
    sendJSON(res, 500, { error: String(e && e.message || e) });
  }
});

try { loadSeries(); }
catch (e) {
  console.error("\n  ❌ Impossible de lire js/data/series.js :\n     " + (e.message || e) + "\n");
  process.exit(1);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n  LanorTrad — Fiches séries / oneshots");
  console.log("  ▶  Ouvre dans ton navigateur :  http://localhost:" + PORT + "\n");
  console.log("  (Laisse cette fenêtre ouverte. Ferme-la pour arrêter.)\n");
});

/* ------------------------ interface web (HTML) ------------------------ */
const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LanorTrad — Fiches séries</title>
<style>
  :root{--vio:#a855f7;--grad:linear-gradient(135deg,#6366f1,#a855f7 55%,#d946ef)}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b0b16;color:#eef;
    min-height:100vh;display:flex;justify-content:center;padding:32px 16px}
  .card{width:100%;max-width:860px}
  h1{font-size:1.6rem;margin:0 0 4px}.sub{color:#9a98c0;margin:0 0 24px;font-size:.92rem}
  label{display:block;font-size:.82rem;font-weight:600;color:#bdbce0;margin:16px 0 6px}
  input,select,textarea{width:100%;padding:12px 14px;border-radius:11px;border:1px solid #2a2a44;
    background:#11111f;color:#eef;font:inherit}
  textarea{min-height:120px;resize:vertical;line-height:1.5}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--vio);box-shadow:0 0 0 3px rgba(168,85,247,.2)}
  input[type=color]{padding:4px;height:46px;cursor:pointer}
  .row{display:grid;gap:14px}
  .row.c2{grid-template-columns:1fr 1fr}.row.c3{grid-template-columns:1fr 1fr 1fr}
  @media(max-width:640px){.row.c2,.row.c3{grid-template-columns:1fr}}
  button.go{margin-top:22px;width:100%;padding:14px;border:none;border-radius:12px;cursor:pointer;
    background:var(--grad);color:#fff;font-weight:700;font-size:1rem}
  button.go:disabled{opacity:.5;cursor:not-allowed}
  .btn{padding:8px 12px;border-radius:9px;border:1px solid #2a2a44;background:#181830;color:#eef;
    cursor:pointer;font:inherit;font-size:.82rem}
  .btn:hover{border-color:var(--vio)}
  .btn.red{border-color:#7f1d1d;color:#fca5a5}.btn.red:hover{background:rgba(127,29,29,.25)}
  .btn.tiny{padding:5px 9px;font-size:.76rem}
  #log{margin-top:18px;font-size:.85rem;white-space:pre-wrap;color:#bdbce0;
    background:#0e0e1c;border:1px solid #2a2a44;border-radius:11px;padding:12px;min-height:20px;display:none}
  .ok{color:#6ee7b7}.err{color:#fca5a5}.warn{color:#fcd34d}
  .srow{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid #2a2a44;
    border-radius:11px;background:#0e0e1c;margin-top:8px}
  .srow img{width:34px;height:48px;object-fit:cover;border-radius:6px;background:#181830;flex:none}
  .srow .nm{flex:1;min-width:0}
  .srow .nm b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .srow .nm small{color:#9a98c0;font-size:.76rem}
  .dotc{width:10px;height:10px;border-radius:50%;flex:none}
  .chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:6px}
  .chip{display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;
    background:#181830;border:1px solid #2a2a44;font-size:.8rem}
  .chip button{border:none;background:none;color:#fca5a5;cursor:pointer;font-size:.85rem;padding:0;line-height:1}
  .chip.add{cursor:pointer;color:#bdbce0}.chip.add:hover{border-color:var(--vio);color:#eef}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
  .chk{display:flex;align-items:center;gap:10px;margin-top:16px;font-size:.9rem;color:#bdbce0;cursor:pointer}
  .chk input{width:18px;height:18px;accent-color:var(--vio);cursor:pointer;flex:none}
  .hint{color:#9a98c0;font-size:.78rem;margin:6px 0 0}
  .prev{display:flex;gap:14px;margin-top:14px;padding:14px;border-radius:14px;
    border:1px solid #2a2a44;background:#0e0e1c}
  .prev img{width:78px;height:110px;object-fit:cover;border-radius:9px;background:#181830;flex:none}
  .prev .pv{min-width:0}
  .prev .pv .eb{font-size:.74rem;color:#9a98c0;text-transform:uppercase;letter-spacing:.08em}
  .prev .pv h3{margin:3px 0 5px;font-size:1.1rem}
  .prev .pv p{margin:7px 0 0;font-size:.82rem;color:#bdbce0;line-height:1.45;
    display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
  .prow{display:grid;grid-template-columns:1fr 1.4fr 62px 34px;gap:8px;margin-top:8px;align-items:center}
  @media(max-width:640px){.prow{grid-template-columns:1fr 1fr}}
  h2.small{font-size:1.05rem;margin:24px 0 0}
  .sep{height:1px;background:#2a2a44;margin:26px 0 0}
</style></head><body><div class="card">
  <h1>🗂️ LanorTrad — Fiches séries &amp; oneshots</h1>
  <p class="sub">Modifie les infos affichées sur le site (description, genres, auteur,
    artiste, année, note, couverture…). Écrit directement <code>js/data/series.js</code>,
    avec sauvegarde automatique avant chaque écriture.</p>

  <div id="view-list">
    <div class="toolbar" style="margin-top:0">
      <button class="btn" id="new">➕ Nouvelle fiche</button>
      <button class="btn" id="reload">🔄 Recharger</button>
    </div>
    <div id="list"></div>
  </div>

  <div id="view-edit" style="display:none">
    <div class="toolbar" style="margin-top:0">
      <button class="btn" id="back">← Retour à la liste</button>
      <button class="btn red" id="del">🗑️ Supprimer la fiche</button>
    </div>
    <h2 class="small" id="ed-title"></h2>

    <div class="prev" id="prev">
      <img id="pv-img" alt="">
      <div class="pv">
        <span class="eb" id="pv-eb"></span>
        <h3 id="pv-title"></h3>
        <div class="chips" id="pv-genres"></div>
        <p id="pv-desc"></p>
      </div>
    </div>

    <div class="row c2">
      <div>
        <label>Identifiant (dossier dans /Manga)</label>
        <input id="f-id" list="folderlist" autocomplete="off" placeholder="ex : Tougen Anki">
        <p class="hint" id="f-id-hint"></p>
      </div>
      <div>
        <label>Titre affiché</label>
        <input id="f-title" autocomplete="off">
      </div>
    </div>

    <div class="row c3">
      <div>
        <label>Type</label>
        <select id="f-type"><option value="manga">Série (manga)</option><option value="oneshot">Oneshot</option></select>
      </div>
      <div>
        <label>Statut</label>
        <input id="f-status" list="statuslist" autocomplete="off" placeholder="En cours">
      </div>
      <div>
        <label>Note /5</label>
        <input id="f-rating" type="number" min="0" max="5" step="0.1">
      </div>
    </div>

    <div class="row c3">
      <div>
        <label>Nombre de chapitres</label>
        <input id="f-chapters" type="number" min="0" step="1">
        <p class="hint"><a href="#" id="auto-ch" style="color:var(--vio)"></a></p>
      </div>
      <div>
        <label>Dernière mise à jour</label>
        <input id="f-last" type="date">
        <p class="hint"><a href="#" id="auto-last" style="color:var(--vio)"></a></p>
      </div>
      <div>
        <label>Année de parution</label>
        <input id="f-year" type="number" min="1900" max="2999" step="1" placeholder="ex : 2020">
      </div>
    </div>

    <div class="row c2">
      <div>
        <label>Auteur (scénario / œuvre originale)</label>
        <input id="f-author" autocomplete="off" placeholder="ex : Yura Urushibara">
      </div>
      <div>
        <label>Artiste (dessin) — si différent</label>
        <input id="f-artist" autocomplete="off" placeholder="laisse vide si c'est la même personne">
      </div>
    </div>

    <label>Genres</label>
    <div class="chips" id="g-chips"></div>
    <input id="f-genre-add" placeholder="Tape un genre puis Entrée (ou colle : Action, Drame…)" autocomplete="off">
    <p class="hint">Genres déjà utilisés sur le site — clique pour ajouter :</p>
    <div class="chips" id="g-known"></div>

    <label>Description (visible sur la fiche et dans les partages)</label>
    <textarea id="f-desc" placeholder="Le pitch, avec ta voix : tutoiement, ton de la team…"></textarea>

    <div class="row c2">
      <div>
        <label>Couverture</label>
        <input id="f-cover" list="coverlist" autocomplete="off" placeholder="images/Cover/MonManga.jpg">
        <p class="hint">Dépose ton image dans <code>images/Cover/</code> puis choisis-la ici.</p>
      </div>
      <div>
        <label>Couleur d'accent (ambiance de la fiche)</label>
        <div style="display:flex;gap:10px">
          <input id="f-accent" type="color" style="width:70px">
          <input id="f-accent-hex" autocomplete="off" placeholder="#a855f7">
        </div>
      </div>
    </div>

    <h2 class="small">Équipes partenaires (collaborations)</h2>
    <p class="hint">Laisse vide si LanorTrad traduit seul.</p>
    <div id="p-rows"></div>
    <button class="btn tiny" id="p-add" style="margin-top:10px">➕ Ajouter un partenaire</button>

    <div class="sep"></div>
    <label class="chk"><input type="checkbox" id="f-featured"> ⭐ Mise en avant (héros / sélections de l'accueil)</label>
    <label class="chk"><input type="checkbox" id="f-demo"> 📖 Chapitres réellement disponibles (demo)</label>

    <button class="go" id="save">💾 Enregistrer la fiche</button>
  </div>

  <datalist id="coverlist"></datalist>
  <datalist id="folderlist"></datalist>
  <datalist id="statuslist"></datalist>
  <div id="log"></div>
</div>
<script>
const $=s=>document.querySelector(s);
let state={series:[],genres:[],statuses:[],covers:[],folders:[],stats:{}};
let cur=null;          // fiche en cours d'édition (objet du serveur) ou null
let curId=null;        // id d'origine ("" => création)
let genres=[], partners=[];

const elLog=$("#log");
function log(msg,cls){ elLog.style.display="block";
  elLog.innerHTML+=(cls?'<span class="'+cls+'">':'<span>')+msg+"</span>\\n"; }
function logReset(){ elLog.innerHTML=""; elLog.style.display="none"; }
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const postJSON=(url,body)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body)});
const coverURL=f=>f?("/api/cover?file="+encodeURIComponent(f)):"";

/* ------------------------------- liste ------------------------------- */
async function loadState(keepEditor){
  const r=await fetch("/api/state"); const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  state=j;
  $("#coverlist").innerHTML=state.covers.map(c=>'<option value="'+esc(c)+'">').join("");
  $("#folderlist").innerHTML=state.folders.map(c=>'<option value="'+esc(c)+'">').join("");
  const st=[...new Set(state.statuses.concat(["En cours","Terminé","En pause","Abandonné","Bientôt"]))];
  $("#statuslist").innerHTML=st.map(c=>'<option value="'+esc(c)+'">').join("");
  renderList();
  if(!keepEditor) showList();
}
function renderList(){
  const box=$("#list"); box.innerHTML="";
  state.series.forEach((s,i)=>{
    const d=document.createElement("div"); d.className="srow";
    const dot=document.createElement("span"); dot.className="dotc"; dot.style.background=s.accent||"#666";
    const img=document.createElement("img"); img.src=coverURL(s.cover); img.alt="";
    const nm=document.createElement("div"); nm.className="nm";
    const st=state.stats[s.id]||{};
    const warn=st.folder?"":" ⚠️ pas de dossier /Manga";
    nm.innerHTML="<b>"+esc(s.title||s.id)+"</b><small>"+esc((s.type==="oneshot"?"Oneshot":"Série")
      +" · "+(s.status||"—")+" · "+(s.chapters||0)+" ch."+(s.featured?" · ⭐":"")+warn)+"</small>";
    const up=document.createElement("button"); up.className="btn tiny"; up.textContent="↑"; up.title="Monter";
    up.addEventListener("click",()=>move(s.id,"up")); up.disabled=(i===0);
    const dn=document.createElement("button"); dn.className="btn tiny"; dn.textContent="↓"; dn.title="Descendre";
    dn.addEventListener("click",()=>move(s.id,"down")); dn.disabled=(i===state.series.length-1);
    const ed=document.createElement("button"); ed.className="btn"; ed.textContent="✏️ Modifier";
    ed.addEventListener("click",()=>openEditor(s));
    d.append(dot,img,nm,up,dn,ed); box.appendChild(d);
  });
}
async function move(id,dir){
  logReset();
  const r=await postJSON("/api/move",{id,dir}); const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  await loadState(true);
}
function showList(){ $("#view-list").style.display=""; $("#view-edit").style.display="none"; cur=null; }
function showEdit(){ $("#view-list").style.display="none"; $("#view-edit").style.display=""; window.scrollTo(0,0); }
$("#back").addEventListener("click",()=>{ logReset(); showList(); });
$("#reload").addEventListener("click",()=>{ logReset(); loadState(); });
$("#new").addEventListener("click",()=>openEditor(null));

/* ------------------------------ éditeur ------------------------------ */
function openEditor(s){
  logReset();
  cur=s; curId=s?s.id:"";
  const v={id:"",title:"",type:"manga",status:"En cours",chapters:0,lastUpdate:"",rating:4.5,
    author:"",artist:"",year:"",accent:"#a855f7",description:"",cover:"",demo:false,featured:false,
    genres:[],partners:[]};
  const d=Object.assign(v,s||{});
  $("#ed-title").textContent = s ? ("Modifier « "+(s.title||s.id)+" »") : "Nouvelle fiche";
  $("#f-id").value=d.id; $("#f-title").value=d.title; $("#f-type").value=d.type;
  $("#f-status").value=d.status; $("#f-rating").value=d.rating; $("#f-chapters").value=d.chapters;
  $("#f-last").value=d.lastUpdate||""; $("#f-year").value=d.year||"";
  $("#f-author").value=(d.author==="—"?"":d.author); $("#f-artist").value=d.artist||"";
  $("#f-desc").value=d.description; $("#f-cover").value=d.cover;
  $("#f-accent").value=/^#[0-9a-fA-F]{6}$/.test(d.accent)?d.accent:"#a855f7";
  $("#f-accent-hex").value=$("#f-accent").value;
  $("#f-demo").checked=!!d.demo; $("#f-featured").checked=!!d.featured;
  genres=(d.genres||[]).slice(); partners=(d.partners||[]).map(p=>Object.assign({},p));
  renderGenres(); renderKnownGenres(); renderPartners(); idHint(); autoHints(); preview();
  showEdit();
}

/* genres */
function renderGenres(){
  const box=$("#g-chips"); box.innerHTML="";
  genres.forEach((g,i)=>{
    const c=document.createElement("span"); c.className="chip"; c.textContent=g;
    const x=document.createElement("button"); x.textContent="✕"; x.title="Retirer";
    x.addEventListener("click",()=>{ genres.splice(i,1); renderGenres(); renderKnownGenres(); preview(); });
    c.appendChild(x); box.appendChild(c);
  });
  if(!genres.length) box.innerHTML='<span class="hint">Aucun genre pour l\\'instant.</span>';
}
function renderKnownGenres(){
  const box=$("#g-known"); box.innerHTML="";
  state.genres.filter(g=>!genres.includes(g)).forEach(g=>{
    const c=document.createElement("span"); c.className="chip add"; c.textContent="+ "+g;
    c.addEventListener("click",()=>{ genres.push(g); renderGenres(); renderKnownGenres(); preview(); });
    box.appendChild(c);
  });
}
function addGenres(txt){
  txt.split(",").map(s=>s.trim()).filter(Boolean).forEach(g=>{ if(!genres.includes(g)) genres.push(g); });
  renderGenres(); renderKnownGenres(); preview();
}
$("#f-genre-add").addEventListener("keydown",e=>{
  if(e.key==="Enter"||e.key===","){ e.preventDefault(); addGenres(e.target.value); e.target.value=""; }
});
$("#f-genre-add").addEventListener("blur",e=>{ if(e.target.value.trim()){ addGenres(e.target.value); e.target.value=""; } });

/* partenaires */
function renderPartners(){
  const box=$("#p-rows"); box.innerHTML="";
  partners.forEach((p,i)=>{
    const row=document.createElement("div"); row.className="prow";
    const n=document.createElement("input"); n.placeholder="Nom de l'équipe"; n.value=p.name||"";
    n.addEventListener("input",()=>p.name=n.value);
    const u=document.createElement("input"); u.placeholder="https://x.com/…"; u.value=p.url||"";
    u.addEventListener("input",()=>p.url=u.value);
    const c=document.createElement("input"); c.type="color"; c.value=/^#[0-9a-fA-F]{6}$/.test(p.color||"")?p.color:"#a855f7";
    c.addEventListener("input",()=>p.color=c.value);
    const x=document.createElement("button"); x.className="btn red tiny"; x.textContent="✕";
    x.addEventListener("click",()=>{ partners.splice(i,1); renderPartners(); });
    row.append(n,u,c,x); box.appendChild(row);
  });
}
$("#p-add").addEventListener("click",()=>{ partners.push({name:"",url:"",color:"#a855f7"}); renderPartners(); });

/* aides : dossier /Manga, chapitres, date */
function idHint(){
  const id=$("#f-id").value.trim(), h=$("#f-id-hint");
  if(!id){ h.textContent=""; return; }
  if(state.folders.includes(id)){
    const st=state.stats[id]||{};
    h.innerHTML='<span class="ok">✓ dossier /Manga trouvé'+(st.count?(" — "+st.count+" chapitre(s) scanné(s)"):"")+'</span>';
  } else {
    h.innerHTML='<span class="warn">⚠️ aucun dossier /Manga à ce nom : la fiche s\\'affichera, mais sans chapitre lisible.</span>';
  }
}
function autoHints(){
  const id=$("#f-id").value.trim(), st=state.stats[id]||{};
  const a=$("#auto-ch"), b=$("#auto-last");
  a.textContent = st.count ? ("Utiliser le nombre scanné : "+st.count) : "";
  b.textContent = st.last ? ("Utiliser la date des fichiers : "+st.last) : "";
  a.dataset.v=st.count||""; b.dataset.v=st.last||"";
}
$("#auto-ch").addEventListener("click",e=>{ e.preventDefault();
  if(e.target.dataset.v){ $("#f-chapters").value=e.target.dataset.v; } });
$("#auto-last").addEventListener("click",e=>{ e.preventDefault();
  if(e.target.dataset.v){ $("#f-last").value=e.target.dataset.v; } });
$("#f-id").addEventListener("input",()=>{ idHint(); autoHints(); preview(); });

/* aperçu + couleur */
$("#f-accent").addEventListener("input",()=>{ $("#f-accent-hex").value=$("#f-accent").value; preview(); });
$("#f-accent-hex").addEventListener("input",()=>{
  const v=$("#f-accent-hex").value.trim();
  if(/^#[0-9a-fA-F]{6}$/.test(v)) $("#f-accent").value=v.toLowerCase();
  preview();
});
["f-title","f-desc","f-cover","f-status","f-type","f-year","f-author","f-artist"].forEach(id=>
  $("#"+id).addEventListener("input",preview));
function preview(){
  const type=$("#f-type").value==="oneshot"?"Oneshot":"Série";
  const year=$("#f-year").value.trim();
  const art=$("#f-artist").value.trim(), aut=$("#f-author").value.trim();
  $("#pv-eb").textContent=type+" · "+($("#f-status").value.trim()||"—")+(year?(" · "+year):"");
  $("#pv-title").textContent=$("#f-title").value.trim()||$("#f-id").value.trim()||"Sans titre";
  $("#pv-title").style.color=$("#f-accent").value;
  $("#pv-genres").innerHTML=genres.map(g=>'<span class="chip">'+esc(g)+"</span>").join("")
    +(aut?'<span class="chip">✍️ '+esc(aut)+"</span>":"")+(art?'<span class="chip">🎨 '+esc(art)+"</span>":"");
  $("#pv-desc").textContent=$("#f-desc").value.trim();
  const c=$("#f-cover").value.trim();
  $("#pv-img").src=c?coverURL(c)+"&v="+Date.now():"";
  $("#prev").style.boxShadow="inset 0 0 0 1px "+$("#f-accent").value+"55";
}

/* enregistrement */
$("#save").addEventListener("click",async()=>{
  logReset();
  const entry={
    id:$("#f-id").value.trim(), title:$("#f-title").value.trim(), type:$("#f-type").value,
    genres, status:$("#f-status").value.trim(), chapters:$("#f-chapters").value,
    lastUpdate:$("#f-last").value, rating:$("#f-rating").value,
    author:$("#f-author").value.trim(), artist:$("#f-artist").value.trim(),
    year:$("#f-year").value.trim(), accent:($("#f-accent-hex").value.trim()||$("#f-accent").value).toLowerCase(),
    partners:partners.filter(p=>(p.name||"").trim()), description:$("#f-desc").value.trim(),
    cover:$("#f-cover").value.trim(), demo:$("#f-demo").checked, featured:$("#f-featured").checked
  };
  if(cur&&cur.url&&cur.id===entry.id) entry.url=cur.url;   // garde une URL personnalisée
  $("#save").disabled=true;
  try{
    const r=await postJSON("/api/save",{originalId:curId,entry});
    const j=await r.json();
    if(!r.ok) throw new Error(j.error||"Erreur");
    log((j.created?"✅ Fiche créée":"✅ Fiche enregistrée")+" — "+j.count+" fiches dans js/data/series.js.","ok");
    log("Sauvegarde de l'ancienne version : tools/.backups/"+j.backup);
    log("Recharge ton site en local pour voir le résultat. Pour le mettre en ligne : git push / Netlify.","ok");
    curId=j.id;
    await loadState(true);
    cur=state.series.find(x=>x.id===j.id)||null;
    if(cur) $("#ed-title").textContent="Modifier « "+(cur.title||cur.id)+" »";
    renderKnownGenres();
  }catch(e){ log("❌ "+e.message,"err"); }
  finally{ $("#save").disabled=false; }
});

/* suppression */
$("#del").addEventListener("click",async()=>{
  if(!curId){ showList(); return; }
  if(!confirm("Supprimer la fiche « "+curId+" » de series.js ?\\n\\nLes images et les dossiers de /Manga ne sont PAS touchés (seule la fiche disparaît du site).")) return;
  logReset();
  const r=await postJSON("/api/delete",{id:curId}); const j=await r.json();
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return; }
  await loadState();
  log("✅ Fiche supprimée. Sauvegarde : tools/.backups/"+j.backup,"ok");
});

loadState();
</script></body></html>`;
