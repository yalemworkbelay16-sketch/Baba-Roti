const POSOrder = require('../models/POSOrder');
const CaptainOrder = require('../models/CaptainOrder');
const SalesRecord = require('../models/SalesRecord');
const Setting = require('../models/Setting');
const tg = require('./telegramNotifier');

/**
 * Calculate full daily sales metrics for a given date range
 */
async function computeDailySalesMetrics(startDate, endDate) {
  const start = startDate ? new Date(startDate) : new Date();
  if (!startDate) start.setHours(0, 0, 0, 0);

  const end = endDate ? new Date(endDate) : new Date();
  if (!endDate) end.setHours(23, 59, 59, 999);

  // 1. Fetch POS Orders
  const posOrders = await POSOrder.find({
    createdAt: { $gte: start, $lte: end },
    isVoided: { $ne: true },
    paymentStatus: { $ne: 'voided' },
  }).lean();

  // 2. Fetch Customer QR / Captain Orders
  const captainOrders = await CaptainOrder.find({
    createdAt: { $gte: start, $lte: end },
    status: { $nin: ['voided', 'cancelled'] },
  }).lean();

  // 3. Fetch Imported Sales Records
  const importedSales = await SalesRecord.find({
    $or: [
      { saleDate: { $gte: start, $lte: end } },
      { importDate: { $gte: start, $lte: end } },
      { createdAt: { $gte: start, $lte: end } },
    ],
  }).lean();

  let totalSales = 0;
  let totalOrdersCount = 0;
  const categoryStats = {};
  const channelStats = {
    pos: { label: 'Counter POS', count: 0, revenue: 0 },
    qr: { label: 'Customer QR Menu', count: 0, revenue: 0 },
    imported: { label: 'Imported / Excel Sales', count: 0, revenue: 0 },
  };
  const paymentStats = {
    Cash: 0,
    Telebirr: 0,
    Card: 0,
    Credit: 0,
    Other: 0,
  };

  // Helper to add category item
  const addCategoryItem = (category, qty, amount) => {
    const cat = category || 'General';
    if (!categoryStats[cat]) {
      categoryStats[cat] = { name: cat, quantity: 0, revenue: 0 };
    }
    categoryStats[cat].quantity += Number(qty) || 0;
    categoryStats[cat].revenue += Number(amount) || 0;
  };

  // Process POS Orders
  posOrders.forEach((order) => {
    const rev = Number(order.grandTotal ?? order.subtotal ?? 0);
    totalSales += rev;
    totalOrdersCount++;
    channelStats.pos.count++;
    channelStats.pos.revenue += rev;

    const pm = order.paymentMethod || 'Cash';
    paymentStats[pm] = (paymentStats[pm] || 0) + rev;

    (order.items || []).forEach((item) => {
      addCategoryItem(item.category, item.quantity, item.totalPrice);
    });
  });

  // Process Customer QR Orders (track self-order orders that haven't been duplicated into POS yet)
  const posOrderNumbers = new Set(posOrders.map((o) => o.orderNo));
  captainOrders.forEach((corder) => {
    const isCustomerQR =
      corder.createdByName === 'Self-Order QR' ||
      (corder.orderNo && corder.orderNo.startsWith('CAP-')) ||
      corder.tableNo;

    // Avoid double counting if already converted/settled in POS
    if (!posOrderNumbers.has(corder.orderNo)) {
      const rev = Number(corder.grandTotal ?? corder.subtotal ?? 0);
      if (isCustomerQR) {
        channelStats.qr.count++;
        channelStats.qr.revenue += rev;
      }
      (corder.items || []).forEach((item) => {
        addCategoryItem(item.category, item.quantity, item.totalPrice);
      });
    }
  });

  // Process Imported Sales Records
  const importedBreakdown = {
    subTotal: 0,
    addCharge: 0,
    discount: 0,
    totalTax: 0,
    grandTotal: 0,
  };

  importedSales.forEach((rec) => {
    const rev = Number(rec.totalRevenue || 0);
    const sub = Number(rec.subTotal ?? rev);
    const add = Number(rec.addCharge || 0);
    const disc = Number(rec.discount || 0);
    const tax = Number(rec.totalTax || 0);
    const grand = Number(rec.grandTotal ?? (sub + add - disc + tax));

    importedBreakdown.subTotal += sub;
    importedBreakdown.addCharge += add;
    importedBreakdown.discount += disc;
    importedBreakdown.totalTax += tax;
    importedBreakdown.grandTotal += grand;

    const countedRev = grand > 0 ? grand : rev;
    totalSales += countedRev;
    totalOrdersCount++;
    channelStats.imported.count++;
    channelStats.imported.revenue += countedRev;

    (rec.lines || []).forEach((line) => {
      addCategoryItem('Imported Sales', line.quantitySold, line.revenue);
    });
  });

  // Sort categories by highest revenue
  const topCategories = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);

  return {
    date: start,
    dateString: start.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
    totalSales: Math.round(totalSales * 100) / 100,
    totalOrdersCount,
    topCategories,
    channelStats,
    paymentStats,
    importedBreakdown,
  };
}
/**
 * Format Telegram HTML report message
 */
