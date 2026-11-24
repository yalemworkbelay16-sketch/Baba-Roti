import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Plus, Search, Trash2, Eye, X, CheckCircle, Ban,
  UtensilsCrossed, Users, Briefcase, BookOpen, Gift, FileText,
  RefreshCw, Pencil, Printer, Check, ShieldCheck, Lock,
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
  const isPrivileged = ['dev', 'admin', 'manager'].includes(user?.role);
  const canCreate = can('recordGoods');
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

  /* ── filtered + paginated ── */
  const filtered = useMemo(() => {
    const safe = Array.isArray(records) ? records : [];
    if (!search) return safe;
    const q = search.toLowerCase();
    return safe.filter(r =>
      r.voucherNo?.toLowerCase().includes(q) ||
      r.beneficiary?.toLowerCase().includes(q) ||
      r.department?.toLowerCase().includes(q)
    );
  }, [records, search]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ── Current user & role-based employee scoping ── */
  const currentUserEmployee = useMemo(() => {
    if (!user || !employees.length) return null;
    const userName = (user.name || '').trim().toLowerCase();
    const userEmail = (user.email || '').trim().toLowerCase();
    const userEmpId = (user.employeeId || '').trim().toLowerCase();

    return employees.find(e => {
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      const empEmail = (e.email || '').trim().toLowerCase();
      const empId = (e.employeeId || '').trim().toLowerCase();
      return (
        (userEmpId && empId && userEmpId === empId) ||
        (userEmail && empEmail && userEmail === empEmail) ||
        (userName && fullName && (userName === fullName || fullName.includes(userName) || userName.includes(fullName)))
      );
    }) || null;
  }, [user, employees]);

  // Selectable employees: Dev, Admin, Manager can see ALL employees.
  // Other staff see ONLY their own employee profile!
  const selectableEmployees = useMemo(() => {
    if (isPrivileged) {
      return employees;
    }
    if (currentUserEmployee) {
      return [currentUserEmployee];
    }
    return [{
      _id: user?._id || 'self',
      firstName: user?.name?.split(' ')[0] || user?.name || 'My',
      lastName: user?.name?.split(' ').slice(1).join(' ') || 'Account',
      department: user?.department || 'Staff',
      position: user?.role || 'Staff',
      allowedProducts: user?.allowedProducts || [],
    }];
  }, [isPrivileged, employees, currentUserEmployee, user]);

  // Find the selected employee object
  const selectedEmployeeObj = useMemo(() => {
    if (form.category !== 'staff_meal') return null;
    if (!form.beneficiary) {
      return !isPrivileged ? currentUserEmployee : null;
    }
    const cleanName = String(form.beneficiary).trim().toLowerCase();
    return employees.find(e => {
      const fullName = `${e.firstName || ''} ${e.lastName || ''}`.trim().toLowerCase();
      return fullName === cleanName || cleanName.includes(fullName) || fullName.includes(cleanName);
    }) || (!isPrivileged ? currentUserEmployee : null);
  }, [form.category, form.beneficiary, employees, isPrivileged, currentUserEmployee]);

  // Allowed product IDs for the selected employee (empty means all allowed)
  const allowedProductIds = useMemo(() => {
    if (form.category !== 'staff_meal' || !selectedEmployeeObj) return null;
    const list = selectedEmployeeObj.allowedProducts;
    if (!Array.isArray(list) || list.length === 0) return null;
    return new Set(list.map(p => (typeof p === 'object' && p !== null ? String(p._id) : String(p))));
  }, [form.category, selectedEmployeeObj]);

  // Available products: filtered to allowed meal products when employee has quota restriction
  const availableProducts = useMemo(() => {
    if (form.category !== 'staff_meal' || !allowedProductIds) {
      return products;
    }
    return products.filter(p => allowedProductIds.has(String(p._id)));
  }, [products, form.category, allowedProductIds]);

  /* ── form helpers ── */
  const openCreate = () => {
    setEditing(null);
    const defaultBeneficiary = !isPrivileged
      ? (currentUserEmployee ? `${currentUserEmployee.firstName} ${currentUserEmployee.lastName}` : (user?.name || ''))
      : '';
    const defaultDept = !isPrivileged
      ? (currentUserEmployee?.department || user?.department || '')
      : '';
    setForm({
      ...emptyForm,
      beneficiary: defaultBeneficiary,
      department: defaultDept,
    });
    setFormError('');
    setModalOpen(true);
  };
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

  const handleSave = async (andPrintCaptainOrder = false) => {
    setSubmitting(true);
    setFormError('');
    try {
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
        items: cleanItems,
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

          // Dispatch print ticket to Kitchen & Bar thermal printers
          await dispatchPrint('kot', createdOrder, { businessName: 'Baba Roti Café' });
          posPrint.printKOT(createdOrder, { businessName: 'Baba Roti Café' });

          setSuccessToast(`🍽️ Staff meal order sent to Kitchen & KOT printed! (Voucher: ${savedRecord?.voucherNo || ''})`);
        } catch (kotErr) {
          console.warn('Captain order / KOT dispatch error:', kotErr);
          setSuccessToast(`Consumption recorded (${savedRecord?.voucherNo || ''}), but kitchen printer dispatch had an issue.`);
        }
      } else {
        setSuccessToast(`Consumption record ${savedRecord?.voucherNo || ''} recorded successfully.`);
      }

      setModalOpen(false);
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
                      <WorkflowBadge status={r.status} size="sm" />
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
                {form.category === 'staff_meal' && !isPrivileged && (
                  <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                    <Lock size={10} /> Scoped to you
                  </span>
                )}
              </div>
              {form.category === 'staff_meal' ? (
                <div>
                  <SearchableSelect
                    required
                    placeholder="Search and select employee…"
                    options={selectableEmployees.map(e => ({
                      value: `${e.firstName} ${e.lastName}`,
                      label: `${e.firstName} ${e.lastName}`,
                      sublabel: [e.department, e.position].filter(Boolean).join(' • '),
                    }))}
                    value={form.beneficiary}
                    onChange={val => {
                      const emp = employees.find(e => `${e.firstName} ${e.lastName}` === val);
                      setForm(f => ({
                        ...f,
                        beneficiary: val,
                        department: emp?.department || f.department,
                      }));
                    }}
                    disabled={!isPrivileged && selectableEmployees.length <= 1}
                  />
                  {!isPrivileged && (
                    <p className="text-[10.5px] text-slate-500 mt-1 flex items-center gap-1 font-medium">
                      <span>Employee selection is automatically locked to your assigned account.</span>
                    </p>
                  )}
                </div>
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
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
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
              <div className={`p-2.5 rounded-xl border text-xs font-semibold mb-2.5 flex items-center justify-between transition-all ${
                allowedProductIds
                  ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
              }`}>
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={15} className={allowedProductIds ? 'text-amber-600' : 'text-emerald-600'} />
                  <div>
                    {allowedProductIds ? (
                      <div>
                        <span>Permitted staff meal for <strong>{selectedEmployeeObj?.firstName} {selectedEmployeeObj?.lastName}</strong>:</span>
                        <span className="ml-1 text-amber-800 font-normal">
                          ({availableProducts.map(p => p.name).join(', ')})
                        </span>
                      </div>
                    ) : (
                      <span>All menu items allowed for <strong>{form.beneficiary || 'Staff'}</strong> (no quota restriction)</span>
                    )}
                  </div>
                </div>
                {allowedProductIds && (
                  <span className="text-[9.5px] uppercase tracking-wider font-extrabold bg-amber-200/90 text-amber-950 px-2 py-0.5 rounded-full shrink-0">
                    {availableProducts.length} Items Allowed
                  </span>
                )}
              </div>
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
                    options={availableProducts.map(p => ({
                      value: p._id,
                      label: `${p.name} (${p.uom})`,
                      sublabel: p.sellingPrice ? `Price: ETB ${p.sellingPrice}` : (p.category || ''),
                    }))}
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
                    disabled={submitting}
                    className="rounded-xl border border-ink-200 bg-white hover:bg-ink-50 px-3.5 py-2 text-xs font-bold text-ink-700 shadow-2xs transition cursor-pointer disabled:opacity-50"
                    title="Save consumption record only without printing KOT ticket"
                  >
                    Record Only
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 text-sm font-bold text-white shadow-md hover:shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    <Printer size={15} />
                    <span>{submitting ? 'Ordering & Printing…' : '🍽️ Order & Print Captain Order'}</span>
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
                  <WorkflowBadge status={detailRecord.status} />
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
                        <td className="px-3 py-2">{item.product?.name || '—'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{item.quantity} {item.product?.uom || ''}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{etb(item.recipeCost)}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{etb(item.totalCost)}</td>
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
    </div>
  );
}
