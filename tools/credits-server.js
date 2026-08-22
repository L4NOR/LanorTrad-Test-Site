/* =========================================================================
   LanorTrad — Serveur LOCAL des crédits de chapitre (qui a fait quoi).
   Lance :  node tools/credits-server.js   (ou double-clic sur Modifier-Credits.bat)
   Puis ouvre : http://localhost:4602

   Les autres outils gèrent les IMAGES (upload-server.js), les INFOS de fiche
   (series-server.js) et l'AVANCEMENT du prochain chapitre (atelier-server.js).
   Celui-ci gère les NOMS affichés en fin de chapitre : traduction, clean,
   edit, Q-check.

   Jusqu'ici ces quatre noms étaient écrits en dur dans js/reader.js, donc
   identiques sur tout le catalogue. Dès qu'une série est reprise par quelqu'un
   d'autre, ou qu'un renfort passe sur un gros chapitre, le lecteur remerciait
   la mauvaise personne. D'où js/data/credits.js et cet outil.

   Ce qu'il fait :
   1. Lit js/data/series.js, js/data/chapters.js et js/data/credits.js.
   2. Te laisse remplir les crédits à trois niveaux : tout le site, une série
      entière, ou un chapitre précis. Un champ vide hérite du niveau au-dessus,
      donc on ne saisit que les exceptions — pas 700 lignes identiques.
   3. Réécrit js/data/credits.js proprement, après copie de sécurité dans
      tools/.backups/, et relit le résultat avant de le garder.

   ⚠️  Outil LOCAL uniquement (écoute sur 127.0.0.1). N'expose rien sur Internet.
       Après modification, pense à mettre ton site en ligne (git push / Netlify).
   ========================================================================= */
"use strict";
const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT          = path.join(__dirname, "..");
const SERIES_FILE   = path.join(ROOT, "js", "data", "series.js");
const CHAPTERS_FILE = path.join(ROOT, "js", "data", "chapters.js");
const CREDITS_FILE  = path.join(ROOT, "js", "data", "credits.js");
const BACKUP_DIR    = path.join(__dirname, ".backups");
const PORT          = Number(process.env.PORT) || 4602;
const MAX_BACKUPS   = 30;

/* Les quatre rôles, dans l'ordre où le lecteur les affiche. */
const ROLES = [
  { id: "trad",  label: "Traduction" },
  { id: "clean", label: "Clean" },
  { id: "edit",  label: "Edit" },
  { id: "qc",    label: "Q-check" },
];
const ROLE_IDS = ROLES.map(r => r.id);

/* Repli identique à celui de js/reader.js (TEAM_DEFAUT). Les deux doivent dire
   la même chose : si l'un change, l'autre doit suivre. */
const TEAM_DEFAUT = { trad: "Taichoskii", clean: "Lanor", edit: "Lanor", qc: "Zerox" };

/* ------------------------- lecture des données ------------------------- */
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
  return list.map(s => ({ id: String(s.id), title: String(s.title || s.id) }));
}

function loadChapters() {
  const out = {};
  let manifest = null;
  try { manifest = loadWindowVar(CHAPTERS_FILE, "CHAPTERS"); } catch { manifest = null; }
  if (!manifest) return out;
  for (const id of Object.keys(manifest)) out[id] = (manifest[id] || []).map(c => String(c.num));
  return out;
}

function loadCredits() {
  const vide = { defaut: {}, liens: {}, series: {} };
  if (!fs.existsSync(CREDITS_FILE)) return vide;
  const c = loadWindowVar(CREDITS_FILE, "CREDITS");
  if (c === null) return vide;
  if (typeof c !== "object" || Array.isArray(c))
    throw new Error("js/data/credits.js ne définit pas window.CREDITS (objet).");
  // liens compris : l'interface ne les montre pas, mais elle les renvoie tels
  // quels a l'enregistrement. Les oublier ici, c'est les effacer du fichier.
  return { defaut: c.defaut || {}, liens: c.liens || {}, series: c.series || {} };
}

/* ------------------------ validation / nettoyage ----------------------- */
/* Un nom est du texte libre : on enlève seulement ce qui casserait le fichier
   ou l'affichage (retours à la ligne, caractères de contrôle) et on borne la
   longueur. Pas de liste blanche de pseudos : l'équipe change. */
