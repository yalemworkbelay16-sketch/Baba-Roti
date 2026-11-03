import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Printer, Scale, Search, History, X, RefreshCw,
  ChevronLeft, ChevronRight, Calendar, ArrowRight, CheckCircle, Clock,
  ClipboardList, Store, PackageSearch, TrendingUp, TrendingDown,
  Minus, Send, ShieldCheck, Trash2, Plus, AlertTriangle, BarChart3,
  ChevronDown, ChevronUp, Eye, EyeOff, Save,
} from 'lucide-react';
import api from '../api/axios';
import Card from '../components/ui/Card';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import ExportDropdown from '../components/ui/ExportDropdown';

// Route → API endpoint map (used by the load function)
const TABS = [
  { key: 'summary', label: 'Overview', endpoint: null },
  { key: 'stock_balance', label: 'Stock Balance Sheet', endpoint: '/reports/stock-balance' },
  { key: 'inventory_count', label: 'Inventory Count', endpoint: null },
  { key: 'daily', label: 'Daily Report', endpoint: '/reports/daily' },
  { key: 'cash_grv', label: 'Cash GRV', endpoint: '/reports/cash-grv' },
  { key: 'credit_grv', label: 'Credit GRV', endpoint: '/reports/credit-grv' },
  { key: 'fresh_bazaar', label: 'Fresh Bazaar', endpoint: '/reports/fresh-bazaar' },
  { key: 'pos_adjustment', label: '+ve Adjustment', endpoint: '/reports/pos-adjustment' },
  { key: 'disposal', label: 'Goods Disposal', endpoint: '/reports/disposal' },
  { key: 'neg_adjustment', label: '−ve Adjustment', endpoint: '/reports/neg-adjustment' },
  { key: 'stock', label: 'Stock Levels', endpoint: '/reports/stock-levels' },
  { key: 'purchases', label: 'Purchases', endpoint: '/reports/purchases' },
];


const VOUCHER_LABELS = {
  cash_grv: 'Cash GRV',
  credit_grv: 'Credit GRV',
  disposal: 'Goods Disposal',
  neg_adjustment: '−ve Adjustment',
  pos_adjustment: '+ve Adjustment',
  fresh_bazaar: 'Fresh Bazaar',
  sales_import: 'Imported POS Sale',
  pos_sale: 'Baba Roti POS Sale',
  manual_sale: 'Manual Sale',
};

const todayStr = () => new Date().toISOString().slice(0, 10);

const startOfMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const startOfWeekStr = () => {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().slice(0, 10);
};

