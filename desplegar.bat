@echo off
chcp 65001 >nul
title Beach Sports - publicar en Firebase
cd /d "%~dp0"
echo.
echo === Beach Sports: publicar en Firebase (beachsportscubelles) ===
echo.
where node >nul 2>nul || (echo FALTA Node.js. Instalalo desde https://nodejs.org ^(boton LTS^) y vuelve a abrir este archivo. & pause & exit /b 1)
echo 1/3  Inicia sesion con tu cuenta de Google (se abre el navegador)...
call npx --yes firebase-tools@15 login
echo.
echo 2/3  Subiendo el juego web y la carpeta de la TrimUI...
call npx --yes firebase-tools@15 deploy --only hosting --project beachsportscubelles
if errorlevel 1 (echo. & echo ERROR al publicar. Haz una foto de esta ventana. & pause & exit /b 1)
echo.
echo 3/3  Reglas de la base de datos (si no has creado Firestore, este paso puede fallar: no pasa nada)...
call npx --yes firebase-tools@15 deploy --only firestore:rules --project beachsportscubelles
echo.
echo ================== LISTO ==================
echo  Juego para el movil:   https://beachsportscubelles.web.app
echo  Pasos para la TrimUI:  https://beachsportscubelles.web.app/trimui/
echo ===========================================
pause
