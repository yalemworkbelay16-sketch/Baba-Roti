/**
 * POS Thermal Receipt & Ticket Print Engine
 * Injects a hidden iframe and triggers browser print optimized for 80mm / 58mm thermal printers.
 * Works seamlessly across cloud (AletCloud) and local environments.
 */

export function printThermalReceipt(order, { hotelName = 'Baba Roti Café', address = 'Addis Ababa, Ethiopia', phone = '+251 911 000 111', isReprint = false } = {}) {
  const dateStr = new Date(order.createdAt || Date.now()).toLocaleString('en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${order.orderNo}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      font-size: 12px;
      line-height: 1.35;
      color: #000;
      background: #fff;
      width: 78mm;
      max-width: 78mm;
      margin: 0 auto;
      padding: 8px 4px 20px 4px;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .bold { font-weight: bold; }
    .reprint-banner {
      border: 2px dashed #000;
      font-weight: bold;
      font-size: 13px;
      padding: 4px;
      margin-bottom: 8px;
      text-align: center;
      letter-spacing: 1px;
    }
    .header h2 { font-size: 17px; font-weight: 900; margin-bottom: 2px; text-transform: uppercase; }
    .header p { font-size: 11px; }
    .divider { border-top: 1px dashed #000; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 6px 0; }
    .meta-table { width: 100%; font-size: 11px; margin-bottom: 4px; }
    .meta-table td { padding: 1px 0; }
    .items-table { width: 100%; font-size: 11px; border-collapse: collapse; }
    .items-table th { border-bottom: 1px solid #000; padding: 3px 0; font-size: 10px; text-transform: uppercase; }
    .items-table td { padding: 3px 0; vertical-align: top; }
    .item-notes { font-size: 10px; font-style: italic; padding-left: 8px; color: #333; }
    .totals-table { width: 100%; font-size: 12px; margin-top: 4px; }
    .totals-table td { padding: 2px 0; }
    .grand-total { font-size: 15px; font-weight: 900; }
    .footer { margin-top: 12px; text-align: center; font-size: 10px; }
    @media print {
      body { width: 100%; margin: 0; padding: 4px; }
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
      <td class="bold">Order #: ${order.orderNo}</td>
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
      ${(order.items || []).map(it => `
        <tr>
          <td class="text-left bold">${it.productName}</td>
          <td class="text-center">${it.quantity}</td>
          <td class="text-right">${Number(it.unitPrice).toFixed(2)}</td>
          <td class="text-right bold">${Number(it.totalPrice).toFixed(2)}</td>
        </tr>
        ${it.notes ? `<tr><td colspan="4" class="item-notes">↳ Note: ${it.notes}</td></tr>` : ''}
      `).join('')}
    </tbody>
  </table>

  <div class="divider"></div>

  <table class="totals-table">
    <tr>
      <td>Subtotal:</td>
      <td class="text-right">ETB ${Number(order.subtotal || 0).toFixed(2)}</td>
    </tr>
    ${order.discountAmount > 0 ? `
    <tr>
      <td>Discount ${order.discountPercent ? `(${order.discountPercent}%)` : ''}:</td>
      <td class="text-right">-ETB ${Number(order.discountAmount).toFixed(2)}</td>
    </tr>` : ''}
    ${order.taxAmount > 0 ? `
    <tr>
      <td>VAT / Tax (${order.taxPercent || 15}%):</td>
      <td class="text-right">ETB ${Number(order.taxAmount).toFixed(2)}</td>
    </tr>` : ''}
    ${order.serviceCharge > 0 ? `
    <tr>
      <td>Service Charge:</td>
      <td class="text-right">ETB ${Number(order.serviceCharge).toFixed(2)}</td>
    </tr>` : ''}
    <tr class="grand-total double-divider">
      <td style="padding-top:4px;">TOTAL:</td>
      <td class="text-right" style="padding-top:4px;">ETB ${Number(order.grandTotal || 0).toFixed(2)}</td>
    </tr>
    <tr>
      <td style="padding-top:4px;">Payment Method:</td>
      <td class="text-right bold" style="padding-top:4px;">${order.paymentMethod || 'Cash'}</td>
    </tr>
    ${order.paymentMethod === 'Cash' && order.amountPaid > 0 ? `
    <tr>
      <td>Cash Tendered:</td>
      <td class="text-right">ETB ${Number(order.amountPaid).toFixed(2)}</td>
    </tr>
    <tr>
      <td>Change Due:</td>
      <td class="text-right bold">ETB ${Number(order.changeDue || 0).toFixed(2)}</td>
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

  executePrint(html, `receipt_${order.orderNo}`);
}

/**
 * Print Kitchen Order Ticket (KOT) or Barista Ticket
 * Automatically filters items to target station
 */
export function printStationTicket(order, targetStation = 'kitchen', { isReprint = false } = {}) {
  const stationTitle = targetStation === 'barista' ? 'BARISTA DRINK TICKET' : 'KITCHEN ORDER TICKET';
  const stationColor = targetStation === 'barista' ? '#0d2d80' : '#881337';

  const stationItems = (order.items || []).filter(item => {
    if (targetStation === 'barista') return item.station === 'barista';
    return item.station !== 'barista'; // kitchen & general items
  });

  if (stationItems.length === 0) {
    return false; // nothing to print for this station
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
  <title>${stationTitle} - ${order.orderNo}</title>
  <style>
    @page { margin: 0; size: 80mm auto; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Courier New', Courier, monospace, sans-serif;
      color: #000;
      background: #fff;
      width: 78mm;
      max-width: 78mm;
      margin: 0 auto;
      padding: 8px 4px 20px 4px;
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
    .header h1 { font-size: 16px; font-weight: 900; letter-spacing: 1px; }
    .order-meta { margin: 6px 0; font-size: 12px; }
    .order-meta td { padding: 2px 0; }
    .bold { font-weight: 900; }
    .large { font-size: 16px; }
    .items-table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 13px; }
    .items-table th { border-top: 2px solid #000; border-bottom: 2px solid #000; padding: 4px 0; text-align: left; font-size: 11px; }
    .items-table td { padding: 6px 0; border-bottom: 1px dashed #777; vertical-align: top; }
    .qty-cell { font-size: 17px; font-weight: 900; width: 18%; text-align: center; }
    .name-cell { font-size: 14px; font-weight: 900; }
    .item-notes { font-size: 12px; font-weight: bold; background: #eee; padding: 2px 4px; border-radius: 3px; margin-top: 3px; display: inline-block; }
    .footer { margin-top: 14px; text-align: center; font-size: 11px; border-top: 1px solid #000; padding-top: 6px; }
  </style>
</head>
<body>
  ${isReprint ? '<div class="reprint-banner">*** REPRINT / DUPLICATE ***</div>' : ''}
  <div class="header">
    <h1>*** ${stationTitle} ***</h1>
    <p style="font-size: 11px; margin-top: 2px;">Baba Roti Café</p>
  </div>

  <table class="order-meta" style="width: 100%;">
    <tr>
      <td class="bold large">ORDER: ${order.orderNo}</td>
      <td style="text-align: right;" class="bold large">${order.tableNo ? `TABLE ${order.tableNo}` : order.orderType?.toUpperCase()}</td>
    </tr>
    <tr>
      <td>Time: ${timeStr}</td>
      <td style="text-align: right;">Cashier: ${order.cashierName || 'Staff'}</td>
    </tr>
  </table>

  <table class="items-table">
    <thead>
      <tr>
        <th style="width: 18%; text-align: center;">QTY</th>
        <th style="width: 82%;">ITEM & INSTRUCTIONS</th>
      </tr>
    </thead>
    <tbody>
      ${stationItems.map(it => `
        <tr>
          <td class="qty-cell">${it.quantity}X</td>
          <td class="name-cell">
            ${it.productName}
            ${it.notes ? `<div class="item-notes">⚠ NOTE: ${it.notes}</div>` : ''}
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <p>TOTAL ITEMS FOR ${targetStation.toUpperCase()}: ${stationItems.reduce((s, i) => s + (Number(i.quantity) || 1), 0)}</p>
  </div>
</body>
</html>`;

  executePrint(html, `kot_${targetStation}_${order.orderNo}`);
  return true;
}

/**
 * Executes iframe-based thermal print without page redirects
 */
function executePrint(html, frameId = 'pos_print_frame') {
  const existingFrame = document.getElementById(frameId);
  if (existingFrame) existingFrame.remove();

  const iframe = document.createElement('iframe');
  iframe.id = frameId;
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none;z-index:-9999;';
  document.body.appendChild(iframe);

  let hasPrinted = false;
  const triggerPrint = () => {
    if (hasPrinted) return;
    hasPrinted = true;
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
    } catch (err) {
      console.error('Print execution error:', err);
    } finally {
      setTimeout(() => {
        try { iframe.remove(); } catch (_) { }
      }, 3000);
    }
  };

  iframe.onload = () => setTimeout(triggerPrint, 150);

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  // Guarantees print dialog pops even if onload doesn't fire on dynamic iframe
  setTimeout(triggerPrint, 250);
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

