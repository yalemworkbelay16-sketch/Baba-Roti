const asyncHandler = require('express-async-handler');
const PrinterSettings = require('../models/PrinterSettings');
const {
  testPrinter,
  printKOT,
  printReceipt,
  generateKOTData,
  generateReceiptData,
  isLaserPrinter,
} = require('../utils/printService');

// ── In-Memory Cloud Relay Queue & State ─────────────────────────────────────
// Allows cloud-hosted backends (Render, Aletcloud, Docker, AWS) to dispatch
// print jobs across private LAN subnets via the standalone Local Relay Agent.
const relayQueue = [];
let relayAgentState = {
  lastHeartbeat: null,
  agentName: null,
  ip: null,
  platform: null,
  version: '2.5.0',
};

const AGENT_TIMEOUT_MS = 60 * 1000; // Agent considered online if heartbeat within 60s
const waitingPollers = []; // Long-polling client listeners
const pendingRelayResolvers = new Map(); // jobId -> { resolve, timer }

function isRelayAgentOnline() {
  if (!relayAgentState.lastHeartbeat) return false;
  return Date.now() - relayAgentState.lastHeartbeat < AGENT_TIMEOUT_MS;
}

const hasActiveRelayAgent = isRelayAgentOnline;

function waitForRelayJob(jobId, timeoutMs = 4500) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingRelayResolvers.delete(jobId);
      resolve({ ok: false, error: 'Relay execution timeout' });
    }, timeoutMs);

    pendingRelayResolvers.set(jobId, { resolve, timer });
  });
}

function queueRelayJob(type, printer, order, opts = {}) {
  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Pre-generate raw hex data payload so local agent needs 0 processing logic if desired
  let rawHex = null;
  try {
    const rawBuf = type === 'kot'
      ? generateKOTData(printer, order, opts)
      : generateReceiptData(printer, order, opts);
    rawHex = rawBuf.toString('hex');
  } catch (_) {}

  const job = {
    id: jobId,
    type,
    printer: {
      id: printer._id,
      name: printer.name,
      ipAddress: printer.ipAddress,
      port: printer.port || 9100,
      brand: printer.brand,
      model: printer.model,
      paperWidth: printer.paperWidth,
      charWidth: printer.charWidth,
      copies: printer.copies || 1,
      isLaser: isLaserPrinter(printer),
    },
    order,
    opts,
    rawHex,
    status: 'pending',
    createdAt: Date.now(),
  };

  // Limit queue to last 50 jobs
  if (relayQueue.length > 50) {
    relayQueue.shift();
  }
  relayQueue.push(job);

  // Wake up any long-polling relay agents immediately
  while (waitingPollers.length > 0) {
    const poller = waitingPollers.shift();
    try {
      poller([job]);
    } catch (_) {}
  }

  return job;
}

// ── GET all printers ─────────────────────────────────────────────────────────
const getPrinters = asyncHandler(async (req, res) => {
  const printers = await PrinterSettings.find().sort({ createdAt: 1 });
  res.json(printers);
});

// ── GET single printer ───────────────────────────────────────────────────────
const getPrinter = asyncHandler(async (req, res) => {
  const printer = await PrinterSettings.findById(req.params.id);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  res.json(printer);
});

// ── CREATE printer ───────────────────────────────────────────────────────────
const createPrinter = asyncHandler(async (req, res) => {
  const printer = await PrinterSettings.create(req.body);
  res.status(201).json(printer);
});

// ── UPDATE printer ───────────────────────────────────────────────────────────
const updatePrinter = asyncHandler(async (req, res) => {
  const printer = await PrinterSettings.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  res.json(printer);
});

// ── DELETE printer ───────────────────────────────────────────────────────────
const deletePrinter = asyncHandler(async (req, res) => {
  const printer = await PrinterSettings.findByIdAndDelete(req.params.id);
  if (!printer) return res.status(404).json({ message: 'Printer not found' });
  res.json({ message: 'Printer deleted' });
});

