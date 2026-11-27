/**
 * System Context Service
 * ──────────────────────────────────────────────────────────────────
 * Builds a structured, concise snapshot of the live system state
 * from MongoDB. Called on every AI request.
 * Cached per-role for 30 seconds to avoid hammering the DB on every
 * message — data is still effectively "live" for users.
 */

const RawMaterial = require('../models/RawMaterial');
const StockTransaction = require('../models/StockTransaction');
const Purchase = require('../models/Purchase');
const Supplier = require('../models/Supplier');
const User = require('../models/User');
const Consumption = require('../models/Consumption');
const StockRequest = require('../models/StockRequest');
const Employee = require('../models/Employee');
const Product = require('../models/Product');

// ── Simple in-memory cache (per role, 30s TTL) ────────────────────
const _cache = {};
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// ── helpers ──────────────────────────────────────────────────────
const etb = (n) => `ETB ${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

const monthRange = () => {
  const now = new Date();
  return {
    from: new Date(now.getFullYear(), now.getMonth(), 1),
    to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
  };
};

const isDrinkCategoryProduct = (p) => {
  const pc = String(p?.parentCategory || '').toLowerCase();
  const cat = String(p?.category || '').toLowerCase();
  return pc === 'beverage' || pc === 'juices' || /hot drink|cold drink|juice|soft drink/.test(cat);
};

/**
 * Live report of today's daily staff meals (orders, distinct staff, food vs drink items, cost).
 */
async function getTodayStaffMealReport() {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const [todayStaffMeals, activeEmployees] = await Promise.all([
    Consumption.find({
      category: 'staff_meal',
      status: { $in: ['pending', 'approved'] },
      date: { $gte: startOfToday, $lte: endOfToday },
      $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
    })
      .populate('items.product', 'name code parentCategory category')
      .populate('employee', 'firstName lastName department position dailyMealLimit mealsDisabled')
      .sort({ date: -1 })
      .lean(),
    Employee.find({ deletedAt: null, status: 'active' })
      .select('firstName lastName department position dailyMealLimit mealsDisabled')
      .lean(),
  ]);

  const byStaffMap = new Map();
  const foodCounts = {};
  const drinkCounts = {};
  let totalFoodPortions = 0;
  let totalDrinkPortions = 0;
  let totalCost = 0;

  for (const rec of todayStaffMeals) {
    totalCost += Number(rec.totalRecipeCost) || 0;
    const empObj = rec.employee;
    const staffName = empObj
      ? `${empObj.firstName || ''} ${empObj.lastName || ''}`.trim()
      : (rec.beneficiary || 'Unknown Staff').trim();
    const staffKey = empObj?._id ? String(empObj._id) : staffName.toLowerCase();

    if (!byStaffMap.has(staffKey)) {
      byStaffMap.set(staffKey, {
        name: staffName,
        department: empObj?.department || rec.department || 'General',
        position: empObj?.position || '',
        dailyMealLimit: Number(empObj?.dailyMealLimit) || 1,
        orders: 0,
        foodPortions: 0,
        drinkPortions: 0,
        cost: 0,
        foods: [],
        drinks: [],
      });
    }

    const entry = byStaffMap.get(staffKey);
    entry.orders += 1;
    entry.cost += Number(rec.totalRecipeCost) || 0;

    for (const itm of rec.items || []) {
      const prod = itm.product;
      const itemName = prod?.name || 'Menu Item';
      const qty = Number(itm.quantity) || 1;
      if (isDrinkCategoryProduct(prod)) {
        totalDrinkPortions += qty;
        entry.drinkPortions += qty;
        entry.drinks.push(`${itemName} x${qty}`);
        drinkCounts[itemName] = (drinkCounts[itemName] || 0) + qty;
      } else {
        totalFoodPortions += qty;
        entry.foodPortions += qty;
        entry.foods.push(`${itemName} x${qty}`);
        foodCounts[itemName] = (foodCounts[itemName] || 0) + qty;
      }
    }
  }

  const byStaff = Array.from(byStaffMap.values()).sort((a, b) => (b.foodPortions + b.drinkPortions) - (a.foodPortions + a.drinkPortions));
  const foodBreakdown = Object.entries(foodCounts).sort((a, b) => b[1] - a[1]);
  const drinkBreakdown = Object.entries(drinkCounts).sort((a, b) => b[1] - a[1]);

  return {
    dateLabel: now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    totalOrders: todayStaffMeals.length,
    distinctStaffCount: byStaff.length,
    totalFoodPortions,
    totalDrinkPortions,
    totalPortions: totalFoodPortions + totalDrinkPortions,
    totalCost: Math.round(totalCost * 100) / 100,
    byStaff,
    foodBreakdown,
    drinkBreakdown,
    totalActiveEmployees: activeEmployees.length,
    restrictedEmployeesCount: activeEmployees.filter((e) => e.mealsDisabled).length,
  };
}

// ── Main snapshot builder ─────────────────────────────────────────
async function buildSystemContext(userRole = 'storekeeper') {
  // Return cached snapshot if still fresh
  const cached = _cache[userRole];
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return cached.ctx;
  }

  const { from, to } = monthRange();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // ── Fire ALL queries in parallel in one Promise.all ──────────────
  const isAdmin = ['admin', 'dev'].includes(userRole);
  const isManager = ['admin', 'dev', 'manager', 'operation_manager', 'finance', 'supervisor', 'executive_chef'].includes(userRole);

  const [
    materialCount,
    outOfStock,
    lowStockItems,
    topMaterials,
    outOfStockItems,
    recentTxns,
    monthPurchases,
    pendingRequests,
    monthConsumption,
    productCount,
    suppliers,
    users,
    empCount,
    stockValueAgg,
    todayStaffMealReport,
  ] = await Promise.all([
    // 1. count active materials
    RawMaterial.countDocuments({ isActive: true, deletedAt: null }),

    // 2. count out-of-stock
    RawMaterial.countDocuments({ isActive: true, deletedAt: null, currentStock: { $lte: 0 } }),

    // 3. low stock items (below reorder, still > 0)
    RawMaterial.find({
      isActive: true, deletedAt: null,
      $expr: { $lte: ['$currentStock', '$reorderLevel'] },
      currentStock: { $gt: 0 },
    }).select('name currentStock reorderLevel unit').sort({ currentStock: 1 }).limit(10).lean(),

    // 4. top valued materials (aggregate avoids loading all docs)
    RawMaterial.aggregate([
      { $match: { isActive: true, deletedAt: null } },
      { $project: { name: 1, unit: 1, category: 1, currentStock: 1, unitCost: 1, value: { $multiply: ['$currentStock', '$unitCost'] } } },
      { $sort: { value: -1 } },
      { $limit: 8 },
    ]),

    // 5. out-of-stock item names (limit 10)
    RawMaterial.find({ isActive: true, deletedAt: null, currentStock: { $lte: 0 } })
      .select('name unit category').limit(10).lean(),

    // 6. recent transactions summary (7 days, no populate needed for counts)
    StockTransaction.aggregate([
      { $match: { deletedAt: null, date: { $gte: sevenDaysAgo } } },
      { $group: { _id: '$type', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),

    // 7. purchases this month — summary only
    Purchase.aggregate([
      { $match: { purchaseDate: { $gte: from, $lte: to } } },
      { $group: { _id: '$status', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]),

    // 8. pending stock requests
    StockRequest.find({ status: 'pending', deletedAt: null })
      .select('department priority voucherNo').sort({ requestedAt: -1 }).limit(10).lean(),

    // 9. consumption this month — aggregate by category
    Consumption.aggregate([
      { $match: { status: 'approved', date: { $gte: from, $lte: to }, $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }] } },
      { $group: { _id: '$category', total: { $sum: '$totalRecipeCost' } } },
    ]),

    // 10. product count
    Product.countDocuments({ isActive: true, deletedAt: null }),

    // 11. suppliers (manager/admin only, else null)
    isManager
      ? Supplier.find({ isActive: true, deletedAt: null }).select('name category').limit(20).lean()
      : Promise.resolve(null),

    // 12. users (admin only, else null)
    isAdmin
      ? User.find({ isActive: true }).select('name role').lean()
      : Promise.resolve(null),

    // 13. employee count (manager/admin only)
    isManager
      ? Employee.countDocuments({ deletedAt: null, status: 'active' })
      : Promise.resolve(null),

    // 14. total stock value via aggregation (avoids loading all docs)
    RawMaterial.aggregate([
      { $match: { isActive: true, deletedAt: null } },
      { $group: { _id: null, totalValue: { $sum: { $multiply: ['$currentStock', '$unitCost'] } }, cats: { $push: { cat: '$category', val: { $multiply: ['$currentStock', '$unitCost'] } } } } },
    ]),

    // 15. today's daily staff meals report
    getTodayStaffMealReport(),
  ]);

  // ── Process aggregation results ───────────────────────────────
  const totalStockValue = stockValueAgg[0]?.totalValue || 0;

  // Stock by category from topMaterials
  const stockByCategory = {};
  topMaterials.forEach(m => {
    if (!stockByCategory[m.category]) stockByCategory[m.category] = { count: 0, value: 0 };
    stockByCategory[m.category].count++;
    stockByCategory[m.category].value += m.value || 0;
  });

  // Transaction summary
  const txnIn = recentTxns.find(t => t._id === 'in');
  const txnOut = recentTxns.find(t => t._id === 'out');
  const txnCount = recentTxns.reduce((s, t) => s + t.count, 0);
  const txnSummary = {
    totalIn: txnIn?.total || 0,
    totalOut: txnOut?.total || 0,
    count: txnCount,
  };

  // Purchase summary
  const purchaseMap = {};
  let purchaseTotal = 0;
  monthPurchases.forEach(p => { purchaseMap[p._id] = p; purchaseTotal += p.total || 0; });
  const purchaseSummary = {
    total: purchaseTotal,
    count: monthPurchases.reduce((s, p) => s + p.count, 0),
    draft: purchaseMap['draft']?.count || 0,
    pending: purchaseMap['checked']?.count || 0,
    approved: purchaseMap['approved']?.count || 0,
    received: purchaseMap['received']?.count || 0,
  };

  // Consumption by category
  const consumptionByCategory = {};
  monthConsumption.forEach(c => { consumptionByCategory[c._id] = c.total; });

  // Staff info
  let staffInfo = null;
  if (isAdmin && users) {
    const byRole = {};
    users.forEach(u => { byRole[u.role] = (byRole[u.role] || 0) + 1; });
    staffInfo = { total: users.length, byRole };
  }

  const supplierInfo = (isManager && suppliers)
    ? { count: suppliers.length, list: suppliers.map(s => `${s.name} (${s.category || 'General'})`).join(', ') }
    : null;

  // ── Assemble context string ───────────────────────────────────
  const today = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const monthName = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  let ctx = `
