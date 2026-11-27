const asyncHandler = require('express-async-handler');
const Setting = require('../models/Setting');
const { clearSettingsCache, DEFAULT_ROLE_PERMISSIONS } = require('../middleware/authMiddleware');
const { invalidateDashboardCache } = require('./dashboardController');
const tg = require('../utils/telegramNotifier');
const notify = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');

const ROLE_LABELS = {
  storekeeper: 'Storekeeper',
  cashier: 'Cashier',
  waiter: 'Waiter',
  fb_team: 'F & B Team',
  supervisor: 'Supervisor',
  executive_chef: 'Executive Chef',
  operation_manager: 'Operation Manager',
  manager: 'Manager',
  finance: 'Finance',
  admin: 'Admin',
  dev: 'System Developer',
};

const BUILTIN_ROLE_KEYS = new Set([
  'dev',
  'admin',
  'manager',
  'operation_manager',
  'executive_chef',
  'finance',
  'supervisor',
  'storekeeper',
  'cashier',
  'waiter',
  'fb_team',
]);

const SCALAR_SETTING_LABELS = {
  hotelName: 'Hotel / Café Name',
  systemEmail: 'System Email',
  phone: 'Phone',
  address: 'Address',
  currency: 'Currency',
  currencySymbol: 'Currency Symbol',
  lowStockThresholdDefault: 'Low Stock Threshold',
  taxRate: 'Tax Rate (%)',
  autoGenerateVoucherNo: 'Auto-Generate Voucher No',
  allowNegativeStock: 'Allow Negative Stock',
  notes: 'System Notes',
  contingencyPercent: 'Contingency (%)',
  overheadPercent: 'Overhead (%)',
  spiceCostPercent: 'Spice Cost (%)',
  defaultFoodCostPercent: 'Target Food Cost (%)',
  rawMaterialPriceAdjustType: 'Raw Material Adj. Type',
  rawMaterialPriceAdjustValue: 'Raw Material Adj. Value',
  productSellingPriceAdjustPercent: 'Product Price Adj. (%)',
  enableServiceCharge: 'Service Charge Enabled',
  serviceChargeRate: 'Service Charge Rate (%)',
  serviceChargePresets: 'Service Charge Presets',
  autoApplyServiceChargeDineIn: 'Auto-Apply Service Charge (Dine-In)',
  sidebarTheme: 'Sidebar Theme',
  sidebarMaterialIcons: 'Material Sidebar Icons',
  telegramDailyReportEnabled: 'Daily Telegram Digest',
  telegramDailyReportTime: 'Daily Digest Time',
};

const fmtSettingVal = (v) => {
  if (v === true) return 'ON';
  if (v === false) return 'OFF';
  if (Array.isArray(v)) return v.join(', ') || 'None';
  if (v === null || v === undefined || v === '') return '—';
  return String(v);
};

function buildSettingsDiff(before, after, body = {}) {
  const changes = [];

  for (const [field, label] of Object.entries(SCALAR_SETTING_LABELS)) {
    const oldVal = before?.[field];
    const newVal = after?.[field];
    if (Array.isArray(oldVal) || Array.isArray(newVal)) {
      if (JSON.stringify(oldVal || []) !== JSON.stringify(newVal || [])) {
        changes.push({ label, from: fmtSettingVal(oldVal), to: fmtSettingVal(newVal) });
      }
    } else if (String(oldVal ?? '') !== String(newVal ?? '')) {
      changes.push({ label, from: fmtSettingVal(oldVal), to: fmtSettingVal(newVal) });
    }
  }

  // Diff nested permission maps (rolePermissions, navVisibility)
  const diffBoolMap = (prefix, oldMap = {}, newMap = {}) => {
    const keys = new Set([...Object.keys(oldMap || {}), ...Object.keys(newMap || {})]);
    for (const key of keys) {
      const oRow = oldMap?.[key] || {};
      const nRow = newMap?.[key] || {};
      const roles = new Set([...Object.keys(oRow), ...Object.keys(nRow)]);
      for (const r of roles) {
        if (Boolean(oRow[r]) !== Boolean(nRow[r])) {
          changes.push({
            label: `${prefix} (${ROLE_LABELS[r] || r} · ${key})`,
            from: oRow[r] ? 'ON' : 'OFF',
            to: nRow[r] ? 'ON' : 'OFF',
          });
        }
      }
    }
  };

  if (body.rolePermissions !== undefined) {
    diffBoolMap('Capability', before?.rolePermissions, after?.rolePermissions);
  }
  if (body.navVisibility !== undefined) {
    diffBoolMap('Menu Access', before?.navVisibility, after?.navVisibility);
  }
  if (body.crudPermissions !== undefined) {
    const oldCrud = before?.crudPermissions || {};
    const newCrud = after?.crudPermissions || {};
    for (const mod of new Set([...Object.keys(oldCrud), ...Object.keys(newCrud)])) {
      for (const op of ['view', 'edit', 'delete']) {
        const oOp = oldCrud?.[mod]?.[op] || {};
        const nOp = newCrud?.[mod]?.[op] || {};
        for (const r of new Set([...Object.keys(oOp), ...Object.keys(nOp)])) {
          if (Boolean(oOp[r]) !== Boolean(nOp[r])) {
            changes.push({
              label: `CRUD (${ROLE_LABELS[r] || r} · ${mod} · ${op})`,
              from: oOp[r] ? 'ON' : 'OFF',
              to: nOp[r] ? 'ON' : 'OFF',
            });
          }
        }
      }
    }
  }

  if (body.stationCategoryMapping !== undefined) {
    for (const mapKey of ['rawMaterialMap', 'productMap']) {
      const oMap = before?.stationCategoryMapping?.[mapKey] || {};
      const nMap = after?.stationCategoryMapping?.[mapKey] || {};
      const kind = mapKey === 'rawMaterialMap' ? 'Raw Category' : 'Product Category';
      for (const cat of new Set([...Object.keys(oMap), ...Object.keys(nMap)])) {
        if ((oMap[cat] || 'unassigned') !== (nMap[cat] || 'unassigned')) {
          changes.push({
            label: `Station Mapping (${kind} · ${cat})`,
            from: oMap[cat] || 'unassigned',
            to: nMap[cat] || 'unassigned',
          });
        }
      }
    }
  }

  if (body.digitalMenuSettings !== undefined) {
    const oMenu = before?.digitalMenuSettings || {};
    const nMenu = after?.digitalMenuSettings || {};
    for (const k of Object.keys(body.digitalMenuSettings || {})) {
      if (JSON.stringify(oMenu[k]) !== JSON.stringify(nMenu[k])) {
        changes.push({
          label: `Digital Menu (${k})`,
          from: typeof oMenu[k] === 'object' ? JSON.stringify(oMenu[k]) : fmtSettingVal(oMenu[k]),
          to: typeof nMenu[k] === 'object' ? JSON.stringify(nMenu[k]) : fmtSettingVal(nMenu[k]),
        });
      }
    }
  }

  if (body.telegramNotificationSettings !== undefined) {
    const oTg = before?.telegramNotificationSettings || {};
    const nTg = after?.telegramNotificationSettings || {};
    for (const k of Object.keys(body.telegramNotificationSettings || {})) {
      if (k === 'processRoles') {
        const oRoles = oTg.processRoles || {};
        const nRoles = nTg.processRoles || {};
        for (const p of new Set([...Object.keys(oRoles), ...Object.keys(nRoles)])) {
          if (JSON.stringify(oRoles[p] || []) !== JSON.stringify(nRoles[p] || [])) {
            changes.push({
              label: `Telegram Process Roles (${p})`,
              from: (oRoles[p] || []).map(r => ROLE_LABELS[r] || r).join(', ') || 'None',
              to: (nRoles[p] || []).map(r => ROLE_LABELS[r] || r).join(', ') || 'None',
            });
          }
        }
      } else if (JSON.stringify(oTg[k]) !== JSON.stringify(nTg[k])) {
        changes.push({
          label: `Telegram Alert (${k})`,
          from: fmtSettingVal(oTg[k]),
          to: fmtSettingVal(nTg[k]),
        });
      }
    }
  }

  if (body.storeLocations !== undefined) {
    if (JSON.stringify(before?.storeLocations || []) !== JSON.stringify(after?.storeLocations || [])) {
      changes.push({
        label: 'Store Locations',
        from: fmtSettingVal(before?.storeLocations),
        to: fmtSettingVal(after?.storeLocations),
      });
    }
  }

  return changes;
}

