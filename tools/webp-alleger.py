#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Reencode les pages de chapitre en WebP AVEC PERTE (qualite 90).

POURQUOI
La migration vers WebP s'etait faite en SANS PERTE, par souci de fidelite. Sur
des scans deja compresses, le sans perte ne peut rien gagner : mesure sur 15
pages de 5 series, la page moyenne pesait 597 Ko en JPG d'origine et 1 078 Ko
apres migration. Le format a change, le poids a double.

A qualite 90, la meme page tombe a ~574 Ko : un chapitre de vingt pages passe
de ~22 Mo a ~11 Mo pour le lecteur. C'est le seul chiffre qui compte vraiment,
celui que paie quelqu'un qui lit en 4G.

CE QUE CE SCRIPT NE FAIT PAS
Aucune retouche : ni contraste, ni nettete, ni redimensionnement. Les
dimensions sont conservees au pixel pres. Seule la compression change.

FILET DE SECURITE
Les pages actuelles sont versionnees : `git checkout -- Manga/` les restaure
toutes. Chaque fichier est ecrit a cote puis remplace d'un bloc, donc une
interruption ne laisse jamais d'image tronquee.

USAGE
    py tools/webp-alleger.py --essai 40    # 40 pages dans un dossier a part
    py tools/webp-alleger.py               # tout, sur place
    py tools/webp-alleger.py --qualite 92
"""
import os
import sys
import time
import argparse
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANGA = os.path.join(ROOT, "Manga")


def est_sans_perte(chemin):
    """Vrai si le fichier WebP est en sans perte.

    On lit l'entete du conteneur RIFF plutot que de decoder l'image : le
    quatrieme chunk vaut VP8L pour du sans perte, VP8 (avec un espace) pour de
    l'avec perte. VP8X est un conteneur etendu, on regarde alors le drapeau
    ALPHA/anim — dans notre cas ce sont des pages simples, donc on reencode.
    """
    try:
        with open(chemin, "rb") as f:
            entete = f.read(16)
    except OSError:
        return False
    if len(entete) < 16 or entete[:4] != b"RIFF" or entete[8:12] != b"WEBP":
        return False
    return entete[12:16] in (b"VP8L", b"VP8X")


def pages():
    """Toutes les pages de chapitre, hors vignettes d'apercu."""
    apercu = os.path.join(MANGA, "preview")
    for dossier, _, fichiers in os.walk(MANGA):
        if dossier.lower().startswith(apercu.lower()):
            continue
        for f in fichiers:
            if f.lower().endswith(".webp"):
                yield os.path.join(dossier, f)


def convertir(travail):
    """Reencode une page. Renvoie (chemin, avant, apres, message d'erreur)."""
    chemin, qualite, destination = travail
    try:
        avant = os.path.getsize(chemin)
        with Image.open(chemin) as im:
            taille = im.size
            im = im.convert("RGB")
            cible = destination or chemin
            provisoire = cible + ".tmp"
            os.makedirs(os.path.dirname(cible), exist_ok=True)
            im.save(provisoire, "WEBP", quality=qualite, method=4)
        # Relecture : on ne remplace jamais une page par un fichier qu'on n'a
        # pas su rouvrir, ni par une image de dimensions differentes.
        with Image.open(provisoire) as verif:
            if verif.size != taille:
                os.remove(provisoire)
                return (chemin, avant, avant, "dimensions changees")
        apres = os.path.getsize(provisoire)
        os.replace(provisoire, cible)
        return (chemin, avant, apres, None)
    except Exception as e:                                       # noqa: BLE001
        return (chemin, 0, 0, str(e))


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--qualite", type=int, default=90, help="qualite WebP (defaut 90)")
    ap.add_argument("--essai", type=int, metavar="N",
                    help="convertir N pages dans tools/.essai-webp/ sans toucher au site")
    ap.add_argument("--jobs", type=int, default=max(1, (os.cpu_count() or 4) - 1))
    args = ap.parse_args()

    if not os.path.isdir(MANGA):
        sys.stderr.write("Dossier Manga/ introuvable.\n")
        return 1

    print("Inventaire des pages...", flush=True)
    toutes = list(pages())
    a_faire = [p for p in toutes if est_sans_perte(p)]
    deja = len(toutes) - len(a_faire)
    print(f"  {len(toutes)} pages, dont {deja} deja en avec perte")

    if args.essai:
        a_faire = a_faire[:args.essai]
        base = os.path.join(ROOT, "tools", ".essai-webp")
        travaux = [(p, args.qualite,
                    os.path.join(base, os.path.relpath(p, MANGA))) for p in a_faire]
        print(f"  ESSAI : {len(travaux)} pages ecrites dans tools/.essai-webp/")
    else:
        travaux = [(p, args.qualite, None) for p in a_faire]
        print(f"  {len(travaux)} pages a reencoder en qualite {args.qualite}, sur place")

    if not travaux:
        print("Rien a faire.")
        return 0

    debut = time.time()
    avant = apres = 0
    erreurs = []
    fait = 0
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for chemin, a, b, err in pool.map(convertir, travaux, chunksize=8):
            fait += 1
            if err:
                erreurs.append((chemin, err))
            else:
                avant += a
                apres += b
            if fait % 250 == 0 or fait == len(travaux):
                ecoule = time.time() - debut
                reste = (len(travaux) - fait) * ecoule / max(1, fait)
                print(f"  {fait}/{len(travaux)}  "
                      f"{avant/1073741824:.2f} -> {apres/1073741824:.2f} Go  "
                      f"({ecoule/60:.0f} min ecoulees, ~{reste/60:.0f} min restantes)",
                      flush=True)

    print()
    if avant:
        print(f"Avant : {avant/1073741824:.2f} Go")
        print(f"Apres : {apres/1073741824:.2f} Go  ({apres/avant*100:.0f} % du poids)")
    if erreurs:
        print(f"\n{len(erreurs)} page(s) en echec, laissees telles quelles :")
        for c, e in erreurs[:10]:
            print(f"  {os.path.relpath(c, ROOT)} : {e}")
    return 1 if erreurs else 0


if __name__ == "__main__":
    sys.exit(main())
