@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
title git2hdd - Web GUI

REM Chuyen ve thu muc chua file .bat (chay duoc ca khi double-click)
cd /d "%~dp0"

echo ============================================
echo   git2hdd - Kiem tra truoc khi khoi chay
echo ============================================
echo.

REM 1) Kiem tra Node.js
where node >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Node.js. Cai dat Node.js ^>= 16 tai: https://nodejs.org
  goto :fail
)
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
echo [OK] Node.js !NODE_VER!

REM 2) Kiem tra Git
where git >nul 2>nul
if errorlevel 1 (
  echo [LOI] Khong tim thay Git. Cai Git for Windows tai: https://git-scm.com/download/win
  goto :fail
)
echo [OK] Git da san sang

REM 3) Kiem tra cac file phu thuoc di kem (phong khi giai nen/sao chep thieu)
set "MISSING="
for %%F in (
  "package.json"
  "bin\git2hdd.js"
  "src\core\ServerService.js"
  "src\core\ProjectRegistry.js"
  "src\core\GitService.js"
  "src\core\ConfigService.js"
  "src\public\index.html"
  "src\public\app.js"
  "src\public\style.css"
) do (
  if not exist "%%~F" (
    echo [THIEU] %%~F
    set "MISSING=1"
  )
)
if defined MISSING (
  echo.
  echo [LOI] Thieu file phu thuoc o tren. Hay giai nen / sao chep day du thu muc du an.
  goto :fail
)
echo [OK] Day du file phu thuoc di kem

REM 4) Kiem tra dependencies (node_modules); tu dong cai neu thieu
if not exist "node_modules" (
  echo [!] Chua cai dependencies. Dang chay "npm install" ...
  call npm install
  if errorlevel 1 (
    echo [LOI] npm install that bai. Hay kiem tra ket noi mang va thu lai.
    goto :fail
  )
)
echo [OK] Dependencies san sang
echo.

echo --------------------------------------------
echo   Khoi chay Web GUI ...
echo --------------------------------------------
node bin\git2hdd.js gui %*
set "EXITCODE=%errorlevel%"
if not "%EXITCODE%"=="0" (
  echo.
  echo [LOI] git2hdd thoat voi ma loi %EXITCODE%.
  goto :fail
)

endlocal
exit /b 0

:fail
echo.
pause
endlocal
exit /b 1
