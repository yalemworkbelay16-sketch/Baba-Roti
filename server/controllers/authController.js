const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const tg = require('../utils/telegramNotifier');
const { logActivity } = require('../utils/activityLogger');
const { getClientIp, parseDevice } = require('../utils/deviceDetector');

// @desc  Register a new user (admin only, in practice)
const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, telegramChatId, photoUrl, avatar, employeeId, assignedStation } = req.body;

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400);
    throw new Error('A user with this email already exists');
  }

  let assignedRole = role || 'storekeeper';
  if (assignedRole === 'dev' && req.user?.role !== 'dev') {
    res.status(403);
    throw new Error('Only a System Owner / Developer can create accounts with the dev role.');
  }

  const photo = photoUrl || avatar || '';
  const user = await User.create({
    name, email, password, role: assignedRole,
    phone: phone || '',
    telegramChatId: telegramChatId || '',
    avatar: photo,
    photoUrl: photo,
    employeeId: employeeId || '',
    department: req.body.department || '',
    assignedStation: assignedStation && assignedStation !== 'all'
      ? assignedStation
      : (req.body.department && String(req.body.department).toLowerCase().includes('kitchen'))
        ? 'kitchen'
        : (req.body.department && String(req.body.department).toLowerCase().includes('bar'))
          ? 'bar'
          : assignedStation || 'all',
    createdBy: req.user?._id || null,
    createdByName: req.user?.name || 'System / Self Registration',
    createdByRole: req.user?.role || '',
    registrationSource: 'manual',
    updatedBy: req.user?._id || null,
    updatedByName: req.user?.name || 'System / Self Registration',
    updatedByRole: req.user?.role || '',
  });

  // Auto-subscribe to Telegram if chatId provided
  if (telegramChatId && telegramChatId.trim()) {
    try {
      const Setting = require('../models/Setting');
      const settings = await Setting.findOne() || new Setting();
      const subs = settings.telegramSubscribers || [];
      const alreadyExists = subs.some(s => String(s.chatId) === String(telegramChatId.trim()));
      if (!alreadyExists) {
        subs.push({
          chatId: telegramChatId.trim(),
          name: name,
          username: email,
          subscribedAt: new Date(),
        });
        settings.telegramSubscribers = subs;
        await settings.save();
      }
    } catch (e) {
      console.warn('[Register] Could not auto-subscribe Telegram:', e.message);
    }
  }

  tg.notifyUserCreated(user, req.user);

  // Directly sync into Employee Directory
  try {
    const { syncUserToEmployee } = require('../utils/employeeSync');
    await syncUserToEmployee(user);
  } catch (syncErr) {
    console.warn('[Register] Could not sync user to employee directory:', syncErr.message);
  }

  logActivity(req, {
    action: 'REGISTER_USER',
    module: 'Users',
    description: `User account created for ${user.name} (${user.role}) in department ${user.department || 'General'}`,
    details: { newUserId: user._id, role: user.role, email: user.email },
  });

  res.status(201).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || '',
    assignedStation: user.assignedStation || 'all',
    phone: user.phone || '',
    telegramChatId: user.telegramChatId || '',
    avatar: user.avatar || '',
    photoUrl: user.photoUrl || user.avatar || '',
    employeeId: user.employeeId || '',
    isActive: user.isActive,
    token: generateToken(user._id),
  });
});

// @desc  Login user
const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // ── Verify OTP token before allowing login ───────────────────
  const otpToken = req.headers['x-otp-token'] || req.body.otpToken;
  if (!otpToken) {
    res.status(401);
    throw new Error('OTP verification required. Please complete phone verification first.');
  }
  try {
    const jwt = require('jsonwebtoken');
    const _jwtSecret = process.env.JWT_SECRET || 'baba_roti_cafe_super_secret_jwt_key_2024';
    const decoded = jwt.verify(otpToken, _jwtSecret);
    if (decoded.purpose !== 'otp_verified') throw new Error('Invalid OTP token');
  } catch (err) {
    res.status(401);
    throw new Error('OTP token is invalid or expired. Please verify your phone again.');
  }
  // ──────────────────────────────────────────────────────────────

  const user = await User.findOne({ email });

  if (!user || !(await user.matchPassword(password))) {
    const clientIp = getClientIp(req);
    logActivity(req, {
      action: 'LOGIN_FAILED',
      module: 'Auth',
      description: `Failed login attempt for email "${email}" from IP ${clientIp}`,
      status: 'failed',
    });
    res.status(401);
    throw new Error('Invalid email or password');
  }

  if (!user.isActive) {
    res.status(403);
    throw new Error('This account has been deactivated. Contact your administrator.');
  }

  // Record Machine IP, Device, and set Online
  const clientIp = getClientIp(req);
  const deviceInfo = parseDevice(req.headers['user-agent']);

  user.isOnline = true;
  user.lastLoginAt = new Date();
  user.lastActiveAt = new Date();
  user.lastLoginIp = clientIp;
  user.lastLoginDevice = deviceInfo;
  await user.save();

  logActivity(req, {
    action: 'LOGIN',
    module: 'Auth',
    description: `User ${user.name} (${user.role}) logged in from IP ${clientIp} (${deviceInfo})`,
    userOverride: user,
  });

  tg.notifyLogin(user);

  res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    department: user.department || '',
    assignedStation: user.assignedStation || 'all',
    phone: user.phone || '',
    avatar: user.avatar || '',
    isOnline: true,
    lastActiveAt: user.lastActiveAt,
    lastLoginIp: clientIp,
    lastLoginDevice: deviceInfo,
    token: generateToken(user._id),
  });
});