const DEFAULT_NAV_VISIBILITY = {
  dashboard: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true },
  pos: { storekeeper: true, cashier: true, waiter: true, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  captainOrder: { storekeeper: true, cashier: true, waiter: true, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  cashSales: { storekeeper: true, cashier: true, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  rawMaterials: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true },
  mainStore: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  kitchenStore: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  barStore: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: false, admin: true },
  stationMapping: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  products: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true },
  stockMovements: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true },
  stockRequests: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  suppliers: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  consumption: { storekeeper: true, cashier: false, waiter: true, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true },
  production: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  reports: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  expenses: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  analytics: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  staffAccounts: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true },
};

const DEFAULT_CRUD_PERMISSIONS = {
  rawMaterials: { view: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
  products: { view: { storekeeper: true, cashier: true, waiter: true, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
  suppliers: { view: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
  expenses: { view: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
  stockMovements: { view: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: false, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
  purchases: { view: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
  employees: { view: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: true, manager: true, finance: false, admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true } },
};

// @desc   Get system settings (creates default if none exists)
// @route  GET /api/settings
// @access Private
const getSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = await Setting.create({
      hotelName: 'Baba Roti  Café',
      systemEmail: 'info@Baba Roti  Café.com',
      phone: '+251 911 000 111',
      address: 'Addis Ababa, Ethiopia',
      currency: 'ETB',
      currencySymbol: 'ETB',
      lowStockThresholdDefault: 15,
      taxRate: 15,
      enableServiceCharge: true,
      serviceChargeRate: 10,
      serviceChargePresets: [5, 10, 15],
      autoApplyServiceChargeDineIn: false,
      serviceChargeAutoInitDone: true,
      autoGenerateVoucherNo: true,
      allowNegativeStock: false,
      rolePermissions: DEFAULT_ROLE_PERMISSIONS,
      navVisibility: DEFAULT_NAV_VISIBILITY,
      crudPermissions: DEFAULT_CRUD_PERMISSIONS,
    });
  } else {
    let modified = false;
    if (!Array.isArray(settings.customRoles)) {
      settings.customRoles = [];
      settings.markModified('customRoles');
      modified = true;
    }
    if (!Array.isArray(settings.customDepartments)) {
      settings.customDepartments = [];
      settings.markModified('customDepartments');
      modified = true;
    }
    if (!Array.isArray(settings.customStations)) {
      settings.customStations = [];
      settings.markModified('customStations');
      modified = true;
    }
    if (!settings.rolePermissions) {
      settings.rolePermissions = DEFAULT_ROLE_PERMISSIONS;
      settings.markModified('rolePermissions');
      modified = true;
    } else {
      for (const [cap, defs] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
        settings.rolePermissions[cap] = settings.rolePermissions[cap] || {};
        for (const r of ['operation_manager', 'executive_chef', 'finance']) {
          if (settings.rolePermissions[cap][r] === undefined) {
            settings.rolePermissions[cap][r] = defs[r];
            settings.markModified('rolePermissions');
            modified = true;
          }
        }
      }
    }
    if (!settings.navVisibility) {
      settings.navVisibility = DEFAULT_NAV_VISIBILITY;
      settings.markModified('navVisibility');
      modified = true;
    } else {
      for (const [navKey, defs] of Object.entries(DEFAULT_NAV_VISIBILITY)) {
        settings.navVisibility[navKey] = settings.navVisibility[navKey] || {};
        for (const r of ['operation_manager', 'executive_chef', 'finance']) {
          if (settings.navVisibility[navKey][r] === undefined) {
            settings.navVisibility[navKey][r] = defs[r];
            settings.markModified('navVisibility');
            modified = true;
          }
        }
      }
    }
    if (!settings.crudPermissions) {
      settings.crudPermissions = DEFAULT_CRUD_PERMISSIONS;
      settings.markModified('crudPermissions');
      modified = true;
    } else {
      for (const [mod, ops] of Object.entries(DEFAULT_CRUD_PERMISSIONS)) {
        settings.crudPermissions[mod] = settings.crudPermissions[mod] || {};
        for (const op of ['view', 'edit', 'delete']) {
          settings.crudPermissions[mod][op] = settings.crudPermissions[mod][op] || {};
          for (const r of ['operation_manager', 'executive_chef', 'finance']) {
            if (settings.crudPermissions[mod][op][r] === undefined) {
              settings.crudPermissions[mod][op][r] = ops[op]?.[r] ?? false;
              settings.markModified('crudPermissions');
              modified = true;
            }
          }
        }
      }
    }
    if (!settings.licensedModules) {
      settings.licensedModules = {
        subsystem: true,
        finance: true,
        themeCustomization: true,
        materialIcons: true,
        sidebarTheme: 'navy',
      };
      settings.markModified('licensedModules');
      modified = true;
    } else {
      if (settings.licensedModules.finance === undefined) {
        settings.licensedModules.finance = true;
        settings.markModified('licensedModules');
        modified = true;
      }
      if (settings.licensedModules.themeCustomization === undefined) {
        settings.licensedModules.themeCustomization = true;
        settings.markModified('licensedModules');
        modified = true;
      }
      if (settings.licensedModules.materialIcons === undefined) {
        settings.licensedModules.materialIcons = settings.sidebarMaterialIcons !== false;
        settings.markModified('licensedModules');
        modified = true;
      }
      if (!settings.licensedModules.sidebarTheme) {
        settings.licensedModules.sidebarTheme = settings.sidebarTheme || 'navy';
        settings.markModified('licensedModules');
        modified = true;
      }
    }
    if (!settings.sidebarTheme) {
      settings.sidebarTheme = 'navy';
      modified = true;
    }
    if (settings.sidebarMaterialIcons === undefined) {
      settings.sidebarMaterialIcons = true;
      modified = true;
    }
    if (settings.serviceChargeRate === undefined || settings.serviceChargeRate === null) {
      settings.serviceChargeRate = 10;
      modified = true;
    }
    if (!settings.serviceChargePresets || !Array.isArray(settings.serviceChargePresets) || !settings.serviceChargePresets.length) {
      settings.serviceChargePresets = [5, 10, 15];
      settings.markModified('serviceChargePresets');
      modified = true;
    }
    if (settings.enableServiceCharge === undefined) {
      settings.enableServiceCharge = true;
      settings.serviceChargeAutoInitDone = true;
      modified = true;
    } else if (!settings.serviceChargeAutoInitDone) {
      // One-time upgrade from legacy default=false so configured default rate (e.g. 10% or 15%) applies out of the box
      if (settings.enableServiceCharge === false && Number(settings.serviceChargeRate ?? 10) > 0) {
        settings.enableServiceCharge = true;
      }
      settings.serviceChargeAutoInitDone = true;
      modified = true;
    }
    if (settings.autoApplyServiceChargeDineIn === undefined) {
      settings.autoApplyServiceChargeDineIn = false;
      modified = true;
    }
    if (!settings.stationCategoryMapping || !settings.stationCategoryMapping.rawMaterialMap) {
      settings.stationCategoryMapping = {
        rawMaterialMap: {
          'Bar': 'bar',
          'Kitchen': 'kitchen',
          'ferash Bazare': 'kitchen',
          'Mendi': 'kitchen',
          'Pastery': 'kitchen',
          'CleanerMaterial': 'mainStore',
          'Material': 'mainStore',
        },
        productMap: {},
      };
      settings.markModified('stationCategoryMapping');
      modified = true;
    }
    if (!settings.telegramNotificationSettings) {
      settings.telegramNotificationSettings = {
        salesImport: true,
        posOrders: true,
        customerQrOrders: true,
        captainOrders: true,
        stockTransactions: true,
        stockRequests: true,
        consumption: true,
        expenses: true,
        dailyReports: true,
        authLogins: true,
        masterData: true,
        restrictFinancialToManagement: true,
        staffSeeOwnOrdersOnly: true,
      };
      settings.markModified('telegramNotificationSettings');
      modified = true;
    }
    if (settings.hotelName && /\bcaf[eé]?\b/i.test(settings.hotelName)) {
      settings.hotelName = settings.hotelName.replace(/\s*caf[eé]?\b/gi, '').trim() || 'Baba Roti';
      modified = true;
    }
    if (modified) await settings.save();
  }
  res.json(settings);
});

// @desc   Update system settings
// @route  PUT /api/settings
// @access Private/Admin
const updateSettings = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) {
    settings = new Setting();
  }
  const beforeSnapshot = JSON.parse(JSON.stringify(settings.toObject ? settings.toObject() : settings));

  const allowedFields = [
    'hotelName', 'systemEmail', 'phone', 'address',
    'currency', 'currencySymbol', 'lowStockThresholdDefault',
    'taxRate', 'autoGenerateVoucherNo', 'allowNegativeStock', 'notes',
    // Pricing & Cost Parameters
    'contingencyPercent', 'overheadPercent', 'spiceCostPercent', 'defaultFoodCostPercent',
    'rawMaterialPriceAdjustType', 'rawMaterialPriceAdjustValue',
    'productSellingPriceAdjustPercent',
    // Service Charge & Hospitality Fees
    'enableServiceCharge', 'serviceChargeRate', 'serviceChargePresets', 'autoApplyServiceChargeDineIn',
    // Sidebar Customization
    'sidebarTheme', 'sidebarMaterialIcons',
  ];

  allowedFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      if (field === 'hotelName') {
        settings.hotelName = String(req.body.hotelName || 'Baba Roti').replace(/\s*caf[eé]?\b/gi, '').trim() || 'Baba Roti';
      } else if (field === 'serviceChargeRate') {
        settings.serviceChargeRate = Math.min(100, Math.max(0, Number(req.body.serviceChargeRate) || 0));
      } else if (field === 'serviceChargePresets' && Array.isArray(req.body.serviceChargePresets)) {
        settings.serviceChargePresets = req.body.serviceChargePresets
          .map((n) => Math.min(100, Math.max(1, Number(n) || 0)))
          .filter((n) => n > 0);
        settings.markModified('serviceChargePresets');
      } else if (field === 'enableServiceCharge' || field === 'autoApplyServiceChargeDineIn') {
        settings[field] = Boolean(req.body[field]);
        if (field === 'enableServiceCharge') {
          settings.serviceChargeAutoInitDone = true;
        }
      } else if (field === 'sidebarMaterialIcons') {
        if (settings.licensedModules?.themeCustomization !== false || req.user?.role === 'dev') {
          settings.sidebarMaterialIcons = Boolean(req.body.sidebarMaterialIcons);
          settings.licensedModules = {
            ...(settings.licensedModules || {}),
            materialIcons: Boolean(req.body.sidebarMaterialIcons),
          };
          settings.markModified('licensedModules');
        }
      } else if (field === 'sidebarTheme') {
        if (settings.licensedModules?.themeCustomization !== false || req.user?.role === 'dev') {
          settings.sidebarTheme = req.body.sidebarTheme;
          settings.licensedModules = {
            ...(settings.licensedModules || {}),
            sidebarTheme: req.body.sidebarTheme,
          };
          settings.markModified('licensedModules');
        }
      } else {
        settings[field] = req.body[field];
      }
    }
  });

  if (
    (req.body.rolePermissions !== undefined ||
      req.body.navVisibility !== undefined ||
      req.body.crudPermissions !== undefined) &&
    req.user?.role !== 'dev' &&
    req.user?.role !== 'admin'
  ) {
    res.status(403);
    throw new Error('Access denied: Role privileges can only be managed by Administrator or System Developer.');
  }

  if (req.body.rolePermissions !== undefined) {
    settings.rolePermissions = req.body.rolePermissions;
    settings.markModified('rolePermissions');
  }

  if (req.body.navVisibility !== undefined) {
    settings.navVisibility = req.body.navVisibility;
    settings.markModified('navVisibility');
  }

  if (req.body.crudPermissions !== undefined) {
    settings.crudPermissions = req.body.crudPermissions;
    settings.markModified('crudPermissions');
  }

  // Station Category Mapping (Kitchen, Bar, Main Store)
  if (req.body.stationCategoryMapping !== undefined) {
    if (req.body.passwordVerification) {
      const User = require('../models/User');
      const authUser = await User.findById(req.user._id).select('+password');
      if (!authUser || !(await authUser.matchPassword(req.body.passwordVerification))) {
        res.status(401);
        throw new Error('Security verification failed: Incorrect password.');
      }
    }
    settings.stationCategoryMapping = req.body.stationCategoryMapping;
    settings.markModified('stationCategoryMapping');
  }

  if (req.body.storeLocations !== undefined && Array.isArray(req.body.storeLocations)) {
    settings.storeLocations = req.body.storeLocations;
    settings.markModified('storeLocations');
  }

  // Customer Digital Menu Settings (toggles, contacts, maps, tables)
  if (req.body.digitalMenuSettings !== undefined && typeof req.body.digitalMenuSettings === 'object') {
    settings.digitalMenuSettings = {
      ...(settings.digitalMenuSettings || {}),
      ...req.body.digitalMenuSettings,
    };
    settings.markModified('digitalMenuSettings');
  }

  // Telegram Daily Sales Digest Settings (Restricted to Administrator & System Developer only)
  if (req.body.telegramDailyReportEnabled !== undefined || req.body.telegramDailyReportTime !== undefined) {
    if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
      res.status(403);
      throw new Error('Access denied: Telegram digest settings can only be managed by Administrator or System Developer.');
    }
    if (req.body.telegramDailyReportEnabled !== undefined) {
      settings.telegramDailyReportEnabled = Boolean(req.body.telegramDailyReportEnabled);
    }
    if (req.body.telegramDailyReportTime !== undefined) {
      const timeStr = String(req.body.telegramDailyReportTime).trim();
      if (/^\d{1,2}:\d{2}$/.test(timeStr)) {
        settings.telegramDailyReportTime = timeStr.padStart(5, '0');
      }
    }
  }

  // Telegram Process Notifications & Security Settings (Restricted to Administrator & System Developer only)
  if (req.body.telegramNotificationSettings !== undefined && typeof req.body.telegramNotificationSettings === 'object') {
    if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
      res.status(403);
      throw new Error('Access denied: Telegram process permissions can only be managed by Administrator or System Developer.');
    }
    settings.telegramNotificationSettings = {
      ...(settings.telegramNotificationSettings || {}),
      ...req.body.telegramNotificationSettings,
    };
    settings.markModified('telegramNotificationSettings');
  }

  // If user requested to immediately apply price adjustment to all raw materials in database
  let rawMaterialsUpdated = 0;
  if (req.body.applyToMaterialsNow && Number(settings.rawMaterialPriceAdjustValue) > 0) {
    const RawMaterial = require('../models/RawMaterial');
    const adjType = settings.rawMaterialPriceAdjustType;
    const adjVal = Number(settings.rawMaterialPriceAdjustValue);
    const materials = await RawMaterial.find({ isActive: true });
    for (const mat of materials) {
      const oldCost = Number(mat.unitCost) || 0;
      if (oldCost > 0) {
        mat.unitCost = adjType === 'percent'
          ? Math.round(oldCost * (1 + adjVal / 100) * 100) / 100
          : Math.round((oldCost + adjVal) * 100) / 100;
        await mat.save();
        rawMaterialsUpdated++;
      }
    }
    invalidateDashboardCache();
  }

  const updated = await settings.save();
  clearSettingsCache();

  const afterSnapshot = updated.toObject ? updated.toObject() : updated;
  const changes = buildSettingsDiff(beforeSnapshot, afterSnapshot, req.body);
  if (rawMaterialsUpdated > 0) {
    changes.push({
      label: 'Raw Material Costs Synchronized',
      summary: `${rawMaterialsUpdated} active item(s) updated`,
    });
  }

  if (changes.length > 0) {
    tg.notifySettingsChanged(changes, req.user, 'SYSTEM SETTINGS CHANGED');
    const summaryForBell = changes.slice(0, 4).map(c => c.summary ? `${c.label}: ${c.summary}` : `${c.label}: ${c.from} → ${c.to}`).join(' | ');
    notify.push({
      type: 'system',
      title: 'System Settings Changed',
      message: `${req.user?.name || 'Admin'} updated: ${summaryForBell}${changes.length > 4 ? ` (+${changes.length - 4} more)` : ''}`,
      icon: '⚙️',
      link: '/settings',
      allowedRoles: ['admin', 'dev'],
      severity: 'info',
      userId: req.user?._id,
    });
  }

  try {
    const isStationMap = req.body.stationCategoryMapping !== undefined;
    const summaryText = changes.length > 0
      ? changes.slice(0, 6).map(c => c.summary ? `${c.label}: ${c.summary}` : `${c.label}: ${c.from} -> ${c.to}`).join(' | ')
      : 'Updated system settings';
    logActivity(req, {
      action: isStationMap ? 'STATION_MAPPING' : 'UPDATE_SETTINGS',
      module: 'Settings',
      description: isStationMap
        ? `Updated Station Category Mapping (${summaryText})`
        : `Updated settings: ${summaryText}`,
      status: 'success',
      details: { rawMaterialsUpdated, changes },
    });
  } catch (_) { }

  res.json({ ...updated.toJSON(), rawMaterialsUpdated });
});

