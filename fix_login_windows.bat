@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

set "ADMIN_USERNAME=admin"
set "ADMIN_PASSWORD=password"
set "ADMIN_PASSWORD_HASH="

echo ==================================================
echo   C2 Platform - Login Recovery (Windows)
echo ==================================================
echo.

echo [1/6] Checking docker compose project...
if not exist "docker-compose.yml" (
  echo [ERROR] docker-compose.yml not found in %CD%
  exit /b 1
)

echo [2/6] Checking Docker availability...
where docker >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker CLI not found.
  exit /b 1
)
docker info >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Docker daemon is not running.
  exit /b 1
)

echo [3/6] Ensuring postgres/backend containers are running...
docker compose up -d postgres backend
if errorlevel 1 (
  echo [ERROR] Failed to start required containers.
  exit /b 1
)

echo [4/6] Waiting for backend readiness...
call :wait_for_url "http://localhost:8000/docs" 90
if errorlevel 1 (
  echo [ERROR] Backend is not ready.
  exit /b 1
)

echo      Generating password hash from backend security module...
for /f "usebackq delims=" %%H in (`docker compose exec -T backend python -c "from app.core.security import hash_password; print(hash_password('%ADMIN_PASSWORD%'))"`) do (
  set "ADMIN_PASSWORD_HASH=%%H"
)
if "%ADMIN_PASSWORD_HASH%"=="" (
  echo [ERROR] Failed to generate password hash.
  exit /b 1
)

echo [5/6] Repairing default admin user in database...
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

echo [6/6] Verifying login with backend API...
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $payload = @{ username = '%ADMIN_USERNAME%'; password = '%ADMIN_PASSWORD%' } | ConvertTo-Json; $resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:8000/auth/login' -ContentType 'application/json' -Body $payload -TimeoutSec 10; if ($resp.token) { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Login verification failed after repair.
  echo         Check backend logs: docker compose logs backend --tail 200
  exit /b 1
)

echo.
echo Login repair completed successfully.
echo Use credentials:
echo   username: %ADMIN_USERNAME%
echo   password: %ADMIN_PASSWORD%
echo.
echo Open client: http://localhost:3000
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
