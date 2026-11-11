import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Trash2, Search, CircleArrowDown, CircleArrowUp,
  ShoppingBag, CreditCard, Flame, TrendingDown, TrendingUp, Leaf, X, Eye, Paperclip, Pencil,
  Calendar, CalendarDays, Filter, RotateCcw,
} from 'lucide-react';
import api from '../api/axios';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import WorkflowBadge from '../components/ui/WorkflowBadge';
import ApproveModal, { TrailTimeline } from '../components/ui/ApproveModal';
import ExportDropdown from '../components/ui/ExportDropdown';
import AttachmentUploader, { AttachmentViewer } from '../components/ui/AttachmentUploader';
import Pagination from '../components/ui/Pagination';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

// ── Voucher config ────────────────────────────────────────────────────
const VOUCHERS = [
  { key: 'cash_grv', label: 'Cash GRV', fullLabel: 'Cash Goods Receiving Voucher', icon: ShoppingBag, badgeCls: 'bg-emerald-100 text-emerald-700', activeCls: 'bg-emerald-600', direction: 'in', needsSupplier: true, needsCost: true, description: 'Goods received and paid in cash' },
  { key: 'credit_grv', label: 'Credit GRV', fullLabel: 'Credit Goods Receiving Voucher', icon: CreditCard, badgeCls: 'bg-blue-100 text-blue-700', activeCls: 'bg-blue-600', direction: 'in', needsSupplier: true, needsCost: true, description: 'Goods received on credit / invoice' },
  { key: 'fresh_bazaar', label: 'Fresh Bazaar', fullLabel: 'Fresh Bazaar Receiving Voucher', icon: Leaf, badgeCls: 'bg-lime-100 text-lime-700', activeCls: 'bg-lime-600', direction: 'in', needsSupplier: false, needsCost: true, description: 'Fresh market / direct purchase receiving' },
  { key: 'pos_adjustment', label: '+ve Adjustment', fullLabel: 'Positive Stock Adjustment', icon: TrendingUp, badgeCls: 'bg-violet-100 text-violet-700', activeCls: 'bg-violet-600', direction: 'in', needsSupplier: false, needsCost: false, description: 'Correct stock upward after physical count' },
  { key: 'disposal', label: 'Disposal', fullLabel: 'Goods Disposal Voucher', icon: Flame, badgeCls: 'bg-orange-100 text-orange-700', activeCls: 'bg-orange-600', direction: 'out', needsSupplier: false, needsCost: false, description: 'Write off damaged / expired goods' },
  { key: 'neg_adjustment', label: '−ve Adjustment', fullLabel: 'Negative Stock Adjustment', icon: TrendingDown, badgeCls: 'bg-red-100 text-red-700', activeCls: 'bg-red-600', direction: 'out', needsSupplier: false, needsCost: false, description: 'Correct stock downward after physical count' },
  { key: 'sales_import', label: 'Imported Sale', fullLabel: 'Imported Sales Deduction', icon: ShoppingBag, badgeCls: 'bg-rose-100 text-rose-700', activeCls: 'bg-rose-600', direction: 'out', needsSupplier: false, needsCost: false, description: 'Sales imported from external POS' },
  { key: 'pos_sale', label: 'Baba Roti POS', fullLabel: 'Baba Roti POS Sale', icon: ShoppingBag, badgeCls: 'bg-cyan-100 text-cyan-800', activeCls: 'bg-cyan-600', direction: 'out', needsSupplier: false, needsCost: false, description: 'Direct sales from Baba Roti POS' },
  { key: 'manual_sale', label: 'Manual Sale', fullLabel: 'Manual Sales Record', icon: ShoppingBag, badgeCls: 'bg-purple-100 text-purple-700', activeCls: 'bg-purple-600', direction: 'out', needsSupplier: false, needsCost: false, description: 'Manually entered sale deduction' },
];
const voucherByKey = Object.fromEntries(VOUCHERS.map(v => [v.key, v]));
const emptyItem = () => ({ material: '', quantity: '', unitCost: '' });
const emptyForm = key => ({ voucherType: key, voucherNo: '', supplier: '', reason: '', reference: '', notes: '', date: new Date().toISOString().slice(0, 16), items: [emptyItem()], attachments: [] });

const toLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// ── Component ─────────────────────────────────────────────────────────
export default function StockTransactions({ defaultVoucher } = {}) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { can, hasRole, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('stockMovements', 'edit') : can('recordGoods');
  const canDelete = canCrud ? canCrud('stockMovements', 'delete') : can('voidTransactions');
  const isAdmin = hasRole('admin');

  // filterType comes from sidebar navigation (defaultVoucher) or stays null (All)
  const filterType = defaultVoucher ?? null;

  // Date filter state
  const [datePreset, setDatePreset] = useState('all'); // 'all' | 'today' | 'yesterday' | '7d' | 'month' | 'custom'
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const applyDatePreset = (preset) => {
    setDatePreset(preset);
    const now = new Date();
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
    } else if (preset === 'today') {
      const todayStr = toLocalDateString(now);
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = toLocalDateString(y);
      setFromDate(yStr);
      setToDate(yStr);
    } else if (preset === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      setFromDate(toLocalDateString(d));
      setToDate(toLocalDateString(now));
    } else if (preset === 'month') {
      const som = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(toLocalDateString(som));
      setToDate(toLocalDateString(now));
    } else if (preset === 'custom') {
      if (!fromDate && !toDate) {
        const todayStr = toLocalDateString(now);
        setFromDate(todayStr);
        setToDate(todayStr);
      }
    }
  };

  const handleFromChange = (val) => {
    setFromDate(val);
    setDatePreset('custom');
  };

  const handleToChange = (val) => {
    setToDate(val);
    setDatePreset('custom');
  };

  const clearDateFilter = () => {
    setDatePreset('all');
    setFromDate('');
    setToDate('');
  };

  const [transactions, setTransactions] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [activeV, setActiveV] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Workflow approval state
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAction, setApproveAction] = useState(null);
  const [approveTxn, setApproveTxn] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState(null);
  // Detail / trail modal
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTxn, setDetailTxn] = useState(null);

  const load = useCallback(() => {
    const params = {};
    if (filterType) params.voucherType = filterType;
    if (fromDate) {
      try {
        params.from = new Date(`${fromDate}T00:00:00`).toISOString();
      } catch (_) {
        params.from = fromDate;
      }
    }
    if (toDate) {
      try {
        params.to = new Date(`${toDate}T23:59:59.999`).toISOString();
      } catch (_) {
        params.to = toDate;
      }
    }
    api.get('/transactions', { params }).then(r => {
      setTransactions(Array.isArray(r.data) ? r.data : []);
      setSelected(new Set());
    }).catch(() => setTransactions([]));
  }, [filterType, fromDate, toDate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    api.get('/materials').then(r => setMaterials(Array.isArray(r.data) ? r.data : [])).catch(() => setMaterials([]));
    api.get('/suppliers').then(r => setSuppliers(Array.isArray(r.data) ? r.data : [])).catch(() => setSuppliers([]));
  }, []);

  const displayed = useMemo(() => {
    return transactions.filter(t => {
      if (search) {
        const mat = t.material?.name ?? t.items?.[0]?.material?.name ?? '';
        const match = (mat + (t.voucherNo ?? '') + (t.supplier?.name ?? '')).toLowerCase().includes(search.toLowerCase());
        if (!match) return false;
      }
      if (fromDate || toDate) {
        if (!t.date) return false;
        const txnDate = toLocalDateString(new Date(t.date));
        if (fromDate && txnDate < fromDate) return false;
        if (toDate && txnDate > toDate) return false;
      }
      return true;
    });
  }, [transactions, search, fromDate, toDate]);

  // ── Pagination ──
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Reset to page 1 whenever search, filter or date changes
  React.useEffect(() => { setPage(1); }, [search, filterType, fromDate, toDate]);
  const paginated = displayed.slice((page - 1) * pageSize, page * pageSize);

  // Export Data for Excel & CSV
  const exportData = useMemo(() => {
    return displayed.map((t) => {
      const v = voucherByKey[t.voucherType];
      const matNames = t.items && t.items.length > 0
        ? t.items.map(i => `${i.material?.name ?? '—'} ×${i.quantity}`).join(', ')
        : `${t.material?.name ?? '—'}${t.quantity ? ' ×' + t.quantity : ''}`;

      return {
        'Date': new Date(t.date || t.createdAt).toLocaleString(),
        'Voucher No': t.voucherNo || '—',
        'Voucher Type': v?.label || t.voucherType || '—',
        'Direction': t.type === 'in' ? 'IN' : 'OUT',
        'Material(s)': matNames,
        'Supplier': t.supplier?.name || '—',
        'Total (ETB)': Number(t.totalAmount || 0).toFixed(2),
        'Status': (t.status || 'pending').toUpperCase(),
        'Recorded By': t.performedBy?.name || 'System',
        'Reference': t.reference || '',
        'Notes': t.notes || '',
      };
    });
  }, [displayed]);

  // Export Columns for PDF
  const pdfColumns = [
    { header: 'Date', accessor: 'Date' },
    { header: 'Voucher No', accessor: 'Voucher No' },
    { header: 'Type', accessor: 'Voucher Type' },
    { header: 'Direction', accessor: 'Direction', align: 'center' },
    { header: 'Material(s)', accessor: 'Material(s)' },
    { header: 'Supplier', accessor: 'Supplier' },
    { header: 'Total (ETB)', accessor: 'Total (ETB)', align: 'right' },
    { header: 'Status', accessor: 'Status', align: 'center' },
    { header: 'By', accessor: 'Recorded By' },
  ];

  const openForm = key => {
    setEditingTxn(null);
    setActiveV(voucherByKey[key]);
    setForm(emptyForm(key));
    setError('');
    setModalOpen(true);
  };

  const openEditTransaction = (txn) => {
    const vConfig = voucherByKey[txn.voucherType] || VOUCHERS[0];
    setActiveV(vConfig);
    setEditingTxn(txn);

    let itemsList = [];
    if (txn.items && txn.items.length > 0) {
      itemsList = txn.items.map(it => ({
        material: it.material?._id || it.material || '',
        quantity: it.quantity ?? '',
        unitCost: it.unitCost !== undefined && it.unitCost !== null ? it.unitCost : '',
      }));
    } else if (txn.material) {
      itemsList = [{
        material: txn.material?._id || txn.material || '',
        quantity: txn.quantity ?? '',
        unitCost: txn.unitCost !== undefined && txn.unitCost !== null ? txn.unitCost : '',
      }];
    } else {
      itemsList = [emptyItem()];
    }

    setForm({
      voucherType: txn.voucherType,
      voucherNo: txn.voucherNo || '',
      supplier: txn.supplier?._id || txn.supplier || '',
      reason: txn.reason || '',
      reference: txn.reference || '',
      notes: txn.notes || '',
      date: txn.date ? new Date(txn.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      items: itemsList,
      attachments: txn.attachments || [],
    });
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = i => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i, fld, v) => setForm(f => {
    const items = [...f.items];
    items[i] = { ...items[i], [fld]: v };
    if (fld === 'material') { const m = materials.find(m => m._id === v); items[i].unitCost = m?.unitCost ?? ''; }
    return { ...f, items };
  });

  const handleSubmit = async e => {
    e.preventDefault(); setError(''); setSubmitting(true);
    const payload = {
      voucherType: form.voucherType,
      voucherNo: form.voucherNo || undefined,
      supplier: form.supplier || undefined,
      reason: form.reason,
      reference: form.reference,
      notes: form.notes,
      date: form.date,
      attachments: form.attachments || [],
      items: form.items.filter(it => it.material && it.quantity).map(it => ({
        material: it.material, quantity: Number(it.quantity), unitCost: Number(it.unitCost) || 0,
      })),
    };
    try {
      if (editingTxn) {
        await api.put(`/transactions/${editingTxn._id}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      setModalOpen(false);
      setEditingTxn(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save voucher.');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async id => {
    if (!confirm('Move this transaction to recycle bin and reverse its stock effect?')) return;
    await api.delete(`/transactions/${id}`); load();
  };

  const handleBulkDelete = async () => {
    const deletable = displayed.filter(t =>
      canDelete && (isAdmin || ['pending', 'voided'].includes(t.status ?? 'pending')) && selected.has(t._id)
    );
    if (!deletable.length) return;
    if (!confirm(`Move ${deletable.length} transaction(s) to recycle bin?`)) return;
    await api.delete('/transactions/bulk', { data: { ids: deletable.map(t => t._id) } });
    load();
  };

  /* ── selection helpers ── */
  const canDeleteRow = (t) =>
    canDelete && (isAdmin || ['pending', 'voided'].includes(t.status ?? 'pending'));

  // Admin can select all rows; others only pending/voided
  const deletableIds = displayed
    .filter(t => canDelete && (isAdmin || ['pending', 'voided'].includes(t.status ?? 'pending')))
    .map(t => t._id);
  const allChecked = deletableIds.length > 0 && deletableIds.every(id => selected.has(id));
  const someChecked = deletableIds.some(id => selected.has(id));
  const toggleAll = () => allChecked
    ? setSelected(prev => { const n = new Set(prev); deletableIds.forEach(id => n.delete(id)); return n; })
    : setSelected(prev => { const n = new Set(prev); deletableIds.forEach(id => n.add(id)); return n; });
  const toggleOne = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  // ── Workflow helpers ──
  const NEXT_ACTIONS = {
    pending: [{ action: 'check', label: 'Check', cap: 'checkReview' },
    { action: 'void', label: 'Void', cap: 'voidTransactions', danger: true }],
    checked: [{ action: 'approve', label: 'Approve', cap: 'approveGoods' },
    { action: 'void', label: 'Void', cap: 'voidTransactions', danger: true }],
    approved: [{ action: 'post', label: 'Post', cap: 'postLedger' },
    { action: 'void', label: 'Void', cap: 'voidTransactions', danger: true }],
    posted: [],
    voided: [],
  };

  const ACTION_COLORS = {
    check: 'bg-blue-600 hover:bg-blue-700',
    approve: 'bg-violet-600 hover:bg-violet-700',
    post: 'bg-emerald-600 hover:bg-emerald-700',
    void: 'bg-red-50 hover:bg-red-100 !text-red-600',
  };

  const actionsFor = (txn) => {
    const possible = NEXT_ACTIONS[txn.status ?? 'pending'] ?? [];
    return possible.filter(a => can(a.cap));
  };

  const openApprove = (txn, action) => {
    setApproveTxn(txn); setApproveAction(action);
    setApproveError(null); setApproveOpen(true);
  };

  const handleAdvance = async (password, note) => {
    setApproveLoading(true); setApproveError(null);
    try {
      await api.post(`/transactions/${approveTxn._id}/advance`, { action: approveAction, password, note });
      setApproveOpen(false); load();
    } catch (err) {
      setApproveError(err.response?.data?.message || 'Action failed');
    } finally { setApproveLoading(false); }
  };

  const formTotal = (form?.items ?? []).reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0);

  // Page heading
  const headingV = filterType ? voucherByKey[filterType] : null;
  const HeadingIcon = headingV?.icon;

  return (
    <div className="space-y-4">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-2.5">
          {HeadingIcon && (
            <span className={`inline-flex items-center justify-center rounded-lg p-2 shadow-2xs ${headingV.badgeCls}`}>
              <HeadingIcon size={18} />
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-ink-900">
                {headingV ? headingV.fullLabel : (t ? t('nav.allMovements') : 'All Stock Movements')}
              </h1>
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
                {displayed.length}
              </span>
            </div>
            {headingV && (
              <p className="text-xs text-ink-400">{headingV.description}</p>
            )}
          </div>
        </div>

        {/* Date Filter Toolbar (Between title and actions — exactly matching user's red box!) */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200/80 bg-white p-1.5 shadow-2xs">
          {/* Quick preset buttons */}
          <div className="flex items-center gap-0.5">
            {[
              { id: 'all', label: t ? t('movements.allTime') : 'All' },
              { id: 'today', label: t ? t('movements.today') : 'Today' },
              { id: 'yesterday', label: t ? t('movements.yesterday') : 'Yesterday' },
              { id: '7d', label: t ? t('movements.last7Days') : '7 Days' },
              { id: 'month', label: t ? t('movements.thisMonth') : 'This Month' },
            ].map(p => {
              const active = datePreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyDatePreset(p.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
                    }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="h-4 w-[1px] bg-ink-200 hidden sm:block" />

          {/* Date range pickers */}
          <div className="flex items-center gap-1.5 text-xs text-ink-600">
            <Calendar size={14} className="text-blue-600 hidden sm:inline" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-ink-400">{t ? t('movements.from') : 'From'}</span>
              <input
                type="date"
                value={fromDate}
                onChange={e => handleFromChange(e.target.value)}
                className="rounded-md border border-ink-200 bg-ink-50/60 px-2 py-0.5 text-xs font-medium text-ink-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>
            <span className="text-ink-300">-</span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-medium text-ink-400">{t ? t('movements.to') : 'To'}</span>
              <input
                type="date"
                value={toDate}
                onChange={e => handleToChange(e.target.value)}
                className="rounded-md border border-ink-200 bg-ink-50/60 px-2 py-0.5 text-xs font-medium text-ink-800 outline-none focus:border-blue-500 focus:bg-white"
              />
            </div>

            {(fromDate || toDate || datePreset !== 'all') && (
              <button
                type="button"
                onClick={clearDateFilter}
                className="rounded-md p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                title={t ? t('common.clear') : 'Clear date filter'}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export (Excel, PDF, CSV, Print) & Import */}
          <ExportDropdown
            data={exportData}
            fileName={headingV ? `stock_${headingV.key}` : 'all_stock_movements'}
            pdfTitle={
              (headingV ? headingV.fullLabel : 'All Stock Movements Report') +
              (fromDate || toDate ? ` (${fromDate || '...'} to ${toDate || '...'})` : '')
            }
            pdfColumns={pdfColumns}
            showImport={true}
            onImport={() => navigate('/sales-import')}
            importLabel="Import Excel / POS"
          />

          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="rounded-lg border border-ink-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 w-40 sm:w-48"
            />
          </div>

          {/* New voucher button — only shown on specific voucher pages */}
          {canEdit && headingV && (
            <button
              onClick={() => openForm(headingV.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white ${headingV.activeCls}`}
            >
              <Plus size={15} /> New {headingV.label}
            </button>
          )}
        </div>
      </div>

      {/* ── Bulk delete bar ── */}
      {someChecked && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-red-800">{selected.size} selected</span>
          <button
            onClick={handleBulkDelete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            <Trash2 size={13} /> Move to Recycle Bin
          </button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-red-400 hover:text-red-700">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Transactions table ── */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
              <tr>
                {canDelete && (
                  <th className="w-10 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>
                    <input type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded cursor-pointer accent-white" />
                  </th>
                )}
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Date</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Voucher No</th>
                {!filterType && <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Type</th>}
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Direction</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Material(s)</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Supplier</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Total (ETB)</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Status</th>
                <th className="px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>By</th>
                <th className="px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-blue-100 whitespace-nowrap" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {displayed.length === 0 && (
                <tr><td colSpan={filterType ? 9 : 10} className="px-4 py-12 text-center text-ink-400">No transactions found.</td></tr>
              )}
              {paginated.map(t => {
                const v = voucherByKey[t.voucherType];
                const Icon = v?.icon ?? CircleArrowDown;
                const isIn = t.type === 'in';
                const matSummary = t.items?.length > 0
                  ? t.items.map(i => `${i.material?.name ?? '—'} ×${i.quantity}`).join(', ')
                  : `${t.material?.name ?? '—'}${t.quantity ? ' ×' + t.quantity : ''}`;
                const acts = actionsFor(t);
                return (
                  <tr key={t._id} className={`hover:bg-ink-50/40 ${selected.has(t._id) ? 'bg-red-50/40' : ''}`}>
                    {canDelete && (
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(t._id)}
                          onChange={() => toggleOne(t._id)}
                          className="h-4 w-4 rounded accent-red-600 cursor-pointer" />
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{new Date(t.date).toLocaleString()}</td>
                    <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-ink-400">{t.voucherNo || '—'}</td>
                    {!filterType && (
                      <td className="px-4 py-3 whitespace-nowrap">
                        {v ? (
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${v.badgeCls}`}>
                            <Icon size={11} /> {v.label}
                          </span>
                        ) : <span className="text-xs text-ink-400">—</span>}
                      </td>
                    )}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isIn ? <CircleArrowDown size={13} /> : <CircleArrowUp size={13} />}
                        {isIn ? 'IN' : 'OUT'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-700 max-w-[180px] truncate" title={matSummary}>{matSummary}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{t.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right tabular font-medium text-ink-800">
                      {t.totalAmount ? `ETB ${t.totalAmount.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <WorkflowBadge status={t.status ?? 'pending'} size="sm" />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-400">{t.performedBy?.name || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Attachment badge */}
                        {t.attachments?.length > 0 && (
                          <span
                            className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[10px] font-bold text-blue-600 cursor-pointer"
                            title={`${t.attachments.length} attachment${t.attachments.length > 1 ? 's' : ''}`}
                            onClick={() => { setDetailTxn(t); setDetailOpen(true); }}
                          >
                            <Paperclip size={9} /> {t.attachments.length}
                          </span>
                        )}
                        {/* Detail / trail */}
                        <button
                          onClick={() => { setDetailTxn(t); setDetailOpen(true); }}
                          className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600 transition"
                          title="View trail"
                        >
                          <Eye size={13} />
                        </button>
                        {/* Edit (only pending status) */}
                        {canEdit && (t.status ?? 'pending') === 'pending' && (
                          <button
                            onClick={() => openEditTransaction(t)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 px-2 py-1 text-xs font-semibold text-white transition shadow-xs"
                            title="Edit pending voucher"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                        {/* Workflow action buttons */}
                        {acts.map(a => (
                          <button key={a.action}
                            onClick={() => openApprove(t, a.action)}
                            className={`rounded-lg px-2 py-1 text-xs font-semibold text-white transition ${ACTION_COLORS[a.action]}`}>
                            {a.label}
                          </button>
                        ))}
                        {/* Delete — admin can delete any status; others only pending/voided */}
                        {canDeleteRow(t) && (
                          <button onClick={() => handleDelete(t._id)}
                            className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                            title="Delete transaction">
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
          page={page}
          pageSize={pageSize}
          total={displayed.length}
          onPage={setPage}
          onPageSize={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* ── Voucher Form Modal ── */}
      {activeV && form && (
        <Modal
          open={modalOpen}
          onClose={() => { setModalOpen(false); setEditingTxn(null); }}
          title={editingTxn ? `Edit ${activeV.fullLabel} (${editingTxn.voucherNo || 'Pending'})` : activeV.fullLabel}
          width="max-w-2xl"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${activeV.direction === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
              {activeV.direction === 'in' ? <CircleArrowDown size={16} /> : <CircleArrowUp size={16} />}
              {activeV.description} — stock will be <strong>{activeV.direction === 'in' ? 'increased' : 'decreased'}</strong>
            </div>
            {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"><X size={14} />{error}</div>}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Voucher No <span className="font-normal text-ink-400">(auto if blank)</span></label>
                <input value={form.voucherNo} onChange={e => setForm(f => ({ ...f, voucherNo: e.target.value }))} placeholder="Auto-generated"
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-ink-500">Date &amp; Time</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
              {activeV.needsSupplier && (
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-ink-500">Supplier *</label>
                  <select required value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="">Select supplier…</option>
                    {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
                  </select>
                </div>
              )}
              {!activeV.needsSupplier && (
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-ink-500">{activeV.key === 'disposal' ? 'Disposal reason' : 'Adjustment reason'}</label>
                  <input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                    placeholder={activeV.key === 'disposal' ? 'e.g. Expired, damaged…' : 'e.g. Physical count variance…'}
                    className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
                </div>
              )}
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-semibold text-ink-500">Reference <span className="font-normal text-ink-400">(optional)</span></label>
                <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. INV-2024-001"
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-ink-700">Items *</p>
                <button type="button" onClick={addItem}
                  className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
                  <Plus size={13} /> Add row
                </button>
              </div>
              <div className={`grid gap-2 mb-1 px-1 text-xs font-semibold text-ink-400 ${activeV.needsCost ? 'grid-cols-[1fr_80px_110px_26px]' : 'grid-cols-[1fr_80px_26px]'}`}>
                <span>Material</span><span>Quantity</span>{activeV.needsCost && <span>Unit Cost (ETB)</span>}<span />
              </div>
              <div className="space-y-2">
                {form.items.map((item, idx) => (
                  <div key={idx} className={`grid gap-2 items-center ${activeV.needsCost ? 'grid-cols-[1fr_80px_110px_26px]' : 'grid-cols-[1fr_80px_26px]'}`}>
                    <SearchableSelect
                      required
                      placeholder="Select material…"
                      options={materials}
                      value={item.material}
                      onChange={val => updateItem(idx, 'material', val)}
                    />
                    <input type="number" step="0.001" min="0.001" required placeholder="Qty" value={item.quantity}
                      onChange={e => updateItem(idx, 'quantity', e.target.value)}
                      className="rounded-lg border border-ink-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                    {activeV.needsCost && (
                      <input type="number" step="0.01" min="0" placeholder="Unit cost" value={item.unitCost}
                        onChange={e => updateItem(idx, 'unitCost', e.target.value)}
                        className="rounded-lg border border-ink-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                    )}
                    <button type="button" onClick={() => removeItem(idx)} disabled={form.items.length === 1}
                      className="rounded-md p-1 text-ink-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              {activeV.needsCost && formTotal > 0 && (
                <div className="mt-3 flex justify-between rounded-lg bg-ink-50 px-3 py-2 text-sm">
                  <span className="text-ink-500">Total amount</span>
                  <span className="font-bold text-ink-900">ETB {formTotal.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Notes <span className="font-normal text-ink-400">(optional)</span></label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            {/* ── Attachments ── */}
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-ink-500">
                <Paperclip size={12} /> Receipt / Invoice Attachments <span className="font-normal text-ink-400">(optional)</span>
              </label>
              <AttachmentUploader
                attachments={form.attachments || []}
                onAttachmentsChange={atts => setForm(f => ({ ...f, attachments: atts }))}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <X size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => { setModalOpen(false); setEditingTxn(null); }}>Cancel</Button>
              <button type="submit" disabled={submitting}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${activeV.activeCls}`}>
                {submitting ? 'Saving…' : (editingTxn ? 'Save Changes' : `Post ${activeV.label}`)}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {/* ── Approve Modal ── */}
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleAdvance}
        action={approveAction}
        entityLabel={approveTxn?.voucherNo || `Voucher #${approveTxn?._id?.slice(-6)}`}
        loading={approveLoading}
        error={approveError}
        currentStatus={approveTxn?.status ?? 'pending'}
        mode="transaction"
        trail={approveTxn?.trail ?? []}
      />

      {/* ── Detail / Trail Modal ── */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`${voucherByKey[detailTxn?.voucherType]?.fullLabel ?? 'Voucher'} — ${detailTxn?.voucherNo || ''}`}
        width="max-w-lg"
      >
        {detailTxn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ink-400">Status</p><WorkflowBadge status={detailTxn.status ?? 'pending'} /></div>
              <div><p className="text-xs text-ink-400">Date</p><p className="font-medium">{new Date(detailTxn.date).toLocaleString()}</p></div>
              <div><p className="text-xs text-ink-400">Recorded by</p><p className="font-medium">{detailTxn.performedBy?.name ?? '—'}</p></div>
              <div><p className="text-xs text-ink-400">Total</p><p className="font-semibold">ETB {(detailTxn.totalAmount || 0).toFixed(2)}</p></div>
            </div>
            <div className="rounded-lg bg-ink-50 p-3 text-xs space-y-1">
              {[
                { label: 'Checked by', who: detailTxn.checkedBy, at: detailTxn.checkedAt },
                { label: 'Approved by', who: detailTxn.approvedBy, at: detailTxn.approvedAt },
                { label: 'Posted by', who: detailTxn.postedBy, at: detailTxn.postedAt },
              ].filter(e => e.who).map((e, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-ink-500">{e.label}</span>
                  <span className="font-medium">{e.who?.name ?? '—'} {e.at ? `· ${new Date(e.at).toLocaleDateString()}` : ''}</span>
                </div>
              ))}
            </div>
            <TrailTimeline trail={detailTxn.trail ?? []} />

            {/* Attachments section */}
            <div>
              <p className="text-xs font-semibold text-ink-500 flex items-center gap-1.5 mb-2">
                <Paperclip size={12} /> Attachments
                {(detailTxn.attachments?.length > 0) && (
                  <span className="ml-1 inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">
                    {detailTxn.attachments.length}
                  </span>
                )}
              </p>
              <AttachmentViewer attachments={detailTxn.attachments || []} />
            </div>
            {actionsFor(detailTxn).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-ink-100">
                {actionsFor(detailTxn).map(a => (
                  <button key={a.action}
                    onClick={() => { setDetailOpen(false); openApprove(detailTxn, a.action); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${ACTION_COLORS[a.action]}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
