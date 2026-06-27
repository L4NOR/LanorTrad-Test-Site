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
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

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
