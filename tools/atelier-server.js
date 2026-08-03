/* =========================================================================
   LanorTrad — Serveur LOCAL de l'atelier (avancement des chapitres).
   Lance :  node tools/atelier-server.js   (ou double-clic sur Modifier-Atelier.bat)
   Puis ouvre : http://localhost:4601

   Les deux autres outils gèrent les IMAGES (upload-server.js) et les INFOS de
   fiche (series-server.js). Celui-ci gère l'ÉTAT D'AVANCEMENT du prochain
   chapitre, celui qu'on voit sur le site entre deux sorties :

     Pages trouvées → Clean → Traduction → Edit → Q-check → Sortie

   Ce qu'il fait :
   1. Lit js/data/series.js (les séries) et js/data/atelier.js (l'avancement).
   2. Un clic sur une étape = c'est enregistré, la date du jour est posée.
   3. Il réécrit js/data/atelier.js proprement, après avoir mis une copie de
      sécurité dans tools/.backups/.

   Bonus :
   - le numéro du prochain chapitre est pré-rempli d'après js/data/chapters.js ;
   - « Étape suivante » fait avancer d'un cran sans rien retaper ;
   - une série passée en « Sortie » est signalée : elle disparaîtra toute seule
     du site 3 jours plus tard.

   ⚠️  Outil LOCAL uniquement (écoute sur 127.0.0.1). N'expose rien sur Internet.
       Après modification, pense à mettre ton site en ligne (git push / Netlify).
   ========================================================================= */
"use strict";
const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT          = path.join(__dirname, "..");
const SERIES_FILE   = path.join(ROOT, "js", "data", "series.js");
const ATELIER_FILE  = path.join(ROOT, "js", "data", "atelier.js");
const CHAPTERS_FILE = path.join(ROOT, "js", "data", "chapters.js");
const BACKUP_DIR    = path.join(__dirname, ".backups");
const PORT          = Number(process.env.PORT) || 4601;
const IMG_EXT       = [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"];
const MAX_BACKUPS   = 30;

/* Doit rester synchronisé avec STEPS dans js/atelier.js. */
const STEPS = [
  { id: "pages",  label: "Pages trouvées", ico: "📥" },
  { id: "clean",  label: "Clean",          ico: "🧽" },
  { id: "trad",   label: "Traduction",     ico: "💬" },
  { id: "edit",   label: "Edit",           ico: "✍️" },
  { id: "qcheck", label: "Q-check",        ico: "🔍" },
  { id: "sortie", label: "Sortie",         ico: "🎉" }
];
const STEP_IDS = STEPS.map(s => s.id);

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

function loadAtelier() {
  if (!fs.existsSync(ATELIER_FILE)) return {};
  const map = loadWindowVar(ATELIER_FILE, "ATELIER");
  if (map === null) return {};
  if (typeof map !== "object" || Array.isArray(map))
    throw new Error("js/data/atelier.js ne définit pas window.ATELIER (objet).");
  return map;
}

/* Dernier chapitre publié par série (pour proposer le suivant). */
function lastChapters() {
  const out = {};
  let manifest = null;
  try { manifest = loadWindowVar(CHAPTERS_FILE, "CHAPTERS"); } catch { manifest = null; }
  if (!manifest) return out;
  for (const id of Object.keys(manifest)) {
    const nums = (manifest[id] || []).map(c => parseFloat(c.num)).filter(n => !isNaN(n));
    if (nums.length) out[id] = Math.max.apply(null, nums);
  }
  return out;
}

/* -------------------- validation / normalisation ------------------------ */

const str = v => (v === undefined || v === null) ? "" : String(v).trim();
const today = () => new Date().toISOString().slice(0, 10);
const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());

