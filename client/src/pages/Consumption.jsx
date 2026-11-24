import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Search, Trash2, Eye, X, CheckCircle, Ban,
  UtensilsCrossed, Users, Briefcase, BookOpen, Gift, FileText,
  RefreshCw, Pencil, Printer, Check, ShieldCheck, Lock,
  Settings2, AlertCircle, UserCheck, Clock,
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

const emptyForm = {
  category: 'staff_meal',
  date: new Date().toISOString().slice(0, 16),
  beneficiary: '',
  pax: 1,
  department: '',
  notes: '',
  items: [emptyItem()],
};

const etb = (n) => `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Consumption() {
  const { user, can, hasRole } = useAuth();
  const isPrivileged = ['dev', 'admin'].includes(user?.role);
  const canManageStaffMeals = ['admin', 'dev'].includes(user?.role);
  const canCreate = can('recordGoods') || Boolean(user);
  const canApprove = can('approveGoods');
  const canVoid = can('voidTransactions');

  const [records, setRecords] = useState([]);
  const [products, setProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
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

  /* ── filtered + paginated ── */
  const filtered = useMemo(() => {
    const safe = Array.isArray(records) ? records : [];
    // If not privileged (dev / admin), only show records belonging to the current user
    const scoped = isPrivileged
      ? safe
      : safe.filter(r => {
        if (!r.beneficiary) return false;
        const b = r.beneficiary.toLowerCase();
        const myName = (user?.name || '').trim().toLowerCase();
        const myEmpName = currentUserEmployee
          ? `${currentUserEmployee.firstName || ''} ${currentUserEmployee.lastName || ''}`.trim().toLowerCase()
          : '';
        return (myEmpName && (b.includes(myEmpName) || myEmpName.includes(b))) ||
          (myName && (b.includes(myName) || myName.includes(b)));
      });

    if (!search) return scoped;
    const q = search.toLowerCase();
    return scoped.filter(r =>
      r.voucherNo?.toLowerCase().includes(q) ||
      r.beneficiary?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q)
    );
  }, [records, search, isPrivileged, user, currentUserEmployee]);

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

  // Allowed product IDs for the selected employee:
  // null = all menu products permitted (no quota restriction)
  // Set with IDs = restricted strictly to these products
  // empty Set = 0 allowed products configured (staff cannot order without admin quota)
  const allowedProductIds = useMemo(() => {
    if (form.category !== 'staff_meal') return null;

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
  }, [form.category, selectedEmployeeObj, isPrivileged, currentUserEmployee, user]);

  // Available products: strictly filtered to allowed meal products
  const availableProducts = useMemo(() => {
    if (form.category !== 'staff_meal') {
      return products;
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
  }, [products, form.category, allowedProductIds, isPrivileged]);

  // ── Calculate today's staff meal consumption for currently selected employee / user ──
  const todayEmployeeConsumption = useMemo(() => {
    if (form.category !== 'staff_meal') return { totalPortions: 0, byProduct: {}, recordsToday: [] };

    const empName = (form.beneficiary || '').trim().toLowerCase();
    const empId = selectedEmployeeObj?._id ? String(selectedEmployeeObj._id) : null;
    const userId = user?._id ? String(user._id) : null;
    const todayStr = new Date().toDateString();

    const matchingRecords = (records || []).filter(r => {
      if (r.category !== 'staff_meal' || r.status === 'voided') return false;
      if (new Date(r.date).toDateString() !== todayStr) return false;

      const rBeneficiary = String(r.beneficiary || '').trim().toLowerCase();
      const rEmpId = r.employee ? String(r.employee?._id || r.employee) : null;
      const rPerfId = r.performedBy ? String(r.performedBy?._id || r.performedBy) : null;

      if (empId && rEmpId && rEmpId === empId) return true;
      if (empName && rBeneficiary === empName) return true;
      if (!isPrivileged && (rPerfId === userId || rBeneficiary === String(user?.name || '').trim().toLowerCase())) return true;
      return false;
    });

    let totalPortions = 0;
    const byProduct = {};
    for (const rec of matchingRecords) {
      for (const itm of rec.items || []) {
        const pId = String(itm.product?._id || itm.product);
        const q = Number(itm.quantity) || 1;
        totalPortions += q;
        byProduct[pId] = (byProduct[pId] || 0) + q;
      }
    }

    return { totalPortions, byProduct, recordsToday: matchingRecords };
  }, [records, form.category, form.beneficiary, selectedEmployeeObj, user, isPrivileged]);

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

  const isDailyQuotaReached = form.category === 'staff_meal' && todayEmployeeConsumption.totalPortions >= dailyMealLimit;

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
      ...emptyForm,
      category: 'staff_meal',
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
      date: new Date(r.date).toISOString().slice(0, 16),
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
    setSelectedProductIdsForQuota(prev => {
      const next = new Set(prev);
      filteredQuotaProducts.forEach(p => next.add(p._id));
      return next;
    });
  };

  const handleClearAllQuotaProducts = () => {
    setSelectedProductIdsForQuota(new Set());
  };

  const handleSaveAllowedMeals = async () => {
    if (!selectedEmpForQuotaId) return;
    setSavingAllowedMeals(true);
    try {
      const targetEmp = employees.find(e => e._id === selectedEmpForQuotaId);
      const res = await api.put(`/employees/${selectedEmpForQuotaId}`, {
        allowedProducts: Array.from(selectedProductIdsForQuota),
        dailyMealLimit: Math.max(1, Number(quotaDailyMealLimit) || 1),
        mealLimits: Array.from(selectedProductIdsForQuota).map(pId => ({
          product: pId,
          maxPerDay: Math.max(1, Number(productDailyLimits[pId]) || 1),
        })),
      });
      const updatedEmp = res.data;
      setEmployees(prev => prev.map(e => e._id === selectedEmpForQuotaId ? updatedEmp : e));
      const empName = `${targetEmp?.firstName || ''} ${targetEmp?.lastName || ''}`.trim() || 'Employee';
      setSuccessToast(`🍽️ Allowed meal quota for ${empName} saved! (Limit: ${quotaDailyMealLimit}/day, ${selectedProductIdsForQuota.size} allowed items)`);
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

      // Check daily meal limit before submitting
      if (!isPrivileged && form.category === 'staff_meal' && isDailyQuotaReached) {
        setFormError(`Daily meal limit reached: You have already consumed your allowed meal for today (${todayEmployeeConsumption.totalPortions}/${dailyMealLimit} portions used). Daily allowance resets tomorrow.`);
        setSubmitting(false);
        return;
      }

      if (form.category === 'staff_meal' && !isPrivileged) {
        let requestedPortions = 0;
        for (const item of cleanItems) {
          const pId = String(item.product);
          const q = Number(item.quantity) || 1;
          requestedPortions += q;
          const usedForP = todayEmployeeConsumption.byProduct[pId] || 0;
          const maxForP = productDailyLimitsMap[pId] || 1;
          if (usedForP + q > maxForP) {
            const prod = products.find(p => String(p._id) === pId);
            setFormError(`Daily limit exceeded for "${prod?.name || 'this item'}": Already ordered ${usedForP}/${maxForP} today. Limit is ${maxForP} portion per day.`);
            setSubmitting(false);
            return;
          }
        }
        if (todayEmployeeConsumption.totalPortions + requestedPortions > dailyMealLimit) {
          setFormError(`Daily meal quota exceeded: You can only order ${Math.max(0, dailyMealLimit - todayEmployeeConsumption.totalPortions)} more portion(s) today (Limit: ${dailyMealLimit} per day).`);
          setSubmitting(false);
          return;
        }
      }

      const payload = {
        ...form,
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
            status: 'sent_to_kitchen',
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

          setSuccessToast(`🍽️ Staff meal #${savedRecord?.voucherNo || ''} auto-approved! Stock deducted and order sent to kitchen printer.`);
        } catch (kotErr) {
          console.warn('Captain order error:', kotErr);
          setSuccessToast(`🍽️ Staff meal #${savedRecord?.voucherNo || ''} recorded & auto-approved! (Stock deducted)`);
        }
      } else {
        const isStaff = form.category === 'staff_meal';
        setSuccessToast(isStaff
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
    setActionNote(''); setActionError(''); setActionOpen(true);
  };

  const handleAction = async () => {
    setActionWorking(true); setActionError('');
    try {
      await api.post(`/consumption/${actionRecord._id}/${actionType}`, { note: actionNote });
      setActionOpen(false);
      load();
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed.');
    } finally { setActionWorking(false); }
  };

  /* ── export data ── */
  const exportData = useMemo(() => (Array.isArray(records) ? records : []).map(r => ({
    'Voucher No': r.voucherNo || '—',
    'Date': new Date(r.date).toLocaleDateString(),
    'Category': catByKey[r.category]?.label || r.category,
    'Beneficiary': r.beneficiary || '—',
    'Pax': r.pax || 1,
    'Department': r.department || '—',
    'Recipe Cost': Number(r.totalRecipeCost || 0).toFixed(2),
    'Status': r.status?.toUpperCase(),
    'Recorded By': r.performedBy?.name || '—',
  })), [records]);

  // Dynamic category counts
  const catCounts = useMemo(() => {
    const counts = { all: records.length };
    records.forEach(r => {
      counts[r.category] = (counts[r.category] || 0) + 1;
    });
    return counts;
  }, [records]);

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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Consumption Management</h1>
          <p className="text-xs text-ink-400 mt-0.5">
            Staff meals, guest entertainment & internal consumption — tracked & costed
          </p>
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
              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 text-xs sm:text-sm font-bold text-indigo-700 shadow-2xs transition cursor-pointer"
              title="Assign allowed staff meals per employee (Admin & System Developer only)"
            >
              <UtensilsCrossed size={16} /> Set Allowed Meals
            </button>
          )}
          {canCreate && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
            >
              <Plus size={16} /> New Consumption
            </button>
          )}
        </div>
      </div>

      {/* ── Category filter tabs with counts ── */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-ink-100 bg-white p-3 shadow-2xs">
        <button
          onClick={() => { setFilterCat(''); }}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${!filterCat
            ? 'bg-blue-900 text-white shadow-xs'
            : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
        >
          <span>All</span>
          <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${!filterCat ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
            {records.length}
          </span>
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = catCounts[cat.key] || 0;
          const isActive = filterCat === cat.key;
          return (
            <button key={cat.key}
              onClick={() => setFilterCat(isActive ? '' : cat.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive ? `${cat.activeCls} text-white shadow-xs ring-2 ring-blue-400/40` : 'bg-white border border-ink-200 text-ink-600 hover:border-blue-400'
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

      {/* ── Search ── */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search voucher, beneficiary…"
            className="rounded-lg border border-ink-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 w-52"
          />
        </div>
        <button onClick={load} disabled={loading}
          className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50 transition">
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

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">
        <div className="overflow-x-auto">
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
                  <tr key={r._id} className="hover:bg-blue-50/20 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
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
              !isPrivileged && (!allowedProductIds || allowedProductIds.size === 0) ? (
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
                            Daily Quota: {todayEmployeeConsumption.totalPortions} / {dailyMealLimit} portion(s) ordered today
                            {isDailyQuotaReached ? ' (Limit Reached - Resets Tomorrow)' : ` (${Math.max(0, dailyMealLimit - todayEmployeeConsumption.totalPortions)} remaining today)`}
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
                      return {
                        value: p._id,
                        label: isItemLimitReached
                          ? `⚠️ ${p.name} (${usedToday}/${maxToday} ordered today - Limit reached)`
                          : `${p.name} (${remToday} left today)`,
                        sublabel: isItemLimitReached
                          ? `Daily limit reached for today`
                          : (p.sellingPrice ? `Price: ETB ${p.sellingPrice} · ${p.category || 'Menu'}` : (p.category || 'Menu')),
                        disabled: isItemLimitReached && !isPrivileged,
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
                    disabled={submitting || (!isPrivileged && (availableProducts.length === 0 || isDailyQuotaReached))}
                    className="rounded-xl border border-ink-200 bg-white hover:bg-ink-50 px-3.5 py-2 text-xs font-bold text-ink-700 shadow-2xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Save consumption record only without printing KOT ticket"
                  >
                    Record Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={submitting || (!isPrivileged && (availableProducts.length === 0 || isDailyQuotaReached))}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Printer size={15} />
                    <span>
                      {submitting
                        ? 'Ordering & Printing…'
                        : (!isPrivileged && availableProducts.length === 0)
                          ? 'No Allowed Meals Configured'
                          : (!isPrivileged && isDailyQuotaReached)
                            ? 'Daily Quota Reached for Today'
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
      <Modal open={actionOpen} onClose={() => setActionOpen(false)}
        title={actionType === 'approve' ? '✅ Approve Consumption' : '🔴 Void Consumption'}
        width="max-w-sm">
        <div className="space-y-3">
          <p className="text-sm text-ink-600">
            {actionType === 'approve'
              ? `Approve "${actionRecord?.voucherNo}" and deduct raw materials from stock?`
              : `Void "${actionRecord?.voucherNo}"? Stock will be reversed if already approved.`
            }
          </p>
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Note (optional)</label>
            <input value={actionNote} onChange={e => setActionNote(e.target.value)}
              placeholder="Add a note…"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>
          {actionError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{actionError}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setActionOpen(false)}
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
              Cancel
            </button>
            <button onClick={handleAction} disabled={actionWorking}
              className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${actionType === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}>
              {actionWorking ? 'Working…' : (actionType === 'approve' ? 'Approve & Deduct Stock' : 'Void')}
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
                  {e.firstName} {e.lastName} ({[e.department, e.position].filter(Boolean).join(' • ') || 'Staff'}) — {(e.allowedProducts?.length || 0)} allowed items
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

              {/* Quick action buttons: Select All Filtered / Clear All */}
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
              </div>
            </div>

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
              <span className="font-bold text-indigo-700">{selectedProductIdsForQuota.size}</span> items selected for staff allowance
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