// ── Reusable stat card ────────────────────────────────────────────────
const Stat = ({ label, value, sub, color = 'text-ink-900', badge = null }) => (
  <Card>
    <div className="flex items-center justify-between">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      {badge && <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-ink-100 text-ink-600">{badge}</span>}
    </div>
    <p className={`tabular mt-1 text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="mt-0.5 text-xs text-ink-400">{sub}</p>}
  </Card>
);

// ── Voucher transactions table (shared by all voucher tabs) ───────────
const VoucherTable = ({ data, showSupplier = false, showReason = false }) => {
  const cols = [
    { key: 'date', header: 'Date', render: r => new Date(r.date).toLocaleString() },
    { key: 'voucherNo', header: 'Voucher No', render: r => <span className="font-mono text-xs">{r.voucherNo || '—'}</span> },
    ...(showSupplier ? [{ key: 'supplier', header: 'Supplier', render: r => r.supplier?.name || '—' }] : []),
    ...(showReason ? [{ key: 'reason', header: 'Reason', render: r => r.reason || '—' }] : []),
    {
      key: 'items', header: 'Items',
      render: r => {
        const lines = r.items?.length
          ? r.items.map(i => `${i.material?.name ?? '—'} ×${i.quantity}`)
          : [`${r.material?.name ?? '—'} ×${r.quantity ?? ''}`];
        return <span className="text-xs text-ink-600">{lines.join(' · ')}</span>;
      },
    },
    { key: 'totalAmount', header: 'Total (ETB)', render: r => <span className="tabular font-medium">ETB {(r.totalAmount || 0).toFixed(2)}</span> },
    { key: 'performedBy', header: 'By', render: r => r.performedBy?.name || '—' },
  ];
  return <DataTable columns={cols} data={data} emptyMessage="No records in this period." title="Transaction History" icon={<History size={15} />} />;
};

// ── Material breakdown table ──────────────────────────────────────────
const MaterialBreakdown = ({ data }) => (
  <DataTable
    columns={[
      { key: 'name', header: 'Material' },
      { key: 'totalQty', header: 'Total Qty', render: r => <span className="tabular">{r.totalQty?.toFixed(3)}</span> },
      { key: 'totalCost', header: 'Total Cost (ETB)', render: r => <span className="tabular font-medium">ETB {(r.totalCost || 0).toFixed(2)}</span> },
    ]}
    data={data}
    emptyMessage="No breakdown available."
  />
);

// ════════════════════════════════════════════════════════════════════
// InventoryCount standalone component
// ════════════════════════════════════════════════════════════════════
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function InventoryCountPanel() {
  const now = new Date();
  const [stores, setStores] = useState([]);
  const [counts, setCounts] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterStore, setFilterStore] = useState('all');

  // New count init form
  const [showInitForm, setShowInitForm] = useState(false);
  const [initStore, setInitStore] = useState('');
  const [initYear, setInitYear] = useState(now.getFullYear());
  const [initMonth, setInitMonth] = useState(now.getMonth() + 1);
  const [initNotes, setInitNotes] = useState('');
  const [initLoading, setInitLoading] = useState(false);
  const [initError, setInitError] = useState('');

  // Active count editor
  const [activeCount, setActiveCount] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [expandedStores, setExpandedStores] = useState({});
  const [showUncounted, setShowUncounted] = useState(true);
  const [searchQ, setSearchQ] = useState('');

  // local edits buffer: materialId → physicalCount value
  const [edits, setEdits] = useState({});

  // ── Load stores ───────────────────────────────────────────────────
  useEffect(() => {
    api.get('/inventory-count/stores')
      .then(r => {
        const list = (r.data.stores && r.data.stores.length > 0)
          ? r.data.stores
          : ['Main Store', 'Kitchen Store', 'Bar Store', 'Pastry & Bakery Store'];
        setStores(list);
        if (list.length) setInitStore(list[0]);
      })
      .catch(() => {
        const fallback = ['Main Store', 'Kitchen Store', 'Bar Store', 'Pastry & Bakery Store'];
        setStores(fallback);
        setInitStore(fallback[0]);
      });
  }, []);

  // ── Load count list ────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const params = { year: filterYear, month: filterMonth };
      if (filterStore !== 'all') params.store = filterStore;
      const r = await api.get('/inventory-count', { params });
      setCounts(r.data.counts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  }, [filterYear, filterMonth, filterStore]);

  useEffect(() => { loadList(); }, [loadList]);

  // ── Initialize a new count ─────────────────────────────────────────
  const handleInit = async () => {
    if (!initStore) return;
    setInitLoading(true);
    setInitError('');
    try {
      const r = await api.post('/inventory-count/initialize', {
        periodYear: initYear,
        periodMonth: initMonth,
        storeLocation: initStore,
        notes: initNotes,
      });
      setShowInitForm(false);
      setInitNotes('');
      await loadList();
      openEditor(r.data.count._id);
    } catch (e) {
      setInitError(e.response?.data?.message || 'Failed to initialize count');
    } finally {
      setInitLoading(false);
    }
  };

  // ── Open editor for a count ────────────────────────────────────────
  const openEditor = async (id) => {
    setEditorLoading(true);
    setEdits({});
    setSaveError('');
    try {
      const r = await api.get(`/inventory-count/${id}`);
      setActiveCount(r.data.count);
      // Auto-expand all stores
      setExpandedStores({ [r.data.count.storeLocation]: true });
    } catch (e) {
      console.error(e);
    } finally {
      setEditorLoading(false);
    }
  };

  // ── Save physical count edits ──────────────────────────────────────
  const saveEdits = async () => {
    if (!activeCount) return;
    setSaving(true);
    setSaveError('');
    try {
      const lines = Object.entries(edits).map(([material, physicalCount]) => ({
        material,
        physicalCount: physicalCount === '' ? null : Number(physicalCount),
      }));
      if (!lines.length) { setSaving(false); return; }
      const r = await api.patch(`/inventory-count/${activeCount._id}/lines`, { lines });
      setActiveCount(r.data.count);
      setEdits({});
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  // ── Sync with live stock & vouchers ───────────────────────────────
  const handleSync = async () => {
    if (!activeCount) return;
    setSyncing(true);
    setSaveError('');
    try {
      const r = await api.post(`/inventory-count/${activeCount._id}/sync`);
      setActiveCount(r.data.count);
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  // ── Submit / Approve ───────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!activeCount) return;
    // Auto-save first
    if (Object.keys(edits).length) await saveEdits();
    try {
      const r = await api.post(`/inventory-count/${activeCount._id}/submit`);
      setActiveCount(r.data.count);
      await loadList();
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Submit failed');
    }
  };

  const handleApprove = async () => {
    if (!activeCount) return;
    if (!window.confirm(`Are you sure you want to approve and close ${activeCount.title}?\n\n• Physical counted quantities will be applied directly to Raw Material current stock.\n• Audit reconciliation vouchers will be generated for variances.\n• This month-end count will be permanently locked and cannot be edited backwards.`)) return;
    try {
      const r = await api.post(`/inventory-count/${activeCount._id}/approve`);
      setActiveCount(r.data.count);
      alert(r.data.message || 'Count approved! Raw material balances updated successfully to physical counts.');
      await loadList();
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Approval failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this draft count?')) return;
    try {
      await api.delete(`/inventory-count/${id}`);
      if (activeCount?._id === id) setActiveCount(null);
      await loadList();
    } catch (e) {
      alert(e.response?.data?.message || 'Delete failed');
    }
  };

  const isEditable = activeCount && (activeCount.status === 'draft' || activeCount.status === 'submitted');
  const canApprove = activeCount?.status === 'submitted';
  const isLocked = activeCount && (activeCount.status === 'approved' || activeCount.status === 'closed');

  // ── Filter lines ──────────────────────────────────────────────────
  const filteredLines = useMemo(() => {
    if (!activeCount) return [];
    return activeCount.lines.filter(line => {
      if (searchQ && !line.materialName.toLowerCase().includes(searchQ.toLowerCase())) return false;
      if (!showUncounted && !line.isCounted) return false;
      return true;
    });
  }, [activeCount, searchQ, showUncounted]);

  const counted = activeCount?.lines.filter(l => l.isCounted).length || 0;
  const total = activeCount?.lines.length || 0;
  const progress = total > 0 ? Math.round((counted / total) * 100) : 0;

  const statusColors = {
    draft: 'bg-amber-100 text-amber-800',
    submitted: 'bg-blue-100 text-blue-800',
    approved: 'bg-emerald-100 text-emerald-800',
    closed: 'bg-ink-100 text-ink-600',
  };

  // ════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-5">

      {/* ── Header toolbar ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Year */}
          <div className="flex items-center gap-1.5 bg-white border border-ink-200 rounded-xl px-3 py-1.5 shadow-xs">
            <ChevronLeft
              size={15}
              className="cursor-pointer text-ink-500 hover:text-blue-700 transition"
              onClick={() => setFilterYear(y => y - 1)}
            />
            <span className="text-xs font-bold text-ink-800 min-w-[42px] text-center">{filterYear}</span>
            <ChevronRight
              size={15}
              className="cursor-pointer text-ink-500 hover:text-blue-700 transition"
              onClick={() => setFilterYear(y => y + 1)}
            />
          </div>
          {/* Month */}
          <select
            value={filterMonth}
            onChange={e => setFilterMonth(Number(e.target.value))}
            className="text-xs font-semibold border border-ink-200 rounded-xl px-3 py-1.5 bg-white text-ink-800 outline-none focus:border-blue-500 cursor-pointer shadow-xs"
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
          {/* Store filter */}
          <select
            value={filterStore}
            onChange={e => setFilterStore(e.target.value)}
            className="text-xs font-semibold border border-ink-200 rounded-xl px-3 py-1.5 bg-white text-ink-800 outline-none focus:border-blue-500 cursor-pointer shadow-xs"
          >
            <option value="all">All Stores</option>
            {stores.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={() => {
            setShowInitForm(true);
            if (!initStore) {
              setInitStore(stores[0] || 'Main Store');
            }
          }}
          className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-xs font-bold shadow transition"
        >
          <Plus size={15} /> New Count Sheet
        </button>
      </div>

      {/* ── Init Form Modal ─────────────────────────────────────── */}
      {showInitForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-blue-700" /> Initialize Inventory Count
              </h3>
              <button onClick={() => { setShowInitForm(false); setInitError(''); }} className="text-ink-400 hover:text-red-500 transition">
                <X size={18} />
              </button>
            </div>

            {initError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-3 py-2 text-xs">
                <AlertTriangle size={14} /> {initError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-600">Store Location</label>
                <select
                  value={initStore || (stores[0] || 'Main Store')}
                  onChange={e => setInitStore(e.target.value)}
                  className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs font-medium text-ink-900 outline-none focus:border-blue-500"
                >
                  {(stores.length > 0 ? stores : ['Main Store', 'Kitchen Store', 'Bar Store', 'Pastry & Bakery Store']).map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-600">Month</label>
                <select
                  value={initMonth}
                  onChange={e => setInitMonth(Number(e.target.value))}
                  className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs font-medium text-ink-900 outline-none focus:border-blue-500"
                >
                  {MONTH_NAMES.map((m, i) => {
                    const isFuture = initYear === now.getFullYear() && (i + 1) > (now.getMonth() + 1);
                    return (
                      <option key={m} value={i + 1} disabled={isFuture}>
                        {m} {isFuture ? '(Future)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-ink-600">Year</label>
                <input
                  type="number"
                  value={initYear}
                  onChange={e => setInitYear(Number(e.target.value))}
                  min="2020" max="2050"
                  className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs font-medium text-ink-900 outline-none focus:border-blue-500"
                />
              </div>
              <div className="space-y-1 col-span-2">
                <label className="text-xs font-semibold text-ink-600">Notes (optional)</label>
                <textarea
                  value={initNotes}
                  onChange={e => setInitNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-900 outline-none focus:border-blue-500 resize-none"
                  placeholder="e.g. Month-end physical stock audit..."
                />
              </div>

              {/* Month-End Closing Rules Banner */}
              <div className="col-span-2 rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-800 space-y-1">
                <p className="font-bold flex items-center gap-1.5 text-blue-900">
                  <ShieldCheck size={14} className="text-blue-700 shrink-0" /> Month-End Closing Rules
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                  <li>Upon approval, <strong>Raw Material stock balances will automatically update</strong> to your counted quantities.</li>
                  <li>Discrepancies automatically generate reconciliation audit adjustment vouchers.</li>
                  <li>Once approved, this month is locked and cannot be edited backwards.</li>
                </ul>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowInitForm(false); setInitError(''); }}
                className="px-4 py-2 rounded-xl border border-ink-200 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInit}
                disabled={initLoading || !(initStore || stores[0])}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow transition disabled:opacity-60"
              >
                {initLoading ? 'Initializing…' : 'Initialize & Open'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Count List (session cards) ──────────────────────────── */}
      {!activeCount && (
        <div className="space-y-3">
          {loadingList && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={24} className="animate-spin text-blue-600" />
            </div>
          )}
          {!loadingList && counts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-20 text-ink-400">
              <PackageSearch size={48} className="text-ink-200" />
              <p className="text-sm font-medium">No count sheets for this period.</p>
              <p className="text-xs">Click &ldquo;New Count Sheet&rdquo; to begin.</p>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {counts.map(c => (
              <div
                key={c._id}
                className="group bg-white rounded-2xl border border-ink-100 shadow-sm hover:shadow-md transition p-4 space-y-3 cursor-pointer"
                onClick={() => openEditor(c._id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                      <Store size={18} className="text-blue-700" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-ink-900 leading-tight">{c.storeLocation}</p>
                      <p className="text-[10px] text-ink-500">{MONTH_NAMES[c.periodMonth - 1]} {c.periodYear}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[c.status]}`}>
                    {c.status}
                  </span>
                </div>
                {/* Progress */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-ink-500">
                    <span>{c.countedItems}/{c.totalItems} counted</span>
                    <span>{c.totalItems > 0 ? Math.round((c.countedItems / c.totalItems) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full transition-all"
                      style={{ width: `${c.totalItems > 0 ? (c.countedItems / c.totalItems) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                {/* Variance summary */}
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-emerald-700">
                    <TrendingUp size={10} /> +ETB {(c.positiveVariance || 0).toFixed(0)}
                  </span>
                  <span className="flex items-center gap-1 text-red-600">
                    <TrendingDown size={10} /> ETB {(c.negativeVariance || 0).toFixed(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-ink-100">
                  <button
                    className="text-[10px] text-blue-700 font-bold flex items-center gap-1 group-hover:underline"
                    onClick={() => openEditor(c._id)}
                  >
                    <Eye size={12} /> Open
                  </button>
                  {c.status === 'draft' && (
                    <button
                      className="text-[10px] text-red-500 font-semibold flex items-center gap-1 hover:text-red-700"
                      onClick={e => { e.stopPropagation(); handleDelete(c._id); }}
                    >
                      <Trash2 size={11} /> Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Editor loading ─────────────────────────────────────── */}
      {editorLoading && (
        <div className="flex items-center justify-center py-24">
          <RefreshCw size={28} className="animate-spin text-blue-600" />
        </div>
      )}

      {/* ── EDITOR ─────────────────────────────────────────────── */}
      {activeCount && !editorLoading && (
        <div className="space-y-4">

          {/* ── Editor top bar ── */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setActiveCount(null); setEdits({}); loadList(); }}
                className="flex items-center gap-1.5 text-xs text-ink-500 hover:text-blue-700 font-semibold transition"
              >
                <ChevronLeft size={15} /> Back to List
              </button>
              <span className="text-ink-300">|</span>
              <div className="flex items-center gap-2">
                <Store size={15} className="text-blue-700" />
                <span className="text-sm font-bold text-ink-900">{activeCount.title}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[activeCount.status]}`}>
                  {activeCount.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isEditable && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  title="Recalculate balances and average unit costs from current system stock and vouchers"
                  className="flex items-center gap-1.5 bg-ink-100 hover:bg-ink-200 text-ink-700 px-3 py-1.5 rounded-xl text-xs font-semibold border border-ink-200 transition disabled:opacity-60"
                >
                  <RefreshCw size={13} className={syncing ? 'animate-spin text-blue-600' : ''} />
                  {syncing ? 'Syncing…' : 'Sync Stock'}
                </button>
              )}
              {isEditable && Object.keys(edits).length > 0 && (
                <button
                  onClick={saveEdits}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow transition"
                >
                  <Save size={13} /> {saving ? 'Saving…' : `Save (${Object.keys(edits).length})`}
                </button>
              )}
              {activeCount.status === 'draft' && (
                <button
                  onClick={handleSubmit}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow transition"
                >
                  <Send size={13} /> Submit for Approval
                </button>
              )}
              {canApprove && (
                <button
                  onClick={handleApprove}
                  className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow transition"
                >
                  <ShieldCheck size={13} /> Approve & Close
                </button>
              )}
            </div>
          </div>

          {saveError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-2 text-xs">
              <AlertTriangle size={14} /> {saveError}
            </div>
          )}

          {/* ── Summary KPI cards ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-ink-100 shadow-xs p-4">
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">Progress</p>
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-bold text-blue-700">{counted}/{total}</span>
                  <span className="text-ink-500">{progress}%</span>
                </div>
                <div className="h-2 bg-ink-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${progress}%`, background: progress === 100 ? '#16a34a' : '#2563eb' }}
                  />
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-xs p-4">
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">+ve Variance</p>
              <p className="mt-1 text-lg font-black text-emerald-600">ETB {(activeCount.positiveVariance || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-xs p-4">
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">−ve Variance</p>
              <p className="mt-1 text-lg font-black text-red-600">ETB {(activeCount.negativeVariance || 0).toFixed(2)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-ink-100 shadow-xs p-4">
              <p className="text-[10px] font-semibold text-ink-500 uppercase tracking-wide">Net Variance</p>
              <p className={`mt-1 text-lg font-black ${(activeCount.netVarianceValue || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                ETB {(activeCount.netVarianceValue || 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* ── Search & filter bar ── */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-white border border-ink-200 rounded-xl px-3 py-1.5 flex-1 min-w-[180px]">
              <Search size={13} className="text-ink-400" />
              <input
                type="text"
                placeholder="Search material…"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                className="flex-1 text-xs outline-none text-ink-900 bg-transparent"
              />
              {searchQ && <button onClick={() => setSearchQ('')}><X size={12} className="text-ink-400 hover:text-ink-700" /></button>}
            </div>
            <button
              onClick={() => setShowUncounted(v => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${showUncounted
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-white border-ink-200 text-ink-600'
                }`}
            >
              {showUncounted ? <Eye size={13} /> : <EyeOff size={13} />}
              {showUncounted ? 'Showing All' : 'Counted Only'}
            </button>
          </div>

          {/* ── Count Table ── */}
          <div className="bg-white rounded-2xl border border-ink-100 shadow-sm overflow-hidden">
            {/* Store header */}
            <div
              className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-blue-700 to-blue-900 cursor-pointer"
              onClick={() => setExpandedStores(p => ({ ...p, [activeCount.storeLocation]: !p[activeCount.storeLocation] }))}
            >
              <div className="flex items-center gap-3">
                <Store size={16} className="text-white/80" />
                <span className="text-sm font-bold text-white">{activeCount.storeLocation}</span>
                <span className="text-xs text-blue-200">{MONTH_NAMES[activeCount.periodMonth - 1]} {activeCount.periodYear}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-white/70">{counted}/{total} counted</span>
                {expandedStores[activeCount.storeLocation]
                  ? <ChevronUp size={16} className="text-white" />
                  : <ChevronDown size={16} className="text-white" />
                }
              </div>
            </div>

            {expandedStores[activeCount.storeLocation] !== false && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-ink-50 text-ink-600">
                      <th className="text-left px-4 py-2.5 font-semibold">#</th>
                      <th className="text-left px-4 py-2.5 font-semibold">Material</th>
                      <th className="text-left px-3 py-2.5 font-semibold">Unit</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Begin Bal.</th>
                      <th className="text-right px-3 py-2.5 font-semibold">In</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Out</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Sys. Bal.</th>
                      <th className="text-right px-3 py-2.5 font-semibold bg-blue-50">Physical Count</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Variance</th>
                      <th className="text-right px-3 py-2.5 font-semibold">WAC (ETB)</th>
                      <th className="text-right px-3 py-2.5 font-semibold">Var. Value</th>
                      <th className="text-center px-3 py-2.5 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50">
                    {filteredLines.length === 0 && (
                      <tr>
                        <td colSpan={12} className="text-center py-10 text-ink-400">No items found.</td>
                      </tr>
                    )}
                    {filteredLines.map((line, idx) => {
                      const editVal = edits[line.material];
                      const displayCount = editVal !== undefined ? editVal : (line.physicalCount !== null ? line.physicalCount : '');
                      const variance = line.isCounted ? line.variance : (editVal !== undefined && editVal !== '' ? Number(editVal) - line.systemBalance : null);
                      const isPos = variance > 0;
                      const isNeg = variance < 0;

                      return (
                        <tr
                          key={line.material}
                          className={`hover:bg-blue-50/40 transition-colors ${!line.isCounted && editVal === undefined ? 'bg-amber-50/30' : ''
                            }`}
                        >
                          <td className="px-4 py-2.5 text-ink-400">{idx + 1}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-semibold text-ink-900">{line.materialName}</span>
                          </td>
                          <td className="px-3 py-2.5 text-ink-500">{line.unit}</td>
                          <td className="px-3 py-2.5 text-right tabular text-ink-700">{(line.beginBalance || 0).toFixed(3)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-emerald-700 font-medium">{(line.inQty || 0).toFixed(3)}</td>
                          <td className="px-3 py-2.5 text-right tabular text-red-600 font-medium">{(line.outQty || 0).toFixed(3)}</td>
                          <td className="px-3 py-2.5 text-right tabular font-bold text-ink-900">{(line.systemBalance || 0).toFixed(3)}</td>
                          <td className="px-3 py-2.5 text-right bg-blue-50/50">
                            {isLocked ? (
                              <span className="tabular font-bold text-blue-900">{line.physicalCount?.toFixed(3) ?? '—'}</span>
                            ) : (
                              <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={displayCount}
                                onChange={e => setEdits(prev => ({ ...prev, [line.material]: e.target.value }))}
                                onBlur={e => {
                                  if (e.target.value !== '' && e.target.value !== String(line.physicalCount)) {
                                    // keep in buffer, save on explicit save
                                  }
                                }}
                                className="w-24 text-right bg-white border border-blue-200 rounded-lg px-2 py-1 text-xs font-bold text-blue-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200 tabular"
                                placeholder="Enter qty"
                              />
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular">
                            {variance !== null ? (
                              <span className={`font-bold flex items-center justify-end gap-1 ${isPos ? 'text-emerald-600' : isNeg ? 'text-red-600' : 'text-ink-500'
                                }`}>
                                {isPos && <TrendingUp size={11} />}
                                {isNeg && <TrendingDown size={11} />}
                                {!isPos && !isNeg && <Minus size={11} />}
                                {variance.toFixed(3)}
                              </span>
                            ) : <span className="text-ink-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular text-ink-700">{(line.wac || 0).toFixed(2)}</td>
                          <td className="px-3 py-2.5 text-right tabular">
                            {line.varianceValue !== 0 ? (
                              <span className={`font-semibold ${line.varianceValue > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                ETB {line.varianceValue.toFixed(2)}
                              </span>
                            ) : <span className="text-ink-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {line.isCounted ? (
                              <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <CheckCircle size={9} /> Counted
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                <Clock size={9} /> Pending
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ── Closing info (if approved) ── */}
          {isLocked && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck size={20} className="text-emerald-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-bold text-emerald-800">Count Approved & Closed</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Approved by {activeCount.approvedBy?.name || 'admin'} on{' '}
                  {activeCount.approvedAt ? new Date(activeCount.approvedAt).toLocaleString() : '—'}.
                  Closing balance locked.
                </p>
              </div>
            </div>
          )}

          {/* ── Uncounted summary ── */}
          {activeCount.status !== 'approved' && activeCount.status !== 'closed' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle size={18} className="text-amber-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-amber-800">
                  {activeCount.uncountedItems || 0} item{(activeCount.uncountedItems || 0) !== 1 ? 's' : ''} not yet counted
                </p>
                <p className="text-[10px] text-amber-700 mt-0.5">
                  Uncounted items will use system balance as physical count upon approval.
                </p>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────
export default function Reports({ defaultTab } = {}) {
  const [tab, setTab] = useState(defaultTab || 'stock_balance');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hotelName, setHotelName] = useState('Baba Roti  Café');

  // Filter & Search states
  const currentYearMonthStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };

  const [date, setDate] = useState(todayStr());
  const [selectedMonth, setSelectedMonth] = useState(currentYearMonthStr());
  const [from, setFrom] = useState(startOfMonthStr());
  const [to, setTo] = useState(todayStr());
  const [activePreset, setActivePreset] = useState('month');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [stockSearch, setStockSearch] = useState('');

  // Stock Balance view mode: 'detail' (detailed table) vs 'monthly_summary' (12-month evolution)
  const [balanceViewMode, setBalanceViewMode] = useState('detail');
  const [monthlyClosingData, setMonthlyClosingData] = useState(null);
  const [monthlyClosingLoading, setMonthlyClosingLoading] = useState(false);
  const [summaryYear, setSummaryYear] = useState(new Date().getFullYear());

  // Item Ledger (Bin Card) modal state
  const [selectedLedgerMaterial, setSelectedLedgerMaterial] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState(null);

  // Sync tab when navigated via sidebar
  useEffect(() => {
    if (defaultTab) {
      setTab(defaultTab);
      setData(null);
      if (defaultTab === 'stock_balance' && !from) {
        setFrom(startOfMonthStr());
        setTo(todayStr());
      }
    }
  }, [defaultTab]);

  // Load hotel name for print header
  useEffect(() => {
    api.get('/settings').then(res => {
      if (res.data?.hotelName) setHotelName(res.data.hotelName);
    }).catch(() => { });
  }, []);

  const currentTab = TABS.find(t => t.key === tab) || TABS[1];

  const load = useCallback(async () => {
    if (!currentTab?.endpoint) {
      setLoading(true);
      try {
        const params = {};
        if (from) params.from = from;
        if (to) params.to = to;
        const res = await api.get('/reports/summary', { params });
        setData(res.data);
      } finally { setLoading(false); }
      return;
    }

    setLoading(true);
    setData(null);
    try {
      let params = {};
      if (tab === 'daily') {
        params = { date };
      } else if (tab === 'stock') {
        // current static stock levels
      } else if (tab === 'stock_balance') {
        if (from) params.from = from;
        if (to) params.to = to;
        if (selectedCategory && selectedCategory !== 'all') params.category = selectedCategory;
        if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;
        if (stockSearch.trim()) params.search = stockSearch.trim();
      } else {
        params = { from, to };
      }
      const res = await api.get(currentTab.endpoint, { params });
      setData(res.data);
    } finally { setLoading(false); }
  }, [tab, date, from, to, selectedCategory, selectedStatus, stockSearch, currentTab]);

  useEffect(() => {
    load();
  }, [load]);

  // Set exact calendar month range
  const setMonthRange = (ymStr) => {
    setSelectedMonth(ymStr);
    const [y, m] = ymStr.split('-').map(Number);
    const firstDay = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDate = new Date(y, m, 0).getDate();
    const lastDay = `${y}-${String(m).padStart(2, '0')}-${String(lastDate).padStart(2, '0')}`;
    setFrom(firstDay);
    setTo(lastDay);
    setActivePreset('month');
  };

  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    setMonthRange(prevYm);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextYm = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    setMonthRange(nextYm);
  };

  // Handler for quick date presets
  const applyPreset = (preset) => {
    setActivePreset(preset);
    if (preset === 'today') {
      setFrom(todayStr());
      setTo(todayStr());
    } else if (preset === 'week') {
      setFrom(startOfWeekStr());
      setTo(todayStr());
    } else if (preset === 'month') {
      const ym = currentYearMonthStr();
      setMonthRange(ym);
    } else if (preset === 'last_month') {
      const d = new Date();
      const prevDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
      setMonthRange(prevYm);
    } else if (preset === 'all') {
      setFrom('');
      setTo('');
    }
  };

  // Load 12-Month Closing Evolution
  const loadMonthlyClosing = useCallback(async (yr) => {
    setMonthlyClosingLoading(true);
    try {
      const res = await api.get('/reports/monthly-closing', { params: { year: yr || summaryYear } });
      setMonthlyClosingData(res.data);
    } catch (e) {
      console.error('Failed to load monthly closing report', e);
    } finally {
      setMonthlyClosingLoading(false);
    }
  }, [summaryYear]);

  useEffect(() => {
    if (tab === 'stock_balance' && balanceViewMode === 'monthly_summary') {
      loadMonthlyClosing(summaryYear);
    }
  }, [tab, balanceViewMode, summaryYear, loadMonthlyClosing]);

  // Open Item Ledger Modal
  const openItemLedger = async (material) => {
    setSelectedLedgerMaterial(material);
    setLedgerLoading(true);
    setLedgerData(null);
    try {
      const res = await api.get(`/reports/stock-balance/ledger/${material._id}`, {
        params: {
          from: from || undefined,
          to: to || undefined,
        },
      });
      setLedgerData(res.data);
    } catch (err) {
      console.error('Failed to load item ledger', err);
    } finally {
      setLedgerLoading(false);
    }
  };

  const printDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Build flat export data from whatever is currently loaded
  const exportData = useMemo(() => {
    if (!data) return [];
    if (tab === 'stock_balance' && data.items) {
      return data.items.map(m => ({
        'Item Code': m.code || '—',
        'Material Name': m.name,
        'Category': m.category,
        'Unit': m.unit,
        'Opening Qty': m.openingStock,
        'Opening Val (ETB)': m.openingValue.toFixed(2),
        'Cash GRV In': m.cashGrvQty,
        'Credit GRV In': m.creditGrvQty,
        'Fresh Bazaar In': m.freshBazaarQty,
        '+ve Adj In': m.posAdjQty,
        'Total In Qty': m.totalInQty,
        'Total In (ETB)': m.totalInCost.toFixed(2),
        '−ve Adj Out': m.negAdjQty,
        'Disposal Out': m.disposalQty,
        'POS Sales Out': m.posSaleQty,
        'Import Sales Out': m.salesImportQty,
        'Manual Sales Out': m.manualSaleQty,
        'Total Out Qty': m.totalOutQty,
        'Total Out (ETB)': m.totalOutCost.toFixed(2),
        'Closing Balance': m.closingStock,
        'Unit Cost (ETB)': m.unitCost.toFixed(2),
        'Closing Val (ETB)': m.closingValue.toFixed(2),
        'Status': m.status.replace('_', ' ').toUpperCase(),
      }));
    }
    if (tab === 'stock' && data.materials) {
      return data.materials.map(m => ({
        'Material': m.name,
        'Category': m.category || '',
        'In Stock': `${m.currentStock} ${m.unit}`,
        'Reorder At': `${m.reorderLevel} ${m.unit}`,
        'Unit Cost (ETB)': Number(m.unitCost || 0).toFixed(2),
        'Value (ETB)': (m.currentStock * m.unitCost).toFixed(2),
        'Status': m.status,
      }));
    }
    if (tab === 'purchases' && data.purchases) {
      return data.purchases.map(p => ({
        'Date': new Date(p.purchaseDate).toLocaleDateString(),
        'Supplier': p.supplier?.name || '—',
        'Items': p.items?.length ?? 0,
        'Total (ETB)': Number(p.totalAmount || 0).toFixed(2),
        'Status': p.status,
      }));
    }
    const txns = data.transactions || [];
    return txns.map(t => ({
      'Date': new Date(t.date).toLocaleString(),
      'Voucher': t.voucherNo || '—',
      'Type': VOUCHER_LABELS[t.voucherType] || t.voucherType || '—',
      'Material': t.material?.name || t.items?.[0]?.material?.name || '—',
      'Qty': t.quantity ?? '',
      'Total (ETB)': Number(t.totalAmount || 0).toFixed(2),
      'By': t.performedBy?.name || '—',
    }));
  }, [data, tab]);

  return (
    <div id="print-area" className="space-y-4">

      {/* ── Print-only header ── */}
      <div id="print-header" style={{ display: 'none' }}>
        <h1>{hotelName}</h1>
        <p>{currentTab?.label ?? 'Report'} &mdash; Printed on {printDate}</p>
        {from && to && <p>Period: {from} to {to}</p>}
      </div>

      {/* ── Page heading (from sidebar nav) ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 flex items-center gap-2">
            {tab === 'stock_balance' && <Scale className="h-6 w-6 text-emerald-600" />}
            {currentTab?.label ?? 'Reports'}
          </h1>
          <p className="text-xs text-ink-500 mt-0.5">
            {tab === 'stock_balance'
              ? 'Complete Stock Balance & Movement Ledger — Opening + Received (Cash/Credit/Bazaar/PADJ) − Issued (Disposal/NADJ/Sales) = Closing'
              : 'Detailed inventory and transaction reports'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName={`report_${tab}`}
            sheetName={currentTab?.label || 'Report'}
            pdfTitle={currentTab?.label || 'Report'}
            pdfColumns={exportData[0]
              ? Object.keys(exportData[0]).map(k => ({ header: k, accessor: k }))
              : []
            }
          />
          <Button variant="ghost" className="border border-ink-200" onClick={() => window.print()}>
            <Printer size={15} /> Print
          </Button>
        </div>
      </div>

      {/* ── Filter bar for Stock Balance ── */}
      {tab === 'stock_balance' && (
        <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-soft space-y-3">
          {/* Top Toggle: Detailed Month Sheet vs 12-Month Evolution */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 pb-3">
            <div className="flex items-center gap-1.5 p-1 bg-ink-100 rounded-xl">
              <button
                type="button"
                onClick={() => setBalanceViewMode('detail')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${balanceViewMode === 'detail'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
                  }`}
              >
                <Scale size={14} /> Monthly Balance Sheet
              </button>
              <button
                type="button"
                onClick={() => { setBalanceViewMode('monthly_summary'); loadMonthlyClosing(summaryYear); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${balanceViewMode === 'monthly_summary'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-ink-600 hover:text-ink-900'
                  }`}
              >
                <Calendar size={14} /> 12-Month Closing Evolution
              </button>
            </div>

            {/* Quick Month Switcher Controls */}
            {balanceViewMode === 'detail' && (
              <div className="flex items-center gap-1.5 bg-ink-50 p-1 rounded-xl border border-ink-100">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  title="Previous Month"
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-white hover:text-ink-900 hover:shadow-2xs transition"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-1.5 px-2">
                  <Calendar size={14} className="text-emerald-600" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => { if (e.target.value) setMonthRange(e.target.value); }}
                    className="rounded-md border border-ink-200 bg-white px-2 py-0.5 text-xs font-bold text-ink-900 outline-none focus:border-emerald-500 cursor-pointer"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  title="Next Month"
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-white hover:text-ink-900 hover:shadow-2xs transition"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* Year Switcher for 12-Month Evolution */}
            {balanceViewMode === 'monthly_summary' && (
              <div className="flex items-center gap-2 bg-ink-50 p-1 rounded-xl border border-ink-100">
                <button
                  type="button"
                  onClick={() => { const y = summaryYear - 1; setSummaryYear(y); loadMonthlyClosing(y); }}
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-white hover:text-ink-900 transition"
                  title="Previous Year"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-black text-ink-900 px-2">Year {summaryYear}</span>
                <button
                  type="button"
                  onClick={() => { const y = summaryYear + 1; setSummaryYear(y); loadMonthlyClosing(y); }}
                  className="rounded-lg p-1.5 text-ink-600 hover:bg-white hover:text-ink-900 transition"
                  title="Next Year"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => loadMonthlyClosing(summaryYear)}
                  className="rounded-lg bg-white border border-ink-200 px-2 py-1 text-[11px] font-semibold text-ink-700 hover:bg-ink-100 transition ml-1"
                >
                  <RefreshCw size={12} className={monthlyClosingLoading ? 'animate-spin' : ''} />
                </button>
              </div>
            )}
          </div>

          {balanceViewMode === 'detail' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Date Preset Buttons */}
              <div className="flex items-center gap-1.5 p-1 bg-ink-50 rounded-xl border border-ink-100 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => applyPreset('month')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === 'month' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  This Month
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('last_month')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === 'last_month' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  Last Month
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('week')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === 'week' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('today')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === 'today' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset('all')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${activePreset === 'all' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  All Time
                </button>
              </div>

              {/* Custom Date Pickers */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <label className="flex items-center gap-1.5 text-ink-600 font-medium">
                  <span>From</span>
                  <input
                    type="date"
                    value={from}
                    onChange={e => { setFrom(e.target.value); setActivePreset('custom'); }}
                    className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 bg-white"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-ink-600 font-medium">
                  <span>To</span>
                  <input
                    type="date"
                    value={to}
                    onChange={e => { setTo(e.target.value); setActivePreset('custom'); }}
                    className="rounded-lg border border-ink-200 px-2.5 py-1.5 text-xs outline-none focus:border-emerald-500 bg-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => load()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink-100 hover:bg-ink-200 px-3 py-1.5 text-xs font-semibold text-ink-800 transition"
                  title="Refresh stock balance"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </div>
          )}

          {/* Secondary Filters: Search, Category, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-ink-50">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-ink-400" />
              <input
                type="text"
                placeholder="Search material code or name..."
                value={stockSearch}
                onChange={e => setStockSearch(e.target.value)}
                className="w-full rounded-xl border border-ink-200 pl-9 pr-3 py-2 text-xs outline-none focus:border-emerald-500"
              />
              {stockSearch && (
                <button
                  type="button"
                  onClick={() => setStockSearch('')}
                  className="absolute right-3 top-2.5 text-ink-400 hover:text-ink-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white"
              >
                <option value="all">All Categories</option>
                {data?.categories?.filter(c => c !== 'all').map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs outline-none focus:border-emerald-500 bg-white"
              >
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock (Adequate)</option>
                <option value="low_stock">Low Stock (At/Below Reorder)</option>
                <option value="out_of_stock">Out of Stock (Zero / Negative)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Standard Date filter bar for other tabs ── */}
      {tab !== 'stock_balance' && (
        <div className="flex flex-wrap items-center gap-3">
          {tab === 'daily' && (
            <label className="flex items-center gap-2 text-sm text-ink-500">
              Date
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
            </label>
          )}
          {tab !== 'daily' && tab !== 'stock' && (
            <>
              <label className="flex items-center gap-2 text-sm text-ink-500">
                From
                <input type="date" value={from} onChange={e => setFrom(e.target.value)}
                  className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-500">
                To
                <input type="date" value={to} onChange={e => setTo(e.target.value)}
                  className="rounded-lg border border-ink-200 px-3 py-1.5 text-sm outline-none focus:border-blue-500" />
              </label>
            </>
          )}
        </div>
      )}

      {loading && (
        <div className="py-16 text-center text-sm text-ink-400">
          <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-emerald-600" />
          Loading report data…
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STOCK BALANCE SHEET (ALL OVER RECONCILIATION)
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'stock_balance' && balanceViewMode === 'detail' && data && (
        <div className="space-y-4">
          {/* Monthly Stock Accounting Logic Banner */}
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/70 via-indigo-50/30 to-white p-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-blue-100 pb-2.5 mb-3">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-2xs">
                  ∑
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-blue-950">
                  Monthly Stock Equation &middot; {data.monthLabel || `${from} to ${to}`}
                </h4>
              </div>
              <span className="text-[11px] font-semibold text-blue-800 bg-blue-100/90 px-2.5 py-0.5 rounded-full border border-blue-200">
                Rule: Closing Stock (Month M) = Beginning Stock (Month M+1)
              </span>
            </div>

            {/* 4-Step Formula Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 items-center text-center">
              {/* Step 1: Beginning */}
              <div className="lg:col-span-2 rounded-xl bg-white border border-slate-200 p-2.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Beginning Stock (1st)</p>
                <p className="text-base font-black text-slate-900 tabular mt-0.5">
                  ETB {(data.totals?.openingValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10.5px] text-slate-500">Stock on hand at 00:00:00</p>
              </div>

              <div className="text-xl font-black text-emerald-600 hidden lg:block">+</div>

              {/* Step 2: Inward */}
              <div className="rounded-xl bg-white border border-emerald-200 p-2.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">2. Inward Receipts (+)</p>
                <p className="text-base font-black text-emerald-700 tabular mt-0.5">
                  +ETB {(data.totals?.inwardValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10.5px] text-emerald-600">GRVs + Bazaar + PADJ</p>
              </div>

              <div className="text-xl font-black text-rose-600 hidden lg:block">−</div>

              {/* Step 3: Outward */}
              <div className="rounded-xl bg-white border border-rose-200 p-2.5 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-rose-700">3. Outward Issued (−)</p>
                <p className="text-base font-black text-rose-700 tabular mt-0.5">
                  −ETB {(data.totals?.outwardValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10.5px] text-rose-600">Sales + Disposal + NADJ</p>
              </div>

              <div className="text-xl font-black text-blue-700 hidden lg:block">=</div>

              {/* Step 4: Closing */}
              <div className="lg:col-span-2 rounded-xl bg-blue-600 text-white p-2.5 shadow-xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">4. Closing Stock (=)</p>
                <p className="text-base font-black tabular mt-0.5 text-white">
                  ETB {(data.totals?.closingValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[10.5px] text-blue-100">Stock on hand at 23:59:59</p>
              </div>
            </div>
          </div>

          {/* Top KPI Balance Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-slate-400">
              <p className="text-xs font-medium text-ink-500">Opening Stock Value</p>
              <p className="tabular mt-1 text-2xl font-bold text-ink-800">
                ETB {(data.totals?.openingValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">Balance at {from || 'start of records'}</p>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-emerald-800">Total Goods Received (+)</p>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-bold">INWARD</span>
              </div>
              <p className="tabular mt-1 text-2xl font-bold text-emerald-700">
                + ETB {(data.totals?.inwardValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">Cash GRV + Credit GRV + Bazaar + PADJ</p>
            </Card>

            <Card className="border-l-4 border-l-rose-500 bg-rose-50/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-rose-800">Total Stock Issued / Out (−)</p>
                <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-bold">OUTWARD</span>
              </div>
              <p className="tabular mt-1 text-2xl font-bold text-rose-700">
                − ETB {(data.totals?.outwardValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-rose-600">Disposal + NADJ + Sales Deductions</p>
            </Card>

            <Card className="border-l-4 border-l-blue-600 bg-blue-50/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-blue-900">Closing Stock Balance (=)</p>
                <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">CLOSING ASSET</span>
              </div>
              <p className="tabular mt-1 text-2xl font-black text-blue-900">
                ETB {(data.totals?.closingValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-0.5 text-xs text-blue-700 font-medium">
                {data.count} items tracked &middot; As of {to || 'Today'}
              </p>
            </Card>
          </div>

          {/* Master Stock Balance Table */}
          <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-soft">
            <table className="min-w-full text-xs divide-y divide-ink-200">
              {/* Grouped Header Tier 1 */}
              <thead className="bg-ink-100/90 text-ink-700 font-bold">
                <tr>
                  <th colSpan={3} className="px-3 py-2 text-left border-r border-ink-200 uppercase tracking-wider text-[11px]">
                    Item Details
                  </th>
                  <th colSpan={2} className="px-3 py-2 text-center border-r border-ink-200 bg-slate-200/60 uppercase tracking-wider text-[11px] text-slate-800">
                    Opening Stock
                  </th>
                  <th colSpan={5} className="px-3 py-2 text-center border-r border-ink-200 bg-emerald-100/80 uppercase tracking-wider text-[11px] text-emerald-900">
                    Receipts / Inwards (+)
                  </th>
                  <th colSpan={6} className="px-3 py-2 text-center border-r border-ink-200 bg-rose-100/80 uppercase tracking-wider text-[11px] text-rose-900">
                    Issues / Outwards (−)
                  </th>
                  <th colSpan={4} className="px-3 py-2 text-center border-r border-ink-200 bg-blue-100/80 uppercase tracking-wider text-[11px] text-blue-900">
                    Closing Balance (=)
                  </th>
                  <th className="px-3 py-2 text-center uppercase tracking-wider text-[11px]">
                    Ledger
                  </th>
                </tr>
                {/* Header Tier 2 (Sub-columns) */}
                <tr className="bg-ink-50/90 text-ink-600 font-semibold border-t border-ink-200 text-[10.5px]">
                  <th className="px-3 py-2 text-left">Code</th>
                  <th className="px-3 py-2 text-left">Material Name</th>
                  <th className="px-3 py-2 text-left border-r border-ink-200">Unit</th>

                  {/* Opening */}
                  <th className="px-3 py-2 text-right bg-slate-50">Opening Qty</th>
                  <th className="px-3 py-2 text-right border-r border-ink-200 bg-slate-50">Opening Val (ETB)</th>

                  {/* Inwards */}
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">Cash GRV</th>
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">Credit GRV</th>
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">Bazaar</th>
                  <th className="px-2.5 py-2 text-right bg-emerald-50/50">+ve Adj</th>
                  <th className="px-3 py-2 text-right border-r border-ink-200 bg-emerald-100/70 font-bold text-emerald-900">Total In</th>

                  {/* Outwards */}
                  <th className="px-2.5 py-2 text-right bg-rose-50/50">−ve Adj</th>
                  <th className="px-2.5 py-2 text-right bg-rose-50/50">Disposal</th>
                  <th className="px-2.5 py-2 text-right bg-rose-50/50 text-cyan-800 font-bold" title="Baba Roti POS Direct Sales">POS Sales</th>
                  <th className="px-2.5 py-2 text-right bg-rose-50/50 text-purple-800 font-bold" title="External POS Imported Sales">Import Sales</th>
                  <th className="px-2.5 py-2 text-right bg-rose-50/50 text-indigo-800 font-bold" title="Manual Registered Sales">Manual Sales</th>
                  <th className="px-3 py-2 text-right border-r border-ink-200 bg-rose-100/70 font-bold text-rose-900">Total Out</th>

                  {/* Closing */}
                  <th className="px-3 py-2 text-right bg-blue-50/50 font-bold text-blue-900">Closing Qty</th>
                  <th className="px-2.5 py-2 text-right bg-blue-50/50">Unit Cost</th>
                  <th className="px-3 py-2 text-right bg-blue-100/70 font-black text-blue-950">Closing Val (ETB)</th>
                  <th className="px-3 py-2 text-center border-r border-ink-200 bg-blue-50/50">Status</th>

                  {/* Action */}
                  <th className="px-2 py-2 text-center">Bin Card</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-ink-100">
                {(!data.items || data.items.length === 0) && (
                  <tr>
                    <td colSpan={21} className="px-4 py-12 text-center text-ink-400">
                      No stock items matched the selected filters.
                    </td>
                  </tr>
                )}
                {data.items?.map((item) => (
                  <tr key={item._id} className="hover:bg-blue-50/30 transition-colors">
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-500 whitespace-nowrap">
                      {item.code || '—'}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-ink-900">
                      <div className="flex items-center gap-1.5">
                        <span>{item.name}</span>
                        <span className="text-[10px] text-ink-400 bg-ink-100 px-1.5 py-0.2 rounded font-normal">
                          {item.category}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap border-r border-ink-200 text-ink-500 text-[11px]">
                      {item.unit}
                    </td>

                    {/* Opening */}
                    <td className="px-3 py-2 text-right tabular text-slate-700 bg-slate-50/40">
                      {item.openingStock.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right tabular border-r border-ink-200 text-slate-700 bg-slate-50/40">
                      {item.openingValue.toFixed(2)}
                    </td>

                    {/* Inwards */}
                    <td className="px-2.5 py-2 text-right tabular text-emerald-700 bg-emerald-50/20">
                      {item.cashGrvQty > 0 ? `+${item.cashGrvQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-indigo-700 bg-emerald-50/20">
                      {item.creditGrvQty > 0 ? `+${item.creditGrvQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-lime-700 bg-emerald-50/20">
                      {item.freshBazaarQty > 0 ? `+${item.freshBazaarQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-violet-700 bg-emerald-50/20">
                      {item.posAdjQty > 0 ? `+${item.posAdjQty}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular border-r border-ink-200 font-bold text-emerald-800 bg-emerald-100/50">
                      {item.totalInQty > 0 ? `+${item.totalInQty.toLocaleString()}` : '0'}
                    </td>

                    {/* Outwards */}
                    <td className="px-2.5 py-2 text-right tabular text-red-600 bg-rose-50/20">
                      {item.negAdjQty > 0 ? `−${item.negAdjQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-orange-600 bg-rose-50/20">
                      {item.disposalQty > 0 ? `−${item.disposalQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-cyan-700 bg-rose-50/20 font-medium" title="Baba Roti POS Direct Sales">
                      {item.posSaleQty > 0 ? `−${item.posSaleQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-purple-600 bg-rose-50/20 font-medium" title="External POS Imported Sales">
                      {item.salesImportQty > 0 ? `−${item.salesImportQty}` : '—'}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-indigo-600 bg-rose-50/20 font-medium" title="Manual Registered Sales">
                      {item.manualSaleQty > 0 ? `−${item.manualSaleQty}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular border-r border-ink-200 font-bold text-rose-800 bg-rose-100/50">
                      {item.totalOutQty > 0 ? `−${item.totalOutQty.toLocaleString()}` : '0'}
                    </td>

                    {/* Closing */}
                    <td className="px-3 py-2 text-right tabular font-bold text-blue-900 bg-blue-50/30">
                      {item.closingStock.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right tabular text-ink-600 bg-blue-50/30 text-[11px]">
                      {item.unitCost.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right tabular font-black text-blue-950 bg-blue-100/60">
                      {item.closingValue.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center border-r border-ink-200 bg-blue-50/30">
                      {item.status === 'out_of_stock' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700">
                          OUT
                        </span>
                      ) : item.status === 'low_stock' ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                          LOW
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">
                          OK
                        </span>
                      )}
                    </td>

                    {/* Action: Open Bin Card */}
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openItemLedger(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-white border border-ink-200 text-ink-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 transition shadow-2xs"
                        title="View chronological Bin Card / Item Ledger"
                      >
                        <History size={12} /> Ledger
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Table Footer: Total Row */}
              {data.items?.length > 0 && (
                <tfoot className="bg-ink-100/90 font-bold border-t-2 border-ink-300 text-[11.5px]">
                  <tr>
                    <td colSpan={3} className="px-3 py-2.5 text-ink-900 border-r border-ink-200 font-extrabold uppercase">
                      Total ({data.count} items)
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-slate-800">
                      {data.items.reduce((s, i) => s + i.openingStock, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-slate-900 border-r border-ink-200 font-extrabold">
                      {(data.totals?.openingValue || 0).toFixed(2)}
                    </td>

                    <td colSpan={4} className="px-2 py-2.5 text-center text-emerald-800 text-[10.5px]">
                      Inward Total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-emerald-950 font-extrabold border-r border-ink-200 bg-emerald-100">
                      +{(data.totals?.inwardValue || 0).toFixed(2)}
                    </td>

                    <td colSpan={5} className="px-2 py-2.5 text-center text-rose-800 text-[10.5px]">
                      Outward Total
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-rose-950 font-extrabold border-r border-ink-200 bg-rose-100">
                      −{(data.totals?.outwardValue || 0).toFixed(2)}
                    </td>

                    <td className="px-3 py-2.5 text-right tabular text-blue-900 font-extrabold">
                      {data.items.reduce((s, i) => s + i.closingStock, 0).toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2.5 text-center text-ink-400">—</td>
                    <td className="px-3 py-2.5 text-right tabular text-blue-950 font-black bg-blue-100 border-r border-ink-200 text-sm">
                      {(data.totals?.closingValue || 0).toFixed(2)}
                    </td>
                    <td colSpan={2} className="px-2 py-2.5 text-center text-[10px] text-ink-500">
                      ETB
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          12-MONTH STOCK CLOSING EVOLUTION VIEW
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'stock_balance' && balanceViewMode === 'monthly_summary' && (
        <div className="space-y-4">
          {monthlyClosingLoading && (
            <div className="py-16 text-center text-sm text-ink-400">
              <RefreshCw className="animate-spin h-6 w-6 mx-auto mb-2 text-blue-600" />
              Calculating 12-month stock closing balances for {summaryYear}…
            </div>
          )}

          {!monthlyClosingLoading && monthlyClosingData && (
            <>
              {/* Annual Summary KPI Cards */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/20">
                  <p className="text-xs font-semibold text-emerald-800">Total Annual Receipts (Inward)</p>
                  <p className="tabular mt-1 text-2xl font-bold text-emerald-700">
                    + ETB {(monthlyClosingData.totalsForYear?.totalInward || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-600">All GRVs, Fresh Bazaar, +ve Count Adjustments</p>
                </Card>

                <Card className="border-l-4 border-l-rose-500 bg-rose-50/20">
                  <p className="text-xs font-semibold text-rose-800">Total Annual Issues (Outward)</p>
                  <p className="tabular mt-1 text-2xl font-bold text-rose-700">
                    − ETB {(monthlyClosingData.totalsForYear?.totalOutward || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-0.5 text-xs text-rose-600">POS Sales, Disposals, −ve Count Adjustments</p>
                </Card>

                <Card className="border-l-4 border-l-blue-600 bg-blue-50/30">
                  <p className="text-xs font-bold text-blue-900">Net Inventory Change ({summaryYear})</p>
                  <p className={`tabular mt-1 text-2xl font-black ${(monthlyClosingData.totalsForYear?.netChange || 0) >= 0 ? 'text-blue-900' : 'text-amber-700'}`}>
                    {(monthlyClosingData.totalsForYear?.netChange || 0) >= 0 ? '+' : ''}
                    ETB {(monthlyClosingData.totalsForYear?.netChange || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                  <p className="mt-0.5 text-xs text-blue-700 font-medium">Net Stock Value Shift across {summaryYear}</p>
                </Card>
              </div>

              {/* Monthly Table */}
              <div className="overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-soft">
                <div className="px-5 py-3 border-b border-ink-100 flex items-center justify-between bg-ink-50/50">
                  <div>
                    <h3 className="text-sm font-bold text-ink-900">
                      Monthly Stock Closing Reconciliation — Year {summaryYear}
                    </h3>
                    <p className="text-xs text-ink-500 mt-0.5">
                      Stock Logic: Beginning Stock + Inward Receipts − Outward Issues = Closing Stock. Closing Stock of Month M = Beginning Stock of Month M+1.
                    </p>
                  </div>
                  <span className="text-xs font-medium text-ink-500 bg-white px-2.5 py-1 rounded-lg border border-ink-200">
                    Current: <strong className="text-ink-800">{monthlyClosingData.currentMonth}</strong>
                  </span>
                </div>

                <table className="min-w-full text-xs divide-y divide-ink-200">
                  <thead className="bg-ink-100/90 text-ink-700 font-bold">
                    <tr>
                      <th className="px-4 py-2.5 text-left uppercase tracking-wider text-[11px]">Calendar Month</th>
                      <th className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px] bg-slate-200/60 text-slate-800">
                        Beginning Stock (1st)
                      </th>
                      <th className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px] bg-emerald-100/80 text-emerald-900">
                        Received Inward (+)
                      </th>
                      <th className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px] bg-rose-100/80 text-rose-900">
                        Issued Outward (−)
                      </th>
                      <th className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px] bg-amber-100/60 text-amber-900">
                        Net Change
                      </th>
                      <th className="px-3 py-2.5 text-right uppercase tracking-wider text-[11px] bg-blue-100/80 text-blue-900">
                        Closing Stock (End)
                      </th>
                      <th className="px-3 py-2.5 text-center uppercase tracking-wider text-[11px]">Status</th>
                      <th className="px-3 py-2.5 text-center uppercase tracking-wider text-[11px]">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {monthlyClosingData.months?.map((m) => (
                      <tr
                        key={m.month}
                        className={`transition-colors ${m.isCurrent
                            ? 'bg-blue-50/40 font-semibold'
                            : 'hover:bg-ink-50/50'
                          }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-ink-900">{m.monthName}</span>
                            {m.isCurrent && (
                              <span className="text-[10px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <span className="text-[10.5px] text-ink-400 font-mono">{m.month} &middot; {m.txnCount} movements</span>
                        </td>

                        {/* Beginning Stock */}
                        <td className="px-3 py-3 text-right tabular text-slate-800 bg-slate-50/40 font-medium">
                          ETB {m.beginningVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Inward */}
                        <td className="px-3 py-3 text-right tabular text-emerald-700 bg-emerald-50/20 font-medium">
                          +ETB {m.totalInwardVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Outward */}
                        <td className="px-3 py-3 text-right tabular text-rose-700 bg-rose-50/20 font-medium">
                          −ETB {m.totalOutwardVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Net Change */}
                        <td className={`px-3 py-3 text-right tabular font-bold ${m.netChangeVal >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {m.netChangeVal >= 0 ? '+' : ''}ETB {m.netChangeVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Closing Stock */}
                        <td className="px-3 py-3 text-right tabular text-blue-950 bg-blue-50/30 font-black text-sm">
                          ETB {m.closingVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Status */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {m.status === 'closed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                              <CheckCircle size={11} className="text-emerald-600" /> Closed
                            </span>
                          ) : m.status === 'in_progress' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              <Clock size={11} className="text-blue-600" /> In Progress
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-ink-100 text-ink-400">
                              Upcoming
                            </span>
                          )}
                        </td>

                        {/* Action: Open month detail */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setMonthRange(m.month);
                              setBalanceViewMode('detail');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                            title={`Inspect detailed stock balance for ${m.monthName}`}
                          >
                            <span>Inspect Sheet</span>
                            <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          ITEM LEDGER / BIN CARD MODAL
      ════════════════════════════════════════════════════════════════ */}
      {selectedLedgerMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4 bg-ink-50/70">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <History size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink-900 flex items-center gap-2">
                    <span>{selectedLedgerMaterial.name}</span>
                    <span className="font-mono text-xs font-normal text-ink-500 bg-ink-200/60 px-2 py-0.5 rounded">
                      {selectedLedgerMaterial.code || 'NO-CODE'}
                    </span>
                  </h3>
                  <p className="text-xs text-ink-500 mt-0.5">
                    Category: <span className="font-medium text-ink-700">{selectedLedgerMaterial.category}</span> &middot; Unit: <span className="font-medium text-ink-700">{selectedLedgerMaterial.unit}</span> &middot; Unit Cost: <span className="font-medium text-ink-700">ETB {Number(selectedLedgerMaterial.unitCost || 0).toFixed(2)}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLedgerMaterial(null)}
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {ledgerLoading && (
                <div className="py-12 text-center text-sm text-ink-400">
                  <RefreshCw className="animate-spin h-5 w-5 mx-auto mb-2 text-emerald-600" />
                  Loading chronological ledger records…
                </div>
              )}

              {!ledgerLoading && ledgerData && (
                <>
                  <div className="flex items-center justify-between text-xs text-ink-500 bg-ink-50 p-3 rounded-xl border border-ink-100">
                    <div>
                      Period: <span className="font-semibold text-ink-800">{from || 'Beginning'}</span> to <span className="font-semibold text-ink-800">{to || 'Today'}</span>
                    </div>
                    <div>
                      Total Movement Events: <span className="font-bold text-ink-900">{ledgerData.count}</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-ink-100 bg-white">
                    <table className="min-w-full text-xs divide-y divide-ink-100">
                      <thead className="bg-ink-50/70 font-semibold text-ink-600">
                        <tr>
                          <th className="px-3 py-2.5 text-left">Date & Time</th>
                          <th className="px-3 py-2.5 text-left">Voucher #</th>
                          <th className="px-3 py-2.5 text-left">Voucher Type</th>
                          <th className="px-3 py-2.5 text-left">Party / Reason</th>
                          <th className="px-3 py-2.5 text-right text-emerald-700">In (+)</th>
                          <th className="px-3 py-2.5 text-right text-rose-700">Out (−)</th>
                          <th className="px-3 py-2.5 text-right font-bold text-ink-900">Running Bal</th>
                          <th className="px-3 py-2.5 text-left">Handled By</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-50">
                        {ledgerData.ledger?.length === 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-8 text-center text-ink-400">
                              No movement history found for this item.
                            </td>
                          </tr>
                        )}
                        {ledgerData.ledger?.map((row, idx) => (
                          <tr key={idx} className="hover:bg-ink-50/50">
                            <td className="px-3 py-2 whitespace-nowrap text-ink-600">
                              {new Date(row.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="px-3 py-2 font-mono text-[11px] font-medium text-ink-800 whitespace-nowrap">
                              {row.voucherNo}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                row.voucherType === 'pos_sale'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : row.voucherType === 'manual_sale'
                                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                  : row.voucherType === 'sales_import'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : ['cash_grv', 'credit_grv', 'fresh_bazaar', 'pos_adjustment'].includes(row.voucherType)
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {VOUCHER_LABELS[row.voucherType] || row.voucherType}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-ink-600 max-w-[180px] truncate" title={row.supplier !== '—' ? row.supplier : row.reason}>
                              {row.supplier !== '—' ? row.supplier : row.reason}
                            </td>
                            <td className="px-3 py-2 text-right tabular font-semibold text-emerald-700 whitespace-nowrap">
                              {row.inQty > 0 ? `+${row.inQty}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular font-semibold text-rose-700 whitespace-nowrap">
                              {row.outQty > 0 ? `−${row.outQty}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right tabular font-bold text-ink-900 bg-ink-50/30 whitespace-nowrap">
                              {row.balanceAfter} {selectedLedgerMaterial.unit}
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-ink-500">
                              {row.performedBy}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end border-t border-ink-100 px-6 py-3 bg-ink-50">
              <Button variant="secondary" onClick={() => setSelectedLedgerMaterial(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SUMMARY (Overview)
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'summary' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {data.summary?.map(s => (
              <Stat
                key={s._id}
                label={VOUCHER_LABELS[s._id] ?? s._id}
                value={s.count}
                sub={`ETB ${(s.totalAmount || 0).toFixed(2)}`}
              />
            ))}
            {(!data.summary || data.summary.length === 0) && (
              <p className="col-span-6 text-center text-sm text-ink-400 py-6">No transactions in this period.</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          DAILY
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'daily' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Total stock IN" value={data.stockIn} color="text-emerald-700" />
            <Stat label="Total stock OUT" value={data.stockOut} color="text-red-700" />
            <Stat label="Purchases value" value={`ETB ${(data.purchaseTotal || 0).toFixed(2)}`} />
          </div>

          {/* Breakdown per voucher type */}
          {data.byVoucher && Object.keys(data.byVoucher).length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Object.entries(data.byVoucher).map(([vt, info]) => (
                <Card key={vt}>
                  <p className="text-xs font-semibold text-ink-500">{VOUCHER_LABELS[vt] ?? vt}</p>
                  <p className="tabular mt-1 text-xl font-bold text-ink-900">{info.count} voucher{info.count !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-ink-400">ETB {(info.totalAmount || 0).toFixed(2)}</p>
                </Card>
              ))}
            </div>
          )}

          <p className="text-sm font-semibold text-ink-600">All movements on {data.date}</p>
          <DataTable
            columns={[
              { key: 'date', header: 'Time', render: r => new Date(r.date).toLocaleTimeString() },
              { key: 'voucherType', header: 'Voucher', render: r => <span className="text-xs font-semibold">{VOUCHER_LABELS[r.voucherType] ?? r.voucherType ?? '—'}</span> },
              { key: 'voucherNo', header: 'Ref', render: r => <span className="font-mono text-xs">{r.voucherNo || '—'}</span> },
              { key: 'material', header: 'Material', render: r => r.material?.name ?? r.items?.[0]?.material?.name ?? '—' },
              { key: 'quantity', header: 'Qty', render: r => <span className="tabular">{r.quantity ?? ''} {r.material?.unit ?? ''}</span> },
              { key: 'type', header: 'Direction', render: r => <span className={r.type === 'in' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>{r.type === 'in' ? '↑ IN' : '↓ OUT'}</span> },
              { key: 'performedBy', header: 'By', render: r => r.performedBy?.name || '—' },
            ]}
            data={data.transactions}
            emptyMessage="No movements today."
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PER-VOUCHER TABS (cash_grv / credit_grv / fresh_bazaar /
                            pos_adjustment / disposal / neg_adjustment)
      ════════════════════════════════════════════════════════════════ */}
      {!loading && ['cash_grv', 'credit_grv', 'fresh_bazaar', 'pos_adjustment', 'disposal', 'neg_adjustment'].includes(tab) && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Vouchers" value={data.count} />
            <Stat label="Total Amount" value={`ETB ${(data.totalAmount || 0).toFixed(2)}`}
              color={['disposal', 'neg_adjustment'].includes(tab) ? 'text-red-700' : 'text-emerald-700'} />
            <Stat label="Total Qty moved" value={(data.totalQty || 0).toFixed(3)} />
          </div>

          {data.materialBreakdown?.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold text-ink-600">Material Breakdown</p>
              <MaterialBreakdown data={data.materialBreakdown} />
            </div>
          )}

          <p className="text-sm font-semibold text-ink-600">
            {VOUCHER_LABELS[tab]} — {data.count} record{data.count !== 1 ? 's' : ''}
          </p>
          <VoucherTable
            data={data.transactions}
            showSupplier={['cash_grv', 'credit_grv'].includes(tab)}
            showReason={['disposal', 'neg_adjustment', 'pos_adjustment'].includes(tab)}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          STOCK LEVELS
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'stock' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Stat label="Total materials" value={data.count} />
            <Stat label="Total stock value" value={`ETB ${(data.totalValue || 0).toFixed(2)}`} color="text-blue-700" />
          </div>
          <DataTable
            columns={[
              { key: 'name', header: 'Material' },
              { key: 'category', header: 'Category' },
              { key: 'currentStock', header: 'In Stock', render: r => <span className="tabular">{r.currentStock} {r.unit}</span> },
              { key: 'reorderLevel', header: 'Reorder At', render: r => <span className="tabular">{r.reorderLevel} {r.unit}</span> },
              { key: 'unitCost', header: 'Unit Cost', render: r => <span className="tabular">ETB {(r.unitCost || 0).toFixed(2)}</span> },
              { key: 'value', header: 'Value (ETB)', render: r => <span className="tabular font-medium">ETB {(r.currentStock * r.unitCost).toFixed(2)}</span> },
              {
                key: 'status', header: 'Status',
                render: r => {
                  if (r.status === 'out_of_stock') return <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Out of stock</span>;
                  if (r.status === 'low_stock') return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Low stock</span>;
                  return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">In stock</span>;
                },
              },
            ]}
            data={data.materials}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          PURCHASES
      ════════════════════════════════════════════════════════════════ */}
      {!loading && tab === 'purchases' && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Stat label="Total purchases" value={data.count} />
            <Stat label="Total value" value={`ETB ${(data.totalAmount || 0).toFixed(2)}`} color="text-blue-700" />
          </div>
          <DataTable
            columns={[
              { key: 'purchaseDate', header: 'Date', render: r => new Date(r.purchaseDate).toLocaleDateString() },
              { key: 'supplier', header: 'Supplier', render: r => r.supplier?.name },
              { key: 'items', header: 'Items', render: r => r.items?.length },
              { key: 'totalAmount', header: 'Total', render: r => <span className="tabular">ETB {(r.totalAmount || 0).toFixed(2)}</span> },
              { key: 'status', header: 'Status', render: r => <span className="capitalize">{r.status}</span> },
            ]}
            data={data.purchases}
          />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          INVENTORY COUNT
      ════════════════════════════════════════════════════════════════ */}
      {tab === 'inventory_count' && (
        <InventoryCountPanel />
      )}

    </div>
  );
}