function normalize(raw, previous) {
  const e = {};

  // Chapitre : chiffres, points, tirets, virgules — « 250 », « 45-46 », « 12.5 »
  const chapter = str(raw.chapter).replace(/\s+/g, "");
  if (!chapter) throw new Error("Le numéro de chapitre est obligatoire.");
  if (!/^[0-9]+(\.[0-9]+)?([-–,][0-9]+(\.[0-9]+)?)*$/.test(chapter))
    throw new Error("Numéro de chapitre invalide : « " + chapter + " » (attendu : 250, 45-46, 12.5…).");
  e.chapter = chapter;

  const step = str(raw.step).toLowerCase();
  if (STEP_IDS.indexOf(step) < 0)
    throw new Error("Étape inconnue : « " + step + " » (attendu : " + STEP_IDS.join(", ") + ").");
  e.step = step;

  // La date du dernier point d'étape se remet à aujourd'hui dès que l'étape
  // change : c'est elle qui alimente « dernier point d'étape il y a 2 j ».
  let updated = str(raw.updated);
  if (updated && !isDate(updated)) throw new Error("Date de mise à jour invalide (attendu AAAA-MM-JJ).");
  if (!updated || (previous && previous.step !== step && !raw.keepDate)) updated = today();
  e.updated = updated;

  const eta = str(raw.eta);
  if (eta) {
    if (!isDate(eta)) throw new Error("Date de sortie visée invalide (attendu AAAA-MM-JJ).");
    e.eta = eta;
  }

  const note = str(raw.note).replace(/\s+/g, " ");
  if (note.length > 240) throw new Error("La note est trop longue (240 caractères maximum).");
  if (note) e.note = note;

  return e;
}

/* ------------------------ écriture de atelier.js ------------------------ */

const HEADER = [
  "// === LanorTrad - L'atelier : ou en est le prochain chapitre ? ===",
  "// Une entree par serie EN COURS dont le prochain chapitre est en fabrication.",
  "// C'est ce fichier (et lui seul) qui fait avancer la jauge sur le site.",
  "// Editez-le a la main OU via l'outil local :",
  "//   node tools/atelier-server.js   (ou tools/Modifier-Atelier.bat)",
  "//",
  "//   cle      : id de la serie, EXACTEMENT comme dans series.js",
  "//   chapter  : numero(s) du chapitre en cours de fabrication, ex \"250\" ou \"45-46\"",
  "//   step     : etape actuelle -- id ou numero (1 a 6) :",
  "//                1 \"pages\"   Pages trouvees   (raws recuperees / telechargees)",
  "//                2 \"clean\"   Clean            (textes effaces, redraw)",
  "//                3 \"trad\"    Traduction       (japonais -> francais)",
  "//                4 \"edit\"    Edit             (textes places dans les bulles)",
  "//                5 \"qcheck\"  Q-check          (relecture finale)",
  "//                6 \"sortie\"  Sortie           (en ligne)",
  "//   updated  : \"AAAA-MM-JJ\" -- date du dernier changement d'etape",
  "//   eta      : (optionnel) \"AAAA-MM-JJ\" date de sortie visee",
  "//   note     : (optionnel) une phrase pour expliquer un retard, une galere...",
  "//",
  "// Une entree calee sur \"sortie\" disparait toute seule 3 jours apres `updated`",
  "// (le temps que tout le monde voie que c'est publie), inutile de la supprimer",
  "// a la main. Une serie sans entree ici n'affiche simplement rien.",
  "window.ATELIER = {"
].join("\n");

const q = s => JSON.stringify(String(s));
const pad = (s, n) => s + " ".repeat(Math.max(0, n - s.length));

/* Rend le fichier lisible « comme écrit à la main » : colonnes alignées, et
   l'ordre des séries de series.js (pas l'ordre d'édition). */
function renderFile(map, order) {
  const ids = order.filter(id => map[id]).concat(Object.keys(map).filter(id => order.indexOf(id) < 0));
  if (!ids.length) return HEADER + "\n};\n";

  const wKey  = Math.max.apply(null, ids.map(id => q(id).length + 1));           // + ":"
  const wChap = Math.max.apply(null, ids.map(id => q(map[id].chapter).length + 1)); // + ","
  const wStep = Math.max.apply(null, ids.map(id => q(map[id].step).length + 1));

  const lines = ids.map(id => {
    const e = map[id];
    let s = "  " + pad(q(id) + ":", wKey) + " { " +
      "chapter: " + pad(q(e.chapter) + ",", wChap) + " " +
      "step: " + pad(q(e.step) + ",", wStep) + " " +
      "updated: " + q(e.updated);
    if (e.eta) s += ", eta: " + q(e.eta);
    if (e.note) s += ",\n" + " ".repeat(wKey + 5) + "note: " + q(e.note);
    return s + " }";
  });
  return HEADER + "\n" + lines.join(",\n") + "\n};\n";
}

function backup() {
  if (!fs.existsSync(ATELIER_FILE)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  let dst = path.join(BACKUP_DIR, "atelier-" + stamp + ".js");
  for (let n = 2; fs.existsSync(dst); n++)                 // 2 écritures dans la même seconde
    dst = path.join(BACKUP_DIR, "atelier-" + stamp + "-" + n + ".js");
  fs.copyFileSync(ATELIER_FILE, dst);
  const olds = fs.readdirSync(BACKUP_DIR).filter(f => /^atelier-.*\.js$/.test(f)).sort();
  while (olds.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, olds.shift()));
  return path.basename(dst);
}

