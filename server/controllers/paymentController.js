const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const Setting = require('../models/Setting');
const POSOrder = require('../models/POSOrder');
const CaptainOrder = require('../models/CaptainOrder');
const PaymentTransaction = require('../models/PaymentTransaction');
const notify = require('../utils/notificationHelper');
const tg = require('../utils/telegramNotifier');
const { logActivity } = require('../utils/activityLogger');
const { createPosOrderRecord, finalizePendingPosOrder } = require('./posController');

async function getPayoRuntimeConfig() {
  const settings = await Setting.findOne().lean();
  const payo = settings?.payoSettings || {};
  const apiKey = String(payo.apiKey || process.env.PAYO_API_KEY || '').trim();
  const webhookSecret = String(payo.webhookSecret || apiKey).trim();
  let apiBaseUrl = String(payo.apiBaseUrl || process.env.PAYO_API_BASE_URL || 'https://dashboard.payment.et').trim().replace(/\/+$/, '');
  // Migrate older checkout/landing/placeholder URLs automatically to Payo's live API host
  if (!apiBaseUrl || /^https?:\/\/(checkout\.|www\.)?payment\.et$/i.test(apiBaseUrl) || /^https?:\/\/api\.pygate\.et$/i.test(apiBaseUrl)) {
    apiBaseUrl = 'https://dashboard.payment.et';
  }
  return {
    enabled: Boolean(payo.enabled),
    enableInPos: payo.enableInPos !== false,
    enableInDigitalMenu: payo.enableInDigitalMenu !== false,
    apiBaseUrl,
    apiKey,
    webhookSecret,
    settings,
  };
}

function getPublicBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = forwardedProto ? String(forwardedProto).split(',')[0].trim() : req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'baba-roti-1.app.aletcloud.com';
  return `${proto}://${host}`;
}

async function payoJsonRequest(url, { method = 'GET', headers = {}, body = null, timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const text = await resp.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {
      data = { raw: text };
    }
    return { status: resp.status, ok: resp.ok, data };
  } finally {
    clearTimeout(timer);
  }
}

async function callPayoCreateOrder({ apiBaseUrl, apiKey, payload }) {
  const ordersPath = apiBaseUrl.endsWith('/api/v1') ? '/orders' : '/api/v1/orders';
  const url = `${apiBaseUrl}${ordersPath}`;
  const res = await payoJsonRequest(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
      ...(payload?.reference ? { 'Idempotency-Key': String(payload.reference) } : {}),
    },
    body: {
      amount: payload.amount,
      description: payload.description,
      callbackUrl: payload.callbackUrl,
      ...(payload.currency ? { currency: payload.currency } : {}),
      ...(payload.reference ? { reference: payload.reference } : {}),
      ...(payload.returnUrl ? { returnUrl: payload.returnUrl } : {}),
    },
    timeoutMs: 15000,
  });

  if (res.ok) return res.data;
  const err = new Error(res.data?.message || res.data?.error || `Payo HTTP ${res.status}`);
  err.statusCode = res.status;
  err.responseData = res.data;
  throw err;
}

function extractPayoCheckoutDetails(data = {}) {
  const root = data?.data && typeof data.data === 'object' ? data.data : data;
  const payoOrderId = String(
    root?.orderId ||
    root?.order_id ||
    root?.id ||
    data?.orderId ||
    data?.order_id ||
    data?.id ||
    root?.reference ||
    ''
  ).trim();
  let checkoutUrl = String(
    root?.checkoutUrl ||
    root?.checkout_url ||
    root?.paymentUrl ||
    root?.payment_url ||
    root?.paymentLinkUrl ||
    root?.url ||
    data?.checkoutUrl ||
    data?.checkout_url ||
    data?.url ||
    ''
  ).trim();
  if (!checkoutUrl && payoOrderId) {
    checkoutUrl = `https://checkout.payment.et/pay/${encodeURIComponent(payoOrderId)}`;
  }
  return { checkoutUrl, payoOrderId };
}

