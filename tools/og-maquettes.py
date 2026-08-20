#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Maquettes dessinees pour les vignettes de partage.

Module utilise par tools/build-og-pages.py. Il ne se lance pas seul.

POURQUOI
Un eventail de couvertures dit « manga ». Il ne dit pas ce qu'on trouve sur la
page. Le forum, le planning, le classement et la bibliotheque ne ressemblent
pas a une pile de couvertures : ils ressemblent a une discussion, a un
calendrier, a un tableau, a une liste de lectures en cours. Chaque carte montre
donc une MAQUETTE de sa page, dessinee dans le theme du site.

CE QUI EST VRAI, CE QUI EST ILLUSTRATIF
Tout ce qui peut venir des donnees du site en vient : titres de series, numeros
de chapitres, jours de parution reels, categories reelles du forum, membres et
roles reels de l'equipe, noms des rangs de la gamification.
Restent illustratifs, parce qu'ils n'existent pas au moment du build : les
pseudos des lecteurs (forum, classement) et la progression de lecture
(bibliotheque) - c'est la lecture de CHAQUE visiteur, elle n'a pas de valeur
fixe. Aucun de ces textes n'affirme quoi que ce soit sur l'equipe.

CONTRAINTE : PAS D'EMOJI
Les polices du site sont des sous-ensembles latins. Un emoji n'y a pas de
glyphe et sortirait en carre vide. Tout est donc dessine : pastilles, jauges,
medailles, avatars.
"""
import os

from PIL import Image, ImageDraw

# --------------------------------------------------------------- couleurs
BLANC = (255, 255, 255)
TXT = (236, 235, 255)
TXT_SOFT = (185, 184, 214)
TXT_MUT = (132, 130, 166)
VIOLET = (168, 85, 247)
INDIGO = (99, 102, 241)
MAGENTA = (217, 70, 239)
OR = (245, 197, 66)
ARGENT = (198, 200, 214)
BRONZE = (191, 130, 84)

# Palette d'avatars : les memes teintes que le site, rien de plus.
AVATARS = [VIOLET, INDIGO, MAGENTA, (16, 185, 129), (245, 158, 11)]


class Toile:
    """Une carte en cours de dessin.

    Trois couches, dans cet ordre : les formes translucides (panneaux,
    pastilles), les images collees (couvertures, photos), puis les textes.
    Sans cet ordre, une pastille dessinee apres une couverture passerait
    dessous, et un texte pose avant un panneau disparaitrait.
    """

    def __init__(self, img, og):
        self.img = img
        self.og = og
        self.ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.ov)
        self.ov2 = Image.new("RGBA", img.size, (0, 0, 0, 0))
        self.d2 = ImageDraw.Draw(self.ov2)
        self._images = []
        self._textes = []

    # -- mesures -----------------------------------------------------------
    def largeur(self, s, f):
        return self.d.textbbox((0, 0), s, font=f)[2]

    def police(self, genre, taille):
        return self.og.font(genre, taille)

    # -- formes ------------------------------------------------------------
    def panneau(self, box, r=18, fond=(255, 255, 255, 15), bord=(255, 255, 255, 38), dessus=False):
        (self.d2 if dessus else self.d).rounded_rectangle(box, radius=r, fill=fond, outline=bord, width=1)

    def pastille(self, x, y, texte, coul=VIOLET, taille=18, fond_a=42, dessus=False):
        """Petite etiquette arrondie facon .tag / .chip du site."""
        f = self.police("strong", taille)
        w = self.largeur(texte, f)
        h = taille + 12
        box = [x, y, x + w + 24, y + h]
        (self.d2 if dessus else self.d).rounded_rectangle(
            box, radius=h // 2, fill=coul + (fond_a,), outline=coul + (110,), width=1)
        self.texte((x + 12, y + 6), texte, f, coul)
        return box[2] - box[0]

    def jauge(self, x, y, largeur, ratio, coul=VIOLET, hauteur=8):
        self.d.rounded_rectangle([x, y, x + largeur, y + hauteur], radius=hauteur // 2,
                                 fill=(255, 255, 255, 30))
        plein = max(hauteur, round(largeur * max(0.0, min(1.0, ratio))))
        self.d.rounded_rectangle([x, y, x + plein, y + hauteur], radius=hauteur // 2,
                                 fill=coul + (235,))

    def avatar(self, x, y, d, lettre, coul):
        self.d.ellipse([x, y, x + d, y + d], fill=coul + (235,))
        f = self.police("title", round(d * 0.46))
        w = self.largeur(lettre, f)
        self.texte((x + (d - w) / 2, y + d * 0.24), lettre, f, BLANC)

    def medaille(self, x, y, d, rang, coul):
        self.d.ellipse([x, y, x + d, y + d], fill=coul + (60,), outline=coul + (220,), width=2)
        f = self.police("title", round(d * 0.5))
        s = str(rang)
        w = self.largeur(s, f)
        self.texte((x + (d - w) / 2, y + d * 0.22), s, f, coul)

    # -- contenu -----------------------------------------------------------
    def coller(self, im, xy, masque=None):
        self._images.append((im, xy, masque))

    def vignette(self, couverture, x, y, h, r=10):
        """Couverture redimensionnee, coins arrondis, ombre douce."""
        if couverture is None:
            return 0
        w = max(1, round(couverture.width * h / couverture.height))
        im = self.og.rounded(couverture.resize((w, h), Image.LANCZOS), r)
        self.coller(im, (round(x), round(y)), im)
        return w

    def vignette_remplie(self, couverture, x, y, w, h, r=10):
        """Couverture ramenee EXACTEMENT a w x h : on agrandit puis on rogne au
        centre, plutot que de deformer. C'est ce qui rend une grille reguliere
        malgre des couvertures de formats differents."""
        if couverture is None:
            return
        echelle = max(w / couverture.width, h / couverture.height)
        gros = couverture.resize((max(1, round(couverture.width * echelle)),
                                  max(1, round(couverture.height * echelle))), Image.LANCZOS)
        gx = (gros.width - w) // 2
        gy = (gros.height - h) // 3          # un tiers : on garde le haut, plus parlant
        im = self.og.rounded(gros.crop((gx, gy, gx + w, gy + h)), r)
        self.coller(im, (round(x), round(y)), im)

    def texte(self, xy, s, f, fill):
        self._textes.append((xy, s, f, fill))

    def ligne(self, xy, s, f, fill, largeur_max):
        """Une ligne, tronquee proprement plutot que debordante."""
        lignes = self.og.wrap(self.d, s, f, largeur_max, 1)
        self.texte(xy, lignes[0] if lignes else "", f, fill)

    # -- rendu -------------------------------------------------------------
    def rendu(self):
        out = Image.alpha_composite(self.img.convert("RGBA"), self.ov)
        out = out.convert("RGB")
        for im, xy, m in self._images:
            out.paste(im, xy, m)
        out = Image.alpha_composite(out.convert("RGBA"), self.ov2).convert("RGB")
        d = ImageDraw.Draw(out)
        for xy, s, f, fill in self._textes:
            d.text(xy, s, font=f, fill=fill)
        return out


# =========================================================================
#  Les maquettes. Chacune dessine dans la zone de gauche (X..X+LARGEUR).
# =========================================================================
X, Y, LARGEUR, HAUTEUR = 56, 92, 604, 452


def _entete(t, titre, droite=None):
    """Ligne de tete d'un panneau : un intitule, et parfois une mention a droite."""
    f = t.police("strong", 19)
    t.texte((X + 26, Y + 22), titre.upper(), f, TXT_MUT)
    if droite:
        w = t.largeur(droite, f)
        t.texte((X + LARGEUR - 26 - w, Y + 22), droite, f, TXT_MUT)