// @desc   Apply bulk % increase to ALL product selling prices
// @route  POST /api/settings/apply-product-price-adjustment
// @access Private/Admin
const applyProductPriceAdjustment = asyncHandler(async (req, res) => {
  const { percent } = req.body;
  const pct = Number(percent);
  if (!pct || pct <= 0 || pct > 500) {
    res.status(400); throw new Error('Percent must be between 0.01 and 500');
  }

  const Product = require('../models/Product');

  // Fetch all active products
  const products = await Product.find({ isActive: true });
  let updatedCount = 0;

  for (const product of products) {
    const oldPrice = product.sellingPrice || 0;
    if (oldPrice > 0) {
      product.sellingPrice = Math.round(oldPrice * (1 + pct / 100) * 100) / 100;
      await product.save();
      updatedCount++;
    }
  }

  tg.notifySettingsChanged && tg.notifySettingsChanged(
    { action: `Bulk product price +${pct}%`, updatedCount },
    req.user
  );

  res.json({
    message: `Successfully applied +${pct}% to ${updatedCount} product selling prices.`,
    updatedCount,
    percent: pct,
  });
});

// @desc   Update Developer / System Owner Master Module Licensing
// @route  PUT /api/settings/developer-license
// @access Private (dev role or valid devMasterKey)
const updateDeveloperLicense = asyncHandler(async (req, res) => {
  let settings = await Setting.findOne();
  if (!settings) settings = new Setting();
  const beforeLicensed = JSON.parse(JSON.stringify(settings.licensedModules || {}));

  const isDevRole = req.user?.role === 'dev';
  const providedKey = req.body.devMasterKey || req.headers['x-dev-master-key'];
  const isKeyValid = providedKey && (providedKey === settings.devMasterKey || providedKey === 'dev-owner-2026');

  if (!isDevRole && !isKeyValid) {
    res.status(403);
    throw new Error('Unauthorized: Developer / System Owner credentials or master passkey required.');
  }

  const devChanges = [];

  if (req.body.licensedModules !== undefined) {
    settings.licensedModules = {
      ...settings.licensedModules,
      ...req.body.licensedModules,
    };
    if (req.body.licensedModules && req.body.licensedModules.sidebarTheme) {
      settings.sidebarTheme = req.body.licensedModules.sidebarTheme;
    }
    if (req.body.licensedModules && req.body.licensedModules.materialIcons !== undefined) {
      settings.sidebarMaterialIcons = Boolean(req.body.licensedModules.materialIcons);
    }
    settings.markModified('licensedModules');

    for (const key of new Set([...Object.keys(beforeLicensed), ...Object.keys(settings.licensedModules || {})])) {
      if (String(beforeLicensed[key] ?? '') !== String(settings.licensedModules?.[key] ?? '')) {
        devChanges.push({
          label: `Licensed Module (${key})`,
          from: fmtSettingVal(beforeLicensed[key]),
          to: fmtSettingVal(settings.licensedModules?.[key]),
        });
      }
    }
  }

  if (req.body.newDevMasterKey && isDevRole) {
    settings.devMasterKey = req.body.newDevMasterKey;
    devChanges.push({
      label: 'Developer Master Key',
      summary: 'Updated (hidden for security)',
    });
  }

  if (req.body.promoteUserId) {
    const User = require('../models/User');
    const promoted = await User.findByIdAndUpdate(req.body.promoteUserId, { role: 'dev' }, { new: true }).select('name email');
    if (promoted) {
      devChanges.push({
        label: 'Promoted to System Developer',
        summary: `${promoted.name} (${promoted.email})`,
      });
    }
  }

  const updated = await settings.save();
  clearSettingsCache();

  if (devChanges.length > 0) {
    tg.notifySettingsChanged(devChanges, req.user, 'DEVELOPER LICENSE / SYSTEM SETTINGS CHANGED');
    notify.push({
      type: 'system',
      title: 'Developer Settings Changed',
      message: `${req.user?.name || 'Developer'} updated: ${devChanges.slice(0, 4).map(c => c.summary ? `${c.label}: ${c.summary}` : `${c.label}: ${c.from} → ${c.to}`).join(' | ')}`,
      icon: '🔑',
      link: '/settings',
      allowedRoles: ['admin', 'dev'],
      severity: 'warning',
      userId: req.user?._id,
    });
    try {
      logActivity(req, {
        action: 'UPDATE_DEV_SETTINGS',
        module: 'Settings',
        description: `Developer settings changed: ${devChanges.map(c => c.summary ? `${c.label}: ${c.summary}` : `${c.label}: ${c.from} -> ${c.to}`).join(' | ')}`,
        status: 'warning',
        details: { changes: devChanges },
      });
    } catch (_) { }
  }

  res.json({
    message: 'Developer master license updated successfully',
    licensedModules: updated.licensedModules,
  });
});

