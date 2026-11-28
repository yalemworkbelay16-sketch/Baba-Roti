import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, X, CheckCircle2, XCircle, Send, PackageCheck,
  Clock, AlertTriangle, ChevronDown, RefreshCw, Search,
  Layers, ArrowRight, Eye, Trash2, Filter, Building2,
  ClipboardList, PackageOpen, TrendingDown, Zap, Calendar,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import SearchableSelect from '../components/ui/SearchableSelect';
import useHighlightRow from '../hooks/useHighlightRow';

// ── Constants ────────────────────────────────────────────────────
const DEPARTMENTS = [
  'Kitchen', 'Bar', 'Main Store', 'Food & Beverage', 'Waiter',
  'Dining & Service', 'Finance', 'Finance & Accounting', 'Purchasing & Procurement',
  'Front Office', 'Housekeeping', 'Restaurant', 'Laundry', 'Management', 'Maintenance', 'Other',
];

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock, dot: 'bg-amber-500' },
  approved: { label: 'Approved', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2, dot: 'bg-blue-500' },
  issued: { label: 'Issued', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: PackageCheck, dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle, dot: 'bg-rose-500' },
  cancelled: { label: 'Cancelled', color: 'bg-ink-100 text-ink-500 border-ink-200', icon: X, dot: 'bg-ink-400' },
};