=== Baba Roti  CaféHOTEL — LIVE SYSTEM SNAPSHOT ===
Date: ${today}
User Role: ${userRole.toUpperCase()}
Hotel: Baba Roti  CaféHotel (Baba Roti  Café Plc Stock Management System)

--- STOCK OVERVIEW ---
Total Active Materials: ${materialCount}
Total Stock Value: ${etb(totalStockValue)}
Out of Stock: ${outOfStock} items${outOfStockItems.length ? ` → ${outOfStockItems.map(m => m.name).join(', ')}` : ''}
Low Stock (below reorder): ${lowStockItems.length} items
${lowStockItems.length > 0 ? lowStockItems.map(m => `  • ${m.name}: ${m.currentStock} ${m.unit} (reorder at ${m.reorderLevel})`).join('\n') : '  None'}

Top Valued Items in Stock:
${topMaterials.map((m, i) => `  ${i + 1}. ${m.name}: ${m.currentStock} ${m.unit} = ${etb(m.value)}`).join('\n')}

--- STOCK MOVEMENTS (Last 7 Days) ---
Total Transactions: ${txnSummary.count}
Stock In Value: ${etb(txnSummary.totalIn)}
Stock Out Value: ${etb(txnSummary.totalOut)}
Net Flow: ${etb(txnSummary.totalIn - txnSummary.totalOut)}

