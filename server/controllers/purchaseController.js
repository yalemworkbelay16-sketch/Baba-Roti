const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const Purchase = require('../models/Purchase');
const RawMaterial = require('../models/RawMaterial');
const StockTransaction = require('../models/StockTransaction');
const User = require('../models/User');
const { invalidateDashboardCache } = require('./dashboardController');
const { hasPermission } = require('../middleware/authMiddleware');
const tg = require('../utils/telegramNotifier');
const notify = require('../utils/notificationHelper');

// ── helpers ──────────────────────────────────────────────────────────
const applyStock = async (purchase, performedBy) => {
  for (const item of purchase.items) {
    const material = await RawMaterial.findById(item.material);
    if (!material) continue;
    material.currentStock += item.quantity;
    material.unitCost = item.unitCost;
    await material.save();
    await StockTransaction.create({
      voucherType: 'cash_grv',
      material: item.material,
      type: 'in',
      quantity: item.quantity,
      unitCost: item.unitCost,
      totalAmount: item.quantity * item.unitCost,
      items: [{ material: item.material, quantity: item.quantity, unitCost: item.unitCost, totalCost: item.quantity * item.unitCost }],
      supplier: purchase.supplier,
      reference: purchase.invoiceNumber || `Purchase ${purchase._id}`,
      performedBy,
      date: new Date(),
    });
  }
};

const verifyUserPassword = async (userId, password) => {
  const user = await User.findById(userId).select('+password');
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.password);
  return ok ? user : null;
};

// ── GET /api/purchases ────────────────────────────────────────────────
const getPurchases = asyncHandler(async (req, res) => {
  const purchases = await Purchase.find({})
    .populate('supplier', 'name')
    .populate('items.material', 'name unit')
    .populate('recordedBy', 'name role')
    .populate('checkedBy',  'name role')
    .populate('approvedBy', 'name role')
    .populate('receivedBy', 'name role')
    .populate('trail.by',   'name role')
    .sort({ purchaseDate: -1 })
    .lean();
  res.json(purchases);
});

// ── GET /api/purchases/:id ────────────────────────────────────────────
const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate('supplier')
    .populate('items.material', 'name unit')
    .populate('recordedBy checkedBy approvedBy receivedBy', 'name role');
  if (!purchase) { res.status(404); throw new Error('Purchase not found'); }
  res.json(purchase);
});

// ── POST /api/purchases ── create as DRAFT ────────────────────────────
const createPurchase = asyncHandler(async (req, res) => {
  const { supplier, items, invoiceNumber, purchaseDate, notes } = req.body;
  if (!items?.length) { res.status(400); throw new Error('At least one item required'); }

  const totalAmount = items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitCost), 0);

  const purchase = await Purchase.create({
    supplier, items, invoiceNumber, purchaseDate, notes,
    totalAmount,
    status: 'draft',
    recordedBy: req.user._id,
    trail: [{ action: 'draft', by: req.user._id, byName: req.user.name, byRole: req.user.role }],
  });

  invalidateDashboardCache();

  const populated = await purchase.populate([
    { path: 'supplier', select: 'name' },
    { path: 'items.material', select: 'name unit' },
    { path: 'recordedBy', select: 'name role' },
  ]);
  tg.notifyPurchaseCreated(populated.toObject ? populated.toObject() : populated, req.user);
  notify.push({
    type: 'purchase',
    title: 'New Purchase Order',
    message: `${req.user.name} created a draft PO for ${populated.supplier?.name || 'supplier'} — ${populated.totalAmount ? 'ETB ' + Number(populated.totalAmount).toLocaleString() : ''}`,
    icon: '📝',
    link: '/purchases',
    entityId: populated._id,
    allowedRoles: ['admin', 'manager', 'supervisor', 'dev'],
    severity: 'info',
    userId: req.user._id,
  });
  res.status(201).json(populated);
});