def forum(t, d):
    """Un sujet du forum : la categorie, le titre, trois messages, les reponses."""
    t.panneau([X, Y, X + LARGEUR, Y + HAUTEUR], r=22)
    _entete(t, "Forum", "4 réponses")

    t.pastille(X + 26, Y + 54, d["categorie"], INDIGO)
    t.ligne((X + 26, Y + 100), d["sujet"], t.police("title", 27), BLANC, LARGEUR - 52)

    # Une ligne par message : au format d'une vignette de partage, deux lignes
    # deviennent illisibles et debordent sur le pied de carte.
    y = Y + 150
    f_txt = t.police("body", 20)
    for i, m in enumerate(d["messages"][:3]):
        t.avatar(X + 26, y, 46, m["qui"][0].upper(), AVATARS[i % len(AVATARS)])
        fx = X + 88
        f_nom = t.police("strong", 21)
        t.texte((fx, y + 1), m["qui"], f_nom, TXT)
        if m.get("badge"):
            t.pastille(fx + t.largeur(m["qui"], f_nom) + 12, y - 2, m["badge"],
                       VIOLET if m["badge"] == "Team" else INDIGO, taille=15)
        t.ligne((fx, y + 30), m["texte"], f_txt, TXT_SOFT, LARGEUR - 140)
        y += 78

    # Pied : les reactions, dessinees (aucun emoji n'existe dans nos polices).
    yb = Y + HAUTEUR - 52
    t.d.line([X + 26, yb - 14, X + LARGEUR - 26, yb - 14], fill=(255, 255, 255, 26), width=1)
    x = X + 26
    for coul, n in ((MAGENTA, "12"), (INDIGO, "5"), (OR, "3")):
        t.d.ellipse([x, yb + 2, x + 20, yb + 22], fill=coul + (80,), outline=coul + (200,), width=1)
        x += 26
    t.texte((x + 6, yb + 2), "20 réactions", t.police("strong", 18), TXT_MUT)


