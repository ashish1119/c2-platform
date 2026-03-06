@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

if not exist "%ROOT_DIR%run_c2_windows.bat" (
  echo [ERROR] run_c2_windows.bat not found in %ROOT_DIR%
  exit /b 1
)

call "%ROOT_DIR%run_c2_windows.bat" repair-login %*
exit /b %errorlevel%