// ── POST /api/purchases/:id/advance ──────────────────────────────────
/*
  Body: { action: 'check'|'approve'|'receive'|'cancel', password: '...', note: '' }

  check   : draft    → checked   (manager / admin)
  approve : checked  → approved  (admin)
  receive : approved → received  (manager / admin / storekeeper) — applies stock
  cancel  : any      → cancelled (admin)
*/
const advancePurchase = asyncHandler(async (req, res) => {
  const { action, password, note = '' } = req.body;
  if (!password) { res.status(400); throw new Error('Password is required to advance this purchase'); }

  // Verify the acting user's password
  const actor = await verifyUserPassword(req.user._id, password);
  if (!actor) { res.status(401); throw new Error('Incorrect password — action not authorised'); }

  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) { res.status(404); throw new Error('Purchase not found'); }

  const actionCapMap = {
    check: 'checkReview',
    approve: 'approveGoods',
    receive: 'recordGoods',
    cancel: 'voidTransactions',
  };

  const cap = actionCapMap[action];
  if (!cap) { res.status(400); throw new Error(`Unknown action: ${action}`); }

  // ── Transition rules ──
  const transitions = {
    check:   { from: ['draft'],    to: 'checked' },
    approve: { from: ['checked'],  to: 'approved' },
    receive: { from: ['approved'], to: 'received' },
    cancel:  { from: ['draft','checked','approved'], to: 'cancelled' },
  };

  const rule = transitions[action];
  if (!rule.from.includes(purchase.status)) {
    res.status(400);
    throw new Error(`Cannot ${action} a purchase that is currently "${purchase.status}"`);
  }

  const allowed = await hasPermission(actor.role, cap);
  if (!allowed) {
    res.status(403);
    throw new Error(`Your role (${actor.role}) does not have permission to "${action}" purchases`);
  }

  // Apply transition
  const prev = purchase.status;
  purchase.status = rule.to;
  purchase.trail.push({ action: rule.to, by: actor._id, byName: actor.name, byRole: actor.role, note });

  if (action === 'check')   { purchase.checkedBy  = actor._id; purchase.checkedAt  = new Date(); }
  if (action === 'approve') { purchase.approvedBy = actor._id; purchase.approvedAt = new Date(); }
  if (action === 'receive') { purchase.receivedBy = actor._id; purchase.receivedAt = new Date(); }

  await purchase.save();
  invalidateDashboardCache();

  // Apply stock only on receive
  if (action === 'receive') {
    await applyStock(purchase, actor._id);
  }

  const populated = await Purchase.findById(purchase._id)
    .populate('supplier', 'name')
    .populate('items.material', 'name unit')
    .populate('recordedBy checkedBy approvedBy receivedBy', 'name role');

  res.json({ message: `Purchase moved from "${prev}" → "${rule.to}"`, purchase: populated });
  tg.notifyPurchaseAdvanced(populated, action, actor);
  const actionLabels = { check: 'checked', approve: 'approved', receive: 'received — stock added', cancel: 'cancelled' };
  const sev = action === 'receive' ? 'success' : action === 'cancel' ? 'warning' : 'info';
  notify.push({
    type: 'purchase',
    title: `Purchase ${actionLabels[action] || action}`,
    message: `${actor.name} ${actionLabels[action] || action} PO for ${populated.supplier?.name || 'supplier'}`,
    icon: action === 'receive' ? '📦' : action === 'cancel' ? '🔴' : '✅',
    link: '/purchases',
    entityId: populated._id,
    allowedRoles: ['admin', 'manager', 'supervisor', 'dev'],
    severity: sev,
    userId: actor._id,
  });
});

// ── DELETE /api/purchases/:id ─────────────────────────────────────────
const deletePurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  if (!purchase) { res.status(404); throw new Error('Purchase not found'); }
  if (purchase.status === 'received') {
    res.status(400);
    throw new Error('Cannot delete a received purchase. Cancel it first if needed.');
  }
  await purchase.deleteOne();
  invalidateDashboardCache();
  tg.notifyPurchaseDeleted(purchase, req.user);
  notify.push({ type: 'purchase', title: 'Purchase Order Deleted', message: `${req.user.name} deleted PO for ${purchase.supplier?.name || 'supplier'}`, icon: '🗑️', link: '/purchases', severity: 'warning', userId: req.user._id });
  res.json({ message: 'Purchase deleted' });
});


// kept for backward compat
const updatePurchaseStatus = asyncHandler(async (req, res) => {
  res.status(400).json({ message: 'Use POST /api/purchases/:id/advance instead' });
});

module.exports = { getPurchases, getPurchaseById, createPurchase, advancePurchase, updatePurchaseStatus, deletePurchase };