--- PURCHASES (${monthName}) ---
Total Spend: ${etb(purchaseSummary.total)}
Purchase Orders: ${purchaseSummary.count} (Draft: ${purchaseSummary.draft}, Pending Approval: ${purchaseSummary.pending}, Approved: ${purchaseSummary.approved}, Received: ${purchaseSummary.received})

--- STOCK REQUESTS (Pending Approval) ---
Pending Requests: ${pendingRequests.length}
${pendingRequests.length > 0 ? pendingRequests.map(r => `  • ${r.voucherNo} — ${r.department} (${r.priority})`).join('\n') : '  None pending'}

--- CONSUMPTION (${monthName}) ---
Total Recipe Cost: ${etb(Object.values(consumptionByCategory).reduce((s, v) => s + v, 0))}
${Object.entries(consumptionByCategory).map(([cat, cost]) => `  • ${cat}: ${etb(cost)}`).join('\n') || '  No consumption recorded'}

--- PRODUCTS ---
Active Products/Recipes: ${productCount}
`;

  if (supplierInfo) {
    ctx += `
--- SUPPLIERS ---
Active Suppliers: ${supplierInfo.count}
List: ${supplierInfo.list}
`;
  }

  if (staffInfo) {
    ctx += `
--- STAFF ---
Total Active Users: ${staffInfo.total}
By Role: ${Object.entries(staffInfo.byRole).map(([r, c]) => `${r}: ${c}`).join(', ')}
`;
  }

  if (empCount !== null) {
    ctx += `
