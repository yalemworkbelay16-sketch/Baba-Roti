const asyncHandler = require('express-async-handler');
const Setting = require('../models/Setting');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8849417539:AAFXg2njcRGhnq8EPTtHusuEVuur5qqVzAk';

// ── Send a reply directly to one chat ────────────────────────────
async function reply(chatId, text) {
  try {
    const https = require('https');
    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
    const options = {
      hostname: 'api.telegram.org',
      path: `/bot${BOT_TOKEN}/sendMessage`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options);
    req.on('error', () => { });
    req.write(body);
    req.end();
  } catch { }
}

// ── POST /api/telegram/webhook ───────────────────────────────────
// Telegram calls this endpoint for every message sent to the bot.
const handleWebhook = asyncHandler(async (req, res) => {
  // Always respond 200 immediately — Telegram will retry if we're slow
  res.sendStatus(200);

  const update = req.body;
  const message = update?.message || update?.edited_message;
  if (!message) return;

  const chatId = message.chat?.id;
  const from = message.from;
  const text = (message.text || '').trim().toLowerCase();
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(' ') || 'Unknown';
  const username = from?.username || '';

  if (!chatId) return;

  let settings = await Setting.findOne();
  if (!settings) settings = new Setting();

  const subscribers = settings.telegramSubscribers || [];
  const alreadySubscribed = subscribers.some(s => String(s.chatId) === String(chatId));

  // ── /start or /subscribe ──────────────────────────────────────
  if (text === '/start' || text.startsWith('/subscribe')) {
    // Check if the user trying to subscribe is an inactive/disabled staff member
    try {
      const User = require('../models/User');
      const cleanChat = String(chatId);
      const cleanUser = (username || '').toLowerCase().trim();
      const blocked = await User.findOne({
        isActive: false,
        $or: [
          { telegramChatId: cleanChat },
          ...(cleanUser ? [{ email: cleanUser }] : []),
        ],
      });
      if (blocked) {
        await reply(chatId,
          `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n❌ <b>ACCESS PROHIBITED</b>\n\nYour staff account (<b>${blocked.name}</b>) has been disabled or deactivated by the administrator.\n\nTelegram notifications cannot be activated for this account.\n━━━━━━━━━━━━━━━━━━━━`
        );
        return;
      }
    } catch (e) {
      console.warn('[TelegramWebhook] Inactive check error:', e.message);
    }

    // Check if user already exists (by chatId OR by matching username)
    const existingIdx = subscribers.findIndex(s =>
      (s.chatId && String(s.chatId) === String(chatId)) ||
      (username && s.username && s.username.toLowerCase() === username.toLowerCase())
    );

    // Link subscriber to User account if username or phone matches
    try {
      const User = require('../models/User');
      const cleanUser = (username || '').toLowerCase().trim();
      const staffUser = await User.findOne({
        isActive: true,
        $or: [
          ...(cleanUser ? [{ email: cleanUser }] : []),
          { telegramChatId: String(chatId) },
        ],
      });
      if (staffUser) {
        staffUser.telegramChatId = String(chatId);
        await staffUser.save();
      }
    } catch (e) {
      console.warn('[TelegramWebhook] User link error:', e.message);
    }

    if (existingIdx !== -1) {
      subscribers[existingIdx].chatId = String(chatId);
      if (name) subscribers[existingIdx].name = name;
      if (username) subscribers[existingIdx].username = username;
      settings.telegramSubscribers = subscribers;
      settings.markModified('telegramSubscribers');
      await settings.save();

      await reply(chatId,
        `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>Subscribed successfully!</b>\n\nWelcome back, <b>${name}</b>.\n\nAvailable commands:\n• /myconsumption — Check your staff meal orders & remaining quota\n• /myorders — Check your recent orders\n• /status — View account info\n• /unsubscribe — Stop alerts\n━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    }

    subscribers.push({
      chatId: String(chatId),
      name,
      username,
      subscribedAt: new Date(),
    });
    settings.telegramSubscribers = subscribers;
    settings.markModified('telegramSubscribers');
    await settings.save();

    await reply(chatId,
      `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>Subscribed successfully!</b>\n\nWelcome, <b>${name}</b>!\n\nYour Telegram account is now connected.\n\n📱 <b>Commands:</b>\n• /myconsumption — View your staff meal orders & quota\n• /myorders — View your recent orders\n• /status — Check your account details\n• /unsubscribe — Stop alerts\n━━━━━━━━━━━━━━━━━━━━`
    );
    return;
  }

  // ── /unsubscribe ──────────────────────────────────────────────
  if (text.startsWith('/unsubscribe')) {
    if (!alreadySubscribed) {
      await reply(chatId, '❌ You are not currently subscribed to Baba Roti Café notifications.');
      return;
    }

    settings.telegramSubscribers = subscribers.filter(s => String(s.chatId) !== String(chatId));
    settings.markModified('telegramSubscribers');
    await settings.save();

    await reply(chatId,
      `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n🔕 <b>Unsubscribed</b>\n\nYou will no longer receive notifications.\nSend /subscribe anytime to re-subscribe.\n━━━━━━━━━━━━━━━━━━━━`
    );
    return;
  }

  // ── /consumption or /myconsumption or /quota ───────────────────
  if (text === '/consumption' || text === '/myconsumption' || text === '/quota') {
    try {
      const User = require('../models/User');
      const Consumption = require('../models/Consumption');

      // Find user by chatId or subscriber phone
      const sub = subscribers.find(s => String(s.chatId) === String(chatId));
      let user = await User.findOne({ isActive: true, telegramChatId: String(chatId) });
      if (!user && sub?.phone) {
        user = await User.findOne({ isActive: true, phone: sub.phone });
      }

      if (!user) {
        await reply(chatId,
          `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\nℹ️ <b>NO LINKED STAFF ACCOUNT</b>\n\nYour Telegram is subscribed, but not linked to a specific staff profile.\n\nAsk your administrator to register your phone number or enter your Telegram Chat ID: <code>${chatId}</code> in Staff Accounts.\n━━━━━━━━━━━━━━━━━━━━`
        );
        return;
      }

      // Query today's consumption records
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const records = await Consumption.find({
        $or: [
          { performedBy: user._id },
          { beneficiary: user.name },
        ],
        date: { $gte: todayStart, $lte: todayEnd },
        status: { $ne: 'voided' },
      }).populate('items.product', 'name code').lean();

      const dailyLimit = user.dailyMealLimit || 1;
      let totalPortions = 0;
      records.forEach(r => {
        (r.items || []).forEach(i => {
          totalPortions += Number(i.quantity) || 1;
        });
      });

      const remaining = Math.max(0, dailyLimit - totalPortions);

      const itemsList = records.length
        ? records.map(r => {
          const names = (r.items || []).map(i => `${i.product?.name || 'Meal'} × ${i.quantity}`).join(', ');
          const time = new Date(r.date || r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `  • <b>${names}</b> [${(r.status || '').toUpperCase()}] at ${time}`;
        }).join('\n')
        : '  • <i>No staff meals ordered yet today.</i>';

      await reply(chatId,
        `🏨 <b>Baba Roti Café — My Staff Meals</b>\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>Staff:</b> ${user.name} (${user.role.toUpperCase()})\n📊 <b>Daily Quota:</b> <b>${totalPortions} of ${dailyLimit}</b> portion(s) ordered today\n${remaining > 0 ? `🟢 <b>${remaining} portion(s) remaining today</b>` : '🔴 <b>Daily quota reached</b>'}\n\n📋 <b>Today's Orders:</b>\n${itemsList}\n━━━━━━━━━━━━━━━━━━━━`
      );
      return;
    } catch (err) {
      console.warn('[TelegramWebhook] Consumption query error:', err.message);
      await reply(chatId, '⚠️ Error checking your consumption records. Please try again.');
      return;
    }
  }

  // ── /myorders or /orders ───────────────────────────────────────
  if (text === '/myorders' || text === '/orders') {
    try {
      const User = require('../models/User');
      const POSOrder = require('../models/POSOrder');
      const CaptainOrder = require('../models/CaptainOrder');

      let user = await User.findOne({ isActive: true, telegramChatId: String(chatId) });
      if (!user) {
        const sub = subscribers.find(s => String(s.chatId) === String(chatId));
        if (sub?.phone) user = await User.findOne({ isActive: true, phone: sub.phone });
      }

      if (!user) {
        await reply(chatId, 'ℹ️ No staff account linked to this Telegram chat. Ask your administrator to link your account.');
        return;
      }

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [recentPos, recentCap] = await Promise.all([
        POSOrder.find({
          createdAt: { $gte: todayStart },
          $or: [{ cashier: user._id }, { cashierName: user.name }],
        }).sort({ createdAt: -1 }).limit(3).lean(),
        CaptainOrder.find({
          createdAt: { $gte: todayStart },
          $or: [{ waiter: user._id }, { waiterName: user.name }],
        }).sort({ createdAt: -1 }).limit(3).lean(),
      ]);

      const formatBirr = (n) => Number(n || 0).toFixed(2) + ' ETB';

      let msg = `🏨 <b>Baba Roti Café — My Orders Today</b>\n━━━━━━━━━━━━━━━━━━━━\n👤 <b>Staff:</b> ${user.name}\n\n`;

      if (recentPos.length > 0) {
        msg += `🧾 <b>Recent POS Orders:</b>\n`;
        recentPos.forEach(o => {
          msg += `  • #${o.orderNo} | Table: ${o.tableNo || 'N/A'} | ${formatBirr(o.grandTotal)} (${o.paymentStatus})\n`;
        });
      }

      if (recentCap.length > 0) {
        msg += `🧑‍🍳 <b>Recent Captain Orders:</b>\n`;
        recentCap.forEach(o => {
          msg += `  • #${o.orderNo} | Table: ${o.tableNo} | ${formatBirr(o.grandTotal)} [${o.status}]\n`;
        });
      }

      if (recentPos.length === 0 && recentCap.length === 0) {
        msg += `<i>No orders recorded for you yet today.</i>\n`;
      }

      msg += `━━━━━━━━━━━━━━━━━━━━`;
      await reply(chatId, msg);
      return;
    } catch (err) {
      console.warn('[TelegramWebhook] Orders query error:', err.message);
      await reply(chatId, '⚠️ Error checking your orders. Please try again.');
      return;
    }
  }

  // ── /status ───────────────────────────────────────────────────
  if (text === '/status') {
    const User = require('../models/User');
    const user = await User.findOne({ isActive: true, telegramChatId: String(chatId) });
    const sub = subscribers.find(s => String(s.chatId) === String(chatId));

    if (user) {
      await reply(chatId,
        `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>Connected Staff Account</b>\n\n👤 <b>Name:</b> ${user.name}\n🎭 <b>Role:</b> ${user.role.toUpperCase()}\n📞 <b>Phone:</b> ${user.phone || sub?.phone || 'Not linked'}\n🆔 <b>Chat ID:</b> <code>${chatId}</code>\n🍽️ <b>Daily Meal Limit:</b> ${user.dailyMealLimit || 1} portion(s)\n\nSend /myconsumption to check today's meals.\n━━━━━━━━━━━━━━━━━━━━`
      );
    } else {
      await reply(chatId,
        alreadySubscribed
          ? `✅ You are <b>subscribed</b> to Baba Roti Café notifications.\nChat ID: <code>${chatId}</code>\n\nSend /myconsumption or /orders to check your orders.`
          : `❌ You are <b>not subscribed</b>.\n\nSend /subscribe to start receiving notifications.`
      );
    }
    return;
  }

  // ── Unknown command ───────────────────────────────────────────
  await reply(chatId,
    `🏨 <b>Baba Roti Café Bot</b>\n\nAvailable commands:\n• /myconsumption — View your staff meal orders and remaining daily quota\n• /myorders — View your orders today\n• /status — Check your account & connection details\n• /subscribe — Connect to bot notifications\n• /unsubscribe — Stop receiving notifications`
  );
});

