/**
 * escpos.js – Pure Node.js ESC/POS command builder.
 *
 * Supports all standard ESC/POS thermal printers:
 *   Epson TM-T20, TM-T88, TM-T82, TM-T70
 *   Star TSP100, TSP650, TSP700, TSP800
 *   Datecs DP-25, DP-50, WP-500
 *   Citizen CT-E351, CT-S310
 *   Bixolon SRP-350
 *   Generic 80mm/58mm POS printers
 *
 * Also supports HP LaserJet & PCL laser printers via plain-text mode:
 *   HP LaserJet M402dne, M404dn, Pro M404n, Pro M118dw, M428fdw
 *   Any PCL/plain-text printer accessible over TCP port 9100
 *
 * All ESC/POS printers use TCP port 9100 (raw socket).
 * HP LaserJet printers also use TCP port 9100 in RAW mode.
 */

const ESC = 0x1b;
const GS  = 0x1d;
const LF  = 0x0a;
const CR  = 0x0d;

// ── Text alignment constants ────────────────────────────────────────────────
const ALIGN_LEFT   = Buffer.from([ESC, 0x61, 0x00]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_RIGHT  = Buffer.from([ESC, 0x61, 0x02]);

// ── Text style constants ────────────────────────────────────────────────────
const BOLD_ON   = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF  = Buffer.from([ESC, 0x45, 0x00]);
const DOUBLE_HEIGHT_ON  = Buffer.from([ESC, 0x21, 0x10]);
const DOUBLE_HEIGHT_OFF = Buffer.from([ESC, 0x21, 0x00]);
const DOUBLE_SIZE_ON    = Buffer.from([ESC, 0x21, 0x30]);
const DOUBLE_SIZE_OFF   = Buffer.from([ESC, 0x21, 0x00]);

// ── Feed & cut ───────────────────────────────────────────────────────────────
const LINE_FEED = Buffer.from([LF]);
const FEED_3    = Buffer.from([ESC, 0x64, 3]);
const FEED_5    = Buffer.from([ESC, 0x64, 5]);

// Full cut (cutter not on all models, safe to send – ignored if no cutter)
const CUT_FULL  = Buffer.from([GS, 0x56, 0x00]);
const CUT_HALF  = Buffer.from([GS, 0x56, 0x01]);

// Initialise printer (reset)
const INIT = Buffer.from([ESC, 0x40]);

// ── Open cash drawer pulse ───────────────────────────────────────────────────
const OPEN_DRAWER = Buffer.from([ESC, 0x70, 0x00, 0x19, 0x78]);

/**
 * Pad or truncate a string to exactly `len` chars.
 */
function padEnd(str, len) {
  return String(str || '').padEnd(len).slice(0, len);
}

/**
 * Build a two-column row: left text + right text aligned to `totalWidth`.
 */
function twoCol(left, right, totalWidth = 42) {
  const rightStr = String(right || '');
  const leftWidth = totalWidth - rightStr.length;
  return padEnd(String(left || ''), leftWidth) + rightStr;
}

/**
 * Divider line of dashes.
 */
function divider(char = '-', width = 42) {
  return char.repeat(width);
}

/**
 * Convert a string to a Buffer using latin1 encoding (safe for ESC/POS).
 */
function text(str) {
  return Buffer.from(str + '\n', 'latin1');
}

// ─────────────────────────────────────────────────────────────────────────────
// KOT – Kitchen Order Ticket
// Sent to KITCHEN / BAR printer when order is placed.
// ─────────────────────────────────────────────────────────────────────────────
function buildKOT(order, opts = {}) {
  const W = opts.charWidth || 42;
  const businessName = opts.businessName || 'KITCHEN ORDER';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-ET');

  // Filter items by target station if specified ('kitchen', 'barista', etc.)
  const targetStation = opts.targetStation || opts.station;
  const items = (order.items || []).filter((item) => {
    if (!targetStation || targetStation === 'all' || targetStation === 'both') return true;
    if (targetStation === 'barista' || targetStation === 'bar') {
      return item.station === 'barista' || item.station === 'bar';
    }
    return item.station !== 'barista' && item.station !== 'bar';
  });

  const chunks = [
    INIT,
    ALIGN_CENTER,
  ];

  if (opts.isReprint) {
    chunks.push(
      BOLD_ON,
      text('*** DUPLICATE REPRINT ***'),
      BOLD_OFF,
      LINE_FEED
    );
  }

  chunks.push(
    DOUBLE_SIZE_ON,
    text(targetStation === 'barista' ? '** BARISTA DRINKS **' : '** KITCHEN ORDER **'),
    DOUBLE_SIZE_OFF,
    BOLD_ON,
    text(businessName.toUpperCase()),
    BOLD_OFF,
    ALIGN_LEFT,
    LINE_FEED,
    text(divider('=', W)),
    text(twoCol('Order #:', order.orderNo || '--', W)),
    text(twoCol('Type:', (order.orderType || 'dine_in').replace('_', ' ').toUpperCase(), W)),
  );

  if (order.tableNo) {
    chunks.push(text(twoCol('Table:', order.tableNo, W)));
  }
  if (order.waiterName) {
    chunks.push(text(twoCol('Waiter:', order.waiterName, W)));
  }
  if (order.customerName && order.customerName !== 'Walk-in Guest') {
    chunks.push(text(twoCol('Customer:', order.customerName, W)));
  }

  chunks.push(
    text(twoCol('Date:', dateStr, W)),
    text(twoCol('Time:', timeStr, W)),
    text(divider('=', W)),
    BOLD_ON,
    text(padEnd('ITEM', W - 10) + padEnd('QTY', 5) + 'NOTE'),
    BOLD_OFF,
    text(divider('-', W)),
  );

  items.forEach((item) => {
    const name = String(item.productName || item.name || '').slice(0, W - 12);
    const qty  = String(item.quantity || 1);
    const note = String(item.notes || '').slice(0, 12);
    chunks.push(
      BOLD_ON,
      text(padEnd(name, W - 12) + padEnd(`x${qty}`, 5) + note),
      BOLD_OFF,
    );
    if (item.notes) {
      chunks.push(text(`  >> ${item.notes}`));
    }
  });

  chunks.push(
    text(divider('=', W)),
    ALIGN_CENTER,
    BOLD_ON,
    text('** PREPARE IMMEDIATELY **'),
    BOLD_OFF,
    ALIGN_LEFT,
    FEED_5,
    CUT_FULL,
  );

  return Buffer.concat(chunks);
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEIPT – Customer receipt ticket
// Sent to RECEIPT printer on checkout/payment.
// ─────────────────────────────────────────────────────────────────────────────
function buildReceipt(order, opts = {}) {
  const W = opts.charWidth || 42;
  const hotelName   = opts.hotelName   || 'Baba Roti Café';
  const headerLine2 = opts.headerLine2 || '';
  const footerLine  = opts.footerLine  || 'Thank you! Come again.';
  const taxRate     = opts.taxRate || 15;
  const currency    = opts.currency || 'ETB';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-ET');
  const timeStr = now.toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' });

  const subtotal   = (order.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const discAmt    = subtotal * ((order.discountPercent || 0) / 100);
  const afterDisc  = subtotal - discAmt;
  const svcAmt     = (order.serviceCharge || 0);
  const taxAmt     = afterDisc * (taxRate / 100);
  const grandTotal = afterDisc + svcAmt + taxAmt;
  const amountPaid = order.amountPaid || grandTotal;
  const change     = amountPaid - grandTotal;

  const fmt = (n) => `${currency} ${Number(n || 0).toFixed(2)}`;

  const chunks = [
    INIT,
    ALIGN_CENTER,
    DOUBLE_SIZE_ON,
    text(hotelName.toUpperCase()),
    DOUBLE_SIZE_OFF,
  ];

  if (headerLine2) {
    chunks.push(text(headerLine2));
  }

  chunks.push(
    LINE_FEED,
    text('* RECEIPT *'),
    ALIGN_LEFT,
    text(divider('=', W)),
    text(twoCol('Receipt #:', order.orderNo || '--', W)),
    text(twoCol('Date:', dateStr, W)),
    text(twoCol('Time:', timeStr, W)),
  );

  if (order.tableNo) {
    chunks.push(text(twoCol('Table:', order.tableNo, W)));
  }
  if (order.waiterName) {
    chunks.push(text(twoCol('Server:', order.waiterName, W)));
  }
  if (order.customerName && order.customerName !== 'Walk-in Guest') {
    chunks.push(text(twoCol('Guest:', order.customerName, W)));
  }

  chunks.push(
    text(divider('-', W)),
    BOLD_ON,
    text(padEnd('ITEM', W - 20) + padEnd('QTY', 5) + padEnd('PRICE', 8) + 'TOTAL'),
    BOLD_OFF,
    text(divider('-', W)),
  );

  (order.items || []).forEach((item) => {
    const name  = String(item.productName || item.name || '').slice(0, W - 20);
    const qty   = String(item.quantity || 1);
    const price = fmt(item.unitPrice).slice(-8);
    const total = fmt(item.quantity * item.unitPrice).slice(-8);
    chunks.push(text(padEnd(name, W - 20) + padEnd(`x${qty}`, 5) + padEnd(price, 8) + total));
  });

  chunks.push(text(divider('-', W)));

  if (discAmt > 0) {
    chunks.push(text(twoCol(`Discount (${order.discountPercent}%):`, `-${fmt(discAmt)}`, W)));
  }
  if (svcAmt > 0) {
    chunks.push(text(twoCol('Service Charge:', fmt(svcAmt), W)));
  }
  chunks.push(
    text(twoCol(`Tax (${taxRate}%):`, fmt(taxAmt), W)),
    text(divider('=', W)),
    BOLD_ON,
    DOUBLE_HEIGHT_ON,
    text(twoCol('TOTAL:', fmt(grandTotal), W)),
    DOUBLE_HEIGHT_OFF,
    BOLD_OFF,
    text(divider('-', W)),
    text(twoCol('Payment:', order.paymentMethod || 'Cash', W)),
    text(twoCol('Paid:', fmt(amountPaid), W)),
  );

  if (change > 0) {
    chunks.push(text(twoCol('Change:', fmt(change), W)));
  }

  chunks.push(
    text(divider('=', W)),
    ALIGN_CENTER,
    LINE_FEED,
    text(footerLine),
    LINE_FEED,
    text(`Printed: ${dateStr} ${timeStr}`),
    LINE_FEED,
    FEED_5,
    CUT_FULL,
  );

  return Buffer.concat(chunks);
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAIN-TEXT / PCL MODE  –  for HP LaserJet, Lexmark, and other PCL printers
//
// These functions produce clean ASCII text with basic PCL header/footer.
// Send over TCP port 9100 (RAW mode) — works on any HP LaserJet network printer.
// HP LaserJet M402dne default RAW port: 9100
// ─────────────────────────────────────────────────────────────────────────────

// PCL escape sequences for laser printers
const PCL_RESET   = '\x1bE';           // PCL printer reset
const PCL_LF      = '\n';             // line feed
const PCL_FF      = '\x0c';           // form feed (eject page)
// Set font size 12pt, portrait, letter/A4
const PCL_SETUP   = '\x1b&l0O\x1b(s12V\x1b&k2G';

/**
 * Build plain-text KOT for HP LaserJet / PCL laser printers.
 * Outputs clean ASCII; no binary ESC/POS sequences.
 */
function buildKOT_plain(order, opts = {}) {
  const W = 60; // wider for laser/letter page
  const businessName = opts.businessName || 'KITCHEN ORDER';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-ET');

  const lines = [];
  lines.push(PCL_RESET + PCL_SETUP);
  lines.push('');
  lines.push('='.repeat(W));
  lines.push(center('** KITCHEN ORDER TICKET **', W));
  lines.push(center(businessName.toUpperCase(), W));
  lines.push('='.repeat(W));
  lines.push(twoCol('Order #:', order.orderNo || '--', W));
  lines.push(twoCol('Type:', (order.orderType || 'dine_in').replace('_', ' ').toUpperCase(), W));
  if (order.tableNo)    lines.push(twoCol('Table:', order.tableNo, W));
  if (order.waiterName) lines.push(twoCol('Waiter:', order.waiterName, W));
  if (order.customerName && order.customerName !== 'Walk-in Guest')
    lines.push(twoCol('Customer:', order.customerName, W));
  lines.push(twoCol('Date:', dateStr, W));
  lines.push(twoCol('Time:', timeStr, W));
  lines.push('-'.repeat(W));
  lines.push(padEnd('ITEM', W - 10) + padEnd('QTY', 5) + 'NOTE');
  lines.push('-'.repeat(W));

  (order.items || []).forEach(item => {
    const name = String(item.productName || item.name || '').slice(0, W - 14);
    const qty  = `x${item.quantity || 1}`;
    const note = String(item.notes || '');
    lines.push(padEnd(name, W - 14) + padEnd(qty, 6) + note);
    if (item.notes) lines.push(`    >> ${item.notes}`);
  });

  lines.push('='.repeat(W));
  lines.push(center('** PREPARE IMMEDIATELY **', W));
  lines.push('');
  lines.push('');
  lines.push(PCL_FF); // eject page

  return Buffer.from(lines.join(PCL_LF), 'utf8');
}

/**
 * Build plain-text customer receipt for HP LaserJet / PCL laser printers.
 */
function buildReceipt_plain(order, opts = {}) {
  const W = 60;
  const hotelName  = opts.hotelName  || 'Baba Roti Café';
  const footerLine = opts.footerLine || 'Thank you! Come again.';
  const taxRate    = opts.taxRate ?? 15;
  const currency   = opts.currency || 'ETB';

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-ET');
  const timeStr = now.toLocaleTimeString('en-ET', { hour: '2-digit', minute: '2-digit' });

  const subtotal  = (order.items || []).reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
  const discAmt   = subtotal * ((order.discountPercent || 0) / 100);
  const afterDisc = subtotal - discAmt;
  const svcAmt    = order.serviceCharge || 0;
  const taxAmt    = afterDisc * (taxRate / 100);
  const grandTotal = afterDisc + svcAmt + taxAmt;
  const amountPaid = order.amountPaid || grandTotal;
  const change    = amountPaid - grandTotal;
  const fmt = (n) => `${currency} ${Number(n || 0).toFixed(2)}`;

  const lines = [];
  lines.push(PCL_RESET + PCL_SETUP);
  lines.push('');
  lines.push(center('='.repeat(W), W));
  lines.push(center(hotelName.toUpperCase(), W));
  lines.push(center('CUSTOMER RECEIPT', W));
  lines.push('='.repeat(W));
  lines.push(twoCol('Receipt #:', order.orderNo || '--', W));
  lines.push(twoCol('Date:', dateStr, W));
  lines.push(twoCol('Time:', timeStr, W));
  if (order.tableNo)   lines.push(twoCol('Table:', order.tableNo, W));
  if (order.waiterName) lines.push(twoCol('Server:', order.waiterName, W));
  if (order.customerName && order.customerName !== 'Walk-in Guest')
    lines.push(twoCol('Guest:', order.customerName, W));

  lines.push('-'.repeat(W));
  lines.push(padEnd('ITEM', W - 24) + padEnd('QTY', 5) + padEnd('PRICE', 10) + 'TOTAL');
  lines.push('-'.repeat(W));

  (order.items || []).forEach(item => {
    const name  = String(item.productName || item.name || '').slice(0, W - 24);
    const qty   = `x${item.quantity || 1}`;
    const price = fmt(item.unitPrice);
    const total = fmt(item.quantity * item.unitPrice);
    lines.push(padEnd(name, W - 24) + padEnd(qty, 5) + padEnd(price, 10) + total);
  });

  lines.push('-'.repeat(W));
  if (discAmt > 0)
    lines.push(twoCol(`Discount (${order.discountPercent}%):`, `-${fmt(discAmt)}`, W));
  if (svcAmt > 0)
    lines.push(twoCol('Service Charge:', fmt(svcAmt), W));
  lines.push(twoCol(`Tax (${taxRate}%):`, fmt(taxAmt), W));
  lines.push('='.repeat(W));
  lines.push(twoCol('TOTAL:', fmt(grandTotal), W));
  lines.push('-'.repeat(W));
  lines.push(twoCol('Payment:', order.paymentMethod || 'Cash', W));
  lines.push(twoCol('Paid:', fmt(amountPaid), W));
  if (change > 0) lines.push(twoCol('Change:', fmt(change), W));
  lines.push('='.repeat(W));
  lines.push('');
  lines.push(center(footerLine, W));
  lines.push(center(`Printed: ${dateStr} ${timeStr}`, W));
  lines.push('');
  lines.push('');
  lines.push(PCL_FF); // eject page

  return Buffer.from(lines.join(PCL_LF), 'utf8');
}

/** Center a string within a given width */
function center(str, width) {
  const s = String(str || '');
  if (s.length >= width) return s;
  const pad = Math.floor((width - s.length) / 2);
  return ' '.repeat(pad) + s;
}

module.exports = { buildKOT, buildReceipt, OPEN_DRAWER, buildKOT_plain, buildReceipt_plain };
