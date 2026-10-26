import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  User,
  Shield,
  Building,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Mail,
  Phone,
  MapPin,
  Coins,
  BadgeAlert,
  TrendingUp,
  Sliders,
  Eye,
  Layers,
  Check,
  Camera,
  Upload,
  Trash2,
  Clock,
  Send,
  Printer,
  Wifi,
  WifiOff,
  Radio,
  Plus,
  X,
  ToggleLeft,
  ToggleRight,
  Percent,
  Palette,
  Sparkles,
} from 'lucide-react';
import api from '../api/axios';
import posPrint from '../utils/posPrint';
import { checkLocalBridge, checkRelayStatus } from '../utils/localPrintDispatcher';
import { useAuth } from '../context/AuthContext';
import { useSessionTimeout, TIMEOUT_OPTIONS } from '../context/SessionTimeoutContext';
import { THEME_OPTIONS } from '../config/sidebarThemes';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const CAPABILITIES = [
  { key: 'recordGoods', label: 'Record Goods Receiving (Cash/Credit GRV)' },
  { key: 'checkReview', label: 'Check & Review Transactions (Stage 1)' },
  { key: 'approveGoods', label: 'Approve Goods & Vouchers (Stage 2)' },
  { key: 'postLedger', label: 'Post Documents to Ledger (Final Stage)' },
  { key: 'voidTransactions', label: 'Void / Reverse Transactions' },
  { key: 'viewReports', label: 'View Financial & Valuation Reports' },
  { key: 'manageAccounts', label: 'Manage Staff Accounts & Passwords' },
];

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'captainOrder', label: 'Subsystem — Captain Order' },
  { key: 'cashSales', label: 'Subsystem — Cash Sales' },
  { key: 'pos', label: 'Subsystem — POS Ordering' },
  { key: 'rawMaterials', label: 'Raw Materials' },
  { key: 'products', label: 'Products' },
  { key: 'stockMovements', label: 'Stock Movements' },
  { key: 'suppliers', label: 'Suppliers' },
  { key: 'consumption', label: 'Consumption' },
  { key: 'reports', label: 'Reports' },
  { key: 'expenses', label: 'Overhead Expenses' },
  { key: 'analytics', label: 'Analytics & P&L' },
  { key: 'staffAccounts', label: 'Staff Accounts' },
];

// CRUD modules — must match AuthContext CRUD_MODULES
const CRUD_MODULES_LIST = [
  { key: 'rawMaterials',   label: 'Raw Materials' },
  { key: 'products',       label: 'Products' },
  { key: 'suppliers',      label: 'Suppliers' },
  { key: 'expenses',       label: 'Overhead Expenses' },
  { key: 'stockMovements', label: 'Stock Movements' },
  { key: 'purchases',      label: 'Purchases / GRV' },
  { key: 'employees',      label: 'Employees' },
];

const SETTINGS_ROLES = [
  { key: 'storekeeper', label: 'Storekeeper' },
  { key: 'cashier',     label: 'Cashier' },
  { key: 'waiter',      label: 'Waiter' },
  { key: 'supervisor',  label: 'Supervisor' },
  { key: 'manager',     label: 'Manager' },
  { key: 'admin',       label: 'Admin' },
];

