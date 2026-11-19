import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Plus, Trash2, ChevronDown, ChevronRight, Eye, X, ShoppingCart, Search, CheckCircle2, Clock, Check, AlertCircle, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api/axios';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import WorkflowBadge from '../components/ui/WorkflowBadge';
import ApproveModal, { TrailTimeline } from '../components/ui/ApproveModal';
import ExportDropdown from '../components/ui/ExportDropdown';
import { useAuth } from '../context/AuthContext';

const emptyItem = { material: '', quantity: 1, unitCost: 0 };

// Which action buttons to show per status
const NEXT_ACTIONS = {
  draft: [{ action: 'check', label: 'Check', cap: 'checkReview' },
  { action: 'cancel', label: 'Cancel', cap: 'voidTransactions', danger: true }],
  checked: [{ action: 'approve', label: 'Approve', cap: 'approveGoods' },
  { action: 'cancel', label: 'Cancel', cap: 'voidTransactions', danger: true }],
  approved: [{ action: 'receive', label: 'Receive', cap: 'recordGoods' },
  { action: 'cancel', label: 'Cancel', cap: 'voidTransactions', danger: true }],
  received: [],
  cancelled: [],
};

const ACTION_COLORS = {
  check: 'bg-blue-600 hover:bg-blue-700',
  approve: 'bg-violet-600 hover:bg-violet-700',
  receive: 'bg-emerald-600 hover:bg-emerald-700',
  cancel: 'bg-red-50 hover:bg-red-100 !text-red-600',
};

