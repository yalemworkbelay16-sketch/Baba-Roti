import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, ChefHat, X, Upload, Download, Zap, Sparkles, Camera, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import Pagination from '../components/ui/Pagination';
import SearchableSelect from '../components/ui/SearchableSelect';
import ProductImageModal from '../components/products/ProductImageModal';

const emptyForm = {
  code: '',
  name: '',
  category: '',
  parentCategory: 'FOOD',
  uom: 'Pcs',
  description: '',
  sellingPrice: 0,
  imageUrl: '',
  ingredients: [],
};

const Products = () => {
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importProgress, setImportProgress] = useState(null); // { percent, current, total, created, updated, skipped }
  const [recipeImportResult, setRecipeImportResult] = useState(null);
  const [recipeImportProgress, setRecipeImportProgress] = useState(null);
  const [imageModalProduct, setImageModalProduct] = useState(null);
  const [generatingAiRowId, setGeneratingAiRowId] = useState(null);
  const [bulkAiProgress, setBulkAiProgress] = useState(null);
  const [quickUploadProductId, setQuickUploadProductId] = useState(null);
  const [formAiGenerating, setFormAiGenerating] = useState(false);
  const importRef = useRef();
  const recipeImportRef = useRef();
  const quickUploadInputRef = useRef();
  const formImageInputRef = useRef();
  const { hasRole, can, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('products', 'edit') : (hasRole('admin', 'manager') || can('recordGoods'));
  const canDelete = canCrud ? canCrud('products', 'delete') : hasRole('admin');

  const load = () =>
    api.get('/products', { params: { search } }).then((r) => {
      setProducts(Array.isArray(r.data) ? r.data : []);
      setSelected(new Set());
    }).catch(() => setProducts([]));

  useEffect(() => { load(); }, [search]);
  useEffect(() => {
    api.get('/materials')
      .then((r) => setMaterials(Array.isArray(r.data) ? r.data : []))
      .catch(() => setMaterials([]));
  }, []);

  // ── Selection helpers ──
  const allIds = products.map((p) => p._id);
  const allChecked = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const someChecked = allIds.some((id) => selected.has(id));

  const toggleAll = () => {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };


  // ── CRUD ──
  // Calculate next sequential product code respecting format (e.g. P-001 -> P-002, P-0001 -> P-0002)
  const getNextProductCode = () => {
    let maxNum = 0;
    let detectedPad = 4;
    products.forEach((p) => {
      const match = String(p.code || '').match(/^P-?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
          detectedPad = match[1].length;
        }
      }
    });
    const nextNum = maxNum + 1;
    const padLength = Math.max(detectedPad, 3);
    return `P-${String(nextNum).padStart(padLength, '0')}`;
  };

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    const autoCode = getNextProductCode();
    setForm({ ...emptyForm, code: autoCode, imageUrl: '' });
    setModalOpen(true);
  };

  // Re-generate or recalculate code
  const generateCode = () => {
    setForm(f => ({ ...f, code: getNextProductCode() }));
  };

  const openEdit = (p) => {
    setEditing(p);
    setForm({
      code: p.code || '',
      name: p.name,
      category: p.category,
      parentCategory: p.parentCategory || 'FOOD',
      uom: p.uom || 'Pcs',
      description: p.description,
      sellingPrice: p.sellingPrice,
      imageUrl: p.imageUrl || '',
      ingredients: (p.ingredients || []).map((ing) => ({
        material: ing.material?._id ?? ing.material,
        materialName: ing.material?.name ?? '',
        unit: ing.material?.unit ?? '',
        quantity: ing.quantity,
      })),
    });
    setModalOpen(true);
  };

  const openDetail = (p) => { setSelectedProduct(p); setDetailOpen(true); };

  // ── Single Product AI Image Generation (1-Click) ──
  const handleQuickGenerateAi = async (p) => {
    try {
      setGeneratingAiRowId(p._id);
      const res = await api.post(`/products/${p._id}/ai-image`, {});
      if (res.data?.success) {
        setProducts((prev) =>
          prev.map((item) => (item._id === p._id ? { ...item, imageUrl: res.data.imageUrl } : item))
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate AI image.');
    } finally {
      setGeneratingAiRowId(null);
    }
  };

  // ── Quick 1-Click Upload from Computer from Table Row ──
  const handleTriggerQuickUpload = (p) => {
    setQuickUploadProductId(p._id);
    if (quickUploadInputRef.current) {
      quickUploadInputRef.current.value = '';
      quickUploadInputRef.current.click();
    }
  };

  const handleQuickFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !quickUploadProductId) return;
    try {
      setGeneratingAiRowId(quickUploadProductId);
      const formData = new FormData();
      formData.append('image', file);
      const res = await api.post(`/products/${quickUploadProductId}/image`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.success) {
        setProducts((prev) =>
          prev.map((item) =>
            item._id === quickUploadProductId ? { ...item, imageUrl: res.data.imageUrl } : item
          )
        );
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setGeneratingAiRowId(null);
      setQuickUploadProductId(null);
    }
  };

  // ── Form-level Manual Upload & AI Generation (in Add/Edit Modal) ──
  const handleFormImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setFormAiGenerating(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.files?.[0]?.url) {
        setForm((f) => ({ ...f, imageUrl: res.data.files[0].url }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setFormAiGenerating(false);
    }
  };

  const handleFormAiGenerate = async () => {
    if (!form.name?.trim()) {
      alert('Please enter a product name first so AI knows what food image to detect and create.');
      return;
    }
    try {
      setFormAiGenerating(true);
      if (editing?._id) {
        const res = await api.post(`/products/${editing._id}/ai-image`, {
          prompt: `Appetizing professional restaurant food photography of freshly prepared ${form.name} (${form.category || 'FOOD'}), beautifully plated on a rustic dining table, warm ambient café lighting, commercial culinary photo`,
        });
        if (res.data?.success) {
          setForm((f) => ({ ...f, imageUrl: res.data.imageUrl }));
          setProducts((prev) =>
            prev.map((item) => (item._id === editing._id ? { ...item, imageUrl: res.data.imageUrl } : item))
          );
        }
      } else {
        // Temporary mock preview or fallback for unsaved item
        const encoded = encodeURIComponent(`Delicious restaurant food photo of ${form.name}, food photography`);
        setForm((f) => ({ ...f, imageUrl: `https://image.pollinations.ai/prompt/${encoded}?width=600&height=600&nologo=true` }));
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate AI image.');
    } finally {
      setFormAiGenerating(false);
    }
  };

  // ── Bulk AI Image Generator for all missing products ──
  const handleBulkAiImages = async () => {
    const missingProducts = products.filter((p) => !p.imageUrl);
    if (missingProducts.length === 0) {
      alert('All products already have photos!');
      return;
    }

    if (
      !confirm(
        `Detect food names and generate authentic AI dish photos for ${missingProducts.length} product(s) missing images?`
      )
    ) {
      return;
    }

    setBulkAiProgress({
      running: true,
      total: missingProducts.length,
      current: 0,
      updated: 0,
      failed: 0,
      percent: 15,
    });

    try {
      const res = await api.post('/products/bulk-ai-images', {
        ids: missingProducts.map((p) => p._id),
      });

      setBulkAiProgress({
        running: false,
        total: missingProducts.length,
        current: missingProducts.length,
        updated: res.data?.updated || 0,
        failed: res.data?.failed || 0,
        percent: 100,
        message: res.data?.message,
      });

      load();
    } catch (err) {
      setBulkAiProgress({
        running: false,
        error: err.response?.data?.message || 'Bulk AI image generation failed.',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(''); setSaving(true);

    // Client-side duplicate code check (skip self when editing)
    const trimCode = (form.code || '').trim().replace(/-+$/, '').toLowerCase();
    if (trimCode) {
      const conflict = products.find(p => {
        if (editing && String(p._id) === String(editing._id)) return false;
        return (p.code || '').replace(/-+$/, '').toLowerCase() === trimCode;
      });
      if (conflict) {
        setFormError(`Code "${form.code}" is already used by "${conflict.name}". Choose a different code.`);
        setSaving(false);
        return;
      }
    }

    // Client-side duplicate name check (only when name actually changed)
    const trimName = (form.name || '').trim().toLowerCase();
    const originalName = (editing?.name || '').trim().toLowerCase();
    if (trimName !== originalName) {
      const nameConflict = products.find(p => {
        if (editing && String(p._id) === String(editing._id)) return false;
        return p.name.trim().toLowerCase() === trimName;
      });
      if (nameConflict) {
        setFormError(`A product named "${form.name.trim()}" already exists (Code: ${nameConflict.code || 'no code'}). Use a different name.`);
        setSaving(false);
        return;
      }
    }

    const payload = {
      code: form.code,
      name: form.name,
      category: form.category,
      parentCategory: form.parentCategory,
      uom: form.uom,
      description: form.description,
      sellingPrice: form.sellingPrice,
      imageUrl: form.imageUrl || '',
      ingredients: form.ingredients.map(({ material, quantity }) => ({ material, quantity })),
    };
    try {
      if (editing) {
        await api.put(`/products/${editing._id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save product.');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this product?')) return;
    await api.delete(`/products/${id}`);
    load();
  };
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} selected product(s)? This cannot be undone.`)) return;
    await api.delete('/products/bulk', { data: { ids: [...selected] } });
    load();
  };
  // ── Ingredient builder ──
  const addIngredient = () =>
    setForm((f) => ({ ...f, ingredients: [...f.ingredients, { material: '', materialName: '', unit: '', quantity: 1 }] }));

  const removeIngredient = (idx) =>
    setForm((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));

  const updateIngredient = (idx, field, value) =>
    setForm((f) => {
      const ings = [...f.ingredients];
      ings[idx] = { ...ings[idx], [field]: value };
      if (field === 'material') {
        const mat = materials.find((m) => m._id === value);
        ings[idx].materialName = mat?.name ?? '';
        ings[idx].unit = mat?.unit ?? '';
      }
      return { ...f, ingredients: ings };
    });

  // ── Excel ──
  const handleExport = async () => {
    const res = await api.get('/products/export/excel', { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = url; a.download = 'products.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setImportResult(null);
    setImportProgress({ percent: 0, current: 0, total: 0, created: 0, updated: 0, skipped: 0, running: true });

    const fd = new FormData();
    fd.append('file', file);

    // Get the auth token from localStorage
    const stored = localStorage.getItem('hotelStockAuth');
    const token = stored ? JSON.parse(stored).token : '';
    const baseURL = import.meta.env.VITE_API_URL || '/api';
    try {
      const response = await fetch(`${baseURL}/products/import/excel`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'start') {
              setImportProgress(p => ({ ...p, total: msg.total }));
            } else if (msg.type === 'progress') {
              setImportProgress({
                running: true,
                percent: msg.percent,
                current: msg.current,
                total: msg.total,
                created: msg.created,
                updated: msg.updated,
                skipped: msg.skipped,
              });
            } else if (msg.type === 'done') {
              setImportProgress(null);
              setImportResult({
                message: `Import complete — ${msg.created} created, ${msg.updated} updated, ${msg.skipped} skipped out of ${msg.total} rows`,
                errors: msg.errors || [],
              });
              load();
            }
          } catch { /* skip malformed line */ }
        }
      }
    } catch (err) {
      setImportProgress(null);
      setImportResult({ message: 'Import failed: ' + err.message, errors: [] });
    }
  };

  // ── Download recipe template ──
  const handleDownloadRecipeTemplate = async () => {
    try {
      const stored = localStorage.getItem('hotelStockAuth');
      const token = stored ? JSON.parse(stored).token : '';
      const baseURL = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${baseURL}/products/export/recipe-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Failed to download template');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'recipe_template.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Could not download template: ' + err.message);
    }
  };

  // ── Import recipes from Excel ──
  const handleRecipeImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    setRecipeImportResult(null);
    setRecipeImportProgress({ percent: 0, current: 0, total: 0, updated: 0, skipped: 0, running: true });

    const fd = new FormData();
    fd.append('file', file);

    const stored = localStorage.getItem('hotelStockAuth');
    const token = stored ? JSON.parse(stored).token : '';
    const baseURL = import.meta.env.VITE_API_URL || '/api';

    try {
      const response = await fetch(`${baseURL}/products/import/recipes`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.type === 'start') {
              setRecipeImportProgress(p => ({ ...p, total: msg.total }));
            } else if (msg.type === 'progress') {
              setRecipeImportProgress({
                running: true,
                percent: msg.percent,
                current: msg.current,
                total: msg.total,
                updated: msg.updated,
                skipped: msg.skipped,
              });
            } else if (msg.type === 'done') {
              setRecipeImportProgress(null);
              setRecipeImportResult({
                message: `Recipe import complete — ${msg.updated} product(s) updated, ${msg.skipped} skipped out of ${msg.total} products`,
                errors: msg.errors || [],
              });
              load();
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err) {
      setRecipeImportProgress(null);
      setRecipeImportResult({ message: 'Import failed: ' + err.message, errors: [] });
    }
  };

  const recipeCost = (p) =>
    p.ingredients?.reduce((sum, ing) => sum + (ing.material?.unitCost ?? 0) * ing.quantity, 0) ?? 0;

  const exportData = useMemo(() => {
    return products.map(p => ({
      'Code': p.code || '—',
      'Product Name': p.name,
      'Department': p.parentCategory || 'FOOD',
      'Category': p.category || 'General',
      'Unit (UOM)': p.uom || 'Pcs',
      'Selling Price (ETB)': Number(p.sellingPrice || 0).toFixed(2),
      'Ingredients Count': p.ingredients?.length || 0,
      'Active': p.isActive !== false ? 'Yes' : 'No',
    }));
  }, [products]);

  // Paginated slice for the table
  const pagedProducts = React.useMemo(
    () => products.slice((page - 1) * pageSize, page * pageSize),
    [products, page, pageSize]
  );
  // Reset to page 1 on search
  React.useEffect(() => { setPage(1); }, [search]);
  const pdfColumns = [
    { header: 'Code', accessor: 'Code' },
    { header: 'Product Name', accessor: 'Product Name' },
    { header: 'Department', accessor: 'Department' },
    { header: 'Category', accessor: 'Category' },
    { header: 'Unit', accessor: 'Unit (UOM)', align: 'center' },
    { header: 'Selling Price (ETB)', accessor: 'Selling Price (ETB)', align: 'right' },
    { header: 'Ingredients', accessor: 'Ingredients Count', align: 'center' },
  ];

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products…"
            className="w-full rounded-lg border border-ink-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk delete — shown when items selected and user has delete privilege */}
          {canDelete && selected.size > 0 && (
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              <Trash2 size={15} /> Delete {selected.size} selected
            </button>
          )}

          {/* Export & Import (Excel, PDF, CSV, Print) */}
          <ExportDropdown
            data={exportData}
            fileName="products_catalog"
            pdfTitle="Products & Recipes Catalog"
            pdfColumns={pdfColumns}
            showImport={canEdit}
            onImport={() => importRef.current?.click()}
            importLabel="Import Excel"
          />
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />

          {/* Import Recipes button */}
          {canEdit && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleDownloadRecipeTemplate}
                title="Download recipe template (pre-filled with all products)"
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
              >
                <Download size={14} /> Recipe Template
              </button>
              <button
                onClick={() => recipeImportRef.current?.click()}
                title="Import ingredient recipes from Excel"
                className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition"
              >
                <Upload size={14} /> Import Recipes
              </button>
              <input ref={recipeImportRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleRecipeImport} />

              {/* Bulk AI Images Generator Button */}
              <button
                onClick={handleBulkAiImages}
                disabled={bulkAiProgress?.running}
                title="Automatically detect food names and generate authentic dish photos with AI"
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:from-indigo-100 hover:to-purple-100 transition shadow-2xs"
              >
                {bulkAiProgress?.running ? (
                  <Loader2 size={14} className="animate-spin text-indigo-600" />
                ) : (
                  <Sparkles size={14} className="text-amber-500 animate-pulse" />
                )}
                Auto AI Images
                {products.filter((p) => !p.imageUrl).length > 0 && (
                  <span className="rounded-full bg-indigo-200/80 px-1.5 py-0.2 text-[10px] font-bold text-indigo-900">
                    {products.filter((p) => !p.imageUrl).length}
                  </span>
                )}
              </button>
            </div>
          )}

          {canEdit && (
            <Button style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }} onClick={openCreate}>
              <Plus size={16} /> Add product
            </Button>
          )}
        </div>
      </div>

      {/* Bulk AI Images progress bar */}
      {bulkAiProgress?.running && (
        <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-semibold text-indigo-900">
              <Sparkles size={15} className="animate-pulse text-indigo-600" />
              Generating photorealistic AI food photos for menu items…
            </span>
            <span className="tabular text-indigo-700 font-bold">In progress</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-indigo-200">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 animate-pulse"
              style={{ width: `${Math.max(bulkAiProgress.percent, 35)}%` }}
            />
          </div>
          <p className="text-xs text-indigo-700">
            AI is analyzing dish names, generating culinary food photography, and saving permanently into MongoDB Atlas GridFS…
          </p>
        </div>
      )}

      {bulkAiProgress?.message && !bulkAiProgress.running && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-indigo-600" />
            <span className="font-semibold">{bulkAiProgress.message}</span>
          </div>
          <button onClick={() => setBulkAiProgress(null)} className="ml-4 text-indigo-400 hover:text-indigo-700">
            <X size={16} />
          </button>
        </div>
      )}

      {bulkAiProgress?.error && (
        <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <span className="font-semibold">{bulkAiProgress.error}</span>
          <button onClick={() => setBulkAiProgress(null)} className="ml-4 text-rose-400 hover:text-rose-700">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Import progress bar */}
      {importProgress && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-blue-800">Importing products…</span>
            <span className="tabular text-blue-700 font-bold">{importProgress.percent}%</span>
          </div>
          {/* Progress bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-blue-200">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-150"
              style={{ width: `${importProgress.percent}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-blue-700">
            <span>{importProgress.current} / {importProgress.total} rows</span>
            <span className="text-emerald-700">✓ {importProgress.created} created</span>
            <span className="text-violet-700">↻ {importProgress.updated} updated</span>
            {importProgress.skipped > 0 && <span className="text-amber-700">⚠ {importProgress.skipped} skipped</span>}
          </div>
        </div>
      )}

      {/* Import result */}
      {importResult && (
        <div className="flex items-start justify-between rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <div>
            <p className="font-semibold">{importResult.message}</p>
            {importResult.errors?.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs text-red-600 max-h-24 overflow-y-auto">
                {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="ml-4 text-blue-400 hover:text-blue-700"><X size={16} /></button>
        </div>
      )}

      {/* Recipe import progress bar */}
      {recipeImportProgress && (
        <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-violet-800">Importing recipes…</span>
            <span className="tabular text-violet-700 font-bold">{recipeImportProgress.percent}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-violet-200">
            <div
              className="h-full rounded-full bg-violet-600 transition-all duration-150"
              style={{ width: `${recipeImportProgress.percent}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-violet-700">
            <span>{recipeImportProgress.current} / {recipeImportProgress.total} rows processed</span>
            <span className="text-emerald-700">✓ {recipeImportProgress.updated} products updated</span>
            {recipeImportProgress.skipped > 0 && <span className="text-amber-700">⚠ {recipeImportProgress.skipped} skipped</span>}
          </div>
        </div>
      )}

      {/* Recipe import result */}
      {recipeImportResult && (
        <div className="flex items-start justify-between rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800">
          <div>
            <p className="font-semibold">{recipeImportResult.message}</p>
            {recipeImportResult.errors?.length > 0 && (
              <ul className="mt-1 list-disc pl-4 text-xs text-red-600 max-h-24 overflow-y-auto">
                {recipeImportResult.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
          <button onClick={() => setRecipeImportResult(null)} className="ml-4 text-violet-400 hover:text-violet-700"><X size={16} /></button>
        </div>
      )}

      {/* ── Table with inline checkboxes ── */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
              <tr>
                {canDelete && (
                  <th className="w-10 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>
                    <input
                      type="checkbox"
                      checked={allChecked}
                      ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-white/40 accent-white cursor-pointer"
                    />
                  </th>
                )}
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Code</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Product</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Category</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>UOM</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Ingredients</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Selling Price</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Photo / Image</th>
                {(canEdit || canDelete) && <th className="whitespace-nowrap px-4 py-2.5 text-right text-[11px] font-bold uppercase tracking-wider text-blue-100" style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>Actions</th>}
              </tr>
            </thead>
            <tbody style={{ borderTop: 'none' }}>
              {products.length === 0 && (
                <tr>
                  <td colSpan={(canDelete ? 1 : 0) + 7 + (canEdit || canDelete ? 1 : 0)} className="px-4 py-10 text-center text-ink-400">
                    No products yet. Add your first product or import from Excel.
                  </td>
                </tr>
              )}
              {pagedProducts.map((p) => (
                <tr
                  key={p._id}
                  className={`hover:bg-ink-50/50 ${selected.has(p._id) ? 'bg-blue-50/60' : ''}`}
                >
                  {canDelete && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(p._id)}
                        onChange={() => toggleOne(p._id)}
                        className="h-4 w-4 rounded border-ink-300 accent-blue-600 cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-ink-400">{p.code || '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button onClick={() => openDetail(p)} className="font-medium text-blue-700 hover:underline text-left">
                      {p.name}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-700">
                    {p.category}
                    {p.parentCategory && <span className="ml-1 text-xs text-ink-400">/ {p.parentCategory}</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">{p.uom || 'Pcs'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-500">
                    {p.ingredients?.length ?? 0} item{p.ingredients?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-medium tabular">
                    ETB {p.sellingPrice?.toFixed(2) ?? '0.00'}
                  </td>
                  {/* Photo / Image column */}
                  <td className="whitespace-nowrap px-4 py-2 text-center">
                    {p.imageUrl ? (
                      <div className="relative group inline-flex items-center justify-center">
                        <img
                          src={p.imageUrl}
                          alt={p.name}
                          onClick={() => setImageModalProduct(p)}
                          className="h-10 w-10 rounded-lg object-cover border border-slate-200 shadow-2xs cursor-pointer transition hover:scale-105 hover:ring-2 hover:ring-blue-500"
                          title="Click to view or edit image"
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                          }}
                        />
                        {canEdit && (
                          <button
                            onClick={() => setImageModalProduct(p)}
                            className="absolute -bottom-1 -right-1 rounded-full bg-white p-0.5 shadow-sm border border-slate-200 text-slate-500 hover:text-blue-600 transition"
                            title="Change image"
                          >
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1">
                        {canEdit ? (
                          <>
                            <button
                              onClick={() => handleQuickGenerateAi(p)}
                              disabled={generatingAiRowId === p._id}
                              className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/90 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:from-indigo-100 hover:to-purple-100 shadow-2xs transition disabled:opacity-50"
                              title="Detect food name and generate image with AI"
                            >
                              {generatingAiRowId === p._id ? (
                                <>
                                  <Loader2 size={12} className="animate-spin text-indigo-600" />
                                  <span className="text-[10px]">AI...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles size={12} className="text-amber-500 animate-pulse" />
                                  <span>AI Photo</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleTriggerQuickUpload(p)}
                              disabled={generatingAiRowId === p._id}
                              className="rounded-lg bg-slate-50 border border-slate-200 p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition"
                              title="Upload image from computer"
                            >
                              <Upload size={12} />
                            </button>
                          </>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">No image</span>
                        )}
                      </div>
                    )}
                  </td>
                  {(canEdit || canDelete) && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <button
                            onClick={() => setImageModalProduct(p)}
                            className="rounded-md p-1.5 text-ink-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
                            title="Import / Edit Image (Upload or AI)"
                          >
                            <Camera size={15} />
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={() => openEdit(p)} className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700" title="Edit">
                            <Pencil size={15} />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(p._id)} className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600" title="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>{/* end overflow-x-auto */}

        {/* Pagination */}
        <Pagination
          page={page}
          pageSize={pageSize}
          total={products.length}
          onPage={setPage}
          onPageSize={(s) => { setPageSize(s); setPage(1); }}
        />
      </div>

      {/* ── Add / Edit Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit product' : 'Add product'} width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Code</label>
              <div className="flex items-center gap-1.5">
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="e.g. P-0013"
                  className="flex-1 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
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
              <label className="mb-1 block text-sm font-medium text-ink-600">UOM</label>
              <input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })}
                placeholder="Pcs"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-sm font-medium text-ink-600">Product name *</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Baba Roti  CaféBurger"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Child Category</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                placeholder="e.g. Lunch & Dinner"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Parent Category</label>
              <input value={form.parentCategory} onChange={(e) => setForm({ ...form, parentCategory: e.target.value })}
                placeholder="e.g. FOOD"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Selling price (ETB)</label>
              <input type="number" step="0.01" min="0" value={form.sellingPrice}
                onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink-600">Description</label>
              <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            {/* Product Image (Manual & AI) */}
            <div className="col-span-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                  <Camera size={14} className="text-blue-600" />
                  Product Image (Menu Photo)
                </label>
                {form.imageUrl && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                    className="text-xs text-rose-600 hover:text-rose-700 hover:underline"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-xl border border-slate-300 bg-white shadow-xs">
                  {form.imageUrl ? (
                    <img
                      src={form.imageUrl}
                      alt={form.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-slate-300">
                      <Camera size={20} />
                      <span className="text-[9px] text-slate-400 font-medium">No Image</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-wrap items-center gap-2">
                  <input
                    ref={formImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFormImageUpload}
                  />
                  <button
                    type="button"
                    onClick={() => formImageInputRef.current?.click()}
                    disabled={formAiGenerating}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs disabled:opacity-50"
                  >
                    <Upload size={13} className="text-blue-600" />
                    📁 Upload from Computer
                  </button>

                  <button
                    type="button"
                    onClick={handleFormAiGenerate}
                    disabled={formAiGenerating}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:from-blue-700 hover:to-indigo-700 active:scale-[0.98] transition disabled:opacity-50"
                  >
                    {formAiGenerating ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-white" />
                        <span>AI Generating...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} className="text-amber-300 animate-pulse" />
                        <span>✨ Generate with AI</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Recipe */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                <ChefHat size={16} className="text-blue-600" /> Recipe Ingredients
              </label>
              <button type="button" onClick={addIngredient}
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">
                <Plus size={13} /> Add ingredient
              </button>
            </div>
            {form.ingredients.length === 0 && (
              <p className="rounded-lg border border-dashed border-ink-200 py-4 text-center text-xs text-ink-400">
                No ingredients yet — click "Add ingredient" to build the recipe.
              </p>
            )}
            <div className="space-y-2">
              {form.ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <SearchableSelect
                    required
                    placeholder="Select raw material…"
                    options={materials}
                    value={ing.material}
                    onChange={(val) => updateIngredient(idx, 'material', val)}
                  />
                  <div className="flex items-center gap-1">
                    <input type="number" step="0.001" min="0" required value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, 'quantity', Number(e.target.value))}
                      className="w-24 rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                      placeholder="Qty" />
                    <span className="w-8 text-xs text-ink-400">{ing.unit}</span>
                  </div>
                  <button type="button" onClick={() => removeIngredient(idx)}
                    className="rounded-md p-1.5 text-ink-300 hover:bg-red-50 hover:text-red-500">
                    <X size={15} />
                  </button>
                </div>
              ))}
            </div>
            {(form.ingredients?.length > 0) && (
              <div className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-sm">
                <span className="text-ink-500">Estimated recipe cost: </span>
                <span className="font-semibold text-blue-700">
                  ETB {(form.ingredients || []).reduce((sum, ing) => {
                    const mat = materials.find((m) => m._id === ing.material);
                    return sum + (mat?.unitCost ?? 0) * ing.quantity;
                  }, 0).toFixed(2)}
                </span>
              </div>
            )}
          </div>

          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
              <span className="shrink-0">⚠</span> {formError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white', opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Saving…' : (editing ? 'Save changes' : 'Add product')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Detail Modal ── */}
      <Modal open={detailOpen} onClose={() => setDetailOpen(false)} title={selectedProduct?.name ?? ''} width="max-w-lg">
        {selectedProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-ink-400">Code</p><p className="font-mono font-medium">{selectedProduct.code || '—'}</p></div>
              <div><p className="text-xs text-ink-400">UOM</p><p className="font-medium">{selectedProduct.uom || 'Pcs'}</p></div>
              <div><p className="text-xs text-ink-400">Child Category</p><p className="font-medium">{selectedProduct.category || '—'}</p></div>
              <div><p className="text-xs text-ink-400">Parent Category</p><p className="font-medium">{selectedProduct.parentCategory || '—'}</p></div>
              <div><p className="text-xs text-ink-400">Selling Price</p><p className="font-medium">ETB {selectedProduct.sellingPrice?.toFixed(2)}</p></div>
              <div><p className="text-xs text-ink-400">Description</p><p className="font-medium">{selectedProduct.description || '—'}</p></div>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-700">
                <ChefHat size={15} className="text-blue-600" /> Recipe
              </p>
              {selectedProduct.ingredients?.length === 0 ? (
                <p className="text-sm text-ink-400">No ingredients defined.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs text-ink-400">
                      <th className="pb-1 font-medium">Ingredient</th>
                      <th className="pb-1 font-medium text-right">Qty</th>
                      <th className="pb-1 font-medium text-right">Unit Cost</th>
                      <th className="pb-1 font-medium text-right">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProduct.ingredients.map((ing, i) => {
                      const ingDetail = selectedProduct.costBreakdown?.ingredients?.[i];
                      const unitCost = ingDetail ? ingDetail.effectiveUnitCost : (ing.material?.unitCost ?? 0);
                      const cost = ingDetail ? ingDetail.subtotal : (unitCost * ing.quantity);
                      const isAdjusted = ingDetail && ingDetail.effectiveUnitCost !== ingDetail.baseUnitCost;

                      return (
                        <tr key={i} className="border-b border-ink-50">
                          <td className="py-1.5 font-medium text-ink-800">{ing.material?.name ?? '—'}</td>
                          <td className="py-1.5 text-right tabular">{ing.quantity} {ing.material?.unit}</td>
                          <td className="py-1.5 text-right tabular text-ink-600">
                            ETB {unitCost.toFixed(2)}
                            {isAdjusted && (
                              <span className="ml-1 text-[10px] text-amber-600 font-normal">
                                (base: {ingDetail.baseUnitCost.toFixed(2)})
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 text-right tabular font-bold text-ink-900">ETB {cost.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-2 text-right text-xs font-semibold text-ink-500">Raw Material Cost</td>
                      <td className="pt-2 text-right font-bold text-blue-700">ETB {(selectedProduct.costBreakdown?.rawMaterialCost ?? recipeCost(selectedProduct)).toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {/* Cost Breakdown Panel */}
              {selectedProduct.costBreakdown && (
                <div className="mt-4 rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-emerald-100 bg-emerald-100/50">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Full Cost Breakdown (Culinary Cost Sheet)</p>
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {[
                        { label: 'Raw Material Cost (Ingredients Total)', value: selectedProduct.costBreakdown.rawMaterialCost, color: 'text-ink-700 font-bold' },
                        { label: `+ Contingency (${selectedProduct.costBreakdown.contingencyPercent ?? selectedProduct.costBreakdown.settings?.contingencyPercent}%)`, value: selectedProduct.costBreakdown.contingencyAmount, color: 'text-amber-600' },
                        { label: `+ Overhead (${selectedProduct.costBreakdown.overheadPercent ?? selectedProduct.costBreakdown.settings?.overheadPercent}%)`, value: selectedProduct.costBreakdown.overheadAmount, color: 'text-violet-600' },
                        { label: `+ Spice Cost (${selectedProduct.costBreakdown.spiceCostPercent ?? selectedProduct.costBreakdown.settings?.spiceCostPercent ?? 5}%)`, value: selectedProduct.costBreakdown.spiceAmount, color: 'text-rose-600' },
                        { label: 'Total Recipe Cost (Grand Total)', value: selectedProduct.costBreakdown.totalCost, color: 'text-ink-900 font-black', divider: true },
                        { label: `Suggested Price @ ${selectedProduct.costBreakdown.settings?.defaultFoodCostPercent}% Food Cost`, value: selectedProduct.costBreakdown.suggestedSellingPrice, color: 'text-emerald-700 font-black' },
                      ].map(({ label, value, color, divider }) => (
                        <tr key={label} className={divider ? 'border-t border-emerald-200' : ''}>
                          <td className="px-4 py-1.5 text-ink-600">{label}</td>
                          <td className={`px-4 py-1.5 text-right tabular ${color}`}>ETB {Number(value ?? 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Selling price benchmarks */}
                  <div className="px-4 py-2.5 border-t border-emerald-200 bg-emerald-100/30">
                    <p className="text-[10px] font-bold text-emerald-700 mb-2">Selling Price Benchmarks</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { pct: 30, val: selectedProduct.costBreakdown.sellingAt30pct },
                        { pct: 35, val: selectedProduct.costBreakdown.sellingAt35pct },
                        { pct: 40, val: selectedProduct.costBreakdown.sellingAt40pct },
                        { pct: 50, val: selectedProduct.costBreakdown.sellingAt50pct },
                      ].map(({ pct, val }) => (
                        <div key={pct} className="rounded-lg bg-white border border-emerald-200 px-3 py-1.5 text-center">
                          <p className="text-[9px] text-ink-400">Food cost {pct}%</p>
                          <p className="font-black text-emerald-800 text-xs">ETB {Number(val ?? 0).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                    {selectedProduct.costBreakdown.settings?.rawMaterialPriceAdjustValue > 0 && (
                      <p className="text-[10px] text-amber-600 mt-2 font-semibold">
                        ⚡ Price adjustment applied: +{selectedProduct.costBreakdown.settings.rawMaterialPriceAdjustValue}{selectedProduct.costBreakdown.settings.rawMaterialPriceAdjustType === 'percent' ? '%' : ' ETB'} on all raw material costs
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {canEdit && (
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => setDetailOpen(false)}>Close</Button>
                <Button
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#3730a3)', color: 'white' }}
                  onClick={() => { setDetailOpen(false); setImageModalProduct(selectedProduct); }}
                >
                  <Camera size={14} /> Manage Image
                </Button>
                <Button style={{ background: 'linear-gradient(135deg,#1a56db,#0d2d80)', color: 'white' }}
                  onClick={() => { setDetailOpen(false); openEdit(selectedProduct); }}>
                  <Pencil size={14} /> Edit
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Hidden file input for table quick 1-click manual upload */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={handleQuickFileChange}
      />

      {/* Product Image Modal (AI Detection & Generation + Manual Upload from Computer) */}
      <ProductImageModal
        open={Boolean(imageModalProduct)}
        onClose={() => setImageModalProduct(null)}
        product={imageModalProduct}
        onImageUpdated={(updated) => {
          setProducts((prev) =>
            prev.map((p) => (p._id === updated._id ? { ...p, ...updated } : p))
          );
        }}
      />
    </div>
  );
};

export default Products;
