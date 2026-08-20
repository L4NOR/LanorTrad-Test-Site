#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
LanorTrad - Deploiement depuis cette machine, sans passer par git.

POURQUOI
Netlify clone le depot a chaque deploiement quand son cache est froid. Le
depot pese 15 Go de pages de chapitre (28 Go avec l'historique), et le stade
« preparing repo » est tue au bout de 30 minutes : le deploiement echoue avant
meme que la commande de build ne demarre. Ce n'est pas un accident, ca se
reproduira, et ca empirera a chaque serie ajoutee.

Ici, on inverse : la machine qui possede deja les 15 Go televerse elle-meme.
Netlify compare les empreintes des fichiers et ne redemande que ceux qu'il n'a
pas — un chapitre de plus, c'est vingt fichiers, pas quinze giga-octets.

CE QUE CE SCRIPT FAIT, DANS L'ORDRE
  1. rejoue la chaine de build de netlify.toml, avec le VRAI domaine servi ;
  2. s'arrete net si une verification echoue, exactement comme Netlify ;
  3. televerse le site ;
  4. remet le depot dans l'etat ou il etait.

LE PIEGE, ET LA RAISON DU POINT 1
scripts/build-seo.js recible les adresses absolues des pages sur le domaine
reellement servi, qu'il lit dans la variable URL. Sur Netlify elle est fournie ;
en local, non. Sans elle, les pages partiraient en annoncant leurs vignettes de
partage sur lanortrad.com, qui ne sert pas encore le site : plus aucune image
de partage sur Discord. D'ou LT_SITE_URL ci-dessous.

PREALABLES (une seule fois)
    py tools/deployer.py --connexion   # login + link

Rien a installer a la main : si le CLI Netlify n'est pas la, le script le fait
telecharger par npx. Seul Node.js est requis (https://nodejs.org).

La commande `netlify` n'a PAS besoin d'etre dans le PATH : ce script retrouve
l'executable dans le dossier des paquets npm globaux. C'est delibere : sur cette
machine, une console fraiche ne le voit pas toujours, et passer une demi-heure
sur une variable d'environnement pour deployer un site n'a pas de sens.

USAGE
    py tools/deployer.py              # deploiement en production
    py tools/deployer.py --essai      # deploiement d'apercu, URL temporaire
    py tools/deployer.py --connexion  # authentification + liaison du dossier
"""
import os
import sys
import time
import shutil
import argparse
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Domaine reellement servi. A changer le jour ou le site bascule sur son
# domaine definitif — c'est la seule ligne a toucher.
SITE = os.environ.get("LT_SITE_URL", "https://lanortradtest.netlify.app")

ETAPES = [
    ("Fichiers SEO", ["node", "scripts/build-seo.js"]),
    ("Coherence du site", ["node", "scripts/check.js"]),
    ("Pre-rendu robots", ["node", "scripts/test-og.mjs"]),
]


def path_complet():
    """Le PATH reconstruit depuis le registre : machine, puis utilisateur.

    Sur cette machine, une console fraiche demarre parfois sans les dossiers de
    Node et des paquets npm globaux, alors que les deux sont installes et
    correctement declares dans le registre. Resultat : ni `node`, ni `npm`, ni
    `netlify`, et un script qui s'arrete sur une variable d'environnement.

    Plutot que de dependre de ce que la console a bien voulu heriter, on relit
    la source. Hors Windows, on garde le PATH tel quel."""
    herite = os.environ.get("PATH", "")
    if os.name != "nt":
        return herite
    import winreg
    morceaux = []
    for racine, cle in (
        (winreg.HKEY_LOCAL_MACHINE,
         r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
        (winreg.HKEY_CURRENT_USER, "Environment"),
    ):
        try:
            with winreg.OpenKey(racine, cle) as k:
                valeur, _ = winreg.QueryValueEx(k, "Path")
                if valeur:
                    morceaux.append(os.path.expandvars(valeur))
        except OSError:
            pass
    morceaux.append(herite)
    # Doublons retires, ordre conserve.
    vus, propre = set(), []
    for bout in os.pathsep.join(morceaux).split(os.pathsep):
        bout = bout.strip().rstrip("\\")
        if bout and bout.lower() not in vus:
            vus.add(bout.lower())
            propre.append(bout)
    return os.pathsep.join(propre)


PATH = path_complet()


def titre(t):
    # flush : les sous-processus ecrivent directement sur la console, nos
    # propres messages passent par un tampon. Sans ca, chaque titre
    # s'affiche APRES la sortie de l'etape qu'il annonce.
    print("\n" + t, flush=True)
    print("-" * len(t), flush=True)


def lancer(cmd, env=None):
    """Tous les sous-processus heritent du PATH reconstruit : sans ca, `node`
    et `git` manqueraient a l'appel exactement comme `netlify`."""
    complet = dict(env or os.environ)
    complet["PATH"] = PATH
    return subprocess.run(cmd, cwd=ROOT, env=complet, shell=(os.name == "nt")).returncode


def commande_netlify():
    """La commande qui lance le CLI Netlify, ou None si Node est absent.

    Trois pistes, dans l'ordre :
      1. le PATH (reconstruit depuis le registre) ;
      2. les dossiers ou npm pose ses paquets globaux ;
      3. npx, qui telecharge le CLI a la demande et le garde en cache.

    La troisieme evite d'avoir a installer quoi que ce soit globalement — et
    c'est justement ce qui manquait ici : `npm install -g` ne s'etait pas fait
    sur cette machine."""
    trouve = shutil.which("netlify", path=PATH) or shutil.which("netlify.cmd", path=PATH)
    if trouve:
        return [trouve]

    dossiers = []
    for base in (os.environ.get("APPDATA"), os.environ.get("LOCALAPPDATA")):
        if base:
            dossiers.append(os.path.join(base, "npm"))
    dossiers += [os.path.join(os.environ.get("ProgramFiles", ""), "nodejs"),
                 "/usr/local/bin", "/usr/bin", os.path.expanduser("~/.npm-global/bin")]
    for dossier in dossiers:
        for nom in ("netlify.cmd", "netlify.exe", "netlify"):
            chemin = os.path.join(dossier, nom)
            if dossier and os.path.exists(chemin):
                return [chemin]

    # Rien d'installe : npx s'en charge. Le premier appel telecharge le CLI
    # (une minute environ), les suivants tapent dans le cache npm.
    npx = shutil.which("npx", path=PATH) or shutil.which("npx.cmd", path=PATH)
    if npx:
        return [npx, "--yes", "netlify-cli"]
    return None


def restaurer():
    """Remet les pages HTML et les fichiers SEO dans l'etat du depot.

    Le build les a reecrites sur le domaine servi ; le depot, lui, doit rester
    sur le domaine de production, sans quoi le prochain `git status` serait
    plein de modifications qui n'en sont pas."""
    titre("Remise en etat du depot")
    if lancer(["git", "checkout", "--", "*.html"]) != 0:
        print("  Attention : les pages HTML n'ont pas pu etre restaurees.")
        print("  Lance toi-meme :  git checkout -- *.html")
        return
    lancer(["node", "scripts/build-seo.js"])
    print("  Pages HTML et fichiers SEO revenus au domaine de production.")


def main():
    ap = argparse.ArgumentParser(add_help=True)
    ap.add_argument("--essai", action="store_true",
                    help="deploiement d'apercu (URL temporaire) au lieu de la production")
    ap.add_argument("--connexion", action="store_true",
                    help="authentification Netlify puis liaison du dossier (une seule fois)")
    ap.add_argument("--essais", type=int, default=5, metavar="N",
                    help="tentatives de televersement avant d'abandonner (defaut 5)")
    args = ap.parse_args()

    cli = commande_netlify()
    if not cli:
        print("Node.js est introuvable sur cette machine.\n")
        print("Le deploiement en a besoin (npx, npm, node). Installe-le :")
        print("  https://nodejs.org  (version LTS)")
        print("\npuis relance cette commande. Rien d'autre a installer :")
        print("le CLI Netlify sera telecharge tout seul au premier appel.")
        return 1

    print("CLI Netlify : " + (" ".join(cli) if len(cli) > 1 else cli[0]), flush=True)

    if args.connexion:
        # On appelle le CLI par son chemin complet : inutile de se battre avec
        # le PATH de la console pour deux commandes qu'on ne tape qu'une fois.
        titre("Authentification")
        print("Le navigateur va s'ouvrir. C'est toi qui valides.\n", flush=True)
        if lancer(cli + ["login"]) != 0:
            print("\nAuthentification interrompue.")
            return 1
        titre("Liaison du dossier au site")
        code = lancer(cli + ["link"])
        if code == 0:
            print("\nPret. Tu peux maintenant lancer :  py tools/deployer.py")
        return code

    env = dict(os.environ)
    env["URL"] = SITE                      # <- sans ca, les vignettes cassent

    print(f"Site vise   : {SITE}", flush=True)
    for nom, cmd in ETAPES:
        titre(nom)
        code = lancer(cmd, env)
        if code != 0:
            print(f"\n{nom} : ECHEC. Rien n'a ete deploye.")
            restaurer()
            return code

    titre("Televersement")
    print("Netlify ne redemande que les fichiers qu'il n'a pas deja.", flush=True)
    print("Une coupure reseau n'est donc pas perdue : chaque tentative reprend", flush=True)
    print("la ou la precedente s'est arretee.\n", flush=True)
    cmd = cli + ["deploy", "--dir", "."] + ([] if args.essai else ["--prod"])

    # Sur 14 000 fichiers et plusieurs giga-octets, une micro-coupure suffit a
    # tout arreter (ENOTFOUND, delai depasse...). On reessaie plutot que de
    # renvoyer l'utilisateur a la ligne de commande : les fichiers deja recus
    # sont indexes par empreinte, la tentative suivante en demande moins.
    code = 1
    for essai in range(1, args.essais + 1):
        if essai > 1:
            print(f"\n--- tentative {essai}/{args.essais}, dans 15 s ---", flush=True)
            time.sleep(15)
        code = lancer(cmd, env)
        if code == 0:
            break
        if essai < args.essais:
            print(f"\nTeleversement interrompu (code {code}).", flush=True)

    restaurer()

    if code != 0:
        print(f"\nLe deploiement a echoue apres {args.essais} tentative(s).")
        print("Le depot est intact, et les fichiers deja envoyes sont conserves :")
        print("relancer la commande reprendra ou ca s'est arrete.")
        return code
    print("\nDeploiement termine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
