#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Serveur de développement local SANS cache.

Comme `python -m http.server`, mais ajoute des en-têtes `Cache-Control: no-store`
pour que les modifications CSS/JS soient TOUJOURS visibles au rechargement —
y compris depuis un téléphone sur le même Wi-Fi (http://<IP-du-PC>:8779).

Multi-thread (ThreadingHTTPServer) pour encaisser les chargements en parallèle
d'un chapitre (HTML + CSS + JS + dizaines d'images) sans abandonner de connexion.

Usage :  py serve.py        (à lancer depuis la racine du site)
         py serve.py 8000   (port au choix)
"""
import os
import re
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

# Adresses lisibles : le meme rapprochement que les reecritures de netlify.toml,
# pour que /manga/tougen-anki/chapitre-240/ se teste aussi en local.
# Comme sur Netlify, un fichier reel l'emporte toujours sur ces regles : sans ca
# les images (Manga/preview/...) tomberaient dedans.
PROPRES = [
    (re.compile(r"^/manga/[^/]+/?$"), "/manga.html"),
    (re.compile(r"^/manga/[^/]+/[^/]+/?$"), "/reader.html"),
    (re.compile(r"^/genre/[^/]+/?$"), "/catalogue.html"),
]

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8779


class NoCacheHandler(SimpleHTTPRequestHandler):
    # Python ne mappe pas .xsl par défaut : sans ça, le navigateur refuse la
    # feuille de style du flux RSS (feed.xsl) et affiche le XML brut en local.
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, ".xsl": "text/xsl"}

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def reecrire(self, chemin_complet):
        chemin = urllib.parse.unquote(urllib.parse.urlsplit(chemin_complet).path)
        if os.path.exists("." + chemin.rstrip("/")):
            return chemin_complet          # fichier ou dossier reel : il l'emporte
        for motif, cible in PROPRES:
            if motif.match(chemin):
                return cible
        return chemin_complet

    def do_GET(self):
        self.path = self.reecrire(self.path)
        super().do_GET()

    def do_HEAD(self):
        self.path = self.reecrire(self.path)
        super().do_HEAD()

    # Évite de spammer la console avec les connexions abandonnées par le navigateur.
    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    ThreadingHTTPServer.allow_reuse_address = True
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), NoCacheHandler)
    print(f"Dev (no-cache) -> http://localhost:{PORT}")
    print(f"Depuis le telephone -> http://<IP-du-PC>:{PORT}  (meme Wi-Fi)")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nArret.")
        httpd.shutdown()
