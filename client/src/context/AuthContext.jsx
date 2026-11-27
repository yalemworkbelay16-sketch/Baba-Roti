import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const DEFAULT_PERMISSIONS = {
  recordGoods: { storekeeper: true, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  checkReview: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: true, admin: true },
  approveGoods: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true },
  postLedger: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  voidTransactions: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true },
  transferStationStock: { storekeeper: true, cashier: false, waiter: false, fb_team: true, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  manageStationMapping: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: true, operation_manager: true, manager: true, finance: false, admin: true },
  viewReports: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
  manageAccounts: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true },
};

// CRUD privilege defaults per module
// Modules: rawMaterials, products, suppliers, expenses, stockMovements, purchases, employees
const CRUD_MODULES = [
  'rawMaterials', 'products', 'suppliers', 'expenses',
  'stockMovements', 'purchases', 'employees',
];
const DEFAULT_CRUD_PERMISSIONS = Object.fromEntries(
  CRUD_MODULES.map((mod) => [
    mod,
    {
      view: { storekeeper: true, cashier: mod === 'products', waiter: mod === 'products', fb_team: ['rawMaterials', 'products', 'stockMovements'].includes(mod), supervisor: true, executive_chef: ['rawMaterials', 'products', 'stockMovements'].includes(mod), operation_manager: true, manager: true, finance: true, admin: true },
      edit: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: !['suppliers', 'employees'].includes(mod), executive_chef: ['rawMaterials', 'products'].includes(mod), operation_manager: true, manager: true, finance: ['suppliers', 'expenses', 'purchases'].includes(mod), admin: true },
      delete: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: false, executive_chef: false, operation_manager: false, manager: false, finance: false, admin: true },
    },
  ])
);
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
  activityLog: { storekeeper: false, cashier: false, waiter: false, fb_team: false, supervisor: true, executive_chef: false, operation_manager: true, manager: true, finance: true, admin: true },
};

const BUILTIN_ROLE_LABELS = {
  admin: 'Admin',
  manager: 'Manager',
  operation_manager: 'Operation Manager',
  executive_chef: 'Executive Chef',
  finance: 'Finance',
  supervisor: 'Supervisor',
  storekeeper: 'Store Keeper',
  cashier: 'Cashier',
  waiter: 'Waiter',
  fb_team: 'F & B Team',
  dev: 'System Developer',
};

const BUILTIN_DEPARTMENTS = [
  { label: 'Kitchen', icon: '🍳', defaultStation: 'kitchen' },
  { label: 'Bar', icon: '☕', defaultStation: 'bar' },
  { label: 'Main Store', icon: '🏢', defaultStation: 'main' },
  { label: 'Waiter', icon: '🍽️', defaultStation: 'all' },
  { label: 'Dining & Service', icon: '🍽️', defaultStation: 'all' },
  { label: 'Cashier & Billing', icon: '💵', defaultStation: 'all' },
  { label: 'Food & Beverage', icon: '🍴', defaultStation: 'all' },
  { label: 'Finance', icon: '💼', defaultStation: 'all' },
  { label: 'Finance & Accounting', icon: '💼', defaultStation: 'all' },
  { label: 'Purchasing & Procurement', icon: '🛒', defaultStation: 'main' },
  { label: 'Management', icon: '👔', defaultStation: 'all' },
  { label: 'Front Office', icon: '🏨', defaultStation: 'all' },
  { label: 'Housekeeping', icon: '🧹', defaultStation: 'all' },
  { label: 'Maintenance', icon: '🔧', defaultStation: 'all' },
  { label: 'Security', icon: '🛡️', defaultStation: 'all' },
  { label: 'Human Resources', icon: '👥', defaultStation: 'all' },
  { label: 'Sales & Marketing', icon: '📣', defaultStation: 'all' },
  { label: 'Laundry', icon: '🧺', defaultStation: 'all' },
  { label: 'Restaurant', icon: '🍲', defaultStation: 'all' },
  { label: 'Other', icon: '📌', defaultStation: 'all' },
];

const BUILTIN_STATIONS = [
  { key: 'all', label: 'All Stations (Combined Access — Full Store)', shortLabel: 'All Stations' },
  { key: 'kitchen', label: 'Kitchen Station Only (Locked to Kitchen)', shortLabel: 'Kitchen Station' },
  { key: 'bar', label: 'Bar Station Only (Locked to Bar)', shortLabel: 'Bar Station' },
  { key: 'main', label: 'Main Store Only (Locked to Warehouse)', shortLabel: 'Main Store' },
];

