/**
 * Baba Roti  Café— Telegram Notification Service
 * ─────────────────────────────────────────────────────────────────
 * Sends richly-formatted HTML messages to a Telegram bot/channel
 * whenever a meaningful CRUD event occurs in the system.
 *
 * Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in your .env file.
 * If either is missing the module silently no-ops (safe for dev).
 */

const https = require('https');
const Setting = require('../models/Setting');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8849417539:AAFXg2njcRGhnq8EPTtHusuEVuur5qqVzAk';
// Default verified hotel admin & management Telegram chat IDs
const DEFAULT_FALLBACK_CHAT_IDS = ['7951472080', '1286578760'];
// Fallback: env-var chat IDs (used if DB has no subscribers yet)
const ENV_CHAT_IDS = (process.env.TELEGRAM_CHAT_ID || '7951472080,1286578760')
  .split(',')
  .map(id => id.trim())
  .filter(id => id && id !== 'your_chat_id_here' && id !== 'null' && id !== 'undefined');
const HOTEL = 'Baba Roti Café';

function cleanChatId(id) {
  if (!id) return null;
  const s = String(id).trim();
  if (!s || s === 'null' || s === 'undefined' || s === 'your_chat_id_here') return null;
  return s;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ── Low-level sender ─────────────────────────────────────────────
async function getChatIds() {
  try {
    const User = require('../models/User');
    const [settings, inactiveUsers, activeStaff] = await Promise.all([
      Setting.findOne().select('telegramSubscribers').lean(),
      User.find({ isActive: false }).select('telegramChatId phone email name').lean(),
      User.find({ isActive: { $ne: false }, telegramChatId: { $exists: true, $ne: '' } }).select('telegramChatId').lean(),
    ]);

    // Build blocklists from disabled/deactivated accounts
    const blockedChatIds = new Set(
      (inactiveUsers || [])
        .map(u => cleanChatId(u.telegramChatId))
        .filter(Boolean)
    );
    const blockedPhones = new Set(
      (inactiveUsers || [])
        .map(u => (u.phone || '').replace(/\D/g, '').slice(-9))
        .filter(Boolean)
    );
    const blockedEmails = new Set(
      (inactiveUsers || [])
        .map(u => (u.email || '').toLowerCase().trim())
        .filter(Boolean)
    );

    const validSubscribers = (settings?.telegramSubscribers || []).filter(s => {
      const cId = cleanChatId(s.chatId);
      const sPhone = (s.phone || '').replace(/\D/g, '').slice(-9);
      const sUser = (s.username || '').toLowerCase().trim();
      const sName = (s.name || '').toLowerCase().trim();

      if (cId && blockedChatIds.has(cId)) return false;
      if (sPhone && blockedPhones.has(sPhone)) return false;
      if (sUser && blockedEmails.has(sUser)) return false;
      if (sName && blockedEmails.has(sName)) return false;
      return true;
    });

    const dbIds = validSubscribers
      .map(s => cleanChatId(s.chatId))
      .filter(Boolean);

    // Active staff members with configured telegramChatId
    const staffIds = (activeStaff || [])
      .map(u => cleanChatId(u.telegramChatId))
      .filter(id => id && !blockedChatIds.has(id));

    const all = [...new Set([...dbIds, ...staffIds, ...ENV_CHAT_IDS, ...DEFAULT_FALLBACK_CHAT_IDS])];
    // Ensure no blocked chat ID gets messages and no invalid values
    return all.filter(id => id && id !== 'null' && id !== 'undefined' && !blockedChatIds.has(String(id)));
  } catch (err) {
    console.warn('[Telegram] Chat IDs fetch error:', err.message);
    return [...new Set([...ENV_CHAT_IDS, ...DEFAULT_FALLBACK_CHAT_IDS])].filter(
      id => id && id !== 'null' && id !== 'undefined'
    );
  }
}

function sendToOne(chatId, text) {
  const cleanId = cleanChatId(chatId);
  if (!cleanId) return;

  const body = JSON.stringify({
    chat_id: cleanId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  });

  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${BOT_TOKEN}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };

  const req = https.request(options, (res) => {
    if (res.statusCode !== 200) {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => console.warn(`[Telegram] Non-200 for chat ${cleanId}:`, data));
    }
  });
  req.on('error', (err) => console.warn(`[Telegram] Send error to ${cleanId}:`, err.message));
  req.write(body);
  req.end();
}

