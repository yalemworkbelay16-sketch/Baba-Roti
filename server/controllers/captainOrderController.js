const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const CaptainOrder = require("../models/CaptainOrder");
const Product = require("../models/Product");
const Setting = require("../models/Setting");

// Active SSE client connections for instant sub-second order push
const sseSubscribers = new Set();

function broadcastOrderEvent(eventType, payload) {
  const data = JSON.stringify({ type: eventType, data: payload, timestamp: Date.now() });
  for (const client of sseSubscribers) {
    try {
      client.write(`event: ${eventType}\ndata: ${data}\n\n`);
    } catch (_) {
      sseSubscribers.delete(client);
    }
  }
}
// @desc Stream live order events (SSE)
// @route GET /api/captain-orders/stream
// @access Public / Staff
const streamOrderEvents = (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  if (typeof res.flushHeaders === "function") res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ time: Date.now() })}\n\n`);
  sseSubscribers.add(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch (_) {
      clearInterval(heartbeat);
      sseSubscribers.delete(res);
    }
  }, 20000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseSubscribers.delete(res);
  });
};

function determineStation(category = "", parentCategory = "", name = "") {
  const text = `${category} ${parentCategory} ${name}`.toLowerCase();
  const baristaKeywords = [
    "beverage", "drink", "coffee", "tea", "latte", "espresso", "cappuccino",
    "juice", "smoothie", "water", "soda", "cocktail", "mocktail", "beer",
    "wine", "shake", "cold drink", "bar", "macchiato",
  ];
  return baristaKeywords.some((k) => text.includes(k)) ? "barista" : "kitchen";
}

async function generateCaptainOrderNo() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const prefix = `CAP-${y}${m}${d}`;
  const last = await CaptainOrder.findOne({ orderNo: new RegExp(`^${prefix}`) })
    .sort({ createdAt: -1 }).lean();
  const seq = last && last.dailySequence ? last.dailySequence + 1 : 1;
  return { orderNo: `${prefix}-${String(seq).padStart(3, "0")}`, dailySequence: seq };
}
// @route POST /api/captain-orders
const createCaptainOrder = asyncHandler(async (req, res) => {
  const {
    tableNo = "", tableLabel = "", customerName = "Walk-in Guest",
    customerPhone = "", guestCount = 1, orderType = "dine_in",
    waiter = null, waiterName = "",
    items = [], discountPercent = 0, serviceCharge = 0, serviceChargePercent = 0, tableNotes = "",
  } = req.body;

  if (!items || !Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error("Order must have at least one item");
  }

  const safeDiscountPct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const safeCustomerName = String(customerName || "Walk-in Guest").trim().slice(0, 100);
  const safeCustomerPhone = String(customerPhone || "").trim().slice(0, 30);
  const safeTableNo = String(tableNo || "").trim().slice(0, 50);
  const safeTableLabel = String(tableLabel || tableNo || "").trim().slice(0, 50);
  const safeTableNotes = String(tableNotes || "").trim().slice(0, 500);

  const settings = await Setting.findOne().lean();
  const taxRate = Number(settings?.taxRate ?? 15);
  let safeServicePct = Math.min(100, Math.max(0, Number(serviceChargePercent) || 0));
  if (serviceChargePercent === undefined || serviceChargePercent === null) {
    if (settings?.enableServiceCharge && (!settings?.autoApplyServiceChargeDineIn || orderType === "dine_in")) {
      safeServicePct = Math.min(100, Math.max(0, Number(settings?.serviceChargeRate) || 10));
    }
  }
  const { orderNo, dailySequence } = await generateCaptainOrderNo();

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    if (!item.product) {
      res.status(400);
      throw new Error("Each item must specify a valid product");
    }
    const qty = Math.max(0.001, Number(item.quantity) || 1);
    const product = await Product.findById(item.product).lean();
    if (!product) { res.status(400); throw new Error(`Product not found: ${item.productName || item.product}`); }

    const unitPrice = Math.max(0, Number(item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice) || 0);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    subtotal += lineTotal;
    const station = determineStation(product.category, product.parentCategory, product.name);

    processedItems.push({
      product: product._id,
      productName: product.name,
      productCode: product.code || "",
      category: product.category || "General",
      parentCategory: product.parentCategory || "FOOD",
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      notes: (item.notes || "").trim(),
      station,
      addedRound: item.addedRound || 1,
    });
  }

  let finalDiscount = 0;
  if (safeDiscountPct > 0) finalDiscount = Math.round(subtotal * safeDiscountPct / 100 * 100) / 100;
  const taxableSubtotal = Math.max(0, subtotal - finalDiscount);
  const taxAmount = Math.round(taxableSubtotal * taxRate / 100 * 100) / 100;

  let finalServiceCharge = Math.max(0, Number(serviceCharge) || 0);
  if (safeServicePct > 0) {
    finalServiceCharge = Math.round(subtotal * safeServicePct / 100 * 100) / 100;
  }
  const grandTotal = Math.round((taxableSubtotal + taxAmount + finalServiceCharge) * 100) / 100;

  const order = await CaptainOrder.create({
    orderNo, dailySequence,
    tableNo: safeTableNo, tableLabel: safeTableLabel,
    customerName: safeCustomerName, customerPhone: safeCustomerPhone,
    guestCount: Math.max(1, Number(guestCount) || 1), orderType,
    waiter: waiter || null, waiterName: waiterName || "",
    createdBy: req.user._id, createdByName: req.user.name || "Staff",
    items: processedItems, subtotal,
    discountPercent: safeDiscountPct, discountAmount: finalDiscount,
    taxPercent: taxRate, taxAmount,
    serviceChargePercent: safeServicePct,
    serviceCharge: finalServiceCharge,
    grandTotal,
    tableNotes: safeTableNotes,
    status: req.body.status || "open",
  });

  broadcastOrderEvent("pos_order_updated", order);

  res.status(201).json({ success: true, order, message: `Captain Order #${orderNo} created!` });
});