function cleanName(v) {
  return String(v === undefined || v === null ? "" : v)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/* Ne garde que les rôles réellement remplis : un objet vide disparaît, pour
   que le fichier ne se remplisse pas de lignes qui ne disent rien. */
function cleanEntry(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const id of ROLE_IDS) {
    const v = cleanName(raw[id]);
    if (v) out[id] = v;
  }
  return out;
}

/* Les liens ne passent pas par l'interface : l'outil les relit, les renvoie
   tels quels et les reecrit. Tout ce qui n'est pas http(s) est refuse. */
function cleanLiens(raw) {
  const out = {};
  if (!raw || typeof raw !== "object") return out;
  for (const nom of Object.keys(raw)) {
    const n = cleanName(nom);
    const u = String(raw[nom] === undefined || raw[nom] === null ? "" : raw[nom]).trim();
    if (n && /^https?:\/\//i.test(u)) out[n] = u;
  }
  return out;
}

function normalize(payload) {
  const defaut = cleanEntry(payload && payload.defaut);
  const liens = cleanLiens(payload && payload.liens);
  const series = {};
  const src = (payload && payload.series) || {};
  for (const sid of Object.keys(src)) {
    const s = src[sid] || {};
    const sDef = cleanEntry(s.defaut);
    const chaps = {};
    const cs = s.chapitres || {};
    for (const num of Object.keys(cs)) {
      const e = cleanEntry(cs[num]);
      if (Object.keys(e).length) chaps[String(num)] = e;
    }
    if (Object.keys(sDef).length || Object.keys(chaps).length) {
      const entry = {};
      if (Object.keys(sDef).length) entry.defaut = sDef;
      if (Object.keys(chaps).length) entry.chapitres = chaps;
      series[sid] = entry;
    }
  }
  return { defaut, liens, series };
}

/* --------------------------- écriture du fichier ----------------------- */
const HEADER = [
  "// === LanorTrad - Qui a fait quoi, chapitre par chapitre ===",
  "// Ce fichier decide des noms affiches sur l'ecran de fin d'un chapitre.",
  "// Editez-le a la main OU via l'outil local :",
  "//   node tools/credits-server.js   (ou tools/Modifier-Credits.bat)",
  "//",
  "// TROIS NIVEAUX, du plus general au plus precis. Chaque niveau ne remplace",
  "// que les champs qu'il cite : inutile de recopier les autres.",
  "//",
  "//   1. defaut                     l'equipe habituelle",
  "//   2. series[<id>].defaut        toute une serie (une reprise, un renfort)",
  "//   3. series[<id>].chapitres[N]  un chapitre precis",
  "//",
  "//   trad   Traduction (japonais -> francais)",
  "//   clean  Clean (textes effaces, redraw)",
  "//   edit   Edit (textes places dans les bulles)",
  "//   qc     Q-check (relecture finale)",
  "//",
  "// L'id de serie s'ecrit EXACTEMENT comme dans series.js (\"Tougen Anki\").",
  "// Le numero de chapitre s'ecrit comme dans chapters.js (\"250\", \"45.5\").",
  "// Un champ ABSENT herite du niveau au-dessus. Un champ mis a \"\" a la main",
  "// masque la ligne -- un chapitre sorti sans Q-check, par exemple. L'outil,",
  "// lui, n'ecrit jamais de champ vide : il le retire.",
  "// Un nom identique en clean et en edit s'affiche sur une seule ligne",
  "// \"Clean & Edit\", comme avant.",
  "// Le MEME nom sur les quatre postes s'affiche sur UNE seule carte",
  "// \"Realise par\" : c'est le cas des chapitres repris de l'edition officielle,",
  "// ou repeter le nom quatre fois n'apprend rien a personne.",
  "//",
  "// liens : l'adresse d'une equipe creditee. Le nom devient cliquable sur",
  "// l'ecran de fin. Ca se remplit A LA MAIN ici -- l'outil ne l'edite pas, il",
  "// se contente de ne pas le perdre. Seul http(s) est accepte : ce qui sort",
  "// d'ici finit dans un href.",
].join("\n");

const q = s => JSON.stringify(String(s));

/* Rend l'objet « comme écrit à la main » : les rôles toujours dans le même
   ordre, les chapitres triés par numéro et non par ordre de saisie. */
function renderEntry(e) {
  return "{ " + ROLE_IDS.filter(id => e[id]).map(id => id + ": " + q(e[id])).join(", ") + " }";
}

function renderFile(data, order) {
  const ids = order.filter(id => data.series[id])
    .concat(Object.keys(data.series).filter(id => order.indexOf(id) < 0));
  const L = [HEADER, "window.CREDITS = {"];
  const def = Object.keys(data.defaut).length ? data.defaut : TEAM_DEFAUT;
  L.push("  defaut: " + renderEntry(def) + ",");
  const liens = data.liens || {};
  const noms = Object.keys(liens).sort();
  if (noms.length) {
    L.push("  liens: {");
    noms.forEach((n, k) => L.push("    " + q(n) + ": " + q(liens[n]) + (k < noms.length - 1 ? "," : "")));
    L.push("  },");
  }
  if (!ids.length) {
    L.push("  series: {}");
    L.push("};");
    return L.join("\n") + "\n";
  }
  L.push("  series: {");
  ids.forEach((sid, i) => {
    const s = data.series[sid];
    L.push("    " + q(sid) + ": {");
    const parts = [];
    if (s.defaut) parts.push("      defaut: " + renderEntry(s.defaut));
    if (s.chapitres) {
      const nums = Object.keys(s.chapitres)
        .sort((a, b) => (parseFloat(a) - parseFloat(b)) || a.localeCompare(b));
      const w = Math.max.apply(null, nums.map(n => q(n).length + 1));
      const rows = nums.map(n =>
        "        " + q(n) + ":" + " ".repeat(Math.max(0, w - q(n).length - 1)) + " " +
        renderEntry(s.chapitres[n]));
      parts.push("      chapitres: {\n" + rows.join(",\n") + "\n      }");
    }
    L.push(parts.join(",\n"));
    L.push("    }" + (i < ids.length - 1 ? "," : ""));
  });
  L.push("  }");
  L.push("};");
  return L.join("\n") + "\n";
}

function backup() {
  if (!fs.existsSync(CREDITS_FILE)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  let dst = path.join(BACKUP_DIR, "credits-" + stamp + ".js");
  for (let n = 2; fs.existsSync(dst); n++)          // 2 écritures dans la même seconde
    dst = path.join(BACKUP_DIR, "credits-" + stamp + "-" + n + ".js");
  fs.copyFileSync(CREDITS_FILE, dst);
  const olds = fs.readdirSync(BACKUP_DIR).filter(f => /^credits-.*\.js$/.test(f)).sort();
  while (olds.length > MAX_BACKUPS) fs.unlinkSync(path.join(BACKUP_DIR, olds.shift()));
  return path.basename(dst);
}

/* Écrit puis relit : si le fichier produit n'est pas relisible, ou s'il ne
   contient pas ce qu'on croyait y mettre, on restaure l'ancien tout de suite.
   Un fichier de données cassé rendrait l'écran de fin muet sur tout le site. */
function saveCredits(data, order) {
  const before = fs.existsSync(CREDITS_FILE) ? fs.readFileSync(CREDITS_FILE, "utf8") : "";
  const bak = backup();
  fs.writeFileSync(CREDITS_FILE, renderFile(data, order), "utf8");
  try {
    const check = loadCredits();
    if (Object.keys(check.series || {}).length !== Object.keys(data.series).length)
      throw new Error("relecture incohérente");
  } catch (e) {
    if (before) fs.writeFileSync(CREDITS_FILE, before, "utf8");
    throw new Error("Écriture annulée (fichier restauré) : " + (e.message || e));
  }
  return bak;
}

/* ------------------------------ HTTP ----------------------------------- */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", d => { b += d; if (b.length > 4e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function sendJSON(res, code, obj) {
  const s = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8",
                        "Content-Length": Buffer.byteLength(s) });
  res.end(s);
}