function sendTelegram(text) {
  if (!BOT_TOKEN || BOT_TOKEN === 'your_bot_token_here') return;
  // Fire-and-forget async
  getChatIds().then(ids => {
    if (!ids || !ids.length) return;
    ids.forEach(id => sendToOne(id, text));
  }).catch((err) => {
    console.warn('[Telegram] Dispatch error:', err.message);
  });
}

// ── Timestamp helper ─────────────────────────────────────────────
function now() {
  return new Date().toLocaleString('en-US', {
    timeZone: 'Africa/Addis_Ababa',
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── ETB formatter ────────────────────────────────────────────────
function etb(n) {
  return `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ═══════════════════════════════════════════════════════════════
//  PUBLIC NOTIFICATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════

// ── AUTH ────────────────────────────────────────────────────────

/** User logged in */
function notifyLogin(user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🔐 <b>USER LOGIN</b>

👤 <b>Name:</b>  ${user.name}
📧 <b>Email:</b> ${user.email}
🎭 <b>Role:</b>  ${user.role.toUpperCase()}
🕐 <b>Time:</b>  ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** New staff account created */
function notifyUserCreated(newUser, createdBy) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
👥 <b>NEW STAFF ACCOUNT</b>

👤 <b>Name:</b>       ${newUser.name}
📧 <b>Email:</b>      ${newUser.email}
🎭 <b>Role:</b>       ${newUser.role.toUpperCase()}
🛠 <b>Created by:</b> ${createdBy || 'System'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Staff account status changed (enabled / disabled) */
function notifyUserStatusChanged(user, status, actor) {
  const isEnabled = status === 'enabled';
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${isEnabled ? '✅' : '🔒'} <b>STAFF ACCOUNT ${isEnabled ? 'ENABLED' : 'DISABLED'}</b>

👤 <b>Staff:</b>      ${user.name}
📧 <b>Email:</b>      ${user.email}
🎭 <b>Role:</b>       ${(user.role || '').toUpperCase()}
⚡ <b>Status:</b>     ${isEnabled ? 'Active (Subscribed)' : 'Disabled (Notifications Stopped)'}
🛠 <b>Action by:</b>  ${actor?.name || 'Admin'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Staff account deleted / removed */
function notifyUserDeleted(user, actor) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>STAFF ACCOUNT REMOVED</b>

👤 <b>Staff:</b>      ${user.name}
📧 <b>Email:</b>      ${user.email}
🎭 <b>Role:</b>       ${(user.role || '').toUpperCase()}
🔕 <b>Telegram:</b>   Subscription Removed & Notifications Stopped
🛠 <b>Removed by:</b> ${actor?.name || 'Admin'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Staff role changed */
function notifyUserRoleChanged(user, oldRole, newRole, actor) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🎭 <b>STAFF ROLE CHANGED</b>

👤 <b>Staff:</b>      ${user.name}
📧 <b>Email:</b>      ${user.email}
🔄 <b>Role:</b>       ${oldRole.toUpperCase()} → <b>${newRole.toUpperCase()}</b>
🛠 <b>Changed by:</b> ${actor?.name || 'Admin'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── STOCK TRANSACTIONS ───────────────────────────────────────────

const VOUCHER_EMOJI = {
  cash_grv: '💵',
  credit_grv: '🏦',
  fresh_bazaar: '🌿',
  pos_adjustment: '📈',
  neg_adjustment: '📉',
  disposal: '🗑️',
  sales_import: '📥',
};

const VOUCHER_LABEL = {
  cash_grv: 'Cash GRV',
  credit_grv: 'Credit GRV',
  fresh_bazaar: 'Fresh Bazaar',
  pos_adjustment: 'Positive Adjustment',
  neg_adjustment: 'Negative Adjustment',
  disposal: 'Disposal',
  sales_import: 'Sales Import',
};

/** New stock transaction created */
function notifyTransaction(txn, user) {
  const emoji = VOUCHER_EMOJI[txn.voucherType] || '📦';
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;
  const direction = txn.type === 'in' ? '📥 IN' : '📤 OUT';

  const items = (txn.items || []).map(i =>
    `  • ${i.material?.name || '—'} × <b>${i.quantity}</b> ${i.material?.unit || ''} @ ${etb(i.unitCost)}`
  ).join('\n');

  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>NEW ${label.toUpperCase()}</b>

🔖 <b>Voucher No:</b>  ${txn.voucherNo || 'Auto'}
↕️  <b>Direction:</b>  ${direction}
🏪 <b>Supplier:</b>   ${txn.supplier?.name || '—'}
💰 <b>Total:</b>      ${etb(txn.totalAmount)}
📋 <b>Status:</b>     ${(txn.status || 'pending').toUpperCase()}

📦 <b>Items:</b>
${items || '  —'}

👤 <b>Recorded by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Transaction workflow advanced (check / approve / post / void) */
function notifyTransactionAdvanced(txn, action, by) {
  const actionEmoji = {
    check: '✅',
    approve: '🟣',
    post: '🟢',
    void: '🔴',
  };
  const emoji = actionEmoji[action] || '🔄';
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;

  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>VOUCHER ${action.toUpperCase()}ED</b>

🔖 <b>Voucher:</b> ${txn.voucherNo || txn._id?.toString().slice(-6)}
📄 <b>Type:</b>    ${label}
💰 <b>Total:</b>   ${etb(txn.totalAmount)}
📋 <b>Status:</b>  ${(txn.status || '').toUpperCase()}

👤 <b>By:</b>   ${by?.name || '—'} (${by?.role || ''})
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Transaction deleted / moved to recycle bin */
function notifyTransactionDeleted(txn, user) {
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>TRANSACTION DELETED</b>

🔖 <b>Voucher:</b> ${txn.voucherNo || '—'}
📄 <b>Type:</b>    ${label}
💰 <b>Total:</b>   ${etb(txn.totalAmount)}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── RAW MATERIALS ────────────────────────────────────────────────

/** Raw material created */
function notifyMaterialCreated(mat, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🧱 <b>NEW RAW MATERIAL</b>

🏷 <b>Code:</b>          ${escapeHtml(mat.code || '—')}
📦 <b>Name:</b>          ${escapeHtml(mat.name)}
🗂 <b>Category:</b>      ${escapeHtml(mat.category || '—')}
⚖️  <b>Unit:</b>          ${escapeHtml(mat.unit)}
📊 <b>Opening Stock:</b> ${mat.currentStock ?? 0} ${escapeHtml(mat.unit)}
💰 <b>Unit Cost:</b>     ${etb(mat.unitCost)}

👤 <b>Added by:</b> ${escapeHtml(user?.name || '—')}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Raw material updated — shows exactly what changed */
function notifyMaterialUpdated(mat, user, changes = []) {
  const diffLines = changes.length
    ? changes.map(c => `  • <b>${c.label}:</b>  <s>${c.from}</s> → <b>${c.to}</b>`).join('\n')
    : '  • (no tracked fields changed)';

  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✏️ <b>RAW MATERIAL UPDATED</b>

🏷 <b>Code:</b> ${mat.code || '—'}
📦 <b>Name:</b> ${mat.name}

📝 <b>Changes:</b>
${diffLines}

👤 <b>Updated by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

/** Raw material deleted */
function notifyMaterialDeleted(mat, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>RAW MATERIAL DELETED</b>

📦 <b>Name:</b>     ${mat.name}
🏷 <b>Code:</b>     ${mat.code || '—'}
📊 <b>Stock was:</b> ${mat.currentStock} ${mat.unit}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── SUPPLIERS ────────────────────────────────────────────────────

function notifySupplierCreated(supplier, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🚚 <b>NEW SUPPLIER</b>

🏢 <b>Name:</b>     ${supplier.name}
🗂 <b>Category:</b> ${supplier.category || 'General'}
👤 <b>Contact:</b>  ${supplier.contactPerson || '—'}
📞 <b>Phone:</b>    ${supplier.phone || '—'}

🛠 <b>Added by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifySupplierUpdated(supplier, user, changes = []) {
  if (!changes.length) return;
  const diffLines = changes.map(c => `  • <b>${c.label}:</b>  <s>${c.from}</s> → <b>${c.to}</b>`).join('\n');
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✏️ <b>SUPPLIER UPDATED</b>

🏢 <b>Name:</b> ${supplier.name}

📝 <b>Changes:</b>
${diffLines}

👤 <b>Updated by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifySupplierDeleted(supplier, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>SUPPLIER DELETED</b>

🏢 <b>Name:</b>     ${supplier.name}
🗂 <b>Category:</b> ${supplier.category || '—'}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── PRODUCTS ─────────────────────────────────────────────────────

function notifyProductCreated(product, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🍽️ <b>NEW PRODUCT</b>

🏷 <b>Code:</b>        ${escapeHtml(product.code || '—')}
📦 <b>Name:</b>        ${escapeHtml(product.name)}
🗂 <b>Category:</b>    ${escapeHtml(product.category || '—')}
🧪 <b>Ingredients:</b> ${product.ingredients?.length || 0} item(s)
💰 <b>Sell Price:</b>  ${etb(product.sellingPrice)}

👤 <b>Added by:</b> ${escapeHtml(user?.name || '—')}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyProductUpdated(product, user, changes = []) {
  if (!changes.length) return; // Only notify if something actually changed
  const diffLines = changes.map(c => `  • <b>${c.label}:</b>  <s>${c.from}</s> → <b>${c.to}</b>`).join('\n');
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✏️ <b>PRODUCT UPDATED</b>

🏷 <b>Code:</b> ${product.code || '—'}
📦 <b>Name:</b> ${product.name}

📝 <b>Changes:</b>
${diffLines}

👤 <b>Updated by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyProductDeleted(product, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>PRODUCT DELETED</b>

📦 <b>Name:</b>     ${product.name}
🏷 <b>Code:</b>     ${product.code || '—'}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── SYSTEM SETTINGS ──────────────────────────────────────────────

function notifySettingsChanged(changes, user) {
  const lines = Object.entries(changes)
    .filter(([k]) => !['rolePermissions', 'navVisibility'].includes(k))
    .map(([k, v]) => `  • <b>${k}:</b> ${v}`)
    .join('\n');

  const permChanged = 'rolePermissions' in changes || 'navVisibility' in changes;

  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
⚙️ <b>SYSTEM SETTINGS CHANGED</b>

${lines || '  (permissions / nav visibility only)'}
${permChanged ? '\n🔐 Role permissions or nav visibility were updated.' : ''}
👤 <b>Changed by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── RECYCLE BIN ──────────────────────────────────────────────────

function notifyRestored(type, name, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
♻️ <b>ITEM RESTORED</b>

📂 <b>Type:</b> ${type}
📦 <b>Item:</b> ${name}

👤 <b>Restored by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyBinEmptied(user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>RECYCLE BIN EMPTIED</b>

All deleted items permanently removed.

👤 <b>By:</b>   ${user?.name || '—'}
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── INVENTORY COUNT ──────────────────────────────────────────────

function notifyInventoryCountSubmitted(count, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
📋 <b>INVENTORY COUNT SUBMITTED</b>

🏪 <b>Store:</b>  ${count.storeName || 'Main Store'}
📅 <b>Period:</b> ${count.period || '—'}
📊 <b>Items:</b>  ${count.items?.length || 0} lines counted

👤 <b>Submitted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>         ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── TRANSACTION UPDATED ──────────────────────────────────────────

function notifyTransactionUpdated(txn, user) {
  const label = VOUCHER_LABEL[txn.voucherType] || txn.voucherType;
  const emoji = VOUCHER_EMOJI[txn.voucherType] || '📦';
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>${label.toUpperCase()} EDITED</b>

🔖 <b>Voucher:</b> ${txn.voucherNo || '—'}
💰 <b>New Total:</b> ${etb(txn.totalAmount)}
📋 <b>Status:</b>   PENDING (reset)

👤 <b>Edited by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── BULK DELETE ───────────────────────────────────────────────────

function notifyBulkDeleted(type, count, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>BULK DELETE</b>

📂 <b>Type:</b>  ${type}
🔢 <b>Count:</b> ${count} item(s) moved to recycle bin

👤 <b>By:</b>   ${user?.name || '—'}
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── USER STATUS / ROLE CHANGES ────────────────────────────────────

function notifyUserStatusChanged(user, status, changedBy) {
  const emoji = status === 'enabled' ? '✅' : '🔴';
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>ACCOUNT ${status.toUpperCase()}</b>

👤 <b>User:</b>  ${user.name}
📧 <b>Email:</b> ${user.email}
🎭 <b>Role:</b>  ${user.role.toUpperCase()}

🛠 <b>Changed by:</b> ${changedBy?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyUserRoleChanged(user, oldRole, newRole, changedBy) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🎭 <b>USER ROLE CHANGED</b>

👤 <b>User:</b>     ${user.name}
📧 <b>Email:</b>    ${user.email}
🔄 <b>Role:</b>     <s>${oldRole.toUpperCase()}</s> → <b>${newRole.toUpperCase()}</b>

🛠 <b>Changed by:</b> ${changedBy?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyUserDeleted(user, deletedBy) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>STAFF ACCOUNT DELETED</b>

👤 <b>Name:</b>  ${user.name}
📧 <b>Email:</b> ${user.email}
🎭 <b>Role:</b>  ${user.role.toUpperCase()}

🛠 <b>Deleted by:</b> ${deletedBy?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── INVENTORY COUNT APPROVED ──────────────────────────────────────

function notifyInventoryCountApproved(count, user) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const period = `${MONTHS[(count.periodMonth || 1) - 1]} ${count.periodYear || ''}`;
  const varLines = [
    count.positiveVariance ? `  📈 Positive: ${etb(count.positiveVariance)}` : null,
    count.negativeVariance ? `  📉 Negative: ${etb(Math.abs(count.negativeVariance))}` : null,
    `  📊 Net: ${etb(count.netVarianceValue || 0)}`,
  ].filter(Boolean).join('\n');

  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>INVENTORY COUNT APPROVED</b>

🏪 <b>Store:</b>  ${count.storeLocation || 'Main Store'}
📅 <b>Period:</b> ${period}
📦 <b>Items:</b>  ${count.totalItems || 0} lines

💹 <b>Variance Summary:</b>
${varLines}

👤 <b>Approved by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── PURCHASES ─────────────────────────────────────────────────────

const PURCHASE_ACTION_EMOJI = {
  draft: '📝',
  checked: '✅',
  approved: '🟣',
  received: '📦',
  cancelled: '🔴',
};

function notifyPurchaseCreated(purchase, user) {
  const items = (purchase.items || []).map(i =>
    `  • ${i.material?.name || '—'} × <b>${i.quantity}</b> ${i.material?.unit || ''} @ ${etb(i.unitCost)}`
  ).join('\n');
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
📝 <b>NEW PURCHASE ORDER (DRAFT)</b>

🔖 <b>Invoice No:</b>  ${purchase.invoiceNumber || 'Pending'}
🏪 <b>Supplier:</b>   ${purchase.supplier?.name || '—'}
💰 <b>Total:</b>      ${etb(purchase.totalAmount)}
📋 <b>Status:</b>     DRAFT

📦 <b>Items:</b>
${items || '  —'}

👤 <b>Created by:</b> ${user?.name || '—'} (${user?.role || ''})
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyPurchaseAdvanced(purchase, action, actor) {
  const emoji = PURCHASE_ACTION_EMOJI[purchase.status] || '🔄';
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>PURCHASE ${action.toUpperCase()}ED</b>

🔖 <b>Invoice:</b>  ${purchase.invoiceNumber || purchase._id?.toString().slice(-6)}
🏪 <b>Supplier:</b> ${purchase.supplier?.name || '—'}
💰 <b>Total:</b>    ${etb(purchase.totalAmount)}
📋 <b>Status:</b>   ${(purchase.status || '').toUpperCase()}
${action === 'receive' ? '\n📦 <b>Stock has been added to inventory.</b>' : ''}
👤 <b>By:</b>   ${actor?.name || '—'} (${actor?.role || ''})
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyPurchaseDeleted(purchase, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>PURCHASE ORDER DELETED</b>

🔖 <b>Invoice:</b>  ${purchase.invoiceNumber || '—'}
🏪 <b>Supplier:</b> ${purchase.supplier?.name || '—'}
💰 <b>Total:</b>    ${etb(purchase.totalAmount)}
📋 <b>Was:</b>      ${(purchase.status || '').toUpperCase()}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── EMPLOYEES ─────────────────────────────────────────────────────

function notifyEmployeeCreated(emp, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
👷 <b>NEW EMPLOYEE ADDED</b>

🆔 <b>ID:</b>         ${escapeHtml(emp.employeeId || '—')}
👤 <b>Name:</b>       ${escapeHtml(emp.firstName)} ${escapeHtml(emp.lastName)}
🏢 <b>Department:</b> ${escapeHtml(emp.department || '—')}
💼 <b>Position:</b>   ${escapeHtml(emp.position || '—')}
📞 <b>Phone:</b>      ${escapeHtml(emp.phone || '—')}

🛠 <b>Added by:</b> ${escapeHtml(user?.name || '—')}
🕐 <b>Time:</b>     ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyEmployeeUpdated(emp, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✏️ <b>EMPLOYEE UPDATED</b>

🆔 <b>ID:</b>         ${emp.employeeId || '—'}
👤 <b>Name:</b>       ${emp.firstName} ${emp.lastName}
🏢 <b>Department:</b> ${emp.department || '—'}
💼 <b>Position:</b>   ${emp.position || '—'}
📋 <b>Status:</b>     ${(emp.status || '').toUpperCase()}

🛠 <b>Updated by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyEmployeeDeleted(emp, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>EMPLOYEE REMOVED</b>

🆔 <b>ID:</b>         ${emp.employeeId || '—'}
👤 <b>Name:</b>       ${emp.firstName} ${emp.lastName}
🏢 <b>Department:</b> ${emp.department || '—'}

🛠 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── STOCK REQUEST EXTRA EVENTS ────────────────────────────────────

function notifyStockRequestRejected(req, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
❌ <b>STOCK REQUEST REJECTED</b>

🔖 <b>Voucher:</b>    ${req.voucherNo || '—'}
🏢 <b>Department:</b> ${req.department}
📦 <b>Items:</b>      ${req.items?.length || 0} line(s)
💬 <b>Reason:</b>     ${req.rejectReason || '—'}

👤 <b>Rejected by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyStockRequestCancelled(req, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🚫 <b>STOCK REQUEST CANCELLED</b>

🔖 <b>Voucher:</b>    ${req.voucherNo || '—'}
🏢 <b>Department:</b> ${req.department}

👤 <b>Cancelled by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>         ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyStockRequestDeleted(req, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>STOCK REQUEST DELETED</b>

🔖 <b>Voucher:</b>    ${req.voucherNo || '—'}
🏢 <b>Department:</b> ${req.department}
📋 <b>Was:</b>        ${(req.status || '').toUpperCase()}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── CONSUMPTION EXTRA EVENTS ──────────────────────────────────────

function notifyConsumptionVoided(record, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🔴 <b>CONSUMPTION VOIDED</b>

🔖 <b>Voucher:</b>     ${record.voucherNo || '—'}
🗂 <b>Category:</b>    ${record.category || '—'}
💰 <b>Recipe Cost:</b> ${etb(record.totalRecipeCost)}
${record.status === 'approved' ? '📦 <b>Stock has been reversed.</b>' : ''}
👤 <b>Voided by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>      ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyConsumptionDeleted(record, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑️ <b>CONSUMPTION DELETED</b>

🔖 <b>Voucher:</b>  ${record.voucherNo || '—'}
🗂 <b>Category:</b> ${record.category || '—'}

👤 <b>Deleted by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>       ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── PERMANENT DELETE ──────────────────────────────────────────────

function notifyPermanentDeleted(type, name, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
💥 <b>PERMANENTLY DELETED</b>

📂 <b>Type:</b> ${type}
📦 <b>Item:</b> ${name}
⚠️  This action is <b>irreversible</b>.

👤 <b>By:</b>   ${user?.name || '—'}
🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── PASSWORD / PROFILE CHANGES ────────────────────────────────────

function notifyPasswordChanged(user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🔑 <b>PASSWORD CHANGED</b>

👤 <b>User:</b>  ${user.name}
📧 <b>Email:</b> ${user.email}
🎭 <b>Role:</b>  ${user.role?.toUpperCase()}

🕐 <b>Time:</b> ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── STOCK ISSUE & REQUEST ─────────────────────────────────────────

function notifyStockRequestCreated(req, user) {
  const items = (req.items || []).map(i =>
    `  • ${i.material?.name || '—'} × <b>${i.requestedQty}</b> ${i.material?.unit || ''}`
  ).join('\n');
  const emoji = req.priority === 'urgent' ? '🚨' : '📋';
  sendTelegram(
    `🏨 <b>Baba Roti  CaféHotel</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>NEW STOCK REQUEST</b>

🔖 <b>Voucher:</b>    ${req.voucherNo || '—'}
🏢 <b>Department:</b> ${req.department}
⚡ <b>Priority:</b>   ${(req.priority || 'normal').toUpperCase()}
📋 <b>Status:</b>     PENDING

📦 <b>Items:</b>
${items || '  —'}

👤 <b>Requested by:</b> ${user?.name || '—'} (${user?.role || ''})
🕐 <b>Time:</b>         ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyStockRequestApproved(req, user) {
  sendTelegram(
    `🏨 <b>Baba Roti  CaféHotel</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>STOCK REQUEST APPROVED</b>

🔖 <b>Voucher:</b>    ${req.voucherNo || '—'}
🏢 <b>Department:</b> ${req.department}
📦 <b>Items:</b>      ${req.items?.length || 0} line(s)
💰 <b>Total Cost:</b> ${etb(req.totalCost)}

👤 <b>Approved by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyStockIssued(req, user) {
  const items = (req.items || []).map(i =>
    `  • ${i.material?.name || '—'} × <b>${i.issuedQty}</b> ${i.material?.unit || ''} — ${etb(i.totalCost)}`
  ).join('\n');
  sendTelegram(
    `🏨 <b>Baba Roti  CaféHotel</b>
━━━━━━━━━━━━━━━━━━━━
📤 <b>STOCK ISSUED</b>

🔖 <b>Voucher:</b>    ${req.voucherNo || '—'}
🏢 <b>Department:</b> ${req.department}
💰 <b>Total Cost:</b> ${etb(req.totalCost)}

📦 <b>Issued Items:</b>
${items || '  —'}

👤 <b>Issued by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>      ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── CONSUMPTION ───────────────────────────────────────────────────

const CATEGORY_EMOJI = {
  staff_meal: '🍽️',
  guest_entertainment: '🎉',
  owner_management: '👔',
  training_event: '📚',
  complimentary: '🎁',
  other: '📝',
};

const CATEGORY_LABELS_TG = {
  staff_meal: 'Staff Meal',
  guest_entertainment: 'Guest Entertainment',
  owner_management: 'Owner / Management',
  training_event: 'Training & Events',
  complimentary: 'Complimentary',
  other: 'Other',
};

function notifyConsumptionCreated(record, user) {
  const emoji = CATEGORY_EMOJI[record.category] || '🍽️';
  const label = CATEGORY_LABELS_TG[record.category] || record.category;
  const items = (record.items || []).map(i =>
    `  • ${i.product?.name || '—'} × <b>${i.quantity}</b>`
  ).join('\n');

  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
${emoji} <b>NEW CONSUMPTION RECORD</b>

🔖 <b>Voucher:</b>     ${record.voucherNo || '—'}
🗂 <b>Category:</b>    ${label}
👥 <b>Beneficiary:</b> ${record.beneficiary || '—'} (${record.pax || 1} pax)
🏢 <b>Department:</b>  ${record.department || '—'}
💰 <b>Recipe Cost:</b> ${etb(record.totalRecipeCost)}
📋 <b>Status:</b>      PENDING (awaiting approval)

🛒 <b>Items:</b>
${items || '  —'}

👤 <b>Recorded by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyConsumptionApproved(record, user) {
  const emoji = CATEGORY_EMOJI[record.category] || '🍽️';
  const label = CATEGORY_LABELS_TG[record.category] || record.category;
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>CONSUMPTION APPROVED</b>

${emoji} <b>Category:</b>    ${label}
🔖 <b>Voucher:</b>     ${record.voucherNo || '—'}
👥 <b>Beneficiary:</b> ${record.beneficiary || '—'} (${record.pax || 1} pax)
💰 <b>Recipe Cost:</b> ${etb(record.totalRecipeCost)}
📦 <b>Stock has been deducted.</b>

👤 <b>Approved by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyExpenseCreated(expense, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
💸 <b>NEW OVERHEAD EXPENSE RECORDED</b>

📝 <b>Item:</b>        ${expense.title}
🗂 <b>Category:</b>    ${expense.category}
💰 <b>Amount:</b>      ${etb(expense.amount)}
💳 <b>Payment:</b>     ${expense.paymentMethod || 'Cash'}
🏢 <b>Paid To:</b>     ${expense.paidTo || '—'}
🧾 <b>Ref/Bill #:</b>   ${expense.referenceNo || '—'}
${expense.notes ? `💬 <b>Notes:</b>      ${expense.notes}\n` : ''}
👤 <b>Recorded by:</b> ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

function notifyExpenseDeleted(expense, user) {
  sendTelegram(
    `🏨 <b>${HOTEL}</b>
━━━━━━━━━━━━━━━━━━━━
🗑 <b>EXPENSE MOVED TO RECYCLE BIN</b>

📝 <b>Item:</b>        ${expense.title}
🗂 <b>Category:</b>    ${expense.category}
💰 <b>Amount:</b>      ${etb(expense.amount)}

👤 <b>Deleted by:</b>  ${user?.name || '—'}
🕐 <b>Time:</b>        ${now()}
━━━━━━━━━━━━━━━━━━━━`
  );
}

// ── Customer Digital Menu & Table Orders ─────────────────────────
function notifyCustomerOrder(order) {
  if (!order) return;
  const items = Array.isArray(order.items) ? order.items : [];
  const itemsList = items
    .map(p => `  • <b>${escapeHtml(p.productName || p.name || 'Item')}</b> x${p.quantity} (${Number(p.unitPrice || 0).toFixed(2)} ETB)`)
    .join('\n');
  const table = escapeHtml(order.tableLabel || order.tableNo || 'Table');
  const custName = escapeHtml(order.customerName || 'Walk-in Guest');
  const custPhone = escapeHtml(order.customerPhone || '');
  const orderCode = escapeHtml(order.orderNo || '');
  const total = Number(order.grandTotal || order.totalAmount || 0).toFixed(2);
  const notes = escapeHtml(order.tableNotes || '');

  sendTelegram(
    `🛎️ <b>NEW CUSTOMER ORDER RECEIVED!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🪑 <b>Table:</b> ${table}\n` +
    `🔢 <b>Order Code:</b> <code>#${orderCode}</code>\n` +
    `👤 <b>Customer:</b> ${custName}${custPhone ? ` (📞 ${custPhone})` : ''}\n` +
    `💰 <b>Grand Total:</b> <b>ETB ${total}</b>\n` +
    `📋 <b>Ordered Items (${items.length}):</b>\n${itemsList || '  • (No items listed)'}\n` +
    (notes ? `📝 <b>Special Instructions:</b> ${notes}\n` : '') +
    `🕐 <b>Time:</b> ${now()}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>⚡ Transmitted instantly to Kitchen & Cashier POS for settlement.</i>`
  );
}

function notifyWaiterCall({ tableNo, action, customerName }) {
  const isBill = action === 'request_bill';
  const icon = isBill ? '💵' : '🛎️';
  const title = isBill ? 'CUSTOMER BILL REQUESTED' : 'CUSTOMER CALLED WAITER';
  const table = escapeHtml(tableNo || 'Table');
  const cust = escapeHtml(customerName || '');

  sendTelegram(
    `${icon} <b>${title}!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `🪑 <b>Table:</b> ${table}\n` +
    (cust ? `👤 <b>Customer:</b> ${cust}\n` : '') +
    `⚠️ <b>Alert:</b> ${isBill ? 'Customer has requested their bill for payment.' : 'Customer has called for waiter table assistance.'}\n` +
    `🕐 <b>Time:</b> ${now()}\n` +
    `━━━━━━━━━━━━━━━━━━━━`
  );
}

// ─────────────────────────────────────────────────────────────────
module.exports = {
  HOTEL,
  sendToOne,
  sendTelegram,
  sendNotification: sendTelegram,
  notifyCustomerOrder,
  notifyWaiterCall,
  notifyLogin,
  notifyUserCreated,
  notifyUserStatusChanged,
  notifyUserRoleChanged,
  notifyUserDeleted,
  notifyTransaction,
  notifyTransactionUpdated,
  notifyTransactionAdvanced,
  notifyTransactionDeleted,
  notifyMaterialCreated,
  notifyMaterialUpdated,
  notifyMaterialDeleted,
  notifyBulkDeleted,
  notifySupplierCreated,
  notifySupplierUpdated,
  notifySupplierDeleted,
  notifyProductCreated,
  notifyProductUpdated,
  notifyProductDeleted,
  notifySettingsChanged,
  notifyRestored,
  notifyBinEmptied,
  notifyInventoryCountSubmitted,
  notifyInventoryCountApproved,
  notifyConsumptionCreated,
  notifyConsumptionApproved,
  notifyStockRequestCreated,
  notifyStockRequestApproved,
  notifyStockIssued,
  // New
  notifyPurchaseCreated,
  notifyPurchaseAdvanced,
  notifyPurchaseDeleted,
  notifyEmployeeCreated,
  notifyEmployeeUpdated,
  notifyEmployeeDeleted,
  notifyStockRequestRejected,
  notifyStockRequestCancelled,
  notifyStockRequestDeleted,
  notifyConsumptionVoided,
  notifyConsumptionDeleted,
  notifyPermanentDeleted,
  notifyPasswordChanged,
  notifyExpenseCreated,
  notifyExpenseDeleted,
};