// @route GET /api/captain-orders
const getCaptainOrders = asyncHandler(async (req, res) => {
  const { status, tableNo, date, limit = 100, search } = req.query;
  const filter = {};
  if (status && status !== "all") filter.status = status;
  if (tableNo) filter.tableNo = tableNo;
  if (date) {
    const s = new Date(date); s.setHours(0, 0, 0, 0);
    const e = new Date(date); e.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: s, $lte: e };
  }
  if (search) {
    const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { orderNo: new RegExp(q, "i") },
      { customerName: new RegExp(q, "i") },
      { tableNo: new RegExp(q, "i") },
      { waiterName: new RegExp(q, "i") },
    ];
  }
  const orders = await CaptainOrder.find(filter)
    .sort({ createdAt: -1 }).limit(Number(limit)).lean();
  res.json(orders);
});

// @route GET /api/captain-orders/:id
const getCaptainOrderById = asyncHandler(async (req, res) => {
  const order = await CaptainOrder.findById(req.params.id).lean();
  if (!order) { res.status(404); throw new Error("Captain order not found"); }
  res.json(order);
});
// @route PATCH /api/captain-orders/:id
const updateCaptainOrder = asyncHandler(async (req, res) => {
  const { items, tableNotes, guestCount, customerName, waiter, waiterName,
    discountPercent, serviceCharge, serviceChargePercent, status } = req.body;

  const order = await CaptainOrder.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Captain order not found"); }

  // If already in target status, return early as idempotent success
  if (status && order.status === status) {
    return res.json(order);
  }

  // If order is already closed/settled, allow confirming status to 'billed' or 'paid', or idempotent return
  if (["paid", "billed", "voided", "cancelled"].includes(order.status)) {
    if (status === "paid" || status === "billed" || order.status === "paid") {
      if (status) order.status = status;
      if (!order.billedAt) {
        order.billedAt = new Date();
      }
      if (req.body.cashSaleRef) order.cashSaleRef = req.body.cashSaleRef;
      await order.save();
      return res.json({ success: true, order, message: `Order #${order.orderNo} is settled.` });
    }
    // Idempotent return if order is already paid or billed
    if (order.status === "paid" || order.status === "billed") {
      return res.json({ success: true, order, message: `Order #${order.orderNo} is already finalized.` });
    }
    res.status(400); throw new Error(`Cannot edit an order with status: ${order.status}`);
  }

  if (items && items.length > 0) {
    const settings = await Setting.findOne().lean();
    const taxRate = Number(settings?.taxRate ?? 15);
    let subtotal = 0;
    const processedItems = [];
    for (const item of items) {
      const qty = Math.max(0.001, Number(item.quantity) || 1);
      const product = await Product.findById(item.product).lean();
      if (!product) continue;
      const unitPrice = Math.max(0, Number(item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice) || 0);
      const lineTotal = Math.round(unitPrice * qty * 100) / 100;
      subtotal += lineTotal;
      processedItems.push({
        product: product._id, productName: product.name, productCode: product.code || "",
        category: product.category || "General", parentCategory: product.parentCategory || "FOOD",
        quantity: qty, unitPrice, totalPrice: lineTotal,
        notes: (item.notes || "").trim(),
        station: determineStation(product.category, product.parentCategory, product.name),
        addedRound: item.addedRound || 1,
      });
    }
    const dp = Math.min(100, Math.max(0, Number(discountPercent !== undefined ? discountPercent : order.discountPercent) || 0));
    const scPct = Math.min(100, Math.max(0, Number(serviceChargePercent !== undefined ? serviceChargePercent : order.serviceChargePercent) || 0));
    const finalDiscount = dp > 0 ? Math.round(subtotal * dp / 100 * 100) / 100 : 0;
    const taxableSubtotal = Math.max(0, subtotal - finalDiscount);
    const taxAmount = Math.round(taxableSubtotal * taxRate / 100 * 100) / 100;

    let sc = Math.max(0, Number(serviceCharge !== undefined ? serviceCharge : order.serviceCharge) || 0);
    if (scPct > 0) {
      sc = Math.round(subtotal * scPct / 100 * 100) / 100;
    }
    const grandTotal = Math.round((taxableSubtotal + taxAmount + sc) * 100) / 100;
    order.items = processedItems;
    order.subtotal = subtotal;
    order.discountPercent = dp;
    order.discountAmount = finalDiscount;
    order.taxAmount = taxAmount;
    order.serviceChargePercent = scPct;
    order.serviceCharge = sc;
    order.grandTotal = grandTotal;
  }

  if (tableNotes !== undefined) order.tableNotes = tableNotes;
  if (guestCount !== undefined) order.guestCount = Number(guestCount) || 1;
  if (customerName !== undefined) order.customerName = customerName;
  if (waiter !== undefined) order.waiter = waiter || null;
  if (waiterName !== undefined) order.waiterName = waiterName || "";
  if (status) {
    order.status = status;
    if (status === "paid") {
      order.billedAt = new Date();
      order.billedBy = req.user?._id || null;
      order.billedByName = req.user?.name || "Cashier";
      if (req.body.cashSaleRef) order.cashSaleRef = req.body.cashSaleRef;
    }
  }

  await order.save();
  res.json({ success: true, order, message: "Order updated successfully" });
});