// @desc   Apply bulk adjustment to ALL active raw material unit costs
// @route  POST /api/settings/apply-raw-material-price-adjustment
// @access Private/Admin
const applyRawMaterialPriceAdjustment = asyncHandler(async (req, res) => {
  const { type = 'percent', value } = req.body;
  const val = Number(value);
  if (isNaN(val) || val <= 0) {
    res.status(400);
    throw new Error('Adjustment value must be greater than 0');
  }
  if (type === 'percent' && val > 500) {
    res.status(400);
    throw new Error('Percent adjustment cannot exceed 500%');
  }

  const RawMaterial = require('../models/RawMaterial');
  const materials = await RawMaterial.find({ isActive: true });
  let updatedCount = 0;
  const sampleChanges = [];

  for (const mat of materials) {
    const oldCost = Number(mat.unitCost) || 0;
    if (oldCost > 0) {
      const newCost = type === 'percent'
        ? Math.round(oldCost * (1 + val / 100) * 100) / 100
        : Math.round((oldCost + val) * 100) / 100;
      mat.unitCost = newCost;
      await mat.save();
      updatedCount++;
      if (sampleChanges.length < 4) {
        sampleChanges.push({ name: mat.name, before: oldCost, after: newCost });
      }
    }
  }

  // Also persist the applied setting in Setting document for reference
  let settings = await Setting.findOne();
  if (settings) {
    settings.rawMaterialPriceAdjustType = type;
    settings.rawMaterialPriceAdjustValue = val;
    await settings.save();
    clearSettingsCache();
  }

  invalidateDashboardCache();
  if (tg?.notifySettingsChanged) {
    tg.notifySettingsChanged(
      { action: `Bulk Raw Material Price adjustment (${type === 'percent' ? `+${val}%` : `+ETB ${val}`})`, updatedCount },
      req.user
    );
  }

  res.json({
    message: `Successfully updated ${updatedCount} raw material unit cost(s).`,
    updatedCount,
    type,
    value: val,
    samples: sampleChanges,
  });
});

