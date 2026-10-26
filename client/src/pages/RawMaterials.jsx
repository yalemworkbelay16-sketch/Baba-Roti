import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, Upload, Download, X, Zap, Boxes } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import { exportToExcel } from '../utils/exportUtils';
const emptyForm = { code: '', name: '', category: '', unit: '', currentStock: 0, reorderLevel: 10, unitCost: 0, storeLocation: 'Main Store' };

// Common units for hospitality / kitchen / store
const UNITS = [
  { group: 'Volume',  items: ['Litre (L)', 'Millilitre (ml)', 'Gallon', 'Fluid oz'] },
  { group: 'Weight',  items: ['Kilogram (kg)', 'Gram (g)', 'Pound (lb)', 'Ounce (oz)'] },
  { group: 'Count',   items: ['Piece (Pcs)', 'Dozen', 'Pack', 'Box', 'Carton', 'Bag', 'Bottle', 'Can', 'Roll', 'Sheet'] },
  { group: 'Length',  items: ['Metre (m)', 'Centimetre (cm)'] },
  { group: 'Other',   items: ['Portion', 'Serving', 'Tray', 'Batch', 'Pair', 'Set'] },
];

// Common categories for hospitality / kitchen / store
const CATEGORIES = [
  { group: 'Food & Kitchen', items: ['Produce', 'Meat & Poultry', 'Fish & Seafood', 'Dairy & Eggs', 'Bakery & Pastry', 'Grains', 'Spices & Seasonings', 'Pantry', 'Frozen Foods'] },
  { group: 'Beverages & Bar', items: ['Beverages', 'Soft Drinks & Juices', 'Beer & Wine', 'Liquor & Spirits', 'Coffee & Tea', 'Mineral Water'] },
  { group: 'Housekeeping & Maintenance', items: ['Housekeeping', 'Cleaning Supplies', 'Linens & Bedding', 'Toiletries & Amenities', 'Disposables & Packaging', 'Maintenance & Hardware', 'Stationery'] },
  { group: 'Other', items: ['General'] },
];

const statusBadge = (status) => {
  if (status === 'out_of_stock') return <Badge color="red">Out of stock</Badge>;
  if (status === 'low_stock') return <Badge color="amber">Low stock</Badge>;
  return <Badge color="green">In stock</Badge>;
};