// ── POST /api/telegram/subscribers (admin/dev only) ──────────────
// Manually add a subscriber with name + phone (no bot interaction needed).
// chatId is optional — if provided, they also get bot notifications.
const addSubscriber = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Roles below Administrator cannot add or configure Telegram OTP subscribers.');
  }
  const { name, phone, username, chatId } = req.body;
  if (!name || !phone) { res.status(400); throw new Error('Name and phone are required'); }

  let settings = await Setting.findOne();
  if (!settings) settings = new Setting();

  const subscribers = settings.telegramSubscribers || [];

  // Check duplicate phone
  const dupPhone = subscribers.find(s => s.phone && s.phone.trim() === phone.trim());
  if (dupPhone) { res.status(400); throw new Error(`Phone ${phone} is already registered to ${dupPhone.name}`); }

  // Check duplicate chatId (if provided)
  if (chatId) {
    const dupChat = subscribers.find(s => s.chatId && String(s.chatId) === String(chatId));
    if (dupChat) { res.status(400); throw new Error(`Chat ID already registered to ${dupChat.name}`); }
  }

  const cleanChatIdVal = chatId && String(chatId).trim() && String(chatId).trim() !== 'null' && String(chatId).trim() !== 'undefined'
    ? String(chatId).trim()
    : null;

  const newSub = {
    id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    chatId: cleanChatIdVal,
    name: name.trim(),
    username: username ? username.trim().replace(/^@/, '') : '',
    phone: phone.trim(),
    subscribedAt: new Date(),
    manuallyAdded: true,
  };

  subscribers.push(newSub);
  settings.telegramSubscribers = subscribers;
  settings.markModified('telegramSubscribers');
  await settings.save();

  res.status(201).json({ message: 'Subscriber added.', subscriber: newSub });
});

