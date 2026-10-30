const asyncHandler = require('express-async-handler');
const POSOrder = require('../models/POSOrder');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const StockTransaction = require('../models/StockTransaction');
const SalesRecord = require('../models/SalesRecord');
const Setting = require('../models/Setting');
const tg = require('../utils/telegramNotifier');

/**
 * Determine station for printing and preparation
 * Barista: Coffee, Tea, Beverages, Drinks, Juice, Soft Drinks, Shakes
 * Kitchen: Food, Pastry, Bakery, Kitchen, Meals, Burgers, Sandwich
 */
function determineStation(category = '', parentCategory = '', name = '') {
  const text = `${category} ${parentCategory} ${name}`.toLowerCase();
  const baristaKeywords = [
    'beverage', 'drink', 'coffee', 'tea', 'latte', 'espresso', 'cappuccino',
    'juice', 'smoothie', 'water', 'soda', 'cocktail', 'mocktail', 'beer',
    'wine', 'shake', 'cold drink', 'bar', 'macchiato'
  ];
  if (baristaKeywords.some((k) => text.includes(k))) {
    return 'barista';
  }
  return 'kitchen';
}

/**
 * Generate next Order Number: BBR-YYMMDD-XXX
 */
async function generateOrderNumber() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const datePrefix = `BBR-${y}${m}${d}`;

  // Find highest daily sequence for today
  const lastOrder = await POSOrder.findOne({ orderNo: new RegExp(`^${datePrefix}`) })
    .sort({ createdAt: -1 })
    .lean();

  let nextSeq = 1;
  if (lastOrder && lastOrder.dailySequence) {
    nextSeq = lastOrder.dailySequence + 1;
  }
  const orderNo = `${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
  return { orderNo, dailySequence: nextSeq };
}

// @desc   Create and process new POS order
// @route  POST /api/pos/orders
// @access Private (Cashier, Manager, Admin)
const createOrder = asyncHandler(async (req, res) => {
  const {
    orderType = 'dine_in',
    tableNo = '',
    customerName = 'Walk-in Guest',
    customerPhone = '',
    items = [],
    discountPercent = 0,
    discountAmount = 0,
    serviceCharge = 0,
    serviceChargePercent = 0,
    paymentMethod = 'Cash',
    amountPaid = 0,
    paymentStatus = 'paid',
    waiter = null,
    waiterName = '',
    captainOrderRef = null,
  } = req.body;

  if (!items || !Array.isArray(items) || !items.length) {
    res.status(400);
    throw new Error('Order must contain at least one item');
  }

  // Input sanitization & boundary validation
  const safeDiscountPct = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const safeServicePct = Math.min(100, Math.max(0, Number(serviceChargePercent) || 0));
  const safeCustomerName = String(customerName || 'Walk-in Guest').trim().slice(0, 100);
  const safeCustomerPhone = String(customerPhone || '').trim().slice(0, 30);
  const safeTableNo = String(tableNo || '').trim().slice(0, 50);

  const allowedPaymentMethods = ['Cash', 'Telebirr', 'Card', 'Credit', 'Other'];
  const safePaymentMethod = allowedPaymentMethods.includes(paymentMethod) ? paymentMethod : 'Cash';

  const settings = await Setting.findOne().lean();
  const taxRate = Number(settings?.taxRate ?? 15);
  const allowNegativeStock = !!settings?.allowNegativeStock;

  const { orderNo, dailySequence } = await generateOrderNumber();

  // Process items, link products, fetch recipes
  let subtotal = 0;
  let totalCOGS = 0;
  const processedItems = [];
  const materialDeductions = {}; // materialId -> { material, totalQty }

  for (const item of items) {
    if (!item.product) {
      res.status(400);
      throw new Error(`Each item must specify a product`);
    }

    const qty = Math.max(0.001, Number(item.quantity) || 1);
    const product = await Product.findById(item.product)
      .populate({ path: 'ingredients.material', model: 'RawMaterial' })
      .lean();

    if (!product) {
      res.status(400);
      throw new Error(`Product not found: ${item.productName || item.product}`);
    }

    const unitPrice = Math.max(0, Number(item.unitPrice !== undefined ? item.unitPrice : product.sellingPrice) || 0);
    const lineTotal = Math.round(unitPrice * qty * 100) / 100;
    subtotal += lineTotal;

    const station = determineStation(product.category, product.parentCategory, product.name);

    // Calculate recipe COGS and aggregate ingredient deductions
    let lineCogs = 0;
    const lineIngredients = [];

    if (product.ingredients && product.ingredients.length > 0) {
      for (const ing of product.ingredients) {
        let mat = ing.material;
        if (!mat && ing.material) {
          mat = await RawMaterial.findById(ing.material).lean();
        }
        if (!mat) continue;

        const matId = String(mat._id);
        const usedQty = (Number(ing.quantity) || 0) * qty;
        const ingUnitCost = Number(mat.unitCost || 0);
        const ingTotalCost = Math.round(usedQty * ingUnitCost * 100) / 100;
        lineCogs += ingTotalCost;

        lineIngredients.push({
          materialId: mat._id,
          materialName: mat.name,
          unit: mat.unit,
          quantityUsed: usedQty,
          unitCost: ingUnitCost,
          totalCost: ingTotalCost,
        });

        if (!materialDeductions[matId]) {
          materialDeductions[matId] = { material: mat, totalQty: 0 };
        }
        materialDeductions[matId].totalQty += usedQty;
      }
    }

    totalCOGS += lineCogs;

    processedItems.push({
      product: product._id,
      productName: product.name,
      productCode: product.code || '',
      category: product.category || 'General',
      parentCategory: product.parentCategory || 'FOOD',
      quantity: qty,
      unitPrice,
      totalPrice: lineTotal,
      notes: (item.notes || '').trim(),
      station,
      cogs: lineCogs,
      ingredientsUsed: lineIngredients,
    });
  }

  // Calculate discount & taxes
  let finalDiscount = Number(discountAmount) || 0;
  if (safeDiscountPct > 0) {
    finalDiscount = Math.round((subtotal * safeDiscountPct) / 100 * 100) / 100;
  }
  const taxableSubtotal = Math.max(0, subtotal - finalDiscount);
  const taxAmount = Math.round((taxableSubtotal * taxRate) / 100 * 100) / 100;

  let finalServiceCharge = Math.max(0, Number(serviceCharge) || 0);
  if (safeServicePct > 0) {
    finalServiceCharge = Math.round((subtotal * safeServicePct) / 100 * 100) / 100;
  }
  const grandTotal = Math.round((taxableSubtotal + taxAmount + finalServiceCharge) * 100) / 100;

  const paidAmount = Number(amountPaid) > 0 ? Number(amountPaid) : grandTotal;
  const changeDue = Math.max(0, Math.round((paidAmount - grandTotal) * 100) / 100);

  // Stock deduction execution (if payment is confirmed)
  let stockTransactionId = null;
  let salesRecordId = null;

  if (paymentStatus === 'paid') {
    // 1. Check stock availability if negative stock is disallowed
    if (!allowNegativeStock) {
      for (const matId of Object.keys(materialDeductions)) {
        const { material, totalQty } = materialDeductions[matId];
        const currentBal = Number(material.currentStock || 0);
        if (currentBal - totalQty < 0) {
          res.status(400);
          throw new Error(
            `Insufficient stock for "${material.name}". Available: ${currentBal} ${material.unit}, Required: ${totalQty.toFixed(2)} ${material.unit}`
          );
        }
      }
    }

    // 2. Perform atomic stock deductions
    const transactionItems = [];
    for (const matId of Object.keys(materialDeductions)) {
      const { material, totalQty } = materialDeductions[matId];
      await RawMaterial.findByIdAndUpdate(matId, {
        $inc: { currentStock: -totalQty },
      });

      transactionItems.push({
        material: material._id,
        materialName: material.name,
        quantity: totalQty,
        unitCost: material.unitCost || 0,
        totalCost: Math.round(totalQty * (material.unitCost || 0) * 100) / 100,
      });
    }

    // 3. Create StockTransaction record
    if (transactionItems.length > 0) {
      const posCount = await StockTransaction.countDocuments({ voucherType: 'pos_sale' });
      const voucherNo = `POS-${String(posCount + 1).padStart(5, '0')}`;
      const stockTxn = await StockTransaction.create({
        voucherType: 'pos_sale',
        voucherNo,
        type: 'out',
        reason: `Baba Roti POS Sale #${orderNo}`,
        date: new Date(),
        reference: orderNo,
        items: transactionItems,
        material: transactionItems[0]?.material,
        quantity: transactionItems[0]?.quantity,
        unitCost: transactionItems[0]?.unitCost,
        totalAmount: totalCOGS,
        status: 'posted',
        source: 'pos',
        performedBy: req.user?._id,
        createdBy: req.user?._id,
      });
      stockTransactionId = stockTxn._id;
    }

    // 4. Create SalesRecord entry for analytics & revenue reporting
    const saleLines = processedItems.map((pi) => ({
      productName: pi.productName,
      productCode: pi.productCode,
      productId: pi.product,
      quantitySold: pi.quantity,
      sellingPrice: pi.unitPrice,
      revenue: pi.totalPrice,
      cogs: pi.cogs,
      grossProfit: pi.totalPrice - pi.cogs,
      matchStatus: pi.ingredientsUsed.length > 0 ? 'recipe_deducted' : 'no_recipe',
      ingredientsUsed: pi.ingredientsUsed,
    }));

    const grossProfit = Math.round((subtotal - totalCOGS) * 100) / 100;
    const profitMargin = subtotal > 0 ? Math.round((grossProfit / subtotal) * 100 * 10) / 10 : 0;

    const salesRecord = await SalesRecord.create({
      importDate: new Date(),
      saleDate: new Date(),
      reference: orderNo,
      notes: `POS order ${orderType} - Table: ${tableNo || 'N/A'} - Cashier: ${req.user?.name || 'Staff'}`,
      source: 'pos',
      lines: saleLines,
      totalRevenue: subtotal,
      totalCOGS,
      grossProfit,
      profitMargin,
      stockTransaction: stockTransactionId,
      importedBy: req.user?._id,
    });
    salesRecordId = salesRecord._id;
  }

  // Save the POS Order
  const order = await POSOrder.create({
    orderNo,
    dailySequence,
    orderType,
    tableNo: safeTableNo,
    customerName: safeCustomerName,
    customerPhone: safeCustomerPhone,
    cashier: req.user?._id,
    cashierName: req.user?.name || 'Cashier',
    waiter: waiter || null,
    waiterName: waiterName || '',
    captainOrderRef: captainOrderRef || null,
    items: processedItems,
    subtotal,
    discountPercent: safeDiscountPct,
    discountAmount: finalDiscount,
    taxPercent: taxRate,
    taxAmount,
    serviceChargePercent: safeServicePct,
    serviceCharge: finalServiceCharge,
    grandTotal,
    totalCOGS,
    paymentMethod: safePaymentMethod,
    amountPaid: paidAmount,
    changeDue,
    paymentStatus,
    orderStatus: paymentStatus === 'paid' ? 'confirmed' : 'pending',
    stockTransaction: stockTransactionId,
    salesRecord: salesRecordId,
  });

  // If this order settles an existing Captain / Table order, mark it paid and close the table
  if (captainOrderRef) {
    try {
      const CaptainOrder = require('../models/CaptainOrder');
      await CaptainOrder.findByIdAndUpdate(captainOrderRef, {
        status: 'paid',
        isPaid: true,
        cashSaleRef: order._id,
        billedAt: new Date(),
        billedBy: req.user?._id,
        billedByName: req.user?.name || 'Cashier',
      });
    } catch (capErr) {
      console.warn('[POS] Could not update linked captain order:', capErr.message);
    }
  }

  // Optional Telegram notification
  if (tg && typeof tg.sendNotification === 'function') {
    try {
      const summaryMsg = `🧾 <b>POS Order #${orderNo}</b>\n` +
        `👤 Cashier: ${order.cashierName}\n` +
        `🍴 Type: ${orderType} | Table: ${tableNo || 'N/A'}\n` +
        `💰 Total: ETB ${grandTotal.toFixed(2)} (${paymentMethod})\n` +
        `📦 Items: ${processedItems.map(i => `${i.productName} x${i.quantity}`).join(', ')}`;
      tg.sendNotification(summaryMsg);
    } catch (_) { /* ignore notification errors */ }
  }

  res.status(201).json({
    success: true,
    order,
    message: `Order #${orderNo} placed successfully!`,
  });
});

