const Product = require('../models/Product');
const SalesRecord = require('../models/SalesRecord');
const POSOrder = require('../models/POSOrder');
const CaptainOrder = require('../models/CaptainOrder');

function normalizeParent(s) {
  if (!s || !s.trim()) return 'Other';
  const lower = s.trim().toLowerCase();
  if (lower.includes('bev')) return 'Beverage';
  if (lower.includes('food')) return 'Food';
  if (lower.includes('juice')) return 'Juices';
  if (lower.includes('cake') || lower.includes('pastry')) return 'Cakes';
  if (lower.includes('other')) return 'Other';
  return s.trim().charAt(0).toUpperCase() + s.trim().slice(1);
}

function normalizeChild(s) {
  if (!s || !s.trim()) return 'General';
  const trimmed = s.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'break fast' || lower === 'breakfast') return 'Break Fast';
  if (lower === 'hot drink' || lower === 'hot drinks') return 'Hot Drink';
  if (lower === 'cold drink' || lower === 'cold drinks') return 'Cold Drink';
  if (lower === 'soft drink' || lower === 'soft drinks') return 'Soft Drink';
  if (lower === 'juice' || lower === 'juices') return 'Juice';
  if (lower === 'burger & sandwich' || lower === 'burger & sandwiches') return 'Burger & Sandwich';
  if (lower === 'chicken&fillet' || lower === 'chicken & fillet') return 'Chicken & Fillet';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Computes Parent Category Sales, Child Category By Amt & Qty, and Gross Profit / Recipe Cost.
 */
