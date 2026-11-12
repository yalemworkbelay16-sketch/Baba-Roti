const asyncHandler = require('express-async-handler');
const SalesRecord = require('../models/SalesRecord');
const RawMaterial = require('../models/RawMaterial');
const Product = require('../models/Product');
const StockTransaction = require('../models/StockTransaction');
const Expense = require('../models/Expense');

// ── Date match helper ──────────────────────────────────────────────────
const buildDateMatch = (from, to) => {
  const match = {};
  if (from || to) {
    const range = {};
    if (from) {
      const dFrom = new Date(from);
      dFrom.setHours(0, 0, 0, 0);
      range.$gte = dFrom;
    }
    if (to) {
      const dTo = new Date(to);
      dTo.setHours(23, 59, 59, 999);
      range.$lte = dTo;
    }
    match.$or = [
      { saleDate: range },
      { importDate: range },
      { createdAt: range },
    ];
  }
  return match;
};

// ── GET /api/analytics/pl ─────────────────────────────────────────────
// Profit & Loss summary for a date range (International F&B Standard)
const getProfitLoss = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const match = buildDateMatch(from, to);

  const expenseMatch = { isActive: { $ne: false } };
  if (from || to) {
    expenseMatch.date = {};
    if (from) {
      const dFrom = new Date(from);
      dFrom.setHours(0, 0, 0, 0);
      expenseMatch.date.$gte = dFrom;
    }
    if (to) {
      const dTo = new Date(to);
      dTo.setHours(23, 59, 59, 999);
      expenseMatch.date.$lte = dTo;
    }
  }

  const [records, expenses] = await Promise.all([
    SalesRecord.find(match).sort({ saleDate: -1 }),
    Expense.find(expenseMatch).lean(),
  ]);

  const totalRevenue = records.reduce((s, r) => s + (r.totalRevenue || 0), 0);
  const totalCOGS = records.reduce((s, r) => s + (r.totalCOGS || 0), 0);
  const grossProfit = totalRevenue - totalCOGS;
  const totalOverheadExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = grossProfit - totalOverheadExpenses;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const foodCostPct = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;

  let totalItemsSold = 0;
  records.forEach(r => {
    r.lines?.forEach(l => {
      totalItemsSold += (l.quantitySold || 0);
    });
  });

  // Daily trend for chart
  const dailyMap = {};
  records.forEach(r => {
    const dObj = r.saleDate ? new Date(r.saleDate) : (r.createdAt ? new Date(r.createdAt) : new Date());
    const day = dObj.toISOString().slice(0, 10);
    if (!dailyMap[day]) {
      dailyMap[day] = { date: day, revenue: 0, cogs: 0, profit: 0, itemsSold: 0 };
    }
    dailyMap[day].revenue += r.totalRevenue || 0;
    dailyMap[day].cogs += r.totalCOGS || 0;
    dailyMap[day].profit += r.grossProfit || 0;
    r.lines?.forEach(l => {
      dailyMap[day].itemsSold += (l.quantitySold || 0);
    });
  });
  const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));

  // Product-level P&L breakdown & Menu Engineering
  const productMap = {};
  records.forEach(r => {
    r.lines?.forEach(line => {
      const key = (line.productName || line.productCode || 'Unspecified Item').trim();
      if (!productMap[key]) {
        productMap[key] = {
          productName: key,
          qty: 0,
          revenue: 0,
          cogs: 0,
          profit: 0,
        };
      }
      productMap[key].qty += line.quantitySold || 0;
      productMap[key].revenue += line.revenue || 0;
      productMap[key].cogs += line.cogs || 0;
      productMap[key].profit += line.grossProfit || 0;
    });
  });

  const rawProducts = Object.values(productMap);
  const avgQty = rawProducts.length > 0
    ? rawProducts.reduce((s, p) => s + p.qty, 0) / rawProducts.length
    : 0;
  const avgProfit = rawProducts.length > 0
    ? rawProducts.reduce((s, p) => s + p.profit, 0) / rawProducts.length
    : 0;

  const productBreakdown = rawProducts.map(p => {
    const margin = p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0;
    const costRatio = p.revenue > 0 ? (p.cogs / p.revenue) * 100 : 0;
    const avgPrice = p.qty > 0 ? p.revenue / p.qty : 0;
    const unitCogs = p.qty > 0 ? p.cogs / p.qty : 0;

    // Classic Kasavana & Smith Menu Engineering classification:
    // Star: High Volume, High Profit
    // Workhorse: High Volume, Low Profit
    // Puzzle: Low Volume, High Profit
    // Dog: Low Volume, Low Profit
    let matrixClass = 'Dog';
    if (p.qty >= avgQty && p.profit >= avgProfit) matrixClass = 'Star';
    else if (p.qty >= avgQty && p.profit < avgProfit) matrixClass = 'Workhorse';
    else if (p.qty < avgQty && p.profit >= avgProfit) matrixClass = 'Puzzle';

    return {
      ...p,
      margin,
      costRatio,
      avgPrice,
      unitCogs,
      matrixClass,
    };
  }).sort((a, b) => b.profit - a.profit);

  res.json({
    summary: {
      totalRevenue,
      totalCOGS,
      grossProfit,
      profitMargin,
      totalOverheadExpenses,
      netProfit,
      netMargin,
      foodCostPct,
      totalItemsSold,
      recordCount: records.length,
      averageTicket: records.length > 0 ? totalRevenue / records.length : 0,
    },
    dailyTrend,
    productBreakdown,
  });
});

