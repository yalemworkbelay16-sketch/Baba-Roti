const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');
const Setting = require('../models/Setting');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

/** Check if the authenticated user's role may view a notification */
function canUserViewNotification(n, user, settings) {
  const role = user?.role || '';
  const userId = String(user?._id || '');
  if (role === 'dev' || role === 'admin') return true;

  if (Array.isArray(n.allowedRoles) && n.allowedRoles.length > 0) {
    if (!n.allowedRoles.includes(role)) return false;
  }

  const nav = settings?.navVisibility || {};
  const perms = settings?.rolePermissions || {};

  switch (n.type) {
    case 'stock_request':
      return nav.stockRequests?.[role] ?? ['storekeeper', 'fb_team', 'supervisor', 'executive_chef', 'operation_manager', 'manager'].includes(role);
    case 'transaction':
      return nav.stockMovements?.[role] ?? ['storekeeper', 'fb_team', 'supervisor', 'executive_chef', 'finance', 'operation_manager', 'manager'].includes(role);
    case 'consumption': {
      const canSeeCons = nav.consumption?.[role] ?? ['storekeeper', 'waiter', 'fb_team', 'supervisor', 'executive_chef', 'finance', 'operation_manager', 'manager'].includes(role);
      if (!canSeeCons) return false;
      if (role === 'waiter') {
        const isCreator = n.createdBy && String(n.createdBy) === userId;
        const isTarget = n.targetUserId && String(n.targetUserId) === userId;
        return isCreator || isTarget;
      }
      return true;
    }
    case 'purchase':
      return Boolean(perms.postLedger?.[role] || ['supervisor', 'operation_manager', 'manager', 'finance'].includes(role));
    case 'expense':
      return nav.expenses?.[role] ?? ['storekeeper', 'supervisor', 'operation_manager', 'manager', 'finance'].includes(role);
    case 'material':
    case 'low_stock':
      return nav.rawMaterials?.[role] ?? ['storekeeper', 'fb_team', 'supervisor', 'executive_chef', 'finance', 'operation_manager', 'manager'].includes(role);
    case 'production':
      return nav.production?.[role] ?? ['storekeeper', 'fb_team', 'supervisor', 'executive_chef', 'operation_manager', 'manager'].includes(role);
    case 'pos':
      return nav.pos?.[role] ?? ['storekeeper', 'cashier', 'waiter', 'fb_team', 'supervisor', 'executive_chef', 'operation_manager', 'manager'].includes(role);
    case 'employee':
    case 'user':
      return Boolean(perms.manageAccounts?.[role] || nav.staffAccounts?.[role]);
    case 'system':
      return ['supervisor', 'operation_manager', 'manager', 'finance'].includes(role);
    default:
      return true;
  }
}

// GET /api/notifications — last 40 visible to this role, with unread count
router.get('/', asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const [raw, settings] = await Promise.all([
    Notification.find({ dismissedBy: { $ne: userId } })
      .sort({ createdAt: -1 })
      .limit(60)
      .lean(),
    Setting.findOne().select('navVisibility rolePermissions').lean(),
  ]);

  const notifications = raw
    .filter(n => canUserViewNotification(n, req.user, settings))
    .slice(0, 40);

  const uidStr = userId.toString();
  const unread = notifications.filter(
    n => !(n.readBy || []).some(id => id.toString() === uidStr)
  ).length;

  res.json({ notifications, unread });
}));

// POST /api/notifications/read-all — mark all visible as read for this user
router.post('/read-all', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { readBy: { $ne: req.user._id } },
    { $addToSet: { readBy: req.user._id } }
  );
  res.json({ message: 'All marked as read' });
}));

// DELETE /api/notifications/:id — dismiss notification for this user (preserves for other roles)
router.delete('/:id', asyncHandler(async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, {
    $addToSet: { dismissedBy: req.user._id, readBy: req.user._id },
  });
  res.json({ message: 'Dismissed' });
}));

// DELETE /api/notifications — dismiss all notifications for this user
router.delete('/', asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { dismissedBy: { $ne: req.user._id } },
    { $addToSet: { dismissedBy: req.user._id, readBy: req.user._id } }
  );
  res.json({ message: 'All cleared' });
}));

module.exports = router;
