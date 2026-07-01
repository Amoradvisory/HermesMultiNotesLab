@echo off
REM Hermes Multi Notes Lab - Lanceur
REM Version 1.0.0

echo Lancement de Hermes Multi Notes Lab...
echo ======================================

cd /d "%~dp0"

python src/main.py

if %ERRORLEVEL% NEQ 0 (
    echo Erreur lors de l'exécution de l'application.
    pause
    exit /b 1
)

echo.
echo Application fermée.
pause