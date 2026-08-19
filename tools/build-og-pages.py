#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Vignettes de partage 1200x630 pour les pages du site.

tools/build-og.py fabrique une carte par SERIE. Toutes les autres pages -
accueil, catalogue, planning, forum, classement, bibliotheque, equipe, pages
legales - partageaient la meme image generique (images/og/lanortrad.jpg), et
les vues par genre aussi. Sur Discord, ou passe l'essentiel de nos partages,
un lien vers le planning et un lien vers le forum se ressemblaient donc trait
pour trait.

Ici, chaque page a sa carte : meme charte que les cartes de serie (fond tire
des couvertures, titre, sous-titre, signature), avec deux differences
assumees :
  - un eventail de couvertures a la place de la couverture unique, puisque ces
    pages parlent du site entier ou d'un genre ;
  - le filet du bas reprend le DEGRADE du site (indigo -> violet -> magenta)
    au lieu de la couleur d'une serie.

Les textes ne sont pas inventes : le sous-titre est la <meta name="description">
reelle de la page, et les chiffres sont comptes dans og-meta.json.

Prerequis : og-meta.json a jour  ->  node scripts/build-seo.js
Usage :
    py tools/build-og-pages.py             # ce qui manque ou a change
    py tools/build-og-pages.py --force     # tout regenerer
"""
import os
import re
import sys
import json
import argparse
import importlib.util

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, "og-meta.json")
OUT_PAGES = os.path.join(ROOT, "images", "og", "pages")
OUT_GENRES = os.path.join(ROOT, "images", "og", "genres")

# On reutilise le moteur des cartes de serie (polices du site, decoupe de
# texte, coins arrondis) : deux dessins differents ne feraient pas une charte.
_spec = importlib.util.spec_from_file_location(
    "build_og", os.path.join(os.path.dirname(os.path.abspath(__file__)), "build-og.py"))
og = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(og)

W, H, PAD, BG, QUALITY = og.W, og.H, og.PAD, og.BG, og.QUALITY

# Degrade du site (css/base.css : --grad)
GRAD = [(99, 102, 241), (168, 85, 247), (217, 70, 239)]
VIOLET = (168, 85, 247)

# Etiquettes internes : ce ne sont pas des genres (meme liste que js/core.js
# et scripts/build-seo.js).
INTERNES = {"Collaboration"}

# Les pages du site. `fichier` sert a lire la vraie description de la page ;
# `eventail` dit si la carte montre des couvertures.
PAGES = [
    # Le titre de l'accueil reprend l'accroche du heros, pas le nom du site :
    # « LanorTrad » est deja signe en bas a droite de chaque carte.
    ("accueil",           "index.html",              "SCANTRAD FRANÇAIS · LECTURE GRATUITE", "Tes mangas, traduits en français", True),
    ("catalogue",         "catalogue.html",          "TOUT CE QU'ON TRADUIT",  "Catalogue",   True),
    ("planning",          "planning.html",           "LES PROCHAINES SORTIES", "Planning",    True),
    ("forum",             "forum.html",              "LA COMMUNAUTÉ",          "Forum",       True),
    ("classement",        "classement.html",         "LA COMMUNAUTÉ",          "Classement",  True),
    ("bibliotheque",      "bibliotheque.html",       "TA LECTURE",             "Bibliothèque", True),
    ("equipe",            "equipe.html",             "QUI FAIT QUOI",          "L'équipe",    True),
    ("mentions-legales",  "mentions-legales.html",   "INFORMATIONS",           "Mentions légales", False),
    ("confidentialite",   "confidentialite.html",    "TES DONNÉES",            "Confidentialité",  False),
]


def description(fichier):
    """La <meta name="description"> reelle de la page : le texte de la carte
    est donc celui que la page promet, pas une phrase ecrite pour l'occasion."""
    try:
        with open(os.path.join(ROOT, fichier), encoding="utf-8") as f:
            html = f.read()
    except OSError:
        return ""
    m = re.search(r'<meta name="description" content="([^"]*)"', html)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def charger_couverture(rel):
    chemin = os.path.join(ROOT, (rel or "").replace("/", os.sep))
    if not rel or not os.path.exists(chemin):
        return None
    try:
        return Image.open(chemin).convert("RGB")
    except Exception:                                            # noqa: BLE001
        return None