def planning(t, d):
    """La semaine, colonne par colonne, comme sur la page Planning."""
    t.panneau([X, Y, X + LARGEUR, Y + HAUTEUR], r=22)
    _entete(t, "Cette semaine", d["mention"])

    n = 7
    gap = 8
    col = (LARGEUR - 52 - gap * (n - 1)) / n
    # Hauteur des colonnes calee sur la journee la plus chargee, et le tout
    # centre : des colonnes de 400 px pour deux vignettes donnaient une carte
    # aux trois quarts vide.
    hv = 88
    charge = min(3, max([len(j["couvertures"]) for j in d["jours"]] + [1]))
    hcol = 46 + charge * (hv + 8) + 8
    haut = Y + 62 + max(0, (HAUTEUR - 86 - hcol) / 2)
    bas = haut + hcol
    for i, jour in enumerate(d["jours"]):
        x = X + 26 + i * (col + gap)
        actif = jour["aujourdhui"]
        t.panneau([x, haut, x + col, bas], r=14,
                  fond=(168, 85, 247, 34) if actif else (255, 255, 255, 12),
                  bord=VIOLET + (170,) if actif else (255, 255, 255, 28))
        f_j = t.police("strong", 17)
        w = t.largeur(jour["nom"], f_j)
        t.texte((x + (col - w) / 2, haut + 12), jour["nom"],
                f_j, VIOLET if actif else TXT_MUT)

        y = haut + 42
        lv = round(min(col - 14, hv * 0.7))
        for c in jour["couvertures"][:3]:
            t.vignette_remplie(c, x + (col - lv) / 2, y, lv, hv, r=8)
            y += hv + 8
        if not jour["couvertures"]:
            f = t.police("body", 15)
            w = t.largeur("—", f)
            t.texte((x + (col - w) / 2, haut + 52), "—", f, (90, 88, 118))


def accueil(t, d):
    """L'accueil : la barre du site, une rangee de series, les dernieres sorties."""
    t.panneau([X, Y, X + LARGEUR, Y + HAUTEUR], r=22)

    # Barre de navigation
    f_marque = t.police("title", 22)
    t.texte((X + 26, Y + 24), "LanorTrad", f_marque, BLANC)
    x = X + 26 + t.largeur("LanorTrad", f_marque) + 26
    for lib in ("Catalogue", "Planning", "Forum"):
        f = t.police("strong", 17)
        t.texte((x, Y + 28), lib, f, TXT_MUT)
        x += t.largeur(lib, f) + 22
    t.d.line([X + 20, Y + 66, X + LARGEUR - 20, Y + 66], fill=(255, 255, 255, 24), width=1)

    # Rangee de series : format uniforme, comme les cartes du site.
    lv, hv = 106, 150
    xs = X + 26
    for c in d["couvertures"][:4]:
        t.vignette_remplie(c, xs, Y + 84, lv, hv, r=12)
        xs += lv + 14

    # Dernieres sorties
    t.texte((X + 26, Y + 252), "DERNIÈRES SORTIES", t.police("strong", 18), TXT_MUT)
    y = Y + 282
    for s in d["sorties"][:3]:
        t.vignette(s["couverture"], X + 26, y, 44, r=7)
        t.ligne((X + 26 + 34, y), s["titre"], t.police("strong", 20), TXT, 320)
        t.texte((X + 26 + 34, y + 24), s["chapitre"], t.police("body", 17), TXT_MUT)
        f = t.police("body", 16)
        w = t.largeur(s["quand"], f)
        t.texte((X + LARGEUR - 26 - w, y + 10), s["quand"], f, TXT_MUT)
        y += 56