// ── GET /api/analytics/consumption ───────────────────────────────────
// Ingredient consumption breakdown: "One product how much ingredients consumed"
const getConsumption = asyncHandler(async (req, res) => {
  const { from, to, productName } = req.query;
  const match = buildDateMatch(from, to);

  const records = await SalesRecord.find(match);

  // 1. Overall ingredient consumption
  const ingredientMap = {};
  records.forEach(r => {
    r.lines?.forEach(line => {
      if (productName && line.productName.toLowerCase() !== productName.toLowerCase()) return;
      line.ingredientsUsed?.forEach(ing => {
        const key = ing.materialId?.toString() || ing.materialName;
        if (!ingredientMap[key]) {
          ingredientMap[key] = {
            materialId: ing.materialId,
            materialName: ing.materialName,
            unit: ing.unit || 'unit',
            totalQty: 0,
            totalCost: 0,
            unitCost: ing.unitCost || 0,
          };
        }
        ingredientMap[key].totalQty += ing.quantityUsed || 0;
        ingredientMap[key].totalCost += ing.totalCost || 0;
      });
    });
  });

  // Fetch current stock from RawMaterial for context
  const ingredients = await Promise.all(
    Object.values(ingredientMap).map(async (ing) => {
      let currentStock = null;
      if (ing.materialId) {
        const mat = await RawMaterial.findById(ing.materialId).select('currentStock unitCost unit');
        if (mat) {
          currentStock = mat.currentStock;
          if (!ing.unitCost && mat.unitCost) ing.unitCost = mat.unitCost;
        }
      }
      return {
        ...ing,
        currentStock,
      };
    })
  );
  ingredients.sort((a, b) => b.totalCost - a.totalCost);

  // 2. Product-by-product ingredient consumption breakdown:
  // "One product how much Ingredients consumed"
  const productMap = {};
  records.forEach(r => {
    r.lines?.forEach(line => {
      const key = (line.productName || line.productCode || 'Unspecified Item').trim();
      if (!productMap[key]) {
        productMap[key] = {
          productName: key,
          productId: line.productId,
          qtySold: 0,
          revenue: 0,
          totalIngredientCost: 0,
          ingredients: {},
        };
      }
      productMap[key].qtySold += line.quantitySold || 0;
      productMap[key].revenue += line.revenue || 0;
      productMap[key].totalIngredientCost += line.cogs || 0;

      line.ingredientsUsed?.forEach(ing => {
        const iKey = ing.materialId?.toString() || ing.materialName;
        if (!productMap[key].ingredients[iKey]) {
          productMap[key].ingredients[iKey] = {
            materialId: ing.materialId,
            materialName: ing.materialName,
            unit: ing.unit || 'unit',
            totalUsed: 0,
            unitCost: ing.unitCost || 0,
            totalCost: 0,
          };
        }
        productMap[key].ingredients[iKey].totalUsed += ing.quantityUsed || 0;
        productMap[key].ingredients[iKey].totalCost += ing.totalCost || 0;
      });
    });
  });

  const productConsumption = Object.values(productMap).map(p => {
    const ings = Object.values(p.ingredients).map(i => ({
      ...i,
      // One unit of product uses:
      perUnitQuantity: p.qtySold > 0 ? i.totalUsed / p.qtySold : 0,
      perUnitCost: p.qtySold > 0 ? i.totalCost / p.qtySold : 0,
    }));
    return {
      productName: p.productName,
      productId: p.productId,
      qtySold: p.qtySold,
      revenue: p.revenue,
      totalIngredientCost: p.totalIngredientCost,
      grossProfit: p.revenue - p.totalIngredientCost,
      margin: p.revenue > 0 ? ((p.revenue - p.totalIngredientCost) / p.revenue) * 100 : 0,
      ingredients: ings,
    };
  }).sort((a, b) => b.totalIngredientCost - a.totalIngredientCost);

  res.json({
    ingredients,
    productConsumption,
    totalRecordsAnalyzed: records.length,
  });
});

