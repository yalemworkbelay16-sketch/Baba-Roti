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
    cash_grv: 'CGRV',
    credit_grv: 'CRGRV',
    disposal: 'DISP',
    neg_adjustment: 'NADJ',
    pos_adjustment: 'PADJ',
    fresh_bazaar: 'FBR',
    sales_import: 'SALE',
    pos_sale: 'POS',
    manual_sale: 'MSALE',
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
  if (material) filter.$or = [{ material }, { 'items.material': material }];
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
    const unitCost = Number(item.unitCost) >= 0 ? Number(item.unitCost) : (mat.unitCost || 0);
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
    supplier: supplier || undefined,
    type: direction,
    material: firstItem.material,
    quantity: firstItem.quantity,
    unitCost: firstItem.unitCost,
    items: resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost })),
    reason: reason || '',
    reference: reference || '',
    notes: notes || '',
    date: date ? new Date(date) : new Date(),
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
  notify.push({ type: 'transaction', title: 'New Stock Transaction', message: `${req.user.name} recorded a ${populated.voucherType?.replace('_', ' ')} — ${populated.items?.length || 1} item(s)`, icon: populated.type === 'in' ? '📥' : '📤', link: '/transactions', severity: 'info', userId: req.user._id });
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
    const unitCost = Number(item.unitCost) || mat.unitCost || 0;
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
  transaction.supplier = supplier || undefined;
  transaction.type = newDirection;
  transaction.material = firstItem.material;
  transaction.quantity = firstItem.quantity;
  transaction.unitCost = firstItem.unitCost;
  transaction.items = resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost }));
  transaction.reason = reason || '';
  transaction.reference = reference || '';
  transaction.notes = notes || '';
  if (date) transaction.date = new Date(date);
  transaction.attachments = formattedAttachments;
  transaction.attachment = formattedAttachments.length > 0 ? formattedAttachments[0].url : '';
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
  transaction.deletedAt = new Date();
  transaction.deletedBy = req.user?.name || 'System';
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
    transaction.deletedAt = new Date();
    transaction.deletedBy = req.user?.name || 'System';
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

  transaction.deletedAt = null;
  transaction.deletedBy = null;
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
    if (to) match.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const summary = await StockTransaction.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$voucherType',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' },
        totalQty: { $sum: '$quantity' },
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
    check: { from: ['pending'], to: 'checked' },
    approve: { from: ['checked'], to: 'approved' },
    post: { from: ['approved'], to: 'posted' },
    void: { from: ['pending', 'checked', 'approved', 'posted'], to: 'voided' },
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

  if (action === 'check') { txn.checkedBy = actor._id; txn.checkedAt = new Date(); }
  if (action === 'approve') { txn.approvedBy = actor._id; txn.approvedAt = new Date(); }
  if (action === 'post') { txn.postedBy = actor._id; txn.postedAt = new Date(); }

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
          const oldCost = mat.unitCost || 0;
          const inQty = item.quantity || 0;
          const inCost = item.unitCost || oldCost;
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
  if (['void', 'approve'].includes(action)) {
    notify.push({ type: 'transaction', title: `Voucher ${action}d`, message: `${actor.name} ${action}d ${populated.voucherNo || 'voucher'}`, icon: action === 'void' ? '🔴' : '🟣', link: '/transactions', severity: action === 'void' ? 'error' : 'success', userId: actor._id });
  }
  res.json({ message: `Voucher moved from "${prev}" → "${rule.to}"`, transaction: populated });
});


