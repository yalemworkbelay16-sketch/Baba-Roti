import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Search, Trash2, Eye, X, CheckCircle, Ban,
  UtensilsCrossed, Users, Briefcase, BookOpen, Gift, FileText,
  RefreshCw, Pencil, Printer, Check, ShieldCheck, Lock,
  Settings2, AlertCircle, UserCheck, Clock,
  Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Filter,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import WorkflowBadge from '../components/ui/WorkflowBadge';
import ExportDropdown from '../components/ui/ExportDropdown';
import Pagination from '../components/ui/Pagination';
import SearchableSelect from '../components/ui/SearchableSelect';
import { posPrint } from '../utils/posPrint';
import { dispatchPrint } from '../utils/localPrintDispatcher';
import useHighlightRow from '../hooks/useHighlightRow';
import {
  getLocalDateKey,
  getLocalDateTimeInputValue,
  localDateTimeInputToIso,
  shiftDateKey,
} from '../utils/dateTime';

/* ── Category config ─────────────────────────────────────────────── */
const CATEGORIES = [
  { key: 'staff_meal', label: 'Staff Meal', icon: UtensilsCrossed, color: 'bg-emerald-100 text-emerald-700', activeCls: 'bg-emerald-600' },
  { key: 'guest_entertainment', label: 'Guest Entertainment', icon: Users, color: 'bg-violet-100 text-violet-700', activeCls: 'bg-violet-600' },
  { key: 'owner_management', label: 'Owner / Management', icon: Briefcase, color: 'bg-blue-100 text-blue-700', activeCls: 'bg-blue-600' },
  { key: 'training_event', label: 'Training & Events', icon: BookOpen, color: 'bg-amber-100 text-amber-700', activeCls: 'bg-amber-600' },
  { key: 'complimentary', label: 'Complimentary', icon: Gift, color: 'bg-pink-100 text-pink-700', activeCls: 'bg-pink-600' },
  { key: 'other', label: 'Other', icon: FileText, color: 'bg-slate-100 text-slate-700', activeCls: 'bg-slate-600' },
];
const catByKey = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));
const emptyItem = () => ({ product: '', quantity: 1 });

const getEmptyForm = () => ({
  category: 'staff_meal',
  date: getLocalDateTimeInputValue(),
  beneficiary: '',
  pax: 1,
  department: '',
  notes: '',
  items: [emptyItem()],
});

const emptyForm = getEmptyForm();

const isDrinkProduct = (p) => {
  const pc = String(p?.parentCategory || '').toLowerCase();
  const cat = String(p?.category || '').toLowerCase();
  return pc === 'beverage' || pc === 'juices' || /hot drink|cold drink|juice|soft drink/.test(cat);
};

const etb = (n) => `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatOrdinal = (n) => {
  const num = Number(n) || 0;
  const mod100 = num % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${num}th`;
  const mod10 = num % 10;
  if (mod10 === 1) return `${num}st`;
  if (mod10 === 2) return `${num}nd`;
  if (mod10 === 3) return `${num}rd`;
  return `${num}th`;
};

const toLocalDateKey = (val) => getLocalDateKey(val);

