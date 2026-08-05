@echo off
REM Bridge Tour launcher. Double-click to run the 360 virtual-tour app.
REM Pure cmd on purpose: no PowerShell, so Windows execution policy and the
REM "downloaded from the internet" block never get in the way.
cd /d "%~dp0"
title Bridge Tour

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py -3"
)

if not defined PY (
  echo.
  echo   Python 3 is required, but it was not found on this PC.
  echo.
  echo   1. Install Python from https://www.python.org/downloads/
  echo      On the FIRST install screen, tick "Add python.exe to PATH".
  echo   2. Then double-click start.bat again.
  echo.
  pause
  exit /b 1
)

echo.
echo   Bridge Tour is starting at:  http://localhost:7360
echo.
echo   A "Sample Apartment" tour is already there to walk through.
echo   Keep THIS window open while you use the app.
echo   Close it (or press Ctrl+C) to stop the server.
echo.

REM open the browser a couple of seconds later, without blocking the server
start "" /min cmd /c "ping -n 3 127.0.0.1 >nul && start http://localhost:7360"

REM run the server in THIS window so closing the window cleanly stops it
%PY% server.py

echo.
echo   Server stopped.
pause
