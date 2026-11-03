/**
 * Standalone Digital Menu & QR Ordering Express Router
 * ──────────────────────────────────────────────────────────────────
 * All-In-One drop-in router for any restaurant application.
 * Mount in your server.js or app.js with:
 *   const digitalMenuRouter = require('./digitalMenuStandaloneRouter');
 *   app.use('/api', digitalMenuRouter);
 */

const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');

// Models (Adjust paths to your project models if different)
const Setting = mongoose.models.Setting || require('../models/Setting');
const Product = mongoose.models.Product || require('../models/Product');
const CaptainOrder = mongoose.models.CaptainOrder || require('../models/CaptainOrder');
const Notification = mongoose.models.Notification || require('../models/Notification');
let RawMaterial = null;
try {
  RawMaterial = mongoose.models.RawMaterial || require('../models/RawMaterial');
} catch (_) {}

// Optional Telegram Bot (gracefully handles if not configured)
let tg = null;
try {
  tg = require('../utils/telegramNotifier');
} catch (_) {}

// ── Real-Time Server-Sent Events (SSE) ───────────────────────────
const sseSubscribers = new Set();

function broadcastOrderEvent(eventType, payload) {
  const data = JSON.stringify({ type: eventType, data: payload, timestamp: Date.now() });
  for (const client of sseSubscribers) {
    try {
      client.write(`event: ${eventType}\ndata: ${data}\n\n`);
      if (typeof client.flush === 'function') client.flush();
    } catch (_) {
      sseSubscribers.delete(client);
    }
  }
}

// ── Daily Order Sequence Generator ───────────────────────────────
async function generateOrderNumber() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = `CAP-${y}${m}${d}`;
  const last = await CaptainOrder.findOne({ orderNo: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 })
    .lean();
  const seq = last && last.dailySequence ? last.dailySequence + 1 : 1;
  return { orderNo: `${prefix}-${String(seq).padStart(3, '0')}`, dailySequence: seq };
}

// ─────────────────────────────────────────────────────────────────
// 1. PUBLIC MENU CATALOG (with live inventory out-of-stock check)
// ─────────────────────────────────────────────────────────────────
// @route GET /api/products/public-menu
router.get('/products/public-menu', asyncHandler(async (req, res) => {
  const [products, rawMaterials, settings] = await Promise.all([
    Product.find({ isActive: true, deletedAt: null, isAvailableOnMenu: { $ne: false } })
      .select('name nameAmharic code category parentCategory sellingPrice description descriptionAmharic uom imageUrl isFeatured manualOutOfStock ingredients')
      .sort({ isFeatured: -1, category: 1, name: 1 })
      .lean(),
    RawMaterial ? RawMaterial.find({ isActive: true, deletedAt: null }).select('_id currentStock unit').lean() : Promise.resolve([]),
    Setting.findOne().lean(),
  ]);

  const stockMap = new Map((rawMaterials || []).map((m) => [String(m._id), Number(m.currentStock || 0)]));

  const enrichedProducts = (products || []).map((p) => {
    let isOutOfStock = !!p.manualOutOfStock;
    let shortageIngredient = '';

    if (!isOutOfStock && p.ingredients?.length && RawMaterial) {
      for (const ing of p.ingredients) {
        const matId = String(ing.material?._id || ing.material);
        const available = stockMap.get(matId);
        if (available !== undefined && available <= 0) {
          isOutOfStock = true;
          shortageIngredient = 'Stock Depleted';
          break;
        }
      }
    }

    return {
      _id: p._id,
      name: p.name,
      nameAmharic: p.nameAmharic || '',
      code: p.code,
      category: p.category || 'General',
      parentCategory: p.parentCategory || 'FOOD',
      sellingPrice: p.sellingPrice || 0,
      description: p.description || '',
      descriptionAmharic: p.descriptionAmharic || '',
      uom: p.uom || 'Pcs',
      imageUrl: p.imageUrl || '',
      isFeatured: !!p.isFeatured,
      isOutOfStock,
      shortageIngredient,
    };
  });

  const categories = Array.from(new Set(enrichedProducts.map((p) => p.category || 'General')));

  res.json({
    success: true,
    cafeName: settings?.hotelName || 'Restaurant Name',
    currency: settings?.currency || 'ETB',
    taxRate: Number(settings?.taxRate ?? 15),
    enableServiceCharge: !!settings?.enableServiceCharge,
    serviceChargeRate: Number(settings?.serviceChargeRate ?? 10),
    digitalMenuSettings: settings?.digitalMenuSettings || {},
    categories,
    products: enrichedProducts,
  });
}));

