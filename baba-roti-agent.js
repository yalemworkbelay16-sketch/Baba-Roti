/**
 * baba-roti-agent.js – Baba Roti Cafe Network Print Relay & Loopback Bridge
 *
 * ZERO EXTERNAL DEPENDENCIES — Uses only Node.js built-in modules (net, http, https, os).
 *
 * Core Features:
 * 1. Robust TCP Socket Lifecycle (Port 9100 RAW):
 *    - socket.setNoDelay(true) for 0-latency instant packet delivery.
 *    - 2500ms fail-fast connect timeout, 8000ms write timeout.
 *    - Graceful TCP FIN closure (socket.end()) so printer hardware spools and cuts.
 *    - Dual completion handler: socket.on('close') + 1500ms fallback timer.
 * 2. Dual-Format Print Generator:
 *    - Thermal ESC/POS (Epson, Bixolon, Rongta, Xprinter, Star, Citizen, Generic) with \x1d\x56\x00 auto-cut.
 *    - HP LaserJet / PCL Laser (\x1bE reset, \x1b&l0O\x1b(s12V\x1b&k2G setup, \x0c form feed).
 * 3. Dual-Channel Operations:
 *    - Cloud Relay Poller: Long-polls cloud server for pending print jobs.
 *    - Local HTTP Bridge: Listens on port 9101 (http://127.0.0.1:9101/print) for instant browser loopback.
 *
 * Usage:
 *   node baba-roti-agent.js [CLOUD_SERVER_URL]
 *   Example: node baba-roti-agent.js https://your-restaurant-pos.com
 */

const net = require('net');
const http = require('http');
const https = require('https');
const os = require('os');

// Configuration
const CLOUD_URL = (process.argv[2] || process.env.CLOUD_URL || 'http://localhost:5000').replace(/\/+$/, '');
const LOCAL_BRIDGE_PORT = parseInt(process.env.LOCAL_BRIDGE_PORT || '9101', 10);
const AGENT_NAME = `BabaRoti-Agent@${os.hostname()}`;

console.log('='.repeat(65));
console.log('  BABA ROTI CAFÉ - NETWORK PRINTER RELAY & BRIDGE AGENT');
console.log('='.repeat(65));
console.log(`[INIT] Agent Name:       ${AGENT_NAME}`);
console.log(`[INIT] Cloud Server:     ${CLOUD_URL}`);
console.log(`[INIT] Local HTTP Bridge: http://127.0.0.1:${LOCAL_BRIDGE_PORT}`);
console.log(`[INIT] Platform:         ${os.platform()} (${os.arch()})`);
console.log('='.repeat(65));

// ── ROBUST TCP SOCKET PRINTER DISPATCH ──────────────────────────────────────

const CONNECT_TIMEOUT_MS = 2500;
const WRITE_TIMEOUT_MS   = 8000;
const CLOSE_FALLBACK_MS  = 1500;

function sendRawToPrinter(ip, port = 9100, buffer) {
  return new Promise((resolve, reject) => {
    const targetPort = Number(port) || 9100;
    const socket = new net.Socket();
    socket.setNoDelay(true); // Disable Nagle buffering

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

    const connectTimer = setTimeout(() => {
      done(new Error(`Printer connection timeout (${ip}:${targetPort})`));
    }, CONNECT_TIMEOUT_MS);

    socket.connect(targetPort, ip, () => {
      clearTimeout(connectTimer);

      writeTimer = setTimeout(() => {
        done(new Error(`Printer write timeout (${ip}:${targetPort})`));
      }, WRITE_TIMEOUT_MS);

      socket.write(buffer, (writeErr) => {
        clearTimeout(writeTimer);
        if (writeErr) return done(writeErr);

        // Send TCP FIN half-close
        try {
          socket.end();
        } catch (e) {
          return done(e);
        }

        // Safety fallback
        fallbackTimer = setTimeout(() => {
          done();
        }, CLOSE_FALLBACK_MS);
      });
    });

    socket.on('close', () => {
      done();
    });

    socket.on('error', (err) => {
      clearTimeout(connectTimer);
      done(err);
    });
  });
}

// ── DUAL FORMAT PRINT GENERATOR ─────────────────────────────────────────────