function formatDailyReportMessage(metrics, cafeName = 'Baba Roti Café') {
  const formatBirr = (num) =>
    Number(num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ETB';

  const categoryLines = metrics.topCategories
    .slice(0, 8)
    .map((c) => `  • <b>${c.name}:</b> ${formatBirr(c.revenue)} (${c.quantity} items)`)
    .join('\n');

  return (
    `🏨 <b>${cafeName.toUpperCase()}</b>
📊 <b>DAILY SALES DIGEST — ${metrics.dateString}</b>
━━━━━━━━━━━━━━━━━━━━
💰 <b>TOTAL SALES:</b> <code>${formatBirr(metrics.totalSales)}</code>
🧾 <b>TOTAL ORDERS:</b> <b>${metrics.totalOrdersCount}</b> orders
━━━━━━━━━━━━━━━━━━━━
🍽️ <b>SALES BY CATEGORY:</b>
${categoryLines || '  • <i>No categorized items sold yet today.</i>'}

📱 <b>BY ORDER CHANNEL:</b>
  • 🖥️ <b>Counter POS:</b> ${formatBirr(metrics.channelStats.pos.revenue)} (${metrics.channelStats.pos.count} orders)
  • 📱 <b>Customer QR Menu:</b> ${formatBirr(metrics.channelStats.qr.revenue)} (${metrics.channelStats.qr.count} orders)
${metrics.channelStats.imported.count > 0 ? (
      `  • 📁 <b>Imported POS Sales:</b> ${formatBirr(metrics.importedBreakdown?.grandTotal || metrics.channelStats.imported.revenue)} (${metrics.channelStats.imported.count} batches)` +
      (metrics.importedBreakdown && (metrics.importedBreakdown.addCharge > 0 || metrics.importedBreakdown.totalTax > 0 || metrics.importedBreakdown.discount > 0)
        ? `\n    └ <i>Sub Total:</i> ${formatBirr(metrics.importedBreakdown.subTotal)} | <i>Add:</i> ${formatBirr(metrics.importedBreakdown.addCharge)} | <i>Tax:</i> ${formatBirr(metrics.importedBreakdown.totalTax)}`
        : '') + '\n'
    ) : ''}━━━━━━━━━━━━━━━━━━━━
💳 <b>PAYMENT METHODS:</b>
  • 💵 <b>Cash:</b> ${formatBirr(metrics.paymentStats.Cash)}
  • 📱 <b>Telebirr:</b> ${formatBirr(metrics.paymentStats.Telebirr)}
  • 🏦 <b>Bank/Card:</b> ${formatBirr(metrics.paymentStats.Card)}
  • 📑 <b>Credit:</b> ${formatBirr(metrics.paymentStats.Credit)}
━━━━━━━━━━━━━━━━━━━━
⚡ <i>Automated Daily Executive Report — Baba Roti Management System</i>`
  );
}

/**
 * Generate and broadcast Daily Sales Report to Telegram Subscribers
 */
async function sendDailySalesReport({ isManual = false, targetChatId = null } = {}) {
  const settings = await Setting.findOne();
  const metrics = await computeDailySalesMetrics();
  const text = formatDailyReportMessage(metrics, settings?.hotelName || 'Baba Roti Café');

  let sentCount = 0;
  if (targetChatId) {
    if (tg && typeof tg.sendToOne === 'function') {
      const res = await tg.sendToOne(targetChatId, text);
      if (res?.ok) sentCount++;
    }
  } else {
    // Collect all recipient chat IDs: subscribers from DB, staff telegram chat IDs, and environment chat IDs
    let chatIds = [];
    if (tg && typeof tg.getChatIds === 'function') {
      chatIds = await tg.getChatIds();
    }
    if (!chatIds || chatIds.length === 0) {
      chatIds = (settings?.telegramSubscribers || [])
        .map((s) => s.chatId)
        .filter(Boolean);
    }

    console.log(`[DailyReport] Broadcasting daily sales digest to ${chatIds.length} recipient(s):`, chatIds);

    for (const cid of chatIds) {
      try {
        if (tg && typeof tg.sendToOne === 'function') {
          const res = await tg.sendToOne(cid, text);
          if (res?.ok) {
            sentCount++;
          }
        }
      } catch (e) {
        console.warn(`[DailyReport] Error sending to chat ${cid}:`, e.message);
      }
    }
  }

  // Update last report date in settings
  if (!isManual && settings) {
    const todayStr = new Date().toISOString().slice(0, 10);
    settings.lastDailyReportDate = todayStr;
    await settings.save().catch(() => { });
  }

  return {
    success: true,
    sentCount,
    metrics,
    message: sentCount > 0
      ? `Daily sales report sent to ${sentCount} Telegram recipient(s).`
      : 'No active Telegram subscribers were reached. Please ensure your Telegram bot is started and subscribers are registered.',
  };
}

module.exports = {
  computeDailySalesMetrics,
  formatDailyReportMessage,
  sendDailySalesReport,
};

