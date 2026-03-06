@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "OPEN_BROWSER=1"
set "LAN_IP="
if /i "%~1"=="--no-browser" set "OPEN_BROWSER=0"

echo ==================================================
echo   C2 Platform - Docker Deploy (All Services)
echo ==================================================
echo.

echo [1/8] Checking project files...
if not exist "docker-compose.yml" (
  echo [ERROR] docker-compose.yml not found in %CD%
  exit /b 1
)

echo [2/8] Checking Docker CLI and daemon...
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker CLI not found. Install Docker Desktop first.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] docker compose plugin is not available.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker daemon is not running.
  exit /b 1
)

echo [3/8] Building and starting frontend, backend and db...
docker compose up -d --build --remove-orphans postgres backend frontend
if errorlevel 1 (
  echo [ERROR] Failed to deploy Docker services.
  exit /b 1
)

echo [4/8] Configuring firewall for client access...
call :ensure_firewall_rule "C2 Frontend 3000" "3000"
call :ensure_firewall_rule "C2 Backend 8000" "8000"

echo [5/8] Waiting for backend readiness...
call :wait_for_url "http://localhost:8000/docs" 90
if errorlevel 1 (
  echo [ERROR] Backend is not ready at http://localhost:8000/docs
  exit /b 1
)

echo [6/8] Waiting for frontend readiness...
call :wait_for_url "http://localhost:3000" 90
if errorlevel 1 (
  echo [ERROR] Frontend is not ready at http://localhost:3000
  exit /b 1
)

echo [7/8] Detecting LAN IP for client PCs...
call :detect_lan_ip

echo [8/8] Deployment complete.
docker compose ps
echo.
echo Frontend: http://localhost:3000
echo Backend : http://localhost:8000/docs
echo Postgres: localhost:5432
if defined LAN_IP (
  echo.
  echo Client PC URL:
  echo Frontend: http://%LAN_IP%:3000
  echo Backend : http://%LAN_IP%:8000/docs
) else (
  echo.
  echo [WARN] Could not auto-detect LAN IP. Use ipconfig to find server IPv4.
)

if "%OPEN_BROWSER%"=="1" (
  start "" "http://localhost:3000"
)

exit /b 0

:ensure_firewall_rule
set "RULE_NAME=%~1"
set "RULE_PORT=%~2"

net session >nul 2>nul
if errorlevel 1 (
  echo      [WARN] Firewall rule skipped for port %RULE_PORT% ^(run CMD as Administrator^).
  exit /b 0
)

netsh advfirewall firewall show rule name="%RULE_NAME%" >nul 2>nul
if errorlevel 1 (
  netsh advfirewall firewall add rule name="%RULE_NAME%" dir=in action=allow protocol=TCP localport=%RULE_PORT% >nul 2>nul
  if errorlevel 1 (
    echo      [WARN] Failed to add firewall rule for port %RULE_PORT%.
    exit /b 0
  )
  echo      Firewall rule added for port %RULE_PORT%.
) else (
  echo      Firewall rule already exists for port %RULE_PORT%.
)

exit /b 0

:detect_lan_ip
set "LAN_IP="

for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' -and $_.InterfaceAlias -notmatch 'Loopback|vEthernet|VirtualBox|VMware|Hyper-V|Docker' } ^| Select-Object -First 1 -ExpandProperty IPAddress; if(-not $ip){$ip = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue ^| Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254*' } ^| Select-Object -First 1 -ExpandProperty IPAddress}; if($ip){Write-Output $ip}"`) do (
  set "LAN_IP=%%I"
)

set "LAN_IP=!LAN_IP: =!"

if not defined LAN_IP (
  for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /I "IPv4"') do (
    set "CANDIDATE=%%I"
    set "CANDIDATE=!CANDIDATE: =!"
    set "CANDIDATE=!CANDIDATE:(Preferred)=!"
    if not "!CANDIDATE!"=="" if /I not "!CANDIDATE!"=="127.0.0.1" if /I not "!CANDIDATE:~0,8!"=="169.254." (
      set "LAN_IP=!CANDIDATE!"
      goto :detect_lan_ip_done
    )
  )
)

:detect_lan_ip_done
exit /b 0

:wait_for_url
set "TARGET_URL=%~1"
set "MAX_RETRIES=%~2"
if "%MAX_RETRIES%"=="" set "MAX_RETRIES=60"

for /l %%i in (1,1,%MAX_RETRIES%) do (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -UseBasicParsing -Uri '%TARGET_URL%' -TimeoutSec 3; if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
  if !errorlevel! equ 0 exit /b 0
  timeout /t 2 /nobreak >nul
)

exit /b 1
