const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const StockTransaction = require('../models/StockTransaction');
const { VOUCHER_DIRECTION } = require('../models/StockTransaction');
const RawMaterial = require('../models/RawMaterial');
const User = require('../models/User');
const { invalidateDashboardCache } = require('./dashboardController');
const { hasPermission } = require('../middleware/authMiddleware');
const tg = require('../utils/telegramNotifier');
const notify = require('../utils/notificationHelper');

// ── helpers ───────────────────────────────────────────────────────────
const verifyUserPassword = async (userId, password) => {
  const user = await User.findById(userId).select('+password');
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  return ok ? user : null;
};

// ── Auto voucher number ───────────────────────────────────────────────
const generateVoucherNo = async (voucherType) => {
  const prefixes = {
    cash_grv:       'CGRV',
    credit_grv:     'CRGRV',
    disposal:       'DISP',
    neg_adjustment: 'NADJ',
    pos_adjustment: 'PADJ',
    fresh_bazaar:   'FBR',
    sales_import:   'SALE',
    pos_sale:       'POS',
    manual_sale:    'MSALE',
  };
  const prefix = prefixes[voucherType] ?? 'TXN';
  const count = await StockTransaction.countDocuments({ voucherType });
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
};

// ── GET /api/transactions ─────────────────────────────────────────────
const getTransactions = asyncHandler(async (req, res) => {
  const { voucherType, material, from, to } = req.query;
  const filter = {};
  if (voucherType) filter.voucherType = voucherType;
  if (material)    filter.$or = [{ material }, { 'items.material': material }];
  if (from || to) {
    filter.date = {};
    if (from) {
      filter.date.$gte = new Date(from);
    }
    if (to) {
      const toD = new Date(to);
      // If 'to' is just a date string like YYYY-MM-DD, extend to end of day
      if (typeof to === 'string' && to.trim().length === 10) {
        toD.setHours(23, 59, 59, 999);
      }
      filter.date.$lte = toD;
    }
  }

  const transactions = await StockTransaction.find(filter)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy', 'name')
    .sort({ date: -1 })
    .limit(500)
    .lean();

  res.json(transactions);
});


