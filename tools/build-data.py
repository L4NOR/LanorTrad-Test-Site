#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Generateur du manifeste de chapitres.

Scanne F:\\LanorTrad\\Site\\Manga\\<Serie>\\Chapitres\\Chapitre NN\\*.jpg
et produit :

  js/data/chapters.js        INDEX leger (numero, dossier, nb de pages,
                             vignette, dimensions) - charge sur TOUTES les pages
  js/data/pages/<Serie>.js   liste des fichiers de chaque chapitre - chargee
                             a la demande par le lecteur, pour la seule serie
                             ouverte

Avant ce decoupage, chapters.js embarquait la liste de toutes les pages de
tous les chapitres (323 Ko) et etait charge jusque sur l'accueil et le forum.

Les dimensions (w/h) servent au lecteur a reserver la place de chaque page
avant son chargement : sans elles, le scroll saute a chaque image qui arrive
en mode webtoon. Elles sont mises en cache dans tools/.dims-cache.json
(cle = chemin + date + taille), donc seules les pages nouvelles sont mesurees.

Genere aussi les vignettes d'apercu de la page 1 de chaque chapitre
(tools/build-previews.py -> Manga/preview/<Serie>/<Chapitre>/) et pose le
chemin dans le champ "thumb" du manifeste : les apercus du site suivent donc
automatiquement les chapitres ajoutes.

Usage : py tools/build-data.py
        py tools/build-data.py --no-previews    (manifeste seul, plus rapide)
        py tools/build-data.py --no-dims        (saute la mesure des pages)
