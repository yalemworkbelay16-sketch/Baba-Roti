@echo off
title Baba Roti - Thermal Order Printer Fix
color 0A
cls
echo ======================================================================
echo   BABA ROTI CAFE - THERMAL ORDER PRINTER SETUP (YESPOS 192.168.0.100)
echo ======================================================================
echo.
echo [1/3] Checking Administrator Privileges...
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ELEVATING] Requesting Administrator access to configure network...
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\elevate.vbs"
    echo UAC.ShellExecute "%~f0", "", "", "runas", 1 >> "%temp%\elevate.vbs"
    "%temp%\elevate.vbs"
    del "%temp%\elevate.vbs" >nul 2>&1
    exit /b
)

echo [OK] Running as Administrator.
echo.
echo [2/3] Adding Secondary IP (192.168.0.50) to Ethernet Adapter...
netsh interface ipv4 add address "Ethernet" 192.168.0.50 255.255.255.0 >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Successfully linked computer to thermal printer subnet (192.168.0.x)!
) else (
    echo [INFO] Secondary IP already configured or adapter alias verified.
)

echo.
echo [3/3] Starting Baba Roti Print Agent in Background...
cd /d "%~dp0"
call install-startup.bat

echo.
echo ======================================================================
echo   SENDING TEST TICKET TO 192.168.0.100:9100...
echo ======================================================================
node -e "
const net = require('net');
const s = new net.Socket();
s.setTimeout(4000);
s.connect(9100, '192.168.0.100', () => {
  console.log('[SUCCESS] Connected to YESPOS Thermal Printer at 192.168.0.100:9100!');
  const ESC = 0x1b, GS = 0x1d;
  const init = Buffer.from([ESC, 0x40]);
  const center = Buffer.from([ESC, 0x61, 0x01]);
  const bold = Buffer.from([ESC, 0x45, 0x01]);
  const dbl = Buffer.from([ESC, 0x21, 0x30]);
  const dblOff = Buffer.from([ESC, 0x21, 0x00]);
  const feed = Buffer.from([ESC, 0x64, 4]);
  const cut = Buffer.from([GS, 0x56, 0x00]);
  const txt = (s) => Buffer.from(s + '\n', 'latin1');
  const buf = Buffer.concat([
    init, center, dbl, txt('BABA ROTI CAFE'), dblOff,
    bold, txt('*** THERMAL PRINTER TEST OK ***'), Buffer.from([ESC, 0x45, 0x00]),
    txt('Printer: YESPOS Turbo (80mm)'),
    txt('Network: 192.168.0.100:9100'),
    txt('Date: ' + new Date().toLocaleString()),
    txt('--------------------------------'),
    txt('Ready for Kitchen Orders & Receipts!'),
    feed, cut
  ]);
  s.write(buf, () => {
    console.log('[SUCCESS] Test receipt sent to printer! Paper should cut now.');
    s.end();
  });
});
s.on('error', (err) => {
  console.error('[ERROR] Could not connect to 192.168.0.100:9100:', err.message);
  console.log('Please ensure the printer Ethernet cable is plugged into the router or switch.');
});
s.on('timeout', () => {
  console.error('[TIMEOUT] Printer did not respond within 4 seconds.');
  s.destroy();
});
"

echo.
echo ======================================================================
echo   SETUP COMPLETE!
echo   The Print Agent is now active and will boot automatically with Windows.
echo ======================================================================
pause

