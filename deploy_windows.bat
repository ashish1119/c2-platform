@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "OPEN_BROWSER=1"
if /i "%~1"=="--no-browser" set "OPEN_BROWSER=0"

echo ==================================================
echo   C2 Platform - Windows Workstation Deployment
echo ==================================================
echo.

echo [1/7] Checking required files...
if not exist "docker-compose.yml" (
  echo [ERROR] docker-compose.yml not found in %CD%
  exit /b 1
)
if not exist "docker\.env" (
  echo [ERROR] Missing docker\.env file.
  echo         Expected path: %CD%\docker\.env
  exit /b 1
)

echo [2/7] Checking Docker CLI...
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker CLI not found.
  echo         Install Docker Desktop and ensure Docker is in PATH.
  exit /b 1
)

echo [3/7] Checking Docker Compose plugin...
docker compose version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] docker compose is not available.
  echo         Update Docker Desktop to a version with Compose V2.
  exit /b 1
)

echo [4/7] Checking Docker daemon...
docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker daemon is not running.
  echo         Start Docker Desktop, wait until ready, then retry.
  exit /b 1
)

echo [5/7] Starting platform containers...
docker compose up -d --build --remove-orphans
if errorlevel 1 (
  echo [ERROR] Failed to start containers.
  exit /b 1
)

set "BACKEND_URL=http://localhost:8000/docs"
set "FRONTEND_URL=http://localhost:3000"

echo [6/7] Waiting for backend and frontend readiness...
call :wait_for_url "%BACKEND_URL%" 90
if errorlevel 1 (
  echo [ERROR] Backend did not become ready at %BACKEND_URL%
  exit /b 1
)

call :wait_for_url "%FRONTEND_URL%" 90
if errorlevel 1 (
  echo [ERROR] Frontend did not become ready at %FRONTEND_URL%
  exit /b 1
)

echo [7/7] Deployment ready.
docker compose ps

if "%OPEN_BROWSER%"=="1" (
  echo Opening client in default browser: %FRONTEND_URL%
  start "" "%FRONTEND_URL%"
) else (
  echo Browser launch skipped ^(--no-browser^).
)

echo.
echo Completed successfully.
exit /b 0

:wait_for_url
set "TARGET_URL=%~1"
set "MAX_RETRIES=%~2"
if "%MAX_RETRIES%"=="" set "MAX_RETRIES=60"

for /l %%i in (1,1,%MAX_RETRIES%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%TARGET_URL%' -TimeoutSec 3; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if !errorlevel! equ 0 (
    echo      Ready: %TARGET_URL%
    exit /b 0
  )
  timeout /t 2 /nobreak >nul
)

exit /b 1