function isApprovedPayoStatus(rawStatus = '') {
  const s = String(rawStatus || '').trim().toUpperCase();
  return ['APPROVED', 'SUCCESS', 'SUCCEEDED', 'PAID', 'COMPLETED', 'VERIFIED'].includes(s);
}

function isRejectedPayoStatus(rawStatus = '') {
  const s = String(rawStatus || '').trim().toUpperCase();
  return ['REJECTED', 'FAILED', 'CANCELLED', 'CANCELED', 'DECLINED', 'EXPIRED'].includes(s);
}

async function settleApprovedPayment(txnDoc, verifiedBy = 'webhook', actorUser = null) {
  const txn = await PaymentTransaction.findById(txnDoc._id || txnDoc);
  if (!txn) return null;
  if (txn.status === 'approved') return txn;

  let finalizedPosOrder = null;

  if (txn.posOrder) {
    finalizedPosOrder = await finalizePendingPosOrder(txn.posOrder, actorUser);
  } else if (txn.captainOrder) {
    const capOrder = await CaptainOrder.findById(txn.captainOrder);
    if (capOrder) {
      if (capOrder.cashSaleRef) {
        finalizedPosOrder = await finalizePendingPosOrder(capOrder.cashSaleRef, actorUser);
      } else {
        const systemCashier = actorUser || {
          _id: capOrder.createdBy,
          name: 'Payo Online Gateway',
          role: 'cashier',
        };
        const itemsForPos = (capOrder.items || []).map((it) => ({
          product: it.product,
          productName: it.productName,
          productCode: it.productCode || '',
          category: it.category || 'General',
          parentCategory: it.parentCategory || 'FOOD',
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          notes: it.notes || '',
        }));

        if (itemsForPos.length > 0) {
          finalizedPosOrder = await createPosOrderRecord({
            body: {
              orderType: capOrder.orderType || 'dine_in',
              tableNo: capOrder.tableNo || '',
              customerName: capOrder.customerName || 'QR Menu Guest',
              customerPhone: capOrder.customerPhone || '',
              items: itemsForPos,
              discountPercent: capOrder.discountPercent || 0,
              discountAmount: capOrder.discountAmount || 0,
              serviceCharge: capOrder.serviceCharge || 0,
              serviceChargePercent: capOrder.serviceChargePercent || 0,
              paymentMethod: 'Payo',
              amountPaid: capOrder.grandTotal || txn.amount,
              paymentStatus: 'paid',
              waiter: capOrder.waiter || null,
              waiterName: capOrder.waiterName || '',
              captainOrderRef: capOrder._id,
            },
            user: systemCashier,
          });
        } else {
          await CaptainOrder.findByIdAndUpdate(capOrder._id, {
            status: 'paid',
            billedAt: new Date(),
            billedByName: 'Payo Online Gateway',
          });
        }
      }
      txn.posOrder = finalizedPosOrder?._id || txn.posOrder;
    }
  }

  txn.status = 'approved';
  txn.verifiedBy = verifiedBy;
  txn.paidAt = txn.paidAt || new Date();
  await txn.save();

  notify.push({
    type: 'system',
    title: 'Payo Payment Verified',
    message: `Payment of ETB ${Number(txn.amount || 0).toFixed(2)} verified via Payo (${txn.orderNo || txn.reference})${txn.tableNo ? ` • Table ${txn.tableNo}` : ''}.`,
    icon: '💳',
    link: txn.source === 'digital_menu' ? '/captain-order' : '/cash-sales',
    allowedRoles: ['cashier', 'supervisor', 'operation_manager', 'manager', 'admin', 'dev'],
    severity: 'success',
  });

  if (tg && typeof tg.sendNotification === 'function') {
    try {
      tg.sendNotification(
        `💳 <b>PAYO PAYMENT VERIFIED</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🧾 <b>Order:</b> ${txn.orderNo || txn.reference}\n` +
        (txn.tableNo ? `🪑 <b>Table:</b> ${txn.tableNo}\n` : '') +
        `💰 <b>Amount:</b> ETB ${Number(txn.amount || 0).toFixed(2)}\n` +
        `✅ <b>Source:</b> ${txn.source === 'digital_menu' ? 'Digital QR Menu' : 'POS Register'} (${verifiedBy})`,
        { processKey: 'posOrders' }
      );
    } catch (_) { }
  }

  return txn;
}