export default function Purchases() {
  const { user, can, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('purchases', 'edit') : can('recordGoods');
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'draft' | 'checked' | 'approved' | 'received' | 'cancelled'
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [importResult, setImportResult] = useState(null);
  const importRef = useRef();

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [items, setItems] = useState([{ ...emptyItem }]);

  // Detail / trail drawer
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Approve modal
  const [approveOpen, setApproveOpen] = useState(false);
  const [approveAction, setApproveAction] = useState(null);
  const [approvePurchase, setApprovePurchase] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState(null);

  const load = () =>
    api.get('/purchases')
      .then(r => setPurchases(Array.isArray(r.data) ? r.data : []))
      .catch(() => setPurchases([]));

  useEffect(() => {
    load();
    api.get('/suppliers').then(r => setSuppliers(Array.isArray(r.data) ? r.data : [])).catch(() => setSuppliers([]));
    api.get('/materials').then(r => setMaterials(Array.isArray(r.data) ? r.data : [])).catch(() => setMaterials([]));
  }, []);

  // Dynamic counts per status
  const statusCounts = useMemo(() => {
    const counts = { all: purchases.length, draft: 0, checked: 0, approved: 0, received: 0, cancelled: 0 };
    purchases.forEach((p) => {
      if (counts[p.status] !== undefined) counts[p.status]++;
    });
    return counts;
  }, [purchases]);

  // Filtered purchases
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (supplierFilter !== 'all') {
        const supId = p.supplier?._id || p.supplier;
        const supName = p.supplier?.name;
        if (supId !== supplierFilter && supName !== supplierFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const inv = (p.invoiceNumber || '').toLowerCase();
        const sup = (p.supplier?.name || '').toLowerCase();
        const itm = p.items?.some(i => (i.material?.name || '').toLowerCase().includes(q));
        if (!inv.includes(q) && !sup.includes(q) && !itm) return false;
      }
      return true;
    });
  }, [purchases, statusFilter, supplierFilter, search]);

  // ── Export data ──
  const exportData = useMemo(() => {
    return filteredPurchases.map(p => ({
      'Date': new Date(p.purchaseDate).toLocaleDateString(),
      'Invoice No': p.invoiceNumber || '—',
      'Supplier': p.supplier?.name || '—',
      'Items Count': p.items?.length ?? 0,
      'Items Detail': p.items?.map(i => `${i.material?.name ?? '?'} ×${i.quantity}`).join(', ') || '—',
      'Total (ETB)': Number(p.totalAmount || 0).toFixed(2),
      'Status': p.status,
    }));
  }, [filteredPurchases]);

  const pdfColumns = [
    { header: 'Date', accessor: 'Date' },
    { header: 'Invoice No', accessor: 'Invoice No' },
    { header: 'Supplier', accessor: 'Supplier' },
    { header: 'Items', accessor: 'Items Detail' },
    { header: 'Total (ETB)', accessor: 'Total (ETB)', align: 'right' },
    { header: 'Status', accessor: 'Status', align: 'center' },
  ];

  // ── Import from Excel / CSV ──
  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
        let created = 0;
        let errors = 0;
        for (const row of rows) {
          try {
            const supplierName = String(row['Supplier'] || row['supplier'] || '').trim();
            const invoice = String(row['Invoice No'] || row['invoiceNumber'] || '').trim();
            const found = suppliers.find(s => s.name.toLowerCase() === supplierName.toLowerCase());
            if (!found) { errors++; continue; }
            await api.post('/purchases', {
              supplier: found._id,
              invoiceNumber: invoice,
              items: [], // imported as empty draft
            });
            created++;
          } catch { errors++; }
        }
        setImportResult({ message: `Import complete — ${created} created, ${errors} skipped.` });
        load();
      } catch (err) {
        setImportResult({ message: 'Import failed: invalid file format.' });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  // ── Create purchase ──
  const openCreate = () => {
    setSupplier(''); setInvoiceNumber(''); setItems([{ ...emptyItem }]);
    setCreateOpen(true);
  };

  const updateItem = (i, patch) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it));

  const total = items.reduce((s, it) =>
    s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0);

  const handleCreate = async (e) => {
    e.preventDefault();
    await api.post('/purchases', {
      supplier, invoiceNumber,
      items: items.filter(it => it.material),
    });
    setCreateOpen(false);
    load();
  };

  // ── Open approve modal ──
  const openApprove = (purchase, action) => {
    setApprovePurchase(purchase);
    setApproveAction(action);
    setApproveError(null);
    setApproveOpen(true);
  };

  const handleAdvance = async (password, note) => {
    setApproveLoading(true);
    setApproveError(null);
    try {
      await api.post(`/purchases/${approvePurchase._id}/advance`, {
        action: approveAction, password, note,
      });
      setApproveOpen(false);
      load();
    } catch (err) {
      setApproveError(err.response?.data?.message || 'Action failed');
    } finally {
      setApproveLoading(false);
    }
  };

  // ── Detail view ──
  const openDetail = (p) => { setDetailPurchase(p); setDetailOpen(true); };

  // ── Available actions for this user on this purchase ──
  const actionsFor = (purchase) => {
    const possible = NEXT_ACTIONS[purchase.status] ?? [];
    return possible.filter(a => can(a.cap));
  };

  const columns = [
    {
      key: 'purchaseDate', header: 'Date',
      render: r => new Date(r.purchaseDate).toLocaleDateString(),
    },
    { key: 'invoiceNumber', header: 'Invoice', render: r => r.invoiceNumber || '—' },
    { key: 'supplier', header: 'Supplier', render: r => r.supplier?.name || '—' },
    { key: 'items', header: 'Items', render: r => `${r.items.length} item${r.items.length > 1 ? 's' : ''}` },
    { key: 'totalAmount', header: 'Total', render: r => <span className="tabular font-medium">ETB {r.totalAmount.toFixed(2)}</span> },
    {
      key: 'status', header: 'Status',
      render: r => <WorkflowBadge status={r.status} />,
    },
    {
      key: 'actions', header: '',
      render: r => {
        const acts = actionsFor(r);
        return (
          <div className="flex items-center gap-1.5">
            {/* Detail / trail button */}
            <button
              onClick={() => openDetail(r)}
              className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              title="View trail"
            >
              <Eye size={14} />
            </button>
            {acts.map(a => (
              <button
                key={a.action}
                onClick={() => openApprove(r, a.action)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold text-white transition-all ${ACTION_COLORS[a.action]}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Toolbar with Search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoice, supplier, item…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 shadow-2xs"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName="purchases_export"
            sheetName="Purchases"
            pdfTitle="Purchase Orders Report"
            pdfColumns={pdfColumns}
            pdfSummary={[
              { label: 'Total Purchases', value: filteredPurchases.length },
              { label: 'Total Value (ETB)', value: filteredPurchases.reduce((s, p) => s + (p.totalAmount || 0), 0).toFixed(2) },
            ]}
            showImport={true}
            onImport={() => importRef.current?.click()}
            importLabel="Import Excel"
          />
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
          {canEdit && (
            <Button
              style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }}
              onClick={openCreate}
            >
              <Plus size={16} /> Record purchase
            </Button>
          )}
        </div>
      </div>

      {importResult && (
        <div className="flex items-start justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <p className="font-medium">{importResult.message}</p>
          <button onClick={() => setImportResult(null)} className="ml-4 text-blue-500 hover:text-blue-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* ── Quick Purchase Status & Supplier Filter Badges ── */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-blue-200/80 bg-white p-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* All */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'all'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <span>All</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
              {statusCounts.all}
            </span>
          </button>

          {/* Draft */}
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'draft'
                ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/40'
                : 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
              }`}
          >
            <Clock size={12} className={statusFilter === 'draft' ? 'text-white' : 'text-amber-600'} />
            <span>Draft</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'draft' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
              {statusCounts.draft}
            </span>
          </button>

          {/* Checked */}
          <button
            type="button"
            onClick={() => setStatusFilter('checked')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'checked'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40'
                : 'bg-blue-50 text-blue-800 border border-blue-200/80 hover:bg-blue-100'
              }`}
          >
            <Check size={12} className={statusFilter === 'checked' ? 'text-white' : 'text-blue-600'} />
            <span>Checked</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'checked' ? 'bg-white/25 text-white' : 'bg-blue-200 text-blue-900'
              }`}>
              {statusCounts.checked}
            </span>
          </button>

          {/* Approved */}
          <button
            type="button"
            onClick={() => setStatusFilter('approved')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'approved'
                ? 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-400/40'
                : 'bg-violet-50 text-violet-800 border border-violet-200/80 hover:bg-violet-100'
              }`}
          >
            <CheckCircle2 size={12} className={statusFilter === 'approved' ? 'text-white' : 'text-violet-600'} />
            <span>Approved</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'approved' ? 'bg-white/25 text-white' : 'bg-violet-200 text-violet-900'
              }`}>
              {statusCounts.approved}
            </span>
          </button>

          {/* Received */}
          <button
            type="button"
            onClick={() => setStatusFilter('received')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'received'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/40'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100'
              }`}
          >
            <CheckCircle2 size={12} className={statusFilter === 'received' ? 'text-white' : 'text-emerald-600'} />
            <span>Received</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'received' ? 'bg-white/25 text-white' : 'bg-emerald-200 text-emerald-900'
              }`}>
              {statusCounts.received}
            </span>
          </button>

          {/* Cancelled */}
          <button
            type="button"
            onClick={() => setStatusFilter('cancelled')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'cancelled'
                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400/40'
                : 'bg-rose-50 text-rose-800 border border-rose-200/80 hover:bg-rose-100'
              }`}
          >
            <AlertCircle size={12} className={statusFilter === 'cancelled' ? 'text-white' : 'text-rose-600'} />
            <span>Cancelled</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'cancelled' ? 'bg-white/25 text-white' : 'bg-rose-200 text-rose-900'
              }`}>
              {statusCounts.cancelled}
            </span>
          </button>
        </div>

        {/* Supplier Quick Filter Dropdown */}
        {suppliers.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-ink-600 self-end sm:self-auto">
            <span className="font-medium text-ink-400">Supplier:</span>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="all">All Suppliers ({suppliers.length})</option>
              {suppliers.map((s) => (
                <option key={s._id} value={s._id}>{s.name}</option>
              ))}
            </select>
            {(statusFilter !== 'all' || supplierFilter !== 'all' || search) && (
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setSupplierFilter('all'); setSearch(''); }}
                className="text-xs text-ink-400 hover:text-ink-700 underline pl-1"
                title="Reset filters"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredPurchases}
        emptyMessage={
          statusFilter !== 'all'
            ? `No ${statusFilter} purchases found.`
            : supplierFilter !== 'all'
              ? 'No purchases found for selected supplier.'
              : search
                ? `No purchases matching "${search}".`
                : 'No purchases recorded yet.'
        }
        title="Purchase Orders"
        icon={<ShoppingCart size={15} />}
      />

      {/* ── Create Modal ── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Record a purchase" width="max-w-2xl">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Supplier *</label>
              <select required value={supplier} onChange={e => setSupplier(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500">
                <option value="">Select supplier</option>
                {suppliers.map(s => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Invoice number</label>
              <input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-semibold text-ink-700">Items purchased</label>
              <button type="button" onClick={() => setItems([...items, { ...emptyItem }])}
                className="text-xs font-semibold text-blue-600 hover:underline">+ Add line</button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <select value={it.material} onChange={e => updateItem(i, { material: e.target.value })}
                    required className="col-span-5 rounded-lg border border-ink-200 px-2 py-2 text-sm outline-none focus:border-blue-500">
                    <option value="">Material</option>
                    {materials.map(m => <option key={m._id} value={m._id}>{m.name} ({m.unit})</option>)}
                  </select>
                  <input type="number" step="any" min="0" placeholder="Qty" value={it.quantity}
                    onChange={e => updateItem(i, { quantity: e.target.value })}
                    className="col-span-3 rounded-lg border border-ink-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                  <input type="number" step="any" min="0" placeholder="Unit cost" value={it.unitCost}
                    onChange={e => updateItem(i, { unitCost: e.target.value })}
                    className="col-span-3 rounded-lg border border-ink-200 px-2 py-2 text-sm outline-none focus:border-blue-500" />
                  <button type="button" onClick={() => setItems(items.filter((_, idx) => idx !== i))}
                    className="col-span-1 flex items-center justify-center text-ink-300 hover:text-red-500">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-ink-50 px-4 py-3">
            <span className="text-sm font-medium text-ink-600">Total amount</span>
            <span className="tabular text-lg font-bold text-ink-900">ETB {total.toFixed(2)}</span>
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Purchase will be saved as <strong>Draft</strong>. A checker must verify before stock is affected.
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }}>
              Save as Draft
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail / Trail Modal ── */}
      <Modal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`Purchase — ${detailPurchase?.invoiceNumber || detailPurchase?._id?.slice(-6)}`}
        width="max-w-lg"
      >
        {detailPurchase && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ink-400">Supplier</p><p className="font-medium">{detailPurchase.supplier?.name}</p></div>
              <div><p className="text-xs text-ink-400">Status</p><WorkflowBadge status={detailPurchase.status} /></div>
              <div><p className="text-xs text-ink-400">Date</p><p className="font-medium">{new Date(detailPurchase.purchaseDate).toLocaleDateString()}</p></div>
              <div><p className="text-xs text-ink-400">Total</p><p className="font-semibold">ETB {detailPurchase.totalAmount?.toFixed(2)}</p></div>
            </div>

            {/* Sign-offs */}
            <div className="rounded-lg bg-ink-50 p-3 text-xs space-y-1">
              {[
                { label: 'Recorded by', who: detailPurchase.recordedBy, at: detailPurchase.createdAt },
                { label: 'Checked by', who: detailPurchase.checkedBy, at: detailPurchase.checkedAt },
                { label: 'Approved by', who: detailPurchase.approvedBy, at: detailPurchase.approvedAt },
                { label: 'Received by', who: detailPurchase.receivedBy, at: detailPurchase.receivedAt },
              ].filter(e => e.who).map((e, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-ink-500">{e.label}</span>
                  <span className="font-medium text-ink-700">
                    {e.who?.name ?? '—'} {e.at ? `· ${new Date(e.at).toLocaleDateString()}` : ''}
                  </span>
                </div>
              ))}
            </div>

            {/* Audit trail */}
            <TrailTimeline trail={detailPurchase.trail ?? []} />

            {/* Next actions from detail view too */}
            {actionsFor(detailPurchase).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1 border-t border-ink-100">
                {actionsFor(detailPurchase).map(a => (
                  <button key={a.action}
                    onClick={() => { setDetailOpen(false); openApprove(detailPurchase, a.action); }}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white ${ACTION_COLORS[a.action]}`}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ── Approve Modal ── */}
      <ApproveModal
        open={approveOpen}
        onClose={() => setApproveOpen(false)}
        onConfirm={handleAdvance}
        action={approveAction}
        entityLabel={approvePurchase?.invoiceNumber || `Purchase #${approvePurchase?._id?.slice(-6)}`}
        loading={approveLoading}
        error={approveError}
        currentStatus={approvePurchase?.status}
        mode="purchase"
        trail={approvePurchase?.trail ?? []}
      />
    </div>
  );
}
