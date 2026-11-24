const ActivityLog = require('../models/ActivityLog');
const { getClientIp, parseDevice } = require('./deviceDetector');

/**
 * Log an activity to the audit database.
 * Does not block HTTP responses (runs asynchronously with catch).
 *
 * @param {Object} req Express request object
 * @param {Object} options Activity details
 * @param {String} options.action Action identifier e.g. LOGIN, LOGOUT, CREATE, UPDATE, DELETE, ISSUE, REQUEST
 * @param {String} options.module Module name e.g. Auth, Users, StockRequests, RawMaterials
 * @param {String} options.description Human-readable description
 * @param {String} [options.status='success'] 'success' | 'warning' | 'failed'
 * @param {Object} [options.details={}] Optional key-value metadata
 * @param {Object} [options.userOverride=null] Optional user object if req.user is not yet populated
 */
const logActivity = (req, {
  action,
  module,
  description,
  status = 'success',
  details = {},
  userOverride = null,
}) => {
  try {
    const actor = userOverride || req?.user;
    const ip = getClientIp(req);
    const userAgent = req?.headers ? req.headers['user-agent'] || '' : '';
    const device = parseDevice(userAgent);
    ActivityLog.create({
      user: actor?._id || null,
      userName: actor?.name || 'System / Guest',
      userEmail: actor?.email || '',
      userRole: actor?.role || 'guest',
      userDepartment: actor?.department || '',
      action: String(action || 'ACTION').toUpperCase(),
      module: String(module || 'System'),
      description: String(description || ''),
      ip,
      device,
      userAgent,
      status,
      details,
    }).catch((err) => {
      console.warn('[ActivityLogger] Error writing activity log:', err.message);
    });
  } catch (err) {
    console.warn('[ActivityLogger] Failed to capture log:', err.message);
  }
};

module.exports = {
  logActivity,
};