export default function Consumption() {
  const { user, can, hasRole } = useAuth();
  const isPrivileged = ['dev', 'admin'].includes(user?.role);
  const canManageStaffMeals = ['admin', 'dev'].includes(user?.role);
  const canCreate = can('recordGoods') || Boolean(user);
  const canApprove = can('approveGoods');
  const canVoid = ['admin', 'manager', 'dev'].includes(user?.role);

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [dateMode, setDateMode] = useState('today'); // 'today' | 'yesterday' | 'custom' | 'all'
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const [selectedStaff, setSelectedStaff] = useState('ALL');
  const [showSummaryPanel, setShowSummaryPanel] = useState(true);
  const [loading, setLoading] = useState(false);
  const [successToast, setSuccessToast] = useState('');

  // Form modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Allowed Meals Quota Modal (Admin / Dev only)
  const [allowedMealsModalOpen, setAllowedMealsModalOpen] = useState(false);
  const [selectedEmpForQuotaId, setSelectedEmpForQuotaId] = useState('');
  const [selectedProductIdsForQuota, setSelectedProductIdsForQuota] = useState(new Set());
  const [quotaMealsDisabled, setQuotaMealsDisabled] = useState(false);
  const [quotaDailyMealLimit, setQuotaDailyMealLimit] = useState(1);
  const [productDailyLimits, setProductDailyLimits] = useState({});
  const [quotaSearchQuery, setQuotaSearchQuery] = useState('');
  const [quotaCategoryFilter, setQuotaCategoryFilter] = useState('');
  const [savingAllowedMeals, setSavingAllowedMeals] = useState(false);

  // Detail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null);

  // Approve/Void confirmation
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState(null); // 'approve'|'void'
  const [actionRecord, setActionRecord] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionPassword, setActionPassword] = useState('');
  const [actionWorking, setActionWorking] = useState(false);
  const [actionError, setActionError] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const params = {};
      if (filterCat) params.category = filterCat;
      const res = await api.get('/consumption', { params });
      console.log('[Consumption] API response:', typeof res.data, JSON.stringify(res.data)?.slice(0, 200));
      const data = res.data;
      setRecords(Array.isArray(data) ? data : []);
      setPage(1);
    } catch (err) {
      console.error('[Consumption] Load error:', err);
      setLoadError(err.response?.data?.message || err.message || 'Failed to load records.');
    }
    finally { setLoading(false); }
  }, [filterCat]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/products')
      .then(r => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProducts([]));
    api.get('/employees', { params: { status: 'active' } })
      .then(r => setEmployees(Array.isArray(r.data) ? r.data : []))
      .catch(() => setEmployees([]));
  }, []);

  /* ── Current user & role-based employee scoping ── */
  const currentUserEmployee = useMemo(() => {
    if (!user) return null;
    const userName = (user.name || '').trim().toLowerCase();
    const userEmail = (user.email || '').trim().toLowerCase();
    const userEmpId = (user.employeeId || '').trim().toLowerCase();
    const userPhone = (user.phone || '').trim().replace(/\D/g, '');
    const userRole = (user.role || '').trim().toLowerCase();

    // 1. Search in employees list
    if (employees.length > 0) {
      if (userEmpId) {
        const m = employees.find(e => (e.employeeId || '').trim().toLowerCase() === userEmpId);
        if (m) return m;
      }
      if (userEmail) {
        const m = employees.find(e => (e.email || '').trim().toLowerCase() === userEmail);
        if (m) return m;
      }
      if (userPhone && userPhone.length >= 7) {
        const m = employees.find(e => (e.phone || '').trim().replace(/\D/g, '').endsWith(userPhone.slice(-7)));
        if (m) return m;
      }
      const exactName = employees.find(e => {
        const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
        return fullName === userName;
      });
      if (exactName) return exactName;

      const partialName = employees.find(e => {
        const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
        return (fullName && userName && (fullName.includes(userName) || userName.includes(fullName)));
      });
      if (partialName) return partialName;

      if (!isPrivileged && userRole) {
        const roleMatch = employees.find(e => (e.position || '').toLowerCase().includes(userRole));
        if (roleMatch) return roleMatch;
      }
    }

    // 2. Fallback synthetic profile from user
    return {
      _id: user?._id || 'self',
      firstName: user?.name?.split(' ')[0] || user?.name || 'Staff',
      lastName: user?.name?.split(' ').slice(1).join(' ') || '',
      department: user?.department || 'Staff',
      position: user?.role || 'Staff',
      allowedProducts: user?.allowedProducts || [],
    };
  }, [user, employees, isPrivileged]);

  const activeDateKey = useMemo(() => {
    if (dateMode === 'all') return '';
    if (dateMode === 'today') return toLocalDateKey(new Date());
    if (dateMode === 'yesterday') return shiftDateKey(toLocalDateKey(new Date()), -1);
    return selectedDate || toLocalDateKey(new Date());
  }, [dateMode, selectedDate]);

  /* ── role + date + staff + search filtering ── */
  const scopedByRole = useMemo(() => {
    const safe = Array.isArray(records) ? records : [];
    if (isPrivileged) return safe;
    return safe.filter(r => {
      if (!r.beneficiary) return false;
      const b = r.beneficiary.toLowerCase();
      const myName = (user?.name || '').trim().toLowerCase();
      const myEmpName = currentUserEmployee
        ? `${currentUserEmployee.firstName || ''} ${currentUserEmployee.lastName || ''}`.trim().toLowerCase()
        : '';
      return (myEmpName && (b.includes(myEmpName) || myEmpName.includes(b))) ||
        (myName && (b.includes(myName) || myName.includes(b)));
    });
  }, [records, isPrivileged, user, currentUserEmployee]);

  const scopedByDate = useMemo(() => {
    if (!activeDateKey) return scopedByRole;
    return scopedByRole.filter(r => toLocalDateKey(r.date) === activeDateKey);
  }, [scopedByRole, activeDateKey]);

  // Unique staff options with consumption counts for the selected date range
  const staffFilterOptions = useMemo(() => {
    const countsByName = new Map();
    const displayByKey = new Map();

    scopedByDate.forEach(r => {
      if (r.status === 'voided') return;
      const raw = String(r.beneficiary || r.performedBy?.name || '').trim();
      if (!raw) return;
      const key = raw.toLowerCase();
      if (!displayByKey.has(key)) displayByKey.set(key, raw);
      countsByName.set(key, (countsByName.get(key) || 0) + 1);
    });

    if (isPrivileged) {
      employees.forEach(e => {
        const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim();
        if (!fullName) return;
        const key = fullName.toLowerCase();
        if (!displayByKey.has(key)) displayByKey.set(key, fullName);
        if (!countsByName.has(key)) countsByName.set(key, 0);
      });
    }

    return Array.from(displayByKey.entries())
      .map(([key, name]) => ({ key, name, count: countsByName.get(key) || 0 }))
      .sort((a, b) => (b.count - a.count) || a.name.localeCompare(b.name));
  }, [scopedByDate, employees, isPrivileged]);

  const filtered = useMemo(() => {
    let list = scopedByDate;

    if (selectedStaff && selectedStaff !== 'ALL') {
      const target = selectedStaff.toLowerCase();
      list = list.filter(r => {
        const ben = String(r.beneficiary || '').trim().toLowerCase();
        const byName = String(r.performedBy?.name || '').trim().toLowerCase();
        return ben === target || ben.includes(target) || target.includes(ben) || (!ben && byName === target);
      });
    }

    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(r =>
      r.voucherNo?.toLowerCase().includes(q) ||
      r.beneficiary?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q) ||
      (r.items || []).some(it => String(it.product?.name || '').toLowerCase().includes(q))
    );
  }, [scopedByDate, selectedStaff, search]);

  // Daily "Who Ate How Much" Summary (uses activeDateKey, or Today when in 'all' view)
  const summaryDateKey = activeDateKey || toLocalDateKey(new Date());
  const dailyStaffSummary = useMemo(() => {
    const prodMap = new Map(products.map(p => [String(p._id), p]));
    const dayRecords = scopedByRole.filter(
      r => r.status !== 'voided' && toLocalDateKey(r.date) === summaryDateKey
    );

    const byStaff = new Map();
    let totalVouchers = 0;
    let totalPortions = 0;
    let totalFood = 0;
    let totalDrinks = 0;
    let totalCost = 0;

    dayRecords.forEach(r => {
      const rawName = String(r.beneficiary || r.performedBy?.name || 'Unassigned').trim() || 'Unassigned';
      const key = rawName.toLowerCase();
      if (!byStaff.has(key)) {
        byStaff.set(key, {
          key,
          name: rawName,
          vouchers: 0,
          portions: 0,
          food: 0,
          drinks: 0,
          cost: 0,
          itemsMap: new Map(),
        });
      }
      const entry = byStaff.get(key);
      entry.vouchers += 1;
      totalVouchers += 1;

      const recCost = Number(r.totalRecipeCost || 0);
      entry.cost += recCost;
      totalCost += recCost;

      (r.items || []).forEach(it => {
        const pId = String(it.product?._id || it.product);
        const prodMeta = (typeof it.product === 'object' && it.product?.name) ? it.product : prodMap.get(pId);
        const prodName = prodMeta?.name || 'Item';
        const q = Number(it.quantity) || 1;
        const drink = isDrinkProduct(prodMeta);

        entry.portions += q;
        totalPortions += q;
        if (drink) {
          entry.drinks += q;
          totalDrinks += q;
        } else {
          entry.food += q;
          totalFood += q;
        }
        entry.itemsMap.set(prodName, (entry.itemsMap.get(prodName) || 0) + q);
      });
    });

    const staffList = Array.from(byStaff.values())
      .map(s => ({
        ...s,
        itemsList: Array.from(s.itemsMap.entries()).map(([name, qty]) => ({ name, qty })),
      }))
      .sort((a, b) => (b.portions - a.portions) || (b.cost - a.cost) || a.name.localeCompare(b.name));

    return {
      dateKey: summaryDateKey,
      staffList,
      totalStaff: staffList.length,
      totalVouchers,
      totalPortions,
      totalFood,
      totalDrinks,
      totalCost,
    };
  }, [scopedByRole, products, summaryDateKey]);

  const { setRowRef, rowClass } = useHighlightRow({
    items: records,
    displayed: filtered,
    pageSize,
    setPage,
    onEnsureVisible: () => {
      setFilterCat('');
      setSearch('');
      setDateMode('all');
      setSelectedStaff('ALL');
    },
  });

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Selectable employees: Dev and Admin see ALL employees.
  // Other staff are locked strictly to their own identity.
  const selectableEmployees = useMemo(() => {
    if (isPrivileged) {
      return employees;
    }
    return currentUserEmployee ? [currentUserEmployee] : [];
  }, [isPrivileged, employees, currentUserEmployee]);

  // Find the selected employee object
  // For non-privileged staff, this is ALWAYS strictly the current user's profile
  // For privileged (admin / dev), resolves from form.beneficiary
  const selectedEmployeeObj = useMemo(() => {
    if (form.category !== 'staff_meal') return null;
    if (!isPrivileged) {
      return currentUserEmployee;
    }
    if (!form.beneficiary) return null;
    const cleanName = String(form.beneficiary).trim().toLowerCase();
    return employees.find(e => {
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      return fullName === cleanName || cleanName.includes(fullName) || fullName.includes(cleanName);
    }) || null;
  }, [form.category, form.beneficiary, employees, isPrivileged, currentUserEmployee]);

  // Whether staff meals are explicitly disabled/restricted for the selected employee
  const isMealsRestricted = useMemo(() => {
    if (form.category !== 'staff_meal') return false;
    if (!isPrivileged) {
      return Boolean(currentUserEmployee?.mealsDisabled || user?.mealsDisabled);
    }
    return Boolean(selectedEmployeeObj?.mealsDisabled);
  }, [form.category, isPrivileged, currentUserEmployee, user, selectedEmployeeObj]);

  // Allowed product IDs for the selected employee:
  // null = all menu products permitted (no quota restriction)
  // Set with IDs = restricted strictly to these products
  // empty Set = 0 allowed products configured (staff cannot order without admin quota)
  const allowedProductIds = useMemo(() => {
    if (form.category !== 'staff_meal') return null;
    if (isMealsRestricted) return new Set();

    if (!isPrivileged) {
      const empList = Array.isArray(currentUserEmployee?.allowedProducts) ? currentUserEmployee.allowedProducts : [];
      const userList = Array.isArray(user?.allowedProducts) ? user.allowedProducts : [];
      const combined = [...empList, ...userList];
      if (combined.length === 0) {
        return new Set(); // 0 meals allowed -> alert user
      }
      return new Set(combined.map(p => (typeof p === 'object' && p !== null ? String(p._id) : String(p))));
    }

    // Privileged (admin / dev):
    if (!selectedEmployeeObj) return null;
    const list = selectedEmployeeObj.allowedProducts;
    if (!Array.isArray(list) || list.length === 0) return null;
    return new Set(list.map(p => (typeof p === 'object' && p !== null ? String(p._id) : String(p))));
  }, [form.category, isMealsRestricted, selectedEmployeeObj, isPrivileged, currentUserEmployee, user]);

  // Available products: strictly filtered to allowed meal products
  const availableProducts = useMemo(() => {
    if (form.category !== 'staff_meal') {
      return products;
    }
    if (isMealsRestricted) {
      return [];
    }
    if (!isPrivileged) {
      // Non-privileged staff: if no allowed products configured, return empty list!
      if (!allowedProductIds || allowedProductIds.size === 0) {
        return [];
      }
      return products.filter(p => allowedProductIds.has(String(p._id)));
    }
    // Privileged (admin / dev):
    if (!allowedProductIds) {
      return products;
    }
    return products.filter(p => allowedProductIds.has(String(p._id)));
  }, [products, form.category, isMealsRestricted, allowedProductIds, isPrivileged]);

  // ── Calculate today's staff meal consumption for currently selected employee / user ──
  const todayEmployeeConsumption = useMemo(() => {
    if (form.category !== 'staff_meal') return { totalPortions: 0, totalFoodPortions: 0, byProduct: {}, recordsToday: [] };

    const empName = (form.beneficiary || '').trim().toLowerCase();
    const empId = selectedEmployeeObj?._id ? String(selectedEmployeeObj._id) : null;
    const userId = user?._id ? String(user._id) : null;
    const todayKey = getLocalDateKey();

    const matchingRecords = (records || []).filter(r => {
      if (r.category !== 'staff_meal' || r.status === 'voided') return false;
      if (getLocalDateKey(r.date) !== todayKey) return false;

      const rBeneficiary = String(r.beneficiary || '').trim().toLowerCase();
      const rEmpId = r.employee ? String(r.employee?._id || r.employee) : null;
      const rPerfId = r.performedBy ? String(r.performedBy?._id || r.performedBy) : null;

      if (empId && rEmpId && rEmpId === empId) return true;
      if (empName && rBeneficiary === empName) return true;
      if (!isPrivileged && (rPerfId === userId || rBeneficiary === String(user?.name || '').trim().toLowerCase())) return true;
      return false;
    });

    const prodMap = new Map(products.map(p => [String(p._id), p]));
    let totalPortions = 0;
    let totalFoodPortions = 0;
    const byProduct = {};
    for (const rec of matchingRecords) {
      for (const itm of rec.items || []) {
        const pId = String(itm.product?._id || itm.product);
        const prodMeta = typeof itm.product === 'object' && itm.product?.parentCategory ? itm.product : prodMap.get(pId);
        const q = Number(itm.quantity) || 1;
        totalPortions += q;
        if (!isDrinkProduct(prodMeta)) {
          totalFoodPortions += q;
        }
        byProduct[pId] = (byProduct[pId] || 0) + q;
      }
    }

    return { totalPortions, totalFoodPortions, byProduct, recordsToday: matchingRecords };
  }, [records, products, form.category, form.beneficiary, selectedEmployeeObj, user, isPrivileged]);

  // Overall daily meal limit (portions per day)
  const dailyMealLimit = useMemo(() => {
    if (!isPrivileged && currentUserEmployee?.dailyMealLimit) {
      return Number(currentUserEmployee.dailyMealLimit);
    }
    if (selectedEmployeeObj?.dailyMealLimit) {
      return Number(selectedEmployeeObj.dailyMealLimit);
    }
    return 1; // Default 1 portion/meal per day
  }, [isPrivileged, currentUserEmployee, selectedEmployeeObj]);

  // Whether the employee's allowance includes food meals (so drinks don't eat into daily food meal limit)
  const hasAllowedFoodItems = useMemo(() => {
    if (form.category !== 'staff_meal') return true;
    return availableProducts.some(p => !isDrinkProduct(p));
  }, [form.category, availableProducts]);

  const effectiveTodayUsed = hasAllowedFoodItems
    ? todayEmployeeConsumption.totalFoodPortions
    : todayEmployeeConsumption.totalPortions;

  // Per-product daily limit map
  const productDailyLimitsMap = useMemo(() => {
    const map = {};
    const emp = !isPrivileged ? currentUserEmployee : selectedEmployeeObj;
    (emp?.mealLimits || []).forEach(ml => {
      const pId = String(ml.product?._id || ml.product);
      map[pId] = Number(ml.maxPerDay) || 1;
    });
    return map;
  }, [isPrivileged, currentUserEmployee, selectedEmployeeObj]);

  const requestedPortionBreakdown = useMemo(() => {
    const prodMap = new Map(products.map(p => [String(p._id), p]));
    let food = 0;
    let drinks = 0;
    for (const it of form.items || []) {
      if (!it.product) continue;
      const p = prodMap.get(String(it.product));
      const q = Number(it.quantity) || 1;
      if (isDrinkProduct(p)) drinks += q;
      else food += q;
    }
    return { food, drinks, total: food + drinks };
  }, [form.items, products]);

  const isDailyQuotaReached = form.category === 'staff_meal' && effectiveTodayUsed >= dailyMealLimit;

  // Live pre-order warnings whenever selected items/quantities exceed per-item or daily limits
  const liveQuotaWarnings = useMemo(() => {
    if (form.category !== 'staff_meal') return [];
    const warnings = [];
    const prodMap = new Map(products.map(p => [String(p._id), p]));

    for (const it of form.items || []) {
      if (!it.product) continue;
      const pId = String(it.product);
      const prod = prodMap.get(pId);
      const pName = prod?.name || 'This item';
      const reqQty = Number(it.quantity) || 1;
      const usedToday = todayEmployeeConsumption.byProduct[pId] || 0;
      const maxToday = productDailyLimitsMap[pId] || 1;

      if (usedToday + reqQty > maxToday) {
        const nthAttempt = formatOrdinal(usedToday + reqQty);
        warnings.push(
          `${pName} is allowed ${maxToday} per day — already ordered ${usedToday}/${maxToday} today. Ordering a ${nthAttempt} time exceeds the daily allowance.`
        );
      }
    }

    if (hasAllowedFoodItems && requestedPortionBreakdown.food > 0 && effectiveTodayUsed + requestedPortionBreakdown.food > dailyMealLimit) {
      const nthMeal = formatOrdinal(effectiveTodayUsed + requestedPortionBreakdown.food);
      warnings.push(
        `Daily meal quota is ${dailyMealLimit} per day (${effectiveTodayUsed}/${dailyMealLimit} ordered today — ${nthMeal} meal exceeds daily limit).`
      );
    } else if (!hasAllowedFoodItems && requestedPortionBreakdown.total > 0 && effectiveTodayUsed + requestedPortionBreakdown.total > dailyMealLimit) {
      const nthDrink = formatOrdinal(effectiveTodayUsed + requestedPortionBreakdown.total);
      warnings.push(
        `Daily drink quota is ${dailyMealLimit} per day (${effectiveTodayUsed}/${dailyMealLimit} ordered today — ${nthDrink} portion exceeds daily limit).`
      );
    }

    return Array.from(new Set(warnings));
  }, [
    form.category,
    form.items,
    products,
    todayEmployeeConsumption,
    productDailyLimitsMap,
    hasAllowedFoodItems,
    requestedPortionBreakdown,
    effectiveTodayUsed,
    dailyMealLimit,
  ]);

  const isSelectedQuotaBlocked = !isPrivileged && form.category === 'staff_meal' && (
    availableProducts.length === 0 ||
    liveQuotaWarnings.length > 0
  );

  /* ── form helpers ── */
  const openCreate = () => {
    setEditing(null);
    const defaultBeneficiary = !isPrivileged
      ? (currentUserEmployee ? `${currentUserEmployee.firstName || ''} ${currentUserEmployee.lastName || ''}`.trim() : (user?.name || ''))
      : '';
    const defaultDept = !isPrivileged
      ? (currentUserEmployee?.department || user?.department || '')
      : '';
    setForm({
      ...getEmptyForm(),
      category: 'staff_meal',
      date: getLocalDateTimeInputValue(),
      beneficiary: defaultBeneficiary,
      department: defaultDept,
    });
    setFormError('');
    setModalOpen(true);
  };

  // Auto-synchronize beneficiary and department for non-privileged users whenever modal opens
  useEffect(() => {
    if (!isPrivileged && modalOpen && !editing) {
      const empName = currentUserEmployee
        ? `${currentUserEmployee.firstName || ''} ${currentUserEmployee.lastName || ''}`.trim()
        : (user?.name || '');
      const empDept = currentUserEmployee?.department || user?.department || '';
      setForm(f => {
        if (f.beneficiary === empName && f.department === empDept && f.category === 'staff_meal') {
          return f;
        }
        return {
          ...f,
          category: 'staff_meal',
          beneficiary: empName,
          department: empDept,
        };
      });
    }
  }, [modalOpen, isPrivileged, currentUserEmployee, user, editing]);

  const openEdit = (r) => {
    setEditing(r);
    setForm({
      category: r.category,
      date: getLocalDateTimeInputValue(r.date),
      beneficiary: r.beneficiary || '',
      pax: r.pax || 1,
      department: r.department || '',
      notes: r.notes || '',
      items: r.items.map(i => ({
        product: i.product?._id || i.product,
        quantity: i.quantity,
      })),
    });
    setFormError('');
    setModalOpen(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, k, v) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [k]: v };
    return { ...f, items };
  });

  // ── Allowed Meals Modal Handlers (Admin / Dev only) ──
  const openAllowedMealsModal = (empNameOrId = '') => {
    let targetEmp = null;
    if (empNameOrId) {
      targetEmp = employees.find(e => e._id === empNameOrId || `${e.firstName} ${e.lastName}` === empNameOrId);
    }
    if (!targetEmp && form.beneficiary) {
      targetEmp = employees.find(e => `${e.firstName} ${e.lastName}` === form.beneficiary);
    }
    if (!targetEmp && employees.length > 0) {
      targetEmp = employees[0];
    }
    const empId = targetEmp?._id || '';
    setSelectedEmpForQuotaId(empId);
    setSelectedProductIdsForQuota(new Set((targetEmp?.allowedProducts || []).map(p => typeof p === 'object' && p !== null ? p._id : p)));
    setQuotaMealsDisabled(Boolean(targetEmp?.mealsDisabled));
    setQuotaDailyMealLimit(Number(targetEmp?.dailyMealLimit) || 1);
    const limits = {};
    (targetEmp?.mealLimits || []).forEach(ml => {
      const pId = String(ml.product?._id || ml.product);
      limits[pId] = Number(ml.maxPerDay) || 1;
    });
    setProductDailyLimits(limits);
    setQuotaSearchQuery('');
    setQuotaCategoryFilter('');
    setAllowedMealsModalOpen(true);
  };

  const handleToggleProductForQuota = (prodId) => {
    setQuotaMealsDisabled(false);
    setSelectedProductIdsForQuota(prev => {
      const next = new Set(prev);
      if (next.has(prodId)) next.delete(prodId);
      else next.add(prodId);
      return next;
    });
  };

  const filteredQuotaProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = !quotaCategoryFilter || (p.category || 'General') === quotaCategoryFilter;
      const matchQ = !quotaSearchQuery || (p.name || '').toLowerCase().includes(quotaSearchQuery.toLowerCase()) || (p.code || '').toLowerCase().includes(quotaSearchQuery.toLowerCase());
      return matchCat && matchQ;
    });
  }, [products, quotaCategoryFilter, quotaSearchQuery]);

  const handleSelectAllShownProducts = () => {
    setQuotaMealsDisabled(false);
    setSelectedProductIdsForQuota(prev => {
      const next = new Set(prev);
      filteredQuotaProducts.forEach(p => next.add(p._id));
      return next;
    });
  };

  const handleClearAllQuotaProducts = () => {
    setQuotaMealsDisabled(false);
    setSelectedProductIdsForQuota(new Set());
  };

  const handleRestrictAllMeals = () => {
    setQuotaMealsDisabled(true);
    setSelectedProductIdsForQuota(new Set());
  };

  const handleSaveAllowedMeals = async () => {
    if (!selectedEmpForQuotaId) return;
    setSavingAllowedMeals(true);
    try {
      const targetEmp = employees.find(e => e._id === selectedEmpForQuotaId);
      const res = await api.put(`/employees/${selectedEmpForQuotaId}`, {
        mealsDisabled: quotaMealsDisabled,
        allowedProducts: quotaMealsDisabled ? [] : Array.from(selectedProductIdsForQuota),
        dailyMealLimit: Math.max(1, Number(quotaDailyMealLimit) || 1),
        mealLimits: quotaMealsDisabled
          ? []
          : Array.from(selectedProductIdsForQuota).map(pId => ({
            product: pId,
            maxPerDay: Math.max(1, Number(productDailyLimits[pId]) || 1),
          })),
      });
      const updatedEmp = res.data;
      setEmployees(prev => prev.map(e => e._id === selectedEmpForQuotaId ? updatedEmp : e));
      const empName = `${targetEmp?.firstName || ''} ${targetEmp?.lastName || ''}`.trim() || 'Employee';
      setSuccessToast(
        quotaMealsDisabled
          ? `🚫 Staff meals restricted (Not allowed all meals) for ${empName}!`
          : `🍽️ Allowed meal quota for ${empName} saved! (Limit: ${quotaDailyMealLimit}/day, ${selectedProductIdsForQuota.size} allowed items)`
      );
      setAllowedMealsModalOpen(false);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save allowed meals.');
    } finally {
      setSavingAllowedMeals(false);
    }
  };

  const handleSave = async (andPrintCaptainOrder = false) => {
    setSubmitting(true);
    setFormError('');
    try {
      if (isMealsRestricted) {
        setFormError(`Not allowed: Staff meals are restricted for ${form.beneficiary || 'this employee'} (Not Allowed All Meals).`);
        setSubmitting(false);
        return;
      }

      if (!isPrivileged && form.category === 'staff_meal' && availableProducts.length === 0) {
        setFormError('No allowed staff meals have been configured for your account. Please ask an Admin or Developer to assign your meals first.');
        setSubmitting(false);
        return;
      }

      const cleanItems = form.items.filter(i => i.product).map(i => ({
        product: i.product,
        quantity: Number(i.quantity) || 1,
      }));

      if (cleanItems.length === 0) {
        setFormError('Please select at least one product.');
        setSubmitting(false);
        return;
      }

      const payload = {
        ...form,
        date: form.date ? localDateTimeInputToIso(form.date) : new Date().toISOString(),
        items: cleanItems,
        employee: selectedEmployeeObj?._id || currentUserEmployee?._id || undefined,
        autoApprove: form.category === 'staff_meal',
      };

      // 1. Record consumption
      let savedRecord = null;
      if (editing) {
        const res = await api.put(`/consumption/${editing._id}`, payload);
        savedRecord = res.data;
      } else {
        const res = await api.post('/consumption', payload);
        savedRecord = res.data;
      }

      // 2. If Staff Meal & andPrintCaptainOrder, generate Captain Order & Print KOT!
      if (form.category === 'staff_meal' && andPrintCaptainOrder) {
        try {
          const orderItems = cleanItems.map(item => {
            const prod = products.find(p => String(p._id) === String(item.product));
            const prodName = prod?.name || 'Staff Meal';
            const isBar = /bar|beverage|drink|tea|coffee|juice|water/i.test(
              `${prod?.category || ''} ${prod?.parentCategory || ''} ${prodName}`
            );
            return {
              product: item.product,
              productName: prodName,
              productCode: prod?.code || '',
              category: prod?.category || 'General',
              parentCategory: isBar ? 'BEVERAGE' : 'FOOD',
              quantity: Number(item.quantity) || 1,
              unitPrice: 0,
              totalPrice: 0,
              notes: `Staff meal for ${form.beneficiary || 'Staff'}`,
              station: isBar ? 'barista' : 'kitchen',
            };
          });

          const captainPayload = {
            tableNo: 'STAFF MEAL',
            tableLabel: `STAFF MEAL (${form.beneficiary || 'Staff'})`,
            customerName: form.beneficiary || 'Staff Member',
            orderType: 'dine_in',
            waiterName: user?.name || 'Staff',
            tableNotes: `Staff Meal Consumption - Voucher ${savedRecord?.voucherNo || ''}`,
            items: orderItems,
            status: 'paid',
          };

          const capRes = await api.post('/captain-orders', captainPayload);
          const createdOrder = capRes?.data?.order || {
            ...captainPayload,
            orderNo: 'STAFF-' + String(Date.now()).slice(-4),
            createdAt: new Date(),
          };

          // Dispatch print ticket directly in background without blocking UI (instant order & print like POS)
          dispatchPrint('kot', createdOrder, {
            businessName: 'Baba Roti Café',
            fallbackBrowser: false,
          }).catch(printErr => {
            console.warn('[CONSUMPTION] Background KOT print dispatch error:', printErr);
          });

          setSuccessToast(
            savedRecord?.overLimitWarning
              ? `⚠️ Staff meal #${savedRecord?.voucherNo || ''} recorded OVER DAILY LIMIT (${savedRecord.overLimitWarning}) — Admin & System Developer notified.`
              : `🍽️ Staff meal #${savedRecord?.voucherNo || ''} auto-approved! Stock deducted and order sent to kitchen printer.`
          );
        } catch (kotErr) {
          console.warn('Captain order error:', kotErr);
          setSuccessToast(`🍽️ Staff meal #${savedRecord?.voucherNo || ''} recorded & auto-approved! (Stock deducted)`);
        }
      } else {
        const isStaff = form.category === 'staff_meal';
        setSuccessToast(
          savedRecord?.overLimitWarning
            ? `⚠️ Staff meal #${savedRecord?.voucherNo || ''} recorded OVER DAILY LIMIT (${savedRecord.overLimitWarning}) — Admin & System Developer notified.`
            : isStaff
              ? `🍽️ Staff meal #${savedRecord?.voucherNo || ''} auto-approved! Raw materials deducted from Kitchen & Bar.`
              : `Consumption record ${savedRecord?.voucherNo || ''} recorded successfully.`
        );
      }

      setModalOpen(false);
      setSubmitting(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Move to recycle bin?')) return;
    await api.delete(`/consumption/${id}`);
    load();
  };

  /* ── approve / void ── */
  const openAction = (record, type) => {
    setActionRecord(record); setActionType(type);
    setActionNote(''); setActionPassword(''); setActionError(''); setActionOpen(true);
  };

  const handleAction = async () => {
    if (actionType === 'void') {
      if (!actionNote.trim()) {
        setActionError('Please enter a reason for voiding this consumption.');
        return;
      }
      if (!actionPassword) {
        setActionError('Please enter your Admin or Manager password to confirm.');
        return;
      }
    }

    setActionWorking(true); setActionError('');
    try {
      const body = actionType === 'void'
        ? { note: actionNote.trim(), reason: actionNote.trim(), password: actionPassword }
        : { note: actionNote };
      await api.post(`/consumption/${actionRecord._id}/${actionType}`, body);
      setActionOpen(false);
      setActionPassword('');
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    } finally { setActionWorking(false); }
  };

  /* ── export data (reflects active date, staff user, category & search filters) ── */
  const exportData = useMemo(() => filtered.map(r => ({
    'Voucher No': r.voucherNo || '—',
    'Date': new Date(r.date).toLocaleDateString(),
    'Category': catByKey[r.category]?.label || r.category,
    'Beneficiary': r.beneficiary || '—',
    'Pax': r.pax || 1,
    'Department': r.department || '—',
    'Items Consumed': (r.items || []).map(i => `${i.product?.name || 'Item'} x${i.quantity}`).join(', '),
    'Recipe Cost': Number(r.totalRecipeCost || 0).toFixed(2),
    'Status': r.status?.toUpperCase(),
    'Recorded By': r.performedBy?.name || '—',
  })), [filtered]);

  // Dynamic category counts (aligned with active date & staff filter)
  const catCounts = useMemo(() => {
    let base = scopedByDate;
    if (selectedStaff && selectedStaff !== 'ALL') {
      const target = selectedStaff.toLowerCase();
      base = base.filter(r => {
        const ben = String(r.beneficiary || '').trim().toLowerCase();
        return ben === target || ben.includes(target) || target.includes(ben);
      });
    }
    const counts = { all: base.length };
    base.forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [scopedByDate, selectedStaff]);

  return (
    <div className="space-y-4">

      {/* ── Header ── */}
      {successToast && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast('')} className="text-emerald-600 hover:text-emerald-900 cursor-pointer">
            <X size={15} />
          </button>
        </div>
      )}

      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
        <div>
          <h1 className="hidden lg:block text-xl font-bold text-ink-900">Consumption Management</h1>
          <p className="text-xs text-ink-500">
            Staff meals, guest entertainment &amp; internal consumption — tracked &amp; costed
          </p>
        </div>

        {/* ── Date Control Bar (Red Box 1): Today / Yesterday / Pick Date / All ── */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 shadow-2xs">
          <Calendar size={14} className="text-blue-600 shrink-0 mr-0.5" />
          {[
            { id: 'today', label: 'Today' },
            { id: 'yesterday', label: 'Yesterday' },
            { id: 'all', label: 'All Dates' },
          ].map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setDateMode(opt.id);
                if (opt.id === 'today') setSelectedDate(toLocalDateKey(new Date()));
                else if (opt.id === 'yesterday') setSelectedDate(shiftDateKey(toLocalDateKey(new Date()), -1));
                setPage(1);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${dateMode === opt.id
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-ink-600 hover:bg-ink-50'
                }`}
            >
              {opt.label}
            </button>
          ))}
          <div className="flex items-center gap-1 border-l border-ink-100 pl-1.5 ml-0.5">
            <button
              type="button"
              onClick={() => {
                const base = activeDateKey || toLocalDateKey(new Date());
                setSelectedDate(shiftDateKey(base, -1));
                setDateMode('custom');
                setPage(1);
              }}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-900 cursor-pointer"
              title="Previous day"
            >
              <ChevronLeft size={14} />
            </button>
            <input
              type="date"
              value={dateMode === 'all' ? '' : activeDateKey}
              onChange={(e) => {
                const val = e.target.value;
                if (!val) {
                  setDateMode('all');
                } else {
                  setSelectedDate(val);
                  setDateMode('custom');
                }
                setPage(1);
              }}
              className="rounded-lg border border-ink-200 bg-ink-50/60 px-2 py-1 text-xs font-semibold text-ink-800 outline-none focus:border-blue-500 cursor-pointer"
              title="Filter consumption by specific date"
            />
            <button
              type="button"
              onClick={() => {
                const base = activeDateKey || toLocalDateKey(new Date());
                setSelectedDate(shiftDateKey(base, 1));
                setDateMode('custom');
                setPage(1);
              }}
              className="rounded-md p-1 text-ink-500 hover:bg-ink-50 hover:text-ink-900 cursor-pointer"
              title="Next day"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName="consumption_records"
            pdfTitle="Consumption Management Report"
            pdfColumns={[
              { header: 'Voucher', accessor: 'Voucher No' },
              { header: 'Date', accessor: 'Date' },
              { header: 'Category', accessor: 'Category' },
              { header: 'Beneficiary', accessor: 'Beneficiary' },
              { header: 'Pax', accessor: 'Pax', align: 'center' },
              { header: 'Cost (ETB)', accessor: 'Recipe Cost', align: 'right' },
              { header: 'Status', accessor: 'Status', align: 'center' },
            ]}
          />
          {canManageStaffMeals && (
            <button
              type="button"
              onClick={() => openAllowedMealsModal()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 text-xs sm:text-sm font-bold text-indigo-700 shadow-2xs transition cursor-pointer"
              title="Assign allowed staff meals per employee (Admin & System Developer only)"
            >
              <UtensilsCrossed size={15} /> Set Allowed Meals
            </button>
          )}
          {canCreate && (
            <button
              onClick={openCreate}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition"
            >
              <Plus size={15} /> New Consumption
            </button>
          )}
        </div>
      </div>

      {/* ── Category filter tabs + Staff User Dropdown (Red Box 2) ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5 rounded-xl border border-ink-100 bg-white p-2.5 sm:p-3 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar sm:flex-wrap">
          <button
            onClick={() => { setFilterCat(''); setPage(1); }}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition ${!filterCat
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <span>All</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${!filterCat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
              {catCounts.all || 0}
            </span>
          </button>
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = catCounts[cat.key] || 0;
            const isActive = filterCat === cat.key;
            return (
              <button key={cat.key}
                onClick={() => { setFilterCat(isActive ? '' : cat.key); setPage(1); }}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs font-semibold transition ${isActive ? `${cat.activeCls} text-white shadow-xs ring-2 ring-blue-400/40` : 'bg-white border border-ink-200 text-ink-600 hover:border-blue-400'
                  }`}
              >
                <Icon size={12} className={isActive ? 'text-white' : ''} />
                <span>{cat.label}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Select Show by Staff User */}
        <div className="flex items-center gap-2 shrink-0 border-t lg:border-t-0 lg:border-l border-ink-100 pt-2 lg:pt-0 lg:pl-3">
          <span className="flex items-center gap-1 text-xs font-semibold text-ink-600 whitespace-nowrap">
            <Users size={13} className="text-blue-600" />
            Staff User:
          </span>
          <select
            value={selectedStaff}
            onChange={(e) => { setSelectedStaff(e.target.value); setPage(1); }}
            className="min-w-[180px] max-w-[240px] rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-800 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Staff Users ({staffFilterOptions.filter(s => s.count > 0).length} active)</option>
            {staffFilterOptions.map(st => (
              <option key={st.key} value={st.name}>
                {st.name}{st.count > 0 ? ` (${st.count})` : ''}
              </option>
            ))}
          </select>
          {selectedStaff !== 'ALL' && (
            <button
              type="button"
              onClick={() => { setSelectedStaff('ALL'); setPage(1); }}
              className="rounded-lg border border-ink-200 bg-ink-50 px-2 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-100 cursor-pointer"
              title="Show all staff"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Daily "Who Ate How Much" Summary Panel ── */}
      <div className="rounded-xl border border-ink-100 bg-white shadow-2xs overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-ink-100 bg-ink-50/40">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <UtensilsCrossed size={13} />
            </span>
            <span className="text-xs sm:text-sm font-bold text-ink-900">
              Daily Staff Consumption — {summaryDateKey === toLocalDateKey(new Date()) ? 'Today' : summaryDateKey}
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 font-bold text-blue-700">
                {dailyStaffSummary.totalStaff} Staff Ate
              </span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 font-bold text-emerald-700">
                {dailyStaffSummary.totalPortions} Items ({dailyStaffSummary.totalFood} Meals · {dailyStaffSummary.totalDrinks} Drinks)
              </span>
              <span className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold text-amber-800">
                {dailyStaffSummary.totalVouchers} Vouchers · {etb(dailyStaffSummary.totalCost)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSummaryPanel(v => !v)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            {showSummaryPanel ? <><ChevronUp size={14} /> Hide Details</> : <><ChevronDown size={14} /> Who Ate How Much</>}
          </button>
        </div>

        {showSummaryPanel && (
          <div className="p-3">
            {dailyStaffSummary.staffList.length === 0 ? (
              <p className="text-xs text-ink-400 text-center py-2">
                No consumption recorded for {summaryDateKey}.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                {dailyStaffSummary.staffList.map(st => {
                  const isSelected = selectedStaff !== 'ALL' && selectedStaff.toLowerCase() === st.key;
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => {
                        setSelectedStaff(isSelected ? 'ALL' : st.name);
                        setPage(1);
                      }}
                      className={`text-left rounded-xl border p-2.5 transition cursor-pointer ${isSelected
                        ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                        : 'border-ink-100 bg-ink-50/40 hover:border-blue-300 hover:bg-blue-50/30'
                        }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-ink-900 truncate">{st.name}</p>
                          <p className="text-[11px] text-ink-500 mt-0.5">
                            {st.vouchers} order{st.vouchers !== 1 ? 's' : ''} · {st.food} meal{st.food !== 1 ? 's' : ''}, {st.drinks} drink{st.drinks !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            {st.portions} total
                          </span>
                          <p className="text-[11px] font-bold text-ink-800 mt-0.5 tabular-nums">{etb(st.cost)}</p>
                        </div>
                      </div>
                      {st.itemsList.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {st.itemsList.slice(0, 3).map(it => (
                            <span key={it.name} className="inline-flex items-center rounded-md bg-white border border-ink-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-700">
                              {it.name} <span className="ml-1 font-bold text-blue-600">×{it.qty}</span>
                            </span>
                          ))}
                          {st.itemsList.length > 3 && (
                            <span className="text-[10px] font-semibold text-ink-400">+{st.itemsList.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Search ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:flex-none">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search voucher, beneficiary…"
            className="w-full sm:w-60 rounded-lg border border-ink-200 bg-white py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <button onClick={load} disabled={loading}
          className="rounded-lg border border-ink-200 bg-white p-2 text-ink-500 hover:bg-ink-50 transition shrink-0">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Load error ── */}
      {loadError && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ {loadError}
          <button onClick={() => setLoadError('')} className="ml-auto text-red-400 hover:text-red-700"><X size={14} /></button>
        </div>
      )}

      {/* ── Mobile Card List (< md) & Desktop Table (>= md) ── */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">
        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-ink-100">
          {loading && (
            <div className="px-4 py-10 text-center text-ink-400 text-sm">
              <RefreshCw size={16} className="inline animate-spin mr-2" />Loading…
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="px-4 py-12 text-center text-ink-400 text-sm">
              No consumption records found. {canCreate && <span className="text-blue-600 font-semibold cursor-pointer hover:underline" onClick={openCreate}>Add the first one →</span>}
            </div>
          )}
          {!loading && paginated.map(r => {
            const cat = catByKey[r.category] || CATEGORIES[0];
            const CatIcon = cat.icon;
            return (
              <div key={r._id} ref={setRowRef(r)} className={rowClass(r, 'p-3.5 space-y-2.5 transition-colors')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-blue-700">{r.voucherNo || '—'}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cat.color}`}>
                        <CatIcon size={10} /> {cat.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink-400 mt-0.5">{new Date(r.date).toLocaleString()}</p>
                  </div>
                  <div className="shrink-0">
                    {r.category === 'staff_meal' && r.status === 'approved' ? (
                      <span className="inline-flex items-center gap-1 rounded-full font-bold px-2 py-0.5 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-800">
                        <CheckCircle size={10} className="text-emerald-600" /> Auto-Approved
                      </span>
                    ) : (
                      <WorkflowBadge status={r.status} size="sm" />
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 text-xs bg-slate-50/80 rounded-lg px-2.5 py-2 border border-slate-100">
                  <div className="min-w-0">
                    <span className="text-ink-400 text-[10px] block">Beneficiary &amp; Pax</span>
                    <span className="font-semibold text-ink-800 truncate block">
                      {r.beneficiary || '—'} <span className="text-ink-400 font-normal">({r.pax || 1} pax)</span>
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-ink-400 text-[10px] block">Recipe Cost</span>
                    <span className="font-bold text-ink-900 tabular-nums">{etb(r.totalRecipeCost)}</span>
                  </div>
                </div>

                {(r.items || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.items.map((item, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                        {item.product?.name || '—'} <span className="ml-1 text-blue-400">×{item.quantity}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-ink-400 truncate">By: {r.performedBy?.name || '—'}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => { setDetailRecord(r); setDetailOpen(true); }}
                      className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-700 hover:bg-ink-50"
                    >
                      <Eye size={12} /> View
                    </button>
                    {canCreate && r.status === 'pending' && (
                      <button onClick={() => openEdit(r)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white">
                        <Pencil size={11} /> Edit
                      </button>
                    )}
                    {canApprove && r.status === 'pending' && (
                      <button onClick={() => openAction(r, 'approve')}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white">
                        <CheckCircle size={11} /> Approve
                      </button>
                    )}
                    {canVoid && ['pending', 'approved'].includes(r.status) && (
                      <button onClick={() => openAction(r, 'void')}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-semibold text-red-600">
                        <Ban size={11} /> Void
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
              <tr>
                {['Date', 'Voucher', 'Category', 'Beneficiary', 'Pax', 'Recipe Cost', 'Status', 'Items Consumed', 'By', 'Actions'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100"
                    style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-ink-400">
                  <RefreshCw size={16} className="inline animate-spin mr-2" />Loading…
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-12 text-center text-ink-400">
                  No consumption records found. {canCreate && <span className="text-blue-600 cursor-pointer hover:underline" onClick={openCreate}>Add the first one →</span>}
                </td></tr>
              )}
              {!loading && paginated.map(r => {
                const cat = catByKey[r.category] || CATEGORIES[0];
                const CatIcon = cat.icon;
                return (
                  <tr key={r._id} ref={setRowRef(r)} className={rowClass(r, 'hover:bg-blue-50/20 transition-colors')} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">
                      {new Date(r.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-blue-600">
                      {r.voucherNo || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cat.color}`}>
                        <CatIcon size={11} /> {cat.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-700 max-w-[140px] truncate" title={r.beneficiary}>
                      {r.beneficiary || '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-center text-ink-600">{r.pax || 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-ink-800 tabular-nums">
                      {etb(r.totalRecipeCost)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {r.category === 'staff_meal' && r.status === 'approved' ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full font-bold px-2.5 py-0.5 text-[11px] bg-emerald-50 border border-emerald-200 text-emerald-800 shadow-2xs" title="Auto-approved upon ordering — no manual approval required">
                          <CheckCircle size={11} className="text-emerald-600" />
                          Auto-Approved
                        </span>
                      ) : (
                        <WorkflowBadge status={r.status} size="sm" />
                      )}
                    </td>
                    {/* Items Consumed */}
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="flex flex-wrap gap-1">
                        {(r.items || []).slice(0, 3).map((item, i) => (
                          <span key={i}
                            className="inline-flex items-center rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 whitespace-nowrap"
                            title={item.product?.name}>
                            {item.product?.name || '—'}
                            <span className="ml-1 text-blue-400">×{item.quantity}</span>
                          </span>
                        ))}
                        {(r.items || []).length > 3 && (
                          <span className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
                            +{r.items.length - 3} more
                          </span>
                        )}
                        {(r.items || []).length === 0 && <span className="text-ink-300 text-[10px]">—</span>}
                      </div>
                    </td>
                    {/* By */}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-400">
                      {r.performedBy?.name || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {/* Detail */}
                        <button onClick={() => { setDetailRecord(r); setDetailOpen(true); }}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" title="View detail">
                          <Eye size={13} />
                        </button>
                        {/* Edit — only pending */}
                        {canCreate && r.status === 'pending' && (
                          <button onClick={() => openEdit(r)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 px-2 py-1 text-xs font-semibold text-white transition">
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                        {/* Approve */}
                        {canApprove && r.status === 'pending' && (
                          <button onClick={() => openAction(r, 'approve')}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2 py-1 text-xs font-semibold text-white transition">
                            <CheckCircle size={11} /> Approve
                          </button>
                        )}
                        {/* Void */}
                        {canVoid && ['pending', 'approved'].includes(r.status) && (
                          <button onClick={() => openAction(r, 'void')}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 transition">
                            <Ban size={11} /> Void
                          </button>
                        )}
                        {/* Delete */}
                        {canVoid && ['pending', 'voided'].includes(r.status) && (
                          <button onClick={() => handleDelete(r._id)}
                            className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page} pageSize={pageSize} total={filtered.length}
          onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* ══ Create / Edit Modal ══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Consumption Record' : 'New Consumption Record'}
        width="max-w-2xl">
        <form onSubmit={(e) => { e.preventDefault(); handleSave(form.category === 'staff_meal'); }} className="space-y-4">

          {/* Category selector */}
          {!isPrivileged ? (
            <div className="flex items-center gap-2.5 p-2.5 bg-emerald-50/90 rounded-xl border border-emerald-200 text-xs text-emerald-900 shadow-2xs">
              <UtensilsCrossed size={16} className="text-emerald-600 shrink-0" />
              <div>
                <span className="font-bold">Staff Meal Consumption</span>
                <span className="text-emerald-700 font-normal ml-1.5">— Record daily staff meal order with direct captain KOT dispatch</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-2">Category *</label>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map(cat => {
                  const Icon = cat.icon;
                  const isActive = form.category === cat.key;
                  return (
                    <button key={cat.key} type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat.key, beneficiary: '' }))}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${isActive ? `${cat.activeCls} text-white border-transparent` : 'bg-white border-ink-200 text-ink-600 hover:border-blue-400'
                        }`}>
                      <Icon size={12} /> {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Date, Beneficiary, Pax, Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Date & Time *</label>
              <input type="datetime-local" required value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">No. of People (Pax)</label>
              <input type="number" min={1} value={form.pax}
                onChange={e => setForm(f => ({ ...f, pax: e.target.value }))}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-ink-700">
                  {form.category === 'staff_meal' ? 'Employee *' : 'Beneficiary / Guest Name'}
                </label>
                <div className="flex items-center gap-1.5">
                  {canManageStaffMeals && form.category === 'staff_meal' && (
                    <button
                      type="button"
                      onClick={() => openAllowedMealsModal(form.beneficiary)}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 flex items-center gap-1 cursor-pointer bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200 transition"
                      title="Set allowed meals for this employee (Admin / Dev only)"
                    >
                      <Settings2 size={11} /> Set Allowed Meals
                    </button>
                  )}
                  {form.category === 'staff_meal' && !isPrivileged && (
                    <span className="text-[10px] text-emerald-800 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <Lock size={10} className="text-emerald-600" /> Auto-Assigned (You)
                    </span>
                  )}
                </div>
              </div>
              {form.category === 'staff_meal' ? (
                !isPrivileged ? (
                  /* Non-privileged: Clean locked card with own identity */
                  <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 p-2.5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-xs">
                          {(currentUserEmployee?.firstName?.[0] || user?.name?.[0] || 'U').toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-ink-900 flex items-center gap-1.5">
                            <span>{currentUserEmployee ? `${currentUserEmployee.firstName || ''} ${currentUserEmployee.lastName || ''}`.trim() : (user?.name || 'Staff Member')}</span>
                            <span className="text-[9.5px] font-bold bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-md border border-blue-200">
                              Your Account
                            </span>
                          </div>
                          <p className="text-[11px] text-ink-500">
                            {[currentUserEmployee?.department || user?.department, currentUserEmployee?.position || user?.role].filter(Boolean).join(' • ') || 'Staff Member'}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-ink-500 flex items-center gap-1 bg-white/90 px-2 py-0.5 rounded-md border border-ink-150">
                        <Lock size={10} className="text-amber-600" /> Locked
                      </span>
                    </div>
                    <input type="hidden" value={form.beneficiary} required />
                  </div>
                ) : (
                  /* Admin / Dev: Searchable Select of all employees */
                  <div>
                    <SearchableSelect
                      required
                      placeholder="Search and select employee…"
                      options={employees.map(e => ({
                        value: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
                        label: `${e.firstName || ''} ${e.lastName || ''}`.trim(),
                        sublabel: [e.department, e.position].filter(Boolean).join(' • '),
                        employee: e,
                      }))}
                      value={form.beneficiary}
                      onChange={(val, raw) => {
                        const emp = raw?.employee || employees.find(e => `${e.firstName || ''} ${e.lastName || ''}`.trim() === val);
                        setForm(f => ({
                          ...f,
                          beneficiary: val,
                          department: emp?.department || f.department,
                        }));
                      }}
                    />
                  </div>
                )
              ) : (
                <input value={form.beneficiary} placeholder="e.g. Mr. John VIP Guest"
                  onChange={e => setForm(f => ({ ...f, beneficiary: e.target.value }))}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Department</label>
              <input value={form.department} placeholder="e.g. Kitchen, F&B, Front Office"
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                readOnly={!isPrivileged && form.category === 'staff_meal'}
                className={`w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 ${!isPrivileged && form.category === 'staff_meal' ? 'bg-slate-50 text-ink-600 cursor-not-allowed' : ''}`} />
            </div>
          </div>

          {/* Products / Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-ink-700">Products Consumed *</label>
              <button type="button" onClick={addItem}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                <Plus size={12} /> Add row
              </button>
            </div>

            {/* Allowed Meal Quota Banner */}
            {form.category === 'staff_meal' && (
              isMealsRestricted ? (
                <div className="p-3 rounded-xl border border-red-300 bg-red-50 text-red-900 text-xs flex items-start justify-between gap-2.5 mb-2.5 shadow-2xs">
                  <div className="flex items-start gap-2.5">
                    <Ban size={17} className="text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Not Allowed All Meals (Restricted Employee)</p>
                      <p className="text-red-800 text-[11px] mt-0.5">
                        Staff meals are disabled for <strong>{selectedEmployeeObj ? `${selectedEmployeeObj.firstName || ''} ${selectedEmployeeObj.lastName || ''}`.trim() : (form.beneficiary || 'this employee')}</strong>. They cannot order staff meals in Consumption.
                      </p>
                    </div>
                  </div>
                  {canManageStaffMeals && (
                    <button
                      type="button"
                      onClick={() => openAllowedMealsModal(form.beneficiary)}
                      className="text-[10.5px] font-bold bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Settings2 size={11} /> Edit Quota
                    </button>
                  )}
                </div>
              ) : !isPrivileged && (!allowedProductIds || allowedProductIds.size === 0) ? (
                <div className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-start gap-2.5 mb-2.5 shadow-2xs">
                  <AlertCircle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">No Allowed Meals Configured</p>
                    <p className="text-amber-800 text-[11px] mt-0.5">
                      Your staff meal quota has not been set yet. Please contact an Admin or System Developer to configure your permitted meal items before ordering.
                    </p>
                  </div>
                </div>
              ) : (
                <div className={`p-3 rounded-xl border text-xs font-semibold mb-2.5 transition-all ${isDailyQuotaReached
                  ? 'bg-rose-50 border-rose-300 text-rose-950 shadow-2xs'
                  : allowedProductIds && allowedProductIds.size > 0
                    ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs'
                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                  }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0">
                      <UtensilsCrossed size={16} className={`shrink-0 mt-0.5 ${isDailyQuotaReached ? 'text-rose-600' : (allowedProductIds && allowedProductIds.size > 0 ? 'text-amber-600' : 'text-emerald-600')
                        }`} />
                      <div className="min-w-0">
                        {allowedProductIds && allowedProductIds.size > 0 ? (
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>Allowed staff meal for <strong>{selectedEmployeeObj ? `${selectedEmployeeObj.firstName || ''} ${selectedEmployeeObj.lastName || ''}`.trim() : (form.beneficiary || 'Staff')}</strong>:</span>
                              <span className="text-[9.5px] uppercase tracking-wider font-extrabold bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-full shrink-0">
                                {availableProducts.length} Items Allowed
                              </span>
                            </div>
                            <p className="text-amber-800 font-normal text-[11px] mt-0.5 truncate">
                              ({availableProducts.map(p => p.name).join(', ')})
                            </p>
                          </div>
                        ) : (
                          <span>All menu items allowed for <strong>{form.beneficiary || 'Staff'}</strong> (no quota restriction)</span>
                        )}
                        {/* Daily Limit Tracker Badge */}
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold ${isDailyQuotaReached
                            ? 'bg-rose-200 text-rose-950'
                            : 'bg-emerald-100 text-emerald-900'
                            }`}>
                            <Clock size={11} />
                            Daily {hasAllowedFoodItems ? 'Meal' : 'Drink'} Quota: {effectiveTodayUsed} / {dailyMealLimit} portion(s) ordered today
                            {isDailyQuotaReached ? ' (Meal Limit Reached - Drinks Still Available Below)' : ` (${Math.max(0, dailyMealLimit - effectiveTodayUsed)} remaining today)`}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {canManageStaffMeals && (
                        <button
                          type="button"
                          onClick={() => openAllowedMealsModal(form.beneficiary)}
                          className="text-[10.5px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                          title="Configure allowed meals and daily limits for this employee"
                        >
                          <Settings2 size={11} /> {allowedProductIds && allowedProductIds.size > 0 ? 'Edit Quota' : '+ Set Allowed Meals'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            )}

            <div className="grid gap-1.5 mb-1 px-1 text-xs font-semibold text-ink-400 grid-cols-[1fr_80px_24px]">
              <span>Product / Menu Item</span><span>Qty (portions)</span><span />
            </div>
            <div className="space-y-2">
              {form.items.map((item, idx) => (
                <div key={idx} className="grid gap-2 items-center grid-cols-[1fr_80px_24px]">
                  <SearchableSelect
                    required
                    placeholder="Search product…"
                    options={availableProducts.map(p => {
                      const pId = String(p._id);
                      const usedToday = todayEmployeeConsumption.byProduct[pId] || 0;
                      const maxToday = productDailyLimitsMap[pId] || 1;
                      const remToday = Math.max(0, maxToday - usedToday);
                      const isItemLimitReached = usedToday >= maxToday;
                      const isDrink = isDrinkProduct(p);
                      const isMealPoolFull = !isDrink && hasAllowedFoodItems && isDailyQuotaReached;
                      const nthAttempt = formatOrdinal(usedToday + 1);
                      return {
                        value: p._id,
                        label: isItemLimitReached
                          ? `⚠️ ${p.name} (${usedToday}/${maxToday} used today — Limit ${maxToday}/day reached)`
                          : isMealPoolFull
                            ? `⚠️ ${p.name} (Daily meal quota ${effectiveTodayUsed}/${dailyMealLimit} reached)`
                            : `${p.name} (${remToday}/${maxToday} left today${isDrink && hasAllowedFoodItems ? ' · Drink' : ''})`,
                        sublabel: isItemLimitReached
                          ? `Allowed ${maxToday}/day · Ordering ${nthAttempt} time exceeds limit (Admin & Dev alerted)`
                          : isMealPoolFull
                            ? `Daily meal limit reached — drinks remain available (Admin & Dev alerted)`
                            : (p.sellingPrice ? `Allowed ${maxToday}/day · Price: ETB ${p.sellingPrice} · ${p.category || 'Menu'}` : `Allowed ${maxToday}/day · ${p.category || 'Menu'}`),
                        disabled: false,
                      };
                    })}
                    value={item.product}
                    onChange={val => updateItem(idx, 'product', val)}
                  />
                  <input type="number" step="any" min="0" required placeholder="Qty" value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className="rounded-lg border border-ink-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => removeItem(idx)} disabled={form.items.length === 1}
                    className="rounded-md p-1 text-ink-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            {/* Live Pre-Order Limit Warning Banner */}
            {liveQuotaWarnings.length > 0 && (
              <div className="mt-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 flex items-start gap-2.5 shadow-2xs">
                <AlertCircle size={17} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">
                    {isPrivileged
                      ? '⚠️ Over-Limit Warning (Admin / System Dev Override)'
                      : '⚠️ Daily Allowance Limit Warning'}
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-amber-900">
                    {liveQuotaWarnings.map((w, wi) => (
                      <li key={wi}>{w}</li>
                    ))}
                  </ul>
                  <p className="text-[11px] font-semibold text-amber-800">
                    {isPrivileged
                      ? 'Submitting this order will record it beyond the employee daily limit and announce an alert to Admin & System Developer.'
                      : 'Submitting an order beyond your allowed daily limit will alert Admin & System Developer.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Notes (optional)</label>
            <textarea rows={2} value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <X size={13} className="shrink-0" /> {formError}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-ink-100">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50 transition cursor-pointer">
              Cancel
            </button>
            <div className="flex items-center gap-2">
              {form.category === 'staff_meal' ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={submitting || (!isPrivileged && availableProducts.length === 0)}
                    className="rounded-xl border border-ink-200 bg-white hover:bg-ink-50 px-3.5 py-2 text-xs font-bold text-ink-700 shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save consumption record only without printing KOT ticket"
                  >
                    Record Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={submitting || (!isPrivileged && availableProducts.length === 0)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${isSelectedQuotaBlocked
                      ? 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700'
                      }`}
                  >
                    <Printer size={15} />
                    <span>
                      {submitting
                        ? 'Ordering & Printing…'
                        : (!isPrivileged && availableProducts.length === 0)
                          ? 'No Allowed Meals Configured'
                          : isSelectedQuotaBlocked
                            ? 'Over Daily Limit (Blocked · Notify Admin)'
                            : '🍽️ Order & Print Captain Order'}
                    </span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave(false)}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : (editing ? 'Save Changes' : 'Record Consumption')}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      {/* ══ Detail Modal ══ */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)}
        title={`Consumption — ${detailRecord?.voucherNo || ''}`}
        width="max-w-lg">
        {detailRecord && (() => {
          const cat = catByKey[detailRecord.category] || CATEGORIES[0];
          const CatIcon = cat.icon;
          return (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-ink-400">Category</p>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cat.color}`}>
                    <CatIcon size={11} /> {cat.label}
                  </span>
                </div>
                <div><p className="text-xs text-ink-400">Status</p>
                  {detailRecord.category === 'staff_meal' && detailRecord.status === 'approved' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full font-bold px-2.5 py-1 text-xs bg-emerald-50 border border-emerald-200 text-emerald-800" title="Auto-approved upon ordering — no manual approval required">
                      <CheckCircle size={12} className="text-emerald-600" />
                      Auto-Approved (No Approval Needed)
                    </span>
                  ) : (
                    <WorkflowBadge status={detailRecord.status} />
                  )}
                </div>
                <div><p className="text-xs text-ink-400">Date</p>
                  <p className="font-medium">{new Date(detailRecord.date).toLocaleString()}</p>
                </div>
                <div><p className="text-xs text-ink-400">Pax</p>
                  <p className="font-medium">{detailRecord.pax || 1} people</p>
                </div>
                <div><p className="text-xs text-ink-400">Beneficiary</p>
                  <p className="font-medium">{detailRecord.beneficiary || '—'}</p>
                </div>
                <div><p className="text-xs text-ink-400">Department</p>
                  <p className="font-medium">{detailRecord.department || '—'}</p>
                </div>
                <div><p className="text-xs text-ink-400">Total Recipe Cost</p>
                  <p className="font-bold text-emerald-700">{etb(detailRecord.totalRecipeCost)}</p>
                </div>
                <div><p className="text-xs text-ink-400">Recorded By</p>
                  <p className="font-medium">{detailRecord.performedBy?.name || '—'}</p>
                </div>
              </div>

              {/* Items */}
              <div className="rounded-lg border border-ink-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-ink-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-ink-600">Product</th>
                      <th className="px-3 py-2 text-right font-semibold text-ink-600">Qty</th>
                      <th className="px-3 py-2 text-right font-semibold text-ink-600">Recipe Cost/unit</th>
                      <th className="px-3 py-2 text-right font-semibold text-ink-600">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {(detailRecord.items || []).map((item, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-ink-900">{item.product?.name || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity} {item.product?.uom || ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-600">
                          {item.recipeCost > 0 ? etb(item.recipeCost) : <span className="text-[10px] text-amber-600 italic">No recipe linked</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-ink-900">{etb(item.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-ink-50">
                      <td colSpan={3} className="px-3 py-2 text-right text-xs font-semibold text-ink-600">Total</td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-700">{etb(detailRecord.totalRecipeCost)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {detailRecord.totalRecipeCost === 0 && (
                <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
                  <UtensilsCrossed size={14} className="text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">No Recipe Ingredients Linked:</span>
                    <span className="ml-1 text-amber-800">
                      These menu items currently have 0 raw material ingredients defined under Menu & Recipes. To deduct raw ingredients from Kitchen/Bar stock automatically, configure their recipe under Products & Recipes.
                    </span>
                  </div>
                </div>
              )}

              {detailRecord.notes && (
                <div className="rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600">
                  <strong>Notes:</strong> {detailRecord.notes}
                </div>
              )}

              {/* Approve / Void from detail */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-ink-100">
                {canApprove && detailRecord.status === 'pending' && (
                  <button onClick={() => { setDetailOpen(false); openAction(detailRecord, 'approve'); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition">
                    <CheckCircle size={13} /> Approve
                  </button>
                )}
                {canVoid && ['pending', 'approved'].includes(detailRecord.status) && (
                  <button onClick={() => { setDetailOpen(false); openAction(detailRecord, 'void'); }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition">
                    <Ban size={13} /> Void
                  </button>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* ══ Approve / Void Confirmation Modal ══ */}
      <Modal open={actionOpen} onClose={() => { setActionOpen(false); setActionPassword(''); }}
        title={actionType === 'approve' ? '✅ Approve Consumption' : '🔴 Void Consumption (Admin / Manager)'}
        width="max-w-sm">
        <div className="space-y-3">
          <p className="text-sm text-ink-600">
            {actionType === 'approve'
              ? `Approve "${actionRecord?.voucherNo}" and deduct raw materials from stock?`
              : `Void "${actionRecord?.voucherNo}"? Stock will be reversed if already approved.`
            }
          </p>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">
              {actionType === 'void' ? 'Void Reason *' : 'Note (optional)'}
            </label>
            <input
              value={actionNote}
              onChange={e => setActionNote(e.target.value)}
              placeholder={actionType === 'void' ? 'Enter reason for voiding…' : 'Add a note…'}
              required={actionType === 'void'}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
          </div>
          {actionType === 'void' && (
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                Admin / Manager Password *
              </label>
              <input
                type="password"
                value={actionPassword}
                onChange={e => setActionPassword(e.target.value)}
                placeholder="Enter your password to authorize void…"
                required
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
            </div>
          )}
          {actionError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => { setActionOpen(false); setActionPassword(''); }}
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
              Cancel
            </button>
            <button onClick={handleAction} disabled={actionWorking}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 cursor-pointer ${actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
              {actionWorking ? 'Working…' : (actionType === 'approve' ? 'Approve & Deduct Stock' : 'Authorize & Void')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ Assign Allowed Meals Modal (Admin / System Developer Only) ══ */}
      <Modal
        open={allowedMealsModalOpen}
        onClose={() => setAllowedMealsModalOpen(false)}
        title="🍽️ Set Allowed Staff Meals Quota"
        width="max-w-2xl"
      >
        <div className="space-y-4">
          {/* Admin badge & explanation */}
          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 p-3 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-indigo-600 shrink-0" />
              <div>
                <p className="font-bold">Staff Meal Allowance Configuration</p>
                <p className="text-[11px] text-indigo-700">
                  Select which food & beverage products this employee is permitted to consume. Allowed items can be ordered immediately with no approval required.
                </p>
              </div>
            </div>
            <span className="text-[9.5px] uppercase tracking-wider font-extrabold bg-indigo-600 text-white px-2.5 py-0.5 rounded-full shrink-0">
              Admin & Dev
            </span>
          </div>

          {/* Employee Selector */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1.5">Select Employee *</label>
            <select
              value={selectedEmpForQuotaId}
              onChange={(e) => {
                const empId = e.target.value;
                setSelectedEmpForQuotaId(empId);
                const emp = employees.find(x => x._id === empId);
                setSelectedProductIdsForQuota(new Set((emp?.allowedProducts || []).map(p => typeof p === 'object' && p !== null ? p._id : p)));
                setQuotaMealsDisabled(Boolean(emp?.mealsDisabled));
                setQuotaDailyMealLimit(Number(emp?.dailyMealLimit) || 1);
                const limits = {};
                (emp?.mealLimits || []).forEach(ml => {
                  const pId = String(ml.product?._id || ml.product);
                  limits[pId] = Number(ml.maxPerDay) || 1;
                });
                setProductDailyLimits(limits);
              }}
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-800 outline-none focus:border-indigo-500 shadow-2xs"
            >
              {employees.map(e => (
                <option key={e._id} value={e._id}>
                  {e.firstName} {e.lastName} ({[e.department, e.position].filter(Boolean).join(' • ') || 'Staff'}) — {e.mealsDisabled ? '🚫 Not Allowed All Meals' : `${(e.allowedProducts?.length || 0)} allowed items`}
                </option>
              ))}
            </select>
          </div>

          {/* Daily Meal Frequency & Portion Limit */}
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <label className="block text-xs font-bold text-ink-800">
                  Daily Meal Limit (Max Meals Allowed Per Day)
                </label>
                <p className="text-[11px] text-ink-500">
                  How many times or meal portions this employee can order per day without approval.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3].map(cnt => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setQuotaDailyMealLimit(cnt)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${quotaDailyMealLimit === cnt
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                  >
                    {cnt} / day
                  </button>
                ))}
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-0.5">
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={quotaDailyMealLimit}
                    onChange={(e) => setQuotaDailyMealLimit(Math.max(1, Number(e.target.value) || 1))}
                    className="w-10 text-center text-xs font-bold outline-none text-ink-900"
                  />
                  <span className="text-[10px] text-slate-400 font-medium">max/day</span>
                </div>
              </div>
            </div>
          </div>

          {/* Product Filter & Live Search */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-2.5 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search products e.g. Tibs, tea, sandwich..."
                  value={quotaSearchQuery}
                  onChange={(e) => setQuotaSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 pl-8 pr-3 py-1.5 text-xs outline-none focus:border-indigo-500"
                />
                {quotaSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setQuotaSearchQuery('')}
                    className="absolute right-2.5 top-2 text-ink-400 hover:text-ink-700"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Quick action buttons: Select All Filtered / Clear All / Not Allowed All Meals */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSelectAllShownProducts}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllQuotaProducts}
                  className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={handleRestrictAllMeals}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg border transition cursor-pointer ${quotaMealsDisabled
                    ? 'bg-red-600 border-red-600 text-white shadow-2xs'
                    : 'border-red-200 text-red-700 bg-red-50 hover:bg-red-100'
                    }`}
                  title="Block all staff meals for this restricted employee"
                >
                  <Ban size={11} /> Not Allowed All Meals
                </button>
              </div>
            </div>

            {quotaMealsDisabled && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-2.5 text-xs font-semibold text-red-800 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <Ban size={14} className="text-red-600 shrink-0" />
                  Not Allowed All Meals is active — this employee will be blocked from all staff meals.
                </span>
                <button
                  type="button"
                  onClick={() => setQuotaMealsDisabled(false)}
                  className="text-[11px] font-bold underline text-red-900 hover:text-red-950 shrink-0 cursor-pointer"
                >
                  Allow Meals
                </button>
              </div>
            )}

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1">
              {['all', ...new Set(products.map(p => p.category || 'General'))].slice(0, 8).map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setQuotaCategoryFilter(cat === 'all' ? '' : cat)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${(quotaCategoryFilter === '' && cat === 'all') || quotaCategoryFilter === cat
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                >
                  {cat === 'all' ? 'All Categories' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Cards Grid with Checkboxes */}
          <div className="max-h-72 overflow-y-auto border border-ink-100 rounded-xl p-2 divide-y divide-ink-50 bg-slate-50/50">
            {filteredQuotaProducts.length === 0 ? (
              <div className="py-8 text-center text-xs text-ink-400">
                No products found matching your search.
              </div>
            ) : (
              filteredQuotaProducts.map(p => {
                const isSelected = selectedProductIdsForQuota.has(p._id);
                return (
                  <div
                    key={p._id}
                    onClick={() => handleToggleProductForQuota(p._id)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition select-none ${isSelected
                      ? 'bg-indigo-50/90 border border-indigo-200 font-semibold'
                      : 'hover:bg-white hover:shadow-2xs'
                      }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`h-4 w-4 rounded flex items-center justify-center border transition ${isSelected
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-slate-300 bg-white'
                        }`}>
                        {isSelected && <Check size={11} className="stroke-[3]" />}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs truncate ${isSelected ? 'text-indigo-950 font-bold' : 'text-ink-800 font-medium'}`}>
                          {p.name}
                        </p>
                        <p className="text-[10px] text-ink-400">
                          {p.category || 'General'} · {p.uom || 'portion'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      {isSelected && (
                        <div
                          className="flex items-center gap-1 bg-white border border-indigo-200 rounded-md px-1.5 py-0.5 shadow-2xs"
                          onClick={(e) => e.stopPropagation()}
                          title="Daily limit for this specific item"
                        >
                          <span className="text-[9.5px] font-bold text-indigo-700">Limit:</span>
                          <input
                            type="number"
                            min="1"
                            max="10"
                            value={productDailyLimits[p._id] || 1}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value) || 1);
                              setProductDailyLimits(prev => ({ ...prev, [p._id]: val }));
                            }}
                            className="w-7 text-center text-[11px] font-bold text-indigo-950 outline-none"
                          />
                          <span className="text-[9px] text-slate-400">/day</span>
                        </div>
                      )}
                      <span className="text-xs font-bold text-ink-700">
                        ETB {Number(p.sellingPrice || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary & Save Footer */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-ink-100">
            <div className="text-xs text-ink-600">
              {quotaMealsDisabled ? (
                <span className="font-bold text-red-600">🚫 Not Allowed All Meals (Restricted)</span>
              ) : (
                <><span className="font-bold text-indigo-700">{selectedProductIdsForQuota.size}</span> items selected for staff allowance</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAllowedMealsModalOpen(false)}
                className="rounded-xl border border-ink-200 px-4 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAllowedMeals}
                disabled={savingAllowedMeals || !selectedEmpForQuotaId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition cursor-pointer disabled:opacity-50"
              >
                {savingAllowedMeals ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                <span>{savingAllowedMeals ? 'Saving Allowed Meals…' : 'Save Allowed Meals'}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