// ── POST /api/transactions ────────────────────────────────────────────
const createTransaction = asyncHandler(async (req, res) => {
  const {
    voucherType, voucherNo, supplier,
    items = [],
    reason, reference, notes, date,
    attachments = [],
    attachment = '',
  } = req.body;

  if (!VOUCHER_DIRECTION[voucherType]) {
    res.status(400);
    throw new Error(`Unknown voucher type: ${voucherType}`);
  }

  const direction = VOUCHER_DIRECTION[voucherType];

  if (!items.length) {
    res.status(400);
    throw new Error('At least one item is required.');
  }

  if ((voucherType === 'cash_grv' || voucherType === 'credit_grv') && !supplier) {
    res.status(400);
    throw new Error('Supplier is required for Goods Receiving Vouchers.');
  }

  const resolvedItems = [];
  for (const item of items) {
    if (!item.material) {
      res.status(400);
      throw new Error('Each item must specify a material.');
    }
    const qty = Number(item.quantity);
    if (isNaN(qty) || qty <= 0) {
      res.status(400);
      throw new Error('Quantity must be a positive number greater than 0.');
    }
    const mat = await RawMaterial.findById(item.material);
    if (!mat) {
      res.status(404);
      throw new Error(`Material not found: ${item.material}`);
    }
    if (direction === 'out' && mat.currentStock < qty) {
      res.status(400);
      throw new Error(
        `Insufficient stock for "${mat.name}". Available: ${mat.currentStock} ${mat.unit}, requested: ${qty}.`
      );
    }
    const unitCost  = Number(item.unitCost) >= 0 ? Number(item.unitCost) : (mat.unitCost || 0);
    const totalCost = Math.round(unitCost * qty * 100) / 100;
    resolvedItems.push({ material: mat._id, quantity: qty, unitCost, totalCost, _doc: mat });
  }

  const totalAmount = resolvedItems.reduce((s, i) => s + i.totalCost, 0);

  const formattedAttachments = Array.isArray(attachments) && attachments.length > 0
    ? attachments.map(a => ({
        url: a.url || a,
        name: a.name || 'Receipt',
        mimeType: a.mimeType || 'image/jpeg',
        size: a.size || 0,
        uploadedAt: a.uploadedAt || new Date(),
      }))
    : (attachment ? [{ url: attachment, name: 'Receipt', mimeType: 'image/jpeg', size: 0, uploadedAt: new Date() }] : []);

  const firstItem = resolvedItems[0];
  const txnData = {
    voucherType,
    voucherNo: voucherNo || (await generateVoucherNo(voucherType)),
    supplier:  supplier || undefined,
    type:      direction,
    material:  firstItem.material,
    quantity:  firstItem.quantity,
    unitCost:  firstItem.unitCost,
    items:     resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost })),
    reason:    reason || '',
    reference: reference || '',
    notes:     notes || '',
    date:      date ? new Date(date) : new Date(),
    attachment: attachment || (formattedAttachments[0]?.url || ''),
    attachments: formattedAttachments,
    performedBy: req.user._id,
    totalAmount,
    status: 'pending',
    trail: [{ action: 'pending', by: req.user._id, byName: req.user.name, byRole: req.user.role }],
  };

  const transaction = await StockTransaction.create(txnData);

  // ⚠️ Stock is NOT applied on creation (Pending status).
  // Stock will be applied when the transaction is CHECKED (first approval stage).
  // This ensures pending vouchers have zero effect on the balance sheet.

  const populated = await StockTransaction.findById(transaction._id)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy', 'name');

  invalidateDashboardCache();
  tg.notifyTransaction(populated, req.user);
  notify.push({ type: 'transaction', title: 'New Stock Transaction', message: `${req.user.name} recorded a ${populated.voucherType?.replace('_',' ')} — ${populated.items?.length || 1} item(s)`, icon: populated.type === 'in' ? '📥' : '📤', link: '/transactions', severity: 'info', userId: req.user._id });
  res.status(201).json(populated);
});
// ── PUT /api/transactions/:id ─────────────────────────────────────────
const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransaction.findById(req.params.id);
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found');
  }

  if (transaction.status !== 'pending') {
    res.status(400);
    throw new Error(`Cannot edit transaction in "${transaction.status}" status. Only pending transactions can be edited.`);
  }
  const {
    voucherType = transaction.voucherType,
    voucherNo,
    supplier,
    items = [],
    reason,
    reference,
    notes,
    date,
    attachments = [],
    attachment = '',
  } = req.body;

  if (!VOUCHER_DIRECTION[voucherType]) {
    res.status(400);
    throw new Error(`Unknown voucher type: ${voucherType}`);
  }

  const newDirection = VOUCHER_DIRECTION[voucherType];
  const oldDirection = transaction.type || VOUCHER_DIRECTION[transaction.voucherType];

  if (!items.length) {
    res.status(400);
    throw new Error('At least one item is required.');
  }

  if ((voucherType === 'cash_grv' || voucherType === 'credit_grv') && !supplier) {
    res.status(400);
    throw new Error('Supplier is required for Goods Receiving Vouchers.');
  }

  // ⚠️ Pending transactions have NO stock impact.
  // Editing a pending voucher only updates document fields — no stock changes needed.

  // Resolve new items (validate materials + compute costs only)
  const resolvedItems = [];
  for (const item of items) {
    const matId = item.material?._id || item.material;
    const mat = await RawMaterial.findById(matId);
    if (!mat) {
      res.status(404);
      throw new Error(`Material not found: ${matId}`);
    }
    const unitCost  = Number(item.unitCost) || mat.unitCost || 0;
    const totalCost = unitCost * Number(item.quantity);
    resolvedItems.push({ material: mat._id, quantity: Number(item.quantity), unitCost, totalCost, _doc: mat });
  }

  // 4. Update transaction document
  const totalAmount = resolvedItems.reduce((s, i) => s + i.totalCost, 0);
  const formattedAttachments = Array.isArray(attachments) && attachments.length > 0
    ? attachments.map(a => ({
        url: a.url || a,
        name: a.name || 'Receipt',
        mimeType: a.mimeType || 'image/jpeg',
        size: a.size || 0,
        uploadedAt: a.uploadedAt || new Date(),
      }))
    : (attachment ? [{ url: attachment, name: 'Receipt', mimeType: 'image/jpeg', size: 0, uploadedAt: new Date() }] : []);

  const firstItem = resolvedItems[0];

  transaction.voucherType = voucherType;
  if (voucherNo) transaction.voucherNo = voucherNo;
  transaction.supplier    = supplier || undefined;
  transaction.type        = newDirection;
  transaction.material    = firstItem.material;
  transaction.quantity    = firstItem.quantity;
  transaction.unitCost    = firstItem.unitCost;
  transaction.items       = resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost }));
  transaction.reason      = reason || '';
  transaction.reference   = reference || '';
  transaction.notes       = notes || '';
  if (date) transaction.date = new Date(date);
  transaction.attachments = formattedAttachments;
  transaction.attachment  = formattedAttachments.length > 0 ? formattedAttachments[0].url : '';
  transaction.totalAmount = totalAmount;

  if (!transaction.trail) transaction.trail = [];
  transaction.trail.push({
    action: 'pending',
    by: req.user._id,
    byName: req.user.name,
    byRole: req.user.role,
    note: 'Voucher details updated',
    at: new Date(),
  });

  await transaction.save();

  const populated = await StockTransaction.findById(transaction._id)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy', 'name');

  invalidateDashboardCache();
  tg.notifyTransactionUpdated(populated, req.user);
  res.json(populated);
});

