#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Vignettes de partage (OpenGraph) 1200x630, une par serie.

Pourquoi : jusqu'ici og:image servait la COUVERTURE, une image portrait. Or
Discord, X, Facebook et compagnie affichent un rectangle 1200x630 : ils
recadrent au centre, et il ne reste qu'une bande du milieu de la couverture,
souvent illisible. Discord etant notre canal principal, c'est la premiere
chose que voient la plupart des gens qui decouvrent un chapitre.

On genere donc une vraie carte paysage : la couverture entiere a gauche, le
titre et les infos a droite, sur un fond tire de la couverture elle-meme.

Ne touche a aucun original : ecrit seulement dans images/og/series/.

Prerequis : og-meta.json a jour  ->  node scripts/build-seo.js
Usage :
    py tools/build-og.py             # genere ce qui manque ou a change
    py tools/build-og.py --force     # tout regenerer
"""
import os
import re
import io
import sys
import json
import argparse
import unicodedata

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
META = os.path.join(ROOT, "og-meta.json")
OUT_DIR = os.path.join(ROOT, "images", "og", "series")
FONT_DIR = os.path.join(ROOT, "fonts")

W, H = 1200, 630
PAD = 64
COVER_H = 470                      # hauteur de la couverture posee a gauche
GAP = 56                           # espace entre la couverture et le texte
BG = (7, 7, 13)                    # meme fond que le site (--bg)
QUALITY = 88

# Polices du site. Les woff2 ne sont pas lisibles par Pillow : on les convertit
# en TTF en memoire via fontTools (qui a besoin de brotli pour le woff2).
#
# Ces fichiers sont des polices VARIABLES : leur instance par defaut est 400,
# quel que soit le nom du fichier. Dans un navigateur c'est le descripteur
# font-weight du @font-face qui positionne l'axe (css/fonts.css est correct) ;
# ici, personne ne le fait pour nous, donc on fige l'axe wght nous-memes —
# sinon un titre cense etre en 800 sort en maigre.
FONTS = {
    "title": ("sora-800-latin.woff2", 800),
    "strong": ("inter-600-latin.woff2", 600),
    "body": ("inter-400-latin.woff2", 400),
}
# Repli si fontTools/brotli manquent : la carte reste correcte, juste moins
# fidele a la charte.
FALLBACK = [
    "C:/Windows/Fonts/segoeuib.ttf", "C:/Windows/Fonts/segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]

_font_bytes = {}
_warned = False


def est_bonus(num):
    """Un numero decimal (246.5, 23.25) designe un chapitre BONUS : une
    histoire annexe, pas un chapitre de l'histoire principale. C'est la seule
    marque qui les distingue dans les donnees, et elle suffit."""
    try:
        v = float(str(num))
    except (TypeError, ValueError):
        return False
    return v != int(v)


def compte_chapitres(s):
    """(officiels, bonus) — comptes sur la LISTE reelle des chapitres, pas sur
    le champ `count` de series.js, qui peut avoir pris du retard."""
    ch = s.get("chapters") or []
    bonus = sum(1 for c in ch if est_bonus(c.get("n")))
    return len(ch) - bonus, bonus


def chapitres_lisible(s):
    """« 246 chapitres (3 bonus) ». Les bonus sont annonces a part : les
    compter avec les autres laisserait croire que l'histoire principale est
    plus avancee qu'elle ne l'est."""
    officiels, bonus = compte_chapitres(s)
    if not officiels:
        return ""
    return f"{officiels} chapitre{'s' if officiels > 1 else ''}" + (f" ({bonus} bonus)" if bonus else "")


def slug(name):
    """Nom de fichier sans accent ni espace (identique cote build-seo.js)."""
    out = unicodedata.normalize("NFD", str(name))
    out = "".join(c for c in out if unicodedata.category(c) != "Mn")
    out = re.sub(r"[^A-Za-z0-9]+", "-", out)
    return re.sub(r"-{2,}", "-", out).strip("-").lower() or "serie"


def load_font_bytes(fname, weight):
    """woff2 variable du site -> TTF statique en memoire, fige au poids demande.
    None si la conversion est impossible."""
    global _warned
    if fname in _font_bytes:
        return _font_bytes[fname]
    path = os.path.join(FONT_DIR, fname)
    data = None
    try:
        from fontTools.ttLib import TTFont
        f = TTFont(path)
        if "fvar" in f:
            from fontTools.varLib import instancer
            axes = {a.axisTag: (a.minValue, a.maxValue) for a in f["fvar"].axes}
            if "wght" in axes:
                lo, hi = axes["wght"]
                f = instancer.instantiateVariableFont(f, {"wght": max(lo, min(hi, weight))})
        buf = io.BytesIO()
        f.flavor = None                     # retire la compression woff2
        f.save(buf)
        data = buf.getvalue()
    except Exception as e:                                       # noqa: BLE001
        if not _warned:
            sys.stderr.write(
                f"  [polices] {fname} illisible ({e}).\n"
                "  Les cartes utiliseront une police systeme. Pour la charte exacte :\n"
                "      py -m pip install fonttools brotli\n")
            _warned = True
    _font_bytes[fname] = data
    return data


def font(kind, size):
    data = load_font_bytes(*FONTS[kind])
    if data:
        return ImageFont.truetype(io.BytesIO(data), size)
    for p in FALLBACK:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def text_w(draw, s, f):
    return draw.textbbox((0, 0), s, font=f)[2]


def wrap(draw, s, f, max_w, max_lines):
    """Coupe un texte en lignes qui tiennent dans max_w. La derniere ligne est
    tronquee avec une ellipse plutot que de deborder."""
    words, lines, cur = s.split(), [], ""
    for word in words:
        test = (cur + " " + word).strip()
        if text_w(draw, test, f) <= max_w or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = word
            if len(lines) == max_lines:
                break
    if cur and len(lines) < max_lines:
        lines.append(cur)
    if len(lines) == max_lines and (len(" ".join(lines)) < len(s)):
        last = lines[-1]
        while last and text_w(draw, last + "…", f) > max_w:
            last = last[:-1]
        lines[-1] = last.rstrip() + "…"
    return lines


def fit_font(draw, s, kind, max_w, max_lines, big, small):
    """Plus grande taille de police a laquelle le titre tient en max_lines."""
    size = big
    while size > small:
        f = font(kind, size)
        lines = wrap(draw, s, f, max_w, max_lines + 1)
        if len(lines) <= max_lines and all(text_w(draw, ln, f) <= max_w for ln in lines):
            return f, lines
        size -= 4
    f = font(kind, small)
    return f, wrap(draw, s, f, max_w, max_lines)


def rounded(im, radius):
    """Applique des coins arrondis (canal alpha)."""
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.size[0] - 1, im.size[1] - 1],
                                           radius=radius, fill=255)
    out = im.convert("RGBA")
    out.putalpha(mask)
    return out


def accent_rgb(hexstr, default=(224, 36, 94)):
    m = re.fullmatch(r"#?([0-9a-fA-F]{6})", str(hexstr or ""))
    if not m:
        return default
    v = m.group(1)
    return tuple(int(v[i:i + 2], 16) for i in (0, 2, 4))


def background(cover, accent):
    """Fond : la couverture agrandie, floutee et assombrie, plus un degrade
    vers le noir du site. Chaque serie a donc une carte qui lui ressemble, sans
    qu'on ait a dessiner quoi que ce soit a la main."""
    bg = Image.new("RGB", (W, H), BG)
    if cover:
        src = cover.convert("RGB")
        # « cover » : on remplit 1200x630 en rognant le debordement.
        scale = max(W / src.width, H / src.height)
        big = src.resize((max(1, round(src.width * scale)), max(1, round(src.height * scale))),
                         Image.LANCZOS)
        left = (big.width - W) // 2
        top = (big.height - H) // 3          # un tiers : on garde le haut, plus parlant
        bg = big.crop((left, top, left + W, top + H)).filter(ImageFilter.GaussianBlur(38))
        bg = Image.blend(bg, Image.new("RGB", (W, H), BG), 0.62)

    # Voile degrade : sombre a gauche (sous le texte), plus leger a droite.
    veil = Image.new("L", (W, 1))
    for x in range(W):
        veil.putpixel((x, 0), int(210 - 120 * (x / W)))
    veil = veil.resize((W, H))
    bg = Image.composite(Image.new("RGB", (W, H), BG), bg, veil.point(lambda v: 255 - v))

    # Filet d'accent en bas : la couleur de la serie, comme sur sa fiche.
    d = ImageDraw.Draw(bg)
    d.rectangle([0, H - 8, W, H], fill=accent)
    return bg


