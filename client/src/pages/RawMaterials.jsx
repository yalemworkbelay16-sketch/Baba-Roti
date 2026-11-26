import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus, Search, Pencil, Trash2, Upload, Download, X, Zap,
  Boxes, CheckCircle2, AlertTriangle, AlertCircle, Warehouse,
  UtensilsCrossed, Coffee, Sliders, ArrowRightLeft, Send, ArrowRight,
  Factory, ChevronDown, Layers, Eye
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import DataTable from '../components/ui/DataTable';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import RecordAuditTrail from '../components/common/RecordAuditTrail';
import { exportToExcel } from '../utils/exportUtils';
import { buildConflictMap, findLiveConflicts } from '../utils/duplicateFlags';
import { RowWarningFlag, LiveConflictAlert } from '../components/common/DuplicateWarningBadge';

const DISCRETE_UNITS_REGEX = /^(pcs|pc|piece|pieces|egg|eggs|unit|units|item|items|bottle|bottles|can|cans|pack|packs|package|packages|packet|packets|box|boxes|roll|rolls|portion|portions|serving|servings|plate|plates|cup|cups|shot|shots|loaf|loaves|slice|slices)$/i;

const isDiscreteUnit = (unit = '', name = '') => {
  const u = String(unit || '').trim();
  if (DISCRETE_UNITS_REGEX.test(u)) return true;
  const n = String(name || '').toLowerCase();
  if (/\b(egg|eggs|injera|bread|bun|buns|can|bottle)\b/i.test(n) && !/^(kg|kilogram|g|gram|gm|mg|l|ltr|liter|litre|ml|cl|dl)$/i.test(u)) {
    return true;
  }
  return false;
};

const formatQty = (val, unit = '', name = '') => {
  const num = Number(val);
  if (isNaN(num)) return '0';
  if (isDiscreteUnit(unit, name)) {
    return String(Math.round(num));
  }
  if (Math.abs(num) < 0.00001) return '0';
  const r2 = Math.round((num + Number.EPSILON) * 100) / 100;
  if (Math.abs(num - r2) < 0.005) {
    return String(r2);
  }
  return String(Math.round((num + Number.EPSILON) * 1000) / 1000);
};
const emptyForm = {
  code: '',
  name: '',
  category: '',
  unit: '',
  mainStoreStock: 0,
  kitchenStock: 0,
  barStock: 0,
  currentStock: 0,
  reorderLevel: 10,
  unitCost: 0,
  storeLocation: 'Main Store',
};