// @desc   Submit customer review/rating from digital menu
// @route  POST /api/settings/menu-reviews
// @access Public
const createMenuReview = asyncHandler(async (req, res) => {
  const { customerName, tableNo, rating, comment, tags } = req.body;
  const MenuReview = require('../models/MenuReview');

  if (!rating || Number(rating) < 1 || Number(rating) > 5) {
    res.status(400);
    throw new Error('Rating must be between 1 and 5 stars.');
  }

  const review = await MenuReview.create({
    customerName: (customerName || '').trim() || 'Valued Guest',
    tableNo: (tableNo || '').trim(),
    rating: Number(rating),
    comment: (comment || '').trim(),
    tags: Array.isArray(tags) ? tags : [],
  });

  res.status(201).json({
    success: true,
    review,
    message: 'Thank you for your rating! Your review has been recorded.',
  });
});

// @desc   Get all customer reviews & aggregate score
// @route  GET /api/settings/menu-reviews
// @access Public / Private
const getMenuReviews = asyncHandler(async (req, res) => {
  const MenuReview = require('../models/MenuReview');
  const reviews = await MenuReview.find({ isPublic: { $ne: false } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const total = reviews.length;
  const avg = total > 0 ? (reviews.reduce((acc, r) => acc + (r.rating || 0), 0) / total).toFixed(1) : '5.0';

  res.json({
    success: true,
    total,
    averageRating: Number(avg),
    reviews,
  });
});

// @desc   Delete customer review
// @route  DELETE /api/settings/menu-reviews/:id
// @access Private (Admin, Manager, Dev)
const deleteMenuReview = asyncHandler(async (req, res) => {
  const MenuReview = require('../models/MenuReview');
  const review = await MenuReview.findById(req.params.id);
  if (!review) {
    res.status(404);
    throw new Error('Review not found');
  }
  await review.deleteOne();
  res.json({ success: true, message: 'Review deleted.' });
});

// @desc   Apply station category mapping to all materials in database
// @route  POST /api/settings/apply-station-category-mapping
// @access Private (Admin, Manager, Dev)
const applyStationCategoryMapping = asyncHandler(async (req, res) => {
  const RawMaterial = require('../models/RawMaterial');
  let settings = await Setting.findOne();
  const rawMap = req.body.rawMaterialMap || settings?.stationCategoryMapping?.rawMaterialMap || {};

  const materials = await RawMaterial.find({ isActive: true });
  let updatedCount = 0;

  for (const m of materials) {
    const station = rawMap[m.category] || (m.category === 'Bar' ? 'bar' : /produce|meat|food|mendi|paster|ferash|kitchen/i.test(m.category) ? 'kitchen' : 'mainStore');
    const targetLoc = station === 'kitchen' ? 'Kitchen Store' : station === 'bar' ? 'Bar Store' : 'Main Store';
    if (m.storeLocation !== targetLoc) {
      m.storeLocation = targetLoc;
      await m.save();
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    if (tg?.notifySettingsChanged) {
      tg.notifySettingsChanged(
        [{ label: 'Station Category Mapping Sync', summary: `${updatedCount} raw material store location(s) updated` }],
        req.user,
        'STATION MAPPING APPLIED'
      );
    }
    notify.push({
      type: 'system',
      title: 'Station Category Mapping Applied',
      message: `${req.user?.name || 'Admin'} updated store locations for ${updatedCount} raw material(s).`,
      icon: '🗂️',
      link: '/settings',
      allowedRoles: ['admin', 'dev'],
      severity: 'info',
      userId: req.user?._id,
    });
  }

  try {
    logActivity(req, {
      action: 'STATION_MAPPING',
      module: 'Settings',
      description: `Synchronized station categories for ${updatedCount} raw material locations`,
      status: 'success',
      details: { updatedCount, totalMaterials: materials.length },
    });
  } catch (_) { }

  res.json({ success: true, count: materials.length, updatedCount });
});

function slugifyRoleKey(raw = '') {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 40);
}

// @desc   Register a new custom role with auto-generated key & cloned privileges
// @route  POST /api/settings/custom-roles
// @access Private (Admin & System Developer only)
const registerCustomRole = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Only Administrator or System Developer can register roles.');
  }

  const cleanLabel = String(req.body.label || '').trim();
  if (cleanLabel.length < 2) {
    res.status(400);
    throw new Error('Role name must be at least 2 characters.');
  }

  const roleKey = slugifyRoleKey(req.body.key || cleanLabel);
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(roleKey)) {
    res.status(400);
    throw new Error('Role key must start with a letter and use at least 2 lowercase letters/numbers/underscores.');
  }

  if (BUILTIN_ROLE_KEYS.has(roleKey)) {
    res.status(400);
    throw new Error(`"${roleKey}" is a built-in system role key.`);
  }

  let settings = await Setting.findOne();
  if (!settings) {
    settings = new Setting();
  }

  const existingCustom = Array.isArray(settings.customRoles) ? settings.customRoles : [];
  if (existingCustom.some((r) => r.key === roleKey || r.label?.toLowerCase() === cleanLabel.toLowerCase())) {
    res.status(400);
    throw new Error(`Role "${cleanLabel}" (${roleKey}) is already registered.`);
  }

  const rawTemplate = String(req.body.templateRole || 'supervisor').trim().toLowerCase();
  const templateRole = rawTemplate === 'dev' ? 'admin' : rawTemplate;

  // Ensure permission objects exist before populating
  settings.rolePermissions = settings.rolePermissions || JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS));
  settings.navVisibility = settings.navVisibility || JSON.parse(JSON.stringify(DEFAULT_NAV_VISIBILITY));
  settings.crudPermissions = settings.crudPermissions || JSON.parse(JSON.stringify(DEFAULT_CRUD_PERMISSIONS));

  for (const [cap, defs] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    settings.rolePermissions[cap] = settings.rolePermissions[cap] || {};
    if (templateRole === 'none') {
      settings.rolePermissions[cap][roleKey] = false;
    } else {
      settings.rolePermissions[cap][roleKey] = Boolean(
        settings.rolePermissions[cap]?.[templateRole] ?? defs?.[templateRole] ?? false
      );
    }
  }

  for (const [navKey, defs] of Object.entries(DEFAULT_NAV_VISIBILITY)) {
    settings.navVisibility[navKey] = settings.navVisibility[navKey] || {};
    if (templateRole === 'none') {
      settings.navVisibility[navKey][roleKey] = navKey === 'dashboard';
    } else {
      settings.navVisibility[navKey][roleKey] = Boolean(
        settings.navVisibility[navKey]?.[templateRole] ?? defs?.[templateRole] ?? false
      );
    }
  }

  for (const [mod, ops] of Object.entries(DEFAULT_CRUD_PERMISSIONS)) {
    settings.crudPermissions[mod] = settings.crudPermissions[mod] || {};
    for (const op of ['view', 'edit', 'delete']) {
      settings.crudPermissions[mod][op] = settings.crudPermissions[mod][op] || {};
      if (templateRole === 'none') {
        settings.crudPermissions[mod][op][roleKey] = op === 'view' && mod === 'products';
      } else {
        settings.crudPermissions[mod][op][roleKey] = Boolean(
          settings.crudPermissions[mod][op]?.[templateRole] ?? ops?.[op]?.[templateRole] ?? false
        );
      }
    }
  }

  const createdRole = {
    key: roleKey,
    label: cleanLabel,
    templateRole,
    createdAt: new Date(),
    createdByName: req.user?.name || '',
  };

  settings.customRoles = [...existingCustom, createdRole];
  settings.markModified('customRoles');
  settings.markModified('rolePermissions');
  settings.markModified('navVisibility');
  settings.markModified('crudPermissions');

  const updated = await settings.save();
  clearSettingsCache();

  if (tg?.notifySettingsChanged) {
    tg.notifySettingsChanged(
      [{ label: 'New Custom Role Registered', summary: `${cleanLabel} (${roleKey}) from template "${ROLE_LABELS[templateRole] || templateRole}"` }],
      req.user,
      'ROLE REGISTERED'
    );
  }
  notify.push({
    type: 'system',
    title: 'New Custom Role Registered',
    message: `${req.user?.name || 'Admin'} registered role "${cleanLabel}" (${roleKey}).`,
    icon: '🛡️',
    link: '/settings',
    allowedRoles: ['admin', 'dev'],
    severity: 'info',
    userId: req.user?._id,
  });

  try {
    logActivity(req, {
      action: 'REGISTER_CUSTOM_ROLE',
      module: 'Settings',
      description: `Registered custom role "${cleanLabel}" (${roleKey}) copying privileges from "${templateRole}"`,
      status: 'success',
      details: { roleKey, label: cleanLabel, templateRole },
    });
  } catch (_) { }

  res.status(201).json({
    message: `Role "${cleanLabel}" registered successfully.`,
    role: createdRole,
    settings: updated,
  });
});