// @desc   Initiate Payo checkout for a POS register order
// @route  POST /api/payments/payo/pos-initiate
// @access Private (Staff/Cashier/Admin)
const initiatePosPayoPayment = asyncHandler(async (req, res) => {
  const cfg = await getPayoRuntimeConfig();
  if (!cfg.enabled || !cfg.enableInPos) {
    res.status(400);
    throw new Error('Payo online payment is currently disabled for POS in Settings.');
  }
  if (!cfg.apiKey) {
    res.status(400);
    throw new Error('Payo API key is not configured. Add it in Settings → Payment Gateway (Payo).');
  }

  // Create a pending POSOrder first so stock is NOT deducted until Payo confirms payment
  const order = await createPosOrderRecord({
    body: {
      ...req.body,
      paymentMethod: 'Payo',
      paymentStatus: 'pending',
    },
    user: req.user,
  });

  const reference = `PAYO-${order.orderNo}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const publicBase = getPublicBaseUrl(req);
  const webhookUrl = `${publicBase}/api/payments/payo/webhook`;
  const returnUrl = `${publicBase}/pos?payoRef=${encodeURIComponent(reference)}`;

  let payoRes;
  try {
    payoRes = await callPayoCreateOrder({
      apiBaseUrl: cfg.apiBaseUrl,
      apiKey: cfg.apiKey,
      payload: {
        amount: Number(order.grandTotal.toFixed(2)),
        currency: 'ETB',
        reference,
        description: `Baba Roti POS Order #${order.orderNo}${order.tableNo ? ` (${order.tableNo})` : ''}`,
        callbackUrl: webhookUrl,
        callback_url: webhookUrl,
        webhookUrl,
        webhook_url: webhookUrl,
        returnUrl,
        return_url: returnUrl,
        redirect_url: returnUrl,
      },
    });
  } catch (err) {
    // Clean up orphaned pending POSOrder on gateway error
    await POSOrder.findByIdAndDelete(order._id).catch(() => { });
    const msg = err.responseData?.message || err.responseData?.error || err.message || 'Payo gateway error';
    res.status(err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? 400 : 502);
    throw new Error(`Payo error: ${msg}`);
  }

  const { checkoutUrl, payoOrderId } = extractPayoCheckoutDetails(payoRes);
  if (!checkoutUrl) {
    await POSOrder.findByIdAndDelete(order._id).catch(() => { });
    res.status(502);
    throw new Error('Payo did not return a checkout URL. Verify your Payo API Base URL and API Key in Settings.');
  }

  const txn = await PaymentTransaction.create({
    reference,
    provider: 'payo',
    source: 'pos',
    posOrder: order._id,
    captainOrder: order.captainOrderRef || null,
    orderNo: order.orderNo,
    tableNo: order.tableNo || '',
    customerName: order.customerName || 'Walk-in Guest',
    amount: order.grandTotal,
    currency: 'ETB',
    status: 'pending',
    payoOrderId,
    checkoutUrl,
    rawResponse: payoRes,
    createdBy: req.user?._id || null,
  });

  res.status(201).json({
    success: true,
    reference: txn.reference,
    paymentId: txn._id,
    posOrderId: order._id,
    orderNo: order.orderNo,
    amount: txn.amount,
    checkoutUrl,
  });
});

