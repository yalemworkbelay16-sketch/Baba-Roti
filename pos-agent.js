/**
 * pos-agent.js – Baba Roti Cafe Hybrid Cloud-to-Local Print Bridge & Relay Agent
 *
 * ZERO EXTERNAL NPM DEPENDENCIES — Uses only Node.js built-ins (net, http, https, os, fs, path).
 *
 * Architecture:
 * 1. Outbound Long-Polling: Connects to Cloud Backend (/api/printers/relay/poll)
 *    to receive pending print jobs (ping, kot, receipt, test_page) and executes
 *    them directly against the local network printer IP:9100.
 * 2. Local Loopback HTTP Bridge: Listens on http://127.0.0.1:5000 (fallback 9101)
 *    with Private Network Access (PNA) headers so browser apps get instant (<5ms)
 *    direct printing when run on the same terminal.
 * 3. RAW TCP Socket to Port 9100: Non-blocking, 0-latency TCP socket delivery
 *    with graceful TCP FIN spooling for thermal cutters & PCL page ejects.
 * 4. Dual Format Engine:
 *    - ESC/POS binary format for thermal rolls (Epson, Datecs, Bixolon, Xprinter, Star, etc.)
 *    - PCL / ASCII plain text format for HP LaserJet / office laser printers.
 */

const net = require('net');
const http = require('http');
const https = require('https');
const os = require('os');
const fs = require('fs');
const path = require('path');

// ── Configuration Loader ────────────────────────────────────────────────────
let fileConfig = {};
const configPath = path.join(__dirname, 'agent-config.json');
try {
  if (fs.existsSync(configPath)) {
    fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (e) {
  console.warn('[CONFIG] Failed to read agent-config.json, using defaults:', e.message);
}

const RESTAURANT_NAME = fileConfig.restaurantName || process.env.RESTAURANT_NAME || 'Baba Roti Café';
const CLOUD_URL = (
  process.argv[2] ||
  process.env.CLOUD_BACKEND_URL ||
  process.env.CLOUD_URL ||
  fileConfig.cloudBackendUrl ||
  'https://baba-roti-1.app.aletcloud.com'
).replace(/\/+$/, '');

const PREFERRED_PORT = parseInt(process.argv[3] || process.env.LOCAL_PORT || fileConfig.localBridgePort || '5000', 10);
const FALLBACK_PORT = parseInt(fileConfig.fallbackBridgePort || '9101', 10);
const AGENT_NAME = `POSAgent@${os.hostname()}`;
const CONNECT_TIMEOUT_MS = parseInt(fileConfig.connectTimeoutMs || '2500', 10);
const WRITE_TIMEOUT_MS   = parseInt(fileConfig.writeTimeoutMs || '8000', 10);
const CLOSE_FALLBACK_MS  = 1500;

console.log('='.repeat(70));
console.log(`  ${RESTAURANT_NAME.toUpperCase()} - HYBRID CLOUD PRINT BRIDGE AGENT`);
console.log('='.repeat(70));
console.log(`[INIT] Agent Name:       ${AGENT_NAME}`);
console.log(`[INIT] Cloud Backend:    ${CLOUD_URL}`);
console.log(`[INIT] Preferred Bridge: Port ${PREFERRED_PORT} (fallback ${FALLBACK_PORT})`);
console.log(`[INIT] Host System:      ${os.platform()} (${os.arch()})`);
console.log('='.repeat(70));

// ── RAW TCP SOCKET TO PRINTER (PORT 9100) ───────────────────────────────────

/**
 * Ping printer over raw TCP socket.
 */
function pingPrinterSocket(ip, port = 9100, timeout = CONNECT_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const targetPort = Number(port) || 9100;
    const socket = new net.Socket();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        resolve({ ok: false, error: `Connection timeout (${ip}:${targetPort})` });
      }
    }, timeout);

    socket.connect(targetPort, ip, () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ ok: true, latencyMs: Date.now() });
      }
    });

    socket.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        socket.destroy();
        resolve({ ok: false, error: err.message });
      }
    });
  });
}

/**
 * Send raw byte buffer to printer over TCP port 9100.
 */