// ─────────────────────────────────────────────────────────────────
// 2. CUSTOMER ORDER SUBMISSION (with Table Occupancy Lock)
// ─────────────────────────────────────────────────────────────────
// @route POST /api/captain-orders/customer-order
router.post('/captain-orders/customer-order', asyncHandler(async (req, res) => {
  const {
    tableNo = '',
    tableLabel = '',
    customerName = 'Walk-in Guest',
    customerPhone = '',
    guestCount = 1,
    orderType = 'dine_in',
    items = [],
    tableNotes = '',
  } = req.body;

  if (!items || !Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error('Order must contain at least one item');
  }

  const safeCustomerName = String(customerName || 'Walk-in Guest').trim().slice(0, 100);
  const safeCustomerPhone = String(customerPhone || '').trim().slice(0, 30);
  const safeTableNo = String(tableNo || 'Counter / Takeaway').trim().slice(0, 50);
  const safeTableLabel = String(tableLabel || tableNo || 'Table').trim().slice(0, 50);
  const safeTableNotes = String(tableNotes || '').trim().slice(0, 500);

  const cleanTable = safeTableNo.trim();
  const isTakeaway = cleanTable.toLowerCase().includes('counter') || cleanTable.toLowerCase().includes('takeaway');

  // Validate Table: Prevent another customer from ordering on an unbilled occupied table
  if (!isTakeaway && cleanTable) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const num = cleanTable.replace(/^table\s*0*/i, '');
    const tableRegex = num ? new RegExp(`^(table\\s*0*${num}|0*${num})$`, 'i') : new RegExp(`^${cleanTable}$`, 'i');

    const activeOrderOnTable = await CaptainOrder.findOne({
      tableNo: tableRegex,
      status: { $in: ['pending_approval', 'open', 'held', 'sent_to_kitchen', 'preparing', 'ready'] },
      createdAt: { $gte: today },
    }).sort({ createdAt: -1 }).lean();

    if (activeOrderOnTable) {
      const clientOrderNo = String(req.body.existingOrderNo || '').trim().toUpperCase();
      const clientOrderId = String(req.body.existingOrderId || '').trim();
      const isSameCustomer = (
        (clientOrderNo && clientOrderNo === activeOrderOnTable.orderNo.toUpperCase()) ||
        (clientOrderId && clientOrderId === String(activeOrderOnTable._id)) ||
        req.body.allowTableSharing === true
      );

      if (!isSameCustomer) {
        res.status(409);
        throw new Error(
          `Table "${cleanTable}" already has an active order (#${activeOrderOnTable.orderNo}) that has not been billed yet. Please select another table or contact a waiter for assistance.`
        );
      }
    }
  }

  const settings = await Setting.findOne().lean();
  const taxRate = Number(settings?.taxRate ?? 15);
  let safeServicePct = 0;
  if (settings?.enableServiceCharge && (!settings?.autoApplyServiceChargeDineIn || orderType === 'dine_in')) {
    safeServicePct = Math.min(100, Math.max(0, Number(settings?.serviceChargeRate) || 10));
  }

  const { orderNo, dailySequence } = await generateOrderNumber();

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    if (!item.product) continue;
    const dbProduct = await Product.findById(item.product);
    if (!dbProduct) continue;

    const unitPrice = Number(item.unitPrice ?? dbProduct.sellingPrice) || 0;
    const qty = Math.max(1, Number(item.quantity) || 1);
    const totalPrice = Math.round(unitPrice * qty * 100) / 100;

    subtotal += totalPrice;
    processedItems.push({
      product: dbProduct._id,
      productName: dbProduct.name,
      productCode: dbProduct.code,
      quantity: qty,
      unitPrice,
      totalPrice,
      notes: String(item.notes || '').slice(0, 200),
    });
  }

  subtotal = Math.round(subtotal * 100) / 100;
  const taxAmount = Math.round(((subtotal * taxRate) / 100) * 100) / 100;
  const finalServiceCharge = Math.round(((subtotal * safeServicePct) / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + taxAmount + finalServiceCharge) * 100) / 100;

  const order = await CaptainOrder.create({
    orderNo,
    dailySequence,
    tableNo: safeTableNo,
    tableLabel: safeTableLabel,
    customerName: safeCustomerName,
    customerPhone: safeCustomerPhone,
    guestCount: Math.max(1, Number(guestCount) || 1),
    orderType,
    waiter: null,
    waiterName: 'Self-Order (Pending Approval)',
    createdBy: null,
    createdByName: 'Customer Digital Menu',
    items: processedItems,
    subtotal,
    taxPercent: taxRate,
    taxAmount,
    serviceChargePercent: safeServicePct,
    serviceCharge: finalServiceCharge,
    grandTotal,
    status: 'pending_approval',
    waiterApproval: {
      required: true,
      status: 'pending',
    },
    tableNotes: safeTableNotes,
  });

  // 1. Dashboard Notification
  try {
    await Notification.create({
      type: 'order',
      title: `🛎️ New QR Order: ${safeTableNo}`,
      message: `Customer at ${safeTableNo} placed order #${orderNo} (${processedItems.length} items, ETB ${grandTotal.toFixed(2)}) awaiting waiter check.`,
      link: '/captain-order',
      severity: 'warning',
    });
  } catch (_) {}

  // 2. Telegram Notification
  if (tg) {
    try {
      const itemsList = processedItems.map((p) => `${p.productName} x${p.quantity}`).join(', ');
      tg.sendNotification?.(
        `🛎️ <b>NEW CUSTOMER QR ORDER!</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🪑 <b>Table:</b> ${safeTableNo}\n` +
        `🔢 <b>Order Code:</b> <code>#${orderNo}</code>\n` +
        `👤 <b>Customer:</b> ${safeCustomerName} (${safeCustomerPhone || 'No Phone'})\n` +
        `🍴 <b>Items:</b> ${itemsList}\n` +
        `💰 <b>Total:</b> ETB ${grandTotal.toFixed(2)}\n` +
        (safeTableNotes ? `📝 <b>Note:</b> ${safeTableNotes}\n` : '') +
        `⚠️ <i>Please verify table presence in Captain Orders.</i>`
      );
    } catch (_) {}
  }

  // 3. Real-Time Broadcast to Staff Screens
  broadcastOrderEvent('customer_qr_order', order);

  res.status(201).json({
    success: true,
    order,
    message: `Order #${orderNo} submitted successfully! A waiter will attend to your table shortly.`,
  });
}));