// @desc   Initiate Payo checkout for a customer Digital Menu / Table order
// @route  POST /api/payments/payo/menu-initiate
// @access Public
const initiateDigitalMenuPayoPayment = asyncHandler(async (req, res) => {
  const { orderNo } = req.body;
  if (!orderNo || !String(orderNo).trim()) {
    res.status(400);
    throw new Error('Order number is required');
  }

  const cfg = await getPayoRuntimeConfig();
  if (!cfg.enabled || !cfg.enableInDigitalMenu) {
    res.status(400);
    throw new Error('Online payment via Payo is currently disabled on the Digital Menu.');
  }
  if (!cfg.apiKey) {
    res.status(400);
    throw new Error('Payo gateway is not configured yet.');
  }

  const capOrder = await CaptainOrder.findOne({
    orderNo: String(orderNo).trim(),
    isVoided: { $ne: true },
  });
  if (!capOrder) {
    res.status(404);
    throw new Error('Order not found.');
  }
  if (capOrder.status === 'paid') {
    return res.json({
      success: true,
      alreadyPaid: true,
      status: 'approved',
      orderNo: capOrder.orderNo,
      amount: capOrder.grandTotal,
    });
  }
  if (['voided', 'cancelled'].includes(capOrder.status)) {
    res.status(400);
    throw new Error('Cancelled or voided orders cannot be paid.');
  }

  const amount = Number(capOrder.grandTotal || 0);
  if (!(amount > 0)) {
    res.status(400);
    throw new Error('Order total must be greater than zero.');
  }

  // Reuse recent pending transaction for same order & unchanged amount
  const recentCutoff = new Date(Date.now() - 25 * 60 * 1000);
  const existingPending = await PaymentTransaction.findOne({
    captainOrder: capOrder._id,
    status: 'pending',
    amount,
    createdAt: { $gte: recentCutoff },
  }).sort({ createdAt: -1 });
  if (existingPending && existingPending.checkoutUrl) {
    return res.json({
      success: true,
      reference: existingPending.reference,
      paymentId: existingPending._id,
      orderNo: capOrder.orderNo,
      amount: existingPending.amount,
      checkoutUrl: existingPending.checkoutUrl,
    });
  }

  const reference = `PAYO-${capOrder.orderNo}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  const publicBase = getPublicBaseUrl(req);
  const webhookUrl = `${publicBase}/api/payments/payo/webhook`;
  const returnUrl = `${publicBase}/menu?table=${encodeURIComponent(capOrder.tableNo || 'Table 1')}&payoRef=${encodeURIComponent(reference)}`;

  let payoRes;
  try {
    payoRes = await callPayoCreateOrder({
      apiBaseUrl: cfg.apiBaseUrl,
      apiKey: cfg.apiKey,
      payload: {
        amount: Number(amount.toFixed(2)),
        currency: 'ETB',
        reference,
        description: `Baba Roti ${capOrder.tableNo || 'Digital Menu'} Order #${capOrder.orderNo}`,
        callbackUrl: webhookUrl,
        callback_url: webhookUrl,
        webhookUrl,
        webhook_url: webhookUrl,
        returnUrl,
        return_url: returnUrl,
        redirect_url: returnUrl,
      },
    });
  } catch (err) {
    const msg = err.responseData?.message || err.responseData?.error || err.message || 'Payo gateway error';
    res.status(err.statusCode && err.statusCode >= 400 && err.statusCode < 500 ? 400 : 502);
    throw new Error(`Payo gateway error: ${msg}`);
  }

  const { checkoutUrl, payoOrderId } = extractPayoCheckoutDetails(payoRes);
  if (!checkoutUrl) {
    res.status(502);
    throw new Error('Payo did not return a checkout link.');
  }

  const txn = await PaymentTransaction.create({
    reference,
    provider: 'payo',
    source: 'digital_menu',
    captainOrder: capOrder._id,
    orderNo: capOrder.orderNo,
    tableNo: capOrder.tableNo || '',
    customerName: capOrder.customerName || 'Guest',
    amount,
    currency: 'ETB',
    status: 'pending',
    payoOrderId,
    checkoutUrl,
    rawResponse: payoRes,
  });

  res.status(201).json({
    success: true,
    reference: txn.reference,
    paymentId: txn._id,
    orderNo: capOrder.orderNo,
    amount: txn.amount,
    checkoutUrl,
  });
});

