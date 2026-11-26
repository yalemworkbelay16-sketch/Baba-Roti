import React, { useEffect, useState, useCallback } from 'react';
import {
  Trash2, RotateCcw, AlertTriangle, RefreshCw,
  Boxes, Truck, UtensilsCrossed, ArrowLeftRight, X, Trash, Receipt,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

/* ── type config ─────────────────────────────────────────────────── */
const TYPE_META = {
  material:    { label: 'Raw Material',     icon: Boxes,           color: 'bg-amber-50 text-amber-700 border-amber-200'  },
  supplier:    { label: 'Supplier',         icon: Truck,           color: 'bg-sky-50 text-sky-700 border-sky-200'         },
  product:     { label: 'Product',          icon: UtensilsCrossed, color: 'bg-violet-50 text-violet-700 border-violet-200'},
  transaction: { label: 'Transaction',      icon: ArrowLeftRight,  color: 'bg-rose-50 text-rose-700 border-rose-200'      },
  expense:     { label: 'Overhead Expense', icon: Receipt,         color: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
};

const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';

const itemName = (item) =>
  item.name || item.voucherNo || `${item._typeLabel} #${item._id?.slice(-6)}`;

export default function RecycleBin() {
  const { hasRole, can } = useAuth();
  const isAdmin = hasRole('admin') || hasRole('manager') || hasRole('operation_manager') || can('voidTransactions');

  const [items,     setItems]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [filter,    setFilter]    = useState('all');   // 'all' | type key
  const [selected,  setSelected]  = useState(new Set());
  const [working,   setWorking]   = useState(false);
  const [toast,     setToast]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/recycle-bin');
      setItems(Array.isArray(res.data) ? res.data : []);
      setSelected(new Set());
    } catch (err) {
      console.error('[RecycleBin] load error:', err);
      setItems([]);
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };
  /* ── filtering ── */
  const displayed = filter === 'all' ? items : items.filter(i => i._type === filter);

  /* ── selection ── */
  const allChecked  = displayed.length > 0 && displayed.every(i => selected.has(i._id));
  const someChecked = displayed.some(i => selected.has(i._id));
  const toggleAll   = () => {
    if (allChecked) {
      setSelected(prev => { const n = new Set(prev); displayed.forEach(i => n.delete(i._id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); displayed.forEach(i => n.add(i._id)); return n; });
    }
  };
  const toggleOne = (id) => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  /* ── single restore ── */
  const handleRestore = async (item) => {
    setWorking(true);
    try {
      await api.post(`/recycle-bin/${item._type}/${item._id}/restore`);
      showToast(`"${itemName(item)}" restored successfully.`);
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Restore failed.', 'error');
      load();
    } finally { setWorking(false); }
  };
  /* ── single permanent delete ── */
  const handlePermanent = async (item) => {
    if (!window.confirm(`Permanently delete "${itemName(item)}"? This cannot be undone.`)) return;
    setWorking(true);
    try {
      await api.delete(`/recycle-bin/${item._type}/${item._id}`);
      showToast(`"${itemName(item)}" permanently deleted.`);
      load();
    } catch (err) {
      if (err.response?.status === 404) {
        showToast('Item was already removed. Refreshing…', 'error');
        load();
      } else {
        showToast(err.response?.data?.message || 'Delete failed.', 'error');
      }
    } finally { setWorking(false); }
  };

  /* ── bulk restore ── */
  const handleBulkRestore = async () => {
    const toRestore = items.filter(i => selected.has(i._id));
    if (!toRestore.length) return;
    setWorking(true);
    let ok = 0, fail = 0;
    for (const item of toRestore) {
      try { await api.post(`/recycle-bin/${item._type}/${item._id}/restore`); ok++; }
      catch { fail++; }
    }
    showToast(`${ok} restored${fail ? `, ${fail} failed` : ''}.`, fail ? 'error' : 'success');
    load();
    setWorking(false);
  };
  /* ── bulk permanent delete ── */
  const handleBulkPermanent = async () => {
    const toDelete = items.filter(i => selected.has(i._id));
    if (!toDelete.length) return;
    if (!window.confirm(`Permanently delete ${toDelete.length} item(s)? This cannot be undone.`)) return;
    setWorking(true);
    let ok = 0, fail = 0;
    for (const item of toDelete) {
      try { await api.delete(`/recycle-bin/${item._type}/${item._id}`); ok++; }
      catch { fail++; }
    }
    showToast(`${ok} permanently deleted${fail ? `, ${fail} failed` : ''}.`, fail ? 'error' : 'success');
    load();
    setWorking(false);
  };
  /* ── empty bin ── */
  const handleEmptyBin = async () => {
    if (!window.confirm('Empty the entire recycle bin? All items will be permanently deleted and cannot be recovered.')) return;
    setWorking(true);
    try {
      await api.delete('/recycle-bin/empty');
      showToast('Recycle bin emptied.');
      load();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to empty bin.', 'error');
    } finally { setWorking(false); }
  };

  /* ── counts by type ── */
  const counts = Object.keys(TYPE_META).reduce((acc, k) => {
    acc[k] = items.filter(i => i._type === k).length;
    return acc;
  }, {});

  return (
    <div className="space-y-5 pb-8">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl animate-in slide-in-from-bottom-4 ${
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : 'bg-emerald-600 text-white'
        }`}>
          {toast.msg}
          <button onClick={() => setToast(null)}><X size={15} /></button>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 text-red-600">
            <Trash2 size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-ink-900">Recycle Bin</h1>
            <p className="text-xs text-ink-400">{items.length} deleted item{items.length !== 1 ? 's' : ''} — restore or permanently remove</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-600 hover:bg-ink-50 transition"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          {isAdmin && items.length > 0 && (
            <button
              onClick={handleEmptyBin}
              disabled={working}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              <Trash size={13} /> Empty Bin
            </button>
          )}
        </div>
      </div>
      {/* ── Filter tabs ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[{ key: 'all', label: `All (${items.length})` },
          ...Object.entries(TYPE_META).map(([k, v]) => ({
            key: k, label: `${v.label} (${counts[k]})`,
          }))
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setFilter(tab.key); setSelected(new Set()); }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filter === tab.key
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-ink-200 text-ink-600 hover:border-blue-400 hover:text-blue-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Bulk action bar ── */}
      {someChecked && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5">
          <span className="text-xs font-semibold text-blue-800">{selected.size} selected</span>
          <button
            onClick={handleBulkRestore}
            disabled={working}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
          >
            <RotateCcw size={12} /> Restore Selected
          </button>
          {isAdmin && (
            <button
              onClick={handleBulkPermanent}
              disabled={working}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50"
            >
              <Trash2 size={12} /> Delete Permanently
            </button>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-blue-500 hover:text-blue-700">
            Clear selection
          </button>
        </div>
      )}
      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-red-200/60 bg-white shadow-soft">
        <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(90deg, #991b1b 0%, #dc2626 60%, #ef4444 100%)' }}>
            <tr>
              <th className="w-10 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,200,200,.3)' }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded cursor-pointer accent-white"
                />
              </th>
              {['Type', 'Name / ID', 'Deleted At', 'Deleted By', 'Actions'].map(h => (
                <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-red-100"
                  style={{ borderBottom: '1px solid rgba(255,200,200,.3)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-ink-400">
                <RefreshCw size={18} className="inline animate-spin mr-2 text-blue-500" />Loading…
              </td></tr>
            )}
            {!loading && displayed.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center">
                <Trash2 size={32} className="mx-auto mb-3 text-ink-200" />
                <p className="text-sm font-semibold text-ink-400">Recycle bin is empty</p>
                <p className="text-xs text-ink-300 mt-1">Items you delete will appear here</p>
              </td></tr>
            )}
            {!loading && displayed.map((item, i) => {
              const meta = TYPE_META[item._type] || {};
              const Icon = meta.icon || Trash2;
              const isSelected = selected.has(item._id);
              return (
                <tr
                  key={item._id}
                  className={`transition-colors ${isSelected ? 'bg-red-50/60' : 'hover:bg-ink-50/40'}`}
                  style={{ borderBottom: '1px solid #f1f5f9' }}
                >
                  {/* Checkbox */}
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(item._id)}
                      className="h-4 w-4 rounded accent-red-600 cursor-pointer"
                    />
                  </td>
                  {/* Type badge */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                      <Icon size={11} />
                      {meta.label}
                    </span>
                  </td>

                  {/* Name / details */}
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="font-semibold text-ink-800 truncate">{itemName(item)}</p>
                    {item._type === 'material' && (
                      <p className="text-[11px] text-ink-400">{item.category} · {item.currentStock} {item.unit}</p>
                    )}
                    {item._type === 'supplier' && (
                      <p className="text-[11px] text-ink-400">{item.category || ''} {item.phone ? `· ${item.phone}` : ''}</p>
                    )}
                    {item._type === 'product' && (
                      <p className="text-[11px] text-ink-400">{item.category} · {item.ingredients?.length || 0} ingredients</p>
                    )}
                    {item._type === 'transaction' && (
                      <p className="text-[11px] text-ink-400">{item.voucherType?.replace(/_/g,' ')} · ETB {(item.totalAmount||0).toFixed(2)}</p>
                    )}
                  </td>

                  {/* Deleted at */}
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{fmtDate(item.deletedAt)}</td>

                  {/* Deleted by */}
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-ink-500">{item.deletedBy || '—'}</td>
                  {/* Actions */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRestore(item)}
                        disabled={working}
                        title="Restore"
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white transition disabled:opacity-50"
                      >
                        <RotateCcw size={12} /> Restore
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => handlePermanent(item)}
                          disabled={working}
                          title="Permanently delete"
                          className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Footer count */}
        {!loading && (
          <div className="border-t border-ink-100 px-4 py-2 text-xs text-ink-400">
            {displayed.length} item{displayed.length !== 1 ? 's' : ''} in bin
            {selected.size > 0 && <span className="ml-2 font-semibold text-blue-600">· {selected.size} selected</span>}
          </div>
        )}
      </div>
    </div>
  );
}