async function computeSalesAnalytics() {
  // Parallel fetch products and sales records
  const [products, allRecords, standalonePOS, activeCaptainOrders] = await Promise.all([
    Product.find({ isActive: true })
      .select('code name category parentCategory sellingPrice ingredients')
      .populate('ingredients.material', 'unitCost')
      .lean()
      .catch(() => []),
    SalesRecord.find({})
      .sort({ saleDate: -1, createdAt: -1 })
      .lean()
      .catch(() => []),
    POSOrder.find({ isVoided: { $ne: true }, paymentStatus: 'paid', salesRecord: null })
      .select('items grandTotal totalCOGS createdAt paymentStatus')
      .lean()
      .catch(() => []),
    CaptainOrder.find({ isVoided: { $ne: true }, status: { $in: ['open', 'sent_to_kitchen', 'ready', 'billed'] }, cashSaleRef: null })
      .select('items grandTotal createdAt status')
      .lean()
      .catch(() => []),
  ]);

  const prodMap = new Map();
  for (const p of products) {
    if (p._id) prodMap.set(String(p._id), p);
    if (p.code) prodMap.set(p.code.toLowerCase().trim(), p);
    if (p.name) prodMap.set(p.name.toLowerCase().trim(), p);
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // 1. Determine daily records (all records from today)
  let todayRecords = allRecords.filter((r) => {
    const d = new Date(r.saleDate || r.importDate || r.createdAt);
    return d >= startOfToday && d <= endOfToday;
  });

  let dailyDate = startOfToday;
  let isDailyToday = true;

  // Fallback to latest day if today has no sales records AND no standalone POS/Captain orders
  const todayPOSCount = standalonePOS.filter(o => new Date(o.createdAt) >= startOfToday).length;
  const todayCaptainCount = activeCaptainOrders.filter(o => new Date(o.createdAt) >= startOfToday).length;

  if (todayRecords.length === 0 && todayPOSCount === 0 && todayCaptainCount === 0 && allRecords.length > 0) {
    const latestRec = allRecords[0];
    const latestRecDate = new Date(latestRec.saleDate || latestRec.importDate || latestRec.createdAt);
    const startOfLatest = new Date(latestRecDate.getFullYear(), latestRecDate.getMonth(), latestRecDate.getDate());
    const endOfLatest = new Date(latestRecDate.getFullYear(), latestRecDate.getMonth(), latestRecDate.getDate(), 23, 59, 59, 999);
    todayRecords = allRecords.filter((r) => {
      const d = new Date(r.saleDate || r.importDate || r.createdAt);
      return d >= startOfLatest && d <= endOfLatest;
    });
    dailyDate = startOfLatest;
    isDailyToday = false;
  }

  // Define period slices
  const periods = {
    daily: todayRecords,
    latest: allRecords.slice(0, 1),
    week: allRecords.filter((r) => new Date(r.saleDate || r.importDate) >= sevenDaysAgo),
    month: allRecords.filter((r) => new Date(r.saleDate || r.importDate) >= startOfMonth),
    all: allRecords,
  };

  const salesAnalytics = {};

  for (const [key, records] of Object.entries(periods)) {
    const parentAgg = {};
    const childAgg = {};
    let totalQty = 0;
    let totalRevenue = 0;
    let totalRecipeCost = 0;

    // 1. Aggregate lines from SalesRecords
    for (const sr of records) {
      for (const l of (sr.lines || [])) {
        const p = (l.productId && prodMap.get(String(l.productId))) || 
                  (l.productCode && prodMap.get(l.productCode.toLowerCase().trim())) || 
                  (l.productName && prodMap.get(l.productName.toLowerCase().trim()));
        
        const parentCat = normalizeParent(p?.parentCategory);
        const childCat = normalizeChild(p?.category);
        const qty = l.quantitySold || 0;
        const amt = l.revenue || (qty * (l.sellingPrice || 0));

        let lineCogs = l.cogs || 0;
        if (lineCogs === 0 && p?.ingredients?.length > 0) {
          lineCogs = p.ingredients.reduce((sum, ing) => sum + ((ing.material?.unitCost || 0) * (ing.quantity || 0)), 0) * qty;
        }

        totalRevenue += amt;
        totalRecipeCost += lineCogs;
        totalQty += qty;

        if (!parentAgg[parentCat]) parentAgg[parentCat] = { description: parentCat, quantity: 0, total: 0, cogs: 0 };
        parentAgg[parentCat].quantity += qty;
        parentAgg[parentCat].total += amt;
        parentAgg[parentCat].cogs += lineCogs;

        if (!childAgg[childCat]) childAgg[childCat] = { name: childCat, quantity: 0, amount: 0, cogs: 0, parent: parentCat };
        childAgg[childCat].quantity += qty;
        childAgg[childCat].amount += amt;
        childAgg[childCat].cogs += lineCogs;
      }
    }

    // 2. Include standalone POS / Captain Orders for broader periods
    if (key !== 'latest') {
      const posList = key === 'daily' ? standalonePOS.filter(o => new Date(o.createdAt) >= dailyDate)
                    : key === 'week' ? standalonePOS.filter(o => new Date(o.createdAt) >= sevenDaysAgo)
                    : key === 'month' ? standalonePOS.filter(o => new Date(o.createdAt) >= startOfMonth)
                    : standalonePOS;

      for (const order of posList) {
        for (const it of (order.items || [])) {
          const parentCat = normalizeParent(it.parentCategory);
          const childCat = normalizeChild(it.category);
          const qty = it.quantity || 1;
          const amt = it.totalPrice || (qty * (it.unitPrice || 0));
          const lineCogs = it.cogs || 0;

          totalRevenue += amt;
          totalRecipeCost += lineCogs;
          totalQty += qty;

          if (!parentAgg[parentCat]) parentAgg[parentCat] = { description: parentCat, quantity: 0, total: 0, cogs: 0 };
          parentAgg[parentCat].quantity += qty;
          parentAgg[parentCat].total += amt;
          parentAgg[parentCat].cogs += lineCogs;

          if (!childAgg[childCat]) childAgg[childCat] = { name: childCat, quantity: 0, amount: 0, cogs: 0, parent: parentCat };
          childAgg[childCat].quantity += qty;
          childAgg[childCat].amount += amt;
          childAgg[childCat].cogs += lineCogs;
        }
      }

      // Live digital menu orders
      const coList = key === 'daily' ? activeCaptainOrders.filter(o => new Date(o.createdAt) >= dailyDate)
                   : key === 'week' ? activeCaptainOrders.filter(o => new Date(o.createdAt) >= sevenDaysAgo)
                   : key === 'month' ? activeCaptainOrders.filter(o => new Date(o.createdAt) >= startOfMonth)
                   : activeCaptainOrders;

      for (const order of coList) {
        for (const it of (order.items || [])) {
          const parentCat = normalizeParent(it.parentCategory);
          const childCat = normalizeChild(it.category);
          const qty = it.quantity || 1;
          const amt = it.totalPrice || (qty * (it.unitPrice || 0));

          totalRevenue += amt;
          totalQty += qty;

          if (!parentAgg[parentCat]) parentAgg[parentCat] = { description: parentCat, quantity: 0, total: 0, cogs: 0 };
          parentAgg[parentCat].quantity += qty;
          parentAgg[parentCat].total += amt;

          if (!childAgg[childCat]) childAgg[childCat] = { name: childCat, quantity: 0, amount: 0, cogs: 0, parent: parentCat };
          childAgg[childCat].quantity += qty;
          childAgg[childCat].amount += amt;
        }
      }
    }

    const parentList = Object.values(parentAgg)
      .map(p => ({
        description: p.description,
        quantity: Math.round(p.quantity * 100) / 100,
        total: Math.round(p.total * 100) / 100,
        cogs: Math.round(p.cogs * 100) / 100,
        grossProfit: Math.round((p.total - p.cogs) * 100) / 100,
        margin: p.total > 0 ? Math.round(((p.total - p.cogs) / p.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    const childByAmt = Object.values(childAgg)
      .map(c => ({
        name: c.name,
        value: Math.round(c.amount * 100) / 100,
        quantity: Math.round(c.quantity * 100) / 100,
        cogs: Math.round(c.cogs * 100) / 100,
        profit: Math.round((c.amount - c.cogs) * 100) / 100,
        parent: c.parent,
      }))
      .sort((a, b) => b.value - a.value);

    const childByQty = Object.values(childAgg)
      .map(c => ({
        name: c.name,
        value: Math.round(c.quantity * 100) / 100,
        amount: Math.round(c.amount * 100) / 100,
        parent: c.parent,
      }))
      .sort((a, b) => b.value - a.value);

    const profitByParent = parentList.map(p => ({
      category: p.description,
      revenue: p.total,
      recipeCost: p.cogs,
      grossProfit: p.grossProfit,
      margin: p.margin,
    }));

    const grossProfit = Math.round((totalRevenue - totalRecipeCost) * 100) / 100;
    const grossMargin = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 100) : 0;

    salesAnalytics[key] = {
      recordCount: records.length,
      latestDate: key === 'daily' ? dailyDate : (records[0]?.saleDate || records[0]?.importDate || null),
      dailyDate: dailyDate,
      isDailyToday: isDailyToday,
      latestRef: records[0]?.reference || records[0]?.source || 'Sales Import',
      totalQty: Math.round(totalQty * 100) / 100,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalRecipeCost: Math.round(totalRecipeCost * 100) / 100,
      grossProfit,
      grossMargin,
      parentList,
      childByAmt,
      childByQty,
      profitByParent,
    };
  }

  return salesAnalytics;
}

module.exports = { computeSalesAnalytics };