// ── GET /api/telegram/subscribers (admin only) ───────────────────
const getSubscribers = asyncHandler(async (req, res) => {
  const settings = await Setting.findOne();
  let modified = false;
  const raw = settings?.telegramSubscribers || [];
  const subscribers = raw.map((s, idx) => {
    let cleanChat = s.chatId;
    if (cleanChat === 'null' || cleanChat === 'undefined') cleanChat = null;
    if (!s.id) {
      modified = true;
      return { ...s, chatId: cleanChat, id: cleanChat ? String(cleanChat) : `sub_${idx}_${Date.now()}` };
    }
    return { ...s, chatId: cleanChat };
  });
  if (modified && settings) {
    settings.telegramSubscribers = subscribers;
    settings.markModified('telegramSubscribers');
    await settings.save().catch(() => { });
  }
  res.json(subscribers);
});

// ── PUT /api/telegram/subscribers/:chatId/phone (admin/dev only) ──
// Register or update the phone number for a subscriber.
// This is what links a Telegram account to an allowed OTP phone number.
const updateSubscriberPhone = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Roles below Administrator cannot modify or register Telegram OTP phone numbers.');
  }
  const { phone } = req.body;
  if (!phone) { res.status(400); throw new Error('Phone number is required'); }

  const settings = await Setting.findOne();
  if (!settings) { res.status(404); throw new Error('Settings not found'); }

  const subscribers = settings.telegramSubscribers || [];
  const target = String(req.params.chatId).trim();

  const idx = subscribers.findIndex(s =>
    (s.id && String(s.id) === target) ||
    (s.chatId && String(s.chatId) === target) ||
    (s._id && String(s._id) === target)
  );

  if (idx === -1) { res.status(404); throw new Error('Subscriber not found'); }

  // Normalize phone — trim whitespace
  const normalized = String(phone).trim();

  // Check for duplicate phone on other subscribers
  const duplicate = subscribers.find((s, i) => i !== idx && s.phone === normalized);
  if (duplicate) {
    res.status(400);
    throw new Error(`Phone ${normalized} is already registered to ${duplicate.name}`);
  }

  subscribers[idx] = { ...subscribers[idx], phone: normalized };
  settings.telegramSubscribers = subscribers;
  settings.markModified('telegramSubscribers');
  await settings.save();

  res.json({ message: 'Phone registered.', subscriber: subscribers[idx] });
});

