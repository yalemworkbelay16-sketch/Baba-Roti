@echo off
title Baba Roti - Local Print Relay Agent
cls
echo ========================================================
echo   Baba Roti Cafe - Local Print Relay Agent & Bridge
echo ========================================================
echo.
echo Starting local print bridge on port 9101...
echo Long-polling cloud print jobs and routing to local LAN printers.
echo.
cd /d "%~dp0"
node baba-roti-agent.js
pause
