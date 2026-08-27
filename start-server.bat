@echo off
cd /d "%~dp0"
echo.
echo  WEFKNGLOVE ^| Floorplan Editor
echo  ================================
echo.

:: Try Python
where python >nul 2>&1
if %errorlevel% == 0 (
    echo  Servidor iniciado en: http://localhost:8080
    echo  Abriendo el editor...
    echo  Para detener: Ctrl + C
    echo.
    start "" "http://localhost:8080/Floorplan Editor.html"
    python -m http.server 8080
    goto end
)

:: Try python3
where python3 >nul 2>&1
if %errorlevel% == 0 (
    echo  Servidor iniciado en: http://localhost:8080
    echo  Abriendo el editor...
    echo  Para detener: Ctrl + C
    echo.
    start "" "http://localhost:8080/Floorplan Editor.html"
    python3 -m http.server 8080
    goto end
)

:: Try Node / npx serve
where npx >nul 2>&1
if %errorlevel% == 0 (
    echo  Servidor iniciado en: http://localhost:8080
    echo  Abriendo el editor...
    echo  Para detener: Ctrl + C
    echo.
    start "" "http://localhost:8080/Floorplan Editor.html"
    npx --yes serve -l 8080 .
    goto end
)

:: Nothing found
echo  ERROR: No se encontro Python ni Node.js.
echo.
echo  Instala una de estas opciones:
echo    Python: https://www.python.org/downloads/
echo    Node.js: https://nodejs.org/
echo.
pause
goto end

:end
