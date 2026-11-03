/**
 * POS Thermal Receipt & Ticket Print Engine
 * High-reliability browser print engine optimized for 80mm / 58mm thermal rolls and A4 printers.
 * Works seamlessly across cloud (Aletcloud) and local environments.
 */

export function printThermalReceipt(order, { hotelName = 'Baba Roti Café', address = 'Addis Ababa, Ethiopia', phone = '+251 911 000 111', isReprint = false } = {}) {
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const orderNumber = order.orderNo || order.saleNo || order.reference || `ORD-${Date.now().toString().slice(-4)}`;
  const orderItems = order.items || [];
  const subtotal = Number(order.subtotal != null ? order.subtotal : orderItems.reduce((s, i) => s + (Number(i.unitPrice || 0) * Number(i.quantity || 1)), 0));
  const discountAmount = Number(order.discountAmount || 0);
  const taxAmount = Number(order.taxAmount || 0);
  const serviceCharge = Number(order.serviceCharge || 0);
  const grandTotal = Number(order.grandTotal != null ? order.grandTotal : order.totalAmount != null ? order.totalAmount : (subtotal - discountAmount + taxAmount + serviceCharge));
  const amountPaid = Number(order.amountPaid != null ? order.amountPaid : grandTotal);
  const changeDue = Number(order.changeDue != null ? order.changeDue : Math.max(0, amountPaid - grandTotal));
  const paymentMethod = order.paymentMethod || 'Cash';

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${orderNumber}</title>
  <style>
    @page { margin: 4mm auto; size: auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace, 'Segoe UI', sans-serif;
      font-size: 13px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 6px 4px 20px 4px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: 900; }
    .reprint-banner {
      border: 2px dashed #000;
      font-weight: 900;
      font-size: 13px;
      padding: 4px;
      margin-bottom: 8px;
      text-align: center;
      letter-spacing: 1px;
    }
    .header h2 { font-size: 18px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    .header p { font-size: 11px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .meta-table { width: 100%; font-size: 11px; margin-bottom: 4px; }
    .meta-table td { padding: 1.5px 0; }
    .items-table { width: 100%; font-size: 12px; border-collapse: collapse; }
    .items-table th { border-bottom: 1px solid #000; padding: 4px 0; font-size: 10px; text-transform: uppercase; }
    .items-table td { padding: 4px 0; vertical-align: top; }
    .item-notes { font-size: 11px; font-style: italic; padding-left: 8px; color: #222; }
    .totals-table { width: 100%; font-size: 12px; margin-top: 4px; }
    .totals-table td { padding: 2px 0; }
    .grand-total { font-size: 16px; font-weight: 900; }
    .footer { margin-top: 12px; text-align: center; font-size: 10px; }
    @media print {
      body { width: 100%; margin: 0 auto; padding: 4px; }
    }
  </style>
</head>
<body>
  ${isReprint ? '<div class="reprint-banner">*** DUPLICATE REPRINT ***</div>' : ''}
  <div class="header text-center">
    <h2>${hotelName}</h2>
    <p>Bakery, Coffee & Restaurant</p>
    <p>${address}</p>
    <p>Tel: ${phone}</p>
  </div>

  <div class="divider"></div>

  <table class="meta-table">
    <tr>
      <td class="bold">Receipt #: ${orderNumber}</td>
      <td class="text-right bold">${order.orderType?.toUpperCase() || 'DINE IN'}</td>
    </tr>
    <tr>
      <td>Date: ${dateStr}</td>
      <td class="text-right">${order.tableNo ? `Table: ${order.tableNo}` : ''}</td>
    </tr>
    <tr>
      <td>Cashier: ${order.cashierName || 'Staff'}</td>
      <td class="text-right">${order.customerName || 'Guest'}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="text-left" style="width: 50%;">Item</th>
        <th class="text-center" style="width: 15%;">Qty</th>
        <th class="text-right" style="width: 15%;">Price</th>
        <th class="text-right" style="width: 20%;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${orderItems.map(it => {
        const qty = Number(it.quantity || 1);
        const price = Number(it.unitPrice || 0);
        const lineTot = Number(it.totalPrice != null ? it.totalPrice : (qty * price));
        return `
        <tr>
          <td class="text-left bold">${it.productName || 'Item'}</td>
          <td class="text-center">${qty}</td>
          <td class="text-right">${price.toFixed(2)}</td>
          <td class="text-right bold">${lineTot.toFixed(2)}</td>
        </tr>
        ${it.notes ? `<tr><td colspan="4" class="item-notes">↳ Note: ${it.notes}</td></tr>` : ''}
        `;
      }).join('')}
    </tbody>
  </table>

  <div class="divider"></div>

  <table class="totals-table">
    <tr>
      <td>Subtotal:</td>
      <td class="text-right">ETB ${subtotal.toFixed(2)}</td>
    </tr>
    ${discountAmount > 0 ? `
    <tr>
      <td>Discount ${order.discountPercent ? `(${order.discountPercent}%)` : ''}:</td>
      <td class="text-right">-ETB ${discountAmount.toFixed(2)}</td>
    </tr>` : ''}
    ${taxAmount > 0 ? `
    <tr>
      <td>VAT / Tax (${order.taxPercent || 15}%):</td>
      <td class="text-right">ETB ${taxAmount.toFixed(2)}</td>
    </tr>` : ''}
    ${serviceCharge > 0 ? `
    <tr>
      <td>Service Charge:</td>
      <td class="text-right">ETB ${serviceCharge.toFixed(2)}</td>
    </tr>` : ''}
    <tr class="grand-total double-divider">
      <td style="padding-top:4px;">TOTAL:</td>
      <td class="text-right" style="padding-top:4px;">ETB ${grandTotal.toFixed(2)}</td>
    </tr>
    <tr>
      <td style="padding-top:4px;">Payment Method:</td>
      <td class="text-right bold" style="padding-top:4px;">${paymentMethod}</td>
    </tr>
    ${paymentMethod.toLowerCase() === 'cash' && amountPaid > 0 ? `
    <tr>
      <td>Cash Tendered:</td>
      <td class="text-right">ETB ${amountPaid.toFixed(2)}</td>
    </tr>
    <tr>
      <td>Change Due:</td>
      <td class="text-right bold">ETB ${changeDue.toFixed(2)}</td>
    </tr>` : ''}
  </table>

  <div class="divider"></div>

  <div class="footer">
    <p class="bold">THANK YOU FOR YOUR VISIT!</p>
    <p>Please come again.</p>
    <p style="margin-top: 4px; font-size: 9px; opacity: 0.7;">Powered by Baba Roti POS</p>
  </div>
</body>
</html>`;

  executePrint(html, `receipt_${orderNumber}`);
}

/**
 * Print Kitchen Order Ticket (KOT) or Barista Ticket
 */
export function printStationTicket(order, targetStation = 'kitchen', { isReprint = false, businessName = 'Baba Roti Café' } = {}) {
  const stationTitle = targetStation === 'barista' ? 'BARISTA DRINK TICKET' : 'KITCHEN ORDER TICKET';
  const orderNumber = order.orderNo || order.saleNo || order.reference || `ORD-${Date.now().toString().slice(-4)}`;

  const allItems = order.items || [];
  const stationItems = allItems.filter(item => {
    if (targetStation === 'barista') return item.station === 'barista';
    // If kitchen, include kitchen items and anything without explicit barista station
    return item.station !== 'barista';
  });

  // If filtered items is empty but station is kitchen, fallback to printing all items
  const itemsToPrint = stationItems.length > 0 ? stationItems : (targetStation === 'kitchen' ? allItems : []);
  if (itemsToPrint.length === 0) {
    return false;
  }

  const timeStr = new Date(order.createdAt || Date.now()).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${stationTitle} - ${orderNumber}</title>
  <style>
    @page { margin: 4mm auto; size: auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace, 'Segoe UI', sans-serif;
      color: #000;
      background: #fff;
      width: 100%;
      max-width: 80mm;
      margin: 0 auto;
      padding: 6px 4px 20px 4px;
    }
    .reprint-banner {
      border: 2px dashed #000;
      font-weight: 900;
      font-size: 14px;
      padding: 4px;
      margin-bottom: 8px;
      text-align: center;
      letter-spacing: 1px;
    }
    .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; }
    .header h1 { font-size: 18px; font-weight: 900; letter-spacing: 1px; }
    .order-meta { margin: 6px 0; font-size: 12px; }
    .order-meta td { padding: 2px 0; }
    .bold { font-weight: 900; }
    .large { font-size: 16px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 14px; }
    .items-table th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; text-align: left; font-size: 11px; }
    .items-table td { padding: 6px 0; border-bottom: 1px dashed #777; vertical-align: top; }
    .qty-cell { font-size: 18px; font-weight: 900; width: 22%; text-align: center; }
    .name-cell { font-size: 15px; font-weight: 900; line-height: 1.3; }
    .item-notes { font-size: 12px; font-weight: bold; background: #eee; padding: 2px 4px; border-radius: 3px; margin-top: 3px; display: inline-block; }
    .footer { margin-top: 14px; text-align: center; font-size: 11px; border-top: 1px solid #000; padding-top: 6px; }
    @media print {
      body { width: 100%; margin: 0 auto; padding: 4px; }
    }
  </style>
</head>
<body>
  ${isReprint ? '<div class="reprint-banner">*** REPRINT / DUPLICATE ***</div>' : ''}
  <div class="header">
    <h1>*** ${stationTitle} ***</h1>
    <p style="font-size: 12px; margin-top: 2px; font-weight: bold;">${businessName}</p>
  </div>

  <table class="order-meta" style="width: 100%;">
    <tr>
      <td class="bold large">ORDER: ${orderNumber}</td>
      <td style="text-align: right;" class="bold large">${order.tableNo ? `TABLE ${order.tableNo}` : (order.orderType?.toUpperCase() || 'DINE IN')}</td>
    </tr>
    <tr>
      <td>Time: ${timeStr}</td>
      <td style="text-align: right;">Waiter: ${order.waiterName || order.cashierName || 'Staff'}</td>
    </tr>
    ${order.customerName && order.customerName !== 'Guest' ? `
    <tr>
      <td colspan="2">Customer: <strong>${order.customerName}</strong></td>
    </tr>` : ''}
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 22%; text-align: center;">QTY</th>
        <th style="width: 78%;">ITEM &amp; SPECIAL NOTES</th>
      </tr>
    </thead>
    <tbody>
      ${itemsToPrint.map(it => `
        <tr>
          <td class="qty-cell">${it.quantity || 1}X</td>
          <td class="name-cell">
            ${it.productName || 'Item'}
            ${it.notes ? `<div class="item-notes">⚠ NOTE: ${it.notes}</div>` : ''}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p class="bold">TOTAL ITEMS: ${itemsToPrint.reduce((s, i) => s + (Number(i.quantity) || 1), 0)}</p>
  </div>
</body>
</html>`;

  executePrint(html, `kot_${targetStation}_${orderNumber}`);
  return true;
}

/**
 * Robust cross-browser execution engine.
 * Renders into an offscreen element and triggers print without popup blockers or blank sheets.
 */
function executePrint(html, frameId = 'pos_print_frame') {
  try {
    const existing = document.getElementById(frameId);
    if (existing) existing.remove();

    const iframe = document.createElement('iframe');
    iframe.id = frameId;
    // Offscreen renderable area — Chromium requires real dimensions to render and allow print()
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '-9999px';
    iframe.style.width = '350px';
    iframe.style.height = '600px';
    iframe.style.border = 'none';
    iframe.style.zIndex = '-9999';
    document.body.appendChild(iframe);

    let hasPrinted = false;
    const doPrint = () => {
      if (hasPrinted) return;
      hasPrinted = true;
      try {
        if (iframe.contentWindow) {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        }
      } catch (printErr) {
        console.warn('Iframe print error, falling back to popup window:', printErr);
        openPopupPrint(html);
      } finally {
        setTimeout(() => {
          try { iframe.remove(); } catch (_) {}
        }, 30000); // 30s cleanup
      }
    };

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(doPrint, 200);
    } else {
      openPopupPrint(html);
    }
  } catch (err) {
    console.error('executePrint exception:', err);
    openPopupPrint(html);
  }
}

function openPopupPrint(html) {
  try {
    const w = window.open('', '_blank', 'width=450,height=600');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
        setTimeout(() => w.close(), 2000);
      }, 250);
    }
  } catch (_) {}
}

export const posPrint = {
  printReceipt: printThermalReceipt,
  printKitchen: (order, opts) => printStationTicket(order, 'kitchen', opts),
  printBarista: (order, opts) => printStationTicket(order, 'barista', opts),
  printKOT: (order, opts) => {
    printStationTicket(order, 'kitchen', opts);
    const hasBarista = (order.items || []).some(i => i.station === 'barista');
    if (hasBarista) {
      setTimeout(() => printStationTicket(order, 'barista', opts), 300);
    }
  },
};

export default posPrint;