function sendRawToPrinter(ip, port = 9100, buffer) {
  return new Promise((resolve, reject) => {
    const targetPort = Number(port) || 9100;
    const socket = new net.Socket();
    socket.setNoDelay(true); // Disable Nagle's algorithm for instant 0-latency delivery

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

        // Send TCP FIN half-close: essential for printer hardware to spool and trigger cut
        try {
          socket.end();
        } catch (e) {
          return done(e);
        }

        // Safety fallback timer for thermal printers that don't emit TCP close
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
  return padEnd(String(left || ''), Math.max(0, leftWidth)) + rightStr;
}

function center(str, width) {
  const s = String(str || '');
  if (s.length >= width) return s;
  const pad = Math.floor((width - s.length) / 2);
  return ' '.repeat(pad) + s;
}

function generatePrintBuffer(type, printer, order = {}, opts = {}) {
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
      const bName = opts.businessName || printer.headerLine1 || RESTAURANT_NAME;
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
      const hName = opts.hotelName || printer.headerLine1 || RESTAURANT_NAME;
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
        lines.push(twoCol(`${it.productName || it.name} x${it.quantity}`, `ETB ${(it.quantity * it.unitPrice).toFixed(2)}`, W));
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

  // ── Standard ESC/POS Binary Thermal Mode (Epson, Datecs, Bixolon, Rongta, etc.) ──
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
  const CUT_FULL     = Buffer.from([GS, 0x56, 0x00]);

  const txt = (s) => Buffer.from(s + '\n', 'latin1');
  const chunks = [INIT, ALIGN_CENTER];

  if (type === 'kot') {
    const bName = opts.businessName || printer.headerLine1 || RESTAURANT_NAME;
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
    const hName = opts.hotelName || printer.headerLine1 || RESTAURANT_NAME;
    const subtotal = (order.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const grandTotal = order.grandTotal || subtotal;
    chunks.push(DBL_ON, txt(hName.toUpperCase()), DBL_OFF, txt('* RECEIPT *'), ALIGN_LEFT);
    chunks.push(txt('='.repeat(W)));
    chunks.push(txt(twoCol('Receipt #:', order.orderNo || '--', W)));
    chunks.push(txt(twoCol('Date/Time:', `${dateStr} ${timeStr}`, W)));
    if (order.tableNo) chunks.push(txt(twoCol('Table:', order.tableNo, W)));
    chunks.push(txt('-'.repeat(W)));
    (order.items || []).forEach(it => {
      chunks.push(txt(twoCol(`${it.productName || it.name} x${it.quantity}`, `ETB ${(it.quantity * it.unitPrice).toFixed(2)}`, W)));
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
          'User-Agent': 'BabaRoti-POSAgent/2.5',
          'Content-Type': 'application/json',
        },
        timeout: 30000,
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

// ── CLOUD RELAY WORKER (OUTBOUND LONG-POLLING) ──────────────────────────────

let pollActive = true;

async function sendHeartbeat() {
  try {
    await httpRequest(`${CLOUD_URL}/api/printers/relay/heartbeat`, 'POST', {
      agentName: AGENT_NAME,
      platform: os.platform(),
      version: '2.5.0',
    });
  } catch (_) {}
}

async function reportJobStatus(jobId, status, error = null, extra = {}) {
  try {
    // Report to both /relay/complete and /relay/jobs/:jobId/status for max compatibility
    await httpRequest(`${CLOUD_URL}/api/printers/relay/complete`, 'POST', {
      jobId,
      status,
      ok: status === 'completed',
      error,
      ...extra,
    }).catch(async () => {
      await httpRequest(`${CLOUD_URL}/api/printers/relay/jobs/${jobId}/status`, 'POST', {
        status,
        error,
      });
    });
  } catch (err) {
    console.warn(`[RELAY] Failed to report status for job ${jobId}:`, err.message);
  }
}

async function processRelayJob(job) {
  const pIp = job.printer?.ipAddress || job.ip;
  const pPort = job.printer?.port || job.port || 9100;
  console.log(`[RELAY] Executing job #${job.id} (${job.type}) -> Printer: ${job.printer?.name || 'Printer'} @ ${pIp}:${pPort}`);

  if (job.type === 'ping') {
    const pingRes = await pingPrinterSocket(pIp, pPort);
    if (pingRes.ok) {
      console.log(`[RELAY] Ping job #${job.id} SUCCESS -> ${pIp}:${pPort}`);
      await reportJobStatus(job.id, 'completed', null, { ok: true, latencyMs: pingRes.latencyMs });
    } else {
      console.warn(`[RELAY] Ping job #${job.id} FAILED -> ${pIp}:${pPort} (${pingRes.error})`);
      await reportJobStatus(job.id, 'failed', pingRes.error, { ok: false });
    }
    return;
  }

  try {
    let buf;
    if (job.rawHex) {
      buf = Buffer.from(job.rawHex, 'hex');
    } else {
      buf = generatePrintBuffer(job.type, job.printer || { ipAddress: pIp, port: pPort }, job.order || {}, job.opts || {});
    }

    const copies = Math.max(1, Math.min(5, Number(job.printer?.copies) || 1));
    const finalBuffer = copies > 1 ? Buffer.concat(Array(copies).fill(buf)) : buf;

    await sendRawToPrinter(pIp, pPort, finalBuffer);
    console.log(`[RELAY] Job #${job.id} (${job.type}) PRINTED SUCCESSFULLY to ${pIp}:${pPort}`);
    await reportJobStatus(job.id, 'completed', null, { ok: true });
  } catch (err) {
    console.error(`[RELAY] Job #${job.id} PRINT FAILED:`, err.message);
    await reportJobStatus(job.id, 'failed', err.message, { ok: false });
  }
}

async function startCloudPolling() {
  setInterval(sendHeartbeat, 15000);
  sendHeartbeat();

  console.log('[RELAY] Long-polling cloud print queue started at:', `${CLOUD_URL}/api/printers/relay/poll`);

  while (pollActive) {
    try {
      // Primary: /relay/poll?wait=true. Fallback: /relay/jobs?wait=1
      let res;
      try {
        res = await httpRequest(`${CLOUD_URL}/api/printers/relay/poll?wait=true&agentName=${encodeURIComponent(AGENT_NAME)}`, 'GET');
      } catch (_) {
        res = await httpRequest(`${CLOUD_URL}/api/printers/relay/jobs?wait=1`, 'GET');
      }

      const jobs = res?.data?.jobs || [];
      for (const job of jobs) {
        await processRelayJob(job);
      }
      if (jobs.length === 0) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (err) {
      // Backoff if cloud is unreachable
      await new Promise((r) => setTimeout(r, 4000));
    }
  }
}

// ── LOCAL LOOPBACK HTTP BRIDGE (PORT 5000 / FALLBACK 9101) ─────────────────
// Allows browser apps on local machine to print directly with <5ms latency.
// Includes Private Network Access (PNA) headers so Chrome / Edge permit local calls.

function createLoopbackServer(port, onListening) {
  const server = http.createServer(async (req, res) => {
    // Full CORS and Chrome Private Network Access (PNA)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const parsedUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
    const pathname = parsedUrl.pathname;

    // Health check
    if (req.method === 'GET' && (pathname === '/' || pathname === '/health' || pathname === '/api/health')) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        restaurant: RESTAURANT_NAME,
        agent: AGENT_NAME,
        platform: os.platform(),
        bridgePort: port,
        cloudUrl: CLOUD_URL,
        timestamp: Date.now(),
      }));
    }

    // Direct /print or API action endpoints
    if (req.method === 'POST') {
      let bodyStr = '';
      req.on('data', (c) => { bodyStr += c; });
      req.on('end', async () => {
        try {
          const payload = JSON.parse(bodyStr || '{}');

          // 1. Direct TCP Ping (/api/printers/action/ping)
          if (pathname === '/api/printers/action/ping' || pathname === '/ping') {
            const ip = payload.ip || payload.ipAddress;
            const targetPort = payload.port || 9100;
            if (!ip) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ ok: false, error: 'Printer IP address required' }));
            }
            const pingRes = await pingPrinterSocket(ip, targetPort);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify(pingRes));
          }

          // 2. Print ticket (/print, /api/printers/action/kot, /action/receipt, /action/test-page)
          const ip = payload.ip || payload.ipAddress || payload.printer?.ipAddress;
          const targetPort = payload.port || payload.printer?.port || 9100;

          if (!ip) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'Target printer IP address required' }));
          }

          let type = payload.type || 'receipt';
          if (pathname.includes('/kot')) type = 'kot';
          if (pathname.includes('/receipt') || pathname.includes('/test-page')) type = 'receipt';

          let printBuffer;
          if (payload.dataHex) {
            printBuffer = Buffer.from(payload.dataHex, 'hex');
          } else {
            const printerObj = payload.printer || { ipAddress: ip, port: targetPort, brand: payload.brand, model: payload.model };
            printBuffer = generatePrintBuffer(type, printerObj, payload.order || {}, payload.opts || {});
          }

          const copies = Math.max(1, Math.min(5, Number(payload.printer?.copies) || 1));
          const finalBuffer = copies > 1 ? Buffer.concat(Array(copies).fill(printBuffer)) : printBuffer;

          console.log(`[BRIDGE] Direct browser print dispatched -> ${ip}:${targetPort} (${type})`);
          await sendRawToPrinter(ip, targetPort, finalBuffer);
          console.log(`[BRIDGE] Print completed successfully to ${ip}:${targetPort}`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, message: `Printed to ${ip}:${targetPort}`, method: 'local_bridge' }));
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

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (port === PREFERRED_PORT && FALLBACK_PORT !== PREFERRED_PORT) {
        console.warn(`[BRIDGE] Port ${port} is in use; falling back to port ${FALLBACK_PORT}...`);
        createLoopbackServer(FALLBACK_PORT, onListening);
        return;
      }
    }
    console.error(`[BRIDGE] Server error on port ${port}:`, err.message);
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[BRIDGE] Local HTTP Loopback Bridge ACTIVE on http://127.0.0.1:${port}`);
    if (onListening) onListening(port);
  });

  return server;
}

createLoopbackServer(PREFERRED_PORT, () => {
  startCloudPolling();
});
