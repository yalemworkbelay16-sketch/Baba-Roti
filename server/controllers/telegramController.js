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

    if (existingIdx !== -1) {
      subscribers[existingIdx].chatId = String(chatId);
      if (name) subscribers[existingIdx].name = name;
      if (username) subscribers[existingIdx].username = username;
      settings.telegramSubscribers = subscribers;
      settings.markModified('telegramSubscribers');
      await settings.save();

      await reply(chatId,
        `✅ <b>Subscribed successfully!</b>\n\nYou are receiving Baba Roti Café notifications.\n\nTo unsubscribe, send /unsubscribe`
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
      `🏨 <b>Baba Roti  CaféHotel</b>
━━━━━━━━━━━━━━━━━━━━
✅ <b>Subscribed successfully!</b>

Welcome, <b>${name}</b>!

You will now receive real-time alerts for:
🔐 User logins
📦 Stock transactions (GRV, Disposal, etc.)
✅ Voucher approvals & workflow steps
🧱 Raw material changes
🚚 Supplier changes
🍽️ Product changes
⚙️ System settings changes
🗑️ Recycle bin actions

To stop notifications, send /unsubscribe
━━━━━━━━━━━━━━━━━━━━`
    );
    return;
  }

  // ── /unsubscribe ──────────────────────────────────────────────
  if (text.startsWith('/unsubscribe')) {
    if (!alreadySubscribed) {
      await reply(chatId, '❌ You are not currently subscribed to Baba Roti  Cafénotifications.');
      return;
    }

    settings.telegramSubscribers = subscribers.filter(s => String(s.chatId) !== String(chatId));
    settings.markModified('telegramSubscribers');
    await settings.save();

    await reply(chatId,
      `🏨 <b>Baba Roti  CaféHotel</b>
━━━━━━━━━━━━━━━━━━━━
🔕 <b>Unsubscribed</b>

You will no longer receive notifications.
Send /subscribe anytime to re-subscribe.
━━━━━━━━━━━━━━━━━━━━`
    );
    return;
  }

  // ── /status ───────────────────────────────────────────────────
  if (text === '/status') {
    await reply(chatId,
      alreadySubscribed
        ? `✅ You are <b>subscribed</b> to Baba Roti  CaféHotel notifications.\n\nSend /unsubscribe to stop.`
        : `❌ You are <b>not subscribed</b>.\n\nSend /subscribe to start receiving notifications.`
    );
    return;
  }

  // ── Unknown command ───────────────────────────────────────────
  await reply(chatId,
    `🏨 <b>Baba Roti  CaféHotel Bot</b>

Available commands:
/subscribe   — Start receiving notifications
/unsubscribe — Stop receiving notifications
/status      — Check your subscription status`
  );
});

// ── POST /api/telegram/subscribers (admin only) ──────────────────
// Manually add a subscriber with name + phone (no bot interaction needed).
// chatId is optional — if provided, they also get bot notifications.
const addSubscriber = asyncHandler(async (req, res) => {
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
    await settings.save().catch(() => {});
  }
  res.json(subscribers);
});

// ── PUT /api/telegram/subscribers/:chatId/phone (admin only) ─────
// Register or update the phone number for a subscriber.
// This is what links a Telegram account to an allowed OTP phone number.
const updateSubscriberPhone = asyncHandler(async (req, res) => {
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

// ── DELETE /api/telegram/subscribers/:chatId (admin only) ────────
const removeSubscriber = asyncHandler(async (req, res) => {
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

module.exports = { handleWebhook, getSubscribers, addSubscriber, updateSubscriberPhone, removeSubscriber };