// @route POST /api/captain-orders/:id/send-to-kitchen
const sendToKitchen = asyncHandler(async (req, res) => {
  const order = await CaptainOrder.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Captain order not found"); }
  order.status = "sent_to_kitchen";
  order.kotPrinted = true;
  order.kotPrintedAt = new Date();
  await order.save();
  res.json({ success: true, order });
});

// @route POST /api/captain-orders/:id/void
const voidCaptainOrder = asyncHandler(async (req, res) => {
  const { reason = "Voided by manager" } = req.body;
  const order = await CaptainOrder.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Captain order not found"); }
  if (order.status === "paid") { res.status(400); throw new Error("Cannot void a paid order. Void the cash sale instead."); }
  order.isVoided = true;
  order.status = "voided";
  order.voidReason = reason;
  order.voidedBy = req.user._id;
  order.voidedAt = new Date();
  await order.save();
  res.json({ success: true, order, message: `Captain Order #${order.orderNo} voided.` });
});

// @route GET /api/captain-orders/active-tables
const getActiveTables = asyncHandler(async (req, res) => {
  const activeOrders = await CaptainOrder.find({
    status: { $in: ["open", "sent_to_kitchen", "ready", "billed"] },
  }).select("tableNo tableLabel status waiterName guestCount grandTotal createdAt items orderNo").lean();
  res.json(activeOrders);
});