// ── TEST printer connectivity ────────────────────────────────────────────────
const pingPrinter = asyncHandler(async (req, res) => {
  const { ip, port } = req.body;
  if (!ip) return res.status(400).json({ ok: false, error: 'IP address is required' });

  // 1. Try direct TCP first (if running locally or printer is publicly routed)
  try {
    const result = await testPrinter(ip, port || 9100);
    if (result && result.ok) {
      return res.json({ ...result, method: 'direct_tcp' });
    }
  } catch (_) {}

  // 2. If direct TCP fails, check if Local Relay Agent is online
  if (isRelayAgentOnline()) {
    const job = queueRelayJob('ping', { ipAddress: ip, port: port || 9100 });
    const relayResult = await waitForRelayJob(job.id, 4500);
    if (relayResult.ok) {
      return res.json({
        ok: true,
        method: 'relay_agent',
        agent: relayAgentState.agentName,
        message: `Printer online (verified via ${relayAgentState.agentName})`,
      });
    }
    return res.json({
      ok: false,
      method: 'relay_agent',
      error: relayResult.error || `Printer unreachable at ${ip}:${port || 9100}`,
    });
  }

  res.json({ ok: false, error: `Printer unreachable at ${ip}:${port || 9100}. Start pos-agent.js on local network for relay.` });
});

// ── PRINT a KOT (Kitchen Order Ticket) with PARALLEL DISPATCH ─────────────────
const printKOTEndpoint = asyncHandler(async (req, res) => {
  const { order, printerId, opts } = req.body;
  if (!order) return res.status(400).json({ message: 'Order data required' });

  // Find enabled kitchen/bar/both printers
  let query = { enabled: true, type: { $in: ['kitchen', 'bar', 'both'] } };
  if (printerId) query = { _id: printerId };

  let printers = await PrinterSettings.find(query);
  if (!printers.length && !printerId) {
    // Fallback to any enabled printer (e.g. single-printer restaurant setup)
    printers = await PrinterSettings.find({ enabled: true });
  }
  if (!printers.length) {
    return res.status(404).json({ message: 'No kitchen printer configured or enabled' });
  }

  // Dispatch to ALL active printers in parallel using Promise.allSettled
  // An unreachable printer on another subnet will never delay or block others!
  const printTasks = printers.map(async (printer) => {
    try {
      await printKOT(printer, order, opts || {});
      return {
        printer: printer.name,
        ip: printer.ipAddress,
        ok: true,
        method: 'direct_tcp',
      };
    } catch (directErr) {
      // Direct TCP failed (e.g. server hosted on cloud, printer on private LAN, or offline)
      // Route to cloud relay agent
      const job = queueRelayJob('kot', printer, order, opts || {});
      const agentOnline = isRelayAgentOnline();
      return {
        printer: printer.name,
        ip: printer.ipAddress,
        ok: agentOnline, // If relay agent is online, job is actively queued
        queuedForRelay: true,
        jobId: job.id,
        method: 'relay_agent',
        error: agentOnline ? null : directErr.message,
      };
    }
  });

  const settled = await Promise.allSettled(printTasks);
  const results = settled.map((s, idx) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      printer: printers[idx]?.name || 'Printer',
      ok: false,
      error: s.reason?.message || 'Print dispatch failed',
    };
  });

  const allOk = results.every((r) => r.ok);
  res.status(allOk ? 200 : 207).json({ results });
});