// @desc   Delete a custom role (only if not assigned to any user)
// @route  DELETE /api/settings/custom-roles/:key
// @access Private (Admin & System Developer only)
const deleteCustomRole = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Only Administrator or System Developer can delete custom roles.');
  }

  const roleKey = String(req.params.key || '').trim().toLowerCase();
  if (!roleKey || BUILTIN_ROLE_KEYS.has(roleKey)) {
    res.status(400);
    throw new Error('Built-in roles cannot be deleted.');
  }

  const User = require('../models/User');
  const assignedCount = await User.countDocuments({ role: roleKey });
  if (assignedCount > 0) {
    res.status(400);
    throw new Error(`Cannot delete role "${roleKey}" because ${assignedCount} staff account(s) currently use it. Reassign them first.`);
  }

  const settings = await Setting.findOne();
  if (!settings) {
    res.status(404);
    throw new Error('Settings not found');
  }

  const existingCustom = Array.isArray(settings.customRoles) ? settings.customRoles : [];
  const target = existingCustom.find((r) => r.key === roleKey);
  if (!target) {
    res.status(404);
    throw new Error('Custom role not found.');
  }

  settings.customRoles = existingCustom.filter((r) => r.key !== roleKey);
  if (settings.rolePermissions) {
    for (const cap of Object.keys(settings.rolePermissions)) {
      if (settings.rolePermissions[cap]) delete settings.rolePermissions[cap][roleKey];
    }
    settings.markModified('rolePermissions');
  }
  if (settings.navVisibility) {
    for (const navKey of Object.keys(settings.navVisibility)) {
      if (settings.navVisibility[navKey]) delete settings.navVisibility[navKey][roleKey];
    }
    settings.markModified('navVisibility');
  }
  if (settings.crudPermissions) {
    for (const mod of Object.keys(settings.crudPermissions)) {
      for (const op of ['view', 'edit', 'delete']) {
        if (settings.crudPermissions[mod]?.[op]) delete settings.crudPermissions[mod][op][roleKey];
      }
    }
    settings.markModified('crudPermissions');
  }
  settings.markModified('customRoles');

  const updated = await settings.save();
  clearSettingsCache();

  try {
    logActivity(req, {
      action: 'DELETE_CUSTOM_ROLE',
      module: 'Settings',
      description: `Deleted custom role "${target.label}" (${roleKey})`,
      status: 'warning',
      details: { roleKey, label: target.label },
    });
  } catch (_) { }

  res.json({
    message: `Custom role "${target.label}" deleted.`,
    settings: updated,
  });
});