// @desc   Create order submitted by customer from public digital menu
// @route  POST /api/captain-orders/customer-order
// @access Public
const createCustomerOrder = asyncHandler(async (req, res) => {
  const {
    tableNo = "",
    tableLabel = "",
    customerName = "Walk-in Guest",
    customerPhone = "",
    guestCount = 1,
    orderType = "dine_in",
    items = [],
    tableNotes = "",
  } = req.body;

  if (!items || !Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error("Order must have at least one item");
  }

  const safeCustomerName = String(customerName || "Walk-in Guest").trim().slice(0, 100);
  const safeCustomerPhone = String(customerPhone || "").trim().slice(0, 30);
  const safeTableNo = String(tableNo || "Counter / Takeaway").trim().slice(0, 50);
  const safeTableLabel = String(tableLabel || tableNo || "Table").trim().slice(0, 50);
  const safeTableNotes = String(tableNotes || "").trim().slice(0, 500);

  const cleanTable = safeTableNo.trim();
  const isTakeaway = cleanTable.toLowerCase().includes("counter") || cleanTable.toLowerCase().includes("takeaway");

  // Validate Table: If this table already has an active unbilled order, require authorization or contact waiter
  if (!isTakeaway && cleanTable) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const num = cleanTable.replace(/^table\s*0*/i, '');
    const tableRegex = num ? new RegExp(`^(table\\s*0*${num}|0*${num})$`, 'i') : new RegExp(`^${cleanTable}$`, 'i');

    const activeOrderOnTable = await CaptainOrder.findOne({
      tableNo: tableRegex,
      status: { $in: ["pending_approval", "open", "held", "sent_to_kitchen", "preparing", "ready"] },
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
  if (settings?.enableServiceCharge && (!settings?.autoApplyServiceChargeDineIn || orderType === "dine_in")) {
    safeServicePct = Math.min(100, Math.max(0, Number(settings?.serviceChargeRate) || 10));
  }

  const { orderNo, dailySequence } = await generateCaptainOrderNo();

  let subtotal = 0;
  const processedItems = [];

  for (const item of items) {
    if (!item.product) {
      res.status(400);
      throw new Error("Each item must specify a valid product");
    }
    const qty = Math.max(0.001, Number(item.quantity) || 1);
    const product = await Product.findById(item.product).lean();
    if (!product) {
      res.status(400);
      throw new Error(`Product not found: ${item.productName || item.product}`);
    }

    const unitPrice = Math.max(0, Number(item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice) || 0);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    subtotal += lineTotal;
    const station = determineStation(product.category, product.parentCategory, product.name);

    processedItems.push({
      product: product._id,
      productName: product.name,
      productCode: product.code || "",
      category: product.category || "General",
      parentCategory: product.parentCategory || "FOOD",
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      notes: (item.notes || "").trim(),
      station,
      addedRound: 1,
    });
  }
  const taxAmount = Math.round(subtotal * taxRate / 100 * 100) / 100;
  const finalServiceCharge = safeServicePct > 0 ? Math.round(subtotal * safeServicePct / 100 * 100) / 100 : 0;
  const grandTotal = Math.round((subtotal + taxAmount + finalServiceCharge) * 100) / 100;

  // Link to a default system user
  const User = require("../models/User");
  const systemUser = await User.findOne({ role: { $in: ["admin", "manager", "cashier", "dev"] } }).lean();
  const createdById = systemUser ? systemUser._id : new mongoose.Types.ObjectId();

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
    waiterName: "Self-Order (Pending Approval)",
    createdBy: createdById,
    createdByName: "Customer Digital Menu",
    items: processedItems,
    subtotal,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: taxRate,
    taxAmount,
    serviceChargePercent: safeServicePct,
    serviceCharge: finalServiceCharge,
    grandTotal,
    status: "pending_approval",
    waiterApproval: {
      required: true,
      status: "pending",
    },
    tableNotes: safeTableNotes,
  });

  const tg = require("../utils/telegramNotifier");
  if (tg) {
    try {
      const itemsList = processedItems.map((p) => `${p.productName} x${p.quantity}`).join(", ");
      if (typeof tg.sendNotification === "function") {
        tg.sendNotification(
          `🛎️ <b>NEW CUSTOMER QR ORDER AWAITING WAITER VERIFICATION!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🪑 <b>Table:</b> ${safeTableNo}\n` +
          `🔢 <b>Order Code:</b> <code>#${orderNo}</code>\n` +
          `👤 <b>Customer:</b> ${safeCustomerName} (${safeCustomerPhone || "No Phone"})\n` +
          `🍴 <b>Items:</b> ${itemsList}\n` +
          `💰 <b>Total:</b> ETB ${grandTotal.toFixed(2)}\n` +
          (safeTableNotes ? `📝 <b>Note:</b> ${safeTableNotes}\n` : "") +
          `⚠️ <b>Security Notice:</b> Please have table waiter verify physical presence and approve order in Captain Orders.`
        );
      }
    } catch (_) { }
  }

  broadcastOrderEvent("customer_qr_order", order);

  res.status(201).json({
    success: true,
    orderNo: order.orderNo,
    order,
    message: `Order #${orderNo} received! Awaiting table waiter verification.`,
  });
});

