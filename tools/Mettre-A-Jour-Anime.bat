@echo off
chcp 65001 >nul
title LanorTrad - Episodes des animes (titres + miniatures)
cd /d "%~dp0\.."
echo.
echo   LanorTrad - Mise a jour des episodes d'anime
echo   --------------------------------------------------
echo   Va chercher chez Aniverse le titre, la date et la
echo   miniature des episodes qui manquent encore.
echo.
echo   A lancer apres la sortie d'un nouvel episode.
echo   (Les LIENS, eux, marchent deja tout seuls : le site
echo    sait quels episodes sont sortis sans ce script.)
echo.
node "tools\build-anime.js"
echo.
echo   Termine. Pense a deployer avec tools\Deployer.bat
pause >nul