// ── POST /api/transactions/import-sales ──────────────────────────────
// Enhanced: matches by product code OR name, deducts stock if matched, records complete sold POS products list,
// validates and skips duplicate codes, and updates live revenue & reports.
const importSales = asyncHandler(async (req, res) => {
  const { sales, notes, reference, saleDate } = req.body;
  if (!sales || !sales.length) {
    res.status(400);
    throw new Error('No sales data provided');
  }

  const Product = require('../models/Product');
  const SalesRecord = require('../models/SalesRecord');
  const tg = require('../utils/telegramNotifier');

  // Pre-load all active products and raw materials in ONE parallel batch
  const [allProducts, allRawMaterials] = await Promise.all([
    Product.find({ isActive: true }).populate({ path: 'ingredients.material', model: 'RawMaterial' }).lean(),
    RawMaterial.find({}).lean(),
  ]);

  // Build high-speed in-memory lookup maps (O(1) lookups instead of sequential DB queries)
  const rawMaterialById = new Map();
  const rawMaterialByCode = new Map();
  const rawMaterialByName = new Map();

  for (const mat of allRawMaterials) {
    const idStr = String(mat._id);
    rawMaterialById.set(idStr, mat);
    if (mat.code) rawMaterialByCode.set(String(mat.code).trim().toLowerCase(), mat);
    if (mat.name) rawMaterialByName.set(String(mat.name).trim().toLowerCase(), mat);
  }

  const productByCode = new Map();
  const productByName = new Map();

  for (const p of allProducts) {
    if (p.code) {
      const trimmed = String(p.code).trim().toLowerCase();
      productByCode.set(trimmed, p);
      // Also index stripped code without trailing dashes (e.g. "P-0001-")
      productByCode.set(trimmed.replace(/-+$/, ''), p);
    }
    if (p.name) {
      productByName.set(String(p.name).trim().toLowerCase(), p);
    }
  }

  // Resolve best saleDate (either top-level, or from row timestamps, or current time)
  let resolvedSaleDate = saleDate ? new Date(saleDate) : null;
  if (!resolvedSaleDate || isNaN(resolvedSaleDate.getTime())) {
    const rowWithDate = sales.find(s => s.saleDate);
    if (rowWithDate && rowWithDate.saleDate) {
      const d = new Date(rowWithDate.saleDate);
      if (!isNaN(d.getTime())) resolvedSaleDate = d;
    }
  }
  if (!resolvedSaleDate || isNaN(resolvedSaleDate.getTime())) {
    resolvedSaleDate = new Date();
  }

  // ── Duplicate code validation ──
  // Check against unique transaction codes (CS_... order codes)
  // OR codes already recorded on the SAME sale date (prevents double import of same day's file)
  const isUniqueTxnCode = (c) => {
    if (!c) return false;
    const str = String(c).trim();
    return /^cs_/i.test(str) || /^ord[-_]/i.test(str) || /^rec[-_]/i.test(str) || /^inv[-_]/i.test(str) || /_desktop/i.test(str) || /_pos/i.test(str);
  };

  const incomingCodes = sales
    .map(s => String(s.productCode || '').trim())
    .filter(Boolean);

  const existingCodesSet = new Set();
  if (incomingCodes.length > 0) {
    const startOfDay = new Date(resolvedSaleDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(resolvedSaleDate);
    endOfDay.setHours(23, 59, 59, 999);

    const uniqueTxnCodes = incomingCodes.filter(isUniqueTxnCode);

    const queryFilters = [];
    if (uniqueTxnCodes.length > 0) {
      queryFilters.push({ 'lines.productCode': { $in: uniqueTxnCodes } });
    }
    queryFilters.push({
      saleDate: { $gte: startOfDay, $lte: endOfDay },
      'lines.productCode': { $in: incomingCodes },
    });

    const existingRecords = await SalesRecord.find(
      { $or: queryFilters },
      { 'lines.productCode': 1, saleDate: 1 }
    ).lean();

    for (const r of existingRecords) {
      for (const l of (r.lines || [])) {
        if (l.productCode) {
          existingCodesSet.add(String(l.productCode).trim().toLowerCase());
        }
      }
    }
  }

  const materialDeductions = {};
  const saleLines = [];
  const allSoldProducts = [];
  const notFound = [];
  const seenInBatch = new Set();
  let skippedDuplicates = 0;
  const skippedCodes = [];

  for (const sale of sales) {
    const { productName, productCode, quantity, revenue, unitPrice } = sale;
    const nameStr = String(productName || '').trim();
    const codeStr = String(productCode || '').trim();

    if (!nameStr && !codeStr) continue;

    // ── Validation: if code already imported before or duplicated within batch, jump it! ──
    const rawCode = codeStr;
    const cleanCode = rawCode.toLowerCase();
    const isTxn = isUniqueTxnCode(codeStr);

    if (cleanCode) {
      const isAlreadyImported = existingCodesSet.has(cleanCode);
      const isDupeInBatch = isTxn && seenInBatch.has(cleanCode);

      if (isAlreadyImported || isDupeInBatch) {
        skippedDuplicates++;
        if (skippedCodes.length < 100) skippedCodes.push(rawCode);
        continue; // JUMP duplicate record
      }
      if (isTxn) {
        seenInBatch.add(cleanCode);
      }
    }

    const qty = Math.max(0.001, Number(quantity) || 1);
    const rev = Number(revenue) || 0;
    const price = Number(unitPrice) || 0;
    const lineIngredients = [];

    const normCode = codeStr ? codeStr.toLowerCase().replace(/-+$/, '') : '';
    const normName = nameStr ? nameStr.toLowerCase() : '';

    // 1. Try to find in Product in-memory
    let product = (normCode ? productByCode.get(normCode) : null) ||
      (normName ? productByName.get(normName) : null);

    // Fallback: in-memory partial match
    if (!product && (normCode || normName)) {
      product = allProducts.find(p => {
        const pCode = p.code ? p.code.toLowerCase() : '';
        const pName = p.name ? p.name.toLowerCase() : '';
        return (normCode && pCode.includes(normCode)) || (normName && pName.includes(normName));
      });
    }

    if (product) {
      let cogs = 0;
      const ingList = product.ingredients || [];
      const hasRecipe = ingList.length > 0;
      if (hasRecipe) {
        for (const ing of ingList) {
          const matObj = ing.material;
          const matId = matObj?._id ? matObj._id.toString() : (ing.material ? String(ing.material) : null);
          const mat = matId ? rawMaterialById.get(matId) : null;
          if (!mat) continue;

          const deductQty = (Number(ing.quantity) || 0) * qty;
          const ingCost = (Number(mat.unitCost) || 0) * deductQty;
          cogs += ingCost;
          materialDeductions[matId] = (materialDeductions[matId] || 0) + deductQty;
          lineIngredients.push({
            materialId: mat._id,
            materialName: mat.name,
            unit: mat.unit,
            quantityUsed: deductQty,
            unitCost: mat.unitCost || 0,
            totalCost: ingCost,
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
        productName: product.name || nameStr,
        productCode: product.code || codeStr,
        productId: product._id,
        category: product.category || 'General',
        parentCategory: product.parentCategory || 'FOOD',
        uom: product.uom || 'Pcs',
        quantitySold: qty,
        sellingPrice: lineSellingPrice,
        revenue: lineRev,
        cogs,
        grossProfit: lineRev - cogs,
        matchStatus: (hasRecipe && lineIngredients.length > 0) ? 'recipe_deducted' : 'no_recipe',
        ingredientsUsed: lineIngredients,
      };

      saleLines.push(recordLine);
      allSoldProducts.push(recordLine);
      continue;
    }

    // 2. Try RawMaterial in-memory directly
    let material = (normCode ? rawMaterialByCode.get(normCode) : null) ||
      (normName ? rawMaterialByName.get(normName) : null);

    if (!material && (normCode || normName)) {
      material = allRawMaterials.find(m => {
        const mCode = m.code ? m.code.toLowerCase() : '';
        const mName = m.name ? m.name.toLowerCase() : '';
        return (normCode && mCode.includes(normCode)) || (normName && mName.includes(normName));
      });
    }

    if (material) {
      const matId = material._id.toString();
      const ingCost = (Number(material.unitCost) || 0) * qty;
      materialDeductions[matId] = (materialDeductions[matId] || 0) + qty;
      lineIngredients.push({
        materialId: material._id,
        materialName: material.name,
        unit: material.unit,
        quantityUsed: qty,
        unitCost: material.unitCost || 0,
        totalCost: ingCost,
      });

      let lineRev = rev;
      if (lineRev <= 0) {
        if (price > 0) lineRev = price * qty;
        else if (material.unitCost > 0) lineRev = material.unitCost * 1.35 * qty;
      }
      const lineSellingPrice = qty > 0 ? (lineRev / qty) : 0;

      const recordLine = {
        productName: material.name || nameStr,
        productCode: material.code || codeStr,
        productId: null,
        category: material.category || 'General',
        parentCategory: 'RAW',
        uom: material.unit || 'Pcs',
        quantitySold: qty,
        sellingPrice: lineSellingPrice,
        revenue: lineRev,
        cogs: ingCost,
        grossProfit: lineRev - ingCost,
        matchStatus: 'direct_material',
        ingredientsUsed: lineIngredients,
      };

      saleLines.push(recordLine);
      allSoldProducts.push(recordLine);
      continue;
    }

    // 3. Unmatched product (Record in saleLines with cogs=0 so revenue, P&L, and Menu Engineering receive it)
    const identifier = nameStr || codeStr;
    notFound.push(identifier);

    let lineRev = rev;
    if (lineRev <= 0 && price > 0) lineRev = price * qty;
    const lineSellingPrice = qty > 0 ? (lineRev / qty) : price;

    const unmatchedLine = {
      productName: nameStr || codeStr,
      productCode: codeStr,
      productId: null,
      category: 'Unmatched',
      parentCategory: '—',
      uom: 'Pcs',
      quantitySold: qty,
      sellingPrice: lineSellingPrice,
      revenue: lineRev,
      cogs: 0,
      grossProfit: lineRev,
      matchStatus: 'unmatched',
      ingredientsUsed: [],
    };
    saleLines.push(unmatchedLine);
    allSoldProducts.push(unmatchedLine);
  }

  // If everything uploaded was duplicate and skipped, notify user cleanly
  if (saleLines.length === 0 && skippedDuplicates > 0) {
    return res.status(200).json({
      message: `Validation Alert: All ${skippedDuplicates} record(s) already existed in the system and were skipped to avoid duplicates.`,
      skippedDuplicates,
      skippedCodes,
      allDuplicates: true,
      salesRecord: null,
      summary: {
        totalRevenue: 0,
        totalCOGS: 0,
        grossProfit: 0,
        profitMargin: '0.0%',
        totalSoldProducts: 0,
        matchedCount: 0,
        unmatchedCount: 0,
        skippedDuplicates,
      },
      items: [],
      unmatchedProducts: [],
    });
  }

  // Aggregate totals from all sold lines (including matched and unmatched items)
  const totalRevenue = saleLines.reduce((s, l) => s + (l.revenue || 0), 0);
  const totalCOGS = saleLines.reduce((s, l) => s + (l.cogs || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const matchedCount = saleLines.filter(l => l.matchStatus !== 'unmatched').length;

  // Create SalesRecord with all lines and accurate totals
  const salesRecord = await SalesRecord.create({
    saleDate: resolvedSaleDate,
    importDate: new Date(),
    reference: reference || '',
    notes: notes || 'Imported from POS/Excel report',
    source: 'excel_import',
    lines: saleLines,
    totalRevenue,
    totalCOGS,
    grossProfit,
    profitMargin,
    importedBy: req.user?._id || null,
  });

  // Create stock transaction if there are materials to deduct
  let transaction = null;
  const resolvedItems = [];
  const bulkStockUpdates = [];

  for (const [matId, qty] of Object.entries(materialDeductions)) {
    if (qty <= 0) continue;
    const mat = rawMaterialById.get(matId);
    if (mat) {
      resolvedItems.push({
        material: mat._id,
        quantity: qty,
        unitCost: mat.unitCost || 0,
        totalCost: (mat.unitCost || 0) * qty,
      });
      bulkStockUpdates.push({
        updateOne: {
          filter: { _id: mat._id },
          update: { $inc: { currentStock: -qty } },
        },
      });
    }
  }

  if (resolvedItems.length > 0) {
    try {
      const isManual = Boolean(notes?.toLowerCase().includes('manual') || req.body.isManual);
      const resolvedVoucherType = isManual ? 'manual_sale' : 'sales_import';
      const resolvedReason = isManual ? 'Manual Sales Registration' : 'Sales Report Import';

      const totalAmount = resolvedItems.reduce((s, i) => s + i.totalCost, 0);
      let vNo = await generateVoucherNo(resolvedVoucherType);
      const existingTxn = await StockTransaction.findOne({ voucherNo: vNo }).select('_id').lean();
      if (existingTxn) {
        vNo = `${vNo}-${Date.now().toString().slice(-4)}`;
      }

      transaction = await StockTransaction.create({
        voucherType: resolvedVoucherType,
        voucherNo: vNo,
        type: 'out',
        items: resolvedItems.map(({ material, quantity, unitCost, totalCost }) => ({ material, quantity, unitCost, totalCost })),
        material: resolvedItems[0].material,
        quantity: resolvedItems[0].quantity,
        unitCost: resolvedItems[0].unitCost,
        reason: resolvedReason,
        reference: reference || '',
        notes: notes || (isManual ? 'Manual Sales Registration' : 'Automated stock deduction from sales report'),
        date: resolvedSaleDate,
        performedBy: req.user?._id || null,
        totalAmount,
        status: 'pending',
        trail: [{ action: 'pending', by: req.user?._id || null, byName: req.user?.name || 'System', byRole: req.user?.role || 'admin' }],
      });

      salesRecord.stockTransaction = transaction._id;
      await salesRecord.save();

      // High speed atomic bulk stock reduction in one DB operation
      if (bulkStockUpdates.length > 0) {
        await RawMaterial.bulkWrite(bulkStockUpdates);
      }
    } catch (txnErr) {
      console.warn('[ImportSales] Stock transaction creation non-fatal warning:', txnErr.message);
    }
  }

  invalidateDashboardCache();

  // Send real-time notification to Telegram bot
  const summaryPayload = {
    totalRevenue,
    totalCOGS,
    grossProfit,
    profitMargin: profitMargin.toFixed(1) + '%',
    totalSoldProducts: allSoldProducts.length,
    matchedCount,
    unmatchedCount: notFound.length,
    skippedDuplicates,
  };

  try {
    tg.notifySalesImported(salesRecord, summaryPayload, req.user);
  } catch (tgErr) {
    console.warn('[Telegram] notifySalesImported warning:', tgErr.message);
  }

  res.status(201).json({
    message: skippedDuplicates > 0
      ? `Sales imported: ${allSoldProducts.length} items recorded. ${skippedDuplicates} duplicate records were jumped.`
      : 'Sales imported. Stock deducted and P&L recorded.',
    salesRecord,
    transactionId: transaction?._id,
    skippedDuplicates,
    skippedCodes,
    summary: summaryPayload,
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

  const https = require('https');
  const querystring = require('querystring');

  const OCR_API_KEY = process.env.OCR_API_KEY || 'helloworld'; // helloworld = free demo key

  // Call ocr.space API
  const ocrText = await new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      base64Image: `data:${mimeType};base64,${imageBase64}`,
      language: 'eng',
      isTable: 'true',
      OCREngine: '2',
      apikey: OCR_API_KEY,
    });

    const options = {
      hostname: 'api.ocr.space',
      path: '/parse/image',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
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
    const qty = nums[0] <= 1000 ? nums[0] : 1;
    const totalAmt = nums[nums.length - 1];
    const avgAmt = nums.length >= 3 ? nums[nums.length - 2] : (qty > 0 ? totalAmt / qty : totalAmt);

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
