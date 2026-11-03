@echo off
title Baba Roti Cafe - POS Print Bridge & Relay Agent
cls
color 0B
echo ======================================================================
echo   BABA ROTI CAFE - HYBRID CLOUD-TO-LOCAL PRINT BRIDGE AGENT
echo ======================================================================
echo.
echo [1] Local Loopback Bridge: http://127.0.0.1:9101 (fallback :9102)
echo [2] Outbound Long-Polling: Connects to Cloud Backend (baba-roti-1.app.aletcloud.com)
echo [3] Direct RAW TCP:        Port 9100 to HP LaserJet (10.241.18.48) & Thermal Printers
echo.
echo Checking Node.js installation...
node -v >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not in PATH!
    echo Please install Node.js from https://nodejs.org to run the print bridge.
    echo Alternatively, you can use "Windows / System Printer" in Settings with no setup.
    pause
    exit /b 1
)

cd /d "%~dp0"

echo Starting agent...
echo (Keep this window open while the restaurant is operating, or run install-startup.bat)
echo.
node pos-agent.js
pause
