#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Convertisseur JPG -> WebP (serie par serie).

Convertit recursivement tous les .jpg/.jpeg/.jfif d'un dossier en .webp
(place a cote de l'original, meme nom). NE SUPPRIME PAS les JPG : la
suppression se fait a la toute fin, une fois le code bascule sur .webp
et le rendu verifie.

Usage :
    py tools/jpg-to-webp.py "Manga/Ao No Exorcist"      # une serie (lossless)
    py tools/jpg-to-webp.py "Manga/Ao No Exorcist" "Manga/Catenaccio"
    py tools/jpg-to-webp.py --list                       # liste les series
    py tools/jpg-to-webp.py "Manga/Tougen Anki" --quality 95   # lossy si besoin

Options :
    --quality N    bascule en WebP LOSSY qualite N (ex: 95, plus leger).
                   SANS cette option : WebP LOSSLESS (defaut) — pixels
                   strictement identiques au JPG decode (trames, contours
                   noirs, texte), sans sous-echantillonnage chroma.
                   Aucun redimensionnement / reechantillonnage, jamais.
    --force        reconvertit meme si le .webp existe deja et est a jour
    --enhance      nettete legere du trait/texte (unsharp mask doux).
                   AUCUNE correction de tons : une premiere version appliquait
                   des niveaux automatiques, retiree car elle detruisait les
                   gris doux volontaires des planches. La conversion reste
                   fidele aux couleurs d'origine dans tous les cas.
    --delete-src   supprime le JPG source apres conversion reussie
                   (utilise par tools/upload-server.js)
    --include-png  convertit aussi les .png trouves
"""
import os, sys, time, argparse
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_EXT = (".jpg", ".jpeg", ".jfif")
PNG_EXT = (".png",)
WEBP_MAX = 16383          # dimension max supportee par WebP
METHOD = 6                # 0=rapide .. 6=meilleure compression (plus lent)


def human(n):
    for unit in ("o", "Ko", "Mo", "Go"):
        if n < 1024 or unit == "Go":
            return f"{n:.1f} {unit}"
        n /= 1024


def find_sources(path, exts=SRC_EXT):
    if os.path.isfile(path):
        return [path] if path.lower().endswith(exts) else []
    out = []
    for dirpath, _dirs, files in os.walk(path):
        for f in files:
            if f.lower().endswith(exts):
                out.append(os.path.join(dirpath, f))
    return sorted(out)


def enhance_image(im):
    """Nettete legere du trait et du texte, rien d'autre.
    PAS de correction de tons/niveaux : les gris doux d'une planche sont un
    choix artistique, pas un defaut de scan (lecon apprise sur Tougen Anki).
    Threshold eleve pour ne pas amplifier le grain des trames."""
    return im.filter(ImageFilter.UnsharpMask(radius=1.0, percent=40, threshold=3))


def convert_one(src, quality, force, enhance=False, delete_src=False):
    """Retourne (statut, octets_src, octets_webp).
    statut : 'ok' | 'skip' | 'toobig' | 'error'"""
    dst = os.path.splitext(src)[0] + ".webp"
    src_size = os.path.getsize(src)
    if (not force) and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        if delete_src:
            try:
                os.remove(src)
            except OSError:
                pass
        return ("skip", src_size, os.path.getsize(dst))
    try:
        with Image.open(src) as im:
            if max(im.size) > WEBP_MAX:
                return ("toobig", src_size, 0)
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            if enhance:
                im = enhance_image(im)
            # Metadonnees utiles du source (profil couleur, EXIF) conservees
            meta = {k: im.info[k] for k in ("icc_profile", "exif") if im.info.get(k)}
            if quality is None:
                # Lossless : 'quality' ne degrade rien, c'est l'effort de compression
                im.save(dst, "WEBP", lossless=True, quality=100, method=METHOD, **meta)
            else:
                im.save(dst, "WEBP", quality=quality, method=METHOD, **meta)
        if delete_src:
            try:
                os.remove(src)
            except OSError:
                pass
        return ("ok", src_size, os.path.getsize(dst))
    except Exception as e:                      # noqa: BLE001
        sys.stderr.write(f"  ERREUR {src} : {e}\n")
        return ("error", src_size, 0)


def process(path, quality, force, enhance=False, delete_src=False, exts=SRC_EXT):
    srcs = find_sources(path, exts)
    if not srcs:
        print(f"  (aucune image a convertir dans {path})")
        return
    print(f"\n=== {path} : {len(srcs)} image(s) ===")
    t0 = time.time()
    done = skipped = errors = toobig = 0
    tot_src = tot_webp = 0            # totaux sur les images REELLEMENT converties
    toobig_files = []
    for i, src in enumerate(srcs, 1):
        status, ss, ws = convert_one(src, quality, force, enhance, delete_src)
        if status == "ok":
            done += 1; tot_src += ss; tot_webp += ws
        elif status == "skip":
            skipped += 1
        elif status == "toobig":
            toobig += 1; toobig_files.append(src)
        else:
            errors += 1
        if i % 100 == 0 or i == len(srcs):
            print(f"  {i}/{len(srcs)}  (converties {done}, ignorees {skipped})", flush=True)
    dt = time.time() - t0
    print(f"--- Termine en {dt:.0f}s : {done} converties, {skipped} deja a jour, "
          f"{toobig} trop grandes, {errors} erreurs")
    if enhance and done:
        print(f"    Nettete legere appliquee sur {done} page(s) (tons inchanges)")
    if tot_src:
        delta = tot_webp / tot_src - 1          # peut etre positif en lossless
        sign = "+" if delta >= 0 else "-"
        print(f"    Poids (converties) : {human(tot_src)} -> {human(tot_webp)}  "
              f"({sign}{abs(delta)*100:.1f} %)")
    for f in toobig_files:
        print(f"    ! trop grande, laissee en JPG : {f}")


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("paths", nargs="*", help="dossier(s) a convertir (ex: 'Manga/Catenaccio')")
    ap.add_argument("--quality", type=int, default=None,
                    help="bascule en lossy qualite N (defaut : lossless)")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--enhance", action="store_true",
                    help="nettete legere du trait/texte (aucune correction de tons)")
    ap.add_argument("--delete-src", action="store_true",
                    help="supprime le fichier source apres conversion reussie")
    ap.add_argument("--include-png", action="store_true",
                    help="convertit aussi les .png")
    ap.add_argument("--list", action="store_true", help="liste les series dans Manga/")
    args = ap.parse_args()

    if args.list or not args.paths:
        mdir = os.path.join(ROOT, "Manga")
        print("Series dans Manga/ :")
        for s in sorted(os.listdir(mdir)):
            if os.path.isdir(os.path.join(mdir, s)):
                print(f"  Manga/{s}")
        if not args.paths:
            print("\nUsage : py tools/jpg-to-webp.py \"Manga/<Serie>\"")
        return

    exts = SRC_EXT + (PNG_EXT if args.include_png else ())
    for p in args.paths:
        full = p if os.path.isabs(p) else os.path.join(ROOT, p)
        process(full, args.quality, args.force, args.enhance, args.delete_src, exts)


if __name__ == "__main__":
    main()