const PRIORITY_CONFIG = {
  normal: { label: 'Normal', color: 'bg-ink-50 text-ink-600 border-ink-200' },
  urgent: { label: 'Urgent', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const EMPTY_ITEM = { material: '', requestedQty: 1, note: '' };

const formatETB = (n) =>
  `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const toLocalDateKey = (val) => {
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// ── Status Badge ─────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

// ── Trail Timeline ────────────────────────────────────────────────
const TrailTimeline = ({ trail = [] }) => (
  <div className="space-y-2 mt-3">
    {trail.map((t, i) => (
      <div key={i} className="flex items-start gap-2.5 text-xs">
        <div className={`mt-0.5 h-2 w-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[t.action]?.dot || 'bg-ink-300'}`} />
        <div>
          <span className="font-bold text-ink-900 capitalize">{t.action}</span>
          <span className="text-ink-400 mx-1">by</span>
          <span className="font-semibold text-ink-700">{t.byName}</span>
          <span className="text-ink-400 ml-1">({t.byRole})</span>
          {t.note && <p className="text-ink-500 mt-0.5 italic">"{t.note}"</p>}
          <p className="text-ink-400 text-[10px]">
            {new Date(t.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>
    ))}
  </div>
);

// ── In-memory client cache for instant transitions ─────────────
let cachedRequests = null;
let cachedSummary = null;

// ════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function StockIssueRequest() {
  const { user, can, canCrud, hasRole, customDepartments = [] } = useAuth();
  const mergedDepartments = useMemo(() => {
    const extras = (customDepartments || []).map(d => d.label).filter(Boolean);
    return [...DEPARTMENTS, ...extras.filter(l => !DEPARTMENTS.some(b => b.toLowerCase() === l.toLowerCase()))];
  }, [customDepartments]);

  // ── Helper: detect user's default department (Bar / Kitchen / other) ──
  const getUserDepartment = useCallback((u = user) => {
    if (!u) return 'Kitchen';
    const dept = String(u?.department || '').trim();
    const station = String(u?.assignedStation || '').trim().toLowerCase();
    const role = String(u?.role || '').trim().toLowerCase();
    const name = String(u?.name || '').trim().toLowerCase();
    const pos = String(u?.position || '').trim().toLowerCase();

    // 1. Barista / Bar detection (any field mentioning bar or barista)
    if (
      dept.toLowerCase().includes('bar') ||
      dept.toLowerCase().includes('barista') ||
      station.includes('bar') ||
      station.includes('barista') ||
      role.includes('bar') ||
      role.includes('barista') ||
      pos.includes('bar') ||
      pos.includes('barista') ||
      name.includes('bar') ||
      name.includes('barista')
    ) {
      return 'Bar';
    }

    // 2. Kitchen / Cook / Chef detection
    if (
      dept.toLowerCase().includes('kitchen') ||
      station.includes('kitchen') ||
      role.includes('kitchen') ||
      pos.includes('kitchen') ||
      pos.includes('chef') ||
      pos.includes('cook') ||
      name.includes('kitchen')
    ) {
      return 'Kitchen';
    }

    // 3. Other exact or partial department match from DEPARTMENTS list
    if (dept) {
      const found = DEPARTMENTS.find(d => d.toLowerCase() === dept.toLowerCase());
      if (found) return found;
      const partial = DEPARTMENTS.find(d => dept.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(dept.toLowerCase()));
      if (partial) return partial;
    }

    return 'Kitchen';
  }, [user]);

  // ── User station & Role permissions ───────────────────────────
  const userStation = useMemo(() => {
    const assigned = String(user?.assignedStation || '').trim().toLowerCase();
    if (assigned && assigned !== 'all') return assigned;

    const defaultDept = getUserDepartment(user);
    if (defaultDept === 'Bar') return 'bar';
    if (defaultDept === 'Kitchen') return 'kitchen';

    return user?.assignedStation || 'all';
  }, [user, getUserDepartment]);

  const isStationRestricted = ['kitchen', 'bar'].includes(userStation) && !['admin', 'manager', 'operation_manager', 'dev'].includes(user?.role);
  const isMainStoreOrAdmin = ['admin', 'manager', 'operation_manager', 'dev'].includes(user?.role) || (user?.role === 'storekeeper' && !isStationRestricted);

  const canApprove = (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operation_manager' || user?.role === 'dev') && !isStationRestricted;
  const canIssue = isMainStoreOrAdmin;
  const canEdit = canCrud ? canCrud('stockMovements', 'edit') : (user?.role === 'admin' || user?.role === 'manager' || user?.role === 'operation_manager');
  const canDelete = canCrud ? canCrud('stockMovements', 'delete') : user?.role === 'admin';

  // ── Station category mapping ──────────────────────────────────
  const [stationMapping, setStationMapping] = useState({
    'Bar': 'bar',
    'ferash Bazare': 'kitchen',
    'Kitchen': 'kitchen',
    'Mendi': 'kitchen',
    'Pastery': 'kitchen',
    'CleanerMaterial': 'mainStore',
    'Material': 'mainStore',
  });
  const [showAllMaterialsOverride, setShowAllMaterialsOverride] = useState(false);

  useEffect(() => {
    api.get('/settings').then((res) => {
      if (res.data?.stationCategoryMapping?.rawMaterialMap) {
        setStationMapping((prev) => ({
          ...prev,
          ...res.data.stationCategoryMapping.rawMaterialMap,
        }));
      }
    }).catch(() => { });
  }, []);

  const getMaterialStation = useCallback((m) => {
    const cat = String(m?.category || '').trim();
    if (stationMapping[cat]) return stationMapping[cat];
    const loc = String(m?.storeLocation || '').toLowerCase();
    if (loc.includes('kitchen')) return 'kitchen';
    if (loc.includes('bar')) return 'bar';
    const lower = cat.toLowerCase();
    if (lower === 'bar' || /beverage|drink|coffee|tea|juice|soda|beer|wine|water/i.test(lower)) return 'bar';
    if (
      lower === 'kitchen' ||
      lower === 'ferash bazare' ||
      lower === 'mendi' ||
      lower === 'pastery' ||
      /produce|meat|poultry|dairy|bakery|grains|spices|food|fresh|fruit|veg/i.test(lower)
    ) {
      return 'kitchen';
    }
    return 'mainStore';
  }, [stationMapping]);

  // ── Data state (instantly restored from cache if previously visited) ──
  const [requests, setRequests] = useState(() => cachedRequests || []);
  const [materials, setMaterials] = useState([]);
  const [summary, setSummary] = useState(() => cachedSummary || {});
  const [loading, setLoading] = useState(() => !cachedRequests);
  const [refreshing, setRefreshing] = useState(false);

  // ── Filters ──────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'week' | 'month' | 'custom'
  const [customDate, setCustomDate] = useState(() => toLocalDateKey(new Date()));
  const [search, setSearch] = useState('');

  // ── Create/Edit modal ────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [formDept, setFormDept] = useState(() => getUserDepartment(user));
  const [formType, setFormType] = useState('request');       // 'request' | 'direct_issue'
  const [formPriority, setFormPriority] = useState('normal');
  const [formNotes, setFormNotes] = useState('');
  const [formItems, setFormItems] = useState([{ ...EMPTY_ITEM }]);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Auto-sync default department when user data is ready
  useEffect(() => {
    if (user && !editTarget) {
      setFormDept(getUserDepartment(user));
    }
  }, [user, getUserDepartment, editTarget]);

  // ── Detail drawer ────────────────────────────────────────────
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState(null);

  // ── Action modal (approve/issue/reject) ──────────────────────
  const [actionOpen, setActionOpen] = useState(false);
  const [actionType, setActionType] = useState('');   // 'approve'|'issue'|'reject'|'cancel'
  const [actionTarget, setActionTarget] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  // ── Issue qty overrides ──────────────────────────────────────
  const [issueQtys, setIssueQtys] = useState({});

  // ── Load data — ultra fast with stale-while-revalidate ─────────
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!cachedRequests) setLoading(true);

    try {
      // Load requests + summary in parallel with fast projection
      const [reqRes, sumRes] = await Promise.all([
        api.get('/stock-requests?limit=100'),
        api.get('/stock-requests/summary'),
      ]);
      const data = Array.isArray(reqRes.data) ? reqRes.data : [];
      const sum = sumRes.data || {};
      cachedRequests = data;
      cachedSummary = sum;
      setRequests(data);
      setSummary(sum);
    } catch (err) {
      console.error('Failed to load stock requests', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Lazy-load materials only when create modal is opened
  const loadMaterials = useCallback(async () => {
    if (materials.length > 0) return; // already loaded
    try {
      const matRes = await api.get('/materials?isActive=true&limit=500');
      setMaterials(
        Array.isArray(matRes.data?.materials)
          ? matRes.data.materials
          : Array.isArray(matRes.data) ? matRes.data : []
      );
    } catch (err) {
      console.error('Failed to load materials', err);
    }
  }, [materials.length]);

  useEffect(() => { load(); }, [load]);

  // ── Scoped available materials for creation/requisitions ─────
  const availableMaterials = useMemo(() => {
    if (showAllMaterialsOverride && !isStationRestricted) return materials;

    // Station restricted users ONLY see items mapped to their station
    if (isStationRestricted) {
      return materials.filter(m => getMaterialStation(m) === userStation);
    }

    // Main storekeeper / admin defaults to filtering by the currently selected target department
    const deptLower = String(formDept || '').toLowerCase();
    if (deptLower === 'bar') {
      return materials.filter(m => getMaterialStation(m) === 'bar');
    }
    if (deptLower === 'kitchen') {
      return materials.filter(m => getMaterialStation(m) === 'kitchen');
    }
    return materials;
  }, [materials, formDept, userStation, getMaterialStation, showAllMaterialsOverride, isStationRestricted]);

  // ── Scoped summary stats for station users ────────────────────
  const displaySummary = useMemo(() => {
    if (!isStationRestricted) return summary;
    const targetDept = userStation === 'bar' ? 'bar' : 'kitchen';
    const deptRequests = requests.filter(r => String(r.department || '').toLowerCase() === targetDept);
    return {
      pending: deptRequests.filter(r => r.status === 'pending').length,
      approved: deptRequests.filter(r => r.status === 'approved').length,
      issued: deptRequests.filter(r => r.status === 'issued').length,
      rejected: deptRequests.filter(r => r.status === 'rejected').length,
      monthCost: deptRequests.filter(r => r.status === 'issued').reduce((sum, r) => sum + (r.totalCost || 0), 0),
    };
  }, [isStationRestricted, userStation, requests, summary]);

  // ── Filtered list ────────────────────────────────────────────
  const filtered = useMemo(() => {
    const now = new Date();
    const todayKey = toLocalDateKey(now);
    const weekAgo = new Date(now);
    weekAgo.setDate(now.getDate() - 7);
    const weekKey = toLocalDateKey(weekAgo);
    const monthPrefix = todayKey.slice(0, 7);

    return requests.filter(r => {
      if (isStationRestricted) {
        const targetStation = userStation === 'bar' ? 'bar' : 'kitchen';
        if (String(r.department || '').toLowerCase() !== targetStation) return false;
      } else if (filterDept && r.department !== filterDept) {
        return false;
      }
      if (filterStatus && r.status !== filterStatus) return false;
      if (datePreset !== 'all') {
        const reqDateKey = toLocalDateKey(r.requestDate || r.createdAt);
        if (!reqDateKey) return false;
        if (datePreset === 'today' && reqDateKey !== todayKey) return false;
        if (datePreset === 'week' && (reqDateKey < weekKey || reqDateKey > todayKey)) return false;
        if (datePreset === 'month' && !reqDateKey.startsWith(monthPrefix)) return false;
        if (datePreset === 'custom' && customDate && reqDateKey !== customDate) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchVoucher = r.voucherNo?.toLowerCase().includes(q);
        const matchDept = r.department?.toLowerCase().includes(q);
        const matchReqBy = r.requestedBy?.name?.toLowerCase().includes(q);
        const matchItem = r.items?.some(i => i.material?.name?.toLowerCase().includes(q));
        if (!matchVoucher && !matchDept && !matchReqBy && !matchItem) return false;
      }
      return true;
    });
  }, [requests, filterStatus, filterDept, datePreset, customDate, search, isStationRestricted, userStation]);

  const { setRowRef, rowClass } = useHighlightRow({
    items: requests,
    displayed: filtered,
    onEnsureVisible: () => { setFilterStatus(''); setFilterDept(''); setDatePreset('all'); setSearch(''); },
  });

  // ── Form helpers ─────────────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    const defaultDept = getUserDepartment(user);
    setFormDept(defaultDept);
    setFormType('request');
    setFormPriority('normal');
    setFormNotes('');
    setFormItems([{ ...EMPTY_ITEM }]);
    setFormError('');
    setShowAllMaterialsOverride(false);
    setCreateOpen(true);
    loadMaterials(); // lazy load
  };

  const openEdit = (req) => {
    setEditTarget(req);
    setFormDept(req.department);
    setFormType(req.requestType || 'request');
    setFormPriority(req.priority || 'normal');
    setFormNotes(req.notes || '');
    setFormItems(req.items.map(i => ({
      material: i.material?._id || i.material,
      requestedQty: i.requestedQty,
      note: i.note || '',
    })));
    setFormError('');
    setCreateOpen(true);
    loadMaterials(); // lazy load
  };

  const addItem = () => setFormItems(prev => [...prev, { ...EMPTY_ITEM }]);
  const removeItem = (idx) => setFormItems(prev => prev.filter((_, i) => i !== idx));
  const updateItem = (idx, field, value) => {
    setFormItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    ));
  };

  // ── Submit create/edit ────────────────────────────────────────
  const handleSubmit = async () => {
    setFormError('');
    const validItems = formItems.filter(i => i.material && Number(i.requestedQty) > 0);
    if (!validItems.length) { setFormError('Add at least one item with a material and quantity.'); return; }

    // Client-side stock check before submitting
    if (formType === 'direct_issue') {
      const overItems = validItems.filter(i => {
        const mat = materials.find(m => m._id === i.material);
        const storeStock = Number(mat?.mainStoreStock !== undefined ? mat.mainStoreStock : mat?.currentStock ?? 0);
        return mat && Number(i.requestedQty) > storeStock;
      });
      if (overItems.length > 0) {
        const msgs = overItems.map(i => {
          const mat = materials.find(m => m._id === i.material);
          const storeStock = Number(mat?.mainStoreStock !== undefined ? mat.mainStoreStock : mat?.currentStock ?? 0);
          return `${mat?.name}: requested ${i.requestedQty} but only ${storeStock} ${mat?.unit} in Main Store`;
        }).join('\n');
        setFormError(`⚠ Insufficient Main Store stock for issue:\n${msgs}`);
        return;
      }
    }

    setFormLoading(true);
    try {
      const payload = {
        department: formDept,
        requestType: formType,
        priority: formPriority,
        notes: formNotes,
        items: validItems.map(i => ({
          material: i.material,
          requestedQty: Number(i.requestedQty),
          note: i.note,
        })),
      };
      let response;
      if (editTarget) {
        response = await api.put(`/stock-requests/${editTarget._id}`, payload);
      } else {
        response = await api.post('/stock-requests', payload);
      }
      setCreateOpen(false);
      await load(true);

      // Show stock warnings after successful submission (for regular requests)
      if (response?.data?.stockWarnings?.length > 0) {
        const warnMsgs = response.data.stockWarnings.map(w =>
          `• ${w.name}: requested ${w.requested} ${w.unit}, only ${w.available} available (shortfall: ${w.shortfall})`
        ).join('\n');
        alert(`⚠ Request submitted, but note:\n\n${warnMsgs}\n\nThe storekeeper will see this when issuing.`);
      }
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save request');
    } finally {
      setFormLoading(false);
    }
  };

  // ── Workflow action ───────────────────────────────────────────
  const openAction = (type, req) => {
    setActionType(type);
    setActionTarget(req);
    setActionNote('');
    setActionError('');
    if (type === 'issue') {
      const qtys = {};
      req.items.forEach(i => {
        qtys[i.material?._id || i.material] = i.requestedQty;
      });
      setIssueQtys(qtys);
    }
    setActionOpen(true);
  };

  const handleAction = async () => {
    setActionError('');
    setActionLoading(true);
    try {
      const url = `/stock-requests/${actionTarget._id}/${actionType}`;
      let body = { note: actionNote };

      if (actionType === 'reject') body = { reason: actionNote };
      if (actionType === 'cancel') body = { reason: actionNote };
      if (actionType === 'issue') {
        body = {
          note: actionNote,
          items: actionTarget.items.map(i => ({
            material: i.material?._id || i.material,
            issuedQty: Number(issueQtys[i.material?._id || i.material] || i.requestedQty),
          })),
        };
      }

      await api.post(url, body);
      setActionOpen(false);
      setDetailOpen(false);
      await load(true);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Open detail ───────────────────────────────────────────────
  const openDetail = async (req) => {
    try {
      const res = await api.get(`/stock-requests/${req._id}`);
      setDetailRequest(res.data);
      setDetailOpen(true);
    } catch {
      setDetailRequest(req);
      setDetailOpen(true);
    }
  };

  // ── Delete ────────────────────────────────────────────────────
  const handleDelete = async (req) => {
    if (!window.confirm(`Delete request ${req.voucherNo}? This moves it to the recycle bin.`)) return;
    try {
      await api.delete(`/stock-requests/${req._id}`);
      await load(true);
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────

  const getMaterialStock = (matId) => {
    const mat = materials.find(m => (m._id || m) === matId);
    return mat?.mainStoreStock !== undefined ? mat.mainStoreStock : mat?.currentStock ?? '—';
  };

  const getMaterialUnit = (matId) => {
    const mat = materials.find(m => (m._id || m) === matId);
    return mat?.unit ?? '';
  };

  // ── Action config ─────────────────────────────────────────────
  const ACTION_CONFIG = {
    approve: { title: 'Approve Request', btn: 'Approve', btnClass: 'bg-blue-600 hover:bg-blue-700', label: 'Approval note (optional)' },
    issue: { title: 'Issue Stock', btn: 'Issue Stock', btnClass: 'bg-emerald-600 hover:bg-emerald-700', label: 'Issue note (optional)' },
    reject: { title: 'Reject Request', btn: 'Reject', btnClass: 'bg-rose-600 hover:bg-rose-700', label: 'Reason for rejection *' },
    cancel: { title: 'Cancel Request', btn: 'Cancel Request', btnClass: 'bg-ink-600 hover:bg-ink-700', label: 'Reason for cancellation (optional)' },
  };

  // ── Loading skeleton ──────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6 pb-8 animate-pulse">
        <div className="h-8 w-64 rounded-xl bg-ink-200/60" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 rounded-2xl bg-white border border-ink-100" />)}
        </div>
        <div className="h-96 rounded-2xl bg-white border border-ink-100" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-ink-900">Stock Issue & Request</h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
              Live
            </span>
          </div>
          <p className="text-sm text-ink-400 mt-0.5">
            Manage inter-department stock requests and direct issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-2 text-xs text-ink-600 hover:bg-ink-50 transition"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-sm"
          >
            <Plus size={14} /> New Request
          </button>
          {canIssue && (
            <button
              onClick={() => { openCreate(); setTimeout(() => setFormType('direct_issue'), 50); }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
            >
              <PackageCheck size={14} /> Direct Issue
            </button>
          )}
        </div>
      </div>

      {/* ── Main Branch Operational Indicator ── */}
      <div className="rounded-2xl border border-blue-200/80 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
            <Building2 size={16} />
          </div>
          <div className="text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-blue-950">
                {isStationRestricted
                  ? `${userStation === 'bar' ? 'Bar Station' : 'Kitchen Station'} Stock Requisitions`
                  : 'Main Store Warehouse Requisition & Issue Center'}
              </span>
              <span className="rounded-full bg-blue-100 border border-blue-300 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                {isStationRestricted ? 'Station Requisition Mode' : 'Warehouse Keeper Mode'}
              </span>
            </div>
            <p className="mt-1 text-blue-900/80 leading-relaxed">
              {isStationRestricted
                ? `Submit stock requisitions to the Main Store Warehouse. Material selection is scoped to items mapped to your ${userStation === 'bar' ? 'Bar' : 'Kitchen'} station. Stock issue is handled by the Main Storekeeper.`
                : 'Stock requests and direct issues track internal hand-offs from Main Warehouse to Kitchen and Bar. Stock is physically issued by the Main Storekeeper.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Summary KPI Cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Pending', value: displaySummary.pending || 0, icon: Clock, color: 'from-amber-500 to-orange-500', bg: 'bg-amber-50', text: 'text-amber-700' },
          { label: 'Approved', value: displaySummary.approved || 0, icon: CheckCircle2, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Issued', value: displaySummary.issued || 0, icon: PackageCheck, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700' },
          { label: 'Rejected', value: displaySummary.rejected || 0, icon: XCircle, color: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-700' },
        ].map(({ label, value, icon: Icon, color, bg, text }) => (
          <div key={label} className={`rounded-2xl border border-ink-100 bg-white p-4 shadow-soft cursor-pointer hover:shadow-md transition`}
            onClick={() => setFilterStatus(filterStatus === label.toLowerCase() ? '' : label.toLowerCase())}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-ink-400 uppercase tracking-wider">{label}</p>
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-sm`}>
                <Icon size={14} className="text-white" />
              </span>
            </div>
            <p className="text-3xl font-black text-ink-900">{value}</p>
            {filterStatus === label.toLowerCase() && (
              <span className="text-[10px] font-bold text-blue-600">● Filtered</span>
            )}
          </div>
        ))}
      </div>

      {/* ── This month cost ── */}
      {displaySummary.monthCost > 0 && (
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-blue-50 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
            <TrendingDown size={16} />
            {isStationRestricted
              ? `Total stock issued to ${userStation === 'bar' ? 'Bar' : 'Kitchen'} this month`
              : 'Total stock issued this month'}
          </div>
          <span className="text-base font-black text-indigo-900">{formatETB(displaySummary.monthCost)}</span>
        </div>
      )}

      {/* ── Filters ── */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/40 px-3 py-2 flex-1 min-w-[200px]">
            <Search size={14} className="text-ink-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search by voucher, department, item, or requester..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none text-ink-800 placeholder-ink-400"
            />
            {search && <button onClick={() => setSearch('')}><X size={13} className="text-ink-400" /></button>}
          </div>

          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none"
          >
            <option value="">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          {!isStationRestricted ? (
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none"
            >
              <option value="">All Departments</option>
              {mergedDepartments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
              <Building2 size={13} />
              {userStation === 'bar' ? 'Bar Station Requests' : 'Kitchen Station Requests'}
            </span>
          )}

          {/* Date View Filter */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-ink-200 bg-white px-2 py-1">
            <Calendar size={13} className="text-blue-600 mr-0.5 shrink-0" />
            {[
              { id: 'all', label: 'All Dates' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: '7 Days' },
              { id: 'month', label: 'Month' },
            ].map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDatePreset(d.id)}
                className={`rounded-lg px-2 py-1 text-xs font-semibold transition cursor-pointer ${datePreset === d.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-ink-600 hover:bg-ink-50'
                  }`}
              >
                {d.label}
              </button>
            ))}
            <input
              type="date"
              value={datePreset === 'custom' ? customDate : ''}
              onChange={(e) => {
                if (!e.target.value) setDatePreset('all');
                else { setCustomDate(e.target.value); setDatePreset('custom'); }
              }}
              className="rounded-lg border border-ink-200 bg-ink-50/60 px-2 py-1 text-xs font-semibold text-ink-800 outline-none focus:border-blue-500 cursor-pointer"
              title="Filter requisitions by date"
            />
          </div>

          {(filterStatus || filterDept || datePreset !== 'all' || search) && (
            <button
              onClick={() => { setFilterStatus(''); setFilterDept(''); setDatePreset('all'); setSearch(''); }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-800"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs text-ink-400 ml-auto">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </Card>

      {/* ── Table ── */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <ClipboardList size={36} className="mx-auto mb-3 text-ink-200" />
            <p className="text-sm font-semibold text-ink-600">No requests found</p>
            <p className="text-xs text-ink-400 mt-1">Create a new request or adjust your filters</p>
            <button
              onClick={openCreate}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
            >
              <Plus size={13} /> New Request
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/50">
                  {['Voucher', 'Department', 'Type', 'Priority', 'Items', 'Total Cost', 'Requested By', 'Date', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-ink-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {filtered.map(req => (
                  <tr key={req._id} ref={setRowRef(req)} className={rowClass(req, 'hover:bg-ink-50/50 transition group')}>
                    <td className="px-4 py-3 font-bold text-blue-700">
                      <div>{req.voucherNo}</div>
                      <div className="text-[9px] text-ink-400 font-normal">Internal Hand-off</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Building2 size={12} className="text-ink-400" />
                        <span className="font-semibold text-ink-800">{req.department}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${req.requestType === 'direct_issue'
                          ? 'bg-violet-50 text-violet-700 border-violet-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                          }`}>
                          {req.requestType === 'direct_issue' ? 'Direct Issue' : 'Request'}
                        </span>
                        <span className="text-[9px] font-semibold text-ink-500 bg-ink-100/70 rounded px-1.5 py-0.5">
                          Non-Deducting
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${PRIORITY_CONFIG[req.priority]?.color}`}>
                        {req.priority === 'urgent' ? '🚨 ' : ''}{PRIORITY_CONFIG[req.priority]?.label || 'Normal'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      {req.items?.length} item{req.items?.length !== 1 ? 's' : ''}
                    </td>
                    <td className="px-4 py-3 font-semibold text-ink-900 tabular-nums">
                      {formatETB(req.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-ink-600">{req.requestedBy?.name || '—'}</td>
                    <td className="px-4 py-3 text-ink-400">
                      {new Date(req.date || req.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={req.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {/* View — always shown */}
                        <button
                          onClick={() => openDetail(req)}
                          className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-50 hover:border-ink-300 transition shadow-sm"
                        >
                          <Eye size={11} /> View
                        </button>

                        {/* Edit — pending only */}
                        {req.status === 'pending' && canEdit && (
                          <button
                            onClick={() => openEdit(req)}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition shadow-sm"
                          >
                            <ClipboardList size={11} /> Edit
                          </button>
                        )}

                        {/* Approve */}
                        {req.status === 'pending' && canApprove && (
                          <button
                            onClick={() => openAction('approve', req)}
                            className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 transition shadow-sm"
                          >
                            <CheckCircle2 size={11} /> Approve
                          </button>
                        )}

                        {/* Issue */}
                        {req.status === 'approved' && canIssue && (
                          <button
                            onClick={() => openAction('issue', req)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 transition shadow-sm"
                          >
                            <PackageCheck size={11} /> Issue
                          </button>
                        )}

                        {/* Reject */}
                        {['pending', 'approved'].includes(req.status) && canApprove && (
                          <button
                            onClick={() => openAction('reject', req)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition shadow-sm"
                          >
                            <XCircle size={11} /> Reject
                          </button>
                        )}

                        {/* Cancel (own pending request) */}
                        {req.status === 'pending' && req.requestedBy?._id === user?._id && (
                          <button
                            onClick={() => openAction('cancel', req)}
                            className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1 text-[11px] font-semibold text-ink-600 hover:bg-ink-100 transition shadow-sm"
                          >
                            <X size={11} /> Cancel
                          </button>
                        )}

                        {/* Delete */}
                        {['rejected', 'cancelled'].includes(req.status) && canDelete && (
                          <button
                            onClick={() => handleDelete(req)}
                            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-rose-700 transition shadow-sm"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ══════════════════════════════════════════
          CREATE / EDIT MODAL
      ══════════════════════════════════════════ */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setCreateOpen(false)}
        >
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100"
              style={{ background: 'linear-gradient(135deg, #1a3cdb 0%, #4f46e5 100%)' }}>
              <div>
                <h2 className="text-base font-black text-white">
                  {editTarget
                    ? 'Edit Request'
                    : formType === 'direct_issue'
                      ? 'Direct Stock Issue'
                      : isStationRestricted
                        ? `${userStation === 'bar' ? 'Bar Station' : 'Kitchen Station'} Stock Requisition`
                        : 'New Stock Request'}
                </h2>
                <p className="text-xs text-blue-200 mt-0.5">
                  {formType === 'direct_issue'
                    ? 'Immediately transfers stock from Main Warehouse to station'
                    : isStationRestricted
                      ? `Select materials mapped to ${userStation === 'bar' ? 'Bar' : 'Kitchen'} station and submit to Main Warehouse Storekeeper`
                      : 'Submit a request for admin/manager approval'}
                </p>
              </div>
              <button onClick={() => setCreateOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Type selector - Only visible to Main Storekeeper or Admin */}
              {!editTarget && canIssue && (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'request', label: 'Stock Request', desc: 'Requires approval', icon: ClipboardList, color: 'border-blue-400 bg-blue-50' },
                    { value: 'direct_issue', label: 'Direct Issue', desc: 'Instant stock deduction', icon: Zap, color: 'border-violet-400 bg-violet-50' },
                  ].map(t => (
                    <button key={t.value}
                      onClick={() => setFormType(t.value)}
                      className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition ${formType === t.value ? t.color : 'border-ink-200 bg-white hover:bg-ink-50'
                        }`}
                    >
                      <t.icon size={18} className={formType === t.value ? 'text-blue-600' : 'text-ink-400'} />
                      <div>
                        <p className="text-xs font-bold text-ink-900">{t.label}</p>
                        <p className="text-[10px] text-ink-500">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Department + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">Department *</label>
                  <select
                    value={formDept}
                    onChange={e => setFormDept(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    {mergedDepartments.map(d => (
                      <option key={d} value={d}>
                        {d} {d === getUserDepartment(user) ? '★ (Your Department)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-700 mb-1.5">Priority</label>
                  <select
                    value={formPriority}
                    onChange={e => setFormPriority(e.target.value)}
                    className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">🚨 Urgent</option>
                  </select>
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-xs font-bold text-ink-700">Items *</label>
                    <span className="rounded-full bg-blue-50 border border-blue-200 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                      {availableMaterials.length} mapped item{availableMaterials.length !== 1 ? 's' : ''} for {isStationRestricted ? (userStation === 'bar' ? 'Bar' : 'Kitchen') : formDept}
                    </span>
                    {!isStationRestricted && (
                      <button
                        type="button"
                        onClick={() => setShowAllMaterialsOverride(!showAllMaterialsOverride)}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline ml-1"
                      >
                        {showAllMaterialsOverride ? 'Filter by Station' : `Show all warehouse items (${materials.length})`}
                      </button>
                    )}
                  </div>
                  <button onClick={addItem}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition">
                    <Plus size={11} /> Add Item
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, idx) => {
                    const mat = materials.find(m => m._id === item.material);
                    return (
                      <div key={idx} className="flex items-start gap-2 rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <div className="col-span-2">
                            <SearchableSelect
                              required
                              placeholder={`Select ${isStationRestricted ? (userStation === 'bar' ? 'Bar' : 'Kitchen') : formDept} material…`}
                              options={availableMaterials}
                              value={item.material}
                              onChange={val => updateItem(idx, 'material', val)}
                            />
                          </div>
                          <div>
                            <input
                              type="number"
                              min="0.001"
                              step="any"
                              value={item.requestedQty}
                              onChange={e => updateItem(idx, 'requestedQty', e.target.value)}
                              placeholder="Qty"
                              className="w-full rounded-lg border border-ink-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-blue-500"
                            />
                          </div>
                          {mat && (
                            <div className="col-span-3 flex items-center gap-3 text-[10px] text-ink-500 -mt-1 px-1">
                              <span>Unit: <strong>{mat.unit}</strong></span>
                              <span>Main Store: <strong className={(mat.mainStoreStock !== undefined ? mat.mainStoreStock : mat.currentStock) < item.requestedQty ? 'text-rose-600' : 'text-blue-700'}>{mat.mainStoreStock !== undefined ? mat.mainStoreStock : mat.currentStock}</strong></span>
                              <span>Unit cost: <strong>{formatETB(mat.unitCost)}</strong></span>
                            </div>
                          )}
                        </div>
                        {formItems.length > 1 && (
                          <button onClick={() => removeItem(idx)}
                            className="mt-1 rounded-lg p-1.5 text-rose-400 hover:bg-rose-50 transition flex-shrink-0">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1.5">Notes (optional)</label>
                <textarea
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  rows={2}
                  placeholder="Add any notes or context for this request..."
                  className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                />
              </div>

              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4 bg-ink-50/40">
              <button onClick={() => setCreateOpen(false)}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={formLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
              >
                {formLoading ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                {editTarget ? 'Save Changes' : formType === 'direct_issue' ? 'Issue Now' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          ACTION MODAL (approve / issue / reject / cancel)
      ══════════════════════════════════════════ */}
      {actionOpen && actionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setActionOpen(false)}
        >
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`px-6 py-5 border-b border-ink-100 ${actionType === 'approve' ? 'bg-blue-600'
              : actionType === 'issue' ? 'bg-emerald-600'
                : actionType === 'reject' ? 'bg-rose-600'
                  : 'bg-ink-800'
              }`}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-white">{ACTION_CONFIG[actionType]?.title}</h2>
                <button onClick={() => setActionOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition">
                  <X size={15} />
                </button>
              </div>
              <p className="text-xs text-white/70 mt-1">
                {actionTarget.voucherNo} · Main Store ➔ {actionTarget.department}
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Items summary */}
              <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3 space-y-2.5">
                {actionTarget.items?.map((item, i) => {
                  const matId = item.material?._id || item.material;
                  const currentStock = Number(item.material?.mainStoreStock !== undefined ? item.material.mainStoreStock : item.material?.currentStock ?? 0);
                  const issueQty = Number(issueQtys[matId] ?? item.requestedQty);
                  const isOverStock = actionType === 'issue' && issueQty > currentStock;

                  return (
                    <div key={i} className="rounded-xl border border-ink-100 bg-white p-3">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-bold text-ink-900">{item.material?.name || '—'}</span>
                        {actionType === 'issue' && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentStock >= issueQty
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-amber-100 text-amber-800'
                            }`}>
                            {currentStock >= issueQty
                              ? `✓ ${currentStock} ${item.material?.unit} in Main Store`
                              : `⚡ Main Store stock: ${currentStock} ${item.material?.unit}`
                            }
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-ink-500">Requested: <strong>{item.requestedQty} {item.material?.unit}</strong></span>
                        {actionType === 'issue' && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-ink-500">Issue:</span>
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={issueQtys[matId] ?? item.requestedQty}
                              onChange={e => setIssueQtys(prev => ({
                                ...prev,
                                [matId]: e.target.value,
                              }))}
                              className="w-24 rounded-lg border border-ink-200 bg-white px-2 py-1 text-xs text-center outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                            />
                            <span className="text-ink-400">/ {item.requestedQty} {item.material?.unit}</span>
                          </div>
                        )}
                        {actionType !== 'issue' && (
                          <span className="ml-auto text-ink-600">{item.requestedQty} {item.material?.unit}</span>
                        )}
                      </div>
                      {isOverStock && (
                        <p className="text-[10px] text-amber-700 mt-1.5 font-medium">
                          ℹ Qty exceeds recorded store count. Allowed for internal hand-off (raw materials are consumed on Sales).
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Informational notice */}
              {actionType === 'issue' && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 px-4 py-3 text-xs font-medium text-blue-900">
                  <p className="font-bold flex items-center gap-1.5 mb-0.5">
                    <Building2 size={13} className="text-blue-700" /> Main Branch Internal Issue Mode
                  </p>
                  <p className="text-[11px] text-blue-800/80 leading-relaxed">
                    This records the departmental hand-off for operational tracking.
                    <strong> Raw material stock will not be deducted here</strong>; it will be consumed when sales are imported/recorded.
                  </p>
                </div>
              )}

              {/* Note/Reason input */}
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1.5">
                  {ACTION_CONFIG[actionType]?.label}
                </label>
                <textarea
                  value={actionNote}
                  onChange={e => setActionNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-xs outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 resize-none"
                  placeholder={
                    actionType === 'reject' ? 'Provide a clear reason for rejection...'
                      : actionType === 'cancel' ? 'Reason for cancellation...'
                        : 'Optional note...'
                  }
                />
              </div>

              {actionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-medium text-rose-700">
                  {actionError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-ink-100 px-6 py-4 bg-ink-50/40">
              <button onClick={() => setActionOpen(false)}
                className="rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition">
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (actionType === 'reject' && !actionNote.trim())}
                className={`inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white transition disabled:opacity-50 ${ACTION_CONFIG[actionType]?.btnClass}`}
              >
                {actionLoading
                  ? <RefreshCw size={13} className="animate-spin" />
                  : actionType === 'approve' ? <CheckCircle2 size={13} />
                    : actionType === 'issue' ? <PackageCheck size={13} />
                      : actionType === 'reject' ? <XCircle size={13} />
                        : <X size={13} />
                }
                {ACTION_CONFIG[actionType]?.btn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          DETAIL DRAWER
      ══════════════════════════════════════════ */}
      {detailOpen && detailRequest && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
          onClick={() => setDetailOpen(false)}
        >
          <div
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
            style={{ maxHeight: '90vh' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-ink-100 bg-ink-50/60">
              <div>
                <h2 className="text-base font-black text-ink-900">{detailRequest.voucherNo}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={detailRequest.status} />
                  <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold border ${PRIORITY_CONFIG[detailRequest.priority]?.color}`}>
                    {detailRequest.priority}
                  </span>
                </div>
              </div>
              <button onClick={() => setDetailOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-ink-100 text-ink-600 hover:bg-ink-200 transition">
                <X size={15} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                {[
                  { label: 'Department', value: detailRequest.department },
                  { label: 'Type', value: detailRequest.requestType === 'direct_issue' ? 'Direct Issue' : 'Request' },
                  { label: 'Stock Impact', value: 'Internal Hand-off (Raw material deducted on Sales)' },
                  { label: 'Requested By', value: detailRequest.requestedBy?.name },
                  { label: 'Date', value: new Date(detailRequest.date || detailRequest.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' }) },
                  detailRequest.approvedBy && { label: 'Approved By', value: detailRequest.approvedBy?.name },
                  detailRequest.issuedBy && { label: 'Issued By', value: detailRequest.issuedBy?.name },
                  detailRequest.rejectedBy && { label: 'Rejected By', value: detailRequest.rejectedBy?.name },
                  detailRequest.rejectReason && { label: 'Reject Reason', value: detailRequest.rejectReason },
                ].filter(Boolean).map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-ink-100 bg-ink-50/40 p-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{label}</p>
                    <p className="font-semibold text-ink-900 mt-0.5">{value || '—'}</p>
                  </div>
                ))}
              </div>

              {/* Items table */}
              <div>
                <p className="text-xs font-bold text-ink-700 mb-2">Items</p>
                <div className="rounded-xl border border-ink-100 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-50">
                      <tr>
                        {['Material', 'Req. Qty', 'Issued Qty', 'Unit Cost', 'Total'].map(h => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-ink-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-ink-50">
                      {detailRequest.items?.map((item, i) => (
                        <tr key={i} className="hover:bg-ink-50/40">
                          <td className="px-3 py-2 font-semibold text-ink-900">{item.material?.name || '—'}</td>
                          <td className="px-3 py-2 text-ink-600">{item.requestedQty} {item.material?.unit}</td>
                          <td className="px-3 py-2">
                            {item.issuedQty > 0
                              ? <span className="font-bold text-emerald-700">{item.issuedQty} {item.material?.unit}</span>
                              : <span className="text-ink-400">—</span>
                            }
                          </td>
                          <td className="px-3 py-2 text-ink-600">{formatETB(item.unitCost)}</td>
                          <td className="px-3 py-2 font-semibold text-ink-900">{formatETB(item.totalCost)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-ink-50">
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-xs text-ink-700">Total Cost</td>
                        <td className="px-3 py-2 font-black text-ink-900">{formatETB(detailRequest.totalCost)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Notes */}
              {detailRequest.notes && (
                <div className="rounded-xl border border-ink-100 bg-ink-50/40 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 mb-1">Notes</p>
                  <p className="text-xs text-ink-700">{detailRequest.notes}</p>
                </div>
              )}

              {/* Trail */}
              <div>
                <p className="text-xs font-bold text-ink-700 mb-1">Audit Trail</p>
                <TrailTimeline trail={detailRequest.trail || []} />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center gap-2 border-t border-ink-100 px-6 py-4 bg-ink-50/40 flex-wrap">
              {detailRequest.status === 'pending' && canApprove && (
                <button
                  onClick={() => { setDetailOpen(false); openAction('approve', detailRequest); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                >
                  <CheckCircle2 size={13} /> Approve
                </button>
              )}
              {detailRequest.status === 'approved' && canIssue && (
                <button
                  onClick={() => { setDetailOpen(false); openAction('issue', detailRequest); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition"
                >
                  <PackageCheck size={13} /> Issue Stock
                </button>
              )}
              {['pending', 'approved'].includes(detailRequest.status) && canApprove && (
                <button
                  onClick={() => { setDetailOpen(false); openAction('reject', detailRequest); }}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
                >
                  <XCircle size={13} /> Reject
                </button>
              )}
              <button onClick={() => setDetailOpen(false)}
                className="ml-auto rounded-xl border border-ink-200 bg-white px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