--- EMPLOYEES ---
Active Employees: ${empCount}
`;
  }

  if (todayStaffMealReport) {
    ctx += `
--- TODAY'S DAILY STAFF MEALS (${todayStaffMealReport.dateLabel}) ---
Total Staff Meal Orders Today: ${todayStaffMealReport.totalOrders}
Staff Members Who Used Daily Meal Today: ${todayStaffMealReport.distinctStaffCount}
Total Food Portions Consumed Today: ${todayStaffMealReport.totalFoodPortions}
Total Drink Portions Consumed Today: ${todayStaffMealReport.totalDrinkPortions}
${isManager ? `Total Staff Meal Cost Today: ${etb(todayStaffMealReport.totalCost)}\n` : ''}${isManager && todayStaffMealReport.byStaff.length > 0
        ? `Staff Breakdown:\n${todayStaffMealReport.byStaff.map(s => `  • ${s.name} (${s.department}): ${s.foodPortions}/${s.dailyMealLimit} food meal(s), ${s.drinkPortions} drink(s) — Items: ${[...s.foods, ...s.drinks].join(', ')}`).join('\n')}`
        : (todayStaffMealReport.totalOrders === 0 ? 'No staff meals ordered yet today.' : '')}
${todayStaffMealReport.foodBreakdown.length > 0 ? `Foods Consumed Today: ${todayStaffMealReport.foodBreakdown.map(([n, q]) => `${n} (x${q})`).join(', ')}` : ''}
`;
  }

  ctx += `
=== END OF SYSTEM SNAPSHOT ===
`;

  const result = ctx.trim();

  // Store in cache
  _cache[userRole] = { ctx: result, ts: Date.now() };

  return result;
}

// Allow clearing cache from outside (e.g. after a stock update)
function clearContextCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
}

module.exports = { buildSystemContext, clearContextCache, getTodayStaffMealReport };
