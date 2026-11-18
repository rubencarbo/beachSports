#!/bin/bash
# Doble clic en Mac (o "bash desplegar.command" en Linux)
cd "$(dirname "$0")"
echo; echo "=== Beach Sports: publicar en Firebase (beachsportscubelles) ==="; echo
command -v node >/dev/null || { echo "FALTA Node.js. Instálalo desde https://nodejs.org (botón LTS) y vuelve a abrir este archivo."; read -p "Pulsa Intro"; exit 1; }
echo "1/3  Inicia sesión con tu cuenta de Google (se abre el navegador)..."
npx --yes firebase-tools@15 login
echo; echo "2/3  Subiendo el juego web y la carpeta de la TrimUI..."
npx --yes firebase-tools@15 deploy --only hosting --project beachsportscubelles || { echo "ERROR al publicar. Haz una foto de esta ventana."; read -p "Pulsa Intro"; exit 1; }
echo; echo "3/3  Reglas de la base de datos (si no has creado Firestore puede fallar: no pasa nada)..."
npx --yes firebase-tools@15 deploy --only firestore:rules --project beachsportscubelles
echo; echo "================== LISTO =================="
echo " Juego para el móvil:   https://beachsportscubelles.web.app"
echo " Pasos para la TrimUI:  https://beachsportscubelles.web.app/trimui/"
echo "==========================================="
read -p "Pulsa Intro para cerrar"