// @desc   Customer requests waiter or bill from table digital menu
// @route  POST /api/captain-orders/call-waiter
// @access Public
const callWaiter = asyncHandler(async (req, res) => {
  const { tableNo = "Table", action = "call_waiter", customerName = "" } = req.body;
  const Notification = require("../models/Notification");
  const tg = require("../utils/telegramNotifier");

  const isBill = action === "request_bill";
  const title = isBill ? `💵 Bill Requested: ${tableNo}` : `🛎️ Waiter Called: ${tableNo}`;
  const message = isBill
    ? `${customerName ? customerName + " at " : ""}${tableNo} has requested their bill.`
    : `${customerName ? customerName + " at " : ""}${tableNo} has called for waiter assistance.`;

  await Notification.create({
    type: "system",
    title,
    message,
    icon: isBill ? "💵" : "🛎️",
    link: "/captain-order",
    severity: isBill ? "info" : "warning",
  });

  if (tg) {
    try {
      if (typeof tg.notifyWaiterCall === "function") {
        tg.notifyWaiterCall({ tableNo, action, customerName });
      } else if (typeof tg.sendNotification === "function") {
        tg.sendNotification(`<b>${title}</b>\n${message}`);
      }
    } catch (_) { }
  }

  broadcastOrderEvent("call_waiter", { tableNo, action, customerName });

  res.json({
    success: true,
    action,
    tableNo,
    time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    message: isBill
      ? `Bill requested • a waiter is coming to ${tableNo}`
      : `Waiter called • assistance is on the way to ${tableNo}`,
  });
});

