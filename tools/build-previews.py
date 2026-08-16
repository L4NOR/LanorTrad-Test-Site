#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Generateur de vignettes d'apercu (premiere page de chaque chapitre).

Pour chaque chapitre (et chaque oneshot), fabrique une petite image WebP a
partir de la PAGE 1, rangee EXACTEMENT comme le chapitre d'origine :

    Manga/Tougen Anki/Chapitres/Chapitre 166/001.webp
        -> Manga/preview/Tougen Anki/Chapitre 166/001.webp   (~35 Ko)

    Manga/Countdown/Oneshot/001.webp
        -> Manga/preview/Countdown/Oneshot/001.webp

Un dossier par chapitre, une page par dossier : on retrouve la meme
arborescence que dans la serie, en 35 fois plus leger.

Pourquoi ne pas afficher la page d'origine : elle pese 1,2 Mo en moyenne
(jusqu'a 8,9 Mo). Impossible a charger au survol d'une liste de chapitres.
La conversion ne touche JAMAIS aux pages originales (lecture seule) et
n'applique aucune correction de tons : simple redimensionnement.

Usage :
    py tools/build-previews.py                    # toutes les series
    py tools/build-previews.py "Tougen Anki"      # une serie
    py tools/build-previews.py --force            # regenere tout
    py tools/build-previews.py --no-prune         # garde les vignettes orphelines

Appele automatiquement par tools/build-data.py : les nouveaux chapitres ont
donc leur apercu sans manipulation supplementaire.
"""
import os, re, sys, shutil, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANGA_DIR = os.path.join(ROOT, "Manga")
PREVIEW_NAME = "preview"                      # Manga/preview/<Serie>/<Chapitre>/
OUT_DIR = os.path.join(MANGA_DIR, PREVIEW_NAME)

IMG_EXT = (".webp", ".jpg", ".jpeg", ".png")
NUM_RE = re.compile(r"(\d+(?:\.\d+)?)")

WIDTH = 360          # largeur de la vignette (affichee ~200 px => net en retina)
MAX_RATIO = 1.7      # au-dela (webtoon en bande), on garde le HAUT de la page
QUALITY = 68         # ~35 Ko par apercu : lisible, et 35x plus leger que la page
METHOD = 6           # effort de compression WebP (0 rapide .. 6 meilleur)


def is_series_dir(name):
    """Le dossier des apercus n'est pas une serie."""
    return name.lower() != PREVIEW_NAME


def fmt_num(n):
    """138.0 -> '138' ; 138.5 -> '138.5'"""
    return str(int(n)) if n == int(n) else ("%g" % n)


def num_of(folder_name):
    """'Chapitre 138.5' -> '138.5' ; '10' -> '10' ; 'Oneshot' -> '1'"""
    m = NUM_RE.search(folder_name)
    return fmt_num(float(m.group(1))) if m else "1"


def images_in(dirpath):
    """Meme logique que build-data.py : un .webp masque le .jpg de meme nom."""
    chosen = {}
    for f in os.listdir(dirpath):
        if not f.lower().endswith(IMG_EXT):
            continue
        base = os.path.splitext(f)[0]
        if base not in chosen or f.lower().endswith(".webp"):
            chosen[base] = f
    return sorted(chosen.values())


def chapter_dirs(series_path):
    """[(num, nom_du_dossier, dossier_absolu)] pour une serie ou un oneshot."""
    out = []
    chap_root = os.path.join(series_path, "Chapitres")
    if os.path.isdir(chap_root):
        for entry in sorted(os.listdir(chap_root)):
            cdir = os.path.join(chap_root, entry)
            if os.path.isdir(cdir) and NUM_RE.search(entry):
                out.append((num_of(entry), entry, cdir))
    else:
        one = os.path.join(series_path, "Oneshot")
        if os.path.isdir(one):
            out.append(("1", "Oneshot", one))
    return out


def web_path(serie, folder, filename):
    """Chemin tel qu'utilise par le site (toujours des slashs)."""
    return "/".join(["Manga", PREVIEW_NAME, serie, folder, filename])


def make_thumb(src, dst, force=False):
    """Retourne 'ok' | 'skip' | 'error'."""
    if (not force) and os.path.exists(dst) and os.path.getmtime(dst) >= os.path.getmtime(src):
        return "skip"
    try:
        from PIL import Image
        with Image.open(src) as im:
            if im.mode not in ("RGB", "L"):
                im = im.convert("RGB")
            w, h = im.size
            # Bande verticale (webtoon) : on ne garde que le haut de la planche,
            # sinon la vignette devient un fil illisible.
            if h > w * MAX_RATIO:
                im = im.crop((0, 0, w, int(w * MAX_RATIO)))
                h = int(w * MAX_RATIO)
            if w > WIDTH:
                im = im.resize((WIDTH, max(1, round(h * WIDTH / w))), Image.LANCZOS)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            im.save(dst, "WEBP", quality=QUALITY, method=METHOD)
        return "ok"
    except Exception as e:                       # noqa: BLE001
        sys.stderr.write("  ERREUR %s : %s\n" % (src, e))
        return "error"


def build(series=None, force=False, prune=True, quiet=False):
    """Genere les vignettes manquantes. Retourne {serie: {num: chemin_web}}."""
    index = {}
    if not os.path.isdir(MANGA_DIR):
        return index
    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        sys.stderr.write("Pillow absent : apercus non generes "
                         "(py -m pip install pillow)\n")
        return collect_existing()

    done = skipped = errors = 0
    names = series or sorted(os.listdir(MANGA_DIR))
    for serie in names:
        spath = os.path.join(MANGA_DIR, serie)
        if not os.path.isdir(spath) or not is_series_dir(serie):
            continue
        got, keep = {}, set()
        for num, folder, cdir in chapter_dirs(spath):
            pages = images_in(cdir)
            if not pages:
                continue
            dst = os.path.join(OUT_DIR, serie, folder, pages[0])
            st = make_thumb(os.path.join(cdir, pages[0]), dst, force)
            if st == "ok":
                done += 1
            elif st == "skip":
                skipped += 1
            else:
                errors += 1
                continue
            keep.add((folder, pages[0]))
            got[num] = web_path(serie, folder, pages[0])
        if prune:
            prune_orphans(serie, keep)
        if got:
            index[serie] = got
            if not quiet:
                print("  [apercus] %s : %d chapitre(s)" % (serie, len(got)))
    if not quiet:
        print("  [apercus] %d creee(s), %d deja a jour, %d erreur(s)"
              % (done, skipped, errors))
    return index


def prune_orphans(serie, keep):
    """Supprime les dossiers/pages d'apercu qui n'ont plus de chapitre en face.
    `keep` = {(nom_du_dossier, nom_du_fichier)} a conserver."""
    sdir = os.path.join(OUT_DIR, serie)
    if not os.path.isdir(sdir):
        return
    folders = {f for f, _ in keep}
    for folder in os.listdir(sdir):
        fpath = os.path.join(sdir, folder)
        if not os.path.isdir(fpath):
            continue
        if folder not in folders:                       # chapitre supprime
            shutil.rmtree(fpath, ignore_errors=True)
            continue
        for f in os.listdir(fpath):                     # page 1 renommee
            if (folder, f) not in keep:
                try:
                    os.remove(os.path.join(fpath, f))
                except OSError:
                    pass


def collect_existing():
    """Index des vignettes deja presentes sur le disque (sans rien generer).
    Sert de repli quand Pillow manque : le site garde ses apercus existants."""
    index = {}
    if not os.path.isdir(OUT_DIR):
        return index
    for serie in sorted(os.listdir(OUT_DIR)):
        sdir = os.path.join(OUT_DIR, serie)
        if not os.path.isdir(sdir):
            continue
        got = {}
        for folder in sorted(os.listdir(sdir)):
            fpath = os.path.join(sdir, folder)
            if not os.path.isdir(fpath):
                continue
            imgs = images_in(fpath)
            if imgs:
                got[num_of(folder)] = web_path(serie, folder, imgs[0])
        if got:
            index[serie] = got
    return index


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("series", nargs="*", help="serie(s) a traiter (defaut : toutes)")
    ap.add_argument("--force", action="store_true", help="regenere meme si a jour")
    ap.add_argument("--no-prune", action="store_true",
                    help="conserve les vignettes de chapitres supprimes")
    args = ap.parse_args()
    idx = build(args.series or None, args.force, not args.no_prune)
    total = sum(len(v) for v in idx.values())
    print("OK -> Manga/%s (%d serie(s), %d apercu(s))" % (PREVIEW_NAME, len(idx), total))


if __name__ == "__main__":
    main()