function isLaser(printer = {}) {
  const brand = String(printer.brand || '').toLowerCase();
  const model = String(printer.model || '').toLowerCase();
  const name  = String(printer.name || '').toLowerCase();
  const paper = String(printer.paperWidth || '').toLowerCase();
  const laserKeywords = ['hp', 'laser', 'laserjet', 'm402', 'm404', 'm428', 'm118', 'pcl', 'lexmark', 'brother', 'samsung', 'xerox'];
  return paper === 'a4' || laserKeywords.some(k => brand.includes(k) || model.includes(k) || name.includes(k));
}

function padEnd(str, len) {
  return String(str || '').padEnd(len).slice(0, len);
}

function twoCol(left, right, totalWidth = 42) {
  const rightStr = String(right || '');
  const leftWidth = totalWidth - rightStr.length;
  return padEnd(String(left || ''), leftWidth) + rightStr;
}

function center(str, width) {
  const s = String(str || '');
  if (s.length >= width) return s;
  const pad = Math.floor((width - s.length) / 2);
  return ' '.repeat(pad) + s;
}

function generatePrintBuffer(type, printer, order, opts = {}) {
  const isPCL = isLaser(printer);
  const now = new Date();
  const dateStr = now.toLocaleDateString();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isPCL) {
    // ── HP LaserJet / PCL Plain ASCII Mode ──
    const W = 60;
    const PCL_RESET = '\x1bE';
    const PCL_SETUP = '\x1b&l0O\x1b(s12V\x1b&k2G';
    const PCL_FF    = '\x0c';
    const lines = [PCL_RESET + PCL_SETUP, ''];

    if (type === 'kot') {
      const bName = opts.businessName || printer.headerLine1 || 'KITCHEN ORDER';
      lines.push('='.repeat(W));
      lines.push(center('** KITCHEN ORDER TICKET **', W));
      lines.push(center(bName.toUpperCase(), W));
      lines.push('='.repeat(W));
      lines.push(twoCol('Order #:', order.orderNo || '--', W));
      lines.push(twoCol('Type:', (order.orderType || 'dine_in').toUpperCase(), W));
      if (order.tableNo) lines.push(twoCol('Table:', order.tableNo, W));
      if (order.waiterName) lines.push(twoCol('Waiter:', order.waiterName, W));
      lines.push(twoCol('Date/Time:', `${dateStr} ${timeStr}`, W));
      lines.push('-'.repeat(W));
      lines.push(padEnd('ITEM', W - 10) + padEnd('QTY', 5) + 'NOTE');
      lines.push('-'.repeat(W));
      (order.items || []).forEach(it => {
        lines.push(padEnd(it.productName || it.name, W - 10) + padEnd(`x${it.quantity || 1}`, 5) + (it.notes || ''));
      });
      lines.push('='.repeat(W));
      lines.push(center('** PREPARE IMMEDIATELY **', W));
    } else {
      const hName = opts.hotelName || printer.headerLine1 || 'Baba Roti Café';
      const subtotal = (order.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
      const grandTotal = order.grandTotal || subtotal;
      lines.push(center('='.repeat(W), W));
      lines.push(center(hName.toUpperCase(), W));
      lines.push(center('CUSTOMER RECEIPT', W));
      lines.push('='.repeat(W));
      lines.push(twoCol('Receipt #:', order.orderNo || '--', W));
      lines.push(twoCol('Date/Time:', `${dateStr} ${timeStr}`, W));
      if (order.tableNo) lines.push(twoCol('Table:', order.tableNo, W));
      lines.push('-'.repeat(W));
      (order.items || []).forEach(it => {
        lines.push(twoCol(`${it.productName} x${it.quantity}`, `ETB ${(it.quantity * it.unitPrice).toFixed(2)}`, W));
      });
      lines.push('='.repeat(W));
      lines.push(twoCol('TOTAL:', `ETB ${Number(grandTotal).toFixed(2)}`, W));
      lines.push(twoCol('Payment:', order.paymentMethod || 'Cash', W));
      lines.push('='.repeat(W));
      lines.push(center(printer.footerLine || 'Thank you! Come again.', W));
    }
    lines.push('', '', PCL_FF);
    return Buffer.from(lines.join('\n'), 'utf8');
  }

  // ── Standard ESC/POS Binary Thermal Mode ──
  const W = printer.paperWidth === '58mm' ? 32 : 42;
  const ESC = 0x1b, GS = 0x1d;
  const INIT = Buffer.from([ESC, 0x40]);
  const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
  const ALIGN_LEFT   = Buffer.from([ESC, 0x61, 0x00]);
  const BOLD_ON      = Buffer.from([ESC, 0x45, 0x01]);
  const BOLD_OFF     = Buffer.from([ESC, 0x45, 0x00]);
  const DBL_ON       = Buffer.from([ESC, 0x21, 0x30]);
  const DBL_OFF      = Buffer.from([ESC, 0x21, 0x00]);
  const FEED_5       = Buffer.from([ESC, 0x64, 5]);
  const CUT_FULL     = Buffer.from([GS, 0x56, 0x00]); // \x1d\x56\x00 auto-cut

  const txt = (s) => Buffer.from(s + '\n', 'latin1');
  const chunks = [INIT, ALIGN_CENTER];

  if (type === 'kot') {
    const bName = opts.businessName || printer.headerLine1 || 'KITCHEN ORDER';
    chunks.push(DBL_ON, txt('** KITCHEN ORDER **'), DBL_OFF, BOLD_ON, txt(bName.toUpperCase()), BOLD_OFF, ALIGN_LEFT);
    chunks.push(txt('='.repeat(W)));
    chunks.push(txt(twoCol('Order #:', order.orderNo || '--', W)));
    chunks.push(txt(twoCol('Type:', (order.orderType || 'dine_in').toUpperCase(), W)));
    if (order.tableNo) chunks.push(txt(twoCol('Table:', order.tableNo, W)));
    if (order.waiterName) chunks.push(txt(twoCol('Waiter:', order.waiterName, W)));
    chunks.push(txt(twoCol('Time:', timeStr, W)));
    chunks.push(txt('-'.repeat(W)));
    chunks.push(BOLD_ON, txt(padEnd('ITEM', W - 10) + padEnd('QTY', 5) + 'NOTE'), BOLD_OFF);
    chunks.push(txt('-'.repeat(W)));
    (order.items || []).forEach(it => {
      chunks.push(BOLD_ON, txt(padEnd(it.productName || it.name, W - 10) + padEnd(`x${it.quantity || 1}`, 5) + (it.notes || '')), BOLD_OFF);
      if (it.notes) chunks.push(txt(`  >> ${it.notes}`));
    });
    chunks.push(txt('='.repeat(W)), ALIGN_CENTER, BOLD_ON, txt('** PREPARE IMMEDIATELY **'), BOLD_OFF, ALIGN_LEFT);
  } else {
    const hName = opts.hotelName || printer.headerLine1 || 'Baba Roti Café';
    const subtotal = (order.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const grandTotal = order.grandTotal || subtotal;
    chunks.push(DBL_ON, txt(hName.toUpperCase()), DBL_OFF, txt('* RECEIPT *'), ALIGN_LEFT);
    chunks.push(txt('='.repeat(W)));
    chunks.push(txt(twoCol('Receipt #:', order.orderNo || '--', W)));
    chunks.push(txt(twoCol('Date/Time:', `${dateStr} ${timeStr}`, W)));
    if (order.tableNo) chunks.push(txt(twoCol('Table:', order.tableNo, W)));
    chunks.push(txt('-'.repeat(W)));
    (order.items || []).forEach(it => {
      chunks.push(txt(twoCol(`${it.productName} x${it.quantity}`, `ETB ${(it.quantity * it.unitPrice).toFixed(2)}`, W)));
    });
    chunks.push(txt('='.repeat(W)));
    chunks.push(BOLD_ON, txt(twoCol('TOTAL:', `ETB ${Number(grandTotal).toFixed(2)}`, W)), BOLD_OFF);
    chunks.push(txt(twoCol('Payment:', order.paymentMethod || 'Cash', W)));
    chunks.push(txt('='.repeat(W)), ALIGN_CENTER, txt(printer.footerLine || 'Thank you! Come again.'));
  }

  chunks.push(FEED_5, CUT_FULL);
  return Buffer.concat(chunks);
}

// ── HTTP HELPER (Zero npm dependencies) ─────────────────────────────────────

function httpRequest(urlStr, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'BabaRoti-PrintAgent/2.0',
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      };

      let postData = null;
      if (body) {
        postData = JSON.stringify(body);
        options.headers['Content-Length'] = Buffer.byteLength(postData);
      }

      const req = lib.request(options, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ statusCode: res.statusCode, data: parsed });
          } catch (_) {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('HTTP request timeout'));
      });

      if (postData) req.write(postData);
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// ── CLOUD RELAY AGENT WORKER ────────────────────────────────────────────────

