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
    npm install -g netlify-cli
    netlify login      # ouvre le navigateur, c'est toi qui valides
    netlify link       # relie ce dossier au site Netlify

USAGE
    py tools/deployer.py              # deploiement en production
    py tools/deployer.py --essai      # deploiement d'apercu, URL temporaire
"""
import os
import sys
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


def titre(t):
    # flush : les sous-processus ecrivent directement sur la console, nos
    # propres messages passent par un tampon. Sans ca, chaque titre
    # s'affiche APRES la sortie de l'etape qu'il annonce.
    print("\n" + t, flush=True)
    print("-" * len(t), flush=True)


def lancer(cmd, env=None):
    return subprocess.run(cmd, cwd=ROOT, env=env, shell=(os.name == "nt")).returncode


def netlify():
    """Chemin du CLI, ou None s'il n'est pas installe."""
    return shutil.which("netlify") or shutil.which("netlify.cmd")


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
    args = ap.parse_args()

    cli = netlify()
    if not cli:
        print("Le CLI Netlify n'est pas installe.\n")
        print("  npm install -g netlify-cli")
        print("  netlify login")
        print("  netlify link")
        return 1

    env = dict(os.environ)
    env["URL"] = SITE                      # <- sans ca, les vignettes cassent

    print(f"Site vise : {SITE}", flush=True)
    for nom, cmd in ETAPES:
        titre(nom)
        code = lancer(cmd, env)
        if code != 0:
            print(f"\n{nom} : ECHEC. Rien n'a ete deploye.")
            restaurer()
            return code

    titre("Televersement")
    print("Netlify ne redemande que les fichiers qu'il n'a pas deja.\n", flush=True)
    cmd = [cli, "deploy", "--dir", "."] + ([] if args.essai else ["--prod"])
    code = lancer(cmd, env)

    restaurer()

    if code != 0:
        print("\nLe deploiement a echoue. Le depot est intact.")
        return code
    print("\nDeploiement termine.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
