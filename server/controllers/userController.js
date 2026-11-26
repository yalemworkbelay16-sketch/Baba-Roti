const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const tg = require('../utils/telegramNotifier');
const { logActivity } = require('../utils/activityLogger');

const ONLINE_TIMEOUT_MS = 15 * 60 * 1000;

const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find({}).select('-password').sort({ createdAt: -1 }).lean();
  const now = Date.now();

  const mapped = users.map(u => ({
    ...u,
    isOnline: Boolean(u.isOnline && u.lastActiveAt && (now - new Date(u.lastActiveAt).getTime() < ONLINE_TIMEOUT_MS)),
  }));

  res.json(mapped);
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }

  // Prevent non-dev users from modifying dev account or assigning dev role
  if (user.role === 'dev' && req.user.role !== 'dev') {
    res.status(403);
    throw new Error('Only a System Owner / Developer can modify developer accounts.');
  }
  if (req.body.role === 'dev' && req.user.role !== 'dev') {
    res.status(403);
    throw new Error('Only a System Owner / Developer can assign the dev role.');
  }

  // Prevent self-deactivation
  if (req.user && String(user._id) === String(req.user._id) && req.body.isActive === false) {
    res.status(400);
    throw new Error('You cannot deactivate your own account.');
  }

  const wasActive = user.isActive;
  const oldRole = user.role;
  const isDeactivating = req.body.isActive === false && wasActive === true;
  const isReactivating = req.body.isActive === true && wasActive === false;

  user.name = req.body.name ?? user.name;
  user.role = req.body.role ?? user.role;
  user.department = req.body.department ?? user.department;

  // Auto-sync station if department is Kitchen or Bar and assignedStation wasn't explicitly chosen
  let newStation = req.body.assignedStation ?? user.assignedStation;
  if (!req.body.assignedStation && req.body.department) {
    const deptLower = String(req.body.department).toLowerCase();
    if (deptLower.includes('kitchen')) newStation = 'kitchen';
    else if (deptLower.includes('bar')) newStation = 'bar';
  }
  user.assignedStation = newStation;

  user.isActive = req.body.isActive ?? user.isActive;
  user.phone = req.body.phone ?? user.phone;
  user.telegramChatId = req.body.telegramChatId ?? user.telegramChatId;
  user.employeeId = req.body.employeeId ?? user.employeeId;
  if (req.body.telegramAlerts !== undefined) {
    user.telegramAlerts = Array.isArray(req.body.telegramAlerts) ? req.body.telegramAlerts : [];
  }
  if (req.body.photoUrl !== undefined) {
    user.photoUrl = req.body.photoUrl;
    user.avatar = req.body.photoUrl;
  } else if (req.body.avatar !== undefined) {
    user.avatar = req.body.avatar;
    user.photoUrl = req.body.avatar;
  }
  if (req.body.password) user.password = req.body.password;

  if (req.user) {
    user.updatedBy = req.user._id || null;
    user.updatedByName = req.user.name || user.updatedByName;
    user.updatedByRole = req.user.role || user.updatedByRole;
  }

  const updated = await user.save();

  const Setting = require('../models/Setting');

  // ── 1. If account is DISABLED / REJECTED: automatically STOP Telegram notifications ──
  if (isDeactivating) {
    try {
      const cleanChatId = String(updated.telegramChatId || '').trim();
      const cleanPhone = (updated.phone || '').replace(/\D/g, '').slice(-9);
      const cleanEmail = (updated.email || '').toLowerCase().trim();

      // Direct courtesy alert to that specific chat
      if (cleanChatId) {
        tg.sendToOne && tg.sendToOne(
          cleanChatId,
          `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n🔒 <b>ACCOUNT DISABLED</b>\n\nHello <b>${updated.name}</b>, your staff account has been <b>disabled</b> by the administrator.\n\n🔕 Telegram notifications for this account have been automatically stopped.\n━━━━━━━━━━━━━━━━━━━━`
        );
      }

      // Remove from settings.telegramSubscribers
      const settings = await Setting.findOne();
      if (settings && settings.telegramSubscribers) {
        settings.telegramSubscribers = settings.telegramSubscribers.filter(s => {
          const sChat = String(s.chatId || '').trim();
          const sPhone = (s.phone || '').replace(/\D/g, '').slice(-9);
          const sUser = (s.username || '').toLowerCase().trim();
          if (cleanChatId && sChat === cleanChatId) return false;
          if (cleanPhone && sPhone && sPhone === cleanPhone) return false;
          if (cleanEmail && (sUser === cleanEmail || sUser === `@${cleanEmail}`)) return false;
          return true;
        });
        settings.markModified('telegramSubscribers');
        await settings.save();
      }
    } catch (e) {
      console.warn('[UpdateUser] Could not cleanup Telegram on deactivate:', e.message);
    }
  }

  // ── 2. If account is RE-ENABLED: re-subscribe if they have a chatId ──
  if (isReactivating && updated.telegramChatId) {
    try {
      const settings = await Setting.findOne() || new Setting();
      const subs = settings.telegramSubscribers || [];
      const alreadyExists = subs.some(s => String(s.chatId) === String(updated.telegramChatId));
      if (!alreadyExists) {
        subs.push({
          chatId: String(updated.telegramChatId),
          name: updated.name,
          username: updated.email,
          phone: updated.phone || '',
          subscribedAt: new Date(),
        });
        settings.telegramSubscribers = subs;
        settings.markModified('telegramSubscribers');
        await settings.save();
      }
      tg.sendToOne && tg.sendToOne(
        updated.telegramChatId,
        `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>ACCOUNT RE-ENABLED</b>\n\nHello <b>${updated.name}</b>, your staff account has been re-enabled by the administrator.\n\n🔔 Telegram notifications are now active.\n━━━━━━━━━━━━━━━━━━━━`
      );
    } catch (e) {
      console.warn('[UpdateUser] Could not re-subscribe Telegram on reactivate:', e.message);
    }
  }

  // Auto-subscribe new Telegram chatId if explicitly changed and user is active
  const newChatId = (req.body.telegramChatId || '').trim();
  if (newChatId && updated.isActive) {
    try {
      const settings = await Setting.findOne() || new Setting();
      const subs = settings.telegramSubscribers || [];
      const alreadyExists = subs.some(s => String(s.chatId) === newChatId);
      if (!alreadyExists) {
        subs.push({
          chatId: newChatId,
          name: updated.name,
          username: updated.email,
          phone: updated.phone || '',
          subscribedAt: new Date(),
        });
        settings.telegramSubscribers = subs;
        settings.markModified('telegramSubscribers');
        await settings.save();
      }
    } catch (e) {
      console.warn('[UpdateUser] Could not auto-subscribe Telegram:', e.message);
    }
  }

  // Notify active staff: account enabled / disabled
  if (req.body.isActive !== undefined && req.body.isActive !== wasActive) {
    tg.notifyUserStatusChanged(updated, req.body.isActive ? 'enabled' : 'disabled', req.user);
  }
  // Notify active staff: role changed
  if (req.body.role !== undefined && req.body.role !== oldRole) {
    tg.notifyUserRoleChanged(updated, oldRole, req.body.role, req.user);
  }

  logActivity(req, {
    action: isDeactivating ? 'DEACTIVATE_USER' : isReactivating ? 'REACTIVATE_USER' : 'UPDATE_USER',
    module: 'Users',
    description: isDeactivating
      ? `${req.user.name} deactivated user account ${updated.name}`
      : isReactivating
        ? `${req.user.name} reactivated user account ${updated.name}`
        : `${req.user.name} updated profile/role for user ${updated.name} (${updated.role})`,
    details: { targetUserId: updated._id, name: updated.name, role: updated.role },
  });

  // Sync changes directly into the Employee directory
  try {
    const { syncUserToEmployee } = require('../utils/employeeSync');
    await syncUserToEmployee(updated);
  } catch (syncErr) {
    console.warn('[UpdateUser] Could not sync user to employee directory:', syncErr.message);
  }

  res.json({
    _id: updated._id,
    name: updated.name,
    email: updated.email,
    role: updated.role,
    assignedStation: updated.assignedStation || 'all',
    isActive: updated.isActive,
    phone: updated.phone || '',
    telegramChatId: updated.telegramChatId || '',
    createdByName: updated.createdByName || '',
    createdByRole: updated.createdByRole || '',
    updatedByName: updated.updatedByName || '',
    updatedByRole: updated.updatedByRole || '',
  });
});