Relancer apres avoir copie de nouveaux chapitres pour les rendre disponibles.
"""
import os, re, json, sys, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANGA_DIR = os.path.join(ROOT, "Manga")
GAL_DIR = os.path.join(ROOT, "images", "Galerie")
OUT = os.path.join(ROOT, "js", "data", "chapters.js")
OUT_GAL = os.path.join(ROOT, "js", "data", "gallery.js")
OUT_PAGES = os.path.join(ROOT, "js", "data", "pages")
DIMS_CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".dims-cache.json")

IMG_EXT = (".webp", ".jpg", ".jpeg", ".png")
NUM_RE = re.compile(r"(\d+(?:\.\d+)?)")

_dims_cache = {}
_dims_dirty = False
_dims_misses = 0


def slug(name):
    """Nom de fichier sans espace ni caractere exotique."""
    out = re.sub(r"[^A-Za-z0-9._-]+", "-", name.replace("'", ""))
    return re.sub(r"-{2,}", "-", out).strip("-") or "serie"


def load_dims_cache():
    global _dims_cache
    try:
        with open(DIMS_CACHE, encoding="utf-8") as f:
            _dims_cache = json.load(f)
    except Exception:                                   # noqa: BLE001
        _dims_cache = {}


def save_dims_cache():
    if not _dims_dirty:
        return
    try:
        with open(DIMS_CACHE, "w", encoding="utf-8") as f:
            json.dump(_dims_cache, f)
    except OSError as e:
        sys.stderr.write(f"  [dims] cache non ecrit : {e}\n")


def image_size(path):
    """(largeur, hauteur) d'une image, via un cache disque. None si illisible :
    le lecteur retombe alors sur son comportement d'avant (pas de reservation
    de place), jamais sur une erreur."""
    global _dims_dirty, _dims_misses
    try:
        st = os.stat(path)
    except OSError:
        return None
    key = os.path.relpath(path, ROOT).replace("\\", "/")
    stamp = [int(st.st_mtime), st.st_size]
    hit = _dims_cache.get(key)
    if hit and hit[2:] == stamp:
        return hit[0], hit[1]
    try:
        from PIL import Image
        with Image.open(path) as im:
            w, h = im.size
    except Exception:                                   # noqa: BLE001
        return None
    _dims_cache[key] = [w, h] + stamp
    _dims_dirty = True
    _dims_misses += 1
    return w, h


def previous_index():
    """Relit le chapters.js deja genere -> {serie: [{"num", "d"}]}.

    C'est notre SEULE memoire des dates de sortie : ce fichier est la source de
    verite, versionnee, et il survit aux changements de machine.

    Deux formats sont acceptes : l'index compact actuel (`return expand({...})`,
    ou les dates vivent dans les surcharges par chapitre) et l'ancien index
    plein (`window.CHAPTERS = {...}`), pour qu'un retour en arriere ne perde
    rien. En cas de doute, on renvoie {} : stamp_dates ne datera alors
    personne, ce qui est le comportement sur."""
    try:
        with open(OUT, encoding="utf-8") as f:
            src = f.read()
    except OSError:
        return {}

    dec = json.JSONDecoder()

    # Format compact
    i = src.find("return expand(")
    if i >= 0:
        try:
            comp, _ = dec.raw_decode(src, i + len("return expand("))
        except ValueError:
            return {}
        out = {}
        for serie, d in (comp or {}).items():
            rows = []
            for c in d.get("c", []):
                o = c[2] if len(c) > 2 else {}
                rows.append({"num": c[0], "d": o.get("d")})
            out[serie] = rows
        return out

    # Ancien format plein
    i = src.find("window.CHAPTERS = ")
    if i < 0:
        return {}
    try:
        obj, _ = dec.raw_decode(src, i + len("window.CHAPTERS = "))
        return obj if isinstance(obj, dict) else {}
    except ValueError:
        return {}


def stamp_dates(data, prev):
    """Pose une date de sortie ("d") sur chaque chapitre, pour le lastmod du
    sitemap et le flux RSS.

    On ne DEVINE jamais une date : la date de dossier ne dit rien (tous les
    dossiers portent la date de la conversion WebP), et dater 561 chapitres du
    meme jour est exactement le probleme qu'on corrige - Google finit par
    ignorer un lastmod qui bouge en bloc a chaque deploiement.

    Regle :
      - date deja connue (passage precedent) -> on la garde, definitivement ;
      - chapitre ABSENT du passage precedent -> il vient d'etre ajoute,
        donc il sort aujourd'hui ;
      - chapitre deja la mais sans date (l'historique d'avant ce systeme)
        -> pas de date, et le sitemap omettra simplement son lastmod.
    """
    today = datetime.date.today().isoformat()
    kept = new = 0
    for serie, chapters in data.items():
        old = {c.get("num"): c for c in prev.get(serie, [])}
        known = serie in prev
        for c in chapters:
            o = old.get(c["num"])
            if o and o.get("d"):
                c["d"] = o["d"]
                kept += 1
            elif not o and known:
                # Serie deja indexee, chapitre inconnu au passage precedent :
                # c'est une vraie nouveaute.
                c["d"] = today
                new += 1
            elif not known:
                # Serie entierement nouvelle : on ne sait pas si elle est
                # publiee aujourd'hui ou rattrapee d'un coup. Pas de date.
                pass
    if new:
        print(f"  [dates] {new} nouveau(x) chapitre(s) date(s) du {today}")
    return kept, new


def natural_chapter_number(folder_name):
    """'Chapitre 138.5' -> 138.5 ; 'Chapitre 07' -> 7.0"""
    m = NUM_RE.search(folder_name)
    return float(m.group(1)) if m else None


def fmt_num(n):
    """138.0 -> '138' ; 138.5 -> '138.5'"""
    return str(int(n)) if n == int(n) else ("%g" % n)


def images_in(dirpath):
    """Liste triee des pages. Si un .webp existe pour une page, on l'utilise et
    on ignore le .jpg/.jpeg/.png de meme nom : evite les doublons pendant la
    periode ou JPG et WebP coexistent (avant suppression des JPG)."""
    chosen = {}
    for f in os.listdir(dirpath):
        if not f.lower().endswith(IMG_EXT):
            continue
        base = os.path.splitext(f)[0]
        if base not in chosen or f.lower().endswith(".webp"):
            chosen[base] = f
    return sorted(chosen.values())


def measure(cdir, files, with_dims):
    """Dimensions d'un chapitre : la taille dominante (w/h) + les pages qui en
    different (doubles pages, encarts). Retourne (w, h, exceptions)."""
    if not with_dims:
        return None, None, {}
    sizes = [image_size(os.path.join(cdir, f)) for f in files]
    counts = {}
    for s in sizes:
        if s:
            counts[s] = counts.get(s, 0) + 1
    if not counts:
        return None, None, {}
    (w, h), _ = max(counts.items(), key=lambda kv: kv[1])
    odd = {str(i): list(s) for i, s in enumerate(sizes) if s and s != (w, h)}
    return w, h, odd


def scan_series(series_path, with_dims=True):
    """Gere deux structures :
       - series normale : <serie>/Chapitres/Chapitre NN/*.jpg
       - oneshot        : <serie>/Oneshot/*.jpg  (un seul "chapitre")
       'folder' = chemin relatif au dossier de la serie (utilise tel quel par le lecteur).
    """
    chapters = []

    def add(num, folder, cdir, pages):
        w, h, odd = measure(cdir, pages, with_dims)
        c = {"num": fmt_num(num), "sort": num, "folder": folder, "pages": len(pages)}
        if w:
            c["w"], c["h"] = w, h
        c["files"] = pages          # retire de l'index, ecrit dans js/data/pages/
        if odd:
            c["odd"] = odd
        chapters.append(c)

    chap_root = os.path.join(series_path, "Chapitres")
    if os.path.isdir(chap_root):
        for entry in os.listdir(chap_root):
            cdir = os.path.join(chap_root, entry)
            if not os.path.isdir(cdir):
                continue
            num = natural_chapter_number(entry)
            if num is None:
                continue
            pages = images_in(cdir)
            if not pages:
                continue
            add(num, "Chapitres/" + entry, cdir, pages)
    else:
        one = os.path.join(series_path, "Oneshot")
        if os.path.isdir(one):
            pages = images_in(one)
            if pages:
                add(1.0, "Oneshot", one, pages)
    chapters.sort(key=lambda c: c["sort"], reverse=True)
    for c in chapters:
        del c["sort"]
    return chapters


# Fonction d'expansion embarquee en tete de chapters.js. Elle reconstruit
# EXACTEMENT la forme historique ({num, folder, pages, w, h, thumb, d}), ce qui
# evite de toucher la moindre ligne du code qui lit window.CHAPTERS.
EXPANDER = """\
// Index COMPACT. Le fichier plein faisait 70 Ko et se charge sur toutes les
// pages du site (accueil et forum compris) alors que seuls la fiche serie et
// le lecteur ont besoin du detail. Or 67 % de son poids etait devinable :
// "thumb" se deduit du dossier, "folder" suit 1 ou 2 motifs par serie, et les
// dimensions sont presque toujours les memes. On ne stocke donc que les
// exceptions, et on redeplie ici.
// La forme obtenue est identique a l'ancienne : rien d'autre ne change.
window.CHAPTERS = (function () {
  "use strict";
  function expand(D) {
    var out = {};
    for (var s in D) {
      var d = D[s], list = [];
      for (var i = 0; i < d.c.length; i++) {
        var c = d.c[i], o = c[2] || {};
        var folder = o.f !== undefined ? o.f : (o.p !== undefined ? o.p : d.p) + c[0];
        var e = { num: c[0], folder: folder, pages: c[1] };
        var w = o.w !== undefined ? o.w : d.w;
        var h = o.h !== undefined ? o.h : d.h;
        if (w) { e.w = w; e.h = h; }
        var t = o.t !== undefined ? o.t : d.t;
        if (t) {
          e.thumb = "Manga/preview/" + s + "/" +
                    folder.slice(folder.lastIndexOf("/") + 1) + "/" + t;
        }
        if (o.d) e.d = o.d;
        list.push(e);
      }
      out[s] = list;
    }
    return out;
  }
  return expand(__DATA__);
})();
"""


def _most_common(values):
    """Valeur la plus frequente d'une liste (None si vide)."""
    counts = {}
    for v in values:
        if v is not None:
            counts[v] = counts.get(v, 0) + 1
    return max(counts.items(), key=lambda kv: kv[1])[0] if counts else None


def compact_index(index):
    """Index plein -> index compact (voir EXPANDER pour le format).

    Par serie : un prefixe de dossier, un nom de vignette et des dimensions par
    defaut ; chaque chapitre n'ecrit que ce qui s'en ecarte."""
    out = {}
    for serie, chapters in index.items():
        # Prefixe : ce qui reste du dossier une fois le numero retire, quand le
        # dossier se termine bien par ce numero (les oneshots, dossier
        # "Oneshot", n'en ont pas et passeront en litteral).
        prefixes = [c["folder"][:-len(c["num"])] if c["folder"].endswith(c["num"]) else None
                    for c in chapters]
        thumbs = [c["thumb"].rsplit("/", 1)[1] if c.get("thumb") else None for c in chapters]
        dims = [(c["w"], c["h"]) if c.get("w") else None for c in chapters]

        p = _most_common(prefixes) or ""
        t = _most_common(thumbs)
        wh = _most_common(dims)
        w, h = wh if wh else (None, None)

        rows = []
        for c, pref in zip(chapters, prefixes):
            o = {}
            if pref != p:
                # Prefixe different : on garde le plus court des deux ecritures.
                if pref is not None and len(pref) <= len(c["folder"]):
                    o["p"] = pref
                else:
                    o["f"] = c["folder"]
            th = c["thumb"].rsplit("/", 1)[1] if c.get("thumb") else None
            if th != t:
                o["t"] = th if th is not None else ""
            if c.get("w") and (c["w"], c["h"]) != (w, h):
                o["w"], o["h"] = c["w"], c["h"]
            elif not c.get("w") and w:
                o["w"] = 0
            if c.get("d"):
                o["d"] = c["d"]
            rows.append([c["num"], c["pages"]] + ([o] if o else []))

        entry = {"p": p, "c": rows}
        if t:
            entry["t"] = t
        if w:
            entry["w"], entry["h"] = w, h
        out[serie] = entry
    return out


def scan_galleries():
    """Scanne images/Galerie/<Serie>/{Tomes,Colors}/*.jpg -> manifeste galerie."""
    data = {}
    if not os.path.isdir(GAL_DIR):
        return data
    for serie in sorted(os.listdir(GAL_DIR)):
        spath = os.path.join(GAL_DIR, serie)
        if not os.path.isdir(spath):
            continue
        entry = {}
        for kind, key in (("Tomes", "tomes"), ("Colors", "colors")):
            kdir = os.path.join(spath, kind)
            if os.path.isdir(kdir):
                imgs = images_in(kdir)
                if imgs:
                    entry[key] = ["images/Galerie/%s/%s/%s" % (serie, kind, f) for f in imgs]
        if entry:
            data[serie] = entry
    return data


def write_js(path, varname, data, label):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("// Genere automatiquement par tools/build-data.py - NE PAS EDITER A LA MAIN\n")
        f.write("window.%s = " % varname)
        f.write(json.dumps(data, ensure_ascii=False, indent=1))
        f.write(";\n")
    print(f"OK -> {path} ({label})")


def build_previews(skip):
    """Vignettes de la page 1 (apercu au survol dans la liste des chapitres).
    Si Pillow manque ou si --no-previews est passe, on se contente d'indexer
    celles deja presentes : le site ne perd pas ses apercus."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        import importlib
        prev = importlib.import_module("build-previews")
    except ImportError:
        print("  [apercus] tools/build-previews.py introuvable - ignore")
        return {}
    return prev.collect_existing() if skip else prev.build()


def write_pages_files(data):
    """Un fichier par serie avec la liste des pages : c'est la partie lourde,
    et seul le lecteur en a besoin, pour une seule serie a la fois."""
    os.makedirs(OUT_PAGES, exist_ok=True)
    index, keep = {}, set()
    for serie, chapters in data.items():
        name = slug(serie) + ".js"
        keep.add(name)
        path = os.path.join(OUT_PAGES, name)
        payload = {}
        for c in chapters:
            entry = {"f": c["files"]}
            if c.get("odd"):
                entry["odd"] = c["odd"]
            payload[c["num"]] = entry
        with open(path, "w", encoding="utf-8") as f:
            f.write("// Genere automatiquement par tools/build-data.py - NE PAS EDITER A LA MAIN\n")
            f.write("window.CHAPTER_FILES = window.CHAPTER_FILES || {};\n")
            f.write("window.CHAPTER_FILES[%s] = " % json.dumps(serie, ensure_ascii=False))
            f.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
            f.write(";\n")
        index[serie] = "js/data/pages/" + name
    # Series supprimees : on nettoie les fichiers orphelins
    for f in os.listdir(OUT_PAGES):
        if f.endswith(".js") and f not in keep:
            os.remove(os.path.join(OUT_PAGES, f))
            print(f"  [pages] retire {f} (serie disparue)")
    return index


def main():
    skip_prev = "--no-previews" in sys.argv
    with_dims = "--no-dims" not in sys.argv
    # Relu AVANT d'ecraser chapters.js : c'est notre memoire des dates de sortie.
    prev = previous_index()
    previews = build_previews(skip_prev)
    if with_dims:
        load_dims_cache()

    data = {}
    if not os.path.isdir(MANGA_DIR):
        print("Aucun dossier Manga trouve :", MANGA_DIR)
    else:
        for serie in sorted(os.listdir(MANGA_DIR)):
            spath = os.path.join(MANGA_DIR, serie)
            # Manga/preview/ contient les vignettes d'apercu, pas une serie
            if not os.path.isdir(spath) or serie.lower() == "preview":
                continue
            chapters = scan_series(spath, with_dims)
            if chapters:
                thumbs = previews.get(serie, {})
                for c in chapters:
                    if c["num"] in thumbs:
                        c["thumb"] = thumbs[c["num"]]
                data[serie] = chapters
                print(f"  {serie}: {len(chapters)} chapitres")
    stamp_dates(data, prev)
    save_dims_cache()
    if with_dims and _dims_misses:
        print(f"  [dims] {_dims_misses} page(s) mesuree(s) (les autres venaient du cache)")

    pages_index = write_pages_files(data)

    # Index : tout sauf la liste des fichiers (ecrite par serie ci-dessus)
    total = sum(len(v) for v in data.values())
    index = {s: [{k: v for k, v in c.items() if k not in ("files", "odd")} for c in ch]
             for s, ch in data.items()}
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("// Genere automatiquement par tools/build-data.py - NE PAS EDITER A LA MAIN\n")
        f.write("// Index des chapitres (sans la liste des pages : voir js/data/pages/).\n")
        f.write(EXPANDER.replace("__DATA__", json.dumps(
            compact_index(index), ensure_ascii=False, separators=(",", ":"))))
        f.write("// Ou trouver les pages de chaque serie (charge a la demande par le lecteur).\n")
        f.write("window.CHAPTER_PAGES = ")
        f.write(json.dumps(pages_index, ensure_ascii=False, indent=1))
        f.write(";\n")
    print(f"OK -> {OUT} ({len(data)} series, {total} chapitres)")
    print(f"OK -> {OUT_PAGES}/ ({len(pages_index)} fichier(s) de pages)")

    # Galerie (tomes + colors)
    gal = scan_galleries()
    for serie, e in gal.items():
        print(f"  [galerie] {serie}: {len(e.get('tomes', []))} tome(s), {len(e.get('colors', []))} color(s)")
    write_js(OUT_GAL, "GALLERY", gal, f"{len(gal)} series")


if __name__ == "__main__":
    main()