// ── DELETE /api/telegram/subscribers/:chatId (admin/dev only) ─────
const removeSubscriber = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Roles below Administrator cannot delete or remove Telegram OTP subscribers.');
  }
  const settings = await Setting.findOne();
  if (!settings) return res.json({ message: 'No settings found' });

  const target = String(req.params.chatId).trim();
  const removedSub = (settings.telegramSubscribers || []).find(s =>
    (s.id && String(s.id) === target) ||
    (s.chatId && String(s.chatId) === target) ||
    (s._id && String(s._id) === target)
  );

  settings.telegramSubscribers = (settings.telegramSubscribers || [])
    .filter(s =>
      !(s.id && String(s.id) === target) &&
      !(s.chatId && String(s.chatId) === target) &&
      !(s._id && String(s._id) === target)
    );
  settings.markModified('telegramSubscribers');
  await settings.save();

  // Also clear telegramChatId on corresponding user account if linked
  if (removedSub) {
    try {
      const User = require('../models/User');
      const user = await User.findOne({
        $or: [
          ...(removedSub.chatId ? [{ telegramChatId: String(removedSub.chatId) }] : []),
          ...(removedSub.phone ? [{ phone: removedSub.phone }] : []),
          ...(removedSub.username ? [{ email: removedSub.username }] : []),
        ]
      });
      if (user && user.telegramChatId) {
        user.telegramChatId = '';
        await user.save();
      }
    } catch (err) {
      console.warn('[RemoveSubscriber] Could not unlink user telegramChatId:', err.message);
    }

    // Send polite unsubscription notice if it was a real Telegram chat
    if (removedSub.chatId) {
      await reply(
        removedSub.chatId,
        `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n🔕 <b>UNSUBSCRIBED BY ADMINISTRATOR</b>\n\nYour Telegram notifications subscription has been removed by the administrator. You will no longer receive alerts.\n━━━━━━━━━━━━━━━━━━━━`
      );
    }
  }

  res.json({ message: 'Subscriber removed and notifications stopped.' });
});