// @desc   Receive & verify Payo HMAC-SHA256 webhook notification
// @route  POST /api/payments/payo/webhook
// @access Public (Signed via x-pygate-signature)
const handlePayoWebhook = asyncHandler(async (req, res) => {
  const cfg = await getPayoRuntimeConfig();
  const signature = String(
    req.headers['x-pygate-signature'] ||
    req.headers['x-payo-signature'] ||
    ''
  ).trim();

  if (cfg.webhookSecret) {
    if (!signature) {
      return res.status(401).json({ message: 'Missing webhook signature' });
    }
    const rawPayload = req.rawBody && Buffer.isBuffer(req.rawBody)
      ? req.rawBody
      : Buffer.from(JSON.stringify(req.body || {}));
    const expectedHex = crypto
      .createHmac('sha256', cfg.webhookSecret)
      .update(rawPayload)
      .digest('hex');

    // Payo signs x-pygate-signature as "sha256=<hex>" (also accept raw hex)
    const cleanSigHex = signature.replace(/^sha256=/i, '').trim().toLowerCase();
    const sigBuf = Buffer.from(cleanSigHex);
    const expBuf = Buffer.from(expectedHex.toLowerCase());
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).json({ message: 'Invalid webhook signature' });
    }
  }

  const event = req.body || {};
  const payload = event.data && typeof event.data === 'object' ? event.data : event;
  const ref = String(
    payload.reference ||
    event.reference ||
    payload.merchant_order_id ||
    event.merchant_order_id ||
    ''
  ).trim();
  const payoId = String(
    payload.order_id ||
    payload.orderId ||
    payload.id ||
    event.order_id ||
    event.id ||
    ''
  ).trim();

  let txn = null;
  if (ref) txn = await PaymentTransaction.findOne({ reference: ref });
  if (!txn && payoId) txn = await PaymentTransaction.findOne({ payoOrderId: payoId });

  if (!txn) {
    return res.status(200).json({ received: true, matched: false });
  }

  txn.rawWebhook = event;
  const eventStatus = payload.status || event.status || payload.payment_status || event.event || '';

  if (isApprovedPayoStatus(eventStatus)) {
    await txn.save();
    await settleApprovedPayment(txn, 'webhook');
  } else if (isRejectedPayoStatus(eventStatus)) {
    txn.status = 'rejected';
    txn.errorMessage = String(payload.reason || payload.message || eventStatus);
    await txn.save();
  } else {
    await txn.save();
  }

  return res.status(200).json({ received: true, status: txn.status });
});

// @desc   Poll Payo status for an active checkout reference
// @route  GET /api/payments/payo/status/:reference
// @access Public (Minimal non-sensitive status)
const getPayoStatus = asyncHandler(async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  const txn = await PaymentTransaction.findOne({ reference });
  if (!txn) {
    res.status(404);
    throw new Error('Payment transaction not found');
  }

  if (txn.status === 'pending' && txn.payoOrderId) {
    try {
      const cfg = await getPayoRuntimeConfig();
      if (cfg.apiKey) {
        const ordersPath = cfg.apiBaseUrl.endsWith('/api/v1') ? '/orders' : '/api/v1/orders';
        const resp = await payoJsonRequest(`${cfg.apiBaseUrl}${ordersPath}/${encodeURIComponent(txn.payoOrderId)}`, {
          method: 'GET',
          headers: { 'x-api-key': cfg.apiKey, accept: 'application/json' },
          timeoutMs: 6000,
        }).catch(() => null);
        const remoteStatus = resp?.data?.status || resp?.data?.data?.status || resp?.data?.payment_status || '';
        if (isApprovedPayoStatus(remoteStatus)) {
          await settleApprovedPayment(txn, 'poll');
        } else if (isRejectedPayoStatus(remoteStatus)) {
          txn.status = 'rejected';
          await txn.save();
        }
      }
    } catch (_) { }
  }

  const fresh = await PaymentTransaction.findById(txn._id).lean();
  res.json({
    success: true,
    reference: fresh.reference,
    status: fresh.status,
    amount: fresh.amount,
    orderNo: fresh.orderNo,
    tableNo: fresh.tableNo,
    checkoutUrl: fresh.checkoutUrl,
    paidAt: fresh.paidAt,
    verifiedBy: fresh.verifiedBy,
    posOrderId: fresh.posOrder,
  });
});

