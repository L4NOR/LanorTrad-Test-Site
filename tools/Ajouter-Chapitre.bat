@echo off
chcp 65001 >nul
title LanorTrad - Ajouter un chapitre
cd /d "%~dp0\.."
echo.
echo   LanorTrad - Serveur local d'ajout de chapitres
echo   --------------------------------------------------
echo   Ouverture du navigateur sur http://localhost:4599
echo   (Laisse cette fenetre ouverte. Ferme-la pour arreter.)
echo.
start "" "http://localhost:4599"
node "tools\upload-server.js"
echo.
echo   Serveur arrete. Tu peux fermer cette fenetre.
pause >nul