// ── GET /api/telegram/daily-report-preview (admin/dev only) ────────
const getDailyReportPreview = asyncHandler(async (req, res) => {
  const { computeDailySalesMetrics, formatDailyReportMessage } = require('../utils/dailySalesReporter');
  const Setting = require('../models/Setting');
  const settings = await Setting.findOne();
  const metrics = await computeDailySalesMetrics();
  const previewText = formatDailyReportMessage(metrics, settings?.hotelName || 'Baba Roti Café');

  res.json({
    success: true,
    metrics,
    previewText,
    scheduledTime: settings?.telegramDailyReportTime || '12:00',
    enabled: settings?.telegramDailyReportEnabled !== false,
  });
});

// ── POST /api/telegram/send-daily-report (admin/dev only) ──────────
const sendManualDailyReport = asyncHandler(async (req, res) => {
  const { sendDailySalesReport } = require('../utils/dailySalesReporter');
  const result = await sendDailySalesReport({ isManual: true });
  res.json(result);
});

// ── PUT /api/telegram/subscribers/:chatId/permissions (admin/dev only) ──
const updateSubscriberPermissions = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Roles below Administrator cannot modify subscriber permissions.');
  }
  const { allowedAlerts, role } = req.body;
  const settings = await Setting.findOne();
  if (!settings) { res.status(404); throw new Error('Settings not found'); }

  const subscribers = settings.telegramSubscribers || [];
  const target = String(req.params.chatId).trim();

  const idx = subscribers.findIndex(s =>
    (s.id && String(s.id) === target) ||
    (s.chatId && String(s.chatId) === target) ||
    (s._id && String(s._id) === target)
  );

  if (idx === -1) { res.status(404); throw new Error('Subscriber not found'); }

  subscribers[idx] = {
    ...subscribers[idx],
    allowedAlerts: Array.isArray(allowedAlerts) ? allowedAlerts : subscribers[idx].allowedAlerts || [],
    role: role || subscribers[idx].role || '',
  };
  settings.telegramSubscribers = subscribers;
  settings.markModified('telegramSubscribers');
  await settings.save();

  res.json({ message: 'Subscriber permissions updated.', subscriber: subscribers[idx] });
});

module.exports = {
  handleWebhook,
  getSubscribers,
  addSubscriber,
  updateSubscriberPhone,
  updateSubscriberPermissions,
  removeSubscriber,
  getDailyReportPreview,
  sendManualDailyReport,
};