// ── DELETE /api/transactions/:id ──────────────────────────────────────
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransaction.findById(req.params.id);
  if (!transaction) { res.status(404); throw new Error('Transaction not found'); }

  const direction = transaction.type || VOUCHER_DIRECTION[transaction.voucherType];

  // Only reverse stock if it was already applied (checked / approved / posted).
  // Pending transactions never affected stock so nothing to reverse.
  const wasApplied = ['checked', 'approved', 'posted'].includes(transaction.status ?? 'pending');
  if (wasApplied) {
    const itemsToReverse = transaction.items?.length
      ? transaction.items
      : [{ material: transaction.material, quantity: transaction.quantity }];

    for (const item of itemsToReverse) {
      const mat = await RawMaterial.findById(item.material);
      if (mat) {
        mat.currentStock += direction === 'in' ? -item.quantity : item.quantity;
        await mat.save();
      }
    }
  }

  // Soft delete — move to recycle bin
  transaction.deletedAt   = new Date();
  transaction.deletedBy   = req.user?.name || 'System';
  transaction.deletedFrom = 'transactions';
  await transaction.save();

  tg.notifyTransactionDeleted(transaction, req.user);
  notify.push({ type: 'transaction', title: 'Transaction Deleted', message: `${req.user.name} deleted voucher ${transaction.voucherNo || transaction._id?.toString().slice(-6)}`, icon: '🗑️', link: '/transactions', severity: 'warning', userId: req.user._id });
  invalidateDashboardCache();
  res.json({ message: 'Transaction moved to recycle bin and stock reversed.' });
});

const bulkDeleteTransactions = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) { res.status(400); throw new Error('No ids provided'); }

  const transactions = await StockTransaction.find({ _id: { $in: ids } });
  for (const transaction of transactions) {
    const direction = transaction.type || VOUCHER_DIRECTION[transaction.voucherType];
    // Only reverse stock if it was already applied (checked/approved/posted)
    const wasApplied = ['checked', 'approved', 'posted'].includes(transaction.status ?? 'pending');
    if (wasApplied) {
      const items = transaction.items?.length
        ? transaction.items
        : [{ material: transaction.material, quantity: transaction.quantity }];
      for (const item of items) {
        const mat = await RawMaterial.findById(item.material);
        if (mat) {
          mat.currentStock += direction === 'in' ? -item.quantity : item.quantity;
          await mat.save();
        }
      }
    }
    transaction.deletedAt   = new Date();
    transaction.deletedBy   = req.user?.name || 'System';
    transaction.deletedFrom = 'transactions';
    await transaction.save();
  }

  invalidateDashboardCache();
  res.json({ message: `${ids.length} transaction(s) moved to recycle bin.` });
});

const restoreTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransaction.findById(req.params.id);
  if (!transaction) { res.status(404); throw new Error('Transaction not found'); }

  // Re-apply stock only if it was checked/approved/posted (i.e. stock was previously applied)
  const direction = transaction.type || VOUCHER_DIRECTION[transaction.voucherType];
  const wasApplied = ['checked', 'approved', 'posted'].includes(transaction.status ?? 'pending');
  if (wasApplied) {
    const items = transaction.items?.length
      ? transaction.items
      : [{ material: transaction.material, quantity: transaction.quantity }];
    for (const item of items) {
      const mat = await RawMaterial.findById(item.material);
      if (mat) {
        mat.currentStock += direction === 'in' ? item.quantity : -item.quantity;
        await mat.save();
      }
    }
  }

  transaction.deletedAt   = null;
  transaction.deletedBy   = null;
  transaction.deletedFrom = null;
  await transaction.save();

  invalidateDashboardCache();
  res.json({ message: 'Transaction restored and stock re-applied.', transaction });
});

const permanentDeleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await StockTransaction.findById(req.params.id);
  if (!transaction) { res.status(404); throw new Error('Transaction not found'); }
  await transaction.deleteOne();
  invalidateDashboardCache();
  res.json({ message: 'Transaction permanently deleted.' });
});