// @desc   Get recent POS orders
// @route  GET /api/pos/orders
// @access Private
const getOrders = asyncHandler(async (req, res) => {
  const { date, status, paymentStatus, search, limit = 100 } = req.query;
  const filter = {};

  if (status) {
    filter.orderStatus = status;
  }
  if (paymentStatus) {
    filter.paymentStatus = paymentStatus;
  }

  if (date) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);
    filter.createdAt = { $gte: start, $lte: end };
  }

  if (search) {
    const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { orderNo: new RegExp(q, 'i') },
      { customerName: new RegExp(q, 'i') },
      { tableNo: new RegExp(q, 'i') },
      { waiterName: new RegExp(q, 'i') },
      { 'items.productName': new RegExp(q, 'i') },
      { 'items.productCode': new RegExp(q, 'i') },
    ];
  }

  const orders = await POSOrder.find(filter)
    .sort({ createdAt: -1 })
    .limit(Number(limit))
    .lean();

  res.json(orders);
});

// @desc   Get single order by ID or orderNo
// @route  GET /api/pos/orders/:id
// @access Private
const getOrderById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const isObjectId = /^[0-9a-fA-F]{24}$/.test(id);
  const filter = isObjectId ? { _id: id } : { orderNo: id };

  const order = await POSOrder.findOne(filter).lean();
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }
  res.json(order);
});