// ── PRINT a Receipt with PARALLEL DISPATCH ──────────────────────────────────
const printReceiptEndpoint = asyncHandler(async (req, res) => {
  const { order, printerId, opts } = req.body;
  if (!order) return res.status(400).json({ message: 'Order data required' });

  let query = { enabled: true, type: { $in: ['receipt', 'both'] } };
  if (printerId) query = { _id: printerId };

  let printers = await PrinterSettings.find(query);
  if (!printers.length && !printerId) {
    // Fallback to any enabled printer
    printers = await PrinterSettings.find({ enabled: true });
  }
  if (!printers.length) {
    return res.status(404).json({ message: 'No receipt printer configured or enabled' });
  }

  // Dispatch to ALL active printers in parallel
  const printTasks = printers.map(async (printer) => {
    try {
      await printReceipt(printer, order, opts || {});
      return {
        printer: printer.name,
        ip: printer.ipAddress,
        ok: true,
        method: 'direct_tcp',
      };
    } catch (directErr) {
      const job = queueRelayJob('receipt', printer, order, opts || {});
      const agentOnline = isRelayAgentOnline();
      return {
        printer: printer.name,
        ip: printer.ipAddress,
        ok: agentOnline,
        queuedForRelay: true,
        jobId: job.id,
        method: 'relay_agent',
        error: agentOnline ? null : directErr.message,
      };
    }
  });

  const settled = await Promise.allSettled(printTasks);
  const results = settled.map((s, idx) => {
    if (s.status === 'fulfilled') return s.value;
    return {
      printer: printers[idx]?.name || 'Printer',
      ok: false,
      error: s.reason?.message || 'Receipt dispatch failed',
    };
  });

  const allOk = results.every((r) => r.ok);
  res.status(allOk ? 200 : 207).json({ results });
});

// ── PRINT TEST PAGE ─────────────────────────────────────────────────────────
const printTestPageEndpoint = asyncHandler(async (req, res) => {
  const { printerId, ip, port, brand, model } = req.body;

  let printer;
  if (printerId) {
    printer = await PrinterSettings.findById(printerId);
    if (!printer) return res.status(404).json({ ok: false, error: 'Printer not found' });
  } else if (ip) {
    printer = {
      name: 'Test Printer',
      ipAddress: ip,
      port: Number(port) || 9100,
      brand: brand || 'Generic',
      model: model || '',
      enabled: true,
      headerLine1: 'Baba Roti Café',
      footerLine: 'Test Print Successful!',
      copies: 1,
    };
  } else {
    return res.status(400).json({ ok: false, error: 'printerId or ip required' });
  }

  const sampleOrder = {
    orderNo: 'TEST-001',
    orderType: 'dine_in',
    tableNo: 'Table 1',
    waiterName: 'Test Server',
    customerName: 'Test Customer',
    paymentMethod: 'Cash',
    discountPercent: 0,
    serviceCharge: 0,
    amountPaid: 150,
    items: [
      { productName: 'Baba Roti Special Bun', quantity: 2, unitPrice: 50 },
      { productName: 'Hot Cappuccino', quantity: 1, unitPrice: 50 },
    ],
  };

  try {
    await printReceipt(printer, sampleOrder, {
      hotelName: 'Baba Roti Café - Test Print',
      footerLine: `Print Test Passed • ${printer.brand || ''} ${printer.model || ''}`.trim(),
    });
    res.json({ ok: true, message: `Test page sent to ${printer.ipAddress}:${printer.port || 9100}` });
  } catch (err) {
    // If direct TCP fails, queue test job to relay agent
    const job = queueRelayJob('receipt', printer, sampleOrder, {
      hotelName: 'Baba Roti Café - Test Print',
      footerLine: `Print Test Passed • ${printer.brand || ''} ${printer.model || ''}`.trim(),
    });
    const agentOnline = isRelayAgentOnline();
    if (agentOnline) {
      return res.json({
        ok: true,
        queuedForRelay: true,
        jobId: job.id,
        message: `Queued for Local Relay Agent to ${printer.ipAddress}:${printer.port || 9100}`,
      });
    }
    res.status(500).json({ ok: false, error: err.message, queuedForRelay: true, jobId: job.id });
  }
});