// ── GET /api/transactions/summary ────────────────────────────────────
const getVoucherSummary = asyncHandler(async (req, res) => {
  const { from, to, voucherType } = req.query;
  const match = {};
  if (voucherType) match.voucherType = voucherType;
  if (from || to) {
    match.date = {};
    if (from) match.date.$gte = new Date(from);
    if (to)   match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const summary = await StockTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$voucherType',
        count:       { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        totalQty:    { $sum: '$quantity' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json(summary);
});

// ── POST /api/transactions/:id/advance ───────────────────────────────
const advanceTransaction = asyncHandler(async (req, res) => {
  const { action, password, note = '' } = req.body;
  if (!password) { res.status(400); throw new Error('Password is required'); }

  const actor = await verifyUserPassword(req.user._id, password);
  if (!actor) { res.status(401); throw new Error('Incorrect password — action not authorised'); }

  const txn = await StockTransaction.findById(req.params.id);
  if (!txn) { res.status(404); throw new Error('Transaction not found'); }

  const actionCapMap = {
    check: 'checkReview',
    approve: 'approveGoods',
    post: 'postLedger',
    void: 'voidTransactions',
  };

  const cap = actionCapMap[action];
  if (!cap) { res.status(400); throw new Error(`Unknown action: ${action}`); }

  const transitions = {
    check:   { from: ['pending'],            to: 'checked' },
    approve: { from: ['checked'],            to: 'approved' },
    post:    { from: ['approved'],           to: 'posted' },
    void:    { from: ['pending','checked','approved','posted'], to: 'voided' },
  };

  const rule = transitions[action];
  if (!rule.from.includes(txn.status)) {
    res.status(400);
    throw new Error(`Cannot ${action} a voucher that is currently "${txn.status}"`);
  }

  const allowed = await hasPermission(actor.role, cap);
  if (!allowed) {
    res.status(403);
    throw new Error(`Your role (${actor.role}) does not have permission to "${action}" vouchers`);
  }

  const prev = txn.status;
  txn.status = rule.to;
  txn.trail = txn.trail || [];
  txn.trail.push({ action: rule.to, by: actor._id, byName: actor.name, byRole: actor.role, note });

  if (action === 'check')   { txn.checkedBy  = actor._id; txn.checkedAt  = new Date(); }
  if (action === 'approve') { txn.approvedBy = actor._id; txn.approvedAt = new Date(); }
  if (action === 'post')    { txn.postedBy   = actor._id; txn.postedAt   = new Date(); }

  // ── STOCK IMPACT RULES ────────────────────────────────────────────
  // CHECKED  → apply stock (first time it affects the balance sheet)
  // APPROVED → no change (stock already applied at check)
  // POSTED   → no change (stock already applied at check)
  // VOIDED   → reverse stock (only if it was checked/approved/posted)

  const direction = txn.type || VOUCHER_DIRECTION[txn.voucherType];
  const stockItems = txn.items?.length
    ? txn.items
    : [{ material: txn.material, quantity: txn.quantity }];

  if (action === 'check') {
    // Apply stock for the first time + WAC update for stock-IN
    for (const item of stockItems) {
      const mat = await RawMaterial.findById(item.material);
      if (mat) {
        if (direction === 'in') {
          // ── Weighted Average Cost (WAC) ──────────────────────────
          // newUnitCost = (oldStock × oldCost + inQty × inCost) / (oldStock + inQty)
          // Only update when oldStock > 0; if stock was 0, just use the new price.
          const oldStock = mat.currentStock >= 0 ? mat.currentStock : 0;
          const oldCost  = mat.unitCost  || 0;
          const inQty    = item.quantity || 0;
          const inCost   = item.unitCost || oldCost;
          const totalQty = oldStock + inQty;
          if (totalQty > 0) {
            mat.unitCost = ((oldStock * oldCost) + (inQty * inCost)) / totalQty;
            // Round to 4 decimal places to avoid floating-point noise
            mat.unitCost = Math.round(mat.unitCost * 10000) / 10000;
          }
          mat.currentStock += inQty;
        } else {
          mat.currentStock -= item.quantity;
        }
        await mat.save();
      }
    }
  }

  if (action === 'void') {
    // Only reverse stock if it was already applied (i.e. was checked/approved/posted)
    const wasApplied = ['checked', 'approved', 'posted'].includes(prev);
    if (wasApplied) {
      for (const item of stockItems) {
        const mat = await RawMaterial.findById(item.material);
        if (mat) {
          mat.currentStock += direction === 'in' ? -item.quantity : item.quantity;
          await mat.save();
        }
      }
    }
  }

  await txn.save();
  invalidateDashboardCache();

  const populated = await StockTransaction.findById(txn._id)
    .populate('material', 'name unit')
    .populate('items.material', 'name unit unitCost')
    .populate('supplier', 'name')
    .populate('performedBy checkedBy approvedBy postedBy', 'name role');

  tg.notifyTransactionAdvanced(populated, action, actor);
  if (['void','approve'].includes(action)) {
    notify.push({ type: 'transaction', title: `Voucher ${action}d`, message: `${actor.name} ${action}d ${populated.voucherNo || 'voucher'}`, icon: action === 'void' ? '🔴' : '🟣', link: '/transactions', severity: action === 'void' ? 'error' : 'success', userId: actor._id });
  }
  res.json({ message: `Voucher moved from "${prev}" → "${rule.to}"`, transaction: populated });
});


// ── POST /api/transactions/import-sales ──────────────────────────────
// Enhanced: matches by product code OR name, deducts stock if matched, records complete sold POS products list
const importSales = asyncHandler(async (req, res) => {
  const { sales, notes, reference, saleDate } = req.body;
  if (!sales || !sales.length) {
    res.status(400);
    throw new Error('No sales data provided');
  }

  const Product     = require('../models/Product');
  const SalesRecord = require('../models/SalesRecord');

  const escapeRegex = (s) => (s ? String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '');

  const materialDeductions = {};
  const saleLines = [];
  const allSoldProducts = [];
  const notFound  = [];

  for (const sale of sales) {
    const { productName, productCode, quantity, revenue, unitPrice } = sale;
    const nameStr = (productName || '').trim();
    const codeStr = (productCode || '').trim();

    if (!nameStr && !codeStr) continue;

    const qty = Math.max(0.001, Number(quantity) || 1);
    const rev = Number(revenue) || 0;
    const price = Number(unitPrice) || 0;
    const lineIngredients = [];

    // 1. Try to find in Product by code or name (isActive only)
    let product = null;
    if (codeStr) {
      // Match exact code OR code with trailing dashes (e.g. stored as "P-0001-")
      const escapedCode = escapeRegex(codeStr);
      product = await Product.findOne({
        isActive: true,
        code: { $regex: `^${escapedCode}-*$`, $options: 'i' },
      }).populate({ path: 'ingredients.material', model: 'RawMaterial' });
    }
    if (!product && nameStr) {
      product = await Product.findOne({
        isActive: true,
        name: new RegExp(`^${escapeRegex(nameStr)}$`, 'i'),
      }).populate({ path: 'ingredients.material', model: 'RawMaterial' });
    }
    // Fallback: partial match — code contains the term or name contains the term
    if (!product && (codeStr || nameStr)) {
      const term = escapeRegex(codeStr || nameStr);
      product = await Product.findOne({
        isActive: true,
        $or: [
          { code: { $regex: `^${term}-*$`, $options: 'i' } },
          { name: { $regex: `^${term}$`,   $options: 'i' } },
        ],
      }).populate({ path: 'ingredients.material', model: 'RawMaterial' });
    }

    if (product) {
      let cogs = 0;
      // Re-fetch ingredients with explicit populate to ensure materials load
      // even if the shorthand populate silently missed them
      const ingList = product.ingredients || [];
      const hasRecipe = ingList.length > 0;
      if (hasRecipe) {
        for (const ing of ingList) {
          // ing.material is populated; if null, fetch manually by ID
          let mat = ing.material;
          if (!mat && ing._doc?.material) {
            mat = await RawMaterial.findById(ing._doc.material).lean();
          }
          if (!mat) continue;
          const matId     = mat._id.toString();
          const deductQty = ing.quantity * qty;
          const ingCost   = (mat.unitCost || 0) * deductQty;
          cogs += ingCost;
          materialDeductions[matId] = (materialDeductions[matId] || 0) + deductQty;
          lineIngredients.push({
            materialId:   mat._id,
            materialName: mat.name,
            unit:         mat.unit,
            quantityUsed: deductQty,
            unitCost:     mat.unitCost || 0,
            totalCost:    ingCost,
          });
        }
      }

      let lineRev = rev;
      if (lineRev <= 0) {
        if (price > 0) lineRev = price * qty;
        else if (product.sellingPrice > 0) lineRev = product.sellingPrice * qty;
      }
      const lineSellingPrice = qty > 0 ? (lineRev / qty) : (product.sellingPrice || 0);

      const recordLine = {
        productName:     product.name || nameStr,
        productCode:     product.code || codeStr,
        productId:       product._id,
        category:        product.category || 'General',
        parentCategory:  product.parentCategory || 'FOOD',
        uom:             product.uom || 'Pcs',
        quantitySold:    qty,
        sellingPrice:    lineSellingPrice,
        revenue:         lineRev,
        cogs,
        grossProfit:     lineRev - cogs,
        matchStatus:     (hasRecipe && lineIngredients.length > 0) ? 'recipe_deducted' : (hasRecipe ? 'no_recipe' : 'no_recipe'),
        ingredientsUsed: lineIngredients,
      };

      saleLines.push(recordLine);
      allSoldProducts.push(recordLine);
      continue;
    }

    // 2. Try RawMaterial directly
    let material = null;
    if (codeStr) {
      material = await RawMaterial.findOne({ code: new RegExp(`^${escapeRegex(codeStr)}$`, 'i') });
    }
    if (!material && nameStr) {
      material = await RawMaterial.findOne({ name: new RegExp(`^${escapeRegex(nameStr)}$`, 'i') });
    }
    if (!material && (codeStr || nameStr)) {
      const term = (nameStr || codeStr);
      material = await RawMaterial.findOne({
        $or: [
          { code: new RegExp(`^${escapeRegex(term)}$`, 'i') },
          { name: new RegExp(`^${escapeRegex(term)}$`, 'i') },
        ]
      });
    }

    if (material) {
      const matId   = material._id.toString();
      const ingCost = (material.unitCost || 0) * qty;
      materialDeductions[matId] = (materialDeductions[matId] || 0) + qty;
      lineIngredients.push({
        materialId:   material._id,
        materialName: material.name,
        unit:         material.unit,
        quantityUsed: qty,
        unitCost:     material.unitCost || 0,
        totalCost:    ingCost,
      });

      let lineRev = rev;
      if (lineRev <= 0) {
        if (price > 0) lineRev = price * qty;
        else if (material.unitCost > 0) lineRev = material.unitCost * 1.35 * qty;
      }
      const lineSellingPrice = qty > 0 ? (lineRev / qty) : 0;

      const recordLine = {
        productName:     material.name || nameStr,
        productCode:     material.code || codeStr,
        productId:       null,
        category:        material.category || 'General',
        parentCategory:  'RAW',
        uom:             material.unit || 'Pcs',
        quantitySold:    qty,
        sellingPrice:    lineSellingPrice,
        revenue:         lineRev,
        cogs:            ingCost,
        grossProfit:     lineRev - ingCost,
        matchStatus:     'direct_material',
        ingredientsUsed: lineIngredients,
      };

      saleLines.push(recordLine);
      allSoldProducts.push(recordLine);
      continue;
    }

    // 3. Unmatched product
    const identifier = nameStr || codeStr;
    notFound.push(identifier);

    let lineRev = rev;
    if (lineRev <= 0 && price > 0) lineRev = price * qty;
    const lineSellingPrice = qty > 0 ? (lineRev / qty) : price;

    const unmatchedLine = {
      productName:     nameStr || codeStr,
      productCode:     codeStr,
      productId:       null,
      category:        'Unmatched',
      parentCategory:  '—',
      uom:             'Pcs',
      quantitySold:    qty,
      sellingPrice:    lineSellingPrice,
      revenue:         lineRev,
      cogs:            0,
      grossProfit:     lineRev,
      matchStatus:     'unmatched',
      ingredientsUsed: [],
    };
    allSoldProducts.push(unmatchedLine);
  }

  // Aggregate totals
  const totalRevenue = saleLines.reduce((s, l) => s + (l.revenue     || 0), 0);
  const totalCOGS    = saleLines.reduce((s, l) => s + (l.cogs        || 0), 0);
  const grossProfit  = totalRevenue - totalCOGS;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

  // Create SalesRecord
  const salesRecord = await SalesRecord.create({
    saleDate:    saleDate ? new Date(saleDate) : new Date(),
    reference:   reference || '',
    notes:       notes || 'Imported from POS/Excel report',
    source:      'excel_import',
    lines:       saleLines,
    totalRevenue,
    totalCOGS,
    grossProfit,
    profitMargin,
    importedBy:  req.user._id,
  });

  // Create stock transaction if there are materials to deduct
  let transaction = null;
  const resolvedItems = [];
  for (const [matId, qty] of Object.entries(materialDeductions)) {
    if (qty <= 0) continue;
    const mat = await RawMaterial.findById(matId);
    if (mat) resolvedItems.push({ material: mat._id, quantity: qty, unitCost: mat.unitCost || 0, totalCost: (mat.unitCost || 0) * qty, _doc: mat });
  }

  if (resolvedItems.length > 0) {
    const isManual = Boolean(notes?.toLowerCase().includes('manual') || req.body.isManual);
    const resolvedVoucherType = isManual ? 'manual_sale' : 'sales_import';
    const resolvedReason = isManual ? 'Manual Sales Registration' : 'Sales Report Import';

    const totalAmount = resolvedItems.reduce((s, i) => s + i.totalCost, 0);
    transaction = await StockTransaction.create({
      voucherType: resolvedVoucherType,
      voucherNo:   await generateVoucherNo(resolvedVoucherType),
      type:        'out',
      items:       resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost })),
      material:    resolvedItems[0].material,
      quantity:    resolvedItems[0].quantity,
      unitCost:    resolvedItems[0].unitCost,
      reason:      resolvedReason,
      reference:   reference || '',
      notes:       notes || (isManual ? 'Manual Sales Registration' : 'Automated stock deduction from sales report'),
      date:        saleDate ? new Date(saleDate) : new Date(),
      performedBy: req.user._id,
      totalAmount,
      status:      'pending',
      trail: [{ action: 'pending', by: req.user._id, byName: req.user.name, byRole: req.user.role }],
    });

    salesRecord.stockTransaction = transaction._id;
    await salesRecord.save();

    for (const item of resolvedItems) {
      item._doc.currentStock -= item.quantity;
      await item._doc.save();
    }
  }

  invalidateDashboardCache();

  res.status(201).json({
    message: 'Sales imported. Stock deducted and P&L recorded.',
    salesRecord,
    transactionId: transaction?._id,
    summary: {
      totalRevenue,
      totalCOGS,
      grossProfit,
      profitMargin: profitMargin.toFixed(1) + '%',
      totalSoldProducts: allSoldProducts.length,
      matchedCount: saleLines.length,
      unmatchedCount: notFound.length,
    },
    items: allSoldProducts,
    unmatchedProducts: notFound,
  });
});

