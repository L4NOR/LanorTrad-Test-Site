@echo off
chcp 65001 >nul
title LanorTrad - Credits des chapitres (qui a fait quoi)
cd /d "%~dp0\.."
echo.
echo   LanorTrad - Serveur local des credits
echo   --------------------------------------------------
echo   Ouverture du navigateur sur http://localhost:4602
echo   (Laisse cette fenetre ouverte. Ferme-la pour arreter.)
echo.
start "" "http://localhost:4602"
node "tools\credits-server.js"
echo.
echo   Serveur arrete. Tu peux fermer cette fenetre.
pause >nul