// ─────────────────────────────────────────────────────────────────
// 3. CALL WAITER / REQUEST BILL
// ─────────────────────────────────────────────────────────────────
// @route POST /api/captain-orders/call-waiter
router.post('/captain-orders/call-waiter', asyncHandler(async (req, res) => {
  const { tableNo = 'Table', action = 'call_waiter', customerName = '' } = req.body;
  const isBill = action === 'request_bill';
  const title = isBill ? `💵 Bill Requested: ${tableNo}` : `🛎️ Waiter Called: ${tableNo}`;
  const message = isBill
    ? `${customerName ? customerName + ' at ' : ''}${tableNo} has requested their bill.`
    : `${customerName ? customerName + ' at ' : ''}${tableNo} has called for waiter assistance.`;

  try {
    await Notification.create({
      type: 'system',
      title,
      message,
      link: '/captain-order',
      severity: isBill ? 'info' : 'warning',
    });
  } catch (_) {}

  if (tg) {
    try {
      tg.notifyWaiterCall?.({ tableNo, action, customerName }) || tg.sendNotification?.(`<b>${title}</b>\n${message}`);
    } catch (_) {}
  }

  broadcastOrderEvent('call_waiter', { tableNo, action, customerName });

  res.json({
    success: true,
    action,
    tableNo,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    message: isBill
      ? `Bill requested • a waiter is coming to ${tableNo}`
      : `Waiter called • assistance is on the way to ${tableNo}`,
  });
}));