// @desc   Cashier manual verification fallback for a pending Payo checkout
// @route  POST /api/payments/payo/confirm/:reference
// @access Private (Staff/Cashier/Admin)
const confirmPayoPaymentManual = asyncHandler(async (req, res) => {
  const reference = String(req.params.reference || '').trim();
  const txn = await PaymentTransaction.findOne({ reference });
  if (!txn) {
    res.status(404);
    throw new Error('Payment transaction not found');
  }

  const settled = await settleApprovedPayment(txn, 'manual_cashier', req.user);
  logActivity(req, {
    action: 'PAYO_MANUAL_CONFIRM',
    module: 'POS',
    description: `Cashier manually confirmed Payo payment ${reference} (ETB ${Number(txn.amount || 0).toFixed(2)})`,
    status: 'success',
    details: { reference, orderNo: txn.orderNo, amount: txn.amount },
  });

  res.json({
    success: true,
    status: settled.status,
    reference: settled.reference,
    posOrderId: settled.posOrder,
    orderNo: settled.orderNo,
  });
});

// @desc   Test Payo configuration connectivity (Admin & System Developer only)
// @route  POST /api/payments/payo/test
// @access Private (Admin / Dev)
const testPayoConnection = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied.');
  }

  const cfg = await getPayoRuntimeConfig();
  if (!cfg.apiKey) {
    res.status(400);
    throw new Error('No Payo API key saved yet. Paste your pgk_... key and Save Settings first.');
  }

  try {
    const ordersPath = cfg.apiBaseUrl.endsWith('/api/v1') ? '/orders' : '/api/v1/orders';
    const resp = await payoJsonRequest(`${cfg.apiBaseUrl}${ordersPath}`, {
      method: 'POST',
      headers: { 'x-api-key': cfg.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: {},
      timeoutMs: 8000,
    });
    if (resp.status === 401 || resp.status === 403) {
      res.status(400);
      throw new Error(`Payo rejected the API key (HTTP ${resp.status}). Please double-check your API key.`);
    }
    if (resp.status === 404) {
      res.status(400);
      throw new Error(`Payo endpoint ${cfg.apiBaseUrl}${ordersPath} returned HTTP 404. Set Payo API Base URL to https://dashboard.payment.et and Save.`);
    }
    res.json({
      success: true,
      enabled: cfg.enabled,
      status: resp.status,
      message: cfg.enabled
        ? `Payo API Key verified at ${cfg.apiBaseUrl}${ordersPath} (HTTP ${resp.status}). Payo is Active in ${cfg.enableInPos ? 'POS' : ''}${cfg.enableInPos && cfg.enableInDigitalMenu ? ' & ' : ''}${cfg.enableInDigitalMenu ? 'Digital Menu' : ''}.`
        : `Payo API Key verified at ${cfg.apiBaseUrl}${ordersPath}, BUT the Payo Gateway toggle is still OFF — switch it Active at top-right and Save to show Payo buttons in POS & Digital Menu.`,
    });
  } catch (err) {
    if (err.statusCode === 400) throw err;
    res.status(502);
    throw new Error(`Could not reach ${cfg.apiBaseUrl}: ${err.message}`);
  }
});

module.exports = {
  initiatePosPayoPayment,
  initiateDigitalMenuPayoPayment,
  handlePayoWebhook,
  getPayoStatus,
  confirmPayoPaymentManual,
  testPayoConnection,
};