const ROLE_TO_DEFAULT_DEPT = {
  executive_chef: 'Kitchen',
  storekeeper: 'Main Store',
  cashier: 'Cashier & Billing',
  waiter: 'Waiter',
  fb_team: 'Food & Beverage',
  finance: 'Finance',
  supervisor: 'Management',
  operation_manager: 'Management',
  manager: 'Management',
  admin: 'Management',
  dev: 'Management',
};

const DEFAULT_LICENSED_MODULES = {
  subsystem: true,
  finance: true,
  themeCustomization: true,
  materialIcons: true,
  sidebarTheme: 'navy',
};

/** Clear every settings-related key from localStorage */
const clearSettingsCache = () => {
  localStorage.removeItem('hotelStockPermissions');
  localStorage.removeItem('hotelStockNavVisibility');
  localStorage.removeItem('hotelStockCrudPermissions');
  localStorage.removeItem('hotelStockCustomRoles');
  localStorage.removeItem('hotelStockCustomDepartments');
  localStorage.removeItem('hotelStockCustomStations');
  localStorage.removeItem('hotelStockLicensedModules');
};

export const AuthProvider = ({ children }) => {
  // Synchronous initial state restoration from localStorage: eliminates blank loading screen
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('hotelStockAuth');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [rolePermissions, setRolePermissions] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockPermissions');
      return cached ? JSON.parse(cached) : DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  });

  const [navVisibility, setNavVisibility] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockNavVisibility');
      return cached ? JSON.parse(cached) : DEFAULT_NAV_VISIBILITY;
    } catch {
      return DEFAULT_NAV_VISIBILITY;
    }
  });

  const [crudPermissions, setCrudPermissions] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockCrudPermissions');
      return cached ? JSON.parse(cached) : DEFAULT_CRUD_PERMISSIONS;
    } catch {
      return DEFAULT_CRUD_PERMISSIONS;
    }
  });

  const [licensedModules, setLicensedModules] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockLicensedModules');
      return cached ? JSON.parse(cached) : DEFAULT_LICENSED_MODULES;
    } catch {
      return DEFAULT_LICENSED_MODULES;
    }
  });

  const [customRoles, setCustomRoles] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockCustomRoles');
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [customDepartments, setCustomDepartments] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockCustomDepartments');
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [customStations, setCustomStations] = useState(() => {
    try {
      const cached = localStorage.getItem('hotelStockCustomStations');
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Zero-millisecond initial load: never block rendering if auth state is known
  const [loading, setLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    try {
      // 4-second timeout so a cold-starting or lagging server never hangs the app
      const res = await api.get('/settings', { timeout: 4000 });
      if (res.data?.rolePermissions) {
        setRolePermissions(res.data.rolePermissions);
        localStorage.setItem('hotelStockPermissions', JSON.stringify(res.data.rolePermissions));
      }
      if (res.data?.navVisibility) {
        setNavVisibility(res.data.navVisibility);
        localStorage.setItem('hotelStockNavVisibility', JSON.stringify(res.data.navVisibility));
      }
      if (res.data?.crudPermissions) {
        setCrudPermissions(res.data.crudPermissions);
        localStorage.setItem('hotelStockCrudPermissions', JSON.stringify(res.data.crudPermissions));
      }
      if (Array.isArray(res.data?.customRoles)) {
        setCustomRoles(res.data.customRoles);
        localStorage.setItem('hotelStockCustomRoles', JSON.stringify(res.data.customRoles));
      }
      if (Array.isArray(res.data?.customDepartments)) {
        setCustomDepartments(res.data.customDepartments);
        localStorage.setItem('hotelStockCustomDepartments', JSON.stringify(res.data.customDepartments));
      }
      if (Array.isArray(res.data?.customStations)) {
        setCustomStations(res.data.customStations);
        localStorage.setItem('hotelStockCustomStations', JSON.stringify(res.data.customStations));
      }
      // Always update licensedModules from server — even { subsystem: false } must apply
      const lm = res.data?.licensedModules ?? DEFAULT_LICENSED_MODULES;
      setLicensedModules(lm);
      localStorage.setItem('hotelStockLicensedModules', JSON.stringify(lm));
      return res.data;
    } catch (err) {
      // Network failure or cold server: fall back to localStorage cache if available, else hardcoded defaults
      try {
        const cachedRP = localStorage.getItem('hotelStockPermissions');
        const cachedNV = localStorage.getItem('hotelStockNavVisibility');
        const cachedCP = localStorage.getItem('hotelStockCrudPermissions');
        const cachedLM = localStorage.getItem('hotelStockLicensedModules');
        if (cachedRP) setRolePermissions(JSON.parse(cachedRP));
        if (cachedNV) setNavVisibility(JSON.parse(cachedNV));
        if (cachedCP) setCrudPermissions(JSON.parse(cachedCP));
        if (cachedLM) setLicensedModules(JSON.parse(cachedLM));
      } catch { /* ignore parse errors */ }
      console.warn('Could not fetch settings from server, using cache/defaults', err?.message || err);
    }
    return null;
  }, []);

  // On mount: if logged in, refresh permissions in the background without blocking the UI
  useEffect(() => {
    const stored = localStorage.getItem('hotelStockAuth');
    if (stored) {
      fetchPermissions().catch(() => { });
    }
  }, [fetchPermissions]);

  // Heartbeat to keep user marked as online while active
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      api.post('/auth/heartbeat').catch(() => { });
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user]);

  const login = async (email, password, otpToken) => {
    const { data } = await api.post('/auth/login', { email, password }, {
      headers: { 'x-otp-token': otpToken || '' },
    });
    localStorage.setItem('hotelStockAuth', JSON.stringify(data));
    setUser(data);
    // Fetch authoritative settings right after login — no stale cache possible
    await fetchPermissions();
    return data;
  };

  const logout = () => {
    // Notify server of logout asynchronously to immediately set offline
    api.post('/auth/logout').catch(() => { });

    localStorage.removeItem('hotelStockAuth');
    // Clear ALL cached settings so the next login always reads fresh server data
    clearSettingsCache();
    setUser(null);
    setRolePermissions(DEFAULT_PERMISSIONS);
    setNavVisibility(DEFAULT_NAV_VISIBILITY);
    setCrudPermissions(DEFAULT_CRUD_PERMISSIONS);
    setLicensedModules(DEFAULT_LICENSED_MODULES); // ← reset subsystem license state on logout
  };

  const updateUser = (updatedData) => {
    const newUser = { ...user, ...updatedData };
    localStorage.setItem('hotelStockAuth', JSON.stringify(newUser));
    setUser(newUser);
  };

  const hasRole = (...roles) => {
    if (!user) return false;
    if (user.role === 'dev') return true; // System Owner has full access to all role gates
    return roles.includes(user.role);
  };

  /** Check a workflow/action capability (e.g. 'recordGoods') */
  const can = (capability) => {
    if (!user) return false;
    if (user.role === 'dev') return true; // System Owner has full capability
    if (user.role === 'admin') {
      const adminVal = rolePermissions?.[capability]?.admin;
      return adminVal !== false;
    }
    const val = rolePermissions?.[capability]?.[user.role];
    if (val !== undefined) return Boolean(val);
    return Boolean(DEFAULT_PERMISSIONS?.[capability]?.[user.role]);
  };

  /**
   * Check CRUD permission: canCrud('rawMaterials', 'delete')
   * action = 'view' | 'edit' | 'delete'
   */
  const canCrud = (module, action) => {
    if (!user) return false;
    if (user.role === 'dev') return true;
    const modPerms = crudPermissions?.[module] || DEFAULT_CRUD_PERMISSIONS?.[module];
    if (!modPerms) return user.role === 'admin';
    const actionPerms = modPerms[action] || DEFAULT_CRUD_PERMISSIONS?.[module]?.[action];
    if (!actionPerms) return user.role === 'admin';
    const val = actionPerms[user.role];
    if (val !== undefined) return Boolean(val);
    return Boolean(DEFAULT_CRUD_PERMISSIONS?.[module]?.[action]?.[user.role]);
  };

  /** Check if a module is licensed / unlocked by the developer */
  const isModuleLicensed = (moduleKey) => {
    return Boolean(licensedModules?.[moduleKey] ?? true);
  };

  /** Check whether a sidebar nav section is visible for this user's role */
  const canSeeNav = (navKey) => {
    if (!user) return false;
    // Digital Menu master gating: if locked by dev, hide completely from non-dev users!
    if (navKey === 'digitalMenu') {
      if (licensedModules?.digitalMenu === false && user.role !== 'dev') {
        return false;
      }
    }
    // Subsystem master gating: if locked by dev, hide completely from non-dev users!
    // This gates the parent 'subsystem' key AND its children (pos, captainOrder, cashSales)
    if (['subsystem', 'pos', 'captainOrder', 'cashSales'].includes(navKey)) {
      if (licensedModules?.subsystem === false && user.role !== 'dev') {
        return false;
      }
    }
    // Finance & Expenses master gating: if locked by dev, hide completely from non-dev users!
    // This gates the parent 'finance' key AND its children (expenses, analytics)
    if (['finance', 'expenses', 'analytics'].includes(navKey)) {
      if (licensedModules?.finance === false && user.role !== 'dev') {
        return false;
      }
    }
    if (user.role === 'dev') return true;

    const nav = navVisibility ?? DEFAULT_NAV_VISIBILITY;
    if (navKey === 'subsystem') {
      const p = nav.pos?.[user.role] ?? DEFAULT_NAV_VISIBILITY.pos?.[user.role] ?? true;
      const c = nav.captainOrder?.[user.role] ?? DEFAULT_NAV_VISIBILITY.captainOrder?.[user.role] ?? true;
      const s = nav.cashSales?.[user.role] ?? DEFAULT_NAV_VISIBILITY.cashSales?.[user.role] ?? true;
      return Boolean(p || c || s);
    }
    const entry = nav[navKey] || DEFAULT_NAV_VISIBILITY[navKey];
    if (!entry) return true; // unknown key — show by default
    const val = entry[user.role];
    if (val !== undefined) return Boolean(val);
    const defaultVal = DEFAULT_NAV_VISIBILITY[navKey]?.[user.role];
    if (defaultVal !== undefined) return Boolean(defaultVal);
    return true;
  };

  /**
   * Determine the user's primary authorized landing page.
   * If they can see the dashboard, it returns '/'.
   * Otherwise, it finds the first accessible route based on station/role permissions.
   */
  const getDefaultLandingUrl = (currentUser = user) => {
    if (!currentUser) return '/login';
    if (currentUser.role === 'dev') return '/';

    const userStation = (currentUser?.assignedStation && currentUser?.assignedStation !== 'all')
      ? currentUser.assignedStation
      : String(currentUser?.department || '').toLowerCase().includes('kitchen')
        ? 'kitchen'
        : String(currentUser?.department || '').toLowerCase().includes('bar')
          ? 'bar'
          : currentUser?.assignedStation || 'all';

    // Station restricted staff go directly to their station store ONLY if allowed to view it
    const isStaffStationRestricted = userStation !== 'all' && !['admin', 'manager', 'dev'].includes(currentUser.role);
    if (isStaffStationRestricted && userStation === 'kitchen' && (canSeeNav('kitchenStore') || canSeeNav('rawMaterials'))) {
      return '/materials?station=kitchen';
    }
    if (isStaffStationRestricted && userStation === 'bar' && (canSeeNav('barStore') || canSeeNav('rawMaterials'))) {
      return '/materials?station=bar';
    }

    // If dashboard is permitted for this role, land on dashboard
    if (canSeeNav('dashboard')) return '/';

    // Waiter landing
    if (currentUser.role === 'waiter') {
      if (canSeeNav('pos')) return '/pos';
      if (canSeeNav('captainOrder')) return '/captain-order';
      if (canSeeNav('consumption')) return '/consumption';
    }

    // Inventory & Raw Materials
    if (canSeeNav('rawMaterials')) {
      if (userStation === 'main') return '/materials?station=main';
      return '/materials';
    }
    if (canSeeNav('mainStore')) return '/materials?station=main';
    if (canSeeNav('kitchenStore')) return '/materials?station=kitchen';
    if (canSeeNav('barStore')) return '/materials?station=bar';

    // Subsystems
    if (canSeeNav('pos')) return '/pos';
    if (canSeeNav('captainOrder')) return '/captain-order';
    if (canSeeNav('cashSales')) return '/cash-sales';

    // Operations & Transactions
    if (canSeeNav('stockMovements')) return '/transactions';
    if (canSeeNav('products')) return '/products';
    if (canSeeNav('stockRequests')) return '/stock-requests';
    if (canSeeNav('consumption')) return '/consumption';
    if (canSeeNav('production')) return '/production';
    if (canSeeNav('suppliers')) return '/suppliers';

    // Finance & Reports
    if (canSeeNav('expenses')) return '/expenses';
    if (canSeeNav('analytics')) return '/analytics';
    if (canSeeNav('reports')) return '/reports';

    // Configurations
    if (canSeeNav('settings')) return '/settings';

    return '/profile';
  };

  const refreshPermissions = async (newSettings) => {
    if (newSettings) {
      // Handle full settings object OR the developer-license API response
      // { message, licensedModules } — only update what is present
      const rp = newSettings.rolePermissions ?? null;
      const nv = newSettings.navVisibility ?? null;
      const cp = newSettings.crudPermissions ?? null;
      const lm = newSettings.licensedModules ?? null;
      const cr = Array.isArray(newSettings.customRoles) ? newSettings.customRoles : null;
      const cd = Array.isArray(newSettings.customDepartments) ? newSettings.customDepartments : null;
      const cs = Array.isArray(newSettings.customStations) ? newSettings.customStations : null;

      if (rp) {
        setRolePermissions(rp);
        localStorage.setItem('hotelStockPermissions', JSON.stringify(rp));
      }
      if (nv) {
        setNavVisibility(nv);
        localStorage.setItem('hotelStockNavVisibility', JSON.stringify(nv));
      }
      if (cp) {
        setCrudPermissions(cp);
        localStorage.setItem('hotelStockCrudPermissions', JSON.stringify(cp));
      }
      if (cr) {
        setCustomRoles(cr);
        localStorage.setItem('hotelStockCustomRoles', JSON.stringify(cr));
      }
      if (cd) {
        setCustomDepartments(cd);
        localStorage.setItem('hotelStockCustomDepartments', JSON.stringify(cd));
      }
      if (cs) {
        setCustomStations(cs);
        localStorage.setItem('hotelStockCustomStations', JSON.stringify(cs));
      }
      if (lm) {
        setLicensedModules(lm);
        localStorage.setItem('hotelStockLicensedModules', JSON.stringify(lm));
      }
      return newSettings;
    }
    return await fetchPermissions();
  };

  const getRoleLabel = useCallback((roleKey) => {
    if (!roleKey) return '';
    if (BUILTIN_ROLE_LABELS[roleKey]) return BUILTIN_ROLE_LABELS[roleKey];
    const match = customRoles.find((r) => r.key === roleKey);
    if (match?.label) return match.label;
    return String(roleKey)
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }, [customRoles]);

  const allDepartments = React.useMemo(() => {
    const seen = new Set(BUILTIN_DEPARTMENTS.map(d => d.label.toLowerCase()));
    const extras = (customDepartments || [])
      .filter(d => d?.label && !seen.has(String(d.label).trim().toLowerCase()))
      .map(d => ({ label: d.label, icon: '🏷️', defaultStation: d.defaultStation || 'all', key: d.key, isCustom: true }));
    return [...BUILTIN_DEPARTMENTS, ...extras];
  }, [customDepartments]);

  const allStations = React.useMemo(() => {
    const seen = new Set(BUILTIN_STATIONS.map(s => s.key));
    const extras = (customStations || [])
      .filter(s => s?.key && !seen.has(String(s.key).trim().toLowerCase()))
      .map(s => ({ key: s.key, label: s.label, shortLabel: s.label, isCustom: true }));
    return [...BUILTIN_STATIONS, ...extras];
  }, [customStations]);

  const getStationLabel = useCallback((stationKey) => {
    const key = String(stationKey || 'all').trim().toLowerCase();
    const match = allStations.find(s => s.key === key);
    if (match) return match.shortLabel || match.label;
    return key.split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }, [allStations]);

  const matchDepartmentForRole = useCallback((roleKey) => {
    return ROLE_TO_DEFAULT_DEPT[String(roleKey || '').toLowerCase()] || '';
  }, []);

  const matchStationForDepartment = useCallback((deptLabel) => {
    const clean = String(deptLabel || '').trim();
    if (!clean) return 'all';
    const match = allDepartments.find(d => d.label.toLowerCase() === clean.toLowerCase());
    if (match?.defaultStation) return match.defaultStation;
    const lower = clean.toLowerCase();
    if (lower.includes('kitchen') || lower.includes('chef') || lower.includes('pastry') || lower.includes('bakery')) return 'kitchen';
    if (lower === 'bar' || lower.includes('bar ')) return 'bar';
    if (lower === 'main store' || lower.includes('warehouse') || lower.includes('purchas')) return 'main';
    return 'all';
  }, [allDepartments]);

  const sidebarTheme = licensedModules?.sidebarTheme || 'navy';
  const useMaterialIcons = licensedModules?.materialIcons !== false;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        hasRole,
        can,
        canCrud,
        canSeeNav,
        getDefaultLandingUrl,
        isModuleLicensed,
        licensedModules,
        sidebarTheme,
        useMaterialIcons,
        rolePermissions,
        navVisibility,
        crudPermissions,
        customRoles,
        customDepartments,
        customStations,
        allDepartments,
        allStations,
        getRoleLabel,
        getStationLabel,
        matchDepartmentForRole,
        matchStationForDepartment,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