// ─────────────────────────────────────────────────────────────────
// 4. TABLE ORDERS HISTORY & LIVE ORDER TRACKING
// ─────────────────────────────────────────────────────────────────
// @route GET /api/captain-orders/table-history
router.get('/captain-orders/table-history', asyncHandler(async (req, res) => {
  const { tableNo } = req.query;
  if (!tableNo) {
    return res.status(400).json({ success: false, message: 'Table number is required' });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cleanTable = String(tableNo).trim();
  const num = cleanTable.replace(/^table\s*0*/i, '');
  const tableRegex = num ? new RegExp(`^(table\\s*0*${num}|0*${num})$`, 'i') : new RegExp(`^${cleanTable}$`, 'i');

  const orders = await CaptainOrder.find({
    tableNo: tableRegex,
    status: { $ne: 'voided' },
    createdAt: { $gte: today },
  })
    .sort({ createdAt: -1 })
    .lean();

  const totalBill = orders.reduce((sum, o) => sum + (o.grandTotal || 0), 0);
  const totalItemsCount = orders.reduce(
    (sum, o) => sum + (o.items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0),
    0
  );

  res.json({
    success: true,
    tableNo: cleanTable,
    orders,
    totalBill,
    totalItemsCount,
  });
}));

// @route GET /api/captain-orders/track/:orderNo
router.get('/captain-orders/track/:orderNo', asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const order = await CaptainOrder.findOne({
    orderNo: { $regex: `^${orderNo.trim()}$`, $options: 'i' },
  }).lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({
    success: true,
    orderNo: order.orderNo,
    status: order.status,
    tableNo: order.tableNo,
    items: order.items,
    grandTotal: order.grandTotal,
    createdAt: order.createdAt,
  });
}));

// ─────────────────────────────────────────────────────────────────
// 5. BULK MENU VISIBILITY TOGGLE (Turn All ON / OFF)
// ─────────────────────────────────────────────────────────────────
// @route POST /api/products/bulk-menu-visibility
router.post('/products/bulk-menu-visibility', asyncHandler(async (req, res) => {
  const { isAvailableOnMenu } = req.body;
  await Product.updateMany(
    { isActive: true, deletedAt: null },
    { $set: { isAvailableOnMenu: !!isAvailableOnMenu } }
  );
  res.json({
    success: true,
    message: `All food items ${isAvailableOnMenu ? 'displayed on' : 'hidden from'} Customer Digital Menu.`,
  });
}));

// ─────────────────────────────────────────────────────────────────
// 6. WAITER APPROVES CUSTOMER QR ORDER
// ─────────────────────────────────────────────────────────────────
// @route POST /api/captain-orders/:id/approve-order
router.post('/captain-orders/:id/approve-order', asyncHandler(async (req, res) => {
  const order = await CaptainOrder.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error('Captain order not found');
  }
  if (order.status !== 'pending_approval') {
    return res.json({ success: true, order, message: `Order #${order.orderNo} is already ${order.status}.` });
  }
  order.status = 'sent_to_kitchen';
  order.waiterApproval = {
    required: true,
    status: 'approved',
    approvedBy: req.user?._id || null,
    approvedByName: req.user?.name || 'Waiter',
    approvedAt: new Date(),
  };
  if (!order.waiter || (order.waiterName && order.waiterName.toLowerCase().includes('self-order'))) {
    order.waiter = req.user?._id || null;
    order.waiterName = req.user?.name || 'Waiter';
  }
  await order.save();
  broadcastOrderEvent('order_approved', order);
  res.json({ success: true, order, message: `Order #${order.orderNo} verified & sent to kitchen.` });
}));

// ─────────────────────────────────────────────────────────────────
// 7. LIVE SSE STREAM (Zero-dependency real-time push to staff)
// ─────────────────────────────────────────────────────────────────
// @route GET /api/captain-orders/stream
router.get('/captain-orders/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  sseSubscribers.add(res);

  req.on('close', () => {
    sseSubscribers.delete(res);
  });
});

module.exports = router;