def build_card(sid, s, cover_path):
    accent = accent_rgb(s.get("accent"))
    cover = None
    if cover_path and os.path.exists(cover_path):
        try:
            cover = Image.open(cover_path)
        except Exception:                                        # noqa: BLE001
            cover = None

    card = background(cover, accent)
    d = ImageDraw.Draw(card)

    x = PAD
    if cover:
        cw = max(1, round(cover.width * COVER_H / cover.height))
        cw = min(cw, 360)
        thumb = cover.convert("RGB").resize((cw, COVER_H), Image.LANCZOS)
        thumb = rounded(thumb, 20)
        y = (H - COVER_H) // 2 - 4
        # Ombre portee : detache la couverture du fond floute.
        shadow = Image.new("RGBA", (cw + 48, COVER_H + 48), (0, 0, 0, 0))
        ImageDraw.Draw(shadow).rounded_rectangle(
            [24, 28, cw + 24, COVER_H + 28], radius=20, fill=(0, 0, 0, 150))
        shadow = shadow.filter(ImageFilter.GaussianBlur(16))
        card.paste(shadow, (x - 24, y - 24), shadow)
        card.paste(thumb, (x, y), thumb)
        x += cw + GAP

    tw = W - x - PAD

    # Bandeau : petit texte d'accroche, en couleur d'accent.
    f_eyebrow = font("strong", 24)
    eyebrow = "SCAN VF · LECTURE GRATUITE"
    d.text((x, 118), eyebrow, font=f_eyebrow, fill=accent)

    # Titre : la plus grande taille qui tient sur deux lignes.
    f_title, lines = fit_font(d, s.get("title", sid), "title", tw, 2, 68, 34)
    y = 162
    for ln in lines:
        d.text((x, y), ln, font=f_title, fill=(255, 255, 255))
        y += f_title.size + 10

    # Genres. « Oneshot » est deja dit par la ligne du dessous : inutile de
    # l'ecrire deux fois sur une carte qu'on lit en une seconde.
    glist = [g for g in (s.get("genres") or []) if g.lower() != "oneshot"]
    genres = " · ".join(glist[:3])
    if genres:
        f_g = font("body", 26)
        y += 6
        for ln in wrap(d, genres, f_g, tw, 1):
            d.text((x, y), ln, font=f_g, fill=(198, 198, 214))
            y += 38

    # Volume + statut : ce qui donne envie de cliquer.
    bits = []
    if s.get("type") == "oneshot":
        bits.append("Oneshot")
    else:
        libelle = chapitres_lisible(s)
        if libelle:
            bits.append(libelle)
    if s.get("status"):
        bits.append(s["status"])
    if bits:
        f_b = font("strong", 26)
        d.text((x, min(y + 8, H - 150)), "  ·  ".join(bits), font=f_b, fill=(233, 233, 244))

    # Signature, calee en bas a droite.
    f_sig = font("title", 34)
    sig = "LanorTrad"
    d.text((W - PAD - text_w(d, sig, f_sig), H - PAD - 44), sig,
           font=f_sig, fill=(255, 255, 255))

    if cover:
        cover.close()
    return card


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

    os.makedirs(OUT_DIR, exist_ok=True)
    made = skipped = 0
    keep = set()
    print(f"=== Vignettes de partage : {len(meta)} serie(s) ===")

    for sid, s in sorted(meta.items()):
        name = slug(sid) + ".jpg"
        keep.add(name)
        dst = os.path.join(OUT_DIR, name)
        cover_path = os.path.join(ROOT, (s.get("cover") or "").replace("/", os.sep))

        # A jour ? On compare a la couverture ET a ce script : changer le
        # dessin des cartes doit suffire a toutes les regenerer.
        if not args.force and os.path.exists(dst):
            ref = [os.path.getmtime(__file__)]
            if os.path.exists(cover_path):
                ref.append(os.path.getmtime(cover_path))
            if os.path.getmtime(dst) >= max(ref):
                skipped += 1
                continue

        try:
            card = build_card(sid, s, cover_path)
        except Exception as e:                                   # noqa: BLE001
            sys.stderr.write(f"  ERREUR {sid} : {e}\n")
            continue
        card.convert("RGB").save(dst, "JPEG", quality=QUALITY, optimize=True, progressive=True)
        made += 1
        print(f"  {sid} -> images/og/series/{name} ({os.path.getsize(dst) // 1024} Ko)")

    # Serie renommee ou retiree : sa vignette n'a plus lieu d'etre.
    for f in os.listdir(OUT_DIR):
        if f.endswith(".jpg") and f not in keep:
            os.remove(os.path.join(OUT_DIR, f))
            print(f"  [nettoyage] {f} retire (serie disparue)")

    print(f"\n{made} vignette(s) generee(s), {skipped} deja a jour.")
    print("Pense a relancer  node scripts/build-seo.js  pour les referencer.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