const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) { res.status(404); throw new Error('User not found'); }
  if (user.role === 'dev') {
    res.status(403);
    throw new Error('System Owner / Developer accounts cannot be deleted.');
  }
  // Prevent self-deletion
  if (req.user && String(user._id) === String(req.user._id)) {
    res.status(400);
    throw new Error('You cannot delete your own account while logged in.');
  }

  // Automatically remove user from Telegram subscribers and send cancellation alert
  try {
    const cleanChatId = String(user.telegramChatId || '').trim();
    const cleanPhone = (user.phone || '').replace(/\D/g, '').slice(-9);
    const cleanEmail = (user.email || '').toLowerCase().trim();

    if (cleanChatId) {
      tg.sendToOne && tg.sendToOne(
        cleanChatId,
        `🏨 <b>Baba Roti Café</b>\n━━━━━━━━━━━━━━━━━━━━\n🗑️ <b>ACCOUNT REMOVED</b>\n\nHello <b>${user.name}</b>, your staff account has been deleted by the administrator.\n\n🔕 Telegram notifications have been permanently stopped.\n━━━━━━━━━━━━━━━━━━━━`
      );
    }

    const Setting = require('../models/Setting');
    const settings = await Setting.findOne();
    if (settings && settings.telegramSubscribers) {
      settings.telegramSubscribers = settings.telegramSubscribers.filter(s => {
        const sChat = String(s.chatId || '').trim();
        const sPhone = (s.phone || '').replace(/\D/g, '').slice(-9);
        const sUser = (s.username || '').toLowerCase().trim();
        if (cleanChatId && sChat === cleanChatId) return false;
        if (cleanPhone && sPhone && sPhone === cleanPhone) return false;
        if (cleanEmail && (sUser === cleanEmail || sUser === `@${cleanEmail}`)) return false;
        return true;
      });
      settings.markModified('telegramSubscribers');
      await settings.save();
    }
  } catch (e) {
    console.warn('[DeleteUser] Telegram cleanup error:', e.message);
  }

  tg.notifyUserDeleted(user, req.user);

  logActivity(req, {
    action: 'DELETE_USER',
    module: 'Users',
    description: `${req.user.name} deleted user account for ${user.name} (${user.email})`,
    details: { deletedUserId: user._id, name: user.name, role: user.role, email: user.email },
  });

  // Deactivate corresponding Employee record in Employee directory
  try {
    const Employee = require('../models/Employee');
    const { splitFullName } = require('../utils/employeeSync');
    const { firstName, lastName } = splitFullName(user.name);
    await Employee.updateMany(
      {
        $or: [
          ...(user.email ? [{ email: user.email.toLowerCase().trim() }] : []),
          ...(user.employeeId ? [{ employeeId: user.employeeId.trim() }] : []),
          {
            firstName: new RegExp(`^${firstName}$`, 'i'),
            lastName: new RegExp(`^${lastName}$`, 'i'),
          },
        ],
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
          deletedBy: req.user?.name || 'Administrator',
          status: 'inactive',
        },
      }
    );
  } catch (syncErr) {
    console.warn('[DeleteUser] Could not sync user deletion to employee directory:', syncErr.message);
  }

  await user.deleteOne();
  res.json({ message: 'User removed and Telegram notifications stopped.' });
});

module.exports = { getUsers, updateUser, deleteUser };
