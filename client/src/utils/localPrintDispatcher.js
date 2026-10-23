/**
 * localPrintDispatcher.js – Multi-tier Restaurant Network Print Dispatcher
 *
 * Implements seamless, ultra-reliable printing across all network topologies:
 *  - Tier 1: Local Loopback Bridge (http://127.0.0.1:9101) with fast 1000ms timeout.
 *            Directly prints to local LAN printers from local terminal.
 *  - Tier 2: Central Server API (/api/printers/action/kot & /action/receipt).
 *            Dispatches in parallel using Promise.allSettled and queues to Cloud Relay Agent if needed.
 *  - Tier 3: Browser Iframe Print Fallback (posPrint).
 *            Ensures staff never drop an order even during total network separation.
 */

import api from '../api/axios';
import { posPrint } from './posPrint';

const LOCAL_BRIDGE_URL = 'http://127.0.0.1:9101';
const BRIDGE_TIMEOUT_MS = 1000; // Optimized 1.0s timeout for swift fallback

/**
 * Probes whether the local loopback bridge (baba-roti-agent.js) is running on this machine.
 * Returns { online: boolean, info: Object|null }
 */
export async function checkLocalBridge() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), BRIDGE_TIMEOUT_MS);
  try {
    const res = await fetch(`${LOCAL_BRIDGE_URL}/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      return { online: true, ...data };
    }
    return { online: false };
  } catch (_) {
    clearTimeout(timer);
    return { online: false };
  }
}

/**
 * Checks cloud relay agent status from the server.
 */
export async function checkRelayStatus() {
  try {
    const res = await api.get('/printers/relay/status');
    return res.data;
  } catch (_) {
    return { online: false, pendingJobs: 0 };
  }
}

/**
 * Universal print dispatcher for all restaurant order modes:
 * - POS checkout sales
 * - Captain Orders (held, send to kitchen, re-print)
 * - Takeaway / Delivery / Dine-in
 * - Barista vs Kitchen station routing
 *
 * @param {'kot'|'receipt'} type
 * @param {Object} order
 * @param {Object} opts
 * @param {boolean} [opts.fallbackBrowser=true]
 * @returns {Promise<{ ok: boolean, method: string, details?: any }>}
 */
export async function dispatchPrint(type, order, opts = {}) {
  const fallbackBrowser = opts.fallbackBrowser !== false;

  // ── Tier 1: Try Local Loopback Bridge (1000ms fast attempt) ──────────────
  try {
    const bridgeCheck = await checkLocalBridge();
    if (bridgeCheck.online) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3500);

      // Fetch printers list from server to know IPs if needed, or pass order directly
      const printerRes = await api.get('/printers').catch(() => ({ data: [] }));
      const targetPrinters = (printerRes.data || []).filter((p) => {
        if (!p.enabled || !p.ipAddress) return false;
        if (type === 'kot') return ['kitchen', 'bar', 'both'].includes(p.type);
        return ['receipt', 'both'].includes(p.type);
      });

      if (targetPrinters.length > 0) {
        const bridgePromises = targetPrinters.map(async (printer) => {
          const res = await fetch(`${LOCAL_BRIDGE_URL}/print`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              ip: printer.ipAddress,
              port: printer.port || 9100,
              type,
              printer,
              order,
              opts,
            }),
            signal: controller.signal,
          });
          return res.ok;
        });

        const settled = await Promise.allSettled(bridgePromises);
        clearTimeout(timer);
        const atLeastOneOk = settled.some((s) => s.status === 'fulfilled' && s.value === true);
        if (atLeastOneOk) {
          return { ok: true, method: 'local_bridge' };
        }
      }
    }
  } catch (_) {
    // Fail silently to Tier 2
  }

  // ── Tier 2: Server API Dispatch (Parallel Direct TCP & Cloud Relay Queue) ─
  try {
    const endpoint = type === 'kot' ? '/printers/action/kot' : '/printers/action/receipt';
    const res = await api.post(endpoint, { order, opts });
    const results = res.data?.results || [];
    const anySuccess = results.some((r) => r.ok);

    if (anySuccess || results.length > 0) {
      return { ok: anySuccess, method: 'server_network', results };
    }
  } catch (err) {
    console.warn(`[PRINT] Server network dispatch failed:`, err.message);
  }

  // ── Tier 3: Browser Iframe Print Fallback ────────────────────────────────
  if (fallbackBrowser) {
    try {
      if (type === 'kot') {
        posPrint.printKOT(order, opts);
      } else {
        posPrint.printReceipt(order, opts);
      }
      return { ok: true, method: 'browser_fallback' };
    } catch (browserErr) {
      console.error('[PRINT] Browser print error:', browserErr);
      return { ok: false, method: 'none', error: browserErr.message };
    }
  }

  return { ok: false, method: 'none' };
}

/**
 * Convenience shortcuts
 */
export const localPrintDispatcher = {
  dispatchPrint,
  printKOT: (order, opts) => dispatchPrint('kot', order, opts),
  printReceipt: (order, opts) => dispatchPrint('receipt', order, opts),
  checkLocalBridge,
  checkRelayStatus,
};

export default localPrintDispatcher;