let pollActive = true;

async function sendHeartbeat() {
  try {
    await httpRequest(`${CLOUD_URL}/api/printers/relay/heartbeat`, 'POST', {
      agentName: AGENT_NAME,
      platform: os.platform(),
      version: '2.0.0',
    });
  } catch (_) {}
}

async function reportJobStatus(jobId, status, error = null) {
  try {
    await httpRequest(`${CLOUD_URL}/api/printers/relay/jobs/${jobId}/status`, 'POST', {
      status,
      error,
    });
  } catch (err) {
    console.warn(`[RELAY] Failed to report status for ${jobId}:`, err.message);
  }
}

async function processJob(job) {
  console.log(`[RELAY] Executing job #${job.id} (${job.type}) -> Printer: ${job.printer?.name} @ ${job.printer?.ipAddress}:${job.printer?.port || 9100}`);
  try {
    let buf;
    if (job.rawHex) {
      buf = Buffer.from(job.rawHex, 'hex');
    } else {
      buf = generatePrintBuffer(job.type, job.printer, job.order, job.opts || {});
    }

    const copies = Math.max(1, Math.min(5, Number(job.printer?.copies) || 1));
    const finalBuffer = copies > 1 ? Buffer.concat(Array(copies).fill(buf)) : buf;

    await sendRawToPrinter(job.printer.ipAddress, job.printer.port || 9100, finalBuffer);
    console.log(`[RELAY] Job #${job.id} printed SUCCESSFULLY to ${job.printer.ipAddress}`);
    await reportJobStatus(job.id, 'completed');
  } catch (err) {
    console.error(`[RELAY] Job #${job.id} FAILED:`, err.message);
    await reportJobStatus(job.id, 'failed', err.message);
  }
}

