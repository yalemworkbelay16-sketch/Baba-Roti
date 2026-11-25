import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Factory, ChefHat, Coffee, Plus, Search, Trash2, Eye, X, CheckCircle2,
  AlertCircle, Calendar, User, DollarSign, Layers, Scale, History,
  RefreshCw, Pencil, ArrowRight, Clock, UtensilsCrossed, Check,
  PackageCheck, Sparkles, AlertTriangle, ShieldCheck, FileSpreadsheet,
  FileText, CornerDownRight, Filter, LayoutGrid, List
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import SearchableSelect from '../components/ui/SearchableSelect';

const etb = (n) => `ETB ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

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

const formatUnitQty = (val, unit = '', name = '') => {
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

export default function Production() {
  const { user, can, hasRole } = useAuth();
  const isManagerOrAdmin = ['admin', 'manager', 'supervisor', 'dev'].includes(user?.role);

  // Station Restriction check
  const userStation = (user?.assignedStation && user?.assignedStation !== 'all')
    ? user.assignedStation
    : String(user?.department || '').toLowerCase().includes('kitchen')
      ? 'kitchen'
      : String(user?.department || '').toLowerCase().includes('bar')
        ? 'bar'
        : user?.assignedStation || 'all';

  // Active Tab: 'run' | 'recipes' | 'stock' | 'history'
  const [activeTab, setActiveTab] = useState('run');

  // Station filter: 'all' | 'kitchen' | 'bar'
  const [stationFilter, setStationFilter] = useState(
    userStation === 'kitchen' ? 'kitchen' : (userStation === 'bar' ? 'bar' : 'all')
  );

  // Data states
  const [recipes, setRecipes] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [producedMaterials, setProducedMaterials] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // ── Run Production State ──
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [plannedQty, setPlannedQty] = useState(1);
  const [batchNotes, setBatchNotes] = useState('');
  const [batchDate, setBatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [calcPreview, setCalcPreview] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);

  // ── Recipe Modal & View States ──
  const [recipeModalOpen, setRecipeModalOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState(null);
  const [recipeViewMode, setRecipeViewMode] = useState('table'); // 'table' | 'grid'
  const [recipeSearch, setRecipeSearch] = useState('');
  const [recipeStationTab, setRecipeStationTab] = useState('all'); // 'all' | 'kitchen' | 'bar'
  const [recipeToDelete, setRecipeToDelete] = useState(null);
  const [deleteRecipeModalOpen, setDeleteRecipeModalOpen] = useState(false);
  const [deletingRecipe, setDeletingRecipe] = useState(false);
  const [recipeForm, setRecipeForm] = useState({
    name: '',
    code: '',
    station: userStation === 'bar' ? 'bar' : 'kitchen',
    targetMaterial: '',
    isCreatingNewMaterial: false,
    newMaterialName: '',
    newMaterialCategory: 'Kitchen Production',
    newMaterialUnit: 'kg',
    yieldQuantity: 1,
    yieldUnit: 'kg',
    instructions: '',
    ingredients: [{ material: '', quantity: 1, unit: 'kg', notes: '' }],
  });

  // ── Batch Details Modal ──
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState(null);

  // ── Void Confirmation Modal ──
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [batchToVoid, setBatchToVoid] = useState(null);
  const [voidReason, setVoidReason] = useState('Production quantity corrected / cancelled');
  const [voiding, setVoiding] = useState(false);

  // ── History Filter State ──
  const [historySearch, setHistorySearch] = useState('');
  const [historyFrom, setHistoryFrom] = useState('');
  const [historyTo, setHistoryTo] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const itemsPerPage = 15;

  // Auto-dismiss alerts
  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 6000);
  };
  const showError = (msg) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 8000);
  };

  // ── Fetch Initial Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, matRes, prodMatRes, batchRes] = await Promise.all([
        api.get('/production/recipes'),
        api.get('/materials'),
        api.get('/production/produced-materials'),
        api.get('/production/batches?limit=150'),
      ]);
      setRecipes(Array.isArray(recRes.data) ? recRes.data : []);
      setRawMaterials(Array.isArray(matRes.data) ? matRes.data : []);
      setProducedMaterials(Array.isArray(prodMatRes.data) ? prodMatRes.data : []);
      setBatches(Array.isArray(batchRes.data) ? batchRes.data : []);
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Failed to load production data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set default recipe when recipes load or station filter changes
  useEffect(() => {
    if (recipes.length > 0 && !selectedRecipeId) {
      const filtered = recipes.filter(r => stationFilter === 'all' || r.station === stationFilter);
      if (filtered.length > 0) {
        setSelectedRecipeId(filtered[0]._id);
      }
    }
  }, [recipes, stationFilter, selectedRecipeId]);

  // ── Trigger Live Requirement Calculation ──
  useEffect(() => {
    if (!selectedRecipeId || Number(plannedQty) <= 0) {
      setCalcPreview(null);
      return;
    }
    const timer = setTimeout(async () => {
      setCalcLoading(true);
      try {
        const res = await api.post('/production/calculate-requirements', {
          recipeId: selectedRecipeId,
          quantity: Number(plannedQty),
        });
        setCalcPreview(res.data);
      } catch (err) {
        console.warn('Calc error:', err);
      } finally {
        setCalcLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [selectedRecipeId, plannedQty]);

  // ── Filtered Recipes ──
  const availableRecipes = useMemo(() => {
    return recipes.filter(r => {
      if (stationFilter !== 'all' && r.station !== stationFilter) return false;
      return true;
    });
  }, [recipes, stationFilter]);

  // Filtered recipes for Tab 2 (Recipe Management)
  const recipesForTab = useMemo(() => {
    return availableRecipes.filter(r => {
      if (recipeStationTab !== 'all' && r.station !== recipeStationTab) return false;
      if (recipeSearch.trim()) {
        const q = recipeSearch.trim().toLowerCase();
        const matchName = String(r.name || '').toLowerCase().includes(q);
        const matchCode = String(r.code || '').toLowerCase().includes(q);
        const matchTarget = String(r.targetMaterial?.name || '').toLowerCase().includes(q);
        const matchIngs = (r.ingredients || []).some(ing =>
          String(ing.material?.name || '').toLowerCase().includes(q)
        );
        if (!matchName && !matchCode && !matchTarget && !matchIngs) return false;
      }
      return true;
    });
  }, [availableRecipes, recipeStationTab, recipeSearch]);

  const handleOpenDeleteRecipeModal = (recipe) => {
    setRecipeToDelete(recipe);
    setDeleteRecipeModalOpen(true);
  };

  const handleConfirmDeleteRecipe = async () => {
    if (!recipeToDelete) return;
    setDeletingRecipe(true);
    try {
      const res = await api.delete(`/production/recipes/${recipeToDelete._id}`);
      showSuccess(res.data?.message || `Recipe "${recipeToDelete.name}" removed successfully`);
      setDeleteRecipeModalOpen(false);
      setRecipeToDelete(null);
      if (selectedRecipeId === recipeToDelete._id) {
        setSelectedRecipeId('');
      }
      await loadData();
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Failed to remove recipe');
    } finally {
      setDeletingRecipe(false);
    }
  };

  // ── Execute Batch Production ──
  const handleExecuteBatch = async (e) => {
    e.preventDefault();
    if (!selectedRecipeId) {
      showError('Please select a production recipe');
      return;
    }
    if (Number(plannedQty) <= 0) {
      showError('Production quantity must be greater than zero');
      return;
    }

    setSubmittingBatch(true);
    try {
      const res = await api.post('/production/produce-batch', {
        recipeId: selectedRecipeId,
        quantity: Number(plannedQty),
        notes: batchNotes,
        productionDate: batchDate,
      });

      showSuccess(res.data.message || `Successfully produced batch!`);
      setBatchNotes('');
      // Reload updated stock & history
      await loadData();
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Failed to produce batch');
    } finally {
      setSubmittingBatch(false);
    }
  };

  // ── Open Create / Edit Recipe Modal ──
  const handleOpenRecipeModal = (recipe = null) => {
    if (recipe) {
      setEditingRecipeId(recipe._id);
      setRecipeForm({
        name: recipe.name,
        code: recipe.code || '',
        station: recipe.station || 'kitchen',
        targetMaterial: recipe.targetMaterial?._id || recipe.targetMaterial || '',
        isCreatingNewMaterial: false,
        newMaterialName: '',
        newMaterialCategory: recipe.station === 'bar' ? 'Bar' : 'Kitchen',
        newMaterialUnit: recipe.yieldUnit || 'kg',
        yieldQuantity: recipe.yieldQuantity || 1,
        yieldUnit: recipe.yieldUnit || 'kg',
        instructions: recipe.instructions || '',
        ingredients: (recipe.ingredients || []).map(i => ({
          material: i.material?._id || i.material,
          quantity: i.quantity,
          unit: i.unit || i.material?.unit || 'kg',
          notes: i.notes || '',
        })),
      });
    } else {
      setEditingRecipeId(null);
      setRecipeForm({
        name: '',
        code: '',
        station: stationFilter === 'bar' ? 'bar' : 'kitchen',
        targetMaterial: '',
        isCreatingNewMaterial: false,
        newMaterialName: '',
        newMaterialCategory: stationFilter === 'bar' ? 'Bar' : 'Kitchen',
        newMaterialUnit: 'kg',
        yieldQuantity: 1,
        yieldUnit: 'kg',
        instructions: '',
        ingredients: [{ material: '', quantity: 1, unit: 'kg', notes: '' }],
      });
    }
    setRecipeModalOpen(true);
  };

  // ── Save Recipe Form ──
  const handleSaveRecipe = async (e) => {
    e.preventDefault();
    if (!recipeForm.name.trim()) {
      showError('Recipe name is required');
      return;
    }

    let targetMatId = recipeForm.targetMaterial;

    // If user clicked create new material
    if (recipeForm.isCreatingNewMaterial) {
      if (!recipeForm.newMaterialName.trim()) {
        showError('Please enter a name for the new production item');
        return;
      }
      try {
        const createMatRes = await api.post('/materials', {
          name: recipeForm.newMaterialName.trim(),
          unit: recipeForm.newMaterialUnit.trim() || 'kg',
          category: recipeForm.newMaterialCategory || (recipeForm.station === 'bar' ? 'Bar' : 'Kitchen'),
          storeLocation: recipeForm.station === 'bar' ? 'Bar Station' : 'Kitchen Station',
          isProduced: true,
          itemType: 'produced',
          productionStation: recipeForm.station,
          currentStock: 0,
          kitchenStock: 0,
          barStock: 0,
          mainStoreStock: 0,
          reorderLevel: 5,
        });
        targetMatId = createMatRes.data._id;
      } catch (err) {
        showError(err.response?.data?.message || err.message || 'Failed to create target material');
        return;
      }
    }

    if (!targetMatId) {
      showError('Please select or create the target produced item');
      return;
    }

    const payload = {
      name: recipeForm.name,
      code: recipeForm.code,
      station: recipeForm.station,
      targetMaterial: targetMatId,
      yieldQuantity: Number(recipeForm.yieldQuantity) || 1,
      yieldUnit: recipeForm.yieldUnit || 'kg',
      instructions: recipeForm.instructions,
      ingredients: recipeForm.ingredients.filter(i => i.material && Number(i.quantity) > 0),
    };

    if (payload.ingredients.length === 0) {
      showError('Please add at least one ingredient with a quantity > 0');
      return;
    }

    try {
      if (editingRecipeId) {
        await api.put(`/production/recipes/${editingRecipeId}`, payload);
        showSuccess('Production recipe updated successfully!');
      } else {
        await api.post('/production/recipes', payload);
        showSuccess('Production recipe created successfully!');
      }
      setRecipeModalOpen(false);
      await loadData();
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Failed to save recipe');
    }
  };

  // ── Void Batch ──
  const handleConfirmVoid = async () => {
    if (!batchToVoid) return;
    setVoiding(true);
    try {
      await api.post(`/production/batches/${batchToVoid._id}/void`, {
        reason: voidReason,
      });
      showSuccess(`Batch #${batchToVoid.batchNo} voided and stock was reversed.`);
      setVoidModalOpen(false);
      setBatchToVoid(null);
      await loadData();
    } catch (err) {
      showError(err.response?.data?.message || err.message || 'Failed to void batch');
    } finally {
      setVoiding(false);
    }
  };

  // ── Filtered History ──
  const filteredBatches = useMemo(() => {
    return batches.filter(b => {
      if (stationFilter !== 'all' && b.station !== stationFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const match = (b.batchNo && b.batchNo.toLowerCase().includes(q)) ||
          (b.recipeName && b.recipeName.toLowerCase().includes(q)) ||
          (b.targetMaterialName && b.targetMaterialName.toLowerCase().includes(q)) ||
          (b.producedByName && b.producedByName.toLowerCase().includes(q));
        if (!match) return false;
      }
      if (historyFrom) {
        const d = new Date(b.productionDate);
        if (d < new Date(historyFrom)) return false;
      }
      if (historyTo) {
        const d = new Date(b.productionDate);
        const toEnd = new Date(historyTo);
        toEnd.setHours(23, 59, 59, 999);
        if (d > toEnd) return false;
      }
      return true;
    });
  }, [batches, stationFilter, historySearch, historyFrom, historyTo]);

  // Pagination for History
  const paginatedBatches = useMemo(() => {
    const start = (historyPage - 1) * itemsPerPage;
    return filteredBatches.slice(start, start + itemsPerPage);
  }, [filteredBatches, historyPage]);

  // Current selected recipe object for Tab 1
  const activeRecipe = useMemo(() => {
    return recipes.find(r => r._id === selectedRecipeId);
  }, [recipes, selectedRecipeId]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
              <Factory size={22} />
            </span>
            <div>
              <h1 className="text-xl font-black text-ink-900 tracking-tight flex items-center gap-2">
                Production Management
                <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                  Kitchen & Bar
                </span>
              </h1>
              <p className="text-xs text-ink-500 font-medium">
                Transform transferred raw materials into finished prepared stock without double deductions.
              </p>
            </div>
          </div>
        </div>

        {/* Station Filter Pills */}
        <div className="flex items-center gap-2 bg-ink-50 p-1 rounded-2xl border border-ink-100 self-start md:self-auto">
          {userStation === 'all' && (
            <button
              type="button"
              onClick={() => setStationFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${stationFilter === 'all'
                ? 'bg-white text-ink-900 shadow-xs'
                : 'text-ink-600 hover:text-ink-900'
                }`}
            >
              All Stations
            </button>
          )}
          {(userStation === 'all' || userStation === 'kitchen') && (
            <button
              type="button"
              onClick={() => setStationFilter('kitchen')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${stationFilter === 'kitchen'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-ink-600 hover:text-amber-800'
                }`}
            >
              <ChefHat size={14} /> Kitchen Store
            </button>
          )}
          {(userStation === 'all' || userStation === 'bar') && (
            <button
              type="button"
              onClick={() => setStationFilter('bar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${stationFilter === 'bar'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-ink-600 hover:text-emerald-800'
                }`}
            >
              <Coffee size={14} /> Bar Store
            </button>
          )}
        </div>
      </div>
      {/* ── Alerts ── */}
      {successMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-900 shadow-2xs animate-in fade-in">
          <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-900 shadow-2xs animate-in fade-in">
          <AlertCircle size={18} className="text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* ── Top Level Tabs ── */}
      <div className="flex items-center gap-2 border-b border-ink-100 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('run')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'run'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
            : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
        >
          <Factory size={16} /> Run Production (Batch Produce)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('recipes')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'recipes'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
            : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
        >
          <ChefHat size={16} /> Production Recipes / BOM ({availableRecipes.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('stock')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'stock'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
            : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
        >
          <PackageCheck size={16} /> Prepared Production Stock
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition cursor-pointer whitespace-nowrap ${activeTab === 'history'
            ? 'border-blue-600 text-blue-700 bg-blue-50/50 rounded-t-xl'
            : 'border-transparent text-ink-600 hover:text-ink-900'
            }`}
        >
          <History size={16} /> Production History & Logs ({filteredBatches.length})
        </button>
      </div>

      {/* ────────────────────────────────────────────────────────────────
          TAB 1: RUN PRODUCTION (BATCH PRODUCE)
      ──────────────────────────────────────────────────────────────── */}
      {activeTab === 'run' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Form: Parameters */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ink-100">
                <h3 className="font-bold text-sm text-ink-900 flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-500" />
                  Select Production Item
                </h3>
                <span className="text-[11px] font-semibold text-ink-500">
                  Step 1 of 2
                </span>
              </div>

              {availableRecipes.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                    <ChefHat size={24} />
                  </div>
                  <p className="text-xs font-semibold text-ink-700">No production recipes found for this station.</p>
                  <button
                    type="button"
                    onClick={() => handleOpenRecipeModal()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <Plus size={14} /> Create First Recipe
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Recipe Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1.5">
                      Production Recipe (Formulas)
                    </label>
                    <SearchableSelect
                      options={availableRecipes.map(r => ({
                        value: r._id,
                        label: `${r.station === 'bar' ? '☕ Bar: ' : '🍳 Kitchen: '}${r.name} (${r.targetMaterial?.name || 'Item'})`,
                        sublabel: `Yield: ${r.yieldQuantity} ${r.yieldUnit} • Est. Cost: ${etb(r.estimatedUnitCost)} • ${r.ingredients?.length || 0} ingredients`,
                      }))}
                      value={selectedRecipeId}
                      onChange={(val) => setSelectedRecipeId(val)}
                      placeholder="Type to search production recipe formula..."
                    />
                  </div>

                  {/* Recipe Overview Card */}
                  {activeRecipe && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-3.5 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-blue-950">{activeRecipe.name}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-200 text-blue-900">
                          {activeRecipe.station}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-blue-900/80 pt-1 border-t border-blue-100">
                        <div>Target Item: <strong>{activeRecipe.targetMaterial?.name}</strong></div>
                        <div>Standard Yield: <strong>{activeRecipe.yieldQuantity} {activeRecipe.yieldUnit}</strong></div>
                        <div>Est. Cost/Unit: <strong>{etb(activeRecipe.estimatedUnitCost)}</strong></div>
                        <div>Ingredients: <strong>{activeRecipe.ingredients?.length || 0} items</strong></div>
                      </div>
                      {activeRecipe.instructions && (
                        <p className="text-[11px] text-ink-600 italic border-t border-blue-100/60 pt-1.5">
                          "{activeRecipe.instructions}"
                        </p>
                      )}
                    </div>
                  )}

                  {/* Quantity to Produce */}
                  <div>
                    <label className="block text-xs font-bold text-ink-700 mb-1.5">
                      Batch Quantity to Produce ({activeRecipe?.yieldUnit || 'units'})
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0.0001"
                        step="any"
                        value={plannedQty}
                        onChange={(e) => setPlannedQty(e.target.value)}
                        className="flex-1 rounded-xl border border-ink-200 px-3 py-2 text-sm font-bold text-ink-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        placeholder="e.g. 2"
                      />
                      <span className="text-xs font-bold text-ink-500 px-2 py-2 bg-ink-50 rounded-xl border border-ink-200">
                        {activeRecipe?.yieldUnit || 'kg'}
                      </span>
                    </div>

                    {/* Quick Stepper Buttons */}
                    <div className="flex items-center gap-1.5 mt-2">
                      {[0.5, 1, 2, 5, 10].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setPlannedQty(n)}
                          className={`px-2 py-1 text-[10px] font-bold rounded-lg border transition cursor-pointer ${Number(plannedQty) === n
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-ink-50 hover:bg-ink-100 text-ink-700 border-ink-200'
                            }`}
                        >
                          {n} {activeRecipe?.yieldUnit}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Date & Notes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-ink-700 mb-1">
                        Production Date
                      </label>
                      <input
                        type="date"
                        value={batchDate}
                        onChange={(e) => setBatchDate(e.target.value)}
                        className="w-full rounded-xl border border-ink-200 px-3 py-1.5 text-xs font-medium text-ink-900"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-ink-700 mb-1">
                        Batch Notes (Optional)
                      </label>
                      <input
                        type="text"
                        value={batchNotes}
                        onChange={(e) => setBatchNotes(e.target.value)}
                        placeholder="e.g. Morning prep batch"
                        className="w-full rounded-xl border border-ink-200 px-3 py-1.5 text-xs text-ink-900"
                      />
                    </div>
                  </div>

                  {/* Execute Button */}
                  <button
                    type="button"
                    onClick={handleExecuteBatch}
                    disabled={submittingBatch || !calcPreview?.canProduce}
                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition cursor-pointer ${calcPreview?.canProduce
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-amber-500 hover:bg-amber-600 text-white'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {submittingBatch ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" /> Producing Batch…
                      </>
                    ) : (
                      <>
                        <Factory size={15} />
                        Confirm & Produce {plannedQty} {activeRecipe?.yieldUnit || ''} into {activeRecipe?.station === 'bar' ? 'Bar Store' : 'Kitchen Store'}
                      </>
                    )}
                  </button>
                  {!calcPreview?.canProduce && (
                    <p className="text-[11px] font-semibold text-amber-700 text-center">
                      ⚠️ Insufficient raw materials in store. Please request required items from Main Store.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Preview: Live Requirement Calculator */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-ink-100">
                <div>
                  <h3 className="font-bold text-sm text-ink-900 flex items-center gap-2">
                    <Scale size={16} className="text-blue-600" />
                    Ingredient Requirements & Store Availability
                  </h3>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    Live calculation based on producing <strong>{plannedQty} {calcPreview?.yieldUnit || 'units'}</strong>
                  </p>
                </div>
                {calcLoading ? (
                  <span className="flex items-center gap-1.5 text-[11px] text-ink-500">
                    <RefreshCw size={12} className="animate-spin" /> Calculating…
                  </span>
                ) : (
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold flex items-center gap-1 ${calcPreview?.canProduce
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                    }`}>
                    {calcPreview?.canProduce ? (
                      <><Check size={12} /> Stock Available</>
                    ) : (
                      <><AlertTriangle size={12} /> Stock Shortage</>
                    )}
                  </span>
                )}
              </div>

              {/* Ingredients Table */}
              {!calcPreview || !calcPreview.ingredients || calcPreview.ingredients.length === 0 ? (
                <div className="py-12 text-center text-xs text-ink-400">
                  Select a recipe on the left to view ingredient requirements.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="overflow-x-auto rounded-xl border border-ink-100">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-ink-50/80 text-[11px] font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
                        <tr>
                          <th className="px-3.5 py-2.5">Raw Ingredient</th>
                          <th className="px-3.5 py-2.5 text-center">Needed Amount</th>
                          <th className="px-3.5 py-2.5 text-center">{calcPreview.station === 'bar' ? 'Bar Stock' : 'Kitchen Stock'}</th>
                          <th className="px-3.5 py-2.5 text-right">Line Cost</th>
                          <th className="px-3.5 py-2.5 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 font-medium">
                        {calcPreview.ingredients.map((ing) => (
                          <tr key={ing.materialId} className={ing.isSufficient ? 'hover:bg-ink-50/40' : 'bg-red-50/40'}>
                            <td className="px-3.5 py-3 font-semibold text-ink-900">
                              {ing.materialName}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className="font-bold text-ink-900">
                                {formatUnitQty(ing.requiredRecipeQuantity, ing.recipeUnit, ing.materialName)} {ing.recipeUnit}
                              </span>
                              {ing.recipeUnit !== ing.baseUnit && (
                                <span className="block text-[10px] text-ink-500">
                                  (= {formatUnitQty(ing.requiredBaseQuantity, ing.baseUnit, ing.materialName)} {ing.baseUnit})
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              <span className={`font-bold ${ing.availableStationStock >= ing.requiredBaseQuantity
                                ? 'text-emerald-700'
                                : 'text-red-600'
                                }`}>
                                {formatUnitQty(ing.availableStationStock, ing.baseUnit, ing.materialName)} {ing.baseUnit}
                              </span>
                            </td>
                            <td className="px-3.5 py-3 text-right font-bold text-ink-900">
                              {etb(ing.totalCost)}
                            </td>
                            <td className="px-3.5 py-3 text-center">
                              {ing.isSufficient ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <Check size={11} /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800" title={`Short by ${formatUnitQty(ing.shortage, ing.baseUnit, ing.materialName)} ${ing.baseUnit}`}>
                                  <AlertCircle size={11} /> Short ({formatUnitQty(ing.shortage, ing.baseUnit, ing.materialName)} {ing.baseUnit})
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary Footer */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-ink-50/70 border border-ink-100 text-xs">
                    <div>
                      <span className="text-[11px] text-ink-500 block">Total Consumed Cost:</span>
                      <strong className="text-sm font-black text-ink-900">{etb(calcPreview.totalCost)}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-ink-500 block">Est. Cost Per {calcPreview.yieldUnit}:</span>
                      <strong className="text-sm font-black text-emerald-700">{etb(calcPreview.estimatedUnitCost)}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-ink-500 block">Output Finished Stock:</span>
                      <strong className="text-sm font-black text-blue-700">+{calcPreview.plannedQuantity} {calcPreview.yieldUnit}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          TAB 2: PRODUCTION RECIPES (BOM FORMULAS)
      ──────────────────────────────────────────────────────────────── */}
      {activeTab === 'recipes' && (
        <div className="space-y-4">
          {/* Header & Main Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-2xl border border-ink-100 shadow-2xs">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-ink-900">
                  Production Recipes (Bills of Materials)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
                  {recipesForTab.length} of {availableRecipes.length} {availableRecipes.length === 1 ? 'Formula' : 'Formulas'}
                </span>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">
                Define standard preparation formulas and raw material bills for items prepared in Kitchen and Bar.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-ink-200 bg-white text-ink-700 text-xs font-bold hover:bg-ink-50 shadow-2xs transition cursor-pointer"
                title="Refresh recipe list"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => handleOpenRecipeModal()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Plus size={14} /> Create Production Recipe
                </button>
              )}
            </div>
          </div>

          {/* Controls & Filter Bar */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-2xl bg-white border border-ink-100 shadow-2xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Search recipe name, code, produced item, or ingredient..."
                className="w-full rounded-xl border border-ink-200 pl-8 pr-8 py-1.5 text-xs text-ink-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              {recipeSearch && (
                <button
                  type="button"
                  onClick={() => setRecipeSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Station Filter Pills */}
              <div className="flex items-center gap-1 bg-ink-50 p-1 rounded-xl border border-ink-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setRecipeStationTab('all')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${recipeStationTab === 'all'
                      ? 'bg-white text-ink-900 shadow-2xs'
                      : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setRecipeStationTab('kitchen')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${recipeStationTab === 'kitchen'
                      ? 'bg-white text-amber-900 shadow-2xs'
                      : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  🍳 Kitchen
                </button>
                <button
                  type="button"
                  onClick={() => setRecipeStationTab('bar')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${recipeStationTab === 'bar'
                      ? 'bg-white text-emerald-900 shadow-2xs'
                      : 'text-ink-600 hover:text-ink-900'
                    }`}
                >
                  ☕ Bar
                </button>
              </div>

              {/* View Mode Switcher: Table vs Cards */}
              <div className="flex items-center gap-1 bg-ink-50 p-1 rounded-xl border border-ink-100 shrink-0">
                <button
                  type="button"
                  onClick={() => setRecipeViewMode('table')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${recipeViewMode === 'table'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-ink-600 hover:text-ink-900'
                    }`}
                  title="Compact Table View"
                >
                  <List size={13} />
                  <span>Table View</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRecipeViewMode('grid')}
                  className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${recipeViewMode === 'grid'
                      ? 'bg-white text-blue-700 shadow-2xs'
                      : 'text-ink-600 hover:text-ink-900'
                    }`}
                  title="Card Grid View"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* VIEW: TABLE VIEW (COMPACT & MODERN) */}
          {recipeViewMode === 'table' ? (
            <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-2xs">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50/80 text-[11px] font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
                  <tr>
                    <th className="px-4 py-3">Formula Code</th>
                    <th className="px-4 py-3">Recipe / Produced Item</th>
                    <th className="px-4 py-3 text-center">Station</th>
                    <th className="px-4 py-3 text-center">Standard Yield</th>
                    <th className="px-4 py-3 text-right">Est. Unit Cost</th>
                    <th className="px-4 py-3">Ingredients Formula</th>
                    <th className="px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 font-medium">
                  {recipesForTab.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-xs text-ink-400">
                        {recipeSearch || recipeStationTab !== 'all'
                          ? 'No recipes match your search/filter criteria.'
                          : 'No production recipes defined yet. Click "Create Production Recipe" above to add one.'}
                      </td>
                    </tr>
                  ) : (
                    recipesForTab.map((r) => (
                      <tr key={r._id} className="hover:bg-ink-50/50 transition">
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className="font-mono font-bold text-[11px] text-ink-700 bg-ink-100 px-2 py-0.5 rounded-md">
                            {r.code || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-ink-900 text-sm">{r.name}</div>
                          <div className="text-[11px] text-ink-500 flex items-center gap-1 mt-0.5">
                            <span>Produces:</span>
                            <strong className="text-ink-800 font-semibold">{r.targetMaterial?.name || '—'}</strong>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${r.station === 'bar'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                            {r.station}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <span className="font-bold text-ink-900 bg-ink-50 px-2.5 py-1 rounded-lg border border-ink-100">
                            {formatUnitQty(r.yieldQuantity, r.yieldUnit)} {r.yieldUnit}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <span className="font-bold text-emerald-700 text-xs">
                            {etb(r.estimatedUnitCost)}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span className="inline-block text-[10px] font-bold text-ink-500 uppercase tracking-wider">
                              {r.ingredients?.length || 0} {r.ingredients?.length === 1 ? 'Ingredient' : 'Ingredients'}
                            </span>
                            <div className="flex flex-wrap gap-1 max-w-sm">
                              {(r.ingredients || []).slice(0, 3).map((ing, idx) => (
                                <span key={idx} className="text-[10px] bg-ink-50 text-ink-700 border border-ink-100 px-1.5 py-0.5 rounded">
                                  {ing.material?.name || 'Item'} ({formatUnitQty(ing.quantity, ing.unit || ing.material?.unit, ing.material?.name)} {ing.unit || ing.material?.unit})
                                </span>
                              ))}
                              {(r.ingredients?.length || 0) > 3 && (
                                <span className="text-[10px] text-ink-400 font-bold self-center">
                                  +{(r.ingredients?.length || 0) - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRecipeId(r._id);
                                setActiveTab('run');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-2xs transition cursor-pointer"
                              title="Produce this recipe"
                            >
                              <Factory size={12} /> Produce
                            </button>
                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenRecipeModal(r)}
                                className="p-1.5 rounded-lg border border-ink-200 text-ink-600 hover:text-ink-900 hover:bg-ink-100 transition cursor-pointer"
                                title="Edit Recipe"
                              >
                                <Pencil size={13} />
                              </button>
                            )}
                            {isManagerOrAdmin && (
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteRecipeModal(r)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                                title="Delete / Remove Recipe"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* VIEW: STREAMLINED GRID CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recipesForTab.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-ink-400 bg-white rounded-2xl border border-ink-100">
                  {recipeSearch || recipeStationTab !== 'all'
                    ? 'No recipes match your search/filter criteria.'
                    : 'No production recipes defined yet.'}
                </div>
              ) : (
                recipesForTab.map((r) => (
                  <div key={r._id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-xs hover:border-ink-200 hover:shadow-md transition space-y-3 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-ink-500 uppercase tracking-wider bg-ink-100 px-2 py-0.5 rounded">
                          {r.code || '—'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${r.station === 'bar'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                            }`}>
                            {r.station}
                          </span>
                          {isManagerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => handleOpenDeleteRecipeModal(r)}
                              className="text-ink-400 hover:text-red-600 hover:bg-red-50 p-1 rounded-md transition cursor-pointer"
                              title="Delete Recipe"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-ink-900">{r.name}</h4>
                        <p className="text-xs text-ink-500 flex items-center gap-1 mt-0.5">
                          Produces: <strong className="text-ink-800">{r.targetMaterial?.name || '—'}</strong>
                        </p>
                      </div>

                      <div className="p-2.5 rounded-xl bg-ink-50/70 border border-ink-100/80 text-[11px] grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-ink-500 block">Std Yield:</span>
                          <strong className="text-ink-900">{formatUnitQty(r.yieldQuantity, r.yieldUnit)} {r.yieldUnit}</strong>
                        </div>
                        <div>
                          <span className="text-ink-500 block">Unit Cost:</span>
                          <strong className="text-emerald-700">{etb(r.estimatedUnitCost)}</strong>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 block">
                          Ingredients Formula ({r.ingredients?.length || 0})
                        </span>
                        <ul className="text-xs text-ink-600 space-y-0.5 max-h-24 overflow-y-auto pr-1">
                          {(r.ingredients || []).map((ing, idx) => (
                            <li key={idx} className="flex justify-between items-center text-[11px] py-0.5 border-b border-ink-50 last:border-0">
                              <span className="truncate max-w-[170px]">{ing.material?.name || 'Item'}</span>
                              <span className="font-bold text-ink-800 shrink-0">{formatUnitQty(ing.quantity, ing.unit || ing.material?.unit, ing.material?.name)} {ing.unit || ing.material?.unit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-ink-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecipeId(r._id);
                          setActiveTab('run');
                        }}
                        className="flex-1 py-1.5 px-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition"
                      >
                        <Factory size={13} /> Produce
                      </button>
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenRecipeModal(r)}
                          className="p-1.5 rounded-xl border border-ink-200 text-ink-600 hover:text-ink-900 hover:bg-ink-50 transition cursor-pointer"
                          title="Edit Recipe"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {isManagerOrAdmin && (
                        <button
                          type="button"
                          onClick={() => handleOpenDeleteRecipeModal(r)}
                          className="p-1.5 rounded-xl border border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                          title="Delete Recipe"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          TAB 3: PREPARED PRODUCTION STOCK
      ──────────────────────────────────────────────────────────────── */}
      {activeTab === 'stock' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-ink-900">
                Prepared Production Stock Levels
              </h3>
              <p className="text-xs text-ink-500">
                Current inventory of all items produced in Kitchen Store and Bar Store.
              </p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-ink-200 bg-white text-ink-700 text-xs font-bold hover:bg-ink-50 shadow-2xs self-start sm:self-auto cursor-pointer"
            >
              <RefreshCw size={13} /> Refresh Stock
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50/80 text-[11px] font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
                <tr>
                  <th className="px-4 py-3">Item Name</th>
                  <th className="px-4 py-3">Production Station</th>
                  <th className="px-4 py-3 text-center">Kitchen Store</th>
                  <th className="px-4 py-3 text-center">Bar Store</th>
                  <th className="px-4 py-3 text-center">Total Working Stock</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3 text-right">Stock Value</th>
                  <th className="px-4 py-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 font-medium">
                {producedMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-xs text-ink-400">
                      No internally produced items registered yet. Create a production recipe to register items.
                    </td>
                  </tr>
                ) : (
                  producedMaterials.map((mat) => {
                    const totalVal = (Number(mat.currentStock) || 0) * (Number(mat.unitCost) || 0);
                    return (
                      <tr key={mat._id} className="hover:bg-ink-50/40">
                        <td className="px-4 py-3">
                          <div className="font-bold text-ink-900">{mat.name}</div>
                          <span className="text-[10px] text-ink-400">{mat.category || 'Kitchen Production'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${mat.productionStation === 'bar'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                            }`}>
                            {mat.productionStation || 'kitchen'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-amber-800">
                            {formatUnitQty(mat.kitchenStock, mat.unit, mat.name)} {mat.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-emerald-800">
                            {formatUnitQty(mat.barStock, mat.unit, mat.name)} {mat.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-black text-ink-900 text-sm">
                            {formatUnitQty(mat.currentStock, mat.unit, mat.name)} {mat.unit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-ink-700">
                          {etb(mat.unitCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-black text-emerald-700">
                          {etb(totalVal)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              const matchRec = recipes.find(r => r.targetMaterial?._id === mat._id || r.targetMaterial === mat._id);
                              if (matchRec) {
                                setSelectedRecipeId(matchRec._id);
                              }
                              setActiveTab('run');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold transition cursor-pointer"
                          >
                            <Factory size={12} /> Produce
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          TAB 4: PRODUCTION HISTORY & LOGS
      ──────────────────────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white border border-ink-100 shadow-xs">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => {
                  setHistorySearch(e.target.value);
                  setHistoryPage(1);
                }}
                placeholder="Search batch #, recipe, item, or operator…"
                className="w-full rounded-xl border border-ink-200 pl-9 pr-3 py-1.5 text-xs text-ink-900 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={historyFrom}
                onChange={(e) => {
                  setHistoryFrom(e.target.value);
                  setHistoryPage(1);
                }}
                className="rounded-xl border border-ink-200 px-2.5 py-1.5 text-xs text-ink-700"
                title="From Date"
              />
              <span className="text-xs text-ink-400">to</span>
              <input
                type="date"
                value={historyTo}
                onChange={(e) => {
                  setHistoryTo(e.target.value);
                  setHistoryPage(1);
                }}
                className="rounded-xl border border-ink-200 px-2.5 py-1.5 text-xs text-ink-700"
                title="To Date"
              />
              {(historySearch || historyFrom || historyTo) && (
                <button
                  type="button"
                  onClick={() => {
                    setHistorySearch('');
                    setHistoryFrom('');
                    setHistoryTo('');
                    setHistoryPage(1);
                  }}
                  className="px-2 py-1.5 text-xs text-red-600 hover:text-red-800 font-bold cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Batches Table */}
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-ink-50/80 text-[11px] font-bold uppercase tracking-wider text-ink-600 border-b border-ink-100">
                <tr>
                  <th className="px-4 py-3">Batch #</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Station</th>
                  <th className="px-4 py-3">Produced Item</th>
                  <th className="px-4 py-3 text-center">Batch Quantity</th>
                  <th className="px-4 py-3 text-right">Total Cost</th>
                  <th className="px-4 py-3 text-right">Unit Cost</th>
                  <th className="px-4 py-3">Produced By</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 font-medium">
                {paginatedBatches.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-xs text-ink-400">
                      No production batches recorded.
                    </td>
                  </tr>
                ) : (
                  paginatedBatches.map((b) => (
                    <tr key={b._id} className={b.isVoided ? 'bg-red-50/30' : 'hover:bg-ink-50/40'}>
                      <td className="px-4 py-3 font-mono font-bold text-ink-900">
                        {b.batchNo}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {new Date(b.productionDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${b.station === 'bar'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                          }`}>
                          {b.station}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-ink-900">
                        {b.targetMaterialName}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-ink-900">
                        +{formatUnitQty(b.producedQuantity, b.producedUnit, b.targetMaterialName)} {b.producedUnit}
                      </td>
                      <td className="px-4 py-3 text-right font-black text-ink-900">
                        {etb(b.totalCost)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {etb(b.calculatedUnitCost)}
                      </td>
                      <td className="px-4 py-3 text-ink-600">
                        {b.producedByName}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {b.isVoided ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800">
                            Voided
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                            Completed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatch(b);
                              setDetailsModalOpen(true);
                            }}
                            className="p-1 rounded-lg text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition cursor-pointer"
                            title="View Recipe & Ingredients"
                          >
                            <Eye size={15} />
                          </button>
                          {!b.isVoided && isManagerOrAdmin && (
                            <button
                              type="button"
                              onClick={() => {
                                setBatchToVoid(b);
                                setVoidReason('Batch voided by manager');
                                setVoidModalOpen(true);
                              }}
                              className="p-1 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 transition cursor-pointer"
                              title="Void Production Batch"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {filteredBatches.length > itemsPerPage && (
            <Pagination
              currentPage={historyPage}
              totalItems={filteredBatches.length}
              itemsPerPage={itemsPerPage}
              onPageChange={setHistoryPage}
            />
          )}
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────
          MODAL: CREATE / EDIT PRODUCTION RECIPE
      ──────────────────────────────────────────────────────────────── */}
      {recipeModalOpen && (
        <Modal
          title={editingRecipeId ? 'Edit Production Recipe' : 'New Production Recipe (BOM)'}
          onClose={() => setRecipeModalOpen(false)}
          maxWidth="max-w-2xl"
        >
          <form onSubmit={handleSaveRecipe} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Formula Name *
                </label>
                <input
                  type="text"
                  required
                  value={recipeForm.name}
                  onChange={(e) => setRecipeForm({ ...recipeForm, name: e.target.value })}
                  placeholder="e.g. Homemade Mayonnaise"
                  className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs font-medium text-ink-900"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Station *
                </label>
                <select
                  value={recipeForm.station}
                  onChange={(e) => setRecipeForm({ ...recipeForm, station: e.target.value })}
                  className="w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-900"
                >
                  <option value="kitchen">🍳 Kitchen Station</option>
                  <option value="bar">☕ Bar Station</option>
                </select>
              </div>
            </div>

            {/* Target Produced Item */}
            <div className="p-3.5 rounded-xl border border-ink-100 bg-ink-50/50 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-ink-800">
                  Target Produced Item in Inventory *
                </label>
                <button
                  type="button"
                  onClick={() => setRecipeForm({ ...recipeForm, isCreatingNewMaterial: !recipeForm.isCreatingNewMaterial })}
                  className="text-[11px] font-bold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  {recipeForm.isCreatingNewMaterial ? '← Select Existing Item' : '+ Create New Production Item'}
                </button>
              </div>

              {recipeForm.isCreatingNewMaterial ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    required
                    value={recipeForm.newMaterialName}
                    onChange={(e) => setRecipeForm({ ...recipeForm, newMaterialName: e.target.value })}
                    placeholder="New Item Name (e.g. Mayonnaise)"
                    className="sm:col-span-2 rounded-xl border border-ink-200 px-3 py-1.5 text-xs text-ink-900 bg-white"
                  />
                  <input
                    type="text"
                    value={recipeForm.newMaterialUnit}
                    onChange={(e) => setRecipeForm({ ...recipeForm, newMaterialUnit: e.target.value })}
                    placeholder="Unit (kg, ltr, pcs)"
                    className="rounded-xl border border-ink-200 px-3 py-1.5 text-xs text-ink-900 bg-white"
                  />
                </div>
              ) : (
                <SearchableSelect
                  options={rawMaterials.map(m => ({
                    value: m._id,
                    label: `${m.name} (${m.unit})`,
                    sublabel: m.isProduced
                      ? `★ [${m.productionStation === 'bar' ? 'Bar' : 'Kitchen'} Produced Item]`
                      : `Stock: Kitchen ${m.kitchenStock || 0} | Main ${m.mainStoreStock || 0}`,
                    raw: m,
                  }))}
                  value={recipeForm.targetMaterial}
                  onChange={(val) => setRecipeForm({ ...recipeForm, targetMaterial: val })}
                  placeholder="Search and choose produced item..."
                />
              )}
            </div>

            {/* Standard Yield */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Standard Yield Quantity *
                </label>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  required
                  value={recipeForm.yieldQuantity}
                  onChange={(e) => setRecipeForm({ ...recipeForm, yieldQuantity: e.target.value })}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-900 font-bold"
                  placeholder="e.g. 1"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-ink-700 mb-1">
                  Yield Unit *
                </label>
                <input
                  type="text"
                  required
                  value={recipeForm.yieldUnit}
                  onChange={(e) => setRecipeForm({ ...recipeForm, yieldUnit: e.target.value })}
                  placeholder="kg, ltr, pcs, batch"
                  className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-900 font-bold"
                />
              </div>
            </div>

            {/* Dynamic Ingredients */}
            <div className="space-y-2 pt-2 border-t border-ink-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-ink-800">
                  Recipe Ingredients (Amount needed per Standard Yield)
                </label>
                <button
                  type="button"
                  onClick={() => setRecipeForm({
                    ...recipeForm,
                    ingredients: [...recipeForm.ingredients, { material: '', quantity: 1, unit: 'kg', notes: '' }]
                  })}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Ingredient
                </button>
              </div>

              <div className="space-y-2 max-h-72 overflow-visible pr-1">
                {recipeForm.ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-ink-50 p-2 rounded-xl border border-ink-100 text-xs">
                    <div className="flex-1 min-w-[200px]">
                      <SearchableSelect
                        size="sm"
                        options={rawMaterials.map(m => ({
                          value: m._id,
                          label: `${m.name} (${m.unit})`,
                          sublabel: `Cost: ${etb(m.unitCost)} • Stock: Kitchen ${m.kitchenStock || 0} | Main ${m.mainStoreStock || 0}${m.isProduced ? ' ★ [Produced]' : ''}`,
                          category: m.category,
                          raw: m,
                        }))}
                        value={ing.material}
                        onChange={(val, raw) => {
                          const next = [...recipeForm.ingredients];
                          next[idx].material = val;
                          if (raw && !next[idx].unit) next[idx].unit = raw.unit;
                          setRecipeForm({ ...recipeForm, ingredients: next });
                        }}
                        placeholder="Search & choose raw material..."
                      />
                    </div>

                    <input
                      type="number"
                      min="0.0001"
                      step="any"
                      placeholder="Qty"
                      value={ing.quantity}
                      onChange={(e) => {
                        const next = [...recipeForm.ingredients];
                        next[idx].quantity = e.target.value;
                        setRecipeForm({ ...recipeForm, ingredients: next });
                      }}
                      className="w-20 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-900 text-center font-bold"
                    />

                    <input
                      type="text"
                      placeholder="Unit"
                      value={ing.unit}
                      onChange={(e) => {
                        const next = [...recipeForm.ingredients];
                        next[idx].unit = e.target.value;
                        setRecipeForm({ ...recipeForm, ingredients: next });
                      }}
                      className="w-16 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-xs text-ink-900 text-center font-semibold"
                    />

                    {recipeForm.ingredients.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = recipeForm.ingredients.filter((_, i) => i !== idx);
                          setRecipeForm({ ...recipeForm, ingredients: next });
                        }}
                        className="p-1 rounded-lg text-red-500 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Preparation Notes */}
            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">
                Preparation Instructions / Notes
              </label>
              <textarea
                rows={2}
                value={recipeForm.instructions}
                onChange={(e) => setRecipeForm({ ...recipeForm, instructions: e.target.value })}
                placeholder="e.g. Blend egg yolks, slowly drizzle oil while whisking until emulsified."
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-900"
              />
            </div>

            {/* Submit & Cancel */}
            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setRecipeModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-ink-200 text-xs font-bold text-ink-700 hover:bg-ink-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs cursor-pointer"
              >
                Save Formula
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ────────────────────────────────────────────────────────────────
          MODAL: BATCH DETAILS
      ──────────────────────────────────────────────────────────────── */}
      {detailsModalOpen && selectedBatch && (
        <Modal
          title={`Batch #${selectedBatch.batchNo} Details`}
          onClose={() => setDetailsModalOpen(false)}
          maxWidth="max-w-xl"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-ink-50/70 border border-ink-100">
              <div>
                <span className="text-[11px] text-ink-500 block">Produced Item:</span>
                <strong className="text-sm font-bold text-ink-900">{selectedBatch.targetMaterialName}</strong>
              </div>
              <div>
                <span className="text-[11px] text-ink-500 block">Quantity Produced:</span>
                <strong className="text-sm font-black text-emerald-700">+{formatUnitQty(selectedBatch.producedQuantity, selectedBatch.producedUnit, selectedBatch.targetMaterialName)} {selectedBatch.producedUnit}</strong>
              </div>
              <div>
                <span className="text-[11px] text-ink-500 block">Station:</span>
                <span className="font-bold uppercase text-ink-800">{selectedBatch.station} Store</span>
              </div>
              <div>
                <span className="text-[11px] text-ink-500 block">Date & Operator:</span>
                <span>{new Date(selectedBatch.productionDate).toLocaleString()} by {selectedBatch.producedByName}</span>
              </div>
              <div>
                <span className="text-[11px] text-ink-500 block">Total Batch Cost:</span>
                <strong className="text-ink-900">{etb(selectedBatch.totalCost)}</strong>
              </div>
              <div>
                <span className="text-[11px] text-ink-500 block">Calculated Unit Cost:</span>
                <strong className="text-emerald-700">{etb(selectedBatch.calculatedUnitCost)} / {selectedBatch.producedUnit}</strong>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-ink-900 mb-2">Ingredients Consumed from Store:</h4>
              <div className="overflow-x-auto rounded-xl border border-ink-100">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-50 text-[10px] font-bold uppercase tracking-wider text-ink-600">
                    <tr>
                      <th className="px-3 py-2">Ingredient</th>
                      <th className="px-3 py-2 text-center">Consumed Qty</th>
                      <th className="px-3 py-2 text-right">Unit Cost</th>
                      <th className="px-3 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100">
                    {(selectedBatch.ingredientsConsumed || []).map((ing, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 font-medium text-ink-900">{ing.materialName}</td>
                        <td className="px-3 py-2 text-center font-bold text-ink-800">{formatUnitQty(ing.quantity, ing.unit, ing.materialName)} {ing.unit}</td>
                        <td className="px-3 py-2 text-right text-ink-600">{etb(ing.unitCost)}</td>
                        <td className="px-3 py-2 text-right font-bold text-ink-900">{etb(ing.totalCost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedBatch.notes && (
              <p className="text-[11px] text-ink-600 italic bg-ink-50 p-2.5 rounded-xl border border-ink-100">
                Notes: "{selectedBatch.notes}"
              </p>
            )}

            <div className="flex justify-end pt-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setDetailsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-ink-100 hover:bg-ink-200 font-bold text-xs text-ink-800 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ────────────────────────────────────────────────────────────────
          MODAL: VOID PRODUCTION BATCH
      ──────────────────────────────────────────────────────────────── */}
      {voidModalOpen && batchToVoid && (
        <Modal
          title={`Void Production Batch #${batchToVoid.batchNo}`}
          onClose={() => setVoidModalOpen(false)}
          maxWidth="max-w-md"
        >
          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Are you sure you want to void this production batch?</p>
                <p className="text-[11px] mt-1 text-red-800">
                  This will deduct <strong>{batchToVoid.producedQuantity} {batchToVoid.producedUnit}</strong> of <strong>{batchToVoid.targetMaterialName}</strong> back from {batchToVoid.station.toUpperCase()} Store and restore all consumed raw materials.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink-700 mb-1">
                Reason for Voiding *
              </label>
              <textarea
                rows={2}
                required
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g. Quantity input error, spoiled batch, etc."
                className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <button
                type="button"
                onClick={() => setVoidModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-ink-200 text-xs font-bold text-ink-700 hover:bg-ink-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVoid}
                disabled={voiding || !voidReason.trim()}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                {voiding ? 'Voiding Batch…' : 'Confirm & Reverse Stock'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ────────────────────────────────────────────────────────────────
          MODAL: DELETE / REMOVE PRODUCTION RECIPE
      ──────────────────────────────────────────────────────────────── */}
      {deleteRecipeModalOpen && recipeToDelete && (
        <Modal
          title="Delete Production Recipe"
          onClose={() => !deletingRecipe && setDeleteRecipeModalOpen(false)}
          maxWidth="max-w-md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-900 flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle size={18} />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm">Remove this recipe formula?</p>
                <p className="text-xs text-red-800 leading-relaxed">
                  Are you sure you want to remove <strong>"{recipeToDelete.name}"</strong> ({recipeToDelete.code || 'No Code'})?
                </p>
                <p className="text-[11px] text-red-700 mt-1">
                  If no production batches were ever recorded with this recipe, it will be completely deleted from the database. If batches exist, it will be deactivated to keep batch logs intact.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-ink-50 border border-ink-100 space-y-1.5 text-ink-700">
              <div className="flex justify-between">
                <span className="text-ink-500">Formula Code:</span>
                <span className="font-mono font-bold text-ink-900">{recipeToDelete.code || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Station:</span>
                <span className="font-bold uppercase text-ink-900">{recipeToDelete.station}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Produces Item:</span>
                <span className="font-bold text-ink-900">{recipeToDelete.targetMaterial?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-500">Ingredients Count:</span>
                <span className="font-bold text-ink-900">{recipeToDelete.ingredients?.length || 0} items</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-ink-100">
              <button
                type="button"
                disabled={deletingRecipe}
                onClick={() => setDeleteRecipeModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-ink-200 text-xs font-bold text-ink-700 hover:bg-ink-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingRecipe}
                onClick={handleConfirmDeleteRecipe}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-xs cursor-pointer disabled:opacity-50"
              >
                {deletingRecipe ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" /> Removing…
                  </>
                ) : (
                  <>
                    <Trash2 size={13} /> Yes, Remove Recipe
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