function buildState() {
  const chapters = loadChapters();
  return {
    roles: ROLES,
    defautSite: TEAM_DEFAUT,
    series: loadSeries().map(s => ({ id: s.id, title: s.title, chapters: chapters[s.id] || [] })),
    credits: loadCredits(),
  };
}

const server = http.createServer(async (req, res) => {
  try {
    const p = new URL(req.url, "http://localhost").pathname;

    if (p === "/" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(PAGE);
    }
    if (p === "/api/state" && req.method === "GET") return sendJSON(res, 200, buildState());
    if (p === "/api/save" && req.method === "POST") {
      const data = normalize(await readBody(req));
      const bak = saveCredits(data, loadSeries().map(s => s.id));
      return sendJSON(res, 200, { ok: true, backup: bak, series: Object.keys(data.series).length });
    }
    res.writeHead(404);
    res.end("Not found");
  } catch (e) {
    sendJSON(res, 500, { error: String((e && e.message) || e) });
  }
});

/* ------------------------------- page ---------------------------------- */
const PAGE = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8">
<title>LanorTrad — Crédits des chapitres</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root{--vio:#a855f7;--grad:linear-gradient(135deg,#6366f1,#a855f7 55%,#d946ef)}
  *{box-sizing:border-box}
  body{margin:0;font-family:system-ui,Segoe UI,Roboto,sans-serif;background:#0b0b16;color:#eef;
    min-height:100vh;display:flex;justify-content:center;padding:32px 16px}
  .card{width:100%;max-width:1040px}
  h1{font-size:1.6rem;margin:0 0 4px}
  .sub{color:#9a98c0;margin:0 0 20px;font-size:.92rem}
  h2{font-size:1rem;margin:0 0 10px;color:#dcdcf5}
  code{background:#181830;padding:1px 5px;border-radius:5px;font-size:.9em}
  label{display:block;font-size:.78rem;font-weight:600;color:#bdbce0;margin:0 0 5px}
  input{width:100%;padding:9px 11px;border-radius:9px;border:1px solid #2a2a44;
    background:#11111f;color:#eef;font:inherit;font-size:.88rem}
  input:focus{outline:none;border-color:var(--vio);box-shadow:0 0 0 3px rgba(168,85,247,.2)}
  input::placeholder{color:#5a5880;font-style:italic}
  .btn{padding:8px 12px;border-radius:9px;border:1px solid #2a2a44;background:#181830;color:#eef;
    cursor:pointer;font:inherit;font-size:.82rem}
  .btn:hover{border-color:var(--vio)}
  .btn:disabled{opacity:.45;cursor:not-allowed}
  .btn.go{background:var(--grad);border:none;color:#fff;font-weight:700}
  .btn.on{border-color:var(--vio);background:#1d1a33}
  .box{border:1px solid #2a2a44;border-radius:14px;background:#0e0e1c;padding:14px;margin:0 0 14px}
  .grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
  .serie-list{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 14px}
  .toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 12px}
  .toolbar input[type=text]{width:auto;flex:1;min-width:150px}
  .chk{display:flex;align-items:center;gap:6px;font-size:.82rem;color:#bdbce0;white-space:nowrap}
  .chk input{width:auto}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{text-align:left;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;
    color:#8886b0;padding:0 6px 7px;font-weight:700}
  td{padding:3px 6px;vertical-align:middle}
  td.num{white-space:nowrap;color:#dcdcf5;font-weight:600;width:74px}
  tr.perso td.num{color:#c084fc}
  .empty{color:#9a98c0;font-size:.88rem;padding:10px 0}
  #log{margin:14px 0 0;font-size:.85rem;white-space:pre-wrap;color:#bdbce0;
    background:#0e0e1c;border:1px solid #2a2a44;border-radius:11px;padding:12px;display:none}
  .ok{color:#6ee7b7}.err{color:#fca5a5}.warn{color:#fcd34d}
  .bar{position:sticky;bottom:0;background:linear-gradient(transparent,#0b0b16 30%);
    padding:16px 0 4px;display:flex;gap:9px;align-items:center}
  .count{color:#9a98c0;font-size:.82rem}
</style></head><body><div class="card">
  <h1>Crédits des chapitres</h1>
  <p class="sub">Qui a traduit, cleané, édité et relu — chapitre par chapitre. Un champ laissé vide
    reprend le niveau au-dessus, donc tu ne saisis que les exceptions.</p>

  <div class="box">
    <h2>Toute l'équipe, par défaut</h2>
    <p class="sub" style="margin:-4px 0 12px">Ce que voit un lecteur quand rien de plus précis n'est dit.</p>
    <div class="grid4" id="site"></div>
  </div>

  <div class="serie-list" id="series"></div>
  <div id="detail"></div>

  <div class="bar">
    <button class="btn go" id="save">Enregistrer</button>
    <button class="btn" id="reload">Recharger</button>
    <span class="count" id="count"></span>
  </div>
  <div id="log"></div>
</div>
<script>
var ST = null, CUR = null;
var $ = function (s) { return document.querySelector(s); };

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
function log(msg, cls) {
  var el = $("#log");
  el.style.display = "block";
  el.className = cls || "";
  el.textContent = msg;
}

/* Le niveau du dessus, celui qui s'affiche en filigrane dans les champs vides. */
function heritage(sid) {
  var out = {}, k;
  for (k in ST.defautSite) out[k] = ST.defautSite[k];
  var d = ST.credits.defaut || {};
  for (k in d) if (d[k]) out[k] = d[k];
  if (sid) {
    var s = (ST.credits.series || {})[sid] || {};
    var sd = s.defaut || {};
    for (k in sd) if (sd[k]) out[k] = sd[k];
  }
  return out;
}

function champs(vals, ph, onInput) {
  var html = "";
  ST.roles.forEach(function (r) {
    html += '<div><label>' + esc(r.label) + '</label>' +
      '<input data-role="' + r.id + '" value="' + esc(vals[r.id] || "") + '"' +
      ' placeholder="' + esc(ph[r.id] || "") + '"></div>';
  });
  var wrap = document.createElement("div");
  wrap.className = "grid4";
  wrap.innerHTML = html;
  wrap.addEventListener("input", function (e) {
    var role = e.target.getAttribute("data-role");
    if (role) onInput(role, e.target.value);
  });
  return wrap;
}

function serieEntry(sid) {
  var s = ST.credits.series || (ST.credits.series = {});
  if (!s[sid]) s[sid] = {};
  return s[sid];
}

function renderSite() {
  var host = $("#site");
  host.innerHTML = "";
  host.appendChild(champs(ST.credits.defaut || {}, ST.defautSite, function (role, v) {
    if (!ST.credits.defaut) ST.credits.defaut = {};
    ST.credits.defaut[role] = v;
    if (CUR) renderDetail();
  }));
}

function renderSeries() {
  var host = $("#series");
  host.innerHTML = "";
  ST.series.forEach(function (s) {
    var b = document.createElement("button");
    b.className = "btn" + (CUR === s.id ? " on" : "");
    b.textContent = s.title + " (" + s.chapters.length + ")";
    b.onclick = function () { CUR = s.id; renderSeries(); renderDetail(); };
    host.appendChild(b);
  });
}

function renderDetail() {
  var host = $("#detail");
  host.innerHTML = "";
  if (!CUR) { host.innerHTML = '<p class="empty">Choisis une série ci-dessus.</p>'; return; }

  var serie = null;
  ST.series.forEach(function (s) { if (s.id === CUR) serie = s; });
  if (!serie) return;

  var entry = serieEntry(CUR);
  var box = document.createElement("div");
  box.className = "box";
  box.innerHTML = '<h2>Toute la série — ' + esc(serie.title) + '</h2>' +
    '<p class="sub" style="margin:-4px 0 12px">S\\'applique à ses ' + serie.chapters.length +
    ' chapitres, sauf ceux réglés individuellement plus bas.</p>';
  if (!entry.defaut) entry.defaut = {};
  box.appendChild(champs(entry.defaut, heritage(null), function (role, v) {
    entry.defaut[role] = v;
    renderTable();
  }));
  host.appendChild(box);

  var tbox = document.createElement("div");
  tbox.className = "box";
  tbox.innerHTML =
    '<h2>Chapitre par chapitre</h2>' +
    '<div class="toolbar">' +
      '<input type="text" id="filtre" placeholder="Filtrer par numéro (ex. 12, 4.5)">' +
      '<span class="chk"><input type="checkbox" id="onlyperso"> seulement ceux déjà personnalisés</span>' +
      '<button class="btn" id="vider">Vider la série</button>' +
    '</div><div id="tbl"></div>';
  host.appendChild(tbox);

  $("#filtre").addEventListener("input", renderTable);
  $("#onlyperso").addEventListener("change", renderTable);
  $("#vider").onclick = function () {
    if (!confirm("Effacer tous les crédits propres à cette série ? Les chapitres reprendront le niveau au-dessus.")) return;
    delete (ST.credits.series || {})[CUR];
    renderDetail();
  };
  renderTable();
}

function renderTable() {
  var serie = null;
  ST.series.forEach(function (s) { if (s.id === CUR) serie = s; });
  if (!serie) return;
  var entry = serieEntry(CUR);
  var chaps = entry.chapitres || (entry.chapitres = {});
  var ph = heritage(CUR);
  var f = ($("#filtre") && $("#filtre").value || "").trim().toLowerCase();
  var onlyPerso = $("#onlyperso") && $("#onlyperso").checked;

  var nums = serie.chapters.filter(function (n) {
    if (f && String(n).toLowerCase().indexOf(f) < 0) return false;
    if (onlyPerso && !(chaps[n] && Object.keys(chaps[n]).length)) return false;
    return true;
  });

  var head = '<tr><th>N°</th>' + ST.roles.map(function (r) {
    return '<th>' + esc(r.label) + '</th>';
  }).join("") + '<th></th></tr>';

  var rows = nums.map(function (n) {
    var e = chaps[n] || {};
    var perso = Object.keys(e).length ? " perso" : "";
    var tds = ST.roles.map(function (r) {
      return '<td><input data-num="' + esc(n) + '" data-role="' + r.id + '" value="' +
        esc(e[r.id] || "") + '" placeholder="' + esc(ph[r.id] || "") + '"></td>';
    }).join("");
    return '<tr class="' + perso.trim() + '"><td class="num">' + esc(n) + '</td>' + tds +
      '<td><button class="btn" data-clear="' + esc(n) + '" title="Remettre ce chapitre sur la série">↺</button></td></tr>';
  }).join("");

  var host = $("#tbl");
  host.innerHTML = nums.length
    ? '<table>' + head + rows + '</table>'
    : '<p class="empty">Aucun chapitre ne correspond.</p>';

  host.addEventListener("input", function (e) {
    var num = e.target.getAttribute("data-num"), role = e.target.getAttribute("data-role");
    if (num == null || !role) return;
    if (!chaps[num]) chaps[num] = {};
    if (e.target.value.trim()) chaps[num][role] = e.target.value;
    else delete chaps[num][role];
    if (!Object.keys(chaps[num]).length) delete chaps[num];
    majCount();
  });
  host.addEventListener("click", function (e) {
    var n = e.target.getAttribute && e.target.getAttribute("data-clear");
    if (n == null) return;
    delete chaps[n];
    renderTable();
  });
  majCount();
}

function majCount() {
  var n = 0, s = ST.credits.series || {};
  Object.keys(s).forEach(function (sid) {
    n += Object.keys((s[sid] || {}).chapitres || {}).length;
  });
  $("#count").textContent = n + " chapitre(s) avec des crédits propres";
}

function load() {
  fetch("/api/state").then(function (r) { return r.json(); }).then(function (st) {
    if (st.error) return log(st.error, "err");
    ST = st;
    if (!ST.credits.series) ST.credits.series = {};
    renderSite(); renderSeries(); renderDetail(); majCount();
  }).catch(function (e) { log(String(e), "err"); });
}

$("#save").onclick = function () {
  $("#save").disabled = true;
  log("Enregistrement…");
  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ST.credits)
  }).then(function (r) { return r.json(); }).then(function (r) {
    $("#save").disabled = false;
    if (r.error) return log(r.error, "err");
    log("Enregistré dans js/data/credits.js" +
        (r.backup ? " (copie de sécurité : tools/.backups/" + r.backup + ")" : "") +
        "\\nPense à mettre le site en ligne pour que les lecteurs le voient.", "ok");
    load();
  }).catch(function (e) { $("#save").disabled = false; log(String(e), "err"); });
};
$("#reload").onclick = load;
load();
</script></body></html>`;

server.listen(PORT, "127.0.0.1", () => {
  console.log("  Crédits des chapitres  ->  http://localhost:" + PORT);
  console.log("  Fichier ecrit : js/data/credits.js");
  console.log("  Ctrl+C pour arreter.");
});