// @desc  Logout user and set offline
// POST /api/auth/logout
const logoutUser = asyncHandler(async (req, res) => {
  if (req.user) {
    await User.findByIdAndUpdate(req.user._id, {
      $set: { isOnline: false, lastActiveAt: new Date() },
    });
    logActivity(req, {
      action: 'LOGOUT',
      module: 'Auth',
      description: `User ${req.user.name} logged out`,
    });
  }
  res.json({ message: 'Logged out successfully' });
});

// @desc  Heartbeat to keep online status active
// POST /api/auth/heartbeat
const heartbeat = asyncHandler(async (req, res) => {
  if (req.user) {
    const clientIp = getClientIp(req);
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        isOnline: true,
        lastActiveAt: new Date(),
        lastLoginIp: clientIp,
      },
    });
  }
  res.json({ status: 'ok', isOnline: true });
});

// @desc  Get current user profile
const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});

// @desc  Verify the current user's password (used for approval gates)
// POST /api/auth/verify-password  { password: "..." }
// Returns { valid: true } or 401
const verifyPassword = asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password) { res.status(400); throw new Error('Password is required'); }

  // Re-fetch with password field (normally excluded)
  const user = await User.findById(req.user._id).select('+password');
  if (!user) { res.status(404); throw new Error('User not found'); }

  const match = await user.matchPassword(password);
  if (!match) {
    logActivity(req, {
      action: 'VERIFY_PASSWORD_FAILED',
      module: 'Auth',
      description: `Failed authorization password attempt by ${user.name}`,
      status: 'failed',
    });
    res.status(401);
    throw new Error('Incorrect password');
  }

  logActivity(req, {
    action: 'VERIFY_PASSWORD',
    module: 'Auth',
    description: `User ${user.name} verified authorization password`,
  });

  res.json({ valid: true, userId: user._id, name: user.name, role: user.role });
});

// @desc  Update profile of current user (name, email, phone, avatar)
// PUT /api/auth/profile
const updateProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  if (req.body.email && req.body.email.toLowerCase() !== user.email) {
    const emailExists = await User.findOne({ email: req.body.email.toLowerCase(), _id: { $ne: user._id } });
    if (emailExists) {
      res.status(400);
      throw new Error('This email is already in use by another account');
    }
    user.email = req.body.email.toLowerCase();
  }

  if (req.body.name) user.name = req.body.name;
  if (req.body.phone !== undefined) user.phone = req.body.phone;
  if (req.body.avatar !== undefined) user.avatar = req.body.avatar;

  const updated = await user.save();
  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    phone: updated.phone || '',
    avatar: updated.avatar || '',
    token: generateToken(updated._id),
  });
});

// @desc  Change password of current user
// PUT /api/auth/password
const updatePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Both current and new password are required');
  }

  if (newPassword.length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters');
  }

  const user = await User.findById(req.user._id).select('+password');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const match = await user.matchPassword(currentPassword);
  if (!match) {
    res.status(400);
    throw new Error('Current password is incorrect');
  }

  user.password = newPassword;
  await user.save();
  tg.notifyPasswordChanged(req.user);
  res.json({ message: 'Password updated successfully' });
});

// ── OTP helpers ───────────────────────────────────────────────────────
const https = require('https');

function sendTelegramDirect(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN || '8849417539:AAFXg2njcRGhnq8EPTtHusuEVuur5qqVzAk';
  if (!token || token === 'your_bot_token_here') return;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
  const options = {
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  };
  const req = https.request(options);
  req.on('error', () => { });
  req.write(body);
  req.end();
}

