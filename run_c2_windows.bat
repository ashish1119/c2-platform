@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "FRONTEND_PORT=3000"
set "BACKEND_PORT=8000"
set "ADMIN_USERNAME=admin"
set "ADMIN_PASSWORD=password"
set "ADMIN_PASSWORD_HASH="
set "SCRIPT_NAME=%~nx0"

set "MODE="
set "SERVER_HOST="
set "OPEN_BROWSER=1"
set "LAN_IP="

if /i "%~1"=="--help" goto :usage
if /i "%~1"=="-h" goto :usage

if /i "%~1"=="server" (
  set "MODE=server"
  shift
  goto :parse_flags
)

if /i "%~1"=="repair-login" (
  set "MODE=repair-login"
  shift
  goto :parse_flags
)

if /i "%~1"=="client" (
  set "MODE=client"
  if not "%~2"=="" if /i not "%~2"=="--no-browser" if /i not "%~2"=="--help" if /i not "%~2"=="-h" (
    set "SERVER_HOST=%~2"
    shift
  )
  shift
  goto :parse_flags
)

if not "%~1"=="" (
  echo [ERROR] Unknown argument: %~1
  echo.
  goto :usage
)

goto :interactive

:parse_flags
if "%~1"=="" goto :dispatch
if /i "%~1"=="--no-browser" (
  set "OPEN_BROWSER=0"
  shift
  goto :parse_flags
)
if /i "%~1"=="--help" goto :usage
if /i "%~1"=="-h" goto :usage

echo [ERROR] Unknown option: %~1
echo.
goto :usage

:interactive
echo ==================================================
echo   C2 Platform - Unified Windows Launcher
echo ==================================================
echo.
echo 1^) Server setup/deploy ^(production host^)
echo 2^) Client connect ^(operator laptop/desktop^)
echo 3^) Login recovery only ^(repair admin credentials^)
echo.
set /p CHOICE=Select mode [1-3]: 

if "%CHOICE%"=="1" (
  set "MODE=server"
  goto :dispatch
)

if "%CHOICE%"=="2" (
  set "MODE=client"
  goto :dispatch
)

if "%CHOICE%"=="3" (
  set "MODE=repair-login"
  goto :dispatch
)

echo [ERROR] Invalid choice.
exit /b 1

:dispatch
if /i "%MODE%"=="server" goto :run_server
if /i "%MODE%"=="client" goto :run_client
if /i "%MODE%"=="repair-login" goto :run_repair_login

echo [ERROR] Mode not selected.
goto :usage

:run_repair_login
echo.
echo ==================================================
echo   C2 Platform - Login Recovery Mode
echo ==================================================
echo.

echo [1/5] Checking required files...
if not exist "docker-compose.yml" (
  echo [ERROR] docker-compose.yml not found in %CD%
  exit /b 1
)

echo [2/5] Checking Docker CLI and daemon...
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker CLI not found.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] docker compose plugin not available.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker daemon is not running.
  exit /b 1
)

echo [3/5] Ensuring postgres/backend containers are running...
docker compose up -d postgres backend
if errorlevel 1 (
  echo [ERROR] Failed to start required containers.
  exit /b 1
)

echo [4/5] Waiting for backend readiness...
call :wait_for_url "http://localhost:%BACKEND_PORT%/docs" 90
if errorlevel 1 (
  echo [ERROR] Backend is not ready.
  exit /b 1
)

echo [5/5] Repairing and verifying admin login...
call :repair_admin
if errorlevel 1 (
  exit /b 1
)

echo.
echo Login repair completed successfully.
echo Use credentials:
echo   username: %ADMIN_USERNAME%
echo   password: %ADMIN_PASSWORD%
echo.
echo Open client: http://localhost:%FRONTEND_PORT%
exit /b 0

:run_server
echo.
echo ==================================================
echo   C2 Platform - Server Deployment Mode
echo ==================================================
echo.

echo [1/8] Checking required files...
if not exist "docker-compose.yml" (
  echo [ERROR] docker-compose.yml not found in %CD%
  exit /b 1
)
if not exist "docker\.env" (
  echo [ERROR] Missing docker\.env file.
  echo         Expected path: %CD%\docker\.env
  exit /b 1
)

echo [2/8] Checking Docker CLI and daemon...
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker CLI not found.
  exit /b 1
)

docker compose version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] docker compose plugin not available.
  exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker daemon is not running.
  exit /b 1
)

echo [3/8] Starting and building containers...
docker compose up -d --build --remove-orphans
if errorlevel 1 (
  echo [ERROR] Failed to start containers.
  exit /b 1
)

echo [4/8] Waiting for backend and frontend readiness...
call :wait_for_url "http://localhost:%BACKEND_PORT%/docs" 90
if errorlevel 1 (
  echo [ERROR] Backend did not become ready.
  exit /b 1
)

call :wait_for_url "http://localhost:%FRONTEND_PORT%" 90
if errorlevel 1 (
  echo [ERROR] Frontend did not become ready.
  exit /b 1
)

echo [5/8] Repairing default admin login...
call :repair_admin
if errorlevel 1 (
  exit /b 1
)

echo [6/8] Ensuring Windows Firewall allows client access...
call :ensure_firewall_rule "C2 Frontend %FRONTEND_PORT%" "%FRONTEND_PORT%"
call :ensure_firewall_rule "C2 Backend %BACKEND_PORT%" "%BACKEND_PORT%"

echo [7/8] Detecting server LAN IP...
call :detect_lan_ip