async function startCloudPolling() {
  setInterval(sendHeartbeat, 20000);
  sendHeartbeat();

  console.log('[RELAY] Long-polling cloud print queue started...');

  while (pollActive) {
    try {
      const res = await httpRequest(`${CLOUD_URL}/api/printers/relay/jobs?wait=1`, 'GET');
      const jobs = res?.data?.jobs || [];
      for (const job of jobs) {
        await processJob(job);
      }
      if (jobs.length === 0) {
        // Brief pause between empty polls
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      // Server offline or network blip; pause before reconnecting
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

// ── LOCAL HTTP BRIDGE LISTENER (PORT 9101) ──────────────────────────────────
// Allows local browser tabs to send prints directly to LAN printers with 0 latency.

const bridgeServer = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'ok',
      agent: AGENT_NAME,
      platform: os.platform(),
      bridgePort: LOCAL_BRIDGE_PORT,
      cloudUrl: CLOUD_URL,
    }));
  }

  if (req.method === 'POST' && req.url === '/print') {
    let bodyStr = '';
    req.on('data', (chunk) => { bodyStr += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(bodyStr || '{}');
        const { ip, port, dataHex, type, printer, order, opts } = payload;

        if (!ip) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: false, error: 'Printer IP address required' }));
        }

        let printBuffer;
        if (dataHex) {
          printBuffer = Buffer.from(dataHex, 'hex');
        } else {
          printBuffer = generatePrintBuffer(type || 'receipt', printer || { ipAddress: ip, port }, order || {}, opts || {});
        }

        console.log(`[BRIDGE] Browser direct print request -> ${ip}:${port || 9100}`);
        await sendRawToPrinter(ip, port || 9100, printBuffer);
        console.log(`[BRIDGE] Print sent successfully to ${ip}:${port || 9100}`);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: `Printed to ${ip}:${port || 9100}` }));
      } catch (err) {
        console.error('[BRIDGE] Print error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

bridgeServer.listen(LOCAL_BRIDGE_PORT, '0.0.0.0', () => {
  console.log(`[BRIDGE] Local HTTP loopback bridge active on port ${LOCAL_BRIDGE_PORT}`);
});

// Start Cloud relay polling
startCloudPolling();
