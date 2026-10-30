import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

const DEFAULT_PERMISSIONS = {
  recordGoods:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  checkReview:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  approveGoods:     { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
  postLedger:       { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  voidTransactions: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
  viewReports:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  manageAccounts:   { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
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
      view:   { storekeeper: true,  cashier: mod === 'products', waiter: mod === 'products', supervisor: true,  manager: true,  admin: true },
      edit:   { storekeeper: false, cashier: false,              waiter: false,              supervisor: !['suppliers', 'employees'].includes(mod), manager: true,  admin: true },
      delete: { storekeeper: false, cashier: false,              waiter: false,              supervisor: false, manager: false, admin: true },
    },
  ])
);
const DEFAULT_NAV_VISIBILITY = {
  dashboard:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  pos:            { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true },
  captainOrder:   { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true },
  cashSales:      { storekeeper: true,  cashier: true,  waiter: false, supervisor: true,  manager: true,  admin: true },
  rawMaterials:   { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  products:       { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  stockMovements: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  suppliers:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  consumption:    { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  reports:        { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  expenses:       { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  analytics:      { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: true,  admin: true },
  staffAccounts:  { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
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
  localStorage.removeItem('hotelStockLicensedModules');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser]                       = useState(null);
  const [rolePermissions, setRolePermissions]   = useState(DEFAULT_PERMISSIONS);
  const [navVisibility,   setNavVisibility]     = useState(DEFAULT_NAV_VISIBILITY);
  const [crudPermissions, setCrudPermissions]   = useState(DEFAULT_CRUD_PERMISSIONS);
  const [licensedModules, setLicensedModules]   = useState(DEFAULT_LICENSED_MODULES);

  // loading stays true until BOTH the user AND the server settings are resolved
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await api.get('/settings');
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
      // Always update licensedModules from server — even { subsystem: false } must apply
      const lm = res.data?.licensedModules ?? DEFAULT_LICENSED_MODULES;
      setLicensedModules(lm);
      localStorage.setItem('hotelStockLicensedModules', JSON.stringify(lm));
      return res.data;
    } catch (err) {
      // Network failure: fall back to localStorage cache if available, else hardcoded defaults
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
      console.warn('Could not fetch settings from server, using cache/defaults', err);
    }
    return null;
  }, []);

  // On mount: restore user from localStorage, then AWAIT fetchPermissions before
  // clearing the loading flag. This prevents a flash of wrong nav items.
  useEffect(() => {
    const init = async () => {
      const stored = localStorage.getItem('hotelStockAuth');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setUser(parsed);
          // Fetch server settings BEFORE showing the app
          await fetchPermissions();
        } catch {
          localStorage.removeItem('hotelStockAuth');
        }
      }
      // Only now allow the app to render
      setLoading(false);
    };
    init();
  }, [fetchPermissions]);

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
    return Boolean(rolePermissions?.[capability]?.[user.role]);
  };

  /**
   * Check CRUD permission: canCrud('rawMaterials', 'delete')
   * action = 'view' | 'edit' | 'delete'
   */
  const canCrud = (module, action) => {
    if (!user) return false;
    if (user.role === 'dev') return true;
    const modPerms = crudPermissions?.[module];
    if (!modPerms) return user.role === 'admin';
    const actionPerms = modPerms[action];
    if (!actionPerms) return user.role === 'admin';
    return Boolean(actionPerms[user.role]);
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

    // Waiter role is strictly restricted to POS ordering & captain table orders in subsystem
    if (user.role === 'waiter') {
      if (['subsystem', 'pos', 'captainOrder'].includes(navKey)) {
        return licensedModules?.subsystem !== false;
      }
      return false;
    }

    const nav = navVisibility ?? DEFAULT_NAV_VISIBILITY;
    if (navKey === 'subsystem') {
      const p = nav.pos?.[user.role] ?? true;
      const c = nav.captainOrder?.[user.role] ?? true;
      const s = nav.cashSales?.[user.role] ?? true;
      return Boolean(p || c || s);
    }
    const entry = nav[navKey];
    if (!entry) return true; // unknown key — show by default
    return Boolean(entry[user.role]);
  };

  const refreshPermissions = async (newSettings) => {
    if (newSettings) {
      // Handle full settings object OR the developer-license API response
      // { message, licensedModules } — only update what is present
      const rp = newSettings.rolePermissions ?? null;
      const nv = newSettings.navVisibility ?? null;
      const cp = newSettings.crudPermissions ?? null;
      const lm = newSettings.licensedModules ?? null;

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
      if (lm) {
        setLicensedModules(lm);
        localStorage.setItem('hotelStockLicensedModules', JSON.stringify(lm));
      }
      return newSettings;
    }
    return await fetchPermissions();
  };
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
        isModuleLicensed,
        licensedModules,
        sidebarTheme,
        useMaterialIcons,
        rolePermissions,
        navVisibility,
        crudPermissions,
        refreshPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