echo [8/8] Deployment summary:
docker compose ps
echo.
echo Local access:
echo   Frontend: http://localhost:%FRONTEND_PORT%
echo   Backend : http://localhost:%BACKEND_PORT%/docs
if defined LAN_IP (
  echo LAN access for client PCs:
  echo   Frontend: http://%LAN_IP%:%FRONTEND_PORT%
  echo   Backend : http://%LAN_IP%:%BACKEND_PORT%/docs
) else (
  echo [WARN] Could not auto-detect LAN IP. Use: ipconfig
)
echo.
echo Login credentials:
echo   username: %ADMIN_USERNAME%
echo   password: %ADMIN_PASSWORD%

if "%OPEN_BROWSER%"=="1" (
  start "" "http://localhost:%FRONTEND_PORT%"
)

echo.
echo Server deployment completed successfully.
exit /b 0

:run_client
if "%SERVER_HOST%"=="" (
  echo.
  set /p SERVER_HOST=Enter server IP or hostname ^(example: 192.168.1.20^): 
)

if "%SERVER_HOST%"=="" (
  echo [ERROR] Server host is required.
  exit /b 1
)

set "FRONTEND_URL=http://%SERVER_HOST%:%FRONTEND_PORT%"
set "BACKEND_URL=http://%SERVER_HOST%:%BACKEND_PORT%/docs"

echo.
echo ==================================================
echo   C2 Platform - Client Connect Mode
echo ==================================================
echo.
echo Checking frontend availability at %FRONTEND_URL% ...
call :wait_for_url "%FRONTEND_URL%" 30
if errorlevel 1 (
  echo [ERROR] Unable to reach frontend at %FRONTEND_URL%
  echo         Verify server is running and Windows Firewall allows port %FRONTEND_PORT%.
  echo         You can also test backend: %BACKEND_URL%
  exit /b 1
)

echo Frontend is reachable.
echo Login with:
echo   username: %ADMIN_USERNAME%
echo   password: %ADMIN_PASSWORD%

if "%OPEN_BROWSER%"=="1" (
  start "" "%FRONTEND_URL%"
)

echo.
echo Client connection check completed successfully.
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

:repair_admin
set "ADMIN_PASSWORD_HASH="

echo      Generating password hash via backend security module...
for /f "usebackq delims=" %%H in (`docker compose exec -T backend python -c "from app.core.security import hash_password; print(hash_password('%ADMIN_PASSWORD%'))"`) do (
  set "ADMIN_PASSWORD_HASH=%%H"
)

if "%ADMIN_PASSWORD_HASH%"=="" (
  echo [ERROR] Failed to generate admin password hash.
  exit /b 1
)

echo      Ensuring ADMIN role and admin user...
docker compose exec -T postgres psql -U postgres -d c2_db -v ON_ERROR_STOP=1 -c "INSERT INTO roles(name) VALUES ('ADMIN') ON CONFLICT (name) DO NOTHING;" >nul
if errorlevel 1 (
  echo [ERROR] Failed to ensure ADMIN role.
  exit /b 1
)

docker compose exec -T postgres psql -U postgres -d c2_db -v ON_ERROR_STOP=1 -c "UPDATE users SET hashed_password='%ADMIN_PASSWORD_HASH%', role_id=(SELECT id FROM roles WHERE name='ADMIN' LIMIT 1), is_active=TRUE WHERE username='%ADMIN_USERNAME%';" >nul
if errorlevel 1 (
  echo [ERROR] Failed to update admin user.
  exit /b 1
)

docker compose exec -T postgres psql -U postgres -d c2_db -v ON_ERROR_STOP=1 -c "INSERT INTO users (username, email, hashed_password, role_id, is_active) SELECT '%ADMIN_USERNAME%', 'admin_' || substr(md5(random()::text), 1, 8) || '@c2.local', '%ADMIN_PASSWORD_HASH%', (SELECT id FROM roles WHERE name='ADMIN' LIMIT 1), TRUE WHERE NOT EXISTS (SELECT 1 FROM users WHERE username='%ADMIN_USERNAME%');" >nul
if errorlevel 1 (
  echo [ERROR] Failed to create admin user.
  exit /b 1
)

echo      Verifying login via backend API...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $payload = @{ username = '%ADMIN_USERNAME%'; password = '%ADMIN_PASSWORD%' } | ConvertTo-Json; $resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:%BACKEND_PORT%/auth/login' -ContentType 'application/json' -Body $payload -TimeoutSec 10; if ($resp.token) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Login verification failed after repair.
  echo         Check backend logs: docker compose logs backend --tail 200
  exit /b 1
)

echo      Admin login verified.
exit /b 0

:ensure_firewall_rule
set "RULE_NAME=%~1"
set "RULE_PORT=%~2"

net session >nul 2>nul
if errorlevel 1 (
  echo      [WARN] Firewall rule skipped for %RULE_PORT% ^(run as Administrator to auto-configure firewall^).
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

:usage
echo Usage:
echo   %SCRIPT_NAME% server [--no-browser]
echo   %SCRIPT_NAME% repair-login
echo   %SCRIPT_NAME% client ^<server-ip-or-host^> [--no-browser]
echo   %SCRIPT_NAME%
echo.
echo Examples:
echo   %SCRIPT_NAME% server
echo   %SCRIPT_NAME% repair-login
echo   %SCRIPT_NAME% client 192.168.1.20
echo   %SCRIPT_NAME% client 192.168.1.20 --no-browser
exit /b 1