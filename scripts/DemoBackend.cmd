@echo off
setlocal
cd /d "%~dp0.."
if exist ".runtime\toolchain\node-v24.21.0-win-x64\node.exe" set "PATH=%CD%\.runtime\toolchain\node-v24.21.0-win-x64;%PATH%"
set "NPM_CONFIG_CACHE=%CD%\.runtime\cache\npm"
set "TEMP=%CD%\.runtime\cache\temp"
set "TMP=%CD%\.runtime\cache\temp"
set "NODE_COMPILE_CACHE=%CD%\.runtime\cache\node-compile"
if not exist "%TEMP%" mkdir "%TEMP%"
if "%~1"=="" (
  node --import tsx apps/api/scripts/demo.ts start
) else (
  node --import tsx apps/api/scripts/demo.ts %*
)
if errorlevel 1 (
  echo Demo command failed. Port 3000 was not stopped. Review configuration before retrying.
  pause
  exit /b 1
)
if "%~1"=="" pause
