const asyncHandler = require('express-async-handler');
const Consumption = require('../models/Consumption');
const { CONSUMPTION_CATEGORIES, CATEGORY_LABELS } = require('../models/Consumption');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const { invalidateDashboardCache } = require('./dashboardController');
const tg = require('../utils/telegramNotifier');
const notify = require('../utils/notificationHelper');
const { determineProductStation, determineMaterialStation } = require('../utils/stationHelper');
const { convertUnit } = require('../utils/unitConverter');
const Setting = require('../models/Setting');

// ── Auto voucher number ───────────────────────────────────────────
const generateVoucherNo = async () => {
  const count = await Consumption.countDocuments();
  return `CONS-${String(count + 1).padStart(5, '0')}`;
};

// ── Helper: deduct raw materials based on product recipes ─────────
async function applyConsumptionStock(items, reverse = false) {
  let settings = null;
  try {
    settings = await Setting.findOne().lean();
  } catch (_) { }

  for (const item of items) {
    const product = await Product.findById(item.product)
      .populate('ingredients.material', 'name unit category storeLocation currentStock mainStoreStock kitchenStock barStock unitCost');
    if (!product) continue;

    for (const ing of product.ingredients) {
      const mat = await RawMaterial.findById(ing.material._id || ing.material);
      if (!mat) continue;
      const recipeQty = (Number(ing.quantity) || 0) * (Number(item.quantity) || 0);
      const recipeUnit = (ing.unit || mat.unit || '').trim();
      const qty = convertUnit(recipeQty, recipeUnit, mat.unit);

      const prodStation = product ? determineProductStation(product, settings?.stationCategoryMapping) : null;
      const targetStation = mat.isProduced && mat.productionStation && mat.productionStation !== 'none'
        ? mat.productionStation
        : determineMaterialStation(mat, settings?.stationCategoryMapping, prodStation);

      if (targetStation === 'bar') {
        mat.barStock = Math.max(0, Number(mat.barStock || 0) + (reverse ? qty : -qty));
      } else if (targetStation === 'kitchen') {
        mat.kitchenStock = Math.max(0, Number(mat.kitchenStock || 0) + (reverse ? qty : -qty));
      } else {
        mat.mainStoreStock = Math.max(0, Number(mat.mainStoreStock || 0) + (reverse ? qty : -qty));
      }
      mat.currentStock = Math.max(0, (mat.mainStoreStock || 0) + (mat.kitchenStock || 0) + (mat.barStock || 0));
      await mat.save();
    }
  }
}

// ── GET /api/consumption ──────────────────────────────────────────
const getConsumptions = asyncHandler(async (req, res) => {
  const { category, status, from, to } = req.query;
  // No deletedAt filter in DB query — filter in JS to handle all storage variants
  const filter = {};
  if (category) filter.category = category;
  if (status) filter.status = status;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(new Date(to).setHours(23, 59, 59, 999));
  }

  const records = await Consumption.find(filter)
    .populate('items.product', 'name code uom')
    .populate('performedBy', 'name')
    .populate('approvedBy', 'name')
    .sort({ date: -1 })
    .lean();

  // Filter out soft-deleted records in JS (handles null, undefined, and missing field)
  const active = (records || []).filter(r => !r.deletedAt);
  res.json(active);
});

// ── GET /api/consumption/:id ──────────────────────────────────────
const getConsumptionById = asyncHandler(async (req, res) => {
  const record = await Consumption.findById(req.params.id)
    .populate({ path: 'items.product', populate: { path: 'ingredients.material', select: 'name unit unitCost' } })
    .populate('performedBy', 'name role')
    .populate('approvedBy', 'name role')
    .populate('trail.by', 'name')
    .lean();
  if (!record) { res.status(404); throw new Error('Consumption record not found'); }
  res.json(record);
});