// @desc  Request OTP — sends 6-digit code to the phone-linked Telegram chat
// @route POST /api/auth/request-otp
// @access Public
const requestOtp = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  if (!phone) { res.status(400); throw new Error('Phone number is required'); }

  const normalized = phone.replace(/\s+/g, '').replace(/^00251/, '+251');

  // Normalize helper — collapses +2519x and 09x to same format for comparison
  const normalize = (p = '') =>
    String(p).replace(/\s+/g, '')
      .replace(/^00251/, '+251')
      .replace(/^\+251/, '0');

  // ── PERMANENT DEVELOPER NUMBER ──────────────────────────────────
  // This number is always authorized regardless of the subscriber list.
  const DEV_PHONE = '0918592028';
  const DEV_CHAT_ID = '7951472080'; // Mequannent Gashaw's Telegram chat ID

  const isDevNumber = normalize(normalized) === normalize(DEV_PHONE);

  // ── Look up the phone in the registered subscriber list ─────────
  const Setting = require('../models/Setting');
  const settings = await Setting.findOne().select('telegramSubscribers').lean();
  const subscribers = settings?.telegramSubscribers || [];

  // ── Block OTP if the user account is disabled / deactivated ─────
  const phoneVariants = [
    normalize(normalized),
    normalize(normalized).replace(/^0/, '+2519'),
    normalized,
  ];
  const disabledUser = await User.findOne({
    isActive: false,
    $or: [
      { phone: { $in: phoneVariants } },
      { phone: { $regex: normalize(normalized).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
    ]
  });
  if (disabledUser) {
    res.status(403);
    throw new Error(`The staff account for ${disabledUser.name} has been disabled. Telegram OTP login and notifications are stopped.`);
  }

  const matchedSub = isDevNumber
    ? { chatId: DEV_CHAT_ID, phone: DEV_PHONE, name: 'Mequannent Gashaw' }
    : subscribers.find(s => s.phone && normalize(s.phone) === normalize(normalized));

  // ── Find the system user whose phone matches ─────────────────────
  let user = null;
  for (const v of phoneVariants) {
    user = await User.findOne({ isActive: true, phone: v });
    if (user) break;
  }
  if (!user) {
    const escaped = normalize(normalized).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    user = await User.findOne({ isActive: true, phone: { $regex: escaped, $options: 'i' } });
  }

  // Determine recipient Telegram Chat ID (from subscriber list OR User account)
  const recipientChatId = matchedSub?.chatId || user?.telegramChatId;

  if (!matchedSub && !user) {
    res.status(403);
    throw new Error('This phone number is not registered to any staff account. Contact your administrator.');
  }

  if (!recipientChatId) {
    res.status(400);
    throw new Error(`Staff account found for ${user?.name || 'you'}, but Telegram is not linked yet. Please open @BabarotiBot on Telegram and send /subscribe to link your account.`);
  }

  // If no user found by phone, use any admin account to store the temporary OTP token
  if (!user) {
    user = await User.findOne({ isActive: true, role: 'admin' });
  }

  if (!user) {
    res.status(500);
    throw new Error('No active system account found. Contact your administrator.');
  }

  // ── Generate OTP ─────────────────────────────────────────────────
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  const salt = await bcrypt.genSalt(10);
  user.otpHash = await bcrypt.hash(otp, salt);
  user.otpExpiry = expiry;
  await user.save();

  // ── Send OTP to the staff member's exact Telegram chat ───────────
  const rawDisplayName = user?.name || matchedSub?.name || 'Baba Roti';
  const staffDisplayName = String(rawDisplayName)
    .replace(/Baba\s*Roti\s*Caf[eé]?\s*Admin/gi, 'Baba Roti')
    .replace(/\s*Caf[eé]/gi, '')
    .trim() || 'Baba Roti';

  sendTelegramDirect(recipientChatId,
    `🔐 <b>Baba Roti — Login Code</b>

Hello <b>${staffDisplayName}</b> 👋

Your verification code:  <code>${otp}</code>
<i>(Tap code to copy · Valid for 5 minutes)</i>

⚠️ <i>Do not share this code with anyone.</i>`
  );

  res.json({
    message: 'OTP sent to your Telegram.',
    maskedName: staffDisplayName,
    userId: user._id,
  });
});

// @desc  Verify OTP
// @route POST /api/auth/verify-otp
// @access Public
const verifyOtp = asyncHandler(async (req, res) => {
  const { userId, otp } = req.body;
  if (!userId || !otp) { res.status(400); throw new Error('userId and otp are required'); }

  const user = await User.findById(userId).select('+otpHash +otpExpiry');
  if (!user) { res.status(404); throw new Error('User not found'); }

  if (!user.otpHash || !user.otpExpiry) {
    res.status(400); throw new Error('No OTP was requested. Please request a new one.');
  }

  if (new Date() > user.otpExpiry) {
    user.otpHash = null; user.otpExpiry = null;
    await user.save();
    res.status(400); throw new Error('OTP has expired. Please request a new one.');
  }

  const isMatch = await bcrypt.compare(String(otp).trim(), user.otpHash);
  if (!isMatch) { res.status(401); throw new Error('Incorrect OTP. Please try again.'); }

  // Clear OTP after successful verification
  user.otpHash = null; user.otpExpiry = null;
  await user.save();

  // Issue a short-lived otpToken (JWT, 10 min) to gate the login step
  const jwt = require('jsonwebtoken');
  const _jwtSecret = process.env.JWT_SECRET || 'baba_roti_cafe_super_secret_jwt_key_2024';
  const otpToken = jwt.sign(
    { id: user._id, purpose: 'otp_verified' },
    _jwtSecret,
    { expiresIn: '10m' }
  );

  res.json({ message: 'OTP verified.', otpToken });
});

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  heartbeat,
  getMe,
  verifyPassword,
  updateProfile,
  updatePassword,
  requestOtp,
  verifyOtp,
};