def fond(couvertures):
    """Meme principe que les cartes de serie : les couvertures agrandies et
    floutees, assombries, plus un voile degrade vers le noir du site. La carte
    ressemble donc au site du jour, sans image a maintenir a la main."""
    bg = Image.new("RGB", (W, H), BG)
    if couvertures:
        bande = Image.new("RGB", (W, H), BG)
        n = min(3, len(couvertures))
        largeur = W // n + 40
        for i, c in enumerate(couvertures[:n]):
            echelle = max(largeur / c.width, H / c.height)
            gros = c.resize((max(1, round(c.width * echelle)), max(1, round(c.height * echelle))),
                            Image.LANCZOS)
            gauche = (gros.width - largeur) // 2
            haut = (gros.height - H) // 3
            bande.paste(gros.crop((gauche, haut, gauche + largeur, haut + H)), (i * (W // n), 0))
        bg = bande.filter(ImageFilter.GaussianBlur(42))
        bg = Image.blend(bg, Image.new("RGB", (W, H), BG), 0.66)

    else:
        # Pages sans couverture (mentions legales, confidentialite) : un fond
        # nu ressemblerait a une carte ratee. Un halo aux couleurs du site
        # suffit a la rattacher a la charte, sans rien raconter de faux.
        halo = Image.new("RGB", (W, H), BG)
        hd = ImageDraw.Draw(halo)
        hd.ellipse([W - 620, -320, W + 220, 400], fill=(58, 32, 104))
        hd.ellipse([W - 340, 180, W + 260, 760], fill=(78, 26, 96))
        bg = Image.blend(bg, halo.filter(ImageFilter.GaussianBlur(180)), 0.9)

    voile = Image.new("L", (W, 1))
    for x in range(W):
        voile.putpixel((x, 0), int(214 - 118 * (x / W)))
    voile = voile.resize((W, H))
    bg = Image.composite(Image.new("RGB", (W, H), BG), bg, voile.point(lambda v: 255 - v))

    # Filet du bas : le degrade du site, et non la couleur d'une serie.
    d = ImageDraw.Draw(bg)
    for x in range(W):
        t = x / (W - 1)
        if t < 0.5:
            a, b, k = GRAD[0], GRAD[1], t / 0.5
        else:
            a, b, k = GRAD[1], GRAD[2], (t - 0.5) / 0.5
        d.line([(x, H - 8), (x, H)], fill=tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3)))
    return bg


def eventail(carte, couvertures, x, hauteur=372, largeur_max=470):
    """Trois couvertures en eventail, comme le heros de l'accueil. Renvoie la
    largeur occupee, pour que le texte se cale juste apres.

    L'eventail est ramene a `largeur_max` quand les couvertures sont larges :
    sans ca, un format inhabituel rognait la colonne de texte et le sous-titre
    finissait tronque."""
    if not couvertures:
        return 0

    def pas(c, h):
        return max(104, round((c.width * h / c.height) * 0.46))

    total = sum(pas(c, hauteur) for c in couvertures[:3][:-1])
    total += max(1, round(couvertures[:3][-1].width * hauteur / couvertures[:3][-1].height))
    if total > largeur_max:
        hauteur = max(240, round(hauteur * largeur_max / total))
    # Le decalage suit la LARGEUR reelle de chaque couverture, et non un pas
    # fixe : les couvertures n'ont pas toutes le meme format, et un pas fixe
    # faisait disparaitre completement la premiere sous les suivantes.
    poses = [(-8, 34), (-2, 12), (5, 0)][:len(couvertures)]
    y0 = (H - hauteur) // 2 - 16
    fin = 0
    dx = 0
    for c, (angle, dy) in zip(couvertures[:3], poses):
        largeur = max(1, round(c.width * hauteur / c.height))
        vignette = og.rounded(c.resize((largeur, hauteur), Image.LANCZOS), 16)

        ombre = Image.new("RGBA", (largeur + 60, hauteur + 60), (0, 0, 0, 0))
        ImageDraw.Draw(ombre).rounded_rectangle(
            [30, 34, largeur + 30, hauteur + 34], radius=16, fill=(0, 0, 0, 165))
        ombre = ombre.filter(ImageFilter.GaussianBlur(18))

        tourne = vignette.rotate(angle, expand=True, resample=Image.BICUBIC)
        ombre = ombre.rotate(angle, expand=True, resample=Image.BICUBIC)

        px, py = x + dx, y0 + dy
        carte.paste(ombre, (px - 30, py - 30), ombre)
        carte.paste(tourne, (px, py), tourne)
        fin = max(fin, px + tourne.width)
        dx += max(104, round(largeur * 0.46))     # ce qui restera visible
    return fin - x


def carte(eyebrow, titre, sous_titre, chiffres, couvertures):
    img = fond(couvertures)
    d = ImageDraw.Draw(img)

    x = PAD
    if couvertures:
        x += eventail(img, couvertures, PAD) + 54
    tw = W - x - PAD

    d.text((x, 116), eyebrow, font=og.font("strong", 24), fill=VIOLET)

    f_titre, lignes = og.fit_font(d, titre, "title", tw, 2, 72, 34)
    y = 160
    for ln in lignes:
        d.text((x, y), ln, font=f_titre, fill=(255, 255, 255))
        y += f_titre.size + 10

    if sous_titre:
        f_s = og.font("body", 25)
        y += 8
        for ln in og.wrap(d, sous_titre, f_s, tw, 3):
            d.text((x, y), ln, font=f_s, fill=(198, 198, 214))
            y += 36

    if chiffres:
        d.text((x, min(y + 12, H - 132)), chiffres, font=og.font("strong", 26), fill=(233, 233, 244))

    f_sig = og.font("title", 34)
    d.text((W - PAD - og.text_w(d, "LanorTrad", f_sig), H - PAD - 44), "LanorTrad",
           font=f_sig, fill=(255, 255, 255))
    return img


def a_jour(dst, refs):
    if not os.path.exists(dst):
        return False
    ref = [os.path.getmtime(__file__), os.path.getmtime(og.__file__)]
    ref += [os.path.getmtime(p) for p in refs if os.path.exists(p)]
    return os.path.getmtime(dst) >= max(ref)


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--force", action="store_true", help="regenerer meme si a jour")
    args = ap.parse_args()

    try:
        with open(META, encoding="utf-8") as f:
            meta = json.load(f)
    except OSError:
        sys.stderr.write("og-meta.json introuvable. Lance d'abord : node scripts/build-seo.js\n")
        return 1

    os.makedirs(OUT_PAGES, exist_ok=True)
    os.makedirs(OUT_GENRES, exist_ok=True)

    # Chiffres reels du site (jamais de nombre invente sur une carte).
    series = sorted(meta.items(), key=lambda kv: str(kv[1].get("updated") or ""), reverse=True)
    n_series = len(series)
    n_chap = sum(len(s.get("chapters") or []) for _, s in series)
    resume = f"{n_series} séries  ·  {n_chap} chapitres  ·  lecture gratuite"

    # Couvertures du site, les plus recemment mises a jour d'abord, les series
    # mises en avant en tete. Chaque page en prend un trio DIFFERENT : sinon
    # sept cartes identiques au titre pres se suivraient dans un fil Discord,
    # ce qui est precisement le probleme qu'on corrige ici.
    ordre = [s for _, s in series if s.get("featured")] + [s for _, s in series if not s.get("featured")]
    toutes = [c for c in (charger_couverture(s.get("cover")) for s in ordre) if c]

    def trio(i):
        if not toutes:
            return []
        d = (i * 3) % len(toutes)
        return [toutes[(d + k) % len(toutes)] for k in range(min(3, len(toutes)))]

    faits = sautes = 0

    print(f"=== Cartes de partage : {len(PAGES)} page(s) ===")
    for i, (nom, fichier, eyebrow, titre, avec_couvertures) in enumerate(PAGES):
        dst = os.path.join(OUT_PAGES, nom + ".jpg")
        refs = [os.path.join(ROOT, fichier), META]
        if not args.force and a_jour(dst, refs):
            sautes += 1
            continue
        img = carte(eyebrow, titre, description(fichier),
                    resume if avec_couvertures else "",
                    trio(i) if avec_couvertures else [])
        img.convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        faits += 1
        print(f"  {fichier} -> images/og/pages/{nom}.jpg ({os.path.getsize(dst) // 1024} Ko)")

    # --- Genres : une carte par genre reellement present dans les donnees.
    #     Toutes, pas seulement celles du sitemap : l'edge function fabrique une
    #     page pour n'importe quel genre existant, et une carte manquante donne
    #     un partage casse.
    par_genre = {}
    for sid, s in series:
        for g in s.get("genres") or []:
            if g not in INTERNES:
                par_genre.setdefault(g, []).append(s)

    print(f"\n=== Cartes de partage : {len(par_genre)} genre(s) ===")
    gardes = set()
    for g, liste in sorted(par_genre.items()):
        nom = og.slug(g) + ".jpg"
        gardes.add(nom)
        dst = os.path.join(OUT_GENRES, nom)
        if not args.force and a_jour(dst, [META]):
            sautes += 1
            continue
        couvs = [c for c in (charger_couverture(s.get("cover")) for s in liste[:3]) if c]
        n = len(liste)
        titres = ", ".join(s.get("title", "") for s in liste[:4])
        pluriel = "s" if n > 1 else ""
        img = carte(
            "MANGA " + g.upper(),
            g,
            f"{n} série{pluriel} de manga {g.lower()} traduite{pluriel} "
            f"en français par LanorTrad : {titres}.",
            f"{n} série{pluriel}  ·  lecture gratuite",
            couvs)
        img.convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        faits += 1
        print(f"  {g} -> images/og/genres/{nom} ({os.path.getsize(dst) // 1024} Ko)")

    # Genre disparu du catalogue : sa carte n'a plus lieu d'etre.
    for f in os.listdir(OUT_GENRES):
        if f.endswith(".jpg") and f not in gardes:
            os.remove(os.path.join(OUT_GENRES, f))
            print(f"  [nettoyage] {f} retire (genre disparu)")

    print(f"\n{faits} carte(s) generee(s), {sautes} deja a jour.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