// Common units for hospitality / kitchen / store
const UNITS = [
  { group: 'Volume', items: ['Litre (L)', 'Millilitre (ml)', 'Gallon', 'Fluid oz'] },
  { group: 'Weight', items: ['Kilogram (kg)', 'Gram (g)', 'Pound (lb)', 'Ounce (oz)'] },
  { group: 'Count', items: ['Piece (Pcs)', 'Dozen', 'Pack', 'Box', 'Carton', 'Bag', 'Bottle', 'Can', 'Roll', 'Sheet'] },
  { group: 'Length', items: ['Metre (m)', 'Centimetre (cm)'] },
  { group: 'Other', items: ['Portion', 'Serving', 'Tray', 'Batch', 'Pair', 'Set'] },
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
  const navigate = useNavigate();
  const { user, hasRole, can, canCrud } = useAuth();
  const userStation = (user?.assignedStation && user?.assignedStation !== 'all')
    ? user.assignedStation
    : String(user?.department || '').toLowerCase().includes('kitchen')
      ? 'kitchen'
      : String(user?.department || '').toLowerCase().includes('bar')
        ? 'bar'
        : user?.assignedStation || 'all';
  const isStationRestricted = userStation !== 'all' && !hasRole('admin', 'manager', 'dev');

  const [searchParams, setSearchParams] = useSearchParams();
  const stationFromUrl = isStationRestricted ? userStation : (searchParams.get('station') || 'all');
  const [stationFilter, setStationFilter] = useState(stationFromUrl);

  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selected, setSelected] = useState(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [unitCustom, setUnitCustom] = useState(false);
  const [categoryCustom, setCategoryCustom] = useState(false);

  // Quick Dispatch / Stock Transfer state (send from Main Store to Kitchen/Bar)
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferForm, setTransferForm] = useState({ toStation: 'kitchen', quantity: 1 });
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null);
  const importRef = useRef();
  const canEdit = canCrud ? canCrud('rawMaterials', 'edit') : (hasRole('admin', 'manager') || can('recordGoods'));
  const canDelete = canCrud ? canCrud('rawMaterials', 'delete') : hasRole('admin');

  useEffect(() => {
    if (isStationRestricted) {
      if (stationFilter !== userStation) {
        setStationFilter(userStation);
      }
      return;
    }
    const fromUrl = searchParams.get('station') || 'all';
    setStationFilter(fromUrl);
  }, [searchParams, isStationRestricted, userStation]);

  const handleStationChange = (newStation) => {
    if (isStationRestricted) return;
    setStationFilter(newStation);
    const next = new URLSearchParams(searchParams);
    if (newStation === 'all') {
      next.delete('station');
    } else {
      next.set('station', newStation);
    }
    setSearchParams(next);
  };

  // Station Category Mapping state loaded from Settings
  const [stationMapping, setStationMapping] = useState({
    'Bar': 'bar',
    'Kitchen': 'kitchen',
    'ferash Bazare': 'kitchen',
    'Mendi': 'kitchen',
    'Pastery': 'kitchen',
    'CleanerMaterial': 'mainStore',
    'Material': 'mainStore',
  });

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

  const getMaterialStation = (m) => {
    if (m?.isProduced && m?.productionStation && m?.productionStation !== 'none') {
      return m.productionStation;
    }
    const cat = String(m?.category || '').trim();
    if (stationMapping[cat]) return stationMapping[cat];
    const loc = String(m?.storeLocation || '').toLowerCase();
    if (loc.includes('kitchen') && !loc.includes('main')) return 'kitchen';
    if (loc.includes('bar') && !loc.includes('main')) return 'bar';
    const lower = cat.toLowerCase();
    const lowerName = String(m?.name || '').toLowerCase();
    if (
      lower === 'bar' ||
      /beverage|drink|coffee|tea|juice|soda|beer|wine|water|liquor|spirit/i.test(lower) ||
      /coffee|tea|espresso|latte|cappuccino|macchiato|juice|smoothie|soda|cocktail|beer|wine/i.test(lowerName)
    ) {
      return 'bar';
    }
    if (
      lower === 'kitchen' ||
      lower === 'ferash bazare' ||
      lower === 'fresh bazar' ||
      lower === 'fresh bazaar' ||
      lower === 'mendi' ||
      lower === 'pastery' ||
      lower === 'pastry' ||
      lower === 'food' ||
      /produce|meat|poultry|dairy|egg|bakery|grain|spice|seasoning|food|fresh|fruit|veg|oil|sauce|salt|sugar|flour|injera/i.test(lower) ||
      /meat|siga|shinkurt|onion|tomato|tibs|injera|bread|flour|butter|oil|egg|spice|garlic|ginger/i.test(lowerName)
    ) {
      return 'kitchen';
    }
    return 'mainStore';
  };

  const load = () => {
    api.get('/materials', { params: { search } }).then((res) => {
      setMaterials(Array.isArray(res.data) ? res.data : []);
      setSelected(new Set());
    }).catch(() => setMaterials([]));
  };

  useEffect(() => { load(); }, [search]);

  // Reset category filter when station view changes
  useEffect(() => {
    setCategoryFilter('all');
  }, [stationFilter]);

  // Determine material status relative to the current station
  const getMaterialStatusForStation = (m, station) => {
    if (station === 'kitchen') {
      const val = Number(m.kitchenStock || 0);
      const reorder = Number(m.reorderLevel || 10);
      if (val <= 0) return 'out_of_stock';
      if (val <= reorder) return 'low_stock';
      return 'in_stock';
    }
    if (station === 'bar') {
      const val = Number(m.barStock || 0);
      const reorder = Number(m.reorderLevel || 10);
      if (val <= 0) return 'out_of_stock';
      if (val <= reorder) return 'low_stock';
      return 'in_stock';
    }
    return m.status;
  };

  // Station subset: which materials belong to the current station view
  const stationSubset = useMemo(() => {
    return materials.filter((m) => {
      const st = getMaterialStation(m);
      if (stationFilter === 'kitchen') {
        const kVal = Number(m.kitchenStock || 0);
        return st === 'kitchen' || kVal > 0;
      }
      if (stationFilter === 'bar') {
        const bVal = Number(m.barStock || 0);
        return st === 'bar' || (bVal > 0 && st !== 'kitchen');
      }
      // Main Store holds 100% of materials as central mother warehouse
      return true;
    });
  }, [materials, stationFilter, stationMapping]);

  // Contextual status counters scoped to the active station and selected category
  const counts = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let total = 0;
    stationSubset.forEach((m) => {
      if (categoryFilter === 'all' || m.category === categoryFilter) {
        total++;
        const s = getMaterialStatusForStation(m, stationFilter);
        if (s === 'out_of_stock') outOfStock++;
        else if (s === 'low_stock') lowStock++;
        else inStock++;
      }
    });
    return {
      all: total,
      inStock,
      lowStock,
      outOfStock,
    };
  }, [stationSubset, categoryFilter, stationFilter]);

  // Global station counters for badges and switcher
  const stationCounts = useMemo(() => {
    let kitchen = 0;
    let bar = 0;
    materials.forEach((m) => {
      const st = getMaterialStation(m);
      const kVal = Number(m.kitchenStock || 0);
      const bVal = Number(m.barStock || 0);
      if (st === 'kitchen' || kVal > 0) kitchen++;
      if (st === 'bar' || (bVal > 0 && st !== 'kitchen')) bar++;
    });
    // Main Store is the mother warehouse holding ALL items (161 / 100%)
    return { all: materials.length, main: materials.length, kitchen, bar };
  }, [materials, stationMapping]);

  const materialConflicts = useMemo(() => buildConflictMap(materials), [materials]);
  const liveMaterialConflicts = useMemo(
    () => (modalOpen ? findLiveConflicts(materials, { code: form.code, name: form.name, excludeId: editing?._id }) : null),
    [modalOpen, materials, form.code, form.name, editing]
  );

  // Filtered materials by status, warnings, category, and station
  const filteredMaterials = useMemo(() => {
    return stationSubset.filter((m) => {
      if (categoryFilter !== 'all' && m.category !== categoryFilter) return false;
      if (statusFilter === 'warnings') {
        return Boolean(materialConflicts.byId.get(String(m._id))?.hasWarning);
      }
      const s = getMaterialStatusForStation(m, stationFilter);
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      return true;
    });
  }, [stationSubset, statusFilter, categoryFilter, stationFilter, materialConflicts]);

  /* ── selection ── */
  const allIds = filteredMaterials.map(m => m._id);
  const allChecked = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someChecked = allIds.some(id => selected.has(id));
  const toggleAll = () => allChecked
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

  // Extract unique categories currently available in the active station view
  const { existingCategories, categoryItemCounts } = useMemo(() => {
    const countsMap = {};
    const set = new Set();
    stationSubset.forEach(m => {
      const cat = m.category && m.category.trim() ? m.category.trim() : 'General';
      set.add(cat);
      countsMap[cat] = (countsMap[cat] || 0) + 1;
    });
    return {
      existingCategories: Array.from(set).sort((a, b) => a.localeCompare(b)),
      categoryItemCounts: countsMap,
    };
  }, [stationSubset]);

  const getNextMaterialCode = () => {
    const nums = materials
      .map(m => {
        const match = String(m.code || '').match(/^RM-?(\d+)$/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => n > 0);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `RM-${String(next).padStart(4, '0')}`;
  };

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    const initialLocation = stationFilter === 'kitchen'
      ? 'Kitchen Station'
      : stationFilter === 'bar'
        ? 'Bar Station'
        : 'Main Store';
    setForm({
      ...emptyForm,
      code: getNextMaterialCode(),
      storeLocation: initialLocation,
    });
    setUnitCustom(false);
    setCategoryCustom(false);
    setModalOpen(true);
  };
  const openEdit = (m) => {
    setFormError('');
    // Check if stored unit is in the preset list
    const allUnits = UNITS.flatMap(g => g.items);
    const isPresetUnit = allUnits.includes(m.unit);
    const allCategories = [...CATEGORIES.flatMap(g => g.items), ...existingCategories];
    const isPresetCat = allCategories.includes(m.category);
    setEditing(m);
    setForm({
      ...m,
      code: m.code || '',
      mainStoreStock: m.mainStoreStock !== undefined ? m.mainStoreStock : m.currentStock || 0,
      kitchenStock: m.kitchenStock || 0,
      barStock: m.barStock || 0,
      currentStock: m.currentStock || 0,
    });
    setUnitCustom(!isPresetUnit && !!m.unit);
    setCategoryCustom(!isPresetCat && !!m.category);
    setModalOpen(true);
  };

  // Auto-generate next sequential RM-XXXX code
  const generateCode = () => {
    setForm(f => ({ ...f, code: getNextMaterialCode() }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const rawCode = (form.code || '').trim();
    const rawName = (form.name || '').trim();
    if (!rawCode) {
      setFormError('Item / Material Code is required.');
      return;
    }
    if (!rawName) {
      setFormError('Item / Material Name is required.');
      return;
    }

    const codeConflict = materials.find(m => {
      if (editing && String(m._id) === String(editing._id)) return false;
      return String(m.code || '').trim().toLowerCase() === rawCode.toLowerCase();
    });
    if (codeConflict) {
      setFormError(`Code "${rawCode}" is already used by "${codeConflict.name}". Duplicate code is not allowed.`);
      return;
    }

    const nameConflict = materials.find(m => {
      if (editing && String(m._id) === String(editing._id)) return false;
      return String(m.name || '').trim().toLowerCase() === rawName.toLowerCase();
    });
    if (nameConflict) {
      setFormError(`An item named "${rawName}" already exists (Code: ${nameConflict.code || '—'}). Duplicate name is not allowed.`);
      return;
    }

    try {
      const payload = { ...form, code: rawCode, name: rawName };
      if (editing) {
        await api.put(`/materials/${editing._id}`, payload);
      } else {
        await api.post('/materials', payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save item.');
    }
  };

  const openTransfer = (m) => {
    const dest = getMaterialStation(m) === 'bar' ? 'bar' : 'kitchen';
    const mainAvail = Number(m.mainStoreStock !== undefined ? m.mainStoreStock : m.currentStock || 0);
    setTransferItem(m);
    setTransferForm({
      toStation: dest,
      quantity: mainAvail > 0 ? mainAvail : 1,
    });
    setTransferModalOpen(true);
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferItem) return;
    const qty = Number(transferForm.quantity);
    if (!qty || qty <= 0) {
      alert('Please enter a valid transfer quantity greater than 0.');
      return;
    }
    const currentMain = Number(transferItem.mainStoreStock !== undefined ? transferItem.mainStoreStock : transferItem.currentStock || 0);
    if (qty > currentMain) {
      alert(`Cannot transfer ${qty} ${transferItem.unit || ''}. Only ${currentMain} ${transferItem.unit || ''} available in Main Store.`);
      return;
    }

    setTransferSubmitting(true);
    const currentK = Number(transferItem.kitchenStock || 0);
    const currentB = Number(transferItem.barStock || 0);

    const payload = {
      mainStoreStock: Math.max(0, currentMain - qty),
      kitchenStock: transferForm.toStation === 'kitchen' ? currentK + qty : currentK,
      barStock: transferForm.toStation === 'bar' ? currentB + qty : currentB,
    };
    payload.currentStock = payload.mainStoreStock + payload.kitchenStock + payload.barStock;

    try {
      await api.put(`/materials/${transferItem._id}`, payload);
      setTransferModalOpen(false);
      setTransferItem(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch stock.');
    } finally {
      setTransferSubmitting(false);
    }
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
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportResult(null);
    setImportProgress({
      running: true,
      percent: 15,
      current: 0,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    });

    const fd = new FormData();
    fd.append('file', file);

    let progressTimer = null;

    try {
      progressTimer = setInterval(() => {
        setImportProgress((prev) => {
          if (!prev || !prev.running) return prev;
          const next = Math.min(94, (prev.percent || 15) + (prev.percent < 70 ? 12 : 3));
          return { ...prev, percent: next };
        });
      }, 200);

      const res = await api.post('/materials/import/excel', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        onUploadProgress: (evt) => {
          if (evt.total && evt.total > 0) {
            const uploadPct = Math.round((evt.loaded / evt.total) * 65);
            setImportProgress((prev) => ({
              ...(prev || {}),
              running: true,
              percent: Math.max(prev?.percent || 0, Math.min(65, uploadPct)),
            }));
          }
        },
      });

      if (progressTimer) clearInterval(progressTimer);

      const totalCount = res.data?.total || ((res.data?.created || 0) + (res.data?.updated || 0) + (res.data?.skipped || 0));
      const createdCount = res.data?.created || 0;
      const updatedCount = res.data?.updated || 0;
      const skippedCount = res.data?.skipped || 0;

      setImportProgress({
        running: false,
        percent: 100,
        current: totalCount,
        total: totalCount,
        created: createdCount,
        updated: updatedCount,
        skipped: skippedCount,
      });

      setImportResult({
        type: 'success',
        message: res.data?.message || `Import complete: ${createdCount} created, ${updatedCount} updated out of ${totalCount} items.`,
      });

      await load();

      setTimeout(() => {
        setImportProgress(null);
      }, 2500);

    } catch (err) {
      if (progressTimer) clearInterval(progressTimer);
      setImportProgress(null);

      let errMsg = 'Import failed. Please check your Excel file format and try again.';
      if (err.response?.data?.message) {
        errMsg = err.response.data.message;
      } else if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        errMsg = 'The upload timed out. Please try importing in smaller batches.';
      } else if (err.message) {
        errMsg = err.message;
      }

      setImportResult({
        type: 'error',
        message: errMsg,
      });
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

  const columns = useMemo(() => {
    const isKitchen = stationFilter === 'kitchen';
    const isBar = stationFilter === 'bar';
    const isMainOrAll = stationFilter === 'main' || stationFilter === 'all';

    return [
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
      {
        key: 'name',
        header: 'Material',
        render: (r) => {
          const conflict = materialConflicts.byId.get(String(r._id));
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => { setDetailItem(r); setDetailOpen(true); }}
                className="font-semibold text-blue-700 hover:underline text-left cursor-pointer"
              >
                {r.name}
              </button>
              {r.isProduced && (
                <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold tracking-tight ${r.productionStation === 'bar' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                  {r.productionStation === 'bar' ? '☕ Bar Produced' : '🍳 Kitchen Produced'}
                </span>
              )}
              {conflict?.hasWarning && (
                <RowWarningFlag conflict={conflict} canEdit={canEdit} onEdit={() => openEdit(r)} />
              )}
            </div>
          );
        },
      },
      { key: 'category', header: 'Category' },

      // 🍳 Kitchen Station: Display ONLY Kitchen Working Balance (Hide Main Store, Hide Bar, Hide Total)
      ...(isKitchen ? [{
        key: 'kitchenStock',
        header: (
          <span className="inline-flex items-center gap-1.5 text-white font-bold uppercase tracking-wider" title="Kitchen Working Stock Balance">
            <UtensilsCrossed size={14} className="text-amber-300" /> Kitchen Balance
          </span>
        ),
        render: (r) => {
          const val = Number(r.kitchenStock || 0);
          return (
            <span className={`tabular font-bold text-sm ${val > 0 ? 'text-amber-700' : 'text-rose-600 font-bold'}`}>
              {formatQty(val, r.unit, r.name)} <span className="text-[11px] font-normal text-ink-500">{r.unit}</span>
            </span>
          );
        },
      }] : []),

      // ☕ Bar Station: Display ONLY Bar Working Balance (Hide Main Store, Hide Kitchen, Hide Total)
      ...(isBar ? [{
        key: 'barStock',
        header: (
          <span className="inline-flex items-center gap-1.5 text-white font-bold uppercase tracking-wider" title="Bar Working Stock Balance">
            <Coffee size={14} className="text-emerald-300" /> Bar Balance
          </span>
        ),
        render: (r) => {
          const val = Number(r.barStock || 0);
          return (
            <span className={`tabular font-bold text-sm ${val > 0 ? 'text-emerald-700' : 'text-rose-600 font-bold'}`}>
              {formatQty(val, r.unit, r.name)} <span className="text-[11px] font-normal text-ink-500">{r.unit}</span>
            </span>
          );
        },
      }] : []),

      // 🏢 Main Store & All Stations: Display NORMAL breakdown (Main Store, Kitchen, Bar, Total Stock)
      // Because Main Store is the top mother warehouse overseeing all stations!
      ...(isMainOrAll ? [
        {
          key: 'mainStoreStock',
          header: (
            <span className="inline-flex items-center gap-1.5 text-white font-bold uppercase tracking-wider" title="Main Store Central Warehouse">
              <Warehouse size={13} className="text-sky-300" /> Main Store Item
            </span>
          ),
          render: (r) => {
            const val = Number(r.mainStoreStock !== undefined ? r.mainStoreStock : r.currentStock ?? 0);
            return (
              <span className={`tabular font-semibold ${val > 0 ? 'text-blue-700' : 'text-ink-400'}`}>
                {formatQty(val, r.unit, r.name)} <span className="text-[11px] font-normal text-ink-500">{r.unit}</span>
              </span>
            );
          },
        },
        {
          key: 'kitchenStock',
          header: (
            <span className="inline-flex items-center gap-1.5 text-white font-bold uppercase tracking-wider" title="Kitchen Station Working Stock">
              <UtensilsCrossed size={13} className="text-amber-300" /> Kitchen
            </span>
          ),
          render: (r) => {
            const val = Number(r.kitchenStock || 0);
            return (
              <span className={`tabular font-semibold ${val > 0 ? 'text-amber-700 font-semibold' : 'text-ink-300'}`}>
                {val > 0 ? `${formatQty(val, r.unit, r.name)} ` : '—'}
                {val > 0 && <span className="text-[11px] font-normal text-ink-500">{r.unit}</span>}
              </span>
            );
          },
        },
        {
          key: 'barStock',
          header: (
            <span className="inline-flex items-center gap-1.5 text-white font-bold uppercase tracking-wider" title="Bar Station Working Stock">
              <Coffee size={13} className="text-emerald-300" /> Bar
            </span>
          ),
          render: (r) => {
            const val = Number(r.barStock || 0);
            return (
              <span className={`tabular font-semibold ${val > 0 ? 'text-emerald-700 font-semibold' : 'text-ink-300'}`}>
                {val > 0 ? `${formatQty(val, r.unit, r.name)} ` : '—'}
                {val > 0 && <span className="text-[11px] font-normal text-ink-500">{r.unit}</span>}
              </span>
            );
          },
        },
        {
          key: 'currentStock',
          header: (
            <span className="text-white font-bold uppercase tracking-wider">Total Stock</span>
          ),
          render: (r) => (
            <span className="tabular font-bold text-ink-900">
              {formatQty(r.currentStock, r.unit, r.name)} <span className="text-[11px] font-normal text-ink-500">{r.unit}</span>
            </span>
          ),
        },
      ] : []),

      { key: 'reorderLevel', header: 'Reorder at', render: (r) => <span className="tabular text-xs text-ink-500">{r.reorderLevel} {r.unit}</span> },
      { key: 'unitCost', header: 'Unit cost', render: (r) => <span className="tabular text-xs font-semibold text-ink-800">ETB {Number(r.unitCost || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> },
      {
        key: 'status',
        header: 'Status',
        render: (r) => {
          const s = getMaterialStatusForStation(r, stationFilter);
          return statusBadge(s);
        },
      },
      {
        key: 'actions', header: 'Actions',
        render: (r) => (
          <div className="flex gap-1.5 items-center justify-end">
            <button
              type="button"
              onClick={() => { setDetailItem(r); setDetailOpen(true); }}
              className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition cursor-pointer"
              title="View material & security audit details"
            >
              <Eye size={15} />
            </button>
            {canEdit && (
              <button
                type="button"
                onClick={() => openTransfer(r)}
                className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition"
                title="Send / Transfer from Main Store to Kitchen or Bar"
              >
                <ArrowRightLeft size={14} />
              </button>
            )}
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
  }, [stationFilter, allChecked, someChecked, selected, canEdit, canDelete, materialConflicts]);

  const exportData = useMemo(() => {
    const isKitchen = stationFilter === 'kitchen';
    const isBar = stationFilter === 'bar';
    const isMain = stationFilter === 'main';

    return filteredMaterials.map(m => {
      const row = {
        'Code': m.code || '—',
        'Material Name': m.name,
        'Category': m.category || 'General',
        'Unit': m.unit || 'pcs',
      };
      if (isKitchen) {
        row['Kitchen Balance'] = Number(m.kitchenStock || 0);
      } else if (isBar) {
        row['Bar Balance'] = Number(m.barStock || 0);
      } else if (isMain) {
        row['Warehouse Stock'] = Number(m.mainStoreStock !== undefined ? m.mainStoreStock : m.currentStock ?? 0);
        row['Total Stock'] = Number(m.currentStock || 0);
      } else {
        row['Main Store'] = Number(m.mainStoreStock !== undefined ? m.mainStoreStock : m.currentStock ?? 0);
        row['Kitchen'] = Number(m.kitchenStock || 0);
        row['Bar'] = Number(m.barStock || 0);
        row['Total Stock'] = Number(m.currentStock || 0);
      }
      row['Reorder Level'] = Number(m.reorderLevel || 10);
      row['Unit Cost (ETB)'] = Number(m.unitCost || 0);
      row['Store Location'] = m.storeLocation || 'Main Store';
      const effStatus = getMaterialStatusForStation(m, stationFilter);
      row['Status'] = effStatus === 'out_of_stock' ? 'Out of stock' : effStatus === 'low_stock' ? 'Low stock' : 'In stock';
      return row;
    });
  }, [filteredMaterials, stationFilter]);

  const pdfColumns = useMemo(() => {
    const isKitchen = stationFilter === 'kitchen';
    const isBar = stationFilter === 'bar';
    const isMain = stationFilter === 'main';

    return [
      { header: 'Code', accessor: 'Code' },
      { header: 'Material Name', accessor: 'Material Name' },
      { header: 'Category', accessor: 'Category' },
      ...(isKitchen ? [{ header: 'Kitchen Balance', accessor: 'Kitchen Balance', align: 'right' }] : []),
      ...(isBar ? [{ header: 'Bar Balance', accessor: 'Bar Balance', align: 'right' }] : []),
      ...(isMain ? [
        { header: 'Warehouse Stock', accessor: 'Warehouse Stock', align: 'right' },
        { header: 'Total Stock', accessor: 'Total Stock', align: 'right' },
      ] : []),
      ...(!isKitchen && !isBar && !isMain ? [
        { header: 'Main Store', accessor: 'Main Store', align: 'right' },
        { header: 'Kitchen', accessor: 'Kitchen', align: 'right' },
        { header: 'Bar', accessor: 'Bar', align: 'right' },
        { header: 'Total Stock', accessor: 'Total Stock', align: 'right' },
      ] : []),
      { header: 'Reorder Level', accessor: 'Reorder Level', align: 'right' },
      { header: 'Unit Cost (ETB)', accessor: 'Unit Cost (ETB)', align: 'right' },
      { header: 'Status', accessor: 'Status', align: 'center' },
    ];
  }, [stationFilter]);

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

      {/* Import Progress Bar in Percent */}
      {importProgress && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 px-4 py-3.5 space-y-2 shadow-2xs">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-blue-900">
              <Upload size={16} className="text-blue-600 animate-bounce" />
              Importing materials & updating inventory…
            </span>
            <span className="tabular text-blue-700 font-bold text-base">{importProgress.percent}%</span>
          </div>

          {/* Progress bar track & filler */}
          <div className="h-3.5 w-full overflow-hidden rounded-full bg-blue-200/80 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 transition-all duration-300 shadow-sm"
              style={{ width: `${Math.max(importProgress.percent, 3)}%` }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-blue-700 pt-0.5">
            <span className="font-medium">{importProgress.current} / {importProgress.total} rows processed</span>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-emerald-700">✓ {importProgress.created} created</span>
              <span className="font-semibold text-indigo-700">↻ {importProgress.updated} updated</span>
              {importProgress.skipped > 0 && <span className="font-semibold text-amber-700">⚠ {importProgress.skipped} skipped</span>}
            </div>
          </div>
        </div>
      )}

      {/* Import Result Banner */}
      {importResult && (
        <div className={`flex items-start justify-between rounded-lg border px-4 py-3 text-sm ${importResult.type === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}>
          <p className="font-medium">{importResult.message}</p>
          <button onClick={() => setImportResult(null)} className="ml-4 text-ink-400 hover:text-ink-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Station / Store Location Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-2xl border border-ink-200/90 bg-white p-2.5 shadow-2xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-ink-500 uppercase tracking-wider pl-2 pr-1 flex items-center gap-1.5">
            <Boxes size={14} className="text-ink-600" /> Station View:
          </span>

          {!isStationRestricted && (
            <button
              type="button"
              onClick={() => handleStationChange('all')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${stationFilter === 'all'
                ? 'bg-ink-900 text-white shadow-xs'
                : 'bg-ink-50 text-ink-700 border border-ink-200/80 hover:bg-ink-100'
                }`}
            >
              All Stations ({stationCounts.all})
            </button>
          )}

          {(!isStationRestricted || userStation === 'main') && (
            <button
              type="button"
              onClick={() => handleStationChange('main')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${stationFilter === 'main'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40'
                : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
            >
              <Warehouse size={13} /> 🏢 Main Store Item ({stationCounts.main})
            </button>
          )}

          {(!isStationRestricted || userStation === 'kitchen') && (
            <button
              type="button"
              onClick={() => handleStationChange('kitchen')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${stationFilter === 'kitchen'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-400/40'
                : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                }`}
            >
              <UtensilsCrossed size={13} /> 🍳 Kitchen Station ({stationCounts.kitchen})
            </button>
          )}

          {(!isStationRestricted || userStation === 'bar') && (
            <button
              type="button"
              onClick={() => handleStationChange('bar')}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer ${stationFilter === 'bar'
                ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/40'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
            >
              <Coffee size={13} /> ☕ Bar Station ({stationCounts.bar})
            </button>
          )}

          {/* Kitchen & Bar Production Link */}
          <Link
            to="/production"
            className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100 hover:border-purple-300"
            title="Go to Kitchen & Bar Production management"
          >
            <Factory size={13} className="text-purple-600" /> 🏭 Kitchen & Bar Production
          </Link>

          {/* Quick Selection Dropdown Box */}
          <div className="relative inline-flex items-center ml-1">
            <select
              value={stationFilter}
              onChange={(e) => {
                if (e.target.value === 'production') {
                  navigate('/production');
                } else {
                  handleStationChange(e.target.value);
                }
              }}
              className="appearance-none rounded-xl border border-ink-200 bg-ink-50/90 pl-3 pr-8 py-1.5 text-xs font-bold text-ink-800 hover:bg-ink-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
              title="Select Store or Production Station"
            >
              <option value="all">🌐 All Stations ({stationCounts.all})</option>
              <option value="main">🏢 Main Store Item ({stationCounts.main})</option>
              <option value="kitchen">🍳 Kitchen Store ({stationCounts.kitchen})</option>
              <option value="bar">☕ Bar Store ({stationCounts.bar})</option>
              <option value="production">🏭 Kitchen & Bar Production</option>
            </select>
            <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-ink-500" />
          </div>

          {isStationRestricted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 ml-1">
              🔒 Scoped to assigned station
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5 flex-wrap pr-1">
          {stationFilter !== 'all' && (
            <span className="text-[11px] font-semibold text-ink-500">
              Showing {filteredMaterials.length} items for <strong className="text-ink-900 capitalize">{stationFilter === 'main' ? 'Main Store Item' : stationFilter} Station</strong>
            </span>
          )}
          {!isStationRestricted && hasRole('admin', 'manager') && (
            <Link
              to="/settings?tab=stations"
              className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50/80 hover:bg-blue-100 px-3 py-1.5 text-xs font-bold text-blue-700 transition shadow-2xs"
              title="Configure which raw material & recipe categories belong to Kitchen, Bar, or Main Store"
            >
              <Sliders size={12} className="text-blue-600" />
              <span>Map Stations</span>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Status Filter Tabs / Badges */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-ink-200/80 bg-white p-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* All */}
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'all'
              ? 'bg-ink-900 text-white shadow-xs'
              : 'bg-ink-50 text-ink-600 hover:bg-ink-100 hover:text-ink-900'
              }`}
          >
            <span>All</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'all' ? 'bg-white/20 text-white' : 'bg-ink-200 text-ink-700'
              }`}>
              {counts.all}
            </span>
          </button>

          {/* Normal / In Stock */}
          <button
            type="button"
            onClick={() => setStatusFilter('in_stock')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'in_stock'
              ? 'bg-emerald-600 text-white shadow-xs ring-2 ring-emerald-400/40'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200/80 hover:bg-emerald-100'
              }`}
          >
            <CheckCircle2 size={13} className={statusFilter === 'in_stock' ? 'text-white' : 'text-emerald-600'} />
            <span>Normal (In Stock)</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'in_stock' ? 'bg-white/25 text-white' : 'bg-emerald-200 text-emerald-900'
              }`}>
              {counts.inStock}
            </span>
          </button>

          {/* Low Level */}
          <button
            type="button"
            onClick={() => setStatusFilter('low_stock')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'low_stock'
              ? 'bg-amber-500 text-white shadow-xs ring-2 ring-amber-400/40'
              : 'bg-amber-50 text-amber-800 border border-amber-200/80 hover:bg-amber-100'
              }`}
          >
            <AlertTriangle size={13} className={statusFilter === 'low_stock' ? 'text-white' : 'text-amber-600'} />
            <span>Low Level</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'low_stock' ? 'bg-white/25 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
              {counts.lowStock}
            </span>
          </button>

          {/* Out of Stock */}
          <button
            type="button"
            onClick={() => setStatusFilter('out_of_stock')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'out_of_stock'
              ? 'bg-red-600 text-white shadow-xs ring-2 ring-red-400/40'
              : 'bg-red-50 text-red-800 border border-red-200/80 hover:bg-red-100'
              }`}
          >
            <AlertCircle size={13} className={statusFilter === 'out_of_stock' ? 'text-white' : 'text-red-600'} />
            <span>Out of Stock</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'out_of_stock' ? 'bg-white/25 text-white' : 'bg-red-200 text-red-900'
              }`}>
              {counts.outOfStock}
            </span>
          </button>

          {/* Duplicate / Missing Code Warnings */}
          {materialConflicts.flaggedCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'warnings' ? 'all' : 'warnings')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${statusFilter === 'warnings'
                ? 'bg-rose-600 text-white shadow-xs ring-2 ring-rose-400/40'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              title="Show items with duplicate name, duplicate code, or missing code"
            >
              <AlertTriangle size={13} className={statusFilter === 'warnings' ? 'text-white' : 'text-rose-600'} />
              <span>Warnings</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${statusFilter === 'warnings' ? 'bg-white/25 text-white' : 'bg-rose-200 text-rose-900'
                }`}>
                {materialConflicts.flaggedCount}
              </span>
            </button>
          )}
        </div>

        {/* Quick Category Filter */}
        {existingCategories.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-ink-600 self-end sm:self-auto">
            <span className="font-medium text-ink-400">Category:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 outline-none focus:border-brass-400 shadow-2xs"
            >
              <option value="all">All Categories ({stationSubset.length})</option>
              {existingCategories.map((c) => (
                <option key={c} value={c}>{c} ({categoryItemCounts[c] || 0})</option>
              ))}
            </select>
            {(statusFilter !== 'all' || categoryFilter !== 'all') && (
              <button
                type="button"
                onClick={() => { setStatusFilter('all'); setCategoryFilter('all'); }}
                className="text-xs text-ink-400 hover:text-ink-700 underline pl-1"
                title="Reset filters"
              >
                Reset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Active Filter Helper Banner when Category is Narrowed Down */}
      {categoryFilter !== 'all' && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-blue-50/90 border border-blue-200 px-3.5 py-2 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-blue-700">Category:</span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-blue-950 font-bold">{categoryFilter}</span>
            <span className="text-blue-600 font-medium">({filteredMaterials.length} of {categoryItemCounts[categoryFilter] || 0} items)</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className="font-bold text-blue-700 hover:text-blue-950 underline cursor-pointer"
              >
                View all {globalCounts[statusFilter === 'in_stock' ? 'inStock' : statusFilter === 'low_stock' ? 'lowStock' : 'outOfStock']} {statusFilter === 'in_stock' ? 'Normal' : statusFilter === 'low_stock' ? 'Low Level' : 'Out of Stock'} items across all categories
              </button>
            )}
            <button
              type="button"
              onClick={() => setCategoryFilter('all')}
              className="rounded-lg bg-white border border-blue-300 px-2 py-0.5 text-[11px] font-semibold text-blue-800 hover:bg-blue-100 shadow-2xs transition cursor-pointer"
              title="Show all categories"
            >
              Show All Categories
            </button>
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        data={filteredMaterials}
        emptyMessage={
          statusFilter === 'out_of_stock'
            ? 'No out-of-stock items found.'
            : statusFilter === 'low_stock'
              ? 'No low-level stock items found.'
              : statusFilter === 'in_stock'
                ? 'No normal in-stock items found.'
                : categoryFilter !== 'all'
                  ? `No items found in category "${categoryFilter}".`
                  : 'No raw materials yet. Add your first item.'
        }
        title="Raw Materials Inventory"
        icon={<Boxes size={15} />}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit material' : 'Add raw material'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {formError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              ⚠ {formError}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Code *</label>
              <div className="flex items-center gap-1.5">
                <input
                  required
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
              <label className="mb-1 block text-sm font-medium text-ink-600">Name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          <LiveConflictAlert live={liveMaterialConflicts} canEdit={canEdit} onEditExisting={(item) => openEdit(item)} />
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
          {/* Station Stocks breakdown */}
          <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
            <div className="text-xs font-bold text-ink-700 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Inventory by Station / Department</span>
              <span className="text-ink-500 font-semibold text-[11px]">
                Total: <strong className="text-ink-900 font-bold">{((Number(form.mainStoreStock) || 0) + (Number(form.kitchenStock) || 0) + (Number(form.barStock) || 0))} {form.unit || ''}</strong>
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-blue-700 flex items-center gap-1">
                  <Warehouse size={12} /> Main Store
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.mainStoreStock ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    const k = Number(form.kitchenStock || 0);
                    const b = Number(form.barStock || 0);
                    setForm({ ...form, mainStoreStock: val, currentStock: (Number(val) || 0) + k + b });
                  }}
                  className="w-full rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-blue-900 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-amber-700 flex items-center gap-1">
                  <UtensilsCrossed size={12} /> Kitchen
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.kitchenStock ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    const m = Number(form.mainStoreStock || 0);
                    const b = Number(form.barStock || 0);
                    setForm({ ...form, kitchenStock: val, currentStock: m + (Number(val) || 0) + b });
                  }}
                  className="w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-emerald-700 flex items-center gap-1">
                  <Coffee size={12} /> Bar
                </label>
                <input
                  type="number"
                  step="any"
                  value={form.barStock ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? '' : Number(e.target.value);
                    const m = Number(form.mainStoreStock || 0);
                    const k = Number(form.kitchenStock || 0);
                    setForm({ ...form, barStock: val, currentStock: m + k + (Number(val) || 0) });
                  }}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-emerald-900 outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Reorder level</label>
              <input type="number" step="any" required value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Unit cost (ETB)</label>
              <input type="number" step="any" value={form.unitCost}
                onChange={(e) => setForm({ ...form, unitCost: e.target.value === '' ? '' : Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-brass-400" />
            </div>
          </div>
          {/* Store Location & Destination Department */}
          <div>
            <label className="mb-1.5 block text-xs font-bold text-ink-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Warehouse size={13} className="text-ink-600" />
                Store Location &amp; Receiving Station *
              </span>
              <span className="text-[11px] font-semibold text-ink-400">
                Destination Station
              </span>
            </label>

            {/* Quick 3 Station Buttons */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  const m = Number(form.mainStoreStock || 0);
                  const k = Number(form.kitchenStock || 0);
                  const b = Number(form.barStock || 0);
                  const total = m + k + b;
                  setForm({
                    ...form,
                    storeLocation: 'Main Store',
                    mainStoreStock: total > 0 ? (m > 0 ? m : total) : 0,
                    kitchenStock: m > 0 ? k : 0,
                    barStock: m > 0 ? b : 0,
                  });
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${form.storeLocation === 'Main Store' || (!form.storeLocation?.includes('Kitchen') && !form.storeLocation?.includes('Bar'))
                  ? 'border-blue-500 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20 shadow-2xs'
                  : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                  }`}
              >
                <span className="flex items-center gap-1">🏢 Main Store Item</span>
                <span className="text-[9.5px] font-normal text-ink-500 mt-0.5">Central Warehouse</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const m = Number(form.mainStoreStock || 0);
                  const k = Number(form.kitchenStock || 0);
                  const b = Number(form.barStock || 0);
                  const total = m + k + b;
                  setForm({
                    ...form,
                    storeLocation: 'Kitchen Station',
                    kitchenStock: total > 0 ? (k > 0 ? k : total) : 0,
                    mainStoreStock: k > 0 ? m : 0,
                    barStock: k > 0 ? b : 0,
                  });
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${form.storeLocation?.includes('Kitchen')
                  ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-500/20 shadow-2xs'
                  : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                  }`}
              >
                <span className="flex items-center gap-1">🍳 Kitchen Station</span>
                <span className="text-[9.5px] font-normal text-amber-700 mt-0.5">Fresh Bazar / Production</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const m = Number(form.mainStoreStock || 0);
                  const k = Number(form.kitchenStock || 0);
                  const b = Number(form.barStock || 0);
                  const total = m + k + b;
                  setForm({
                    ...form,
                    storeLocation: 'Bar Station',
                    barStock: total > 0 ? (b > 0 ? b : total) : 0,
                    mainStoreStock: b > 0 ? m : 0,
                    kitchenStock: b > 0 ? k : 0,
                  });
                }}
                className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition cursor-pointer ${form.storeLocation?.includes('Bar')
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 shadow-2xs'
                  : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
                  }`}
              >
                <span className="flex items-center gap-1">☕ Bar Station</span>
                <span className="text-[9.5px] font-normal text-emerald-700 mt-0.5">Bar Production / Direct</span>
              </button>
            </div>

            {/* Editable location text input for sub-locations (cold room, fridge, bakery, etc.) */}
            <input
              value={form.storeLocation}
              onChange={(e) => setForm({ ...form, storeLocation: e.target.value })}
              placeholder="Store location (e.g. Kitchen Station, Bar Station, Main Store, Cold Room…)"
              className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />

            {/* Context guidance note */}
            <p className="mt-1 text-[11px] text-ink-500">
              {form.storeLocation?.includes('Kitchen') ? (
                <span className="text-amber-800 font-medium">
                  ✓ <strong>Kitchen Station:</strong> Directly registers Fresh Bazar produce &amp; kitchen production into Kitchen inventory.
                </span>
              ) : form.storeLocation?.includes('Bar') ? (
                <span className="text-emerald-800 font-medium">
                  ✓ <strong>Bar Station:</strong> Directly registers Bar production &amp; fresh drinks into Bar inventory.
                </span>
              ) : (
                <span className="text-blue-800 font-medium">
                  🏢 <strong>Main Store:</strong> Registered into central warehouse for subsequent transfer requests.
                </span>
              )}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass">{editing ? 'Save changes' : 'Add material'}</Button>
          </div>
        </form>
      </Modal>

      {/* Quick Dispatch / Stock Transfer Modal (Send from Main Store to Kitchen or Bar) */}
      <Modal
        open={transferModalOpen}
        onClose={() => { setTransferModalOpen(false); setTransferItem(null); }}
        title="Dispatch Stock from Main Store"
        width="max-w-md"
      >
        {transferItem && (
          <form onSubmit={handleTransferSubmit} className="space-y-4">
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-900">{transferItem.name}</span>
                <span className="font-mono text-blue-700 font-bold">{transferItem.code || '—'}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-blue-200/70">
                <span className="text-ink-600">Available in Main Store:</span>
                <span className="font-bold text-blue-900 tabular">
                  {Number(transferItem.mainStoreStock !== undefined ? transferItem.mainStoreStock : transferItem.currentStock || 0)} {transferItem.unit}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-blue-200/40 text-ink-500">
                <span>Current Kitchen: <strong>{Number(transferItem.kitchenStock || 0)} {transferItem.unit}</strong></span>
                <span>Current Bar: <strong>{Number(transferItem.barStock || 0)} {transferItem.unit}</strong></span>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-ink-700 uppercase tracking-wider">
                Destination Department / Station *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTransferForm(f => ({ ...f, toStation: 'kitchen' }))}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${transferForm.toStation === 'kitchen'
                    ? 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-300'
                    : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                    }`}
                >
                  <UtensilsCrossed size={14} className="text-amber-600" />
                  <span>🍳 Kitchen Station</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTransferForm(f => ({ ...f, toStation: 'bar' }))}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-bold transition cursor-pointer ${transferForm.toStation === 'bar'
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-300'
                    : 'border-ink-200 bg-white text-ink-600 hover:bg-ink-50'
                    }`}
                >
                  <Coffee size={14} className="text-emerald-600" />
                  <span>☕ Bar Station</span>
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-ink-700 uppercase tracking-wider">
                  Transfer Quantity ({transferItem.unit}) *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    const avail = Number(transferItem.mainStoreStock !== undefined ? transferItem.mainStoreStock : transferItem.currentStock || 0);
                    setTransferForm(f => ({ ...f, quantity: avail }));
                  }}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Transfer All
                </button>
              </div>
              <input
                type="number"
                step="any"
                min="0.001"
                max={Number(transferItem.mainStoreStock !== undefined ? transferItem.mainStoreStock : transferItem.currentStock || 0)}
                required
                value={transferForm.quantity}
                onChange={e => setTransferForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-sm font-bold text-ink-900 outline-none focus:border-blue-500 shadow-2xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <Button type="button" variant="ghost" onClick={() => { setTransferModalOpen(false); setTransferItem(null); }}>
                Cancel
              </Button>
              <Button type="submit" variant="brass" disabled={transferSubmitting}>
                <Send size={13} className="mr-1" />
                {transferSubmitting ? 'Transferring…' : `Send to ${transferForm.toStation === 'kitchen' ? 'Kitchen' : 'Bar'}`}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── Material Detail & Security Audit Modal ── */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailItem(null); }}
        title={detailItem ? `${detailItem.name} (${detailItem.code || 'No Code'})` : 'Material Details'}
        width="max-w-lg"
      >
        {detailItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm rounded-xl border border-slate-200 bg-white p-3.5">
              <div><p className="text-[11px] text-ink-400">Code</p><p className="font-mono font-semibold">{detailItem.code || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Category</p><p className="font-semibold">{detailItem.category || 'General'}</p></div>
              <div><p className="text-[11px] text-ink-400">Unit</p><p className="font-semibold">{detailItem.unit || 'pcs'}</p></div>
              <div><p className="text-[11px] text-ink-400">Unit Cost</p><p className="font-bold text-blue-700">ETB {Number(detailItem.unitCost || 0).toFixed(2)}</p></div>
              <div><p className="text-[11px] text-ink-400">Total Stock</p><p className="font-bold">{formatQty(detailItem.currentStock, detailItem.unit, detailItem.name)} {detailItem.unit}</p></div>
              <div><p className="text-[11px] text-ink-400">Reorder Level</p><p className="font-medium">{detailItem.reorderLevel} {detailItem.unit}</p></div>
              <div><p className="text-[11px] text-ink-400">Main Store</p><p className="font-semibold text-blue-700">{formatQty(detailItem.mainStoreStock ?? detailItem.currentStock, detailItem.unit, detailItem.name)} {detailItem.unit}</p></div>
              <div><p className="text-[11px] text-ink-400">Kitchen Stock</p><p className="font-semibold text-amber-700">{formatQty(detailItem.kitchenStock || 0, detailItem.unit, detailItem.name)} {detailItem.unit}</p></div>
              <div><p className="text-[11px] text-ink-400">Bar Stock</p><p className="font-semibold text-emerald-700">{formatQty(detailItem.barStock || 0, detailItem.unit, detailItem.name)} {detailItem.unit}</p></div>
              <div className="col-span-2 sm:col-span-3"><p className="text-[11px] text-ink-400">Store Location</p><p className="font-medium">{detailItem.storeLocation || 'Main Store'}</p></div>
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

export default RawMaterials;
