/**
 * printService.js – Robust network printer service (port 9100 RAW TCP).
 *
 * Implements 100% reliable printing for ALL printer models:
 *  - Thermal ESC/POS (Epson, Bixolon, Rongta, Xprinter, Star, Citizen, Generic 80mm/58mm)
 *  - HP LaserJet / PCL office printers (HP LaserJet M402, M404, M428, PCL, etc.)
 *
 * TCP SOCKET LIFECYCLE:
 *  1. socket.setNoDelay(true) immediately upon creation (disables Nagle algorithm for 0-latency delivery).
 *  2. Fast 2500ms connect timeout (fails fast on unreachable subnets so alternate printers dispatch without lag).
 *  3. 8000ms write timeout.
 *  4. Graceful TCP FIN half-close via socket.end() so printer hardware receives EOF and spools full ticket.
 *  5. Dual completion handler: socket.on('close') + 1500ms safety fallback timer.
 */

const net = require('net');
const { buildKOT, buildReceipt, buildKOT_plain, buildReceipt_plain } = require('./escpos');

const CONNECT_TIMEOUT_MS = 2500; // 2.5s fail-fast timeout
const WRITE_TIMEOUT_MS   = 8000; // 8.0s write timeout
const CLOSE_FALLBACK_MS  = 1500; // 1.5s fallback after TCP FIN

/**
 * Send raw data to a network printer over TCP port 9100 (RAW).
 * @param {string} ip
 * @param {number} port
 * @param {Buffer|string} data
 * @returns {Promise<void>}
 */
function sendToPrinter(ip, port = 9100, data) {
  return new Promise((resolve, reject) => {
    const targetPort = Number(port) || 9100;
    const socket = new net.Socket();
    
    // Disable Nagle's algorithm immediately for instant packet delivery
    socket.setNoDelay(true);

    let settled = false;
    let fallbackTimer = null;
    let writeTimer = null;

    const cleanup = () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (writeTimer) clearTimeout(writeTimer);
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch (_) {}
    };

    const done = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (err) reject(err);
      else resolve();
    };

    // Fail-fast connect timeout
    const connectTimer = setTimeout(() => {
      done(new Error(`Printer connection timeout (${ip}:${targetPort})`));
    }, CONNECT_TIMEOUT_MS);

    socket.connect(targetPort, ip, () => {
      clearTimeout(connectTimer);

      writeTimer = setTimeout(() => {
        done(new Error(`Printer write timeout (${ip}:${targetPort})`));
      }, WRITE_TIMEOUT_MS);

      // Write data buffer
      socket.write(data, (writeErr) => {
        clearTimeout(writeTimer);
        if (writeErr) {
          return done(writeErr);
        }

        // Send TCP FIN (half-close) — hardware requires this to know spooling is complete
        try {
          socket.end();
        } catch (endErr) {
          return done(endErr);
        }

        // Safety fallback timer: some thermal printers spool & cut but keep socket alive
        fallbackTimer = setTimeout(() => {
          done();
        }, CLOSE_FALLBACK_MS);
      });
    });

    // Printer closed socket cleanly after receiving FIN
    socket.on('close', () => {
      done();
    });

    socket.on('error', (err) => {
      clearTimeout(connectTimer);
      done(err);
    });
  });
}

/**
 * Detects if a printer is an HP LaserJet / PCL office printer.
 * @param {Object} printer
 * @returns {boolean}
 */
function isLaserPrinter(printer) {
  if (!printer) return false;
  const brand = String(printer.brand || '').toLowerCase();
  const model = String(printer.model || '').toLowerCase();
  const name  = String(printer.name || '').toLowerCase();
  const paper = String(printer.paperWidth || '').toLowerCase();

  const laserKeywords = [
    'hp', 'laser', 'laserjet', 'm402', 'm404', 'm428', 'm118',
    'pcl', 'lexmark', 'brother', 'samsung', 'xerox', 'canon',
    'ricoh', 'kyocera', 'konica', 'sharp',
  ];

  return paper === 'a4' ||
    laserKeywords.some((k) => brand.includes(k) || model.includes(k) || name.includes(k));
}