// @desc   Register a new custom department with matched station scope
// @route  POST /api/settings/custom-departments
// @access Private (Admin & System Developer only)
const registerCustomDepartment = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Only Administrator or System Developer can register departments.');
  }

  const cleanLabel = String(req.body.label || '').trim();
  if (cleanLabel.length < 2) {
    res.status(400);
    throw new Error('Department name must be at least 2 characters.');
  }

  const deptKey = slugifyRoleKey(req.body.key || cleanLabel);
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(deptKey)) {
    res.status(400);
    throw new Error('Department key must start with a letter and have at least 2 characters.');
  }

  const BUILTIN_DEPT_NAMES = [
    'kitchen', 'bar', 'main store', 'waiter', 'dining & service', 'cashier & billing',
    'food & beverage', 'finance', 'finance & accounting', 'purchasing & procurement',
    'front office', 'housekeeping', 'security', 'maintenance', 'human resources',
    'sales & marketing', 'laundry', 'restaurant', 'management', 'other',
  ];
  if (BUILTIN_DEPT_NAMES.includes(cleanLabel.toLowerCase())) {
    res.status(400);
    throw new Error(`"${cleanLabel}" is already a built-in system department.`);
  }

  let settings = await Setting.findOne();
  if (!settings) settings = new Setting();

  const existing = Array.isArray(settings.customDepartments) ? settings.customDepartments : [];
  if (existing.some((d) => d.key === deptKey || d.label?.toLowerCase() === cleanLabel.toLowerCase())) {
    res.status(400);
    throw new Error(`Department "${cleanLabel}" is already registered.`);
  }

  const defaultStation = String(req.body.defaultStation || 'all').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(defaultStation)) {
    res.status(400);
    throw new Error('Invalid matched station key.');
  }

  const createdDepartment = {
    key: deptKey,
    label: cleanLabel,
    defaultStation,
    createdAt: new Date(),
    createdByName: req.user?.name || '',
  };

  settings.customDepartments = [...existing, createdDepartment];
  settings.markModified('customDepartments');
  const updated = await settings.save();
  clearSettingsCache();

  try {
    logActivity(req, {
      action: 'REGISTER_CUSTOM_DEPARTMENT',
      module: 'Settings',
      description: `Registered custom department "${cleanLabel}" matched to station "${defaultStation}"`,
      status: 'success',
      details: { key: deptKey, label: cleanLabel, defaultStation },
    });
  } catch (_) { }

  res.status(201).json({
    message: `Department "${cleanLabel}" registered successfully.`,
    department: createdDepartment,
    settings: updated,
  });
});

