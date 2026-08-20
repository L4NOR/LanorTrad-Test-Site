#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Vignettes de partage 1200x630 pour les pages du site.

tools/build-og.py fabrique une carte par SERIE. Toutes les autres pages -
accueil, catalogue, planning, forum, classement, bibliotheque, equipe, pages
legales - partageaient la meme image generique, et les 17 vues par genre aussi.
Sur Discord, ou passe l'essentiel de nos partages, un lien vers le planning et
un lien vers le forum se ressemblaient donc trait pour trait.

Chaque page montre desormais une MAQUETTE de ce qu'elle contient (voir
tools/og-maquettes.py) : une discussion pour le forum, une semaine pour le
planning, une grille pour le catalogue, un tableau pour le classement, des
lectures en cours pour la bibliotheque, les membres pour l'equipe.

CE QUI EST VRAI SUR CES CARTES
Series, numeros de chapitres, jours de parution, categories du forum, membres
et roles de l'equipe, noms des rangs : tout vient des donnees du site.
Le sous-titre est la <meta name="description"> reelle de la page.
Sont illustratifs, et ne peuvent pas ne pas l'etre : les pseudos des lecteurs
(forum, classement) et l'avancement de lecture (bibliotheque), qui est propre a
chaque visiteur. Aucun de ces textes n'affirme quoi que ce soit sur l'equipe.

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
from datetime import date, datetime

from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICI = os.path.dirname(os.path.abspath(__file__))
META = os.path.join(ROOT, "og-meta.json")
OUT_PAGES = os.path.join(ROOT, "images", "og", "pages")
OUT_GENRES = os.path.join(ROOT, "images", "og", "genres")


def _module(fichier, nom):
    spec = importlib.util.spec_from_file_location(nom, os.path.join(ICI, fichier))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


# Le moteur des cartes de serie (polices du site, decoupe de texte, coins
# arrondis) : deux dessins differents ne feraient pas une charte.
og = _module("build-og.py", "build_og")
maq = _module("og-maquettes.py", "og_maquettes")

W, H, PAD, BG, QUALITY = og.W, og.H, og.PAD, og.BG, og.QUALITY

# Degrade du site (css/base.css : --grad)
GRAD = [(99, 102, 241), (168, 85, 247), (217, 70, 239)]
VIOLET = maq.VIOLET

# Etiquettes internes : ce ne sont pas des genres (meme liste que js/core.js
# et scripts/build-seo.js).
INTERNES = {"Collaboration"}

JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"]
ORDRE = [1, 2, 3, 4, 5, 6, 0]                       # Lundi -> Dimanche, comme js/planning.js
COURT = {"Lundi": "LUN", "Mardi": "MAR", "Mercredi": "MER", "Jeudi": "JEU",
         "Vendredi": "VEN", "Samedi": "SAM", "Dimanche": "DIM"}

PAGES = [
    # (nom de fichier, page HTML, sur-titre, titre, maquette)
    # Le titre de l'accueil reprend l'accroche du site, pas son nom :
    # « LanorTrad » est deja signe en bas a droite de chaque carte.
    ("accueil",          "index.html",            "SCANTRAD FRANÇAIS · LECTURE GRATUITE", "Tes mangas, traduits en français", "accueil"),
    ("catalogue",        "catalogue.html",        "TOUT CE QU'ON TRADUIT",  "Catalogue",       "catalogue"),
    ("planning",         "planning.html",         "LES PROCHAINES SORTIES", "Planning",        "planning"),
    ("forum",            "forum.html",            "LA COMMUNAUTÉ",          "Forum",           "forum"),
    ("classement",       "classement.html",       "LA COMMUNAUTÉ",          "Classement",      "classement"),
    ("bibliotheque",     "bibliotheque.html",     "TA LECTURE",             "Bibliothèque",    "bibliotheque"),
    ("equipe",           "equipe.html",           "QUI FAIT QUOI",          "L'équipe",        "equipe"),
    ("mentions-legales", "mentions-legales.html", "INFORMATIONS",           "Mentions légales", None),
    ("confidentialite",  "confidentialite.html",  "TES DONNÉES",            "Confidentialité",  None),
]


