@echo off
title Stop Baba Roti Print Bridge Agent
cls
echo Stopping any running pos-agent or baba-roti-agent background processes...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*pos-agent*' -or $_.CommandLine -like '*baba-roti-agent*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Write-Host ('Stopped Process ID: ' + $_.ProcessId) }"
echo.
echo Print agent stopped.
pause