// ── POST /api/consumption ─────────────────────────────────────────
const createConsumption = asyncHandler(async (req, res) => {
  const {
    category, date, beneficiary, pax, department,
    items = [], notes, voucherNo,
  } = req.body;

  if (!category || !CONSUMPTION_CATEGORIES.includes(category)) {
    res.status(400); throw new Error('Invalid category');
  }
  if (!items.length) { res.status(400); throw new Error('At least one product is required'); }

  // Resolve products + compute costs
  let totalRecipeCost = 0;
  const resolvedItems = [];
  for (const item of items) {
    const product = await Product.findById(item.product)
      .populate('ingredients.material', 'name unit unitCost');
    if (!product) { res.status(404); throw new Error(`Product not found: ${item.product}`); }

    const recipeCost = (product.ingredients || []).reduce((sum, ing) =>
      sum + (ing.material?.unitCost ?? 0) * ing.quantity, 0);
    const totalCost = recipeCost * Number(item.quantity);
    totalRecipeCost += totalCost;

    resolvedItems.push({
      product: product._id,
      quantity: Number(item.quantity),
      recipeCost,
      totalCost,
    });
  }

  const record = await Consumption.create({
    voucherNo: voucherNo || (await generateVoucherNo()),
    category,
    date: date ? new Date(date) : new Date(),
    beneficiary: beneficiary || '',
    pax: Number(pax) || 1,
    department: department || '',
    items: resolvedItems,
    totalRecipeCost,
    notes: notes || '',
    performedBy: req.user._id,
    status: 'pending',
    trail: [{ action: 'pending', by: req.user._id, byName: req.user.name, byRole: req.user.role }],
  });

  // NOTE: Stock is NOT deducted on creation — only on approval (same rule as transactions)

  const populated = await Consumption.findById(record._id)
    .populate('items.product', 'name code uom')
    .populate('performedBy', 'name')
    .lean();

  invalidateDashboardCache();
  tg.notifyConsumptionCreated(populated, req.user);
  notify.push({ type: 'consumption', title: 'New Consumption Record', message: `${req.user.name} created consumption voucher ${populated.voucherNo}`, icon: '🍽️', link: '/consumption', severity: 'info', userId: req.user._id });
  res.status(201).json(populated);
});

// ── PUT /api/consumption/:id ──────────────────────────────────────
const updateConsumption = asyncHandler(async (req, res) => {
  const record = await Consumption.findById(req.params.id);
  if (!record) { res.status(404); throw new Error('Record not found'); }
  if (record.status !== 'pending') {
    res.status(400); throw new Error('Only pending records can be edited');
  }

  const { category, date, beneficiary, pax, department, items, notes } = req.body;

  if (items && items.length) {
    let totalRecipeCost = 0;
    const resolvedItems = [];
    for (const item of items) {
      const product = await Product.findById(item.product)
        .populate('ingredients.material', 'name unit unitCost');
      if (!product) { res.status(404); throw new Error(`Product not found: ${item.product}`); }
      const recipeCost = (product.ingredients || []).reduce((s, ing) =>
        s + (ing.material?.unitCost ?? 0) * ing.quantity, 0);
      const totalCost = recipeCost * Number(item.quantity);
      totalRecipeCost += totalCost;
      resolvedItems.push({ product: product._id, quantity: Number(item.quantity), recipeCost, totalCost });
    }
    record.items = resolvedItems;
    record.totalRecipeCost = totalRecipeCost;
  }

  if (category) record.category = category;
  if (date) record.date = new Date(date);
  if (beneficiary !== undefined) record.beneficiary = beneficiary;
  if (pax) record.pax = Number(pax);
  if (department !== undefined) record.department = department;
  if (notes !== undefined) record.notes = notes;

  await record.save();
  const populated = await Consumption.findById(record._id)
    .populate('items.product', 'name code uom')
    .populate('performedBy', 'name')
    .lean();

  invalidateDashboardCache();
  res.json(populated);
});