// @desc   Live track single customer order status by orderNo
// @route  GET /api/captain-orders/track/:orderNo
// @access Public
const trackCustomerOrder = asyncHandler(async (req, res) => {
  const { orderNo } = req.params;
  const order = await CaptainOrder.findOne({
    orderNo: { $regex: `^${orderNo.trim()}$`, $options: 'i' },
  }).lean();

  if (!order) {
    return res.status(404).json({ success: false, message: 'Order not found' });
  }

  res.json({
    success: true,
    order: {
      orderNo: order.orderNo,
      tableNo: order.tableNo,
      customerName: order.customerName,
      status: order.status,
      waiterName: order.waiterName,
      waiterApproval: order.waiterApproval,
      items: order.items,
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      grandTotal: order.grandTotal,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
  });
});

// @desc   Check if a table currently has an active unbilled order
// @route  GET /api/captain-orders/table-status
// @access Public
const getTableStatus = asyncHandler(async (req, res) => {
  const { tableNo } = req.query;
  if (!tableNo) {
    return res.status(400).json({ success: false, message: 'Table number required' });
  }

  const cleanTable = String(tableNo).trim();
  const isTakeaway = cleanTable.toLowerCase().includes("counter") || cleanTable.toLowerCase().includes("takeaway");
  if (isTakeaway) {
    return res.json({ success: true, tableNo: cleanTable, isOccupied: false, activeOrder: null });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const num = cleanTable.replace(/^table\s*0*/i, '');
  const tableRegex = num ? new RegExp(`^(table\\s*0*${num}|0*${num})$`, 'i') : new RegExp(`^${cleanTable}$`, 'i');

  const activeOrder = await CaptainOrder.findOne({
    tableNo: tableRegex,
    status: { $in: ["pending_approval", "open", "held", "sent_to_kitchen", "preparing", "ready"] },
    createdAt: { $gte: today },
  }).select("orderNo tableNo status grandTotal items createdAt customerName").sort({ createdAt: -1 }).lean();

  res.json({
    success: true,
    tableNo: cleanTable,
    isOccupied: !!activeOrder,
    activeOrder: activeOrder || null,
  });
});
// @desc   Get all active orders today for a table so customer can view running bill & past items
// @route  GET /api/captain-orders/table-history
// @access Public
const getTableOrdersHistory = asyncHandler(async (req, res) => {
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
});

// @desc   Waiter approves customer QR self-order
// @route  POST /api/captain-orders/:id/approve-order
// @access Private (Waiter, Cashier, Supervisor, Manager, Admin, Dev)
const approveCustomerOrder = asyncHandler(async (req, res) => {
  const order = await CaptainOrder.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Captain order not found");
  }

  if (order.status !== "pending_approval") {
    return res.json({
      success: true,
      order,
      message: `Order #${order.orderNo} is already ${order.status}.`,
    });
  }
  order.status = "sent_to_kitchen";
  order.waiterApproval = {
    required: true,
    status: "approved",
    approvedBy: req.user._id,
    approvedByName: req.user.name || "Waiter",
    approvedAt: new Date(),
  };

  // Assign approving waiter if order was self-order
  if (!order.waiter || (order.waiterName && order.waiterName.toLowerCase().includes("self-order"))) {
    order.waiter = req.user._id;
    order.waiterName = req.user.name || "Waiter";
  }
  await order.save();
  // Telegram alert
  const tg = require("../utils/telegramNotifier");
  if (tg) {
    try {
      const waiterLabel = req.user.name || "Waiter";
      const itemsList = (order.items || []).map((p) => `${p.productName} x${p.quantity}`).join(", ");
      if (typeof tg.sendNotification === "function") {
        tg.sendNotification(
          `✅ <b>CUSTOMER QR ORDER VERIFIED & APPROVED!</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🪑 <b>Table:</b> ${order.tableNo}\n` +
          `🔢 <b>Order Code:</b> <code>#${order.orderNo}</code>\n` +
          `👤 <b>Approved by Waiter:</b> ${waiterLabel}\n` +
          `🍴 <b>Items:</b> ${itemsList}\n` +
          `💰 <b>Amount:</b> ETB ${Number(order.grandTotal || 0).toFixed(2)}\n` +
          `🍳 <i>Verified & sent to kitchen for preparation!</i>`
        );
      }
    } catch (_) { }
  }
  broadcastOrderEvent("order_approved", order);
  res.json({
    success: true,
    order,
    message: `Order #${order.orderNo} for ${order.tableNo} verified & approved! Sent to kitchen.`,
  });
});

// @desc   Waiter declines/rejects customer QR self-order (e.g. table empty / fake order)
// @route  POST /api/captain-orders/:id/reject-order
// @access Private (Waiter, Cashier, Supervisor, Manager, Admin, Dev)
const rejectCustomerOrder = asyncHandler(async (req, res) => {
  const { reason = "Declined by table waiter (Customer not at table)" } = req.body;
  const order = await CaptainOrder.findById(req.params.id);
  if (!order) {
    res.status(404);
    throw new Error("Captain order not found");
  }
  order.status = "cancelled";
  order.waiterApproval = {
    required: true,
    status: "rejected",
    approvedBy: req.user._id,
    approvedByName: req.user.name || "Waiter",
    rejectedReason: reason,
    rejectedAt: new Date(),
  };
  await order.save();
  // Telegram alert
  const tg = require("../utils/telegramNotifier");
  if (tg) {
    try {
      if (typeof tg.sendNotification === "function") {
        tg.sendNotification(
          `❌ <b>CUSTOMER QR ORDER DECLINED</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `🪑 <b>Table:</b> ${order.tableNo}\n` +
          `🔢 <b>Order Code:</b> <code>#${order.orderNo}</code>\n` +
          `👤 <b>Staff:</b> ${req.user.name || "Waiter"}\n` +
          `📝 <b>Reason:</b> ${reason}\n` +
          `⚠️ <i>Order was not sent to kitchen.</i>`
        );
      }
    } catch (_) { }
  }
  res.json({
    success: true,
    order,
    message: `Order #${order.orderNo} for ${order.tableNo} has been declined.`,
  });
});
module.exports = {
  streamOrderEvents,
  createCaptainOrder,
  createCustomerOrder,
  callWaiter,
  trackCustomerOrder,
  getTableStatus,
  getTableOrdersHistory,
  getCaptainOrders,
  getCaptainOrderById,
  updateCaptainOrder,
  sendToKitchen,
  voidCaptainOrder,
  getActiveTables,
  approveCustomerOrder,
  rejectCustomerOrder,
};
