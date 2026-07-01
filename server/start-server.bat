@echo off
REM Hermes Notes Sync Server - Lanceur Windows
REM Demarre le serveur de synchronisation (API + client web)
cd /d "%~dp0"
echo Demarrage du serveur Hermes Notes Sync sur http://127.0.0.1:8787 ...
node server.js --static ../client
pause