// @desc   Update order preparation status
// @route  PATCH /api/pos/orders/:id/status
// @access Private
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];
  if (!allowed.includes(status)) {
    res.status(400);
    throw new Error('Invalid status update');
  }

  const order = await POSOrder.findByIdAndUpdate(
    req.params.id,
    { orderStatus: status },
    { new: true }
  );

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  res.json(order);
});

// @desc   Void a POS order with manager authorization & reverse inventory
// @route  POST /api/pos/orders/:id/void
// @access Private (Manager/Admin)
const voidOrder = asyncHandler(async (req, res) => {
  const { reason = 'Order voided by manager' } = req.body;
  const order = await POSOrder.findById(req.params.id);

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  if (order.isVoided) {
    res.status(400);
    throw new Error('Order is already voided');
  }

  // Reverse stock deductions if stock was deducted
  if (order.stockTransaction && order.paymentStatus === 'paid') {
    for (const item of order.items) {
      if (item.ingredientsUsed && item.ingredientsUsed.length > 0) {
        for (const ing of item.ingredientsUsed) {
          if (ing.materialId && ing.quantityUsed > 0) {
            await RawMaterial.findByIdAndUpdate(ing.materialId, {
              $inc: { currentStock: ing.quantityUsed },
            });
          }
        }
      }
    }

    // Mark stock transaction as voided
    await StockTransaction.findByIdAndUpdate(order.stockTransaction, {
      status: 'voided',
      reason: `[VOIDED] ${reason}`,
    });

    // Mark sales record as voided / remove
    if (order.salesRecord) {
      await SalesRecord.findByIdAndDelete(order.salesRecord);
    }
  }

  order.isVoided = true;
  order.orderStatus = 'voided';
  order.paymentStatus = 'voided';
  order.voidReason = reason;
  order.voidedBy = req.user?._id;
  order.voidedByName = req.user?.name || 'Staff';
  order.voidedAt = new Date();

  await order.save();

  res.json({
    success: true,
    order,
    message: `Order #${order.orderNo} successfully voided and inventory reversed.`,
  });
});

