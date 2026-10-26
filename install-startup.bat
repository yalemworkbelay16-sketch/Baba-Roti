@echo off
title Install Baba Roti Print Agent to Windows Startup
cls
echo ======================================================================
echo   BABA ROTI CAFE - INSTALL PRINT AGENT TO WINDOWS STARTUP
echo ======================================================================
echo.

set SCRIPT_DIR=%~dp0
set VBS_TARGET=%SCRIPT_DIR%pos-agent-hidden.vbs
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
set SHORTCUT_NAME=BabaRotiPrintBridge.lnk

echo Script Location: %VBS_TARGET%
echo Startup Folder:  %STARTUP_DIR%
echo.

powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%STARTUP_DIR%\%SHORTCUT_NAME%'); $s.TargetPath = 'wscript.exe'; $s.Arguments = '\"%VBS_TARGET%\"'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.WindowStyle = 7; $s.Description = 'Baba Roti POS Silent Print Bridge Agent'; $s.Save()"

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Shortcut created in Startup folder:
    echo           %STARTUP_DIR%\%SHORTCUT_NAME%
    echo.
    echo The Print Agent will now start automatically in the background
    echo whenever Windows boots up!
    echo.
    echo Starting it now in the background...
    wscript.exe "%VBS_TARGET%"
    echo [SUCCESS] Agent is now running in the background.
) else (
    echo [ERROR] Failed to create shortcut in Startup folder.
)

echo.
pause