// ── POST /api/consumption/:id/approve ────────────────────────────
const approveConsumption = asyncHandler(async (req, res) => {
  const { note = '' } = req.body;
  const record = await Consumption.findById(req.params.id);
  if (!record) { res.status(404); throw new Error('Record not found'); }
  if (record.status !== 'pending') {
    res.status(400); throw new Error(`Cannot approve a record in "${record.status}" status`);
  }

  // Deduct raw materials from stock
  await applyConsumptionStock(record.items);

  record.status = 'approved';
  record.approvedBy = req.user._id;
  record.approvedAt = new Date();
  record.trail.push({ action: 'approved', by: req.user._id, byName: req.user.name, byRole: req.user.role, note });
  await record.save();

  const populated = await Consumption.findById(record._id)
    .populate('items.product', 'name code uom')
    .populate('performedBy approvedBy', 'name')
    .lean();

  invalidateDashboardCache();
  tg.notifyConsumptionApproved(populated, req.user);
  notify.push({ type: 'consumption', title: 'Consumption Approved', message: `${req.user.name} approved ${populated.voucherNo} — stock deducted`, icon: '✅', link: '/consumption', severity: 'success', userId: req.user._id });
  res.json({ message: 'Consumption approved and stock deducted.', record: populated });
});

// ── POST /api/consumption/:id/void ───────────────────────────────
const voidConsumption = asyncHandler(async (req, res) => {
  const { note = '' } = req.body;
  const record = await Consumption.findById(req.params.id);
  if (!record) { res.status(404); throw new Error('Record not found'); }
  if (record.status === 'voided') { res.status(400); throw new Error('Already voided'); }

  // Reverse stock only if it was approved
  if (record.status === 'approved') {
    await applyConsumptionStock(record.items, true); // reverse = true
  }

  record.status = 'voided';
  record.trail.push({ action: 'voided', by: req.user._id, byName: req.user.name, byRole: req.user.role, note });
  await record.save();

  invalidateDashboardCache();
  tg.notifyConsumptionVoided(record, req.user);
  notify.push({ type: 'consumption', title: 'Consumption Voided', message: `${req.user.name} voided voucher ${record.voucherNo}`, icon: '🔴', link: '/consumption', severity: 'warning', userId: req.user._id });
  res.json({ message: 'Consumption voided.', record });
});

// ── DELETE /api/consumption/:id ───────────────────────────────────
const deleteConsumption = asyncHandler(async (req, res) => {
  const record = await Consumption.findById(req.params.id);
  if (!record) { res.status(404); throw new Error('Record not found'); }
  if (!['pending', 'voided'].includes(record.status)) {
    res.status(400); throw new Error('Only pending or voided records can be deleted');
  }
  record.deletedAt = new Date();
  record.deletedBy = req.user?.name || 'System';
  await record.save();
  tg.notifyConsumptionDeleted(record, req.user);
  notify.push({ type: 'consumption', title: 'Consumption Deleted', message: `${req.user.name} deleted voucher ${record.voucherNo}`, icon: '🗑️', link: '/consumption', severity: 'warning', userId: req.user._id });
  res.json({ message: 'Moved to recycle bin.' });
});

// ── GET /api/consumption/summary ─────────────────────────────────
// Monthly summary by category for reports/analytics
const getConsumptionSummary = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const now = new Date();
  const y = Number(year || now.getFullYear());
  const m = Number(month || now.getMonth() + 1);

  const from = new Date(y, m - 1, 1);
  const to = new Date(y, m, 0, 23, 59, 59);

  const records = await Consumption.find({
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    status: 'approved',
    date: { $gte: from, $lte: to },
  });

  const summary = {};
  for (const cat of CONSUMPTION_CATEGORIES) {
    const catRecords = records.filter(r => r.category === cat);
    summary[cat] = {
      label: CATEGORY_LABELS[cat],
      count: catRecords.length,
      pax: catRecords.reduce((s, r) => s + (r.pax || 0), 0),
      totalCost: catRecords.reduce((s, r) => s + (r.totalRecipeCost || 0), 0),
    };
  }

  res.json({
    year: y,
    month: m,
    totalCost: (records || []).reduce((s, r) => s + (r.totalRecipeCost || 0), 0),
    totalRecords: records.length,
    byCategory: summary,
  });
});

module.exports = {
  getConsumptions,
  getConsumptionById,
  createConsumption,
  updateConsumption,
  approveConsumption,
  voidConsumption,
  deleteConsumption,
  getConsumptionSummary,
};