def catalogue(t, d):
    """La grille du catalogue, avec la barre de filtres au-dessus."""
    t.panneau([X, Y, X + LARGEUR, Y + HAUTEUR], r=22)

    x = X + 26
    for lib, actif in d["filtres"]:
        x += t.pastille(x, Y + 22, lib, VIOLET if actif else INDIGO,
                        taille=17, fond_a=52 if actif else 20) + 10

    # Grille reguliere : toutes les vignettes au meme format, chaque rangee
    # centree. Un genre qui n'a que deux series doit rendre aussi bien que le
    # catalogue complet.
    couvs = [c for c in d["couvertures"][:8] if c is not None]
    if not couvs:
        return
    lignes = 1 if len(couvs) <= 4 else 2
    par_ligne = min(4, -(-len(couvs) // lignes))
    hv = 264 if lignes == 1 else 176
    lv = round(hv * 0.70)
    gap = 16
    haut_total = lignes * hv + (lignes - 1) * gap
    y0 = Y + 76 + max(0, (HAUTEUR - 100 - haut_total) / 2)
    for i, c in enumerate(couvs):
        rang = i // par_ligne
        dans = min(par_ligne, len(couvs) - rang * par_ligne)
        x0 = X + (LARGEUR - (dans * lv + (dans - 1) * gap)) / 2
        t.vignette_remplie(c, x0 + (i % par_ligne) * (lv + gap), y0 + rang * (hv + gap),
                           lv, hv, r=12)


def bibliotheque(t, d):
    """Les lectures en cours, avec leur avancement, puis les series suivies."""
    t.panneau([X, Y, X + LARGEUR, Y + HAUTEUR], r=22)
    _entete(t, "Ta bibliothèque")

    t.texte((X + 26, Y + 58), "LECTURES EN COURS", t.police("strong", 18), TXT_MUT)
    y = Y + 88
    for L in d["en_cours"][:3]:
        t.vignette(L["couverture"], X + 26, y, 74, r=9)
        fx = X + 26 + 58
        t.ligne((fx, y + 2), L["titre"], t.police("strong", 22), TXT, 300)
        t.texte((fx, y + 32), L["repere"], t.police("body", 17), TXT_MUT)
        t.jauge(fx, y + 60, 300, L["ratio"])
        f = t.police("strong", 17)
        pc = f"{round(L['ratio'] * 100)} %"
        t.texte((fx + 312, y + 55), pc, f, VIOLET)
        y += 90

    t.texte((X + 26, y), "SÉRIES SUIVIES", t.police("strong", 18), TXT_MUT)
    xs = X + 26
    for c in d["suivis"][:5]:
        xs += t.vignette(c, xs, y + 26, 54, r=8) + 10


def classement(t, d):
    """Le classement de la semaine : rang, pseudo, rang d'Aura, XP."""
    t.panneau([X, Y, X + LARGEUR, Y + HAUTEUR], r=22)
    _entete(t, "Classement", d["mention"])

    y = Y + 62
    couleurs = (OR, ARGENT, BRONZE, None, None)
    for i, L in enumerate(d["lignes"][:4]):
        haut = 78
        t.panneau([X + 22, y, X + LARGEUR - 22, y + haut], r=14,
                  fond=(255, 255, 255, 20) if i == 0 else (255, 255, 255, 10),
                  bord=(OR + (120,)) if i == 0 else (255, 255, 255, 24))
        med = couleurs[i] or TXT_MUT
        t.medaille(X + 40, y + 20, 38, i + 1, med)
        t.avatar(X + 92, y + 16, 46, L["qui"][0].upper(), AVATARS[(i + 1) % len(AVATARS)])
        f_nom = t.police("strong", 22)
        t.texte((X + 152, y + 18), L["qui"], f_nom, TXT)
        t.pastille(X + 152, y + 44, L["rang"], VIOLET, taille=15, dessus=True)
        f_xp = t.police("title", 24)
        w = t.largeur(L["xp"], f_xp)
        t.texte((X + LARGEUR - 44 - w, y + 26), L["xp"], f_xp, BLANC)
        y += haut + 12


def equipe(t, d):
    """Les trois membres reels de la team, avec leur role reel."""
    gap = 16
    lv = (LARGEUR - gap * 2) / 3
    for i, m in enumerate(d["membres"][:3]):
        x = X + i * (lv + gap)
        t.panneau([x, Y + 34, x + lv, Y + HAUTEUR - 34], r=20)
        dia = 116
        if m["photo"] is not None:
            ph = m["photo"].resize((dia, dia), Image.LANCZOS).convert("RGBA")
            masque = Image.new("L", (dia, dia), 0)
            ImageDraw.Draw(masque).ellipse([0, 0, dia - 1, dia - 1], fill=255)
            ph.putalpha(masque)
            t.coller(ph, (round(x + (lv - dia) / 2), Y + 74), ph)
        else:
            t.avatar(x + (lv - dia) / 2, Y + 74, dia, m["nom"][0], AVATARS[i])

        f_n = t.police("title", 26)
        w = t.largeur(m["nom"], f_n)
        t.texte((x + (lv - w) / 2, Y + 216), m["nom"], f_n, BLANC)
        f_r = t.police("strong", 17)
        wr = t.largeur(m["role"], f_r)
        t.pastille(x + (lv - wr - 24) / 2, Y + 256, m["role"], (VIOLET, INDIGO, MAGENTA)[i % 3], taille=17)

        f_p = t.police("body", 17)
        yy = Y + 306
        for ln in t.og.wrap(t.d, m["phrase"], f_p, lv - 40, 4):
            wl = t.largeur(ln, f_p)
            t.texte((x + (lv - wl) / 2, yy), ln, f_p, TXT_SOFT)
            yy += 26