// ── GET /api/analytics/prediction ────────────────────────────────────
// Sales trend & stock demand prediction using moving averages & par-levels
const getPrediction = asyncHandler(async (req, res) => {
  // Get last 30 days of sales records
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const records = await SalesRecord.find({ saleDate: { $gte: thirtyDaysAgo } }).sort({ saleDate: 1 });

  // Build daily revenue map
  const dailyMap = {};
  records.forEach(r => {
    const day = r.saleDate.toISOString().slice(0, 10);
    if (!dailyMap[day]) dailyMap[day] = { date: day, revenue: 0, cogs: 0 };
    dailyMap[day].revenue += r.totalRevenue || 0;
    dailyMap[day].cogs += r.totalCOGS || 0;
  });

  // Fill missing days with 0 for smooth time series
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(dailyMap[key] || { date: key, revenue: 0, cogs: 0 });
  }

  // 7-day moving average
  const movingAvg = days.map((d, i) => {
    if (i < 6) return { ...d, avgRevenue: null, avgCogs: null };
    const window = days.slice(i - 6, i + 1);
    const avgRevenue = window.reduce((s, w) => s + w.revenue, 0) / 7;
    const avgCogs = window.reduce((s, w) => s + w.cogs, 0) / 7;
    return { ...d, avgRevenue, avgCogs };
  });

  // Next 7 days projection
  const last7 = days.slice(-7);
  const activeDays = days.filter(d => d.revenue > 0).length || 1;
  const totalRev = days.reduce((s, d) => s + d.revenue, 0);
  const totalCogs = days.reduce((s, d) => s + d.cogs, 0);

  const predictedRevenue = last7.reduce((s, d) => s + d.revenue, 0) / 7 || (totalRev / activeDays);
  const predictedCOGS = last7.reduce((s, d) => s + d.cogs, 0) / 7 || (totalCogs / activeDays);

  const predictions = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    predictions.push({
      date: d.toISOString().slice(0, 10),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      predictedRevenue,
      predictedCOGS,
      predictedProfit: predictedRevenue - predictedCOGS,
    });
  }

  // Ingredient stock coverage prediction
  const ingredientMap = {};
  records.forEach(r => {
    r.lines?.forEach(line => {
      line.ingredientsUsed?.forEach(ing => {
        const key = ing.materialId?.toString() || ing.materialName;
        if (!ingredientMap[key]) {
          ingredientMap[key] = {
            materialId: ing.materialId,
            materialName: ing.materialName,
            unit: ing.unit,
            totalUsed: 0,
          };
        }
        ingredientMap[key].totalUsed += ing.quantityUsed || 0;
      });
    });
  });

  const stockCoverage = [];
  for (const [key, ing] of Object.entries(ingredientMap)) {
    if (!ing.materialId) continue;
    const mat = await RawMaterial.findById(ing.materialId);
    if (!mat) continue;

    // Use active 30-day usage rate
    const avgDailyUsage = ing.totalUsed / 30;
    const daysRemaining = avgDailyUsage > 0 ? mat.currentStock / avgDailyUsage : 999;

    // Par level calculation: suggest enough for 14 days minus current stock
    const targetParLevel = avgDailyUsage * 14;
    const reorderSuggested = Math.max(0, targetParLevel - mat.currentStock);
    const estimatedCost = reorderSuggested * (mat.unitCost || 0);

    stockCoverage.push({
      materialId: mat._id,
      materialName: mat.name,
      category: mat.category || 'General',
      unit: mat.unit,
      currentStock: mat.currentStock,
      unitCost: mat.unitCost || 0,
      avgDailyUsage: Number(avgDailyUsage.toFixed(3)),
      daysRemaining: daysRemaining > 365 ? '> 1 Year' : Math.max(0, Math.floor(daysRemaining)),
      daysNum: daysRemaining,
      status: daysRemaining < 3 ? 'critical' : daysRemaining < 7 ? 'warning' : 'ok',
      reorderSuggested: Number(reorderSuggested.toFixed(2)),
      estimatedCost: Number(estimatedCost.toFixed(2)),
    });
  }
  stockCoverage.sort((a, b) => a.daysNum - b.daysNum);

  res.json({
    historicalTrend: movingAvg,
    predictions,
    stockCoverage,
    summary: {
      predictedDailyRevenue: predictedRevenue,
      predictedDailyCOGS: predictedCOGS,
      predictedDailyProfit: predictedRevenue - predictedCOGS,
      criticalItemsCount: stockCoverage.filter(s => s.status === 'critical').length,
      warningItemsCount: stockCoverage.filter(s => s.status === 'warning').length,
    },
  });
});

