const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Setting = require('../models/Setting');

const JWT_SECRET = process.env.JWT_SECRET || 'baba_roti_cafe_super_secret_jwt_key_2024';

const DEFAULT_ROLE_PERMISSIONS = {
  recordGoods:      { storekeeper: true,  cashier: false, waiter: false, fb_team: false, supervisor: true,  manager: true,  admin: true },
  checkReview:      { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true,  manager: true,  admin: true },
  approveGoods:     { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, manager: false, admin: true },
  postLedger:       { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true,  manager: true,  admin: true },
  voidTransactions: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, manager: false, admin: true },
  transferStationStock: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, manager: true, admin: true },
  manageStationMapping: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, manager: true, admin: true },
  viewReports:      { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true,  manager: true,  admin: true },
  manageAccounts:   { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, manager: false, admin: true },
};

let cachedSettings = null;
let lastSettingsFetch = 0;

const getCachedRolePermissions = async () => {
  const now = Date.now();
  if (!cachedSettings || now - lastSettingsFetch > 5000) {
    try {
      cachedSettings = await Setting.findOne();
      lastSettingsFetch = now;
    } catch (err) {
      console.error('Error fetching settings in authMiddleware:', err);
    }
  }
  return cachedSettings?.rolePermissions || DEFAULT_ROLE_PERMISSIONS;
};

const clearSettingsCache = () => {
  cachedSettings = null;
  lastSettingsFetch = 0;
};

const hasPermission = async (role, capability) => {
  if (!role) return false;
  if (role === 'dev') return true; // System Owner / Developer has full access to all capabilities
  const rolePermissions = await getCachedRolePermissions();
  if (role === 'admin') {
    const adminPerm = rolePermissions?.[capability]?.admin;
    return adminPerm !== false;
  }
  const val = rolePermissions?.[capability]?.[role];
  if (val !== undefined) return Boolean(val);
  return Boolean(DEFAULT_ROLE_PERMISSIONS?.[capability]?.[role]);
};

const protect = asyncHandler(async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user || !req.user.isActive) {
        res.status(401);
        throw new Error('Not authorized, account inactive or not found');
      }

      // Throttle user heartbeat activity update (at most once every 60 seconds)
      const now = Date.now();
      const lastActive = req.user.lastActiveAt ? new Date(req.user.lastActiveAt).getTime() : 0;
      if (now - lastActive > 60 * 1000) {
        User.updateOne(
          { _id: req.user._id },
          { $set: { isOnline: true, lastActiveAt: new Date() } }
        ).catch(() => {});
      }

      return next();
    } catch (error) {
      res.status(401);
      throw new Error('Not authorized, token failed');
    }
  }

  res.status(401);
  throw new Error('Not authorized, no token provided');
});

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, no user found');
    }
    // 'dev' role is super-admin / system owner and passes all role gates
    if (req.user.role === 'dev' || roles.includes(req.user.role)) {
      return next();
    }
    res.status(403);
    throw new Error(`Role '${req.user.role}' is not permitted to perform this action`);
  };
};

const authorizePermission = (capability) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401);
      throw new Error('Not authorized, no user found');
    }
    const permitted = await hasPermission(req.user.role, capability);
    if (!permitted) {
      res.status(403);
      throw new Error(`Your role '${req.user.role}' is not permitted to perform this action (${capability})`);
    }
    next();
  });
};

/**
 * Gate check for system module licensing (e.g. 'subsystem')
 * If the module has been locked/disabled by the developer, non-dev requests are rejected.
 */
const verifyModuleLicense = (moduleName) => {
  return asyncHandler(async (req, res, next) => {
    if (req.user?.role === 'dev') return next();
    const settings = await Setting.findOne();
    const isLicensed = settings?.licensedModules?.[moduleName] !== false;
    if (!isLicensed) {
      res.status(403);
      throw new Error(`The '${moduleName}' module is locked and not licensed for this hotel installation. Please contact the system developer / vendor.`);
    }
    next();
  });
};

module.exports = {
  protect,
  authorize,
  authorizePermission,
  hasPermission,
  verifyModuleLicense,
  clearSettingsCache,
  getCachedRolePermissions,
  DEFAULT_ROLE_PERMISSIONS,
};

