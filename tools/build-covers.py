#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Variantes responsives des COUVERTURES (images/Cover/).

Pourquoi : les couvertures d'origine font 300 Ko a 2,2 Mo et sont affichees
dans des cartes de 230 px (voire des vignettes de 46 px). L'accueil chargeait
13 Mo d'images pour ~400 Ko utiles.

Ce script ne touche JAMAIS aux originaux : il ecrit des variantes WebP
redimensionnees dans images/Cover/rs/, et un manifeste js/data/covers.js qui
dit au site quelles variantes existent. Si le manifeste ne connait pas une
couverture (nouvelle serie, script pas relance), le site sert simplement
l'original comme avant : rien ne casse.

NOTE : le "jamais de retraitement" documente pour les PAGES DE MANGA
(tools/jpg-to-webp.py, lossless, aucun redimensionnement) ne s'applique pas
ici. Une couverture est un element d'interface affiche petit, pas une planche
qu'on lit. Les JPG/PNG d'origine restent en place et servent toujours de
source unique pour og:image et le partage social.

Usage :
    py tools/build-covers.py            # genere ce qui manque
    py tools/build-covers.py --force    # tout regenerer
"""
import os
import re
import sys
import json
import argparse
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT, "images", "Cover")
OUT_DIR = os.path.join(SRC_DIR, "rs")
MANIFEST = os.path.join(ROOT, "js", "data", "covers.js")
SRC_EXT = (".jpg", ".jpeg", ".jfif", ".png")

# Largeurs utiles, deduites des tailles d'affichage reelles :
#   120 -> vignettes du carrousel (46 px) + extraction de couleur
#   240 -> cartes du catalogue sur mobile
#   480 -> cartes en 230 px sur ecran 2x
#   720 -> couverture de la fiche serie / spotlight en 2x
WIDTHS = (120, 240, 480, 720)
QUALITY = 82


def human(n):
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024 or unit == "Go":
            return f"{n:.1f} {unit}"
        n /= 1024


def slug(name):
    """Nom de fichier sans espace ni accent : indispensable, un srcset separe
    ses entrees par des espaces."""
    out = (name.replace("'", "").replace("&", "et"))
    out = re.sub(r"[^A-Za-z0-9._-]+", "-", out)
    return re.sub(r"-{2,}", "-", out).strip("-")


def sources():
    if not os.path.isdir(SRC_DIR):
        return []
    return sorted(
        f for f in os.listdir(SRC_DIR)
        if f.lower().endswith(SRC_EXT) and os.path.isfile(os.path.join(SRC_DIR, f))
    )


def build_one(fname, force):
    src = os.path.join(SRC_DIR, fname)
    stem = slug(os.path.splitext(fname)[0])
    made, saved_from, saved_to = [], 0, 0

    with Image.open(src) as im:
        ow, oh = im.size
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        # Jamais d'agrandissement. Si l'original est plus petit que la plus
        # grande largeur voulue, on ajoute une variante a sa taille native :
        # sinon une couverture de 460 px n'aurait que du 240 px pour un
        # affichage en 330 px (spotlight), et paraitrait floue.
        targets = [w for w in WIDTHS if w <= ow]
        if ow < max(WIDTHS) and ow not in targets:
            targets.append(ow)
        for w in targets:
            dst = os.path.join(OUT_DIR, f"{stem}-{w}.webp")
            if (not force) and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
                made.append(w)
                continue
            h = max(1, round(oh * w / ow))
            im.resize((w, h), Image.LANCZOS).save(
                dst, "WEBP", quality=QUALITY, method=6
            )
            made.append(w)
            saved_to += os.path.getsize(dst)
        # Aucune variante (couverture minuscule) : on laissera l'original.
        if not made:
            return None, 0, 0

    saved_from = os.path.getsize(src)
    return {
        "base": f"images/Cover/rs/{stem}",
        "w": made,
        "width": ow,
        "height": oh,
    }, saved_from, saved_to


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--force", action="store_true", help="regenerer meme si a jour")
    args = ap.parse_args()

    files = sources()
    if not files:
        sys.stderr.write(f"Aucune couverture dans {SRC_DIR}\n")
        return 1
    os.makedirs(OUT_DIR, exist_ok=True)

    manifest, tot_src, tot_out = {}, 0, 0
    print(f"=== Couvertures : {len(files)} fichier(s) ===")
    for f in files:
        try:
            entry, s_from, s_to = build_one(f, args.force)
        except Exception as e:                                    # noqa: BLE001
            sys.stderr.write(f"  ERREUR {f} : {e}\n")
            continue
        if not entry:
            print(f"  {f} : trop petite, laissee telle quelle")
            continue
        manifest[f"images/Cover/{f}"] = entry
        tot_src += s_from
        tot_out += s_to
        print(f"  {f} : {entry['width']}x{entry['height']} -> {entry['w']}")

    lines = [
        "// Genere automatiquement par tools/build-covers.py - NE PAS EDITER A LA MAIN",
        "// Variantes responsives des couvertures. Une couverture absente de ce",
        "// manifeste est simplement servie dans sa version d'origine.",
        "window.COVERS = {",
    ]
    for k in sorted(manifest):
        lines.append(f"  {json.dumps(k, ensure_ascii=False)}: {json.dumps(manifest[k], ensure_ascii=False)},")
    lines.append("};")
    with open(MANIFEST, "w", encoding="utf-8", newline="\n") as fh:
        fh.write("\n".join(lines) + "\n")

    print(f"\n{len(manifest)} couverture(s) dans js/data/covers.js")
    if tot_out:
        print(f"Variantes generees : {human(tot_out)} (originaux conserves : {human(tot_src)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