# =========================================================================
#  Lecture des donnees du site
# =========================================================================
def description(fichier):
    """La <meta name="description"> reelle de la page : le texte de la carte
    est celui que la page promet, pas une phrase ecrite pour l'occasion."""
    try:
        with open(os.path.join(ROOT, fichier), encoding="utf-8") as f:
            html = f.read()
    except OSError:
        return ""
    m = re.search(r'<meta name="description" content="([^"]*)"', html)
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else ""


def couverture(rel):
    chemin = os.path.join(ROOT, (rel or "").replace("/", os.sep))
    if not rel or not os.path.exists(chemin):
        return None
    try:
        return Image.open(chemin).convert("RGB")
    except Exception:                                            # noqa: BLE001
        return None


def membres_equipe():
    """Les membres reels, lus dans equipe.html : photo, role et premiere phrase
    de leur presentation. Rien n'est recopie a la main ici, pour qu'un
    changement sur la page se retrouve sur la carte."""
    try:
        with open(os.path.join(ROOT, "equipe.html"), encoding="utf-8") as f:
            html = f.read()
    except OSError:
        return []
    out = []
    for bloc in re.findall(r'<article class="tm".*?</article>', html, re.S):
        photo = re.search(r'<img src="([^"]+)"', bloc)
        role = re.search(r'<span class="role">([^<]+)</span>', bloc)
        nom = re.search(r"<h3>([^<]+)</h3>", bloc)
        para = re.search(r"<p>(.*?)</p>", bloc, re.S)
        if not (nom and role):
            continue
        phrase = re.sub(r"<[^>]+>", "", para.group(1)) if para else ""
        phrase = re.sub(r"\s+", " ", phrase).strip()
        # Une seule phrase : la carte n'est pas la page.
        coupe = re.split(r"(?<=[.!?]) ", phrase)
        out.append({
            "nom": nom.group(1).strip(),
            "role": role.group(1).strip(),
            "phrase": coupe[0] if coupe else "",
            "photo": couverture(photo.group(1)) if photo else None,
        })
    return out


def depuis(iso):
    """« il y a 3 j », « il y a 2 sem ». Jamais de date inventee : vide si on
    ne sait pas."""
    try:
        j = (date.today() - datetime.strptime(iso[:10], "%Y-%m-%d").date()).days
    except Exception:                                            # noqa: BLE001
        return ""
    if j <= 0:
        return "aujourd'hui"
    if j == 1:
        return "hier"
    if j < 7:
        return f"il y a {j} j"
    if j < 31:
        return f"il y a {j // 7} sem"
    return f"il y a {max(1, j // 30)} mois"


# =========================================================================
#  Fond commun (identique aux cartes de serie)
# =========================================================================
def fond(couvertures):
    """Les couvertures agrandies et floutees, assombries, plus un voile degrade
    vers le noir du site. La carte ressemble donc au site du jour, sans image a
    maintenir a la main."""
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
        bg = bande.filter(ImageFilter.GaussianBlur(46))
        bg = Image.blend(bg, Image.new("RGB", (W, H), BG), 0.74)
    else:
        # Pages sans couverture (mentions legales, confidentialite) : un fond nu
        # ressemblerait a une carte ratee. Un halo aux couleurs du site suffit a
        # la rattacher a la charte, sans rien raconter de faux.
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
        a, b, k = (GRAD[0], GRAD[1], t / 0.5) if t < 0.5 else (GRAD[1], GRAD[2], (t - 0.5) / 0.5)
        d.line([(x, H - 8), (x, H)], fill=tuple(round(a[i] + (b[i] - a[i]) * k) for i in range(3)))
    return bg