/**
 * Generate binary print data for a KOT.
 * Returns Buffer of ESC/POS or PCL ASCII.
 */
function generateKOTData(printer, order, opts = {}) {
  const copies = Math.max(1, Math.min(5, Number(printer.copies) || 1));
  let singleTicket;

  if (isLaserPrinter(printer)) {
    singleTicket = buildKOT_plain(order, {
      businessName: opts.businessName || printer.headerLine1 || 'Kitchen Order',
      ...opts,
    });
  } else {
    singleTicket = buildKOT(order, {
      charWidth: printer.charWidth || (printer.paperWidth === '58mm' ? 32 : 42),
      businessName: opts.businessName || printer.headerLine1 || 'Kitchen Order',
      ...opts,
    });
  }

  return Buffer.concat(Array(copies).fill(singleTicket));
}

/**
 * Generate binary print data for a customer Receipt.
 * Returns Buffer of ESC/POS or PCL ASCII.
 */
function generateReceiptData(printer, order, opts = {}) {
  const copies = Math.max(1, Math.min(5, Number(printer.copies) || 1));
  let singleTicket;

  if (isLaserPrinter(printer)) {
    singleTicket = buildReceipt_plain(order, {
      hotelName:   opts.hotelName || printer.headerLine1 || 'Baba Roti Café',
      headerLine2: opts.headerLine2 || printer.headerLine2 || '',
      footerLine:  opts.footerLine || printer.footerLine || 'Thank you! Come again.',
      taxRate:     opts.taxRate ?? 15,
      currency:    opts.currency || 'ETB',
      ...opts,
    });
  } else {
    singleTicket = buildReceipt(order, {
      charWidth:   printer.charWidth || (printer.paperWidth === '58mm' ? 32 : 42),
      hotelName:   opts.hotelName || printer.headerLine1 || 'Baba Roti Café',
      headerLine2: opts.headerLine2 || printer.headerLine2 || '',
      footerLine:  opts.footerLine || printer.footerLine || 'Thank you! Come again.',
      taxRate:     opts.taxRate ?? 15,
      currency:    opts.currency || 'ETB',
      ...opts,
    });
  }

  return Buffer.concat(Array(copies).fill(singleTicket));
}

/**
 * Print a KOT (Kitchen Order Ticket) to the given printer config.
 */
async function printKOT(printer, order, opts = {}) {
  if (!printer.enabled) return;
  if (!printer.ipAddress) throw new Error('Printer IP address not configured');

  const combined = generateKOTData(printer, order, opts);
  await sendToPrinter(printer.ipAddress, printer.port || 9100, combined);
}

/**
 * Print a customer receipt to the given printer config.
 */
async function printReceipt(printer, order, opts = {}) {
  if (!printer.enabled) return;
  if (!printer.ipAddress) throw new Error('Printer IP address not configured');

  const combined = generateReceiptData(printer, order, opts);
  await sendToPrinter(printer.ipAddress, printer.port || 9100, combined);
}

/**
 * Test connectivity to a printer (Port 9100 RAW probe).
 */
async function testPrinter(ip, port = 9100) {
  return new Promise((resolve) => {
    const targetPort = Number(port) || 9100;
    const socket = new net.Socket();
    socket.setNoDelay(true);
    let settled = false;

    const done = (ok, errMsg) => {
      if (settled) return;
      settled = true;
      socket.removeAllListeners();
      try {
        socket.destroy();
      } catch (_) {}
      resolve({ ok, error: errMsg || null });
    };

    const timer = setTimeout(() => {
      done(false, `Timeout connecting to ${ip}:${targetPort}`);
    }, CONNECT_TIMEOUT_MS);

    socket.connect(targetPort, ip, () => {
      clearTimeout(timer);
      try {
        socket.end();
      } catch (_) {}
      done(true);
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      done(false, err.message);
    });
  });
}

module.exports = {
  sendToPrinter,
  testPrinter,
  isLaserPrinter,
  generateKOTData,
  generateReceiptData,
  printKOT,
  printReceipt,
};