export default function Settings() {
  const { user, updateUser, hasRole, refreshPermissions, licensedModules, isModuleLicensed } = useAuth();
  const { timeoutMinutes, setTimeoutMinutes } = useSessionTimeout();
  const [sessionTimeoutSuccess, setSessionTimeoutSuccess] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || 'profile';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  // Profile state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // System settings state (Admin)
  const [systemForm, setSystemForm] = useState({
    hotelName: 'Baba Roti  Café',
    systemEmail: 'info@Baba Roti  Café.com',
    phone: '+251 911 000 111',
    address: 'Addis Ababa, Ethiopia',
    currency: 'ETB',
    currencySymbol: 'ETB',
    lowStockThresholdDefault: 15,
    taxRate: 15,
    sidebarTheme: 'navy',
    sidebarMaterialIcons: true,
    // Service Charge & Table Service Fees
    enableServiceCharge: false,
    serviceChargeRate: 10,
    serviceChargePresets: [5, 10, 15],
    autoApplyServiceChargeDineIn: false,
    autoGenerateVoucherNo: true,
    allowNegativeStock: false,
    // Pricing & Cost Parameters
    contingencyPercent: 10,
    overheadPercent: 25,
    spiceCostPercent: 5,
    defaultFoodCostPercent: 30,
    rawMaterialPriceAdjustType: 'percent',
    rawMaterialPriceAdjustValue: 0,
    productSellingPriceAdjustPercent: 0,
    applyToMaterialsNow: false,
    rolePermissions: {
      recordGoods:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      checkReview:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      approveGoods:     { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
      postLedger:       { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      voidTransactions: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
      viewReports:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      manageAccounts:   { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true }
    },
    navVisibility: {
      dashboard:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      captainOrder:   { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true },
      cashSales:      { storekeeper: true,  cashier: true,  waiter: false, supervisor: true,  manager: true,  admin: true },
      pos:            { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true },
      rawMaterials:   { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      products:       { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      stockMovements: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      suppliers:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      consumption:    { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      reports:        { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      expenses:       { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
      analytics:      { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: true,  admin: true },
      staffAccounts:  { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
    },
    // CRUD privileges per module
    crudPermissions: Object.fromEntries(
      CRUD_MODULES_LIST.map(({ key }) => [
        key,
        {
          view:   { storekeeper: true,  cashier: key === 'products', waiter: key === 'products', supervisor: true,  manager: true,  admin: true },
          edit:   { storekeeper: false, cashier: false,              waiter: false,              supervisor: !['suppliers', 'employees'].includes(key), manager: true,  admin: true },
          delete: { storekeeper: false, cashier: false,              waiter: false,              supervisor: false, manager: false, admin: true },
        },
      ])
    ),
    notes: '',
  });
  const [systemLoading, setSystemLoading] = useState(false);
  const [systemSaving, setSystemSaving] = useState(false);
  const [systemSuccess, setSystemSuccess] = useState('');
  const [systemError, setSystemError] = useState('');

  // Bulk product price adjustment state
  const [bulkPricePercent, setBulkPricePercent] = useState('');
  const [bulkPriceApplying, setBulkPriceApplying] = useState(false);
  const [bulkPriceSuccess, setBulkPriceSuccess] = useState('');
  const [bulkPriceError, setBulkPriceError] = useState('');

  // Bulk raw material price adjustment state
  const [rawMaterialApplying, setRawMaterialApplying] = useState(false);
  const [rawMaterialSuccess, setRawMaterialSuccess] = useState('');
  const [rawMaterialError, setRawMaterialError] = useState('');

  // Developer / System Owner: license control state
  const [devLicenseForm, setDevLicenseForm] = useState({
    subsystem: true,
    finance: true,
    themeCustomization: true,
    materialIcons: true,
    sidebarTheme: 'navy',
  });
  const [devSaving, setDevSaving] = useState(false);
  const [devSuccess, setDevSuccess] = useState('');
  const [devError, setDevError] = useState('');
  const [devKeyConfirmOpen, setDevKeyConfirmOpen] = useState(false);
  const [newDevKey, setNewDevKey] = useState('');

  // ── Printer Settings state ──────────────────────────────────────────────
  const PRINTER_BRANDS = ['Epson', 'Bixolon', 'Rongta', 'Xprinter', 'Star', 'Citizen', 'Datecs', 'HP', 'Generic'];
  const PRINTER_TYPES  = [
    { key: 'kitchen', label: 'Kitchen / Prep Station' },
    { key: 'receipt', label: 'Customer Receipt' },
    { key: 'bar',     label: 'Bar Printer' },
    { key: 'both',    label: 'Kitchen + Receipt' },
  ];
  const PAPER_WIDTHS   = ['58mm', '80mm', 'A4'];

  // Real-world thermal printer models grouped by brand
  const PRINTER_MODELS = {
    Epson: [
      'TM-T20III', 'TM-T20X', 'TM-T70II', 'TM-T82III',
      'TM-T83III', 'TM-T88VI', 'TM-T88VII',
      'TM-T20II', 'TM-T81III',
      'TM-U220', 'TM-U330', 'TM-H6000V',
    ],
    Bixolon: [
      'SRP-350plusIII', 'SRP-380', 'SRP-330II',
      'SRP-Q200', 'SRP-Q300', 'SRP-F310II',
      'SRP-270', 'SRP-275III',
    ],
    Rongta: [
      'RP80USE (80mm Thermal)',
      'RP326 (80mm Thermal)',
      'RP328 (80mm Thermal)',
      'RP58BU (58mm Thermal)',
      'RP80VI (80mm Thermal)',
      'RCE-200 (Fiscal)',
    ],
    Xprinter: [
      'XP-N160M (80mm Thermal)',
      'XP-Q800 (80mm Thermal)',
      'XP-Q200 (80mm Thermal)',
      'XP-T80A (80mm Thermal)',
      'XP-58IIH (58mm Thermal)',
      'XP-C260M (Kitchen with Alarm)',
    ],
    Star: [
      'TSP100III', 'TSP100IIIBI', 'TSP143IIIW',
      'TSP650II', 'TSP654II', 'TSP700II', 'TSP800II',
      'mC-Print2', 'mC-Print3',
      'SP700', 'SP742', 'SP747',
    ],
    Datecs: [
      'DP-25', 'DP-35', 'DP-50', 'DP-150',
      'DPP-250', 'DPP-350', 'DPP-450',
      'FP-700', 'FP-800',
      'LP-50', 'LP-60', 'LP-600',
      'WP-500X', 'KP-200', 'KP-300',
    ],
    Citizen: [
      'CT-E351', 'CT-E651', 'CT-E301',
      'CT-S310II', 'CT-S651', 'CT-S801II',
      'CMP-20II', 'CMP-25L', 'CMP-30II', 'CMP-40L',
    ],
    Generic: [
      'Generic 80mm ESC/POS',
      'Generic 58mm ESC/POS',
      'XP-58 (Generic)',
      'XP-80 (Generic)',
      'POS-80 (Generic)',
      'POS-58 (Generic)',
      'JP-5890K (Generic)',
      'SEWOO SLK-TS400',
      'Custom (type manually)',
    ],
    HP: [
      // LaserJet Pro — most common office/restaurant laser printers
      'LaserJet M402dne',
      'LaserJet M402dn',
      'LaserJet M402n',
      'LaserJet M404dn',
      'LaserJet M404dw',
      'LaserJet M404n',
      'LaserJet M428fdw',
      'LaserJet M428fdn',
      // LaserJet Pro M series
      'LaserJet Pro M118dw',
      'LaserJet Pro M203dn',
      'LaserJet Pro M203dw',
      'LaserJet Pro M227fdw',
      'LaserJet Pro M227sdn',
      // Color LaserJet
      'Color LaserJet Pro M255dw',
      'Color LaserJet Pro M283fdw',
      'Color LaserJet Pro M479fdw',
      // Older popular models
      'LaserJet 1020', 'LaserJet P1102w',
      'LaserJet P2055dn', 'LaserJet P3015dn',
    ],
  };

  const blankPrinter = {
    name: '', type: 'kitchen', brand: 'Generic', model: '',
    paperWidth: '80mm', connectionType: 'network',
    ipAddress: '', port: 9100, enabled: true,
    printOnOrder: true, printOnCheckout: true, copies: 1,
    headerLine1: 'Baba Roti Café', headerLine2: '', footerLine: 'Thank you! Come again.',
    charWidth: 42,
  };

  const [printers, setPrinters]             = useState([]);
  const [printersLoading, setPrintersLoading] = useState(false);
  const [printerForm, setPrinterForm]       = useState(blankPrinter);
  const [editingPrinterId, setEditingPrinterId] = useState(null);
  const [showPrinterForm, setShowPrinterForm]   = useState(false);
  const [printerSaving, setPrinterSaving]   = useState(false);
  const [printerSuccess, setPrinterSuccess] = useState('');
  const [printerError, setPrinterError]     = useState('');
  const [pingStatus, setPingStatus]         = useState({}); // { [ip]: 'ok' | 'fail' | 'pending' }
  const [printTestStatus, setPrintTestStatus] = useState({}); // { [idOrIp]: 'ok' | 'fail' | 'pending' }

  const [relayAgentInfo, setRelayAgentInfo] = useState({ online: false });
  const [localBridgeInfo, setLocalBridgeInfo] = useState({ online: false });

  // Load printers and agent statuses
  const loadPrinters = async () => {
    setPrintersLoading(true);
    try {
      const res = await api.get('/printers');
      setPrinters(Array.isArray(res.data) ? res.data : []);
    } catch (_) {}
    finally { setPrintersLoading(false); }

    // Check Cloud Relay and Local Bridge
    checkRelayStatus().then((r) => setRelayAgentInfo(r)).catch(() => {});
    checkLocalBridge().then((b) => setLocalBridgeInfo(b)).catch(() => {});
  };

  // Telegram subscribers state (Admin)
  const [tgSubscribers, setTgSubscribers] = useState([]);
  const [tgLoading, setTgLoading] = useState(false);
  const [tgRemoving, setTgRemoving] = useState(null);
  const [tgSuccess, setTgSuccess] = useState('');
  const [tgError, setTgError] = useState('');
  // Phone registration inline edit state
  const [tgEditPhone, setTgEditPhone] = useState(null);  // chatId being edited
  const [tgPhoneVal, setTgPhoneVal] = useState('');
  const [tgPhoneSaving, setTgPhoneSaving] = useState(false);
  // Manual add subscriber modal
  const [tgAddOpen, setTgAddOpen] = useState(false);
  const [tgAddForm, setTgAddForm] = useState({ name: '', phone: '', username: '', chatId: '' });
  const [tgAddSaving, setTgAddSaving] = useState(false);

  // Sync profile when user updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [user]);

  // Load system settings
  useEffect(() => {
    if (user) {
      setSystemLoading(true);
      api
        .get('/settings')
        .then((res) => {
          if (res.data) {
            setSystemForm((prev) => ({
              ...prev,
              ...res.data,
              sidebarTheme: res.data.sidebarTheme || res.data.licensedModules?.sidebarTheme || 'navy',
              sidebarMaterialIcons: res.data.sidebarMaterialIcons !== undefined
                ? res.data.sidebarMaterialIcons
                : (res.data.licensedModules?.materialIcons !== false),
            }));
            if (res.data.licensedModules) {
              setDevLicenseForm((prev) => ({
                ...prev,
                ...res.data.licensedModules,
                subsystem: res.data.licensedModules.subsystem !== false,
                finance: res.data.licensedModules.finance !== false,
                themeCustomization: res.data.licensedModules.themeCustomization !== false,
                materialIcons: res.data.licensedModules.materialIcons !== false,
                sidebarTheme: res.data.licensedModules.sidebarTheme || 'navy',
              }));
            }
          }
        })
        .catch((err) => console.error('Failed to load settings', err))
        .finally(() => setSystemLoading(false));
    }
  }, [user]);

  const handleDevLicenseSave = async () => {
    if (!devLicenseForm) return;
    setDevSaving(true); setDevSuccess(''); setDevError('');
    try {
      const payload = { licensedModules: devLicenseForm };
      if (newDevKey.trim()) payload.newDevMasterKey = newDevKey.trim();
      const res = await api.put('/settings/developer-license', payload);
      setDevSuccess('Developer license settings saved successfully.');
      setNewDevKey('');
      setDevKeyConfirmOpen(false);
      refreshPermissions(res.data);
    } catch (e) {
      setDevError(e.response?.data?.message || 'Failed to save developer license settings.');
    } finally { setDevSaving(false); }
  };

  // Load Telegram subscribers (admin only)
  const loadTgSubscribers = () => {
    if (!hasRole('admin')) return;
    setTgLoading(true);
    setTgError('');
    api.get('/telegram/subscribers')
      .then(res => setTgSubscribers(res.data || []))
      .catch(() => {
        setTgError('Failed to load subscribers.');
        setTimeout(() => setTgError(''), 3000);
      })
      .finally(() => setTgLoading(false));
  };
  useEffect(() => {
    if (currentTab === 'telegram' && hasRole('admin')) loadTgSubscribers();
  }, [currentTab]);

  // Handle Telegram subscriber removal
  const handleRemoveTgSubscriber = async (chatId, name) => {
    if (!window.confirm(`Remove "${name}" from bot subscribers? They will stop receiving notifications.`)) return;
    setTgRemoving(chatId);
    setTgError('');
    try {
      await api.delete(`/telegram/subscribers/${chatId}`);
      setTgSuccess(`"${name}" removed from subscribers.`);
      setTimeout(() => setTgSuccess(''), 4000);
      loadTgSubscribers();
    } catch (err) {
      setTgError(err.response?.data?.message || 'Failed to remove subscriber.');
    } finally {
      setTgRemoving(null);
    }
  };

  // Handle phone number registration for a subscriber
  const handleRegisterPhone = async (subId) => {
    if (!tgPhoneVal.trim()) {
      setTgError('Please enter a valid phone number before saving.');
      return;
    }
    setTgPhoneSaving(true);
    setTgError('');
    try {
      await api.put(`/telegram/subscribers/${encodeURIComponent(subId)}/phone`, { phone: tgPhoneVal.trim() });
      setTgSuccess('Phone number registered — this number can now receive OTP codes.');
      setTimeout(() => setTgSuccess(''), 5000);
      setTgEditPhone(null);
      setTgPhoneVal('');
      loadTgSubscribers();
    } catch (err) {
      setTgError(err.response?.data?.message || 'Failed to register phone.');
    } finally {
      setTgPhoneSaving(false);
    }
  };

  // Handle manually adding a new subscriber
  const handleAddSubscriber = async (e) => {
    e.preventDefault();
    setTgAddSaving(true);
    setTgError('');
    try {
      await api.post('/telegram/subscribers', tgAddForm);
      setTgSuccess(`"${tgAddForm.name}" added successfully.`);
      setTimeout(() => setTgSuccess(''), 4000);
      setTgAddOpen(false);
      setTgAddForm({ name: '', phone: '', username: '', chatId: '' });
      loadTgSubscribers();
    } catch (err) {
      setTgError(err.response?.data?.message || 'Failed to add subscriber.');
    } finally {
      setTgAddSaving(false);
    }
  };

  // Handle Profile Update
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess('');
    setProfileError('');

    try {
      const res = await api.put('/auth/profile', profileForm);
      updateUser(res.data);
      setProfileSuccess('Profile details successfully updated.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // Handle Profile Photo Upload
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError('Please select a valid image file (PNG, JPG, or WEBP).');
      return;
    }

    setAvatarUploading(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      // Compress image client-side to max 500x500 JPEG
      const compressedBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            const maxWidth = 500;
            const maxHeight = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          };
          img.onerror = reject;
        };
        reader.onerror = reject;
      });

      const res = await api.put('/auth/profile', { avatar: compressedBase64 });
      updateUser(res.data);
      setProfileSuccess('Profile photo updated successfully!');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to upload profile photo.');
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };
  // Handle Remove Profile Photo
  const handleRemoveAvatar = async () => {
    if (!window.confirm('Are you sure you want to remove your profile photo?')) return;
    setAvatarUploading(true);
    setProfileError('');
    try {
      const res = await api.put('/auth/profile', { avatar: '' });
      updateUser(res.data);
      setProfileSuccess('Profile photo removed.');
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.response?.data?.message || 'Failed to remove profile photo.');
    } finally {
      setAvatarUploading(false);
    }
  };
  // Handle Password Update
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordSuccess('');
    setPasswordError('');

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('New password and confirm password do not match.');
      setPasswordSaving(false);
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      setPasswordSaving(false);
      return;
    }
    try {
      await api.put('/auth/password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      setPasswordSuccess('Password successfully updated!');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(''), 4000);
    } catch (err) {
      setPasswordError(err.response?.data?.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };
  // Handle System Settings Update
  const handleSystemSubmit = async (e) => {
    e.preventDefault();
    setSystemSaving(true);
    setSystemSuccess('');
    setSystemError('');
    try {
      const res = await api.put('/settings', systemForm);
      setSystemForm((prev) => ({ ...prev, ...res.data }));
      await refreshPermissions(res.data);
      if (res.data?.rawMaterialsUpdated > 0) {
        setSystemSuccess(`Baba Roti Café settings saved! Successfully adjusted ${res.data.rawMaterialsUpdated} raw materials in inventory.`);
      } else {
        setSystemSuccess('Baba Roti Café system settings & role permissions saved and activated immediately.');
      }
      setTimeout(() => setSystemSuccess(''), 5000);
    } catch (err) {
      setSystemError(err.response?.data?.message || 'Failed to update system settings.');
    } finally {
      setSystemSaving(false);
    }
  };

  // Handle Bulk Raw Material Price Adjustment (Permanently updates unitCost on all raw materials)
  const handleRawMaterialBulkApply = async () => {
    const adjVal = Number(systemForm.rawMaterialPriceAdjustValue);
    const adjType = systemForm.rawMaterialPriceAdjustType;
    if (!adjVal || adjVal <= 0) {
      setRawMaterialError('Enter a valid adjustment value greater than 0.');
      return;
    }
    const description = adjType === 'percent' ? `+${adjVal}%` : `+ETB ${adjVal.toFixed(2)}`;
    const sampleBreadNew = adjType === 'percent'
      ? (100 * (1 + adjVal / 100)).toFixed(2)
      : (100 + adjVal).toFixed(2);

    if (!window.confirm(`This will permanently update the unit cost of ALL active raw materials in the database by ${description} (e.g. Bread @ ETB 100.00 will become ETB ${sampleBreadNew}). Continue?`)) {
      return;
    }
    setRawMaterialApplying(true);
    setRawMaterialError('');
    setRawMaterialSuccess('');
    try {
      const res = await api.post('/settings/apply-raw-material-price-adjustment', {
        type: adjType,
        value: adjVal,
      });
      const sampleText = res.data.samples?.length
        ? ` (e.g. ${res.data.samples.map(s => `${s.name}: ETB ${s.before} → ETB ${s.after}`).join(', ')})`
        : '';
      setRawMaterialSuccess(`✓ ${res.data.message}${sampleText}`);
      setTimeout(() => setRawMaterialSuccess(''), 8000);
    } catch (err) {
      setRawMaterialError(err.response?.data?.message || 'Failed to apply raw material price adjustment.');
    } finally {
      setRawMaterialApplying(false);
    }
  };

  // Handle Bulk Product Price Adjustment
  const handleBulkPriceApply = async () => {
    const pct = Number(bulkPricePercent);
    if (!pct || pct <= 0) { setBulkPriceError('Enter a valid percentage greater than 0.'); return; }
    if (!window.confirm(`This will permanently increase ALL product selling prices by +${pct}%. This cannot be undone automatically. Continue?`)) return;
    setBulkPriceApplying(true);
    setBulkPriceError('');
    setBulkPriceSuccess('');
    try {
      const res = await api.post('/settings/apply-product-price-adjustment', { percent: pct });
      setBulkPriceSuccess(`✓ ${res.data.message}`);
      setBulkPricePercent('');
      setTimeout(() => setBulkPriceSuccess(''), 6000);
    } catch (err) {
      setBulkPriceError(err.response?.data?.message || 'Failed to apply price adjustment.');
    } finally {
      setBulkPriceApplying(false);
    }
  };

  const roleBadgeColor = {
    admin: 'bg-brass-100 text-brass-800 border-brass-300',
    manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    supervisor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    storekeeper: 'bg-blue-50 text-blue-700 border-blue-200',
    cashier: 'bg-teal-50 text-teal-700 border-teal-200',
    waiter: 'bg-purple-50 text-purple-700 border-purple-200',
    dev: 'bg-amber-100 text-amber-900 border-amber-300',
  }[user?.role || 'storekeeper'];

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-ink-900">
          Account &amp; System Settings
        </h1>
        <p className="text-sm text-ink-400 mt-1">
          Manage your personal credentials, profile identity, and Baba Roti  Caféhotel management configurations
        </p>
      </div>

      {/* ── Navigation Tabs ── */}
      <div className="flex border-b border-ink-100 space-x-1 sm:space-x-4 overflow-x-auto">
        <button
          onClick={() => setTab('profile')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'profile'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-ink-400 hover:text-ink-700'
            }`}
        >
          <User size={16} /> My Profile
        </button>

        <button
          onClick={() => setTab('security')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'security'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-ink-400 hover:text-ink-700'
            }`}
        >
          <Shield size={16} /> Security &amp; Password
        </button>

        {hasRole('admin', 'manager') && (
          <button
            onClick={() => setTab('system')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'system'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
          >
            <Building size={16} /> Hotel &amp; System Config
          </button>
        )}

        <button
          onClick={() => setTab('permissions')}
          className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'permissions'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-ink-400 hover:text-ink-700'
            }`}
        >
          <Layers size={16} /> Role Privileges
        </button>

        {hasRole('admin', 'manager') && (
          <button
            onClick={() => setTab('telegram')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'telegram'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
          >
            <Send size={16} /> Telegram Subscribers
          </button>
        )}

        {hasRole('admin', 'manager') && (
          <button
            onClick={() => { setTab('printers'); loadPrinters(); }}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'printers'
              ? 'border-violet-600 text-violet-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
          >
            <Printer size={16} /> Order Printers
          </button>
        )}

        {hasRole('admin', 'manager') && (
          <button
            onClick={() => setTab('serviceCharge')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${currentTab === 'serviceCharge'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-ink-400 hover:text-ink-700'
              }`}
          >
            <Percent size={16} /> Service Charge
          </button>
        )}

        {/* Developer / System Owner tab — STRICTLY ONLY visible to dev role */}
        {user?.role === 'dev' && (
          <button
            onClick={() => setTab('dev')}
            className={`flex items-center gap-2 border-b-2 px-3.5 py-3 text-sm font-semibold transition whitespace-nowrap ${
              currentTab === 'dev'
                ? 'border-amber-500 text-amber-600'
                : 'border-transparent text-amber-500/70 hover:text-amber-600'
            }`}
          >
            <span className="flex items-center gap-1.5">
              <Lock size={16} className="text-amber-500" />
              <span>Developer Controls</span>
              <span className="ml-1 inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-amber-700 border border-amber-200">
                OWNER
              </span>
            </span>
          </button>
        )}
      </div>

      {/* ── Tab 1: Profile ── */}
      {currentTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Identity Card */}
          <Card className="lg:col-span-1 flex flex-col items-center text-center p-6">
            {/* Avatar with Photo Upload */}
            <div className="relative mb-3 group">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-3xl font-black text-white shadow-md overflow-hidden ring-4 ring-white border border-ink-100">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user?.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  user?.name?.[0]?.toUpperCase() || 'U'
                )}
              </div>

              {/* Upload Badge Button */}
              <label
                className={`absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-md ring-2 ring-white transition hover:bg-blue-700 hover:scale-105 ${avatarUploading ? 'animate-pulse pointer-events-none opacity-80' : ''
                  }`}
                title="Upload profile photo"
              >
                <Camera size={15} />
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>
            </div>
            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2 mb-2">
              <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-700 shadow-xs hover:bg-ink-50 hover:border-ink-300 transition">
                <Upload size={12} className="text-blue-600" />
                {avatarUploading ? 'Uploading...' : user?.avatar ? 'Change Photo' : 'Upload Photo'}
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                />
              </label>

              {user?.avatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition"
                  title="Remove profile photo"
                >
                  <Trash2 size={11} /> Remove
                </button>
              )}
            </div>
            <h3 className="font-display text-lg font-bold text-ink-900">{user?.name}</h3>
            <p className="text-xs text-ink-400 mt-0.5">{user?.email}</p>

            <span className={`mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize ${roleBadgeColor}`}>
              {user?.role} Account
            </span>

            <div className="mt-6 w-full border-t border-ink-100 pt-4 text-left text-xs space-y-2.5 text-ink-500">
              <div className="flex justify-between">
                <span>Account Status:</span>
                <span className="font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Active
                </span>
              </div>
              <div className="flex justify-between">
                <span>Enterprise:</span>
                <span className="font-semibold text-ink-800">Baba Roti  Café</span>
              </div>
              <div className="flex justify-between">
                <span>Contact Phone:</span>
                <span className="font-semibold text-ink-800">{user?.phone || 'Not specified'}</span>
              </div>
            </div>
          </Card>
          {/* Edit Profile Form */}
          <Card className="lg:col-span-2">
            <h3 className="font-display text-base font-bold text-ink-900 mb-1">
              Personal Information
            </h3>
            <p className="text-xs text-ink-400 mb-5">
              Update your display name and email address used for sign-in and audit logs
            </p>

            {profileSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}
            {profileError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="e.g. Hotel Admin"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Email Address (Login Account)
                </label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="email"
                    required
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="admin@hotel.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Contact Phone Number
                </label>
                <div className="relative">
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="+251 911 000 000"
                  />
                </div>
              </div>
              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={profileSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save size={15} /> {profileSaving ? 'Saving…' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
      {/* ── Tab 2: Security & Password ── */}
      {currentTab === 'security' && (
        <div className="max-w-2xl">
          <Card>
            <div className="flex items-center gap-2 mb-1">
              <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                <KeyRound size={16} />
              </span>
              <h3 className="font-display text-base font-bold text-ink-900">
                Change Password
              </h3>
            </div>
            <p className="text-xs text-ink-400 mb-5">
              Ensure your account uses a secure password to protect stock transactions and sign-offs
            </p>

            {passwordSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="password"
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="At least 6 characters"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <KeyRound size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-ink-50 p-3 text-xs text-ink-500 space-y-1">
                <p className="font-semibold text-ink-700">Security Recommendation:</p>
                <p>• Avoid reusing common passwords.</p>
                <p>• Remember that this password is also used for voucher check, approval, and receipt gates.</p>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={passwordSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Lock size={15} /> {passwordSaving ? 'Updating…' : 'Update Password'}
                </Button>
              </div>
            </form>
          </Card>

          {/* Session Inactivity Timeout Card */}
          <Card className="mt-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-amber-50 p-1.5 text-amber-600">
                  <Clock size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-ink-900">
                  Session Inactivity &amp; Auto-Logout
                </h3>
              </div>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${timeoutMinutes === 0
                ? 'bg-slate-100 text-slate-600 border-slate-300'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                {timeoutMinutes === 0 ? 'Auto-Logout: Disabled' : `Active Policy: ${timeoutMinutes} min idle`}
              </span>
            </div>
            <p className="text-xs text-ink-400 mb-5">
              Automatically logs out when idle (no mouse, typing, or touch activity) to prevent unauthorized access at storerooms, reception, or cash counters.
            </p>

            {sessionTimeoutSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700 animate-in fade-in">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{sessionTimeoutSuccess}</span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-ink-700 mb-2">
                  Choose Inactivity Idle Timeout Duration:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {TIMEOUT_OPTIONS.map((opt) => {
                    const isSelected = timeoutMinutes === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setTimeoutMinutes(opt.value);
                          setSessionTimeoutSuccess(`Session timeout updated to ${opt.label}.`);
                          setTimeout(() => setSessionTimeoutSuccess(''), 3500);
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition ${isSelected
                          ? 'border-blue-600 bg-blue-50/70 text-blue-900 ring-1 ring-blue-500'
                          : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50/50'
                          }`}
                      >
                        <div>
                          <p className="text-xs font-bold leading-tight">{opt.label}</p>
                          <p className="text-[10px] text-ink-400 mt-0.5">
                            {opt.value === 0
                              ? 'Remain logged in indefinitely'
                              : opt.value === 2
                                ? 'Recommended security standard'
                                : `Signs out after ${opt.value} minutes idle`}
                          </p>
                        </div>
                        {isSelected && (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 p-3 text-xs text-amber-900 space-y-1">
                <p className="font-semibold flex items-center gap-1.5 text-amber-900">
                  <Shield size={14} className="text-amber-600" />
                  How Auto-Logout Protects You:
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  • 35 seconds prior to auto-logout, a warning dialog appears allowing you to extend your session with 1 click.
                </p>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  • Any active keystrokes, item scanning, or navigation instantly refreshes your session timer.
                </p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ── Tab 3: Hotel & System Config (Admin Only) ── */}
      {currentTab === 'system' && hasRole('admin') && (
        <div className="space-y-6">
          <Card className="max-w-3xl">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-brass-100 p-1.5 text-brass-700">
                  <Building size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-ink-900">
                  Hotel &amp; Inventory Parameters
                </h3>
              </div>
              <span className="rounded-full bg-brass-50 border border-brass-200 px-2.5 py-0.5 text-xs font-bold text-brass-800">
                Admin Exclusive
              </span>
            </div>
            <p className="text-xs text-ink-400 mb-6">
              Configure hotel branding, currency symbols, and default stock safety thresholds
            </p>

            {systemSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{systemSuccess}</span>
              </div>
            )}
            {systemError && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{systemError}</span>
              </div>
            )}

            <form onSubmit={handleSystemSubmit} className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Hotel / Brand Name
                  </label>
                  <div className="relative">
                    <Building size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      type="text"
                      required
                      value={systemForm.hotelName}
                      onChange={(e) => setSystemForm({ ...systemForm, hotelName: e.target.value })}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Baba Roti  Café"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Currency Symbol / Code
                  </label>
                  <div className="relative">
                    <Coins size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      type="text"
                      required
                      value={systemForm.currency}
                      onChange={(e) => setSystemForm({ ...systemForm, currency: e.target.value })}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                      placeholder="ETB"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Official Contact Email
                  </label>
                  <div className="relative">
                    <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      type="email"
                      value={systemForm.systemEmail}
                      onChange={(e) => setSystemForm({ ...systemForm, systemEmail: e.target.value })}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                      placeholder="info@Baba Roti  Café.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Official Phone
                  </label>
                  <div className="relative">
                    <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      type="text"
                      value={systemForm.phone}
                      onChange={(e) => setSystemForm({ ...systemForm, phone: e.target.value })}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                      placeholder="+251 911 000 111"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Physical Address / Location
                  </label>
                  <div className="relative">
                    <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
                    <input
                      type="text"
                      value={systemForm.address}
                      onChange={(e) => setSystemForm({ ...systemForm, address: e.target.value })}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                      placeholder="Addis Ababa, Ethiopia"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Default Low Stock Safety Threshold (Units)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={systemForm.lowStockThresholdDefault}
                    onChange={(e) => setSystemForm({ ...systemForm, lowStockThresholdDefault: Number(e.target.value) })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink-700 mb-1">
                    Applicable VAT / Tax Rate (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={systemForm.taxRate}
                    onChange={(e) => setSystemForm({ ...systemForm, taxRate: Number(e.target.value) })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-ink-700">
                      Default Service Charge Rate (%)
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab('serviceCharge')}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Configure Presets &rarr;
                    </button>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={systemForm.serviceChargeRate}
                    onChange={(e) => setSystemForm({ ...systemForm, serviceChargeRate: Number(e.target.value) })}
                    className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-2 border-t border-ink-100">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemForm.enableServiceCharge}
                    onChange={(e) => setSystemForm({ ...systemForm, enableServiceCharge: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink-900">Enable Service Charge by Default</p>
                    <p className="text-[11px] text-ink-400">Activates hospitality service charge on POS orders and sales bills</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemForm.autoApplyServiceChargeDineIn}
                    onChange={(e) => setSystemForm({ ...systemForm, autoApplyServiceChargeDineIn: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink-900">Auto-apply Service Charge to Dine-In Orders</p>
                    <p className="text-[11px] text-ink-400">Automatically applies the default rate whenever Dine-In table orders are opened</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemForm.autoGenerateVoucherNo}
                    onChange={(e) => setSystemForm({ ...systemForm, autoGenerateVoucherNo: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink-900">Auto-generate Voucher Numbers</p>
                    <p className="text-[11px] text-ink-400">Automatically creates serial voucher codes (e.g. CGRV-2026-001) if left blank</p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={systemForm.allowNegativeStock}
                    onChange={(e) => setSystemForm({ ...systemForm, allowNegativeStock: e.target.checked })}
                    className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <p className="text-xs font-semibold text-ink-900">Permit Negative Stock Quantities</p>
                    <p className="text-[11px] text-ink-400">Allows issuing or disposing stock even when logged balance is below zero</p>
                  </div>
                </label>
              </div>

              <div className="pt-3 flex justify-end">
                <Button type="submit" disabled={systemSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save size={15} /> {systemSaving ? 'Saving Settings…' : 'Save Hotel Settings'}
                </Button>
              </div>
            </form>
          </Card>

          {/* ── Sidebar Appearance & Brand Theme Card (Visible when allowed by developer or user is dev) ── */}
          {(licensedModules?.themeCustomization !== false || user?.role === 'dev') && (
            <Card className="mt-6 max-w-3xl">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                    <Palette size={16} />
                  </span>
                  <h3 className="font-display text-base font-bold text-ink-900">
                    Sidebar Appearance &amp; Brand Theme
                  </h3>
                </div>
                <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  Visual Customization
                </span>
              </div>
              <p className="text-xs text-ink-400 mb-5">
                Personalize the navigation sidebar color theme and icon style according to your hotel brand preferences.
              </p>

              <form onSubmit={handleSystemSubmit} className="space-y-5">
                {/* Material Icons Toggle */}
                <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                  <div className="pr-4">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-ink-900">Modern Material UI Icons Mode</p>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                        systemForm.sidebarMaterialIcons !== false
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : 'bg-slate-200 text-slate-700 border border-slate-300'
                      }`}>
                        {systemForm.sidebarMaterialIcons !== false ? 'Material Icons (Active)' : 'Classic Clean (Minimal)'}
                      </span>
                    </div>
                    <p className="text-xs text-ink-500 mt-1">
                      {systemForm.sidebarMaterialIcons !== false
                        ? 'Displays modern Material icons with colorful rounded squircle badges.'
                        : 'Displays clean, minimalist line icons without colored square badges (classic layout).'}
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={systemForm.sidebarMaterialIcons !== false}
                      onChange={(e) => setSystemForm({ ...systemForm, sidebarMaterialIcons: e.target.checked })}
                    />
                    <div className="h-6 w-11 rounded-full bg-ink-200 peer-focus:ring-2 peer-focus:ring-blue-300 peer-checked:bg-blue-600 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full after:shadow" />
                  </label>
                </div>

                {/* Theme Grid */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-2.5">
                    Select Sidebar Theme Palette
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {THEME_OPTIONS.map((theme) => {
                      const isSelected = (systemForm.sidebarTheme || 'navy') === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => setSystemForm({ ...systemForm, sidebarTheme: theme.id })}
                          className={`relative p-3.5 rounded-2xl border text-left transition-all flex flex-col justify-between overflow-hidden group ${
                            isSelected
                              ? 'border-blue-600 ring-2 ring-blue-500/30 shadow-md bg-blue-50/20'
                              : 'border-ink-200 hover:border-ink-300 bg-white hover:shadow-xs'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <div
                              className={`h-8 w-14 rounded-lg shadow-sm flex items-center justify-center ${
                                theme.isLight ? 'border border-slate-300 ring-1 ring-slate-200' : 'border border-white/20'
                              }`}
                              style={{ background: theme.previewGradient }}
                            >
                              <span className="w-2.5 h-2.5 rounded-full" style={{ background: theme.glowColor, boxShadow: `0 0 6px ${theme.glowColor}` }} />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-wide ${
                                theme.isLight
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}>
                                {theme.category}
                              </span>
                              {isSelected ? (
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                                  <Check size={12} strokeWidth={3} />
                                </span>
                              ) : (
                                <span className="h-5 w-5 rounded-full border border-ink-300 group-hover:border-ink-400" />
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-bold text-ink-900">{theme.name}</p>
                            <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">{theme.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <Button type="submit" disabled={systemSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Save size={15} /> {systemSaving ? 'Saving Theme…' : 'Save Theme & Appearance'}
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* ── Pricing & Cost Parameters Card ── */}
          <Card className="mt-6 max-w-3xl">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                  <Coins size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-ink-900">Pricing &amp; Cost Parameters</h3>
              </div>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-700">Admin Exclusive</span>
            </div>
            <p className="text-xs text-ink-400 mb-6">
              Configure contingency, overhead, food cost %, and raw material price adjustments. These are applied automatically when calculating recipe costs and suggested selling prices on all products.
            </p>

            {/* Live Preview */}
            {(() => {
              const adjType = systemForm.rawMaterialPriceAdjustType;
              const adjVal = Number(systemForm.rawMaterialPriceAdjustValue) || 0;
              const cont = Number(systemForm.contingencyPercent) || 0;
              const ovhd = Number(systemForm.overheadPercent) || 0;
              const spice = Number(systemForm.spiceCostPercent) || 0;
              const fc = Math.max(Number(systemForm.defaultFoodCostPercent) || 30, 1);

              // Standard recipe cost example from Ethiopian culinary costing (e.g., Bread & Roti Recipe: 557.57 ETB)
              const exampleRaw = 557.57;
              const adjCost = adjType === 'percent'
                ? exampleRaw * (1 + adjVal / 100)
                : exampleRaw + adjVal;
              const contAmount = adjCost * (cont / 100);
              const ovhdAmount = adjCost * (ovhd / 100);
              const spiceAmount = adjCost * (spice / 100);
              const total = adjCost + contAmount + ovhdAmount + spiceAmount;
              const selling = total / (fc / 100);
              const fmt = (n) => `ETB ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

              return (
                <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                      Live Culinary Cost Preview (Example: {fmt(exampleRaw)} raw material cost)
                    </p>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-white/70 px-2 py-0.5 rounded-full border border-emerald-200">
                      Hospitality Standard Costing
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6 text-xs">
                    {[
                      { label: 'Adjusted Cost', value: fmt(adjCost), color: 'text-ink-700 font-bold' },
                      { label: `+ Contingency ${cont}%`, value: fmt(contAmount), color: 'text-amber-600 font-semibold' },
                      { label: `+ Overhead ${ovhd}%`, value: fmt(ovhdAmount), color: 'text-violet-600 font-semibold' },
                      { label: `+ Spice Cost ${spice}%`, value: fmt(spiceAmount), color: 'text-rose-600 font-semibold' },
                      { label: 'Total Recipe Cost', value: fmt(total), color: 'text-ink-900 font-black' },
                      { label: `Selling @ ${fc}% FC`, value: fmt(selling), color: 'text-emerald-700 font-black' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="rounded-xl bg-white border border-emerald-100 px-3 py-2 text-center shadow-xs">
                        <p className="text-[10px] text-ink-400 mb-0.5">{label}</p>
                        <p className={`font-bold ${color}`}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Selling price at all benchmarks */}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[30, 35, 40, 50].map(pct => (
                      <span key={pct} className="rounded-lg bg-white border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-xs">
                        Food cost {pct}% → Sell at {fmt(total / (pct / 100))}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}

            <form onSubmit={handleSystemSubmit} className="space-y-5">
              {/* Raw Material Price Adjustment */}
              <div className="rounded-2xl border border-blue-100 bg-blue-50/20 p-5 space-y-4">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-ink-900">Raw Material Price Adjustment</p>
                    <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-0.5">
                      Direct Inventory Sync
                    </span>
                  </div>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Adjust raw material prices globally. You can apply this adjustment directly to all active raw material inventory unit costs (e.g., Bread @ ETB 100 → ETB 110), or calculate simulated recipe pricing.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex rounded-xl border border-ink-200 overflow-hidden bg-white">
                    {[
                      { val: 'percent', label: '% Percent' },
                      { val: 'fixed', label: 'ETB Fixed' },
                    ].map(opt => (
                      <button
                        key={opt.val}
                        type="button"
                        onClick={() => setSystemForm(p => ({ ...p, rawMaterialPriceAdjustType: opt.val }))}
                        className={`px-4 py-2 text-xs font-semibold transition ${systemForm.rawMaterialPriceAdjustType === opt.val
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-ink-600 hover:bg-ink-50'
                          }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-36">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={systemForm.rawMaterialPriceAdjustValue}
                      onChange={e => {
                        setSystemForm(p => ({ ...p, rawMaterialPriceAdjustValue: e.target.value }));
                        setRawMaterialError('');
                        setRawMaterialSuccess('');
                      }}
                      className="w-full rounded-xl border-2 border-blue-200 bg-white py-2 pl-3 pr-10 text-sm font-bold outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-ink-400">
                      {systemForm.rawMaterialPriceAdjustType === 'percent' ? '%' : 'ETB'}
                    </span>
                  </div>

                  {/* Quick adjustment buttons */}
                  <div className="flex gap-1.5 flex-wrap items-center">
                    <span className="text-[11px] font-semibold text-ink-400">Quick:</span>
                    {(systemForm.rawMaterialPriceAdjustType === 'percent'
                      ? [5, 10, 15, 20, 25]
                      : [5, 10, 20, 50, 100]
                    ).map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => {
                          setSystemForm(p => ({ ...p, rawMaterialPriceAdjustValue: val }));
                          setRawMaterialError('');
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold border transition ${Number(systemForm.rawMaterialPriceAdjustValue) === val
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-ink-600 border-ink-200 hover:border-blue-400'
                          }`}
                      >
                        +{val}{systemForm.rawMaterialPriceAdjustType === 'percent' ? '%' : ' ETB'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Bread Example Calculation */}
                {(() => {
                  const val = Number(systemForm.rawMaterialPriceAdjustValue) || 0;
                  const type = systemForm.rawMaterialPriceAdjustType;
                  const sampleOld = 100;
                  const sampleNew = type === 'percent'
                    ? (sampleOld * (1 + val / 100)).toFixed(2)
                    : (sampleOld + val).toFixed(2);

                  return (
                    <div className="rounded-xl border border-blue-200 bg-white p-3 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-ink-700">Example (e.g. Bread @ ETB 100.00): </span>
                        <span className="text-ink-500">becomes </span>
                        <span className="font-bold text-blue-700">ETB {sampleNew}</span>
                        <span className="ml-1 text-[11px] text-ink-400">
                          ({type === 'percent' ? `+${val}%` : `+ETB ${val.toFixed(2)}`})
                        </span>
                      </div>
                      <span className="text-[11px] text-ink-400">Affects all raw material inventory unit costs</span>
                    </div>
                  );
                })()}

                {/* Feedback for Raw Material bulk adjustment */}
                {rawMaterialSuccess && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-700">
                    <CheckCircle2 size={14} className="flex-shrink-0" /> {rawMaterialSuccess}
                  </div>
                )}
                {rawMaterialError && (
                  <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                    <AlertCircle size={14} className="flex-shrink-0" /> {rawMaterialError}
                  </div>
                )}

                {/* Action button to apply immediately */}
                <div className="pt-1 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRawMaterialBulkApply}
                    disabled={rawMaterialApplying || !Number(systemForm.rawMaterialPriceAdjustValue)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    {rawMaterialApplying
                      ? 'Updating All Raw Materials…'
                      : `Apply ${systemForm.rawMaterialPriceAdjustType === 'percent' ? `+${systemForm.rawMaterialPriceAdjustValue || '0'}%` : `+ETB ${systemForm.rawMaterialPriceAdjustValue || '0'}`} to All Raw Materials in Inventory`
                    }
                  </button>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-ink-600">
                    <input
                      type="checkbox"
                      checked={Boolean(systemForm.applyToMaterialsNow)}
                      onChange={e => setSystemForm(p => ({ ...p, applyToMaterialsNow: e.target.checked }))}
                      className="h-4 w-4 rounded text-blue-600 border-ink-300 cursor-pointer"
                    />
                    <span>Also update all raw material unit costs when saving settings</span>
                  </label>
                </div>
              </div>

              {/* Contingency, Overhead & Spice Cost Parameters */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Contingency */}
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">
                    Contingency % <span className="font-normal text-ink-400">(waste, spoilage)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={systemForm.contingencyPercent}
                      onChange={e => setSystemForm(p => ({ ...p, contingencyPercent: e.target.value }))}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="10"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-500">%</span>
                  </div>
                  <p className="text-[10px] text-ink-400 mt-1">Buffer added on raw material cost. Standard: 10–15%</p>
                </div>

                {/* Overhead */}
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">
                    Overhead % <span className="font-normal text-ink-400">(labour, electricity)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={systemForm.overheadPercent}
                      onChange={e => setSystemForm(p => ({ ...p, overheadPercent: e.target.value }))}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="25"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-violet-500">%</span>
                  </div>
                  <p className="text-[10px] text-ink-400 mt-1">Operational costs added to recipe. Standard: 10–25%</p>
                </div>

                {/* Spice Cost % */}
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">
                    Spice Cost % <span className="font-normal text-ink-400">(seasoning, oils)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={systemForm.spiceCostPercent}
                      onChange={e => setSystemForm(p => ({ ...p, spiceCostPercent: e.target.value }))}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="5"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-rose-500">%</span>
                  </div>
                  <p className="text-[10px] text-ink-400 mt-1">Culinary spice & oil buffer. Standard: 3–7%</p>
                </div>
              </div>

              {/* Default Food Cost % */}
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1.5">
                  Default Food Cost % <span className="font-normal text-ink-400">(used to calculate suggested selling price)</span>
                </label>
                <div className="flex items-center gap-4">
                  <div className="relative w-48">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="1"
                      value={systemForm.defaultFoodCostPercent}
                      onChange={e => setSystemForm(p => ({ ...p, defaultFoodCostPercent: e.target.value }))}
                      className="w-full rounded-xl border border-ink-200 py-2.5 pl-3 pr-10 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="30"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">%</span>
                  </div>
                  <div className="flex gap-2">
                    {[25, 30, 35, 40].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => setSystemForm(p => ({ ...p, defaultFoodCostPercent: pct }))}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold transition border ${Number(systemForm.defaultFoodCostPercent) === pct
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-ink-600 border-ink-200 hover:border-emerald-400 hover:text-emerald-700'
                          }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-ink-400 mt-1">
                  If total cost = ETB 492, at 30% food cost → suggested price = ETB 1,640. Industry standard: 28–35%
                </p>
              </div>

              {systemSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                  <CheckCircle2 size={14} className="flex-shrink-0" /> {systemSuccess}
                </div>
              )}
              {systemError && (
                <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  <AlertCircle size={14} className="flex-shrink-0" /> {systemError}
                </div>
              )}

              {/* ── Bulk Product Selling Price Adjustment ── */}
              <div className="rounded-2xl overflow-hidden border border-blue-100">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-blue-600 to-indigo-600">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
                      <TrendingUp size={18} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-black text-white">Bulk Product Price Increase</p>
                      <p className="text-[11px] text-blue-200">Apply a % increase to all product selling prices at once</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-bold text-white">Permanent Action</span>
                </div>

                <div className="p-5 space-y-4 bg-blue-50/30">
                  <p className="text-xs text-ink-600">
                    Use this when your menu prices need to increase across the board — for example, a 10% price rise due to inflation.
                    This <strong>permanently updates</strong> the selling price stored on every active product.
                  </p>

                  {/* Input row */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="relative">
                      <input
                        type="number"
                        min="0.01"
                        max="500"
                        step="0.1"
                        value={bulkPricePercent}
                        onChange={e => { setBulkPricePercent(e.target.value); setBulkPriceError(''); setBulkPriceSuccess(''); }}
                        placeholder="e.g. 10"
                        className="w-36 rounded-xl border-2 border-blue-200 bg-white py-2.5 pl-4 pr-10 text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-blue-500">%</span>
                    </div>

                    {/* Live example */}
                    {Number(bulkPricePercent) > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        {[100, 250, 500, 1000].map(ex => (
                          <div key={ex} className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-center">
                            <p className="text-[10px] text-ink-400">ETB {ex} →</p>
                            <p className="text-xs font-black text-blue-700">
                              ETB {(ex * (1 + Number(bulkPricePercent) / 100)).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Quick % buttons */}
                  <div className="flex gap-2 flex-wrap">
                    <p className="text-[11px] font-semibold text-ink-500 self-center">Quick:</p>
                    {[5, 10, 15, 20, 25].map(pct => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => { setBulkPricePercent(pct); setBulkPriceError(''); }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold border transition ${Number(bulkPricePercent) === pct
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-ink-600 border-ink-200 hover:border-blue-400 hover:text-blue-700'
                          }`}
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>

                  {/* Feedback */}
                  {bulkPriceSuccess && (
                    <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-700">
                      <CheckCircle2 size={14} className="flex-shrink-0" /> {bulkPriceSuccess}
                    </div>
                  )}
                  {bulkPriceError && (
                    <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-semibold text-red-700">
                      <AlertCircle size={14} className="flex-shrink-0" /> {bulkPriceError}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleBulkPriceApply}
                    disabled={bulkPriceApplying || !Number(bulkPricePercent)}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    {bulkPriceApplying
                      ? <><Percent size={15} className="animate-spin" /> Applying…</>
                      : <><Percent size={15} /> Apply +{bulkPricePercent || '0'}% to All Products</>
                    }
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button type="submit" disabled={systemSaving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Save size={15} /> {systemSaving ? 'Saving…' : 'Save Pricing Settings'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* ── Tab 4: Role Privileges ── */}
      {currentTab === 'permissions' && (
        <Card className="max-w-3xl">
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
              <Shield size={16} />
            </span>
            <h3 className="font-display text-base font-bold text-ink-900">
              System Roles &amp; Permissions Matrix
            </h3>
          </div>
          <p className="text-xs text-ink-400 mb-5">
            Your current assigned role is <strong className="capitalize text-ink-800">{user?.role}</strong>.
            {hasRole('admin') ? ' You can modify the system permissions below.' : ' You do not have permission to modify these settings.'}
          </p>

          <form onSubmit={handleSystemSubmit}>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/70 text-ink-600 font-semibold">
                    <th className="py-2.5 px-3">System Capability</th>
                    {SETTINGS_ROLES.map((r) => (
                      <th key={r.key} className="py-2.5 px-3 text-center">{r.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {CAPABILITIES.map((cap) => (
                    <tr key={cap.key}>
                      <td className="py-2.5 px-3 font-medium">{cap.label}</td>
                      {SETTINGS_ROLES.map((r) => (
                        <td key={r.key} className="py-2.5 px-3 text-center">
                          <input
                            type="checkbox"
                            disabled={!hasRole('admin')}
                            checked={systemForm.rolePermissions?.[cap.key]?.[r.key] || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setSystemForm(prev => ({
                                ...prev,
                                rolePermissions: {
                                  ...prev.rolePermissions,
                                  [cap.key]: {
                                    ...prev.rolePermissions?.[cap.key],
                                    [r.key]: checked
                                  }
                                }
                              }));
                            }}
                            className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Sidebar Navigation Visibility Matrix ── */}
            <div className="mt-8 pt-6 border-t border-ink-100">
              <div className="flex items-center gap-2 mb-1">
                <span className="rounded-lg bg-emerald-50 p-1.5 text-emerald-600">
                  <Layers size={15} />
                </span>
                <h4 className="text-sm font-bold text-ink-900">Sidebar Navigation Visibility</h4>
              </div>
              <p className="text-xs text-ink-400 mb-4">
                Control which sidebar menu items each role can see. Unchecking a section hides it completely for that role.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/70 text-ink-600 font-semibold">
                      <th className="py-2.5 px-3">Sidebar Section</th>
                      {SETTINGS_ROLES.map((r) => (
                        <th key={r.key} className="py-2.5 px-3 text-center">{r.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50 text-ink-700">
                    {NAV_ITEMS.map((nav) => (
                      <tr key={nav.key}>
                        <td className="py-2.5 px-3 font-medium">{nav.label}</td>
                        {SETTINGS_ROLES.map((r) => (
                          <td key={r.key} className="py-2.5 px-3 text-center">
                            <input
                              type="checkbox"
                              disabled={!hasRole('admin')}
                              checked={systemForm.navVisibility?.[nav.key]?.[r.key] ?? true}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSystemForm(prev => ({
                                  ...prev,
                                  navVisibility: {
                                    ...prev.navVisibility,
                                    [nav.key]: {
                                      ...prev.navVisibility?.[nav.key],
                                      [r.key]: checked,
                                    },
                                  },
                                }));
                              }}
                              className="h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── CRUD Privileges Matrix ── */}
            <div className="rounded-xl border border-ink-100 bg-surface p-4 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-rose-50 p-1.5 text-rose-600"><Shield size={15} /></span>
                <div>
                  <h4 className="text-sm font-bold text-ink-900">CRUD Action Privileges</h4>
                  <p className="text-xs text-ink-400">
                    Control which roles can <strong>View</strong>, <strong>Edit</strong>, and <strong>Delete</strong> records in each module.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/70 text-ink-600 font-semibold">
                      <th className="py-2.5 px-3">Module</th>
                      {SETTINGS_ROLES.map((r) => (
                        <th key={r.key} className="py-2.5 px-3 text-center" colSpan={3}>{r.label}</th>
                      ))}
                    </tr>
                    <tr className="border-b border-ink-100 bg-ink-50/40 text-ink-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-1.5 px-3"></th>
                      {SETTINGS_ROLES.map(r =>
                        ['View','Edit','Delete'].map(act => (
                          <th key={`${r.key}-${act}`} className={`py-1.5 px-2 text-center ${act==='Delete'?'text-red-500':act==='Edit'?'text-amber-600':'text-emerald-600'}`}>{act}</th>
                        ))
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50 text-ink-700">
                    {CRUD_MODULES_LIST.map((mod) => (
                      <tr key={mod.key} className="hover:bg-blue-50/20">
                        <td className="py-2.5 px-3 font-semibold text-ink-800">{mod.label}</td>
                        {SETTINGS_ROLES.map((r) =>
                          ['view', 'edit', 'delete'].map((action) => (
                            <td key={`${r.key}-${action}`} className="py-2.5 px-2 text-center">
                              <input
                                type="checkbox"
                                disabled={!hasRole('admin')}
                                checked={systemForm.crudPermissions?.[mod.key]?.[action]?.[r.key] ?? (r.key === 'admin')}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setSystemForm(prev => ({
                                    ...prev,
                                    crudPermissions: {
                                      ...prev.crudPermissions,
                                      [mod.key]: {
                                        ...prev.crudPermissions?.[mod.key],
                                        [action]: {
                                          ...prev.crudPermissions?.[mod.key]?.[action],
                                          [r.key]: checked,
                                        },
                                      },
                                    },
                                  }));
                                }}
                                className={`h-4 w-4 rounded border-ink-300 focus:ring-blue-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${action==='delete'?'text-red-500':action==='edit'?'text-amber-500':'text-emerald-600'}`}
                              />
                            </td>
                          ))
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-500 pt-2 border-t border-ink-50">
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span> <strong>View</strong> — Can see records</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></span> <strong>Edit</strong> — Can update records</span>
                <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500"></span> <strong>Delete</strong> — Can permanently remove records</span>
              </div>
            </div>

            {hasRole('admin') && (
              <div className="pt-5 flex justify-end">
                <Button type="submit" disabled={systemSaving} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Save size={15} /> {systemSaving ? 'Saving Permissions…' : 'Save Role Permissions'}
                </Button>
              </div>
            )}

            {systemSuccess && currentTab === 'permissions' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />
                <span>{systemSuccess}</span>
              </div>
            )}
            {systemError && currentTab === 'permissions' && (
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{systemError}</span>
              </div>
            )}
          </form>
        </Card>
      )}

      {/* ── Tab 5: Telegram Subscribers (Admin only) ── */}
      {currentTab === 'telegram' && hasRole('admin') && (
        <Card className="max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-blue-50 p-1.5 text-blue-600">
                <Send size={16} />
              </span>
              <div>
                <h3 className="font-bold text-base text-ink-900">Telegram Bot Subscribers</h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  Everyone who started <strong>@BabarotiBot</strong> and receives notifications
                </p>
              </div>
            </div>
            <button
              onClick={loadTgSubscribers}
              disabled={tgLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition"
            >
              {tgLoading ? 'Loading…' : '↻ Refresh'}
            </button>
            <button
              onClick={() => { setTgAddOpen(true); setTgError(''); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              + Add Manually
            </button>
          </div>

          {/* How to add people */}
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-800">
            <p className="font-bold mb-1">📢 How to add someone</p>
            <p>1. Share <strong>t.me/BabarotiBot</strong> — they tap Start to subscribe.</p>
            <p className="mt-0.5">2. Come back here and click <strong>"Register Phone"</strong> next to their name.</p>
            <p className="mt-0.5 text-blue-600">Only subscribers with a registered phone can receive OTP login codes.</p>
          </div>

          {tgSuccess && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              <CheckCircle2 size={15} className="flex-shrink-0" />
              {tgSuccess}
            </div>
          )}
          {tgError && (
            <div className="mb-3 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
              <AlertCircle size={15} className="flex-shrink-0" />
              {tgError}
            </div>
          )}

          {/* Subscriber list */}
          {tgLoading ? (
            <div className="py-8 text-center text-xs text-ink-400">Loading subscribers…</div>
          ) : tgSubscribers.length === 0 ? (
            <div className="py-8 text-center">
              <Send size={28} className="mx-auto mb-2 text-ink-200" />
              <p className="text-sm font-semibold text-ink-400">No subscribers yet</p>
              <p className="text-xs text-ink-300 mt-1">Share t.me/BabarotiBot to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-ink-100 shadow-xs">
              <table className="w-full min-w-[720px] text-sm" style={{ borderCollapse: 'collapse' }}>
                <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
                  <tr>
                    <th className="px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-blue-100 w-12" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>#</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 min-w-[130px]" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Name</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 min-w-[110px]" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Username</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 min-w-[220px]" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Phone (OTP)</th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 min-w-[160px]" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Subscribed At</th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-blue-100 min-w-[120px]" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tgSubscribers.map((sub, i) => {
                    const subId = sub.id || sub.chatId || `sub_${i}`;
                    const isEditing = Boolean(tgEditPhone && tgEditPhone === subId);

                    return (
                      <tr key={subId} className="hover:bg-ink-50/40 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td className="px-3 py-3 text-center text-xs text-ink-400 tabular-nums">{i + 1}</td>
                        <td className="px-4 py-3 font-semibold text-ink-800">{sub.name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-blue-600">
                          {sub.username ? `@${sub.username}` : '—'}
                        </td>

                        {/* Phone column with inline register/edit */}
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="tel"
                                value={tgPhoneVal}
                                onChange={e => setTgPhoneVal(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRegisterPhone(subId);
                                  if (e.key === 'Escape') { setTgEditPhone(null); setTgPhoneVal(''); }
                                }}
                                placeholder="e.g. 0918592028"
                                autoFocus
                                className="w-36 rounded-lg border border-blue-400 bg-white px-2.5 py-1.5 text-xs text-ink-800 outline-none focus:ring-2 focus:ring-blue-500/30"
                              />
                              <button
                                type="button"
                                onClick={() => handleRegisterPhone(subId)}
                                disabled={tgPhoneSaving}
                                className="rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-bold text-white transition disabled:opacity-50 shadow-xs cursor-pointer"
                              >
                                {tgPhoneSaving ? '…' : 'Save'}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setTgEditPhone(null); setTgPhoneVal(''); }}
                                className="p-1 text-ink-400 hover:text-ink-600 text-xs rounded hover:bg-ink-100 transition"
                                title="Cancel"
                              >✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              {sub.phone ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                                  ✅ {sub.phone}
                                </span>
                              ) : (
                                <span className="text-xs text-ink-400 italic">Not registered</span>
                              )}
                              <button
                                type="button"
                                onClick={() => { setTgEditPhone(subId); setTgPhoneVal(sub.phone || ''); setTgError(''); }}
                                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                              >
                                {sub.phone ? 'Edit' : '+ Register'}
                              </button>
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                          {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleRemoveTgSubscriber(subId, sub.name)}
                            disabled={tgRemoving === subId}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition disabled:opacity-50 shadow-xs cursor-pointer"
                          >
                            <Trash2 size={13} className="shrink-0" />
                            <span>{tgRemoving === subId ? 'Removing…' : 'Remove'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="border-t border-ink-100 px-4 py-2.5 bg-ink-50/50 text-xs text-ink-500 flex items-center justify-between">
                <span>{tgSubscribers.length} subscriber{tgSubscribers.length !== 1 ? 's' : ''} total</span>
                <span className="font-medium text-emerald-700">{tgSubscribers.filter(s => s.phone).length} with registered phone</span>
              </div>
            </div>
          )}

          {/* ── Add Subscriber Modal ── */}
          {tgAddOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-ink-100 px-5 py-4">
                  <h3 className="font-bold text-ink-900">Add Subscriber Manually</h3>
                  <button onClick={() => setTgAddOpen(false)} className="text-ink-400 hover:text-ink-700 text-lg font-bold">✕</button>
                </div>
                <form onSubmit={handleAddSubscriber} className="p-5 space-y-3">
                  <p className="text-xs text-ink-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    Add a person who hasn't messaged the bot yet. They can still receive OTP codes if their phone is registered. To also receive system notifications, they need to message <strong>@BabarotiBot</strong>.
                  </p>

                  <div>
                    <label className="block text-xs font-semibold text-ink-700 mb-1">Full Name *</label>
                    <input required value={tgAddForm.name}
                      onChange={e => setTgAddForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Anteneh Bekele"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-700 mb-1">Phone Number * <span className="text-blue-600">(used for OTP login)</span></label>
                    <input required type="tel" value={tgAddForm.phone}
                      onChange={e => setTgAddForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="e.g. 0911000000"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-700 mb-1">Telegram Username <span className="text-ink-400">(optional, without @)</span></label>
                    <input value={tgAddForm.username}
                      onChange={e => setTgAddForm(f => ({ ...f, username: e.target.value.replace(/^@/, '') }))}
                      placeholder="e.g. anteneh21"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-ink-700 mb-1">Telegram Chat ID <span className="text-ink-400">(optional — needed for notifications)</span></label>
                    <input value={tgAddForm.chatId}
                      onChange={e => setTgAddForm(f => ({ ...f, chatId: e.target.value }))}
                      placeholder="e.g. 1234567890"
                      className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                    <p className="mt-1 text-[10px] text-ink-400">To get their Chat ID: have them message @BabarotiBot, then you'll see them appear in this list with their ID.</p>
                  </div>

                  {tgError && (
                    <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-600">
                      ⚠ {tgError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={() => setTgAddOpen(false)}
                      className="rounded-lg border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition">
                      Cancel
                    </button>
                    <button type="submit" disabled={tgAddSaving}
                      className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white transition disabled:opacity-50">
                      {tgAddSaving ? 'Adding…' : 'Add Subscriber'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </Card>
      )}
      {/* ── Tab 6: Developer / System Owner Controls (Strictly dev role only) ── */}
      {currentTab === 'dev' && user?.role === 'dev' && (
        <Card className="max-w-3xl">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-5 pb-4 border-b border-amber-100">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg">
                <Lock size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-display text-base font-black text-ink-900 flex items-center gap-2">
                  Developer / System Owner Controls
                  <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 border border-amber-200">OWNER ONLY</span>
                </h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  Manage module licensing, lock/unlock restaurant subsystem per customer installation.
                </p>
              </div>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            <strong>⚠ Developer Security Area:</strong> Modules disabled here (Subsystem Suite, Finance &amp; Expenses, or Hotel Appearance Customizer) are locked and hidden across all hotel accounts including Admin. Only users with the Developer (dev) role can re-enable or manage them.
          </div>

          {/* Module & Interface Licensing */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-ink-900 mb-1 flex items-center gap-2">
              <Sliders size={15} className="text-amber-500" />
              Module &amp; Interface Licensing
            </h4>
            <p className="text-xs text-ink-400 mb-4">
              Enable or disable premium hotel modules and interface privileges per customer installation. Changes apply immediately across all devices.
            </p>

            <div className="space-y-3">
              {/* 1. Subsystem Suite */}
              <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-4 py-3">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink-900">Subsystem Suite (Restaurant POS &amp; Ordering)</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      devLicenseForm?.subsystem !== false
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}>
                      {devLicenseForm?.subsystem !== false ? 'Licensed & Active' : 'Locked / Hidden (Off)'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">POS Ordering, Captain Order, and Cash Sales. When off, completely hidden from non-developers.</p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={devLicenseForm?.subsystem !== false}
                    onChange={(e) => setDevLicenseForm(prev => ({ ...prev, subsystem: e.target.checked }))}
                  />
                  <div className="h-6 w-11 rounded-full bg-ink-200 peer-focus:ring-2 peer-focus:ring-amber-300 peer-checked:bg-amber-500 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full after:shadow" />
                </label>
              </div>

              {/* 2. Finance & Expenses Suite */}
              <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-4 py-3">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink-900">Finance &amp; Expenses Suite</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      devLicenseForm?.finance !== false
                        ? 'bg-purple-100 text-purple-700 border border-purple-200'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}>
                      {devLicenseForm?.finance !== false ? 'Licensed & Active' : 'Locked / Hidden (Off)'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    Overhead Expenses &amp; Analytics P&amp;L reports. When disabled, completely hidden and locked from non-developer hotel accounts.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={devLicenseForm?.finance !== false}
                    onChange={(e) => setDevLicenseForm(prev => ({ ...prev, finance: e.target.checked }))}
                  />
                  <div className="h-6 w-11 rounded-full bg-ink-200 peer-focus:ring-2 peer-focus:ring-amber-300 peer-checked:bg-amber-500 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full after:shadow" />
                </label>
              </div>

              {/* 3. Hotel Sidebar Appearance Customization Permission */}
              <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-4 py-3">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink-900">Allow Hotel Admin Theme &amp; Icon Customization</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      devLicenseForm?.themeCustomization !== false
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-rose-100 text-rose-700 border border-rose-200'
                    }`}>
                      {devLicenseForm?.themeCustomization !== false ? 'Allowed (Visible to Admin)' : 'Disallowed (Developer Only)'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    When active, hotel Admin can change sidebar themes and icon modes in System Settings. When disabled, the entire Appearance card disappears from Hotel Settings and is controlled exclusively by the developer.
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={devLicenseForm?.themeCustomization !== false}
                    onChange={(e) => setDevLicenseForm(prev => ({ ...prev, themeCustomization: e.target.checked }))}
                  />
                  <div className="h-6 w-11 rounded-full bg-ink-200 peer-focus:ring-2 peer-focus:ring-amber-300 peer-checked:bg-amber-500 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full after:shadow" />
                </label>
              </div>

              {/* 4. Modern Material UI Icons Mode */}
              <div className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/40 px-4 py-3">
                <div className="pr-4">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-ink-900">Modern Material UI Icons Mode</p>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                      devLicenseForm?.materialIcons !== false
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-slate-200 text-slate-700 border border-slate-300'
                    }`}>
                      {devLicenseForm?.materialIcons !== false ? 'Active (Material UI)' : 'Classic Clean (Off)'}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-1">
                    {devLicenseForm?.materialIcons !== false
                      ? 'ON: Displays Material UI icons with vibrant colored squircle badges (recommended for modern visual experience).'
                      : 'OFF: Displays classic minimalist icons without colorful squircle boxes (for customers who prefer the original layout).'}
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={devLicenseForm?.materialIcons !== false}
                    onChange={(e) => setDevLicenseForm(prev => ({ ...prev, materialIcons: e.target.checked }))}
                  />
                  <div className="h-6 w-11 rounded-full bg-ink-200 peer-focus:ring-2 peer-focus:ring-amber-300 peer-checked:bg-amber-500 transition-colors after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full after:shadow" />
                </label>
              </div>
            </div>
          </div>

          {/* Sidebar Appearance & Brand Theme (Developer Managed) */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-ink-900 mb-1 flex items-center gap-2">
              <Palette size={15} className="text-amber-500" />
              Sidebar Appearance &amp; Brand Color Theme
            </h4>
            <p className="text-xs text-ink-400 mb-3">
              Configure the hotel sidebar color palette to match the customer brand identity.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {THEME_OPTIONS.map((theme) => {
                const isSelected = (devLicenseForm?.sidebarTheme || 'navy') === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setDevLicenseForm(prev => ({ ...prev, sidebarTheme: theme.id }))}
                    className={`relative p-3 rounded-2xl border text-left transition-all flex flex-col justify-between overflow-hidden group ${
                      isSelected
                        ? 'border-amber-500 ring-2 ring-amber-400/40 shadow-md bg-amber-50/20'
                        : 'border-ink-200 hover:border-ink-300 bg-white hover:shadow-xs'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div
                        className={`h-8 w-14 rounded-lg shadow-sm flex items-center justify-center ${
                          theme.isLight ? 'border border-slate-300 ring-1 ring-slate-200' : 'border border-white/20'
                        }`}
                        style={{ background: theme.previewGradient }}
                      >
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: theme.glowColor, boxShadow: `0 0 6px ${theme.glowColor}` }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold uppercase tracking-wide ${
                          theme.isLight
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {theme.category}
                        </span>
                        {isSelected ? (
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs">
                            <Check size={12} strokeWidth={3} />
                          </span>
                        ) : (
                          <span className="h-5 w-5 rounded-full border border-ink-300 group-hover:border-ink-400" />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink-900">{theme.name}</p>
                      <p className="text-[10px] text-ink-400 mt-0.5 leading-snug">{theme.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Master Key Section */}
          <div className="mb-6">
            <h4 className="text-sm font-bold text-ink-900 mb-1 flex items-center gap-2">
              <KeyRound size={15} className="text-amber-500" />
              Developer Master Key
            </h4>
            <p className="text-xs text-ink-400 mb-3">
              Secret master key code that unlocks developer controls (Default: <code className="bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-mono text-xs">dev-owner-2026</code>).
            </p>
            {!devKeyConfirmOpen ? (
              <button
                type="button"
                onClick={() => setDevKeyConfirmOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100 transition"
              >
                <KeyRound size={13} /> Change Master Key
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newDevKey}
                  onChange={e => setNewDevKey(e.target.value)}
                  placeholder="Enter new master key (min 8 characters)"
                  className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm font-mono outline-none focus:border-amber-400"
                />
                <div className="flex gap-2">
                  <button onClick={() => { setDevKeyConfirmOpen(false); setNewDevKey(''); }}
                    className="text-xs text-ink-400 hover:text-ink-700 px-2 py-1">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Dev Account Info */}
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/50 p-4">
            <h4 className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1.5">
              <Shield size={13} /> Developer Account Login Details
            </h4>
            <div className="text-xs text-ink-600 space-y-1">
              <p>Developer Email: <strong className="font-mono text-ink-900">{user?.email}</strong></p>
              <p>Role: <strong className="text-amber-700 font-bold uppercase">{user?.role}</strong></p>
              <p className="text-ink-400 text-[11px]">This account is invisible to hotel admins and staff.</p>
            </div>
          </div>

          {/* Actions */}
          {devSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
              <CheckCircle2 size={16} className="flex-shrink-0" />{devSuccess}
            </div>
          )}
          {devError && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
              <AlertCircle size={16} className="flex-shrink-0" />{devError}
            </div>
          )}
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleDevLicenseSave}
              disabled={devSaving}
              className="bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Save size={15} /> {devSaving ? 'Saving...' : 'Save Developer Settings'}
            </Button>
          </div>
        </Card>
      )}

      {/* ── Tab: Order Printers ── */}
      {currentTab === 'printers' && (() => {
        // loadPrinters is defined at component scope above
        const openAdd = () => {
          setPrinterForm(blankPrinter);
          setEditingPrinterId(null);
          setPrinterError('');
          setPrinterSuccess('');
          setShowPrinterForm(true);
        };

        const openEdit = (p) => {
          setPrinterForm({ ...blankPrinter, ...p });
          setEditingPrinterId(p._id);
          setPrinterError('');
          setPrinterSuccess('');
          setShowPrinterForm(true);
        };

        const savePrinter = async (e) => {
          e.preventDefault();
          if (!printerForm.name.trim()) { setPrinterError('Printer name is required'); return; }
          if (printerForm.connectionType === 'network' && !printerForm.ipAddress.trim()) {
            setPrinterError('IP address is required for network printers'); return;
          }
          setPrinterSaving(true);
          setPrinterError('');
          try {
            if (editingPrinterId) {
              await api.put(`/printers/${editingPrinterId}`, printerForm);
            } else {
              await api.post('/printers', printerForm);
            }
            setPrinterSuccess(editingPrinterId ? 'Printer updated.' : 'Printer added.');
            setTimeout(() => setPrinterSuccess(''), 4000);
            setShowPrinterForm(false);
            loadPrinters();
          } catch (err) {
            setPrinterError(err.response?.data?.message || 'Failed to save printer');
          } finally {
            setPrinterSaving(false);
          }
        };

        const deletePrinter = async (id) => {
          if (!window.confirm('Delete this printer configuration?')) return;
          try {
            await api.delete(`/printers/${id}`);
            setPrinterSuccess('Printer removed.');
            setTimeout(() => setPrinterSuccess(''), 3000);
            loadPrinters();
          } catch (err) {
            setPrinterError(err.response?.data?.message || 'Failed to delete');
          }
        };

        const printSystemReceipt = (printerOrForm) => {
          posPrint.printReceipt({
            orderNo: 'TEST-001',
            orderType: 'dine_in',
            tableNo: 'Table 1',
            waiterName: 'Test Server',
            customerName: 'Test Customer',
            paymentMethod: 'Cash',
            items: [
              { productName: 'Baba Roti Bun (Special)', quantity: 2, unitPrice: 35 },
              { productName: 'Ethiopian Coffee', quantity: 1, unitPrice: 30 },
            ],
            amountPaid: 100,
            taxRate: 15,
          }, {
            hotelName: printerOrForm?.headerLine1 || 'Baba Roti Café',
            footerLine: printerOrForm?.footerLine || 'Thank you! Come again.',
          });
        };

        const pingPrinter = async (ip, port) => {
          const key = `${ip}:${port}`;
          setPingStatus(prev => ({ ...prev, [key]: 'pending' }));
          try {
            const res = await api.post('/printers/action/ping', { ip, port: Number(port) });
            setPingStatus(prev => ({ ...prev, [key]: res.data.ok ? 'ok' : 'fail' }));
          } catch (_) {
            setPingStatus(prev => ({ ...prev, [key]: 'fail' }));
          }
        };

        const printTestPage = async (printerOrForm) => {
          const key = printerOrForm._id || `${printerOrForm.ipAddress}:${printerOrForm.port}`;
          setPrintTestStatus(prev => ({ ...prev, [key]: 'pending' }));
          setPrinterError('');
          try {
            const payload = printerOrForm._id
              ? { printerId: printerOrForm._id }
              : {
                  ip: printerOrForm.ipAddress,
                  port: printerOrForm.port,
                  brand: printerOrForm.brand,
                  model: printerOrForm.model,
                };
            const res = await api.post('/printers/action/test-page', payload);
            if (res.data.ok) {
              setPrintTestStatus(prev => ({ ...prev, [key]: 'ok' }));
              setPrinterSuccess(`Test page sent successfully to ${printerOrForm.name || printerOrForm.ipAddress}! Check printer.`);
              setTimeout(() => {
                setPrinterSuccess('');
                setPrintTestStatus(prev => ({ ...prev, [key]: null }));
              }, 6000);
            } else {
              setPrintTestStatus(prev => ({ ...prev, [key]: 'fail' }));
              setPrinterError(res.data.error || 'Test print failed');
            }
          } catch (err) {
            setPrintTestStatus(prev => ({ ...prev, [key]: 'fail' }));
            setPrinterError(err.response?.data?.error || err.response?.data?.message || err.message || 'Test print failed');
            setTimeout(() => setPrinterError(''), 6000);
          }
        };

        const toggleEnabled = async (p) => {
          try {
            await api.put(`/printers/${p._id}`, { ...p, enabled: !p.enabled });
            loadPrinters();
          } catch (_) {}
        };

        return (
          <div className="max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="font-display text-xl font-bold text-ink-900 flex items-center gap-2">
                  <span className="rounded-xl bg-violet-100 p-2 text-violet-600"><Printer size={20} /></span>
                  Order Printer Configuration
                </h2>
                <p className="text-sm text-ink-400 mt-1">
                  Connect thermal &amp; laser printers via IP address. Supports Epson, Star, Datecs, Citizen, Bixolon, HP LaserJet &amp; Generic printers.
                </p>
              </div>
              <button
                onClick={openAdd}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm px-4 py-2.5 transition shadow-md"
              >
                <Plus size={16} /> Add Printer
              </button>
            </div>

            {printerSuccess && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                <CheckCircle2 size={16} className="flex-shrink-0" />{printerSuccess}
              </div>
            )}
            {printerError && !showPrinterForm && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                <AlertCircle size={16} className="flex-shrink-0" />{printerError}
              </div>
            )}

            {/* Network Architecture & Relay Agent Status */}
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-xl border border-violet-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-700 flex items-center gap-1.5">
                    <Wifi size={13} className="text-violet-600" /> Direct RAW TCP (Port 9100)
                  </span>
                  <span className="rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
                    ACTIVE
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mt-1">
                  Parallel non-blocking dispatch with TCP FIN spooling &amp; 2.5s fail-fast timeout.
                </p>
              </div>

              <div className="rounded-xl border border-violet-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-700 flex items-center gap-1.5">
                    <Printer size={13} className="text-indigo-600" /> Local Bridge (:9101)
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    localBridgeInfo.online ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'
                  }`}>
                    {localBridgeInfo.online ? 'ONLINE' : 'STANDBY'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mt-1">
                  {localBridgeInfo.online
                    ? 'Connected to local Baba Roti agent. Direct LAN print ready.'
                    : 'Run baba-roti-agent.js locally for instant 0ms LAN print bridge.'}
                </p>
              </div>

              <div className="rounded-xl border border-violet-100 bg-white p-3.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-ink-700 flex items-center gap-1.5">
                    <Radio size={13} className="text-amber-600" /> Cloud Relay Agent
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    relayAgentInfo.online ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-ink-500'
                  }`}>
                    {relayAgentInfo.online ? 'CONNECTED' : 'STANDBY'}
                  </span>
                </div>
                <p className="text-[11px] text-ink-400 mt-1">
                  {relayAgentInfo.online
                    ? `Agent online (${relayAgentInfo.agent?.agentName || 'Relay'}). Cloud-to-LAN active.`
                    : 'Allows cloud servers (Render / Aletcloud) to print to local IP printers.'}
                </p>
              </div>
            </div>

            {/* How-to banner */}
            <div className="mb-6 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 p-4">
              <h4 className="text-xs font-bold text-violet-700 mb-2 flex items-center gap-1.5"><Wifi size={13} /> How It Works</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-ink-600">
                <div className="flex gap-2">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-[10px]">1</span>
                  <span>Connect your thermal printer to the <strong>same WiFi/LAN network</strong> as the POS computer.</span>
                </div>
                <div className="flex gap-2">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-[10px]">2</span>
                  <span>Find the printer's <strong>IP address</strong> by printing a self-test page or checking your router. Port is usually <strong>9100</strong>.</span>
                </div>
                <div className="flex gap-2">
                  <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-violet-600 text-white flex items-center justify-center font-black text-[10px]">3</span>
                  <span>Click <strong>Test Connection</strong> to verify, then set the printer type. Orders will print automatically.</span>
                </div>
              </div>
            </div>

            {/* Printer list */}
            {printersLoading ? (
              <div className="flex items-center justify-center py-16 text-ink-400">
                <span className="animate-spin mr-2"><Printer size={20} /></span> Loading printers…
              </div>
            ) : printers.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-ink-200 p-12 text-center">
                <Printer size={40} className="mx-auto text-ink-300 mb-3" />
                <p className="text-ink-500 font-semibold">No printers configured yet</p>
                <p className="text-xs text-ink-400 mt-1 mb-4">Add your first printer to start printing kitchen orders and receipts automatically</p>
                <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm px-4 py-2.5 transition">
                  <Plus size={15} /> Configure First Printer
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {printers.map(p => {
                  const pingKey = `${p.ipAddress}:${p.port}`;
                  const ping = pingStatus[pingKey];
                  return (
                    <div key={p._id} className={`rounded-2xl border ${p.enabled ? 'border-violet-100 bg-white' : 'border-ink-100 bg-ink-50/50'} p-5 shadow-sm`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`mt-0.5 flex-shrink-0 rounded-xl p-2.5 ${p.enabled ? 'bg-violet-100 text-violet-600' : 'bg-ink-100 text-ink-400'}`}>
                            <Printer size={20} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-ink-900 text-sm">{p.name}</span>
                              <span className="rounded-full bg-violet-100 text-violet-700 px-2 py-0.5 text-[10px] font-bold uppercase">{p.brand}</span>
                              <span className="rounded-full bg-blue-50 text-blue-600 px-2 py-0.5 text-[10px] font-bold capitalize">{PRINTER_TYPES.find(t => t.key === p.type)?.label || p.type}</span>
                              <span className="rounded-full bg-ink-100 text-ink-500 px-2 py-0.5 text-[10px] font-semibold">{p.paperWidth}</span>
                              {p.connectionType === 'system' ? (
                                <span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-bold border border-indigo-200">WINDOWS / BROWSER PRINT</span>
                              ) : (
                                <span className="rounded-full bg-violet-50 text-violet-700 px-2 py-0.5 text-[10px] font-bold border border-violet-200">RAW TCP 9100</span>
                              )}
                              {!p.enabled && <span className="rounded-full bg-red-100 text-red-600 px-2 py-0.5 text-[10px] font-bold">DISABLED</span>}
                            </div>
                            {p.model && <p className="text-xs text-ink-400 mt-0.5">Model: {p.model}</p>}
                            {p.connectionType === 'system' ? (
                              <p className="text-xs font-medium text-indigo-600 mt-1">
                                <Printer size={11} className="inline mr-1" />
                                Prints via Windows default/selected printer
                              </p>
                            ) : (
                              <p className="text-xs font-mono text-ink-500 mt-1">
                                <Wifi size={11} className="inline mr-1" />
                                {p.ipAddress}:{p.port}
                              </p>
                            )}
                            <div className="flex flex-wrap gap-2 mt-2 text-[10px] text-ink-500">
                              {p.printOnOrder && <span className="bg-emerald-50 text-emerald-700 rounded px-1.5 py-0.5 font-semibold">✓ Auto KOT on Order</span>}
                              {p.printOnCheckout && <span className="bg-blue-50 text-blue-700 rounded px-1.5 py-0.5 font-semibold">✓ Auto Receipt on Checkout</span>}
                              <span className="bg-ink-50 text-ink-600 rounded px-1.5 py-0.5">{p.copies}x copies</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                          {/* System Printer Test */}
                          {p.connectionType === 'system' ? (
                            <button
                              onClick={() => printSystemReceipt(p)}
                              title="Print via Windows Print Dialog"
                              className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2.5 py-1.5 text-[11px] font-semibold transition"
                            >
                              <Printer size={12} /> Print Test Page
                            </button>
                          ) : (
                            <>
                              {/* Ping Test */}
                              {p.ipAddress && (
                                <button
                                  onClick={() => pingPrinter(p.ipAddress, p.port)}
                                  disabled={ping === 'pending'}
                                  title="Test Connection"
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                                    ping === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                                    ping === 'fail' ? 'border-red-300 bg-red-50 text-red-600' :
                                    ping === 'pending' ? 'border-ink-200 bg-ink-50 text-ink-400' :
                                    'border-ink-200 bg-white text-ink-600 hover:border-violet-300 hover:text-violet-700'
                                  }`}
                                >
                                  {ping === 'ok' ? <><Wifi size={12} className="text-emerald-500" /> Online</> :
                                   ping === 'fail' ? <><WifiOff size={12} /> Offline</> :
                                   ping === 'pending' ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-ink-400 border-t-transparent rounded-full" /> Testing…</> :
                                   <><Wifi size={12} /> Ping</>
                                  }
                                </button>
                              )}
                              {/* Print Test Page */}
                              {p.ipAddress && (
                                <button
                                  onClick={() => printTestPage(p)}
                                  disabled={printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'pending'}
                                  title="Send a sample test print ticket"
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                                    printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                                    printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'fail' ? 'border-red-300 bg-red-50 text-red-600' :
                                    printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'pending' ? 'border-ink-200 bg-ink-50 text-ink-400' :
                                    'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100'
                                  }`}
                                >
                                  {printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'ok' ? '✓ Printed' :
                                   printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'fail' ? '✗ Print Failed' :
                                   printTestStatus[p._id || `${p.ipAddress}:${p.port}`] === 'pending' ? <><span className="animate-spin inline-block w-3 h-3 border-2 border-violet-600 border-t-transparent rounded-full" /> Printing…</> :
                                   <><Printer size={12} /> Test Page</>
                                  }
                                </button>
                              )}
                            </>
                          )}
                          {/* Toggle Enable */}
                          <button
                            onClick={() => toggleEnabled(p)}
                            title={p.enabled ? 'Disable printer' : 'Enable printer'}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${
                              p.enabled ? 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100' :
                              'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
                            }`}
                          >
                            {p.enabled ? <ToggleRight size={14} className="text-violet-600" /> : <ToggleLeft size={14} />}
                            {p.enabled ? 'Enabled' : 'Disabled'}
                          </button>
                          <button onClick={() => openEdit(p)} title="Edit" className="rounded-lg border border-ink-200 bg-white hover:bg-ink-50 p-1.5 text-ink-500 hover:text-ink-800 transition">
                            <Save size={13} />
                          </button>
                          <button onClick={() => deletePrinter(p._id)} title="Delete" className="rounded-lg border border-red-100 bg-red-50 hover:bg-red-100 p-1.5 text-red-500 transition">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Add / Edit Printer Modal ── */}
            {showPrinterForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between p-6 border-b border-ink-100">
                    <h3 className="font-display text-lg font-bold text-ink-900 flex items-center gap-2">
                      <Printer size={18} className="text-violet-600" />
                      {editingPrinterId ? 'Edit Printer' : 'Add New Printer'}
                    </h3>
                    <button onClick={() => setShowPrinterForm(false)} className="rounded-lg p-1.5 hover:bg-ink-100 text-ink-400">
                      <X size={18} />
                    </button>
                  </div>

                  <form onSubmit={savePrinter} className="p-6 space-y-5">
                    {printerError && (
                      <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-600">
                        <AlertCircle size={14} className="flex-shrink-0" />{printerError}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Printer Name */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Printer Name *</label>
                        <input
                          type="text" required
                          value={printerForm.name}
                          onChange={e => setPrinterForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          placeholder="e.g. Kitchen Printer 1"
                        />
                      </div>

                      {/* Brand */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Printer Brand</label>
                        <select
                          value={printerForm.brand}
                          onChange={e => setPrinterForm(f => ({ ...f, brand: e.target.value }))}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white"
                        >
                          {PRINTER_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                      </div>

                      {/* Model — grouped by selected brand */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Model</label>
                        <select
                          value={printerForm.model}
                          onChange={e => {
                            const val = e.target.value;
                            setPrinterForm(f => ({ ...f, model: val === '__custom__' ? '' : val }));
                          }}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white"
                        >
                          <option value="">— Select a model —</option>
                          {(PRINTER_MODELS[printerForm.brand] || PRINTER_MODELS.Generic).map(m => (
                            <option key={m} value={m === 'Custom (type manually)' ? '__custom__' : m}>{m}</option>
                          ))}
                        </select>
                        {/* Show free-text input if custom or model not in list */}
                        {(printerForm.model === '' ||
                          !(PRINTER_MODELS[printerForm.brand] || PRINTER_MODELS.Generic)
                            .filter(m => m !== 'Custom (type manually)')
                            .includes(printerForm.model)
                        ) && (
                          <input
                            type="text"
                            value={printerForm.model}
                            onChange={e => setPrinterForm(f => ({ ...f, model: e.target.value }))}
                            className="mt-2 w-full rounded-xl border border-violet-200 bg-violet-50/30 py-2 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
                            placeholder="Type model name manually (e.g. TM-T88VI)"
                          />
                        )}
                      </div>

                      {/* Printer Type */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Printer Type</label>
                        <select
                          value={printerForm.type}
                          onChange={e => setPrinterForm(f => ({ ...f, type: e.target.value }))}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 bg-white"
                        >
                          {PRINTER_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* Paper Width */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Paper Width</label>
                        <div className="flex gap-2">
                          {PAPER_WIDTHS.map(w => (
                            <button
                              key={w} type="button"
                              onClick={() => setPrinterForm(f => ({
                                ...f,
                                paperWidth: w,
                                charWidth: w === '58mm' ? 32 : w === 'A4' ? 60 : 42,
                              }))}
                              className={`flex-1 rounded-xl border py-2 text-sm font-semibold transition ${
                                printerForm.paperWidth === w
                                  ? 'border-violet-500 bg-violet-50 text-violet-700'
                                  : 'border-ink-200 bg-white text-ink-500 hover:border-violet-300'
                              }`}
                            >{w}</button>
                          ))}
                        </div>
                      </div>

                      {/* Connection Mode */}
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Connection Mode</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setPrinterForm(f => ({ ...f, connectionType: 'system' }))}
                            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                              printerForm.connectionType === 'system'
                                ? 'border-violet-600 bg-violet-50/70 ring-2 ring-violet-600/30'
                                : 'border-ink-200 bg-white hover:bg-ink-50'
                            }`}
                          >
                            <Printer size={18} className={`mt-0.5 flex-shrink-0 ${printerForm.connectionType === 'system' ? 'text-violet-600' : 'text-ink-400'}`} />
                            <div>
                              <p className="text-xs font-bold text-ink-900">Windows / System Printer</p>
                              <p className="text-[11px] text-ink-500 mt-0.5">
                                Works everywhere (including Cloud hosting). Prints directly to installed <strong>HP LaserJet M402dn</strong> via browser dialog.
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setPrinterForm(f => ({ ...f, connectionType: 'network' }))}
                            className={`flex items-start gap-3 p-3 rounded-xl border text-left transition ${
                              printerForm.connectionType === 'network'
                                ? 'border-violet-600 bg-violet-50/70 ring-2 ring-violet-600/30'
                                : 'border-ink-200 bg-white hover:bg-ink-50'
                            }`}
                          >
                            <Wifi size={18} className={`mt-0.5 flex-shrink-0 ${printerForm.connectionType === 'network' ? 'text-violet-600' : 'text-ink-400'}`} />
                            <div>
                              <p className="text-xs font-bold text-ink-900">Network IP (Direct TCP)</p>
                              <p className="text-[11px] text-ink-500 mt-0.5">
                                Silent raw printing over local WiFi / Ethernet (Port 9100). Requires local network server.
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* IP Address and Port only shown for network mode */}
                      {printerForm.connectionType === 'network' ? (
                        <>
                          <div>
                            <label className="block text-xs font-semibold text-ink-700 mb-1">IP Address *</label>
                            <input
                              type="text"
                              value={printerForm.ipAddress}
                              onChange={e => setPrinterForm(f => ({ ...f, ipAddress: e.target.value }))}
                              className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
                              placeholder="192.168.1.100"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-ink-700 mb-1">Port (default: 9100)</label>
                            <input
                              type="number" min="1" max="65535"
                              value={printerForm.port}
                              onChange={e => setPrinterForm(f => ({ ...f, port: Number(e.target.value) }))}
                              className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 font-mono"
                            />
                          </div>
                        </>
                      ) : (
                        <div className="sm:col-span-2 p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-900 flex items-start gap-2.5">
                          <Printer size={16} className="text-indigo-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-bold">Windows System Printer Selected</p>
                            <p className="text-[11px] text-indigo-700 mt-0.5">
                              No IP address configuration required! When orders or receipts print, the system will use your Windows printer (<strong>HP LaserJet M402dn (2170BF)</strong>).
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Copies */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Copies per Print</label>
                        <input
                          type="number" min="1" max="5"
                          value={printerForm.copies}
                          onChange={e => setPrinterForm(f => ({ ...f, copies: Number(e.target.value) }))}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                        />
                      </div>

                      {/* Header Line 1 */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Receipt Header Line 1</label>
                        <input
                          type="text"
                          value={printerForm.headerLine1}
                          onChange={e => setPrinterForm(f => ({ ...f, headerLine1: e.target.value }))}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          placeholder="Baba Roti Café"
                        />
                      </div>

                      {/* Footer Line */}
                      <div>
                        <label className="block text-xs font-semibold text-ink-700 mb-1">Receipt Footer Message</label>
                        <input
                          type="text"
                          value={printerForm.footerLine}
                          onChange={e => setPrinterForm(f => ({ ...f, footerLine: e.target.value }))}
                          className="w-full rounded-xl border border-ink-200 py-2.5 px-3 text-sm outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
                          placeholder="Thank you! Come again."
                        />
                      </div>
                    </div>

                    {/* Toggle options */}
                    <div className="rounded-xl border border-ink-100 bg-ink-50/50 p-4 space-y-3">
                      <h4 className="text-xs font-bold text-ink-700 mb-2">Auto-Print Options</h4>
                      {[
                        { key: 'enabled',        label: 'Printer Enabled', desc: 'Disable to skip this printer without deleting it' },
                        { key: 'printOnOrder',   label: 'Auto KOT on Order Send', desc: 'Print kitchen order ticket when order is submitted' },
                        { key: 'printOnCheckout',label: 'Auto Receipt on Checkout', desc: 'Print customer receipt when payment is completed' },
                      ].map(({ key, label, desc }) => (
                        <div key={key} className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-xs font-semibold text-ink-800">{label}</p>
                            <p className="text-[11px] text-ink-400">{desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPrinterForm(f => ({ ...f, [key]: !f[key] }))}
                            className={`flex-shrink-0 rounded-full w-10 h-6 flex items-center px-1 transition ${
                              printerForm[key] ? 'bg-violet-600' : 'bg-ink-200'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${
                              printerForm[key] ? 'translate-x-4' : 'translate-x-0'
                            }`} />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* HP / Laser Notice */}
                    {(printerForm.brand === 'HP' || /laser|m402|m404/i.test(printerForm.model)) && (
                      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-800">
                        <Printer size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-blue-900">HP LaserJet / Laser Printer Mode</p>
                          <p className="text-[11px] text-blue-700 mt-0.5">
                            Orders and receipts will automatically use clean ASCII/PCL format sent over TCP port 9100 (RAW). Your HP LaserJet M402dne can print both KOT tickets and customer receipts.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Test Connection / Test Print inline */}
                    {printerForm.connectionType === 'system' ? (
                      <div className="flex items-center justify-between p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
                        <div className="flex items-center gap-2">
                          <Printer size={16} className="text-indigo-600 flex-shrink-0" />
                          <span className="text-xs text-indigo-900 font-medium">Test print via Windows / System Dialog</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => printSystemReceipt(printerForm)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-300 bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-2 text-xs font-semibold shadow-sm transition"
                        >
                          <Printer size={13} /> Print Test Page
                        </button>
                      </div>
                    ) : printerForm.ipAddress ? (
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-ink-100 bg-ink-50/50">
                          <div className="flex items-center gap-2">
                            <Wifi size={14} className="text-violet-500 flex-shrink-0" />
                            <span className="text-xs text-ink-600">
                              Target: <strong className="font-mono text-ink-800">{printerForm.ipAddress}:{printerForm.port}</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => pingPrinter(printerForm.ipAddress, printerForm.port)}
                              disabled={pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'pending'}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                                pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'fail' ? 'border-red-300 bg-red-50 text-red-600' :
                                pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'pending' ? 'border-ink-200 bg-ink-100 text-ink-400' :
                                'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                              }`}
                            >
                              {pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'ok' ? '✓ Connected' :
                               pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'fail' ? '✗ Unreachable' :
                               pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'pending' ? 'Testing…' :
                               'Ping Test'}
                            </button>

                            <button
                              type="button"
                              onClick={() => printTestPage(printerForm)}
                              disabled={printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'pending'}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                                printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'ok' ? 'border-emerald-300 bg-emerald-50 text-emerald-700' :
                                printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'fail' ? 'border-red-300 bg-red-50 text-red-600' :
                                printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'pending' ? 'border-ink-200 bg-ink-100 text-ink-400' :
                                'border-violet-300 bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                              }`}
                            >
                              {printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'ok' ? '✓ Page Sent' :
                               printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'fail' ? '✗ Send Failed' :
                               printTestStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'pending' ? 'Sending…' :
                               <><Printer size={12} /> Print Test Page</>}
                            </button>
                          </div>
                        </div>

                        {/* Unreachable diagnostic banner */}
                        {pingStatus[`${printerForm.ipAddress}:${printerForm.port}`] === 'fail' && (
                          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2">
                            <p className="font-bold flex items-center gap-1.5 text-amber-950">
                              <AlertCircle size={14} className="text-amber-600 flex-shrink-0" />
                              Why is 10.241.18.48:9100 showing "Unreachable"?
                            </p>
                            <p className="text-[11px] text-amber-800 leading-relaxed">
                              When using this app hosted in the cloud (Aletcloud / Render), the cloud server on the internet cannot reach private local network IPs like <strong className="font-mono">10.241.18.48</strong>.
                            </p>
                            <div className="pt-1 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setPrinterForm(f => ({ ...f, connectionType: 'system' }));
                                  printSystemReceipt(printerForm);
                                }}
                                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-1.5 text-xs transition shadow-sm"
                              >
                                Print Test Page via Windows Dialog Now
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    <div className="flex justify-end gap-3 pt-2">
                      <button type="button" onClick={() => setShowPrinterForm(false)} className="rounded-xl border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50 transition">
                        Cancel
                      </button>
                      <button type="submit" disabled={printerSaving} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm px-5 py-2 transition">
                        <Save size={14} /> {printerSaving ? 'Saving…' : editingPrinterId ? 'Update Printer' : 'Save Printer'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Tab: Service Charge ── */}
      {currentTab === 'serviceCharge' && (() => {
        const presets = Array.isArray(systemForm.serviceChargePresets) && systemForm.serviceChargePresets.length > 0
          ? systemForm.serviceChargePresets
          : [5, 10, 15];

        const handlePresetsChange = (str) => {
          const arr = str
            .split(',')
            .map((s) => Number(s.trim()))
            .filter((n) => !isNaN(n) && n > 0 && n <= 100);
          setSystemForm({ ...systemForm, serviceChargePresets: arr });
        };

        const togglePreset = (num) => {
          let next;
          if (presets.includes(num)) {
            next = presets.filter((p) => p !== num);
          } else {
            next = [...presets, num].sort((a, b) => a - b);
          }
          if (next.length === 0) next = [10];
          setSystemForm({ ...systemForm, serviceChargePresets: next });
        };

        // Live calculation sample
        const sampleSubtotal = 250;
        const currentRate = systemForm.serviceChargeRate || 10;
        const sampleTax = Math.round((sampleSubtotal * (systemForm.taxRate || 15)) / 100 * 100) / 100;
        const sampleSvc = systemForm.enableServiceCharge
          ? Math.round((sampleSubtotal * currentRate) / 100 * 100) / 100
          : 0;
        const sampleTotal = sampleSubtotal + sampleTax + sampleSvc;

        return (
          <div className="space-y-6 max-w-4xl">
            {systemSuccess && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
                <span className="text-sm font-semibold">{systemSuccess}</span>
              </div>
            )}
            {systemError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                <span className="text-sm font-semibold">{systemError}</span>
              </div>
            )}

            {/* Header info */}
            <div>
              <h2 className="text-xl font-bold text-ink-900 flex items-center gap-2">
                <span className="rounded-lg bg-blue-50 p-2 text-blue-600">
                  <Percent size={20} />
                </span>
                Service Charge &amp; Table Hospitality Fees
              </h2>
              <p className="text-sm text-ink-400 mt-1">
                Configure restaurant service fees, POS cashier quick-select buttons, Dine-In table rules, and customer receipt breakdowns.
              </p>
            </div>

            <form onSubmit={handleSystemSubmit} className="space-y-6">
              {/* Master Activation Card */}
              <Card className="p-6 border border-ink-100 shadow-sm rounded-2xl bg-white">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-ink-100">
                  <div>
                    <h3 className="text-base font-bold text-ink-900">Service Charge System Status</h3>
                    <p className="text-xs text-ink-500 mt-0.5">
                      When enabled, service charge can be automatically or manually applied across POS Ordering, Captain Orders, and Cash Sales.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={systemForm.enableServiceCharge}
                      onChange={(e) => setSystemForm({ ...systemForm, enableServiceCharge: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-ink-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="ml-3 text-xs font-bold uppercase tracking-wider text-ink-700">
                      {systemForm.enableServiceCharge ? (
                        <span className="text-blue-600">Active</span>
                      ) : (
                        <span className="text-ink-400">Disabled</span>
                      )}
                    </span>
                  </label>
                </div>

                {/* Configuration Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                      Default Service Charge Rate (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={systemForm.serviceChargeRate}
                        onChange={(e) => setSystemForm({ ...systemForm, serviceChargeRate: Number(e.target.value) })}
                        className="w-full rounded-xl border border-ink-200 py-2.5 pl-3.5 pr-10 text-sm font-semibold text-ink-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="10"
                      />
                      <span className="absolute right-3.5 top-2.5 text-xs font-bold text-ink-400">%</span>
                    </div>
                    <p className="text-[11px] text-ink-400 mt-1.5">
                      Default hospitality charge applied to customer bills when enabled.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-ink-700 mb-1.5">
                      Quick Preset Percentages (%)
                    </label>
                    <input
                      type="text"
                      value={presets.join(', ')}
                      onChange={(e) => handlePresetsChange(e.target.value)}
                      className="w-full rounded-xl border border-ink-200 py-2.5 px-3.5 text-sm font-semibold text-ink-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                      placeholder="5, 10, 15"
                    />
                    <p className="text-[11px] text-ink-400 mt-1.5">
                      Comma-separated list of quick buttons available for cashiers in POS.
                    </p>
                  </div>
                </div>

                {/* Preset Chips Quick Toggle */}
                <div className="pt-4">
                  <span className="text-xs font-semibold text-ink-600 block mb-2">
                    Click to quickly toggle popular percentage buttons:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {[5, 8, 10, 12, 15, 18, 20].map((rate) => {
                      const isIncluded = presets.includes(rate);
                      return (
                        <button
                          key={rate}
                          type="button"
                          onClick={() => togglePreset(rate)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            isIncluded
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'bg-ink-100 text-ink-600 hover:bg-ink-200'
                          }`}
                        >
                          {isIncluded && <Check size={13} />}
                          {rate}%
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dine-In Automation Toggle */}
                <div className="mt-6 pt-5 border-t border-ink-100">
                  <label className="flex items-start gap-3.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={systemForm.autoApplyServiceChargeDineIn}
                      onChange={(e) => setSystemForm({ ...systemForm, autoApplyServiceChargeDineIn: e.target.checked })}
                      className="mt-0.5 h-4 w-4 rounded border-ink-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-xs font-bold text-ink-900">
                        Automatically Preselect for Dine-In Table Orders
                      </p>
                      <p className="text-[11px] text-ink-500 mt-0.5">
                        When cashiers or captains create a Dine-In table order, the default service charge ({systemForm.serviceChargeRate || 10}%) will be automatically pre-selected. Cashiers can still manually override or remove it by clicking &ldquo;None&rdquo;.
                      </p>
                    </div>
                  </label>
                </div>
              </Card>

              {/* Live Preview Card */}
              <Card className="p-6 border border-blue-100 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <span className="rounded-md bg-blue-600 text-white p-1">
                    <Eye size={14} />
                  </span>
                  <h3 className="text-sm font-bold text-ink-900 uppercase tracking-wide">
                    Live POS Register &amp; Receipt Preview
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* POS Button Interface Preview */}
                  <div className="bg-white rounded-xl p-4 border border-ink-200 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2">
                      Cashier Register Interface Preview
                    </p>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          SERVICE CHARGE:
                        </span>
                        <div className="flex gap-1.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-400 border border-slate-200 text-[10px] font-bold">
                            None
                          </span>
                          {presets.map((rate) => {
                            const isDefault = rate === (systemForm.serviceChargeRate || 10);
                            return (
                              <span
                                key={rate}
                                className={`px-2.5 py-1 rounded text-[10px] font-bold border transition ${
                                  isDefault && systemForm.enableServiceCharge
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                                }`}
                              >
                                {rate}% {isDefault && systemForm.enableServiceCharge && '✓'}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* Line calculations breakdown */}
                      <div className="mt-3 pt-2.5 border-t border-slate-200 text-xs space-y-1 font-mono">
                        <div className="flex justify-between text-slate-500">
                          <span>Subtotal:</span>
                          <span>ETB {sampleSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                          <span>VAT ({systemForm.taxRate || 15}%):</span>
                          <span>ETB {sampleTax.toFixed(2)}</span>
                        </div>
                        {systemForm.enableServiceCharge && sampleSvc > 0 && (
                          <div className="flex justify-between text-blue-600 font-semibold">
                            <span>Service Charge ({currentRate}%):</span>
                            <span>+ETB {sampleSvc.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-slate-900 font-bold pt-1 border-t border-slate-200">
                          <span>Grand Total:</span>
                          <span>ETB {sampleTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Receipt Preview */}
                  <div className="bg-white rounded-xl p-4 border border-ink-200 shadow-xs">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400 mb-2">
                      Customer Thermal Receipt Preview (ESC/POS)
                    </p>
                    <div className="bg-amber-50/60 font-mono text-[11px] text-ink-800 p-3.5 rounded-lg border border-amber-200/60 leading-relaxed">
                      <div className="text-center font-bold text-xs mb-1">
                        {systemForm.hotelName || 'Baba Roti  Café'}
                      </div>
                      <div className="text-center text-[10px] text-ink-500 mb-2">
                        {systemForm.address || 'Addis Ababa, Ethiopia'}
                      </div>
                      <div className="border-b border-dashed border-ink-300 my-1.5" />
                      <div className="flex justify-between">
                        <span>1x Baba Roti Bun</span>
                        <span>ETB 35.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span>1x Special Coffee</span>
                        <span>ETB 30.00</span>
                      </div>
                      <div className="border-b border-dashed border-ink-300 my-1.5" />
                      <div className="flex justify-between text-ink-500">
                        <span>Subtotal:</span>
                        <span>ETB 65.00</span>
                      </div>
                      <div className="flex justify-between text-ink-500">
                        <span>Tax ({systemForm.taxRate || 15}%):</span>
                        <span>ETB 9.75</span>
                      </div>
                      {systemForm.enableServiceCharge ? (
                        <div className="flex justify-between font-bold text-blue-700">
                          <span>Service Charge ({currentRate}%):</span>
                          <span>ETB {(65 * currentRate / 100).toFixed(2)}</span>
                        </div>
                      ) : null}
                      <div className="border-t border-ink-800 font-bold pt-1 mt-1 flex justify-between">
                        <span>TOTAL:</span>
                        <span>
                          ETB {(65 + 9.75 + (systemForm.enableServiceCharge ? 65 * currentRate / 100 : 0)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Save Bar */}
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="submit"
                  disabled={systemSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-2.5 shadow-sm inline-flex items-center gap-2 rounded-xl"
                >
                  <Save size={15} />
                  {systemSaving ? 'Saving Settings…' : 'Save Service Charge Settings'}
                </Button>
              </div>
            </form>
          </div>
        );
      })()}

    </div>
  );
}
