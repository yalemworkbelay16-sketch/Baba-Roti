@echo off
set "SCRIPT_DIR=%~dp0"
set "TARGET_BAT=%SCRIPT_DIR%start-printer-agent.bat"
powershell -NoProfile -Command "$desktop = [Environment]::GetFolderPath('Desktop'); $ws = New-Object -ComObject WScript.Shell; $shortcutPath = Join-Path $desktop 'Start Baba Roti Printer Agent.lnk'; $s = $ws.CreateShortcut($shortcutPath); $s.TargetPath = '%TARGET_BAT%'; $s.WorkingDirectory = '%SCRIPT_DIR%'; $s.WindowStyle = 1; $s.Description = 'Start Baba Roti Cafe Printer Bridge Agent'; $s.Save(); Write-Host 'SUCCESS: Created shortcut at' $shortcutPath"