// @desc   Log and track reprints (KOT or receipt)
// @route  POST /api/pos/orders/:id/reprint
// @access Private
const reprintOrder = asyncHandler(async (req, res) => {
  const { ticketType = 'receipt' } = req.body; // 'receipt' | 'kot'
  const update = { $inc: { printCount: 1 } };
  if (ticketType === 'kot') update.printedKOT = true;
  else update.printedReceipt = true;

  const order = await POSOrder.findByIdAndUpdate(req.params.id, update, { new: true });
  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  res.json({
    success: true,
    order,
    isReprint: (order.printCount || 0) > 1,
  });
});

// @desc   Get cashier shift / daily summary
// @route  GET /api/pos/summary
// @access Private
const getPOSSummary = asyncHandler(async (req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const filter = {
    createdAt: { $gte: todayStart, $lte: todayEnd },
    isVoided: { $ne: true },
  };

  const orders = await POSOrder.find(filter).lean();

  let totalSales = 0;
  let totalCash = 0;
  let totalTelebirr = 0;
  let totalCard = 0;
  let totalOrders = orders.length;

  for (const o of orders) {
    if (o.paymentStatus === 'paid') {
      totalSales += o.grandTotal || 0;
      if (o.paymentMethod === 'Cash') totalCash += o.grandTotal || 0;
      else if (o.paymentMethod === 'Telebirr') totalTelebirr += o.grandTotal || 0;
      else if (o.paymentMethod === 'Card') totalCard += o.grandTotal || 0;
    }
  }

  res.json({
    date: todayStart.toISOString().slice(0, 10),
    totalOrders,
    totalSales: Math.round(totalSales * 100) / 100,
    totalCash: Math.round(totalCash * 100) / 100,
    totalTelebirr: Math.round(totalTelebirr * 100) / 100,
    totalCard: Math.round(totalCard * 100) / 100,
  });
});

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  voidOrder,
  reprintOrder,
  getPOSSummary,
};
