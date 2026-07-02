#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Generateur du manifeste de chapitres.

Scanne F:\\LanorTrad\\Site\\Manga\\<Serie>\\Chapitres\\Chapitre NN\\*.jpg
et produit js/data/chapters.js (window.CHAPTERS) consomme par le lecteur.

Usage : py tools/build-data.py
Relancer apres avoir copie de nouveaux chapitres pour les rendre disponibles.
"""
import os, re, json, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANGA_DIR = os.path.join(ROOT, "Manga")
GAL_DIR = os.path.join(ROOT, "images", "Galerie")
OUT = os.path.join(ROOT, "js", "data", "chapters.js")
OUT_GAL = os.path.join(ROOT, "js", "data", "gallery.js")

IMG_EXT = (".webp", ".jpg", ".jpeg", ".png")
NUM_RE = re.compile(r"(\d+(?:\.\d+)?)")


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


def scan_series(series_path):
    """Gere deux structures :
       - series normale : <serie>/Chapitres/Chapitre NN/*.jpg
       - oneshot        : <serie>/Oneshot/*.jpg  (un seul "chapitre")
       'folder' = chemin relatif au dossier de la serie (utilise tel quel par le lecteur).
    """
    chapters = []
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
            chapters.append({
                "num": fmt_num(num), "sort": num,
                "folder": "Chapitres/" + entry, "pages": len(pages), "files": pages,
            })
    else:
        one = os.path.join(series_path, "Oneshot")
        if os.path.isdir(one):
            pages = images_in(one)
            if pages:
                chapters.append({
                    "num": "1", "sort": 1.0,
                    "folder": "Oneshot", "pages": len(pages), "files": pages,
                })
    chapters.sort(key=lambda c: c["sort"], reverse=True)
    for c in chapters:
        del c["sort"]
    return chapters


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


def main():
    data = {}
    if not os.path.isdir(MANGA_DIR):
        print("Aucun dossier Manga trouve :", MANGA_DIR)
    else:
        for serie in sorted(os.listdir(MANGA_DIR)):
            spath = os.path.join(MANGA_DIR, serie)
            if not os.path.isdir(spath):
                continue
            chapters = scan_series(spath)
            if chapters:
                data[serie] = chapters
                print(f"  {serie}: {len(chapters)} chapitres")

    total = sum(len(v) for v in data.values())
    write_js(OUT, "CHAPTERS", data, f"{len(data)} series, {total} chapitres")

    # Galerie (tomes + colors)
    gal = scan_galleries()
    for serie, e in gal.items():
        print(f"  [galerie] {serie}: {len(e.get('tomes', []))} tome(s), {len(e.get('colors', []))} color(s)")
    write_js(OUT_GAL, "GALLERY", gal, f"{len(gal)} series")


if __name__ == "__main__":
    main()
