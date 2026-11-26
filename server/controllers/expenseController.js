const asyncHandler = require('express-async-handler');
const Expense = require('../models/Expense');
const { EXPENSE_CATEGORIES, PAYMENT_METHODS } = require('../models/Expense');
const tg = require('../utils/telegramNotifier');
const notify = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');

// ── GET /api/expenses ───────────────────────────────────────────────
// Get all expenses with search & filters
const getExpenses = asyncHandler(async (req, res) => {
  const { from, to, category, paymentMethod, status, search } = req.query;

  const query = { isActive: { $ne: false } };

  if (category && category !== 'ALL') {
    query.category = category;
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    query.paymentMethod = paymentMethod;
  }

  if (status && status !== 'ALL') {
    query.status = status;
  }

  if (from || to) {
    query.date = {};
    if (from) {
      const dFrom = new Date(from);
      dFrom.setHours(0, 0, 0, 0);
      query.date.$gte = dFrom;
    }
    if (to) {
      const dTo = new Date(to);
      dTo.setHours(23, 59, 59, 999);
      query.date.$lte = dTo;
    }
  }

  if (search && search.trim()) {
    const s = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(s, 'i');
    query.$or = [
      { title: regex },
      { paidTo: regex },
      { referenceNo: regex },
      { notes: regex },
      { category: regex },
    ];
  }

  const expenses = await Expense.find(query)
    .populate('recordedBy', 'name email role avatar')
    .sort({ date: -1, createdAt: -1 })
    .lean();

  res.json(expenses);
});

// ── GET /api/expenses/stats ──────────────────────────────────────────
// Aggregate summary statistics, category breakdown & monthly trends
const getExpenseStats = asyncHandler(async (req, res) => {
  const { from, to } = req.query;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Filtered period query
  const periodQuery = { isActive: { $ne: false } };
  if (from || to) {
    periodQuery.date = {};
    if (from) {
      const dFrom = new Date(from);
      dFrom.setHours(0, 0, 0, 0);
      periodQuery.date.$gte = dFrom;
    }
    if (to) {
      const dTo = new Date(to);
      dTo.setHours(23, 59, 59, 999);
      periodQuery.date.$lte = dTo;
    }
  }

  const [periodExpenses, todayExpenses, monthExpenses, allExpensesRecent] = await Promise.all([
    Expense.find(periodQuery).lean(),
    Expense.find({ isActive: { $ne: false }, date: { $gte: startOfToday } }).lean(),
    Expense.find({ isActive: { $ne: false }, date: { $gte: startOfMonth } }).lean(),
    Expense.find({ isActive: { $ne: false } }).sort({ date: -1 }).limit(10).populate('recordedBy', 'name').lean(),
  ]);

  const totalPeriodAmount = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const todayTotal = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const monthTotal = monthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Category breakdown
  const categoryMap = {};
  periodExpenses.forEach(e => {
    const cat = e.category || 'Miscellaneous Overhead';
    if (!categoryMap[cat]) {
      categoryMap[cat] = { category: cat, total: 0, count: 0 };
    }
    categoryMap[cat].total += e.amount || 0;
    categoryMap[cat].count += 1;
  });

  const byCategory = Object.values(categoryMap)
    .map(c => ({
      ...c,
      total: Math.round(c.total * 100) / 100,
      percentage: totalPeriodAmount > 0 ? Math.round((c.total / totalPeriodAmount) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Payment method breakdown
  const paymentMap = {};
  periodExpenses.forEach(e => {
    const method = e.paymentMethod || 'Cash';
    if (!paymentMap[method]) {
      paymentMap[method] = { method, total: 0, count: 0 };
    }
    paymentMap[method].total += e.amount || 0;
    paymentMap[method].count += 1;
  });

  const byPaymentMethod = Object.values(paymentMap)
    .map(p => ({
      ...p,
      total: Math.round(p.total * 100) / 100,
    }))
    .sort((a, b) => b.total - a.total);

  // 6-month trend
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const trendExpenses = await Expense.find({
    isActive: { $ne: false },
    date: { $gte: sixMonthsAgo },
  }).lean();

  const monthlyTrendMap = {};
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
    monthlyTrendMap[key] = { month: key, label, total: 0, count: 0 };
  }

  trendExpenses.forEach(e => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyTrendMap[key]) {
      monthlyTrendMap[key].total += e.amount || 0;
      monthlyTrendMap[key].count += 1;
    }
  });

  const monthlyTrend = Object.values(monthlyTrendMap).map(m => ({
    ...m,
    total: Math.round(m.total * 100) / 100,
  }));

  res.json({
    totalPeriodAmount: Math.round(totalPeriodAmount * 100) / 100,
    totalPeriodCount: periodExpenses.length,
    todayTotal: Math.round(todayTotal * 100) / 100,
    monthTotal: Math.round(monthTotal * 100) / 100,
    byCategory,
    byPaymentMethod,
    monthlyTrend,
    recentExpenses: allExpensesRecent,
  });
});

// ── GET /api/expenses/meta ───────────────────────────────────────────
// Returns predefined categories and payment methods
const getExpenseMeta = asyncHandler(async (req, res) => {
  res.json({
    categories: EXPENSE_CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
  });
});

// ── POST /api/expenses ──────────────────────────────────────────────
// Create new overhead expense
const createExpense = asyncHandler(async (req, res) => {
  const {
    title,
    category,
    amount,
    currency = 'ETB',
    date = new Date(),
    paymentMethod = 'Cash',
    paidTo = '',
    referenceNo = '',
    notes = '',
    receiptUrl = '',
    status = 'Paid',
  } = req.body;

  if (!title || !title.trim()) {
    res.status(400);
    throw new Error('Expense title or item name is required');
  }

  const numAmount = Number(amount);
  if (!numAmount || numAmount <= 0) {
    res.status(400);
    throw new Error('Please enter a valid amount greater than 0');
  }

  const expense = await Expense.create({
    title: title.trim(),
    category: category || 'Utilities (Power, Water, Gas)',
    amount: Math.round(numAmount * 100) / 100,
    currency,
    date: new Date(date),
    paymentMethod,
    paidTo: (paidTo || '').trim(),
    referenceNo: (referenceNo || '').trim(),
    notes: (notes || '').trim(),
    receiptUrl: (receiptUrl || '').trim(),
    status,
    recordedBy: req.user._id,
  });

  const populated = await Expense.findById(expense._id).populate('recordedBy', 'name email role avatar');

  // Telegram Alert
  tg.notifyExpenseCreated(populated, req.user);

  // In-app Alert
  notify.push({
    type: 'expense',
    title: 'New Overhead Expense',
    message: `${req.user.name} recorded ETB ${numAmount.toFixed(2)} for "${title}" (${category}).`,
    icon: '💸',
    link: '/expenses',
    entityId: populated._id,
    severity: 'info',
    userId: req.user._id,
  });

  try {
    logActivity(req, {
      action: 'CREATE_EXPENSE',
      module: 'Expenses',
      description: `Recorded overhead expense "${populated.title}" — ETB ${numAmount.toFixed(2)} (${populated.paymentMethod || 'Cash'}) — Category: ${populated.category}`,
      status: 'success',
      details: { id: populated._id, title: populated.title, amount: numAmount, category: populated.category, paymentMethod: populated.paymentMethod },
    });
  } catch (_) {}

  res.status(201).json(populated);
});

// ── GET /api/expenses/:id ───────────────────────────────────────────
// Get single expense
const getExpenseById = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id)
    .populate('recordedBy', 'name email role avatar');

  if (!expense || expense.isActive === false) {
    res.status(404);
    throw new Error('Expense record not found');
  }

  res.json(expense);
});