// ── RELAY AGENT ENDPOINTS ───────────────────────────────────────────────────

/**
 * GET /api/printers/relay/poll & /api/printers/relay/jobs
 * Standalone Local Print Agent polls this to fetch pending print jobs.
 * Supports long-polling (up to 25 seconds) for real-time <50ms dispatch.
 */
const getRelayPoll = asyncHandler(async (req, res) => {
  if (req.query.agentName) {
    relayAgentState.lastHeartbeat = Date.now();
    relayAgentState.agentName = req.query.agentName;
    relayAgentState.ip = req.ip || req.socket.remoteAddress;
  }

  const pending = relayQueue.filter((j) => j.status === 'pending');
  if (pending.length > 0) {
    pending.forEach((j) => { j.status = 'dispatched'; });
    return res.json({ jobs: pending });
  }

  // Hold connection for long-polling (up to 25 seconds)
  const timer = setTimeout(() => {
    const idx = waitingPollers.indexOf(sendJobs);
    if (idx !== -1) waitingPollers.splice(idx, 1);
    res.json({ jobs: [] });
  }, 25000);

  const sendJobs = (newJobs) => {
    clearTimeout(timer);
    newJobs.forEach((j) => { j.status = 'dispatched'; });
    res.json({ jobs: newJobs });
  };

  waitingPollers.push(sendJobs);
});

const getRelayJobs = getRelayPoll;

/**
 * POST /api/printers/relay/complete & /api/printers/relay/jobs/:jobId/status
 * Local Relay Agent reports outcome of print execution.
 */
const completeRelayJob = asyncHandler(async (req, res) => {
  const jobId = req.params.jobId || req.body.jobId;
  const { status, ok, error, latencyMs } = req.body;

  const job = relayQueue.find((j) => j.id === jobId);
  if (job) {
    job.status = status || (ok !== false ? 'completed' : 'failed');
    job.error = error || null;
    job.completedAt = Date.now();
  }

  // Resolve any waiting in-flight caller (e.g. ping or test page)
  if (pendingRelayResolvers.has(jobId)) {
    const entry = pendingRelayResolvers.get(jobId);
    clearTimeout(entry.timer);
    pendingRelayResolvers.delete(jobId);
    entry.resolve({
      ok: ok !== false && status !== 'failed',
      error: error || null,
      latencyMs: latencyMs || null,
    });
  }

  res.json({ ok: true });
});

const updateRelayJobStatus = completeRelayJob;

/**
 * POST /api/printers/relay/heartbeat
 * Local Relay Agent sends periodic heartbeat.
 */
const relayHeartbeat = asyncHandler(async (req, res) => {
  const { agentName, platform, version } = req.body;
  relayAgentState = {
    lastHeartbeat: Date.now(),
    agentName: agentName || 'Local Relay Agent',
    ip: req.ip || req.socket.remoteAddress,
    platform: platform || 'node',
    version: version || '2.5.0',
  };
  res.json({ ok: true, serverTime: Date.now() });
});

/**
 * GET /api/printers/relay/status
 * Front-end check to display live status of Local Relay Agent.
 */
const getRelayStatus = asyncHandler(async (req, res) => {
  const online = isRelayAgentOnline();
  const pendingCount = relayQueue.filter((j) => j.status === 'pending').length;
  res.json({
    online,
    agent: relayAgentState,
    pendingJobs: pendingCount,
    totalQueued: relayQueue.length,
  });
});

module.exports = {
  getPrinters,
  getPrinter,
  createPrinter,
  updatePrinter,
  deletePrinter,
  pingPrinter,
  printKOTEndpoint,
  printReceiptEndpoint,
  printTestPageEndpoint,
  getRelayPoll,
  getRelayJobs,
  completeRelayJob,
  updateRelayJobStatus,
  relayHeartbeat,
  getRelayStatus,
  isRelayAgentOnline,
  hasActiveRelayAgent,
};