// ── GET /api/analytics/records ────────────────────────────────────────
const getSalesRecords = asyncHandler(async (req, res) => {
  const { from, to, limit = 50 } = req.query;
  const match = buildDateMatch(from, to);
  const records = await SalesRecord.find(match)
    .sort({ saleDate: -1 })
    .limit(Number(limit))
    .populate('importedBy', 'name email')
    .populate('stockTransaction', 'voucherNo status');
  res.json(records);
});

// ── DELETE /api/analytics/records/:id ─────────────────────────────────
const deleteSalesRecord = asyncHandler(async (req, res) => {
  const record = await SalesRecord.findById(req.params.id);
  if (!record) {
    res.status(404);
    throw new Error('Sales record not found');
  }

  // If a stock transaction exists, reverse stock deductions cleanly
  if (record.stockTransaction) {
    try {
      const txn = await StockTransaction.findById(record.stockTransaction);
      if (txn && txn.items && txn.items.length > 0) {
        const restoreOps = txn.items
          .filter(i => i.material && (Number(i.quantity) || 0) > 0)
          .map(item => ({
            updateOne: {
              filter: { _id: item.material },
              update: { $inc: { currentStock: Number(item.quantity) || 0 } },
            },
          }));
        if (restoreOps.length > 0) {
          await RawMaterial.bulkWrite(restoreOps);
        }
      }
      await StockTransaction.findByIdAndDelete(record.stockTransaction);
    } catch (stockErr) {
      console.warn('[DeleteSalesRecord] Stock reversal non-fatal warning:', stockErr.message);
    }
  }

  await record.deleteOne();

  try {
    const { invalidateDashboardCache } = require('./dashboardController');
    invalidateDashboardCache?.();
  } catch (_) { }

  res.json({ success: true, message: 'Sales record and associated batch deleted successfully' });
});

module.exports = {
  getProfitLoss,
  getConsumption,
  getPrediction,
  getSalesRecords,
  deleteSalesRecord,
};