// ── PUT /api/expenses/:id ───────────────────────────────────────────
// Update existing expense
const updateExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense || expense.isActive === false) {
    res.status(404);
    throw new Error('Expense record not found');
  }

  const {
    title,
    category,
    amount,
    currency,
    date,
    paymentMethod,
    paidTo,
    referenceNo,
    notes,
    receiptUrl,
    status,
  } = req.body;

  if (title !== undefined) expense.title = title.trim();
  if (category !== undefined) expense.category = category;
  if (amount !== undefined) {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      res.status(400);
      throw new Error('Amount must be greater than zero');
    }
    expense.amount = Math.round(numAmount * 100) / 100;
  }
  if (currency !== undefined) expense.currency = currency;
  if (date !== undefined) expense.date = new Date(date);
  if (paymentMethod !== undefined) expense.paymentMethod = paymentMethod;
  if (paidTo !== undefined) expense.paidTo = (paidTo || '').trim();
  if (referenceNo !== undefined) expense.referenceNo = (referenceNo || '').trim();
  if (notes !== undefined) expense.notes = (notes || '').trim();
  if (receiptUrl !== undefined) expense.receiptUrl = receiptUrl;
  if (status !== undefined) expense.status = status;

  await expense.save();

  const updated = await Expense.findById(expense._id).populate('recordedBy', 'name email role avatar');
  res.json(updated);
});

// ── DELETE /api/expenses/:id ────────────────────────────────────────
// Soft delete expense (moves to Recycle Bin)
const deleteExpense = asyncHandler(async (req, res) => {
  const expense = await Expense.findById(req.params.id);

  if (!expense || expense.isActive === false) {
    res.status(404);
    throw new Error('Expense record not found');
  }

  expense.isActive = false;
  expense.deletedAt = new Date();
  expense.deletedBy = req.user._id;
  expense.deletedFrom = 'expenses';
  await expense.save();

  // Telegram Alert
  tg.notifyExpenseDeleted(expense, req.user);

  try {
    logActivity(req, {
      action: 'DELETE_EXPENSE',
      module: 'Expenses',
      description: `Moved overhead expense "${expense.title}" (ETB ${expense.amount}) to recycle bin`,
      status: 'warning',
      details: { id: expense._id, title: expense.title, amount: expense.amount },
    });
  } catch (_) {}

  res.json({ message: 'Expense record moved to Recycle Bin', id: expense._id });
});

module.exports = {
  getExpenses,
  getExpenseStats,
  getExpenseMeta,
  createExpense,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
