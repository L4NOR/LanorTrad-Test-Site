@echo off
chcp 65001 >nul
title LanorTrad - Modifier les fiches series
cd /d "%~dp0\.."
echo.
echo   LanorTrad - Serveur local d'edition des fiches series
echo   --------------------------------------------------
echo   Ouverture du navigateur sur http://localhost:4600
echo   (Laisse cette fenetre ouverte. Ferme-la pour arreter.)
echo.
start "" "http://localhost:4600"
node "tools\series-server.js"
echo.
echo   Serveur arrete. Tu peux fermer cette fenetre.
pause >nul
