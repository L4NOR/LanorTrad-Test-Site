@echo off
chcp 65001 >nul
title LanorTrad - L'atelier (avancement des chapitres)
cd /d "%~dp0\.."
echo.
echo   LanorTrad - Serveur local de l'atelier
echo   --------------------------------------------------
echo   Ouverture du navigateur sur http://localhost:4601
echo   (Laisse cette fenetre ouverte. Ferme-la pour arreter.)
echo.
start "" "http://localhost:4601"
node "tools\atelier-server.js"
echo.
echo   Serveur arrete. Tu peux fermer cette fenetre.
pause >nul