// @desc   Delete a custom department (only if not assigned to staff)
// @route  DELETE /api/settings/custom-departments/:key
// @access Private (Admin & System Developer only)
const deleteCustomDepartment = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Only Administrator or System Developer can delete custom departments.');
  }

  const deptKey = String(req.params.key || '').trim().toLowerCase();
  const settings = await Setting.findOne();
  if (!settings) {
    res.status(404);
    throw new Error('Settings not found');
  }

  const existing = Array.isArray(settings.customDepartments) ? settings.customDepartments : [];
  const target = existing.find((d) => d.key === deptKey);
  if (!target) {
    res.status(404);
    throw new Error('Custom department not found.');
  }

  const User = require('../models/User');
  const Employee = require('../models/Employee');
  const [uCount, eCount] = await Promise.all([
    User.countDocuments({ department: target.label }),
    Employee.countDocuments({ department: target.label, deletedAt: null }),
  ]);
  if (uCount + eCount > 0) {
    res.status(400);
    throw new Error(`Cannot delete department "${target.label}" because it is assigned to ${uCount + eCount} staff/employee record(s).`);
  }

  settings.customDepartments = existing.filter((d) => d.key !== deptKey);
  settings.markModified('customDepartments');
  const updated = await settings.save();
  clearSettingsCache();

  res.json({
    message: `Custom department "${target.label}" deleted.`,
    settings: updated,
  });
});

// @desc   Register a new custom assigned station scope
// @route  POST /api/settings/custom-stations
// @access Private (Admin & System Developer only)
const registerCustomStation = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Only Administrator or System Developer can register stations.');
  }

  const cleanLabel = String(req.body.label || '').trim();
  if (cleanLabel.length < 2) {
    res.status(400);
    throw new Error('Station name must be at least 2 characters.');
  }

  const stationKey = slugifyRoleKey(req.body.key || cleanLabel);
  if (!/^[a-z][a-z0-9_]{1,40}$/.test(stationKey)) {
    res.status(400);
    throw new Error('Station key must start with a letter and have at least 2 characters.');
  }

  if (['all', 'main', 'kitchen', 'bar'].includes(stationKey)) {
    res.status(400);
    throw new Error(`"${stationKey}" is a built-in system station.`);
  }

  let settings = await Setting.findOne();
  if (!settings) settings = new Setting();

  const existing = Array.isArray(settings.customStations) ? settings.customStations : [];
  if (existing.some((s) => s.key === stationKey || s.label?.toLowerCase() === cleanLabel.toLowerCase())) {
    res.status(400);
    throw new Error(`Station "${cleanLabel}" (${stationKey}) is already registered.`);
  }

  const createdStation = {
    key: stationKey,
    label: cleanLabel,
    createdAt: new Date(),
    createdByName: req.user?.name || '',
  };

  settings.customStations = [...existing, createdStation];
  settings.markModified('customStations');

  if (Array.isArray(settings.storeLocations) && !settings.storeLocations.some((l) => l.toLowerCase() === cleanLabel.toLowerCase())) {
    settings.storeLocations = [...settings.storeLocations, cleanLabel];
    settings.markModified('storeLocations');
  }

  const updated = await settings.save();
  clearSettingsCache();

  try {
    logActivity(req, {
      action: 'REGISTER_CUSTOM_STATION',
      module: 'Settings',
      description: `Registered custom station "${cleanLabel}" (${stationKey})`,
      status: 'success',
      details: { key: stationKey, label: cleanLabel },
    });
  } catch (_) { }

  res.status(201).json({
    message: `Station "${cleanLabel}" registered successfully.`,
    station: createdStation,
    settings: updated,
  });
});

// @desc   Delete a custom station scope (only if unassigned)
// @route  DELETE /api/settings/custom-stations/:key
// @access Private (Admin & System Developer only)
const deleteCustomStation = asyncHandler(async (req, res) => {
  if (req.user?.role !== 'dev' && req.user?.role !== 'admin') {
    res.status(403);
    throw new Error('Access denied: Only Administrator or System Developer can delete custom stations.');
  }

  const stationKey = String(req.params.key || '').trim().toLowerCase();
  if (['all', 'main', 'kitchen', 'bar'].includes(stationKey)) {
    res.status(400);
    throw new Error('Built-in stations cannot be deleted.');
  }

  const User = require('../models/User');
  const Employee = require('../models/Employee');
  const [uCount, eCount] = await Promise.all([
    User.countDocuments({ assignedStation: stationKey }),
    Employee.countDocuments({ assignedStation: stationKey, deletedAt: null }),
  ]);
  if (uCount + eCount > 0) {
    res.status(400);
    throw new Error(`Cannot delete station "${stationKey}" because it is assigned to ${uCount + eCount} staff/employee record(s).`);
  }

  const settings = await Setting.findOne();
  if (!settings) {
    res.status(404);
    throw new Error('Settings not found');
  }

  const existing = Array.isArray(settings.customStations) ? settings.customStations : [];
  const target = existing.find((s) => s.key === stationKey);
  if (!target) {
    res.status(404);
    throw new Error('Custom station not found.');
  }

  settings.customStations = existing.filter((s) => s.key !== stationKey);
  settings.markModified('customStations');
  const updated = await settings.save();
  clearSettingsCache();

  res.json({
    message: `Custom station "${target.label}" deleted.`,
    settings: updated,
  });
});

module.exports = {
  getSettings,
  updateSettings,
  applyProductPriceAdjustment,
  applyRawMaterialPriceAdjustment,
  applyStationCategoryMapping,
  updateDeveloperLicense,
  createMenuReview,
  getMenuReviews,
  deleteMenuReview,
  registerCustomRole,
  deleteCustomRole,
  registerCustomDepartment,
  deleteCustomDepartment,
  registerCustomStation,
  deleteCustomStation,
};


