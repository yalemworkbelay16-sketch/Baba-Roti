@echo off
title Baba Roti Cafe - POS Print Bridge & Relay Agent
cls
color 0B
echo ======================================================================
echo   BABA ROTI CAFE - HYBRID CLOUD-TO-LOCAL PRINT BRIDGE AGENT
echo ======================================================================
echo.
echo [1] Local Loopback Bridge: http://127.0.0.1:5000 (fallback :9101)
echo [2] Outbound Long-Polling: Connects to Cloud Backend for print queue
echo [3] Direct RAW TCP:        Port 9100 to Epson, Datecs, Star, HP printers
echo.
echo Starting agent in foreground for testing and debugging...
echo (Press Ctrl+C to stop)
echo.

cd /d "%~dp0"
node pos-agent.js
pause
