import React, { useEffect, useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Truck, X, Eye } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import RecordAuditTrail from '../components/common/RecordAuditTrail';
import { getStoredCustomOptions, saveStoredCustomOption } from '../utils/customOptions';

const DEFAULT_SUPPLIER_CATEGORIES = [
  'General',
  'Produce & Vegetables',
  'Meat & Poultry',
  'Seafood & Fish',
  'Dairy & Eggs',
  'Bakery & Flour Supplies',
  'Beverages & Soft Drinks',
  'Coffee, Tea & Roastery',
  'Spices & Dry Goods',
  'Cooking Oil & Condiments',
  'Packaging & Disposables',
  'Cleaning & Hygiene',
  'Kitchen Equipment & Maintenance',
];

const emptyForm = { name: '', contactPerson: '', phone: '', email: '', category: '', address: '' };

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategories, setCustomCategories] = useState(() => getStoredCustomOptions('baba_roti_custom_supplier_cats'));
  const { hasRole, can, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('suppliers', 'edit') : hasRole('admin', 'manager', 'operation_manager', 'finance');
  const canDelete = canCrud ? canCrud('suppliers', 'delete') : (hasRole('admin') || can('manageAccounts'));

  const load = () => api.get('/suppliers', { params: { search } }).then(res => {
    setSuppliers(Array.isArray(res.data) ? res.data : []);
    setSelected(new Set());
  }).catch(() => setSuppliers([]));
  useEffect(() => { load(); }, [search]);

  // Dynamic categories with counts
  const categories = useMemo(() => {
    const map = {};
    suppliers.forEach((s) => {
      const cat = (s.category && s.category.trim()) || 'General';
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [suppliers]);

  const supplierCategoryOptions = useMemo(() => {
    const fromDb = suppliers.map((s) => String(s.category || '').trim()).filter(Boolean);
    const active = String(form.category || '').trim();
    return Array.from(new Set([...DEFAULT_SUPPLIER_CATEGORIES, ...fromDb, ...customCategories, ...(active ? [active] : [])]));
  }, [suppliers, customCategories, form.category]);

  // Filtered by category
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (categoryFilter !== 'all') {
        const cat = (s.category && s.category.trim()) || 'General';
        if (cat.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      }
      return true;
    });
  }, [suppliers, categoryFilter]);

  /* ── selection ── */
  const allIds = filteredSuppliers.map(s => s._id);
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someChecked = allIds.some(id => selected.has(id));
  const toggleAll = () => allChecked ? setSelected(new Set()) : setSelected(new Set(allIds));
  const toggleOne = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const openCreate = () => {
    setEditing(null);
    setIsCustomCategory(false);
    setForm(emptyForm);
    setModalOpen(true);
  };
  const openEdit = (s) => {
    setEditing(s);
    setIsCustomCategory(false);
    setForm(s);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanCategory = String(form.category || '').trim();
    const payload = { ...form, category: cleanCategory };
    if (editing) await api.put(`/suppliers/${editing._id}`, payload);
    else await api.post('/suppliers', payload);
    if (cleanCategory) {
      setCustomCategories(saveStoredCustomOption('baba_roti_custom_supplier_cats', cleanCategory, DEFAULT_SUPPLIER_CATEGORIES));
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Move this supplier to recycle bin?')) return;
    await api.delete(`/suppliers/${id}`);
    load();
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selected.size} supplier(s) to recycle bin?`)) return;
    await api.delete('/suppliers/bulk', { data: { ids: [...selected] } });
    load();
  };

  const exportData = useMemo(() => filteredSuppliers.map(s => ({
    'Supplier Name': s.name,
    'Category': s.category || 'General',
    'Contact Person': s.contactPerson || '—',
    'Phone': s.phone || '—',
    'Email': s.email || '—',
    'Address': s.address || '—',
  })), [filteredSuppliers]);

  const pdfColumns = [
    { header: 'Supplier Name', accessor: 'Supplier Name' },
    { header: 'Category', accessor: 'Category' },
    { header: 'Contact Person', accessor: 'Contact Person' },
    { header: 'Phone', accessor: 'Phone' },
    { header: 'Email', accessor: 'Email' },
    { header: 'Address', accessor: 'Address' },
  ];

  const columns = [
    ...(canDelete ? [{
      key: '__check',
      header: (
        <input type="checkbox" checked={allChecked}
          ref={el => { if (el) el.indeterminate = someChecked && !allChecked; }}
          onChange={toggleAll}
          className="h-4 w-4 rounded accent-blue-600 cursor-pointer" />
      ),
      render: (r) => (
        <input type="checkbox" checked={selected.has(r._id)}
          onChange={() => toggleOne(r._id)}
          className="h-4 w-4 rounded accent-blue-600 cursor-pointer" />
      ),
    }] : []),
    {
      key: 'name',
      header: 'Supplier',
      render: (r) => (
        <button
          type="button"
          onClick={() => { setDetailItem(r); setDetailOpen(true); }}
          className="font-semibold text-blue-700 hover:underline text-left cursor-pointer"
        >
          {r.name}
        </button>
      ),
    },
    { key: 'category', header: 'Category' },
    { key: 'contactPerson', header: 'Contact person' },
    { key: 'phone', header: 'Phone' },
    {
      key: 'actions', header: 'Actions',
      render: (r) => (
        <div className="flex gap-1.5 items-center">
          <button
            type="button"
            onClick={() => { setDetailItem(r); setDetailOpen(true); }}
            className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition cursor-pointer"
            title="View supplier & security audit details"
          >
            <Eye size={15} />
          </button>
          {canEdit && (
            <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700" title="Edit"><Pencil size={15} /></button>
          )}
          {canDelete && (
            <button onClick={() => handleDelete(r._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search suppliers…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brass-400" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName="suppliers_directory"
            pdfTitle="Hotel Suppliers Directory"
            pdfColumns={pdfColumns}
          />
          {canEdit && (
            <Button variant="brass" onClick={openCreate}><Plus size={16} /> Add supplier</Button>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {someChecked && canDelete && (
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

      {/* Quick Category Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-ink-100 bg-white p-3 shadow-2xs">
        {/* Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${categoryFilter === 'all'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <Truck size={13} className={categoryFilter === 'all' ? 'text-white' : 'text-blue-600'} />
            <span>All Suppliers</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${categoryFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
              {suppliers.length}
            </span>
          </button>

          {categories.slice(0, 5).map(([cat, count]) => {
            const isActive = categoryFilter.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(isActive ? 'all' : cat)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40'
                  : 'bg-blue-50 text-blue-800 border border-blue-200/80 hover:bg-blue-100'
                  }`}
              >
                <span>{cat}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-blue-200 text-blue-900'
                  }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Category Dropdown */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-ink-600 self-end sm:self-auto">
            <span className="font-medium text-ink-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 outline-none focus:border-blue-500 shadow-2xs"
            >
              <option value="all">All Categories ({suppliers.length})</option>
              {categories.map(([cat, count]) => (
                <option key={cat} value={cat}>{cat} ({count})</option>
              ))}
            </select>
            {categoryFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="text-xs text-ink-400 hover:text-ink-700 underline pl-1"
                title="Reset category"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      <DataTable
        columns={columns}
        data={filteredSuppliers}
        emptyMessage={
          categoryFilter !== 'all'
            ? `No suppliers found in category "${categoryFilter}".`
            : search
              ? `No suppliers matching "${search}".`
              : 'No suppliers yet. Add your first one.'
        }
        title="Supplier Directory"
        icon={<Truck size={15} />}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit supplier' : 'Add supplier'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Supplier name</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="mb-1 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-ink-600">Category</label>
                <button
                  type="button"
                  onClick={() => {
                    const next = !isCustomCategory;
                    setIsCustomCategory(next);
                    if (next) setForm((f) => ({ ...f, category: '' }));
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 whitespace-nowrap"
                >
                  {isCustomCategory ? '← Choose from list' : '+ Register new'}
                </button>
              </div>
              {isCustomCategory ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Type new supplier category…"
                    className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomCategory(false)}
                    className="rounded-lg border border-ink-200 px-2.5 py-2 text-xs text-ink-500 hover:bg-ink-50 transition"
                  >
                    ← List
                  </button>
                </div>
              ) : (
                <select
                  value={form.category || ''}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setIsCustomCategory(true);
                      setForm({ ...form, category: '' });
                    } else {
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                  className="w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm outline-none focus:border-brass-400 cursor-pointer"
                >
                  <option value="">Select category…</option>
                  {supplierCategoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__custom__">✏️ Register new category…</option>
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Contact person</label>
              <input value={form.contactPerson} onChange={e => setForm({ ...form, contactPerson: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Phone</label>
              <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Email</label>
              <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Address</label>
            <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">{editing ? 'Save changes' : 'Add supplier'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Supplier Detail & Security Audit Modal ── */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailItem(null); }}
        title={detailItem?.name || 'Supplier Details'}
        width="max-w-lg"
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm rounded-xl border border-slate-200 bg-white p-3.5">
              <div><p className="text-[11px] text-ink-400">Supplier Name</p><p className="font-semibold">{detailItem.name || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Category</p><p className="font-semibold">{detailItem.category || 'General'}</p></div>
              <div><p className="text-[11px] text-ink-400">Contact Person</p><p className="font-medium">{detailItem.contactPerson || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Phone</p><p className="font-medium">{detailItem.phone || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Email</p><p className="font-medium">{detailItem.email || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Address</p><p className="font-medium">{detailItem.address || '—'}</p></div>
              {detailItem.notes && (
                <div className="col-span-2"><p className="text-[11px] text-ink-400">Notes</p><p className="font-medium">{detailItem.notes}</p></div>
              )}
            </div>

            <RecordAuditTrail record={detailItem} />

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setDetailOpen(false)}>Close</Button>
              {canEdit && (
                <Button variant="brass" onClick={() => { setDetailOpen(false); openEdit(detailItem); }}>
                  <Pencil size={14} /> Edit
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Suppliers;