def carte(eyebrow, titre, sous_titre, couvertures, dessiner=None):
    """Fond + maquette a gauche + bloc de texte a droite + signature."""
    img = fond(couvertures)

    if dessiner:
        toile = maq.Toile(img, og)
        dessiner(toile)
        img = toile.rendu()
        x = maq.X + maq.LARGEUR + 44
    else:
        x = PAD

    d = ImageDraw.Draw(img)
    tw = W - x - PAD

    d.text((x, 128), eyebrow, font=og.font("strong", 21 if dessiner else 24), fill=VIOLET)

    f_titre, lignes = og.fit_font(d, titre, "title", tw, 2, 56 if dessiner else 72, 30)
    y = 168
    for ln in lignes:
        d.text((x, y), ln, font=f_titre, fill=(255, 255, 255))
        y += f_titre.size + 8

    if sous_titre:
        f_s = og.font("body", 22 if dessiner else 25)
        y += 10
        for ln in og.wrap(d, sous_titre, f_s, tw, 4 if dessiner else 3):
            d.text((x, y), ln, font=f_s, fill=(198, 198, 214))
            y += 32

    f_sig = og.font("title", 32)
    d.text((W - PAD - og.text_w(d, "LanorTrad", f_sig), H - PAD - 42), "LanorTrad",
           font=f_sig, fill=(255, 255, 255))
    return img


# =========================================================================
#  Donnees de chaque maquette
# =========================================================================
def maquettes(series, couvs):
    """Prepare, pour chaque page, ce que sa maquette doit montrer."""
    ordre = [s for _, s in series]
    cov = lambda s: couvs.get(id(s))                             # noqa: E731

    recentes = [s for s in ordre if couvs.get(id(s))]
    derniere = recentes[0] if recentes else None
    dernier_ch = (derniere or {}).get("chapters", [{}])[0].get("n", "")

    # --- Forum : categorie et sujet reels, echange illustratif ---
    d_forum = {
        "categorie": "Discussions",                              # supabase/schema.sql
        "sujet": f"{derniere['title']} — chapitre {dernier_ch}" if derniere else "Discussions",
        "messages": [
            {"qui": "Lanor", "badge": "Team",
             "texte": f"Le chapitre {dernier_ch} est en ligne. Bonne lecture !"},
            {"qui": "Miya", "texte": "Cette fin de chapitre… je ne m'y attendais pas."},
            {"qui": "Kenta", "texte": "Quelqu'un a une théorie sur la suite ?"},
        ],
    }

    # --- Planning : chaque serie en cours sur le jour de sa derniere sortie,
    #     exactement comme le fait js/planning.js ---
    par_jour = {}
    for s in ordre:
        # og-meta.json dit « serie » la ou series.js dit « manga » : c'est la
        # cle de og-meta qui fait foi ici.
        if s.get("type") != "serie" or "cours" not in (s.get("status") or "").lower():
            continue
        try:
            j = datetime.strptime((s.get("updated") or "")[:10], "%Y-%m-%d").date().isoweekday() % 7
        except Exception:                                        # noqa: BLE001
            j = 6
        par_jour.setdefault(j, []).append(s)
    aujourdhui = date.today().isoweekday() % 7
    d_planning = {
        "mention": "Jour de parution habituel",
        "jours": [{
            "nom": COURT[JOURS[j]],
            "aujourdhui": j == aujourdhui,
            "couvertures": [cov(s) for s in par_jour.get(j, []) if cov(s)],
        } for j in ORDRE],
    }

    # --- Accueil : la barre du site, des series, les vraies dernieres sorties ---
    d_accueil = {
        "couvertures": [cov(s) for s in recentes[:4]],
        "sorties": [{
            "couverture": cov(s),
            "titre": s["title"],
            "chapitre": f"Chapitre {(s.get('chapters') or [{}])[0].get('n', '')}",
            "quand": depuis(s.get("updated") or ""),
        } for s in recentes[:3]],
    }

    # --- Catalogue : la grille et sa barre de filtres ---
    d_catalogue = {
        "filtres": [("Tous les genres", True), ("En cours", False), ("Plus récents", False)],
        "couvertures": [cov(s) for s in recentes[:8]],
    }

    # --- Bibliotheque : l'avancement est propre a chaque lecteur, donc
    #     illustratif. Les series et leur nombre de chapitres, eux, sont vrais. ---
    en_cours = []
    for s, ratio in zip(recentes[:3], (0.53, 0.18, 0.86)):
        total = len(s.get("chapters") or []) or 1
        en_cours.append({
            "couverture": cov(s), "titre": s["title"], "ratio": ratio,
            "repere": f"Chapitre {max(1, round(total * ratio))} / {total}",
        })
    d_biblio = {"en_cours": en_cours, "suivis": [cov(s) for s in recentes[3:8]]}

    # --- Classement : les rangs sont ceux de la gamification (js/xp.js) ---
    d_classement = {
        "mention": "Cette semaine",
        "lignes": [
            {"qui": "Miya", "rang": "Aurore", "xp": "1 240 XP"},
            {"qui": "Kenta", "rang": "Brasier", "xp": "980 XP"},
            {"qui": "Sora", "rang": "Flamme", "xp": "760 XP"},
            {"qui": "Riku", "rang": "Lueur", "xp": "540 XP"},
        ],
    }

    d_equipe = {"membres": membres_equipe()}

    return {
        "accueil": lambda t: maq.accueil(t, d_accueil),
        "catalogue": lambda t: maq.catalogue(t, d_catalogue),
        "planning": lambda t: maq.planning(t, d_planning),
        "forum": lambda t: maq.forum(t, d_forum),
        "classement": lambda t: maq.classement(t, d_classement),
        "bibliotheque": lambda t: maq.bibliotheque(t, d_biblio),
        "equipe": lambda t: maq.equipe(t, d_equipe),
    }