/* Écrit après relecture-vérification : si le fichier produit n'est pas
   relisible, on restaure immédiatement l'ancien. */
function saveAtelier(map, order) {
  const before = fs.existsSync(ATELIER_FILE) ? fs.readFileSync(ATELIER_FILE, "utf8") : "";
  const bak = backup();
  fs.writeFileSync(ATELIER_FILE, renderFile(map, order), "utf8");
  try {
    const check = loadAtelier();
    if (Object.keys(check).length !== Object.keys(map).length) throw new Error("relecture incohérente");
  } catch (e) {
    if (before) fs.writeFileSync(ATELIER_FILE, before, "utf8");
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
const isImg = f => IMG_EXT.indexOf(path.extname(f).toLowerCase()) >= 0;

/* État envoyé à la page : une ligne par série, avec ou sans fabrication. */
function buildState() {
  const series = loadSeries();
  const map = loadAtelier();
  const last = lastChapters();
  const order = series.map(s => s.id);
  const orphans = Object.keys(map).filter(id => order.indexOf(id) < 0);

  return {
    steps: STEPS,
    today: today(),
    orphans,                                   // entrées dont la série n'existe plus
    rows: series.map(s => ({
      id: s.id, title: s.title || s.id, cover: s.cover || "",
      accent: s.accent || "#a855f7", status: s.status || "", type: s.type || "manga",
      ongoing: /cours/i.test(s.status || ""),
      suggest: String(last[s.id] != null ? +(last[s.id] + 1).toFixed(2) : (s.chapters || 0) + 1),
      entry: map[s.id] || null
    }))
  };
}

/* ------------------------------ routes --------------------------------- */
const server = http.createServer(async (req, res) => {
  try {
    const u = new URL(req.url, "http://localhost");
    const p = u.pathname;

    if (p === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE);
    }

    if (p === "/api/state" && req.method === "GET") return sendJSON(res, 200, buildState());

    // Met une série à l'atelier / met à jour son entrée.
    if (p === "/api/save" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const id = str(body.id);
      const series = loadSeries();
      const order = series.map(s => s.id);
      if (order.indexOf(id) < 0) return sendJSON(res, 404, { error: "Série inconnue : " + id });

      const map = loadAtelier();
      let norm;
      try { norm = normalize(body.entry || {}, map[id] || null); }
      catch (err) { return sendJSON(res, 400, { error: err.message || String(err) }); }

      map[id] = norm;
      const bak = saveAtelier(map, order);
      return sendJSON(res, 200, { ok: true, entry: norm, backup: bak, state: buildState() });
    }

    // Avance (ou recule) d'un cran, sans rien retaper.
    if (p === "/api/step" && req.method === "POST") {
      const body = JSON.parse((await readBody(req)).toString() || "{}");
      const id = str(body.id);
      const series = loadSeries();
      const order = series.map(s => s.id);
      const map = loadAtelier();
      const prev = map[id];
      if (!prev) return sendJSON(res, 404, { error: "Cette série n'est pas à l'atelier." });

      const at = STEP_IDS.indexOf(prev.step);
      const to = str(body.step) ? STEP_IDS.indexOf(str(body.step)) : at + (body.dir === "back" ? -1 : 1);
      if (to < 0 || to >= STEPS.length) return sendJSON(res, 200, { ok: true, moved: false, state: buildState() });

      let norm;
      try { norm = normalize(Object.assign({}, prev, { step: STEP_IDS[to] }), prev); }
      catch (err) { return sendJSON(res, 400, { error: err.message || String(err) }); }

      map[id] = norm;
      const bak = saveAtelier(map, order);
      return sendJSON(res, 200, { ok: true, moved: true, entry: norm, backup: bak, state: buildState() });
    }

    // Retire une série de l'atelier (ne touche à rien d'autre).
    if (p === "/api/remove" && req.method === "POST") {
      const { id } = JSON.parse((await readBody(req)).toString() || "{}");
      const map = loadAtelier();
      if (!map[str(id)]) return sendJSON(res, 404, { error: "Cette série n'est pas à l'atelier." });
      delete map[str(id)];
      const bak = saveAtelier(map, loadSeries().map(s => s.id));
      return sendJSON(res, 200, { ok: true, backup: bak, state: buildState() });
    }

    // Aperçu d'une couverture (fichiers du site uniquement)
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

try { loadSeries(); loadAtelier(); }
catch (e) {
  console.error("\n  ❌ Impossible de lire les données :\n     " + (e.message || e) + "\n");
  process.exit(1);
}

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n  LanorTrad — L'atelier (avancement des chapitres)");
  console.log("  ▶  Ouvre dans ton navigateur :  http://localhost:" + PORT + "\n");
  console.log("  (Laisse cette fenêtre ouverte. Ferme-la pour arrêter.)\n");
});

/* ------------------------ interface web (HTML) ------------------------ */
const PAGE = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>LanorTrad — L'atelier</title>
<style>
  :root{--vio:#a855f7;--grad:linear-gradient(135deg,#6366f1,#a855f7 55%,#d946ef)}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b0b16;color:#eef;
    min-height:100vh;display:flex;justify-content:center;padding:32px 16px}
  .card{width:100%;max-width:900px}
  h1{font-size:1.6rem;margin:0 0 4px}.sub{color:#9a98c0;margin:0 0 20px;font-size:.92rem}
  code{background:#181830;padding:1px 5px;border-radius:5px;font-size:.9em}
  label{display:block;font-size:.78rem;font-weight:600;color:#bdbce0;margin:0 0 5px}
  input{width:100%;padding:10px 12px;border-radius:10px;border:1px solid #2a2a44;
    background:#11111f;color:#eef;font:inherit;font-size:.9rem}
  input:focus{outline:none;border-color:var(--vio);box-shadow:0 0 0 3px rgba(168,85,247,.2)}
  .btn{padding:8px 12px;border-radius:9px;border:1px solid #2a2a44;background:#181830;color:#eef;
    cursor:pointer;font:inherit;font-size:.82rem}
  .btn:hover{border-color:var(--vio)}
  .btn:disabled{opacity:.45;cursor:not-allowed}
  .btn.red{border-color:#7f1d1d;color:#fca5a5}.btn.red:hover{background:rgba(127,29,29,.25)}
  .btn.go{background:var(--grad);border:none;color:#fff;font-weight:700}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px}
  #log{margin:0 0 16px;font-size:.85rem;white-space:pre-wrap;color:#bdbce0;
    background:#0e0e1c;border:1px solid #2a2a44;border-radius:11px;padding:12px;display:none}
  .ok{color:#6ee7b7}.err{color:#fca5a5}.warn{color:#fcd34d}

  .row{border:1px solid #2a2a44;border-radius:14px;background:#0e0e1c;margin-top:10px;overflow:hidden}
  .row.on{border-color:color-mix(in srgb,var(--ac) 55%,#2a2a44)}
  .row.done{border-color:#166534}
  .rh{display:flex;align-items:center;gap:12px;padding:11px 13px}
  .rh img{width:38px;height:53px;object-fit:cover;border-radius:7px;background:#181830;flex:none}
  .rh .nm{flex:1;min-width:0}
  .rh .nm b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .rh .nm small{color:#9a98c0;font-size:.76rem;display:block;margin-top:2px}
  .tag{padding:4px 10px;border-radius:999px;font-size:.74rem;font-weight:700;white-space:nowrap;
    background:color-mix(in srgb,var(--ac) 16%,transparent);border:1px solid color-mix(in srgb,var(--ac) 40%,transparent)}
  .tag.off{background:#181830;border-color:#2a2a44;color:#8f8dae;font-weight:600}
  .tag.done{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.4);color:#6ee7b7}

  .steps{display:flex;gap:6px;padding:0 13px 12px;flex-wrap:wrap}
  .stp{flex:1;min-width:96px;padding:8px 6px;border-radius:10px;border:1px solid #2a2a44;background:#11111f;
    color:#8f8dae;cursor:pointer;font:inherit;font-size:.76rem;text-align:center;line-height:1.35}
  .stp b{display:block;font-size:.8rem}
  .stp:hover{border-color:var(--vio);color:#eef}
  .stp.past{color:#cfceea;border-color:color-mix(in srgb,var(--ac) 35%,#2a2a44);
    background:color-mix(in srgb,var(--ac) 8%,#11111f)}
  .stp.cur{color:#fff;border-color:var(--ac);background:color-mix(in srgb,var(--ac) 22%,#11111f);
    box-shadow:0 0 0 3px color-mix(in srgb,var(--ac) 18%,transparent)}
  .bar{height:6px;border-radius:999px;background:#1c1c33;overflow:hidden;margin:0 13px 12px}
  .bar i{display:block;height:100%;border-radius:999px;background:var(--ac)}
  .row.done .bar i{background:#22c55e}

  .form{display:grid;grid-template-columns:1fr 1fr 2fr;gap:10px;padding:0 13px 13px}
  @media(max-width:680px){.form{grid-template-columns:1fr}.steps .stp{min-width:0}}
  .acts{display:flex;flex-wrap:wrap;gap:8px;padding:0 13px 13px}
  .acts .sp{flex:1}
  .hint{color:#8f8dae;font-size:.76rem;padding:0 13px 12px;margin:0}
  .hint b{color:#bdbce0}
</style></head><body><div class="card">
  <h1>🛠️ LanorTrad — L'atelier</h1>
  <p class="sub">Où en est le prochain chapitre de chaque série. Un clic sur une étape,
    c'est enregistré dans <code>js/data/atelier.js</code> (avec sauvegarde automatique)
    et visible sur la fiche série, le planning et l'accueil.</p>

  <div class="toolbar">
    <button class="btn" id="reload">🔄 Recharger</button>
    <button class="btn" id="toggle-all">👁️ Voir aussi les séries terminées</button>
  </div>
  <div id="log"></div>
  <div id="list"></div>
</div>
<script>
const $=s=>document.querySelector(s);
const elLog=$("#log"), elList=$("#list");
let state=null, showAll=false, busy=false;

function log(msg,cls){ elLog.style.display="block";
  elLog.innerHTML='<span class="'+(cls||"")+'">'+esc(msg)+"</span>"; }
function logReset(){ elLog.innerHTML=""; elLog.style.display="none"; }
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const postJSON=(url,body)=>fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body||{})});
const coverURL=f=>f?("/api/cover?file="+encodeURIComponent(f)):"";
const stepIndex=id=>state.steps.findIndex(s=>s.id===id);

async function loadState(){
  const r=await fetch("/api/state"); state=await r.json();
  render();
}

/* --------- envoi : toutes les routes renvoient l'état à jour --------- */
async function call(url,body,okMsg){
  if(busy) return; busy=true;
  const r=await postJSON(url,body); let j={};
  try{ j=await r.json(); }catch(e){}
  busy=false;
  if(!r.ok){ log("❌ "+(j.error||"Erreur"),"err"); return null; }
  if(j.state){ state=j.state; render(); }
  if(okMsg) log(okMsg+(j.backup?"  (copie de sécurité : tools/.backups/"+j.backup+")":""),"ok");
  return j;
}

/* ------------------------------ rendu ------------------------------ */
function render(){
  elList.innerHTML="";
  const rows=state.rows.filter(r=>showAll||r.ongoing||r.entry);
  if(!rows.length){ elList.innerHTML='<p class="hint">Aucune série en cours.</p>'; return; }
  rows.forEach(r=>elList.appendChild(rowEl(r)));

  if(state.orphans.length){
    const p=document.createElement("p"); p.className="hint";
    p.innerHTML='⚠️ Entrées sans série correspondante dans <code>series.js</code> : <b>'+
      esc(state.orphans.join(", "))+"</b> — elles n'affichent rien sur le site.";
    elList.appendChild(p);
  }
}

function rowEl(r){
  const e=r.entry, i=e?stepIndex(e.step):-1, done=e&&e.step==="sortie";
  const d=document.createElement("div");
  d.className="row"+(e?" on":"")+(done?" done":"");
  d.style.setProperty("--ac",r.accent);

  /* — entête — */
  const h=document.createElement("div"); h.className="rh";
  const img=document.createElement("img"); img.src=coverURL(r.cover); img.alt="";
  const nm=document.createElement("div"); nm.className="nm";
  nm.innerHTML="<b>"+esc(r.title)+"</b><small>"+esc(r.status||"—")+
    (e?" · dernier point d'étape le "+esc(e.updated):"")+"</small>";
  const tag=document.createElement("span");
  tag.className="tag"+(e?(done?" done":""):" off");
  tag.textContent=e?(state.steps[i].ico+" "+state.steps[i].label+"  "+(i+1)+"/6"):"Pas à l'atelier";
  h.append(img,nm,tag); d.appendChild(h);

  if(!e){
    const acts=document.createElement("div"); acts.className="acts";
    const b=document.createElement("button"); b.className="btn go";
    b.textContent="➕ Mettre à l'atelier (ch. "+r.suggest+")";
    b.addEventListener("click",()=>call("/api/save",
      {id:r.id,entry:{chapter:r.suggest,step:"pages"}},"✅ "+r.title+" est à l'atelier."));
    acts.appendChild(b); d.appendChild(acts);
    return d;
  }

  /* — jauge — */
  const bar=document.createElement("div"); bar.className="bar";
  bar.innerHTML='<i style="width:'+Math.round((i+1)/6*100)+'%"></i>';
  d.appendChild(bar);

  /* — les 6 étapes, cliquables — */
  const st=document.createElement("div"); st.className="steps";
  state.steps.forEach((s,k)=>{
    const b=document.createElement("button");
    b.className="stp"+(k<i?" past":k===i?" cur":"");
    b.innerHTML="<b>"+s.ico+"</b>"+esc(s.label);
    b.title=k===i?"Étape en cours":"Passer à « "+s.label+" »";
    b.addEventListener("click",()=>{ if(k===i) return;
      call("/api/step",{id:r.id,step:s.id},"✅ "+r.title+" → "+s.label+" (daté d'aujourd'hui)"); });
    st.appendChild(b);
  });
  d.appendChild(st);

  /* — chapitre / sortie visée / note — */
  const f=document.createElement("div"); f.className="form";
  const fCh=field("Chapitre","text",e.chapter,"250 ou 45-46");
  const fEta=field("Sortie visée (optionnel)","date",e.eta||"","");
  const fNote=field("Note (optionnel)","text",e.note||"","Ex : chapitre double, on prend le temps.");
  f.append(fCh.wrap,fEta.wrap,fNote.wrap);
  d.appendChild(f);

  /* — actions — */
  const acts=document.createElement("div"); acts.className="acts";
  const next=document.createElement("button"); next.className="btn go";
  next.textContent=i>=5?"🎉 Déjà sorti":"▶ Étape suivante : "+state.steps[i+1].label;
  next.disabled=i>=5;
  next.addEventListener("click",()=>call("/api/step",{id:r.id},
    "✅ "+r.title+" → "+(i<5?state.steps[i+1].label:"")+" (daté d'aujourd'hui)"));

  const back=document.createElement("button"); back.className="btn";
  back.textContent="◀ Reculer"; back.disabled=i<=0;
  back.addEventListener("click",()=>call("/api/step",{id:r.id,dir:"back"},"↩️ "+r.title+" : étape reculée."));

  const save=document.createElement("button"); save.className="btn";
  save.textContent="💾 Enregistrer les champs";
  save.addEventListener("click",()=>call("/api/save",{id:r.id,entry:{
    chapter:fCh.input.value, step:e.step, updated:e.updated, keepDate:true,
    eta:fEta.input.value, note:fNote.input.value
  }},"✅ "+r.title+" : infos enregistrées."));

  const rm=document.createElement("button"); rm.className="btn red";
  rm.textContent="🗑️ Retirer de l'atelier";
  rm.addEventListener("click",()=>{
    if(!confirm("Retirer « "+r.title+" » de l'atelier ?\\nLe site n'affichera plus sa jauge.")) return;
    call("/api/remove",{id:r.id},"🗑️ "+r.title+" retiré de l'atelier.");
  });

  const sp=document.createElement("span"); sp.className="sp";
  acts.append(next,back,save,sp,rm); d.appendChild(acts);

  if(done){
    const p=document.createElement("p"); p.className="hint";
    p.innerHTML="🎉 Marqué <b>sorti</b> : le bloc passe en vert sur le site, puis disparaît tout seul "+
      "3 jours après le "+esc(e.updated)+". Pense à lancer <code>py tools/build-data.py</code> "+
      "pour que le chapitre soit lisible.";
    d.appendChild(p);
  }
  return d;
}

/* Les id de séries contiennent des espaces : pas d'attribut id, on garde
   directement la référence du champ. */
function field(labelTxt,type,val,ph){
  const w=document.createElement("div");
  const l=document.createElement("label"); l.textContent=labelTxt;
  const inp=document.createElement("input");
  inp.type=type; inp.value=val||""; if(ph) inp.placeholder=ph;
  l.addEventListener("click",()=>inp.focus());
  w.append(l,inp); return {wrap:w,input:inp};
}

$("#reload").addEventListener("click",()=>{ logReset(); loadState(); });
$("#toggle-all").addEventListener("click",e=>{
  showAll=!showAll;
  e.target.textContent=showAll?"👁️ Ne voir que les séries en cours":"👁️ Voir aussi les séries terminées";
  render();
});
loadState();
</script></body></html>`;
