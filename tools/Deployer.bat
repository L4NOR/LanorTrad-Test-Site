@echo off
chcp 65001 >nul
title LanorTrad - Deployer le site
cd /d "%~dp0\.."
echo.
echo   LanorTrad - Deploiement depuis cette machine
echo   --------------------------------------------------
echo   Le depot est trop lourd pour que Netlify le clone
echo   dans les 30 minutes qu'il s'accorde. C'est donc
echo   cette machine, qui a deja les fichiers, qui envoie.
echo.
echo   Seuls les fichiers que Netlify n'a pas encore
echo   seront televerses.
echo.
py "tools\deployer.py" %*
echo.
echo   Tu peux fermer cette fenetre.
pause >nul