def a_jour(dst, refs):
    if not os.path.exists(dst):
        return False
    ref = [os.path.getmtime(__file__), os.path.getmtime(og.__file__),
           os.path.join(ICI, "og-maquettes.py")]
    ref = [r if isinstance(r, float) else os.path.getmtime(r) for r in ref]
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

    # Les series, les plus recemment mises a jour d'abord, mises en avant en tete.
    series = sorted(meta.items(), key=lambda kv: str(kv[1].get("updated") or ""), reverse=True)
    series = ([kv for kv in series if kv[1].get("featured")]
              + [kv for kv in series if not kv[1].get("featured")])
    couvs = {}
    for _, s in series:
        c = couverture(s.get("cover"))
        if c is not None:
            couvs[id(s)] = c
    toutes = [couvs[id(s)] for _, s in series if id(s) in couvs]

    dessins = maquettes(series, couvs)
    faits = sautes = 0

    print(f"=== Cartes de partage : {len(PAGES)} page(s) ===")
    for i, (nom, fichier, eyebrow, titre, maquette) in enumerate(PAGES):
        dst = os.path.join(OUT_PAGES, nom + ".jpg")
        if not args.force and a_jour(dst, [os.path.join(ROOT, fichier), META]):
            sautes += 1
            continue
        # Le fond prend un trio DIFFERENT par page : sinon sept cartes se
        # ressembleraient de loin, ce qui est le probleme qu'on corrige ici.
        decalage = (i * 3) % max(1, len(toutes))
        trio = [toutes[(decalage + k) % len(toutes)] for k in range(min(3, len(toutes)))]
        img = carte(eyebrow, titre, description(fichier),
                    trio if maquette else [], dessins.get(maquette))
        img.convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        faits += 1
        print(f"  {fichier} -> images/og/pages/{nom}.jpg ({os.path.getsize(dst) // 1024} Ko)")

    # --- Genres : la meme grille que le catalogue, filtree sur le genre.
    #     Tous les genres, pas seulement ceux du sitemap : l'edge function
    #     fabrique une page pour n'importe quel genre existant, et une carte
    #     manquante donne un partage casse.
    par_genre = {}
    for _, s in series:
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
        cs = [couvs[id(s)] for s in liste if id(s) in couvs]
        n = len(liste)
        pluriel = "s" if n > 1 else ""
        d_g = {"filtres": [(g, True), ("Tous les genres", False)], "couvertures": cs}
        img = carte(
            "MANGA " + g.upper(), g,
            f"{n} série{pluriel} de manga {g.lower()} traduite{pluriel} en français "
            f"par LanorTrad : " + ", ".join(s["title"] for s in liste[:4]) + ".",
            cs[:3], lambda t, d=d_g: maq.catalogue(t, d))
        img.convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        faits += 1
        print(f"  {g} -> images/og/genres/{nom} ({os.path.getsize(dst) // 1024} Ko)")

    for f in os.listdir(OUT_GENRES):
        if f.endswith(".jpg") and f not in gardes:
            os.remove(os.path.join(OUT_GENRES, f))
            print(f"  [nettoyage] {f} retire (genre disparu)")

    print(f"\n{faits} carte(s) generee(s), {sautes} deja a jour.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