// ── POST /api/transactions/parse-image-sales ─────────────────────────
// Accepts a base64-encoded image of a POS report, runs OCR via ocr.space,
// parses the resulting text for article codes / names / quantities / amounts.
const parseImageSales = asyncHandler(async (req, res) => {
  const { imageBase64, mimeType = 'image/jpeg' } = req.body;
  if (!imageBase64) { res.status(400); throw new Error('No image data provided'); }

  const https    = require('https');
  const querystring = require('querystring');

  const OCR_API_KEY = process.env.OCR_API_KEY || 'helloworld'; // helloworld = free demo key

  // Call ocr.space API
  const ocrText = await new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      base64Image: `data:${mimeType};base64,${imageBase64}`,
      language:    'eng',
      isTable:     'true',
      OCREngine:   '2',
      apikey:      OCR_API_KEY,
    });

    const options = {
      hostname: 'api.ocr.space',
      path:     '/parse/image',
      method:   'POST',
      headers:  {
        'Content-Type':   'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const request = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.IsErroredOnProcessing) {
            reject(new Error(json.ErrorMessage?.[0] || 'OCR processing failed'));
            return;
          }
          const text = json.ParsedResults?.[0]?.ParsedText || '';
          resolve(text);
        } catch (e) {
          reject(new Error('Invalid OCR response'));
        }
      });
    });
    request.on('error', reject);
    request.write(postData);
    request.end();
  });

  if (!ocrText.trim()) {
    res.status(422); throw new Error('No text detected in the image. Please use a clearer photo.');
  }

  // ── Parse OCR text for POS data ──────────────────────────────────
  // Lines that look like: CODE  NAME  QTY  AVG_AMOUNT  TOTAL_AMOUNT
  // We try to extract rows with at least a code pattern (P-XXXX) and numbers.
  const rows = [];
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Skip header/summary lines
    if (/^(category|sub.?category|article|catagory|total|grand|sub\s|add\.|discount|erp|page|count:)/i.test(line)) continue;
    if (/^\s*$/.test(line)) continue;

    // Try to detect a product code pattern (P-XXXX or p-XXXXX-)
    const codeMatch = line.match(/\b([Pp]-?\d{3,6}-?)\b/);
    if (!codeMatch) continue; // skip lines without a product code

    const code = codeMatch[1].replace(/-+$/, '').trim();

    // Extract all numbers from the line
    const nums = [...line.matchAll(/[\d,]+\.?\d*/g)]
      .map(m => parseFloat(m[0].replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);

    if (nums.length < 2) continue; // need at least qty + one amount

    // Heuristic: first small number = qty, last large number = total amount, middle = avg
    const qty      = nums[0] <= 1000 ? nums[0] : 1;
    const totalAmt = nums[nums.length - 1];
    const avgAmt   = nums.length >= 3 ? nums[nums.length - 2] : (qty > 0 ? totalAmt / qty : totalAmt);

    // Extract product name — text between code and first number
    const afterCode = line.slice(line.indexOf(codeMatch[0]) + codeMatch[0].length);
    const nameMatch = afterCode.match(/^[^0-9\t]*/);
    const name = (nameMatch ? nameMatch[0] : '').replace(/[^\w\s\-\/\(\)]/g, '').trim();

    if (qty <= 0 || totalAmt <= 0) continue;

    rows.push({ code, name, qty, avgAmt, totalAmt });
  }

  res.json({
    rows,
    rawText: ocrText,
    message: rows.length > 0
      ? `Detected ${rows.length} product line(s) from the image.`
      : 'No product lines detected. The image may be unclear or not in supported POS format.',
  });
});

module.exports = { getTransactions, createTransaction, updateTransaction, deleteTransaction, bulkDeleteTransactions, restoreTransaction, permanentDeleteTransaction, getVoucherSummary, advanceTransaction, importSales, parseImageSales };