const RawMaterials = () => {
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [unitCustom, setUnitCustom] = useState(false);
  const [categoryCustom, setCategoryCustom] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef();
  const { hasRole, can, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('rawMaterials', 'edit') : (hasRole('admin', 'manager') || can('recordGoods'));
  const canDelete = canCrud ? canCrud('rawMaterials', 'delete') : hasRole('admin');

  const load = () => {
    api.get('/materials', { params: { search } }).then((res) => {
      setMaterials(Array.isArray(res.data) ? res.data : []);
      setSelected(new Set());
    }).catch(() => setMaterials([]));
  };

  useEffect(() => { load(); }, [search]);

  /* ── selection ── */
  const allIds     = materials.map(m => m._id);
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someChecked = allIds.some(id => selected.has(id));
  const toggleAll  = () => allChecked
    ? setSelected(new Set())
    : setSelected(new Set(allIds));
  const toggleOne = id => setSelected(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  /* ── bulk delete ── */
  const handleBulkDelete = async () => {
    if (!window.confirm(`Move ${selected.size} material(s) to recycle bin?`)) return;
    await api.delete('/materials/bulk', { data: { ids: [...selected] } });
    load();
  };

  // Extract unique categories currently in database
  const existingCategories = useMemo(() => {
    const set = new Set();
    materials.forEach(m => {
      if (m.category && m.category.trim()) set.add(m.category.trim());
    });
    return Array.from(set);
  }, [materials]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setUnitCustom(false);
    setCategoryCustom(false);
    setModalOpen(true);
  };
  const openEdit = (m) => {
    // Check if stored unit is in the preset list
    const allUnits = UNITS.flatMap(g => g.items);
    const isPresetUnit = allUnits.includes(m.unit);
    const allCategories = [...CATEGORIES.flatMap(g => g.items), ...existingCategories];
    const isPresetCat = allCategories.includes(m.category);
    setEditing(m);
    setForm(m);
    setUnitCustom(!isPresetUnit && !!m.unit);
    setCategoryCustom(!isPresetCat && !!m.category);
    setModalOpen(true);
  };

  // Auto-generate next sequential RM-XXXX code
  const generateCode = () => {
    const nums = materials
      .map(m => {
        const match = String(m.code || '').match(/^RM-?(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    setForm(f => ({ ...f, code: `RM-${String(next).padStart(4, '0')}` }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editing) {
      await api.put(`/materials/${editing._id}`, form);
    } else {
      await api.post('/materials', form);
    }
    setModalOpen(false);
    load();
  };

  const handleDelete = async (id) => {
    if (!confirm('Move to recycle bin?')) return;
    await api.delete(`/materials/${id}`);
    load();
  };

  const handleExport = async () => {
    const res = await api.get('/materials/export/excel', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'raw_materials.xlsx';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/materials/import/excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult({ type: 'success', message: res.data.message });
      load();
    } catch (err) {
      setImportResult({ type: 'error', message: err.response?.data?.message ?? 'Import failed' });
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await api.get('/materials/template/excel', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'baba_roti_materials_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch (_) {
      const templateData = [
        {
          'Code': 'RM-0001',
          'Material Name': 'Special Bread Flour',
          'Category': 'Bakery & Grains',
          'Unit': 'kg',
          'Current Stock': 50,
          'Reorder Level': 10,
          'Unit Cost (ETB)': 120.0,
          'Store Location': 'Dry Store Room A',
        },
        {
          'Code': 'RM-0002',
          'Material Name': 'Butter Unsalted',
          'Category': 'Dairy & Eggs',
          'Unit': 'kg',
          'Current Stock': 20,
          'Reorder Level': 5,
          'Unit Cost (ETB)': 450.0,
          'Store Location': 'Cold Storage',
        },
        {
          'Code': 'RM-0003',
          'Material Name': 'Coffee Beans Arabica',
          'Category': 'Beverages',
          'Unit': 'kg',
          'Current Stock': 15,
          'Reorder Level': 4,
          'Unit Cost (ETB)': 600.0,
          'Store Location': 'Baristas Cupboard',
        },
      ];
      exportToExcel(templateData, 'baba_roti_materials_template', 'Materials Template');
    }
  };

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
    { key: 'code', header: 'Code', render: (r) => <span className="font-mono text-xs text-ink-400">{r.code || '—'}</span> },
    { key: 'name', header: 'Material' },
    { key: 'category', header: 'Category' },
    { key: 'currentStock', header: 'In stock', render: (r) => <span className="tabular">{r.currentStock} {r.unit}</span> },
    { key: 'reorderLevel', header: 'Reorder at', render: (r) => <span className="tabular">{r.reorderLevel} {r.unit}</span> },
    { key: 'unitCost', header: 'Unit cost', render: (r) => <span className="tabular">ETB {r.unitCost}</span> },
    { key: 'status', header: 'Status', render: (r) => statusBadge(r.status) },
    ...((canEdit || canDelete) ? [{
      key: 'actions', header: '',
      render: (r) => (
        <div className="flex gap-2">
          {canEdit && (
            <button onClick={() => openEdit(r)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-50 hover:text-ink-700" title="Edit"><Pencil size={15} /></button>
          )}
          {canDelete && (
            <button onClick={() => handleDelete(r._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 size={15} /></button>
          )}
        </div>
      ),
    }] : []),
  ];

  const exportData = useMemo(() => {
    return materials.map(m => ({
      'Code': m.code || '—',
      'Material Name': m.name,
      'Category': m.category || 'General',
      'Unit': m.unit || 'pcs',
      'Current Stock': m.currentStock || 0,
      'Reorder Level': m.reorderLevel || 10,
      'Unit Cost (ETB)': Number(m.unitCost || 0).toFixed(2),
      'Store Location': m.storeLocation || 'Main Store',
      'Status': m.status || (m.currentStock <= m.reorderLevel ? 'Low Stock' : 'Optimal'),
    }));
  }, [materials]);

  const pdfColumns = [
    { header: 'Code', accessor: 'Code' },
    { header: 'Material Name', accessor: 'Material Name' },
    { header: 'Category', accessor: 'Category' },
    { header: 'In Stock', accessor: 'In Stock', align: 'right' },
    { header: 'Reorder Level', accessor: 'Reorder Level', align: 'right' },
    { header: 'Unit Cost (ETB)', accessor: 'Unit Cost (ETB)', align: 'right' },
    { header: 'Status', accessor: 'Status', align: 'center' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search materials…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-brass-400"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Template Download Button */}
          {canEdit && (
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-xs hover:border-emerald-300 hover:bg-emerald-100 transition"
              title="Download sample Excel template for importing raw materials"
            >
              <Download size={14} className="text-emerald-700" />
              <span>Template</span>
            </button>
          )}

          {/* Export & Import (Excel, PDF, CSV, Print) */}
          <ExportDropdown
            data={exportData}
            fileName="raw_materials"
            pdfTitle="Raw Materials Inventory List"
            pdfColumns={pdfColumns}
            showImport={canEdit}
            onImport={() => importRef.current?.click()}
            importLabel="Import Excel"
          />
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />

          {canEdit && (
            <Button variant="brass" onClick={openCreate}>
              <Plus size={16} /> Add material
            </Button>
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

      {/* Importing Spinner */}
      {importing && (
        <div className="flex items-center gap-2.5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 animate-pulse">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent flex-shrink-0" />
          <p className="font-medium">Importing materials from Excel and updating inventory...</p>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div className={`flex items-start justify-between rounded-lg border px-4 py-3 text-sm ${
          importResult.type === 'error'
            ? 'border-red-200 bg-red-50 text-red-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}>
          <p className="font-medium">{importResult.message}</p>
          <button onClick={() => setImportResult(null)} className="ml-4 text-ink-400 hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={materials}
        emptyMessage="No raw materials yet. Add your first item."
        title="Raw Materials Inventory"
        icon={<Boxes size={15} />}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit material' : 'Add raw material'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Code</label>
              <div className="flex items-center gap-1.5">
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. RM-0001"
                  className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400"
                />
                <button
                  type="button"
                  onClick={generateCode}
                  title="Auto-generate next code"
                  className="flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition whitespace-nowrap"
                >
                  <Zap size={13} className="text-amber-500" />
                  Auto
                </button>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Category</label>
              {categoryCustom ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Type custom category…"
                    className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400"
                  />
                  <button
                    type="button"
                    onClick={() => { setCategoryCustom(false); setForm(f => ({ ...f, category: '' })); }}
                    className="rounded-lg border border-ink-200 px-2.5 py-2 text-xs text-ink-500 hover:bg-ink-50 transition"
                  >← List</button>
                </div>
              ) : (
                <select
                  value={form.category}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setCategoryCustom(true);
                      setForm(f => ({ ...f, category: '' }));
                    } else {
                      setForm({ ...form, category: e.target.value });
                    }
                  }}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400 bg-white"
                >
                  <option value="">Select category…</option>
                  {existingCategories.filter(c => !CATEGORIES.some(g => g.items.includes(c))).length > 0 && (
                    <optgroup label="Existing in Stock">
                      {existingCategories.filter(c => !CATEGORIES.some(g => g.items.includes(c))).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  )}
                  {CATEGORIES.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">✏️ Custom…</option>
                </select>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Unit *</label>
              {unitCustom ? (
                <div className="flex items-center gap-1.5">
                  <input
                    required
                    autoFocus
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="Type custom unit…"
                    className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400"
                  />
                  <button
                    type="button"
                    onClick={() => { setUnitCustom(false); setForm(f => ({ ...f, unit: '' })); }}
                    className="rounded-lg border border-ink-200 px-2.5 py-2 text-xs text-ink-500 hover:bg-ink-50 transition"
                  >← List</button>
                </div>
              ) : (
                <select
                  required
                  value={form.unit}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setUnitCustom(true);
                      setForm(f => ({ ...f, unit: '' }));
                    } else {
                      setForm({ ...form, unit: e.target.value });
                    }
                  }}
                  className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400 bg-white"
                >
                  <option value="">Select unit…</option>
                  {UNITS.map(group => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">✏️ Custom…</option>
                </select>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Current stock</label>
              <input type="number" step="0.01" required value={form.currentStock}
                onChange={(e) => setForm({ ...form, currentStock: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Reorder level</label>
              <input type="number" step="0.01" required value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Unit cost</label>
              <input type="number" step="0.01" value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink-600">Store location</label>
            <input value={form.storeLocation} onChange={(e) => setForm({ ...form, storeLocation: e.target.value })}
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">{editing ? 'Save changes' : 'Add material'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default RawMaterials;
