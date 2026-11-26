/**
 * In-app Notification Helper
 * Creates persistent notifications in MongoDB that the Topbar bell reads.
 * All calls are fire-and-forget (non-blocking).
 */
const Notification = require('../models/Notification');

function push({
  type = 'system',
  title,
  message,
  icon = '📦',
  link = '',
  entityId = '',
  voucherNo = '',
  severity = 'info',
  userId,
  targetUserId = null,
  allowedRoles = [],
}) {
  const idStr = entityId ? String(entityId) : '';
  const finalLink =
    link && idStr && !link.includes('highlight=')
      ? `${link}${link.includes('?') ? '&' : '?'}highlight=${encodeURIComponent(idStr)}`
      : link;

  Notification.create({
    type,
    title,
    message,
    icon,
    link: finalLink,
    entityId: idStr,
    voucherNo: voucherNo ? String(voucherNo) : '',
    severity,
    createdBy: userId || null,
    targetUserId: targetUserId || null,
    allowedRoles: Array.isArray(allowedRoles) ? allowedRoles : [],
  }).catch(err => console.warn('[Notification] push failed:', err.message));
}

module.exports = { push };
