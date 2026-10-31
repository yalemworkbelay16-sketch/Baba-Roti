import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Utensils,
  Eye,
  EyeOff,
  Check,
  AlertTriangle,
  Search,
  Sparkles,
  Download,
  Printer,
  ExternalLink,
  Plus,
  Trash2,
  RefreshCw,
  Sliders,
  CheckCircle2,
  XCircle,
  Copy,
  Layers,
  Star,
  MessageSquare,
} from 'lucide-react';
import api from '../../api/axios';
import Button from '../ui/Button';

export default function DigitalMenuSettings() {
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // General Settings
  const [settings, setSettings] = useState({
    enabled: true,
    allowOrdering: true,
    bannerText: 'Delicious Food Freshly Made',
    bannerSubtitle: 'Fresh Buns, Hot Specialty Coffee & Savory Meals',
    tiktokUrl: 'https://www.tiktok.com/@babaroti_ethiopia',
    facebookUrl: 'https://www.facebook.com/babarotiethiopia',
    instagramUrl: 'https://www.instagram.com/babaroti_ethiopia',
    telegramUrl: 'https://t.me/babaroticafe',
    phone: '+251 91 123 4567',
    tables: [
      'Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05',
      'Table 06', 'Table 07', 'Table 08', 'Table 09', 'Table 10',
      'Table 12', 'Table 15', 'Table 20', 'Table 36', 'VIP 01', 'Patio 01', 'Patio 02'
    ],
    enableCallWaiter: true,
    enableBillRequest: true,
  });

  // Products list for menu toggling
  const [products, setProducts] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [updatingId, setUpdatingId] = useState(null);

  // Table QR Generation & Printing State
  const [newTableInput, setNewTableInput] = useState('');
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [activeTab, setActiveTab] = useState('items'); // 'items' | 'qrcodes' | 'general' | 'reviews'

  // Customer Reviews & Ratings state
  const [reviewsData, setReviewsData] = useState({ total: 0, averageRating: 5.0, reviews: [] });
  const [loadingReviews, setLoadingReviews] = useState(false);

  const fetchReviews = async () => {
    try {
      setLoadingReviews(true);
      const res = await api.get('/settings/menu-reviews');
      if (res.data?.success) {
        setReviewsData({
          total: res.data.total || 0,
          averageRating: res.data.averageRating || 5.0,
          reviews: res.data.reviews || [],
        });
      }
    } catch (_) {
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleDeleteReview = async (id) => {
    if (!confirm('Are you sure you want to delete this customer review?')) return;
    try {
      await api.delete(`/settings/menu-reviews/${id}`);
      fetchReviews();
    } catch (_) {
      alert('Could not delete review');
    }
  };

  // Fetch initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      const [settRes, prodRes, matRes] = await Promise.all([
        api.get('/settings'),
        api.get('/products?limit=500'),
        api.get('/materials?limit=500'),
      ]);

      if (settRes.data?.digitalMenuSettings) {
        setSettings((prev) => ({
          ...prev,
          ...settRes.data.digitalMenuSettings,
        }));
      }

      setProducts(prodRes.data?.products || prodRes.data || []);
      setRawMaterials(matRes.data?.materials || matRes.data || []);
      fetchReviews();
    } catch (err) {
      console.error('Failed to load menu settings:', err);
      setErrorMsg('Could not load menu configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Map raw material stock for real-time shortage detection
  const materialStockMap = useMemo(() => {
    const map = new Map();
    rawMaterials.forEach((m) => {
      map.set(String(m._id), {
        name: m.name,
        currentStock: Number(m.currentStock || 0),
        unit: m.unit,
      });
    });
    return map;
  }, [rawMaterials]);

  // Generate QR code data URLs for each table
  useEffect(() => {
    async function generateQRs() {
      const origin = window.location.origin;
      const urls = {};
      for (const table of settings.tables || []) {
        try {
          const menuUrl = `${origin}/menu?table=${encodeURIComponent(table)}`;
          const dataUrl = await QRCode.toDataURL(menuUrl, {
            width: 320,
            margin: 2,
            color: {
              dark: '#271406',
              light: '#ffffff',
            },
          });
          urls[table] = dataUrl;
        } catch (e) {
          console.error('QR generation error for table', table, e);
        }
      }
      setQrDataUrls(urls);
    }

    if (settings.tables?.length > 0) {
      generateQRs();
    }
  }, [settings.tables]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category || 'General'));
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = selectedCategory === 'All' || (p.category || '').toLowerCase() === selectedCategory.toLowerCase();
      const matchSearch =
        !productSearch.trim() ||
        (p.name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
        (p.code || '').toLowerCase().includes(productSearch.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, productSearch]);

  // Toggle single product field (visibility, out-of-stock, featured)
  const handleToggleProduct = async (product, field) => {
    setUpdatingId(product._id);
    const updatedValue = !product[field];
    try {
      const payload = { [field]: updatedValue };
      await api.put(`/products/${product._id}/menu-visibility`, payload);

      setProducts((prev) =>
        prev.map((p) => (p._id === product._id ? { ...p, [field]: updatedValue } : p))
      );
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update item display.');
    } finally {
      setUpdatingId(null);
    }
  };

  // Bulk visibility toggle (turn all ON or all OFF)
  const handleBulkVisibility = async (isAvailableOnMenu) => {
    if (!window.confirm(`Are you sure you want to ${isAvailableOnMenu ? 'SHOW' : 'HIDE'} all items on the Digital Menu?`)) return;
    try {
      setLoading(true);
      await api.post('/products/bulk-menu-visibility', { isAvailableOnMenu });
      setProducts((prev) => prev.map((p) => ({ ...p, isAvailableOnMenu })));
      setSuccessMsg(`All items ${isAvailableOnMenu ? 'displayed on' : 'hidden from'} customer menu.`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Bulk update failed.');
    } finally {
      setLoading(false);
    }
  };

  // Save General Digital Menu Settings
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingSettings(true);
    setSuccessMsg('');
    setErrorMsg('');
    try {
      await api.put('/settings', {
        digitalMenuSettings: settings,
      });
      setSuccessMsg('Digital Menu configuration saved successfully!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Add a new table to the list
  const handleAddTable = () => {
    const trimmed = newTableInput.trim();
    if (!trimmed) return;
    if (settings.tables.includes(trimmed)) {
      alert('This table is already in the list.');
      return;
    }
    const updatedTables = [...settings.tables, trimmed];
    setSettings((prev) => ({ ...prev, tables: updatedTables }));
    setNewTableInput('');
  };

  // Remove table
  const handleRemoveTable = (tableToRemove) => {
    if (!window.confirm(`Remove ${tableToRemove} from digital menu tables?`)) return;
    const updatedTables = settings.tables.filter((t) => t !== tableToRemove);
    setSettings((prev) => ({ ...prev, tables: updatedTables }));
  };

  // ── Print Individual Table QR Stand Card ──────────────────────────────
  const printTableQRCard = (table) => {
    const qrImage = qrDataUrls[table];
    if (!qrImage) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Please allow popups to print table stand cards.');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Baba Roti QR Stand - ${table}</title>
  <style>
    @page { size: portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; background: #fff; padding: 20px; color: #1e293b; }
    .card { max-width: 380px; margin: 0 auto; border: 3px solid #271406; border-radius: 28px; padding: 32px 24px; box-shadow: 0 10px 25px rgba(0,0,0,0.06); }
    .logo { width: 56px; height: 56px; border-radius: 16px; background: #271406; color: #fef08a; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; margin-bottom: 12px; }
    .cafe-name { font-size: 22px; font-weight: 900; color: #271406; text-transform: uppercase; letter-spacing: -0.5px; margin: 0; }
    .tagline { font-size: 11px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
    .table-badge { display: inline-block; background: #271406; color: #fff; font-size: 16px; font-weight: 900; padding: 6px 18px; border-radius: 20px; margin: 18px 0; }
    .qr-box { background: #fbf9f4; border: 2px dashed #d97706; border-radius: 20px; padding: 16px; display: inline-block; }
    .qr-img { width: 220px; height: 220px; display: block; border-radius: 12px; }
    .instructions { font-size: 13px; font-weight: 800; color: #0f172a; margin-top: 18px; }
    .sub-instructions { font-size: 11px; color: #64748b; margin-top: 4px; }
    .footer { font-size: 10px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🥐</div>
    <h1 class="cafe-name">BABA ROTI CAFÉ</h1>
    <div class="tagline">Fresh Buns &bull; Specialty Coffee</div>
    <div class="table-badge">${table}</div>
    <div class="qr-box">
      <img src="${qrImage}" class="qr-img" alt="Scan to Order" />
    </div>
    <div class="instructions">📷 Open Phone Camera &amp; point to order instantly</div>
    <div class="sub-instructions">Browse digital menu &bull; Customize &bull; Instant Kitchen Prep</div>
    <div class="footer">Powered by Baba Roti Smart POS</div>
  </div>
  <script>
    window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // ── Print ALL Table QR Stand Cards ────────────────────────────────────
  const printAllTableQRCards = () => {
    const tables = settings.tables || [];
    if (!tables.length) return alert('No tables to print.');

    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert('Please allow popups to print table stand cards.');

    const cardsHtml = tables
      .map((table) => {
        const qrImage = qrDataUrls[table] || '';
        return `
      <div class="card">
        <div class="logo">🥐</div>
        <h1 class="cafe-name">BABA ROTI CAFÉ</h1>
        <div class="tagline">Fresh Buns &bull; Specialty Coffee</div>
        <div class="table-badge">${table}</div>
        <div class="qr-box">
          <img src="${qrImage}" class="qr-img" alt="Scan to Order" />
        </div>
        <div class="instructions">📱 Scan with phone camera to order</div>
        <div class="sub-instructions">Browse digital menu &bull; Customize &bull; Sent to Kitchen</div>
        <div class="footer">Powered by Baba Roti Smart POS</div>
      </div>
      <div class="page-break"></div>
      `;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Baba Roti QR Table Stands - All Tables</title>
  <style>
    @page { size: portrait; margin: 10mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; text-align: center; background: #fff; padding: 10px; color: #1e293b; }
    .card { max-width: 360px; margin: 20px auto; border: 3px solid #271406; border-radius: 28px; padding: 28px 20px; }
    .logo { width: 50px; height: 50px; border-radius: 14px; background: #271406; color: #fef08a; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; margin-bottom: 8px; }
    .cafe-name { font-size: 20px; font-weight: 900; color: #271406; margin: 0; }
    .tagline { font-size: 10px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; }
    .table-badge { display: inline-block; background: #271406; color: #fff; font-size: 15px; font-weight: 900; padding: 5px 16px; border-radius: 20px; margin: 16px 0; }
    .qr-box { background: #fbf9f4; border: 2px dashed #d97706; border-radius: 18px; padding: 12px; display: inline-block; }
    .qr-img { width: 200px; height: 200px; display: block; border-radius: 10px; }
    .instructions { font-size: 12px; font-weight: 800; color: #0f172a; margin-top: 14px; }
    .sub-instructions { font-size: 10px; color: #64748b; margin-top: 2px; }
    .footer { font-size: 9px; color: #94a3b8; margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 8px; }
    .page-break { page-break-after: always; }
  </style>
</head>
<body>
  ${cardsHtml}
  <script>
    window.onload = function() { window.print(); };
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Download individual QR PNG
  const downloadQrPng = (table) => {
    const dataUrl = qrDataUrls[table];
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `baba-roti-qr-${table.toLowerCase().replace(/\s+/g, '-')}.png`;
    a.click();
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw size={28} className="animate-spin text-amber-700 mx-auto" />
        <p className="text-xs font-semibold text-ink-500">Loading Customer Digital Menu Settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <XCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-amber-950 via-amber-900 to-amber-800 p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-12 w-12 rounded-2xl bg-amber-800/90 border border-amber-600/40 flex items-center justify-center text-2xl shadow-inner shrink-0">
            🥐
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white">
                Customer Digital Menu &amp; Table QR Hub
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-amber-950">
                Self-Ordering Live
              </span>
            </div>
            <p className="text-xs text-amber-200/90 mt-0.5">
              Control food item visibility, manage real-time shortage overrides, and generate printable QR code stands for every table.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <a
            href="/menu"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-amber-950 font-black text-xs shadow-md transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>Preview Menu</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Sub-Tabs: Items Management vs Table QRs vs General Config */}
      <div className="flex items-center gap-2 border-b border-ink-200 pb-2 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('items')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${activeTab === 'items'
              ? 'bg-amber-900 text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-100 bg-white border border-ink-200'
            }`}
        >
          <Utensils size={14} />
          <span>Food Display &amp; Shortage Manager</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-800 text-amber-100">
            {products.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('qrcodes')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${activeTab === 'qrcodes'
              ? 'bg-amber-900 text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-100 bg-white border border-ink-200'
            }`}
        >
          <QrCode size={14} />
          <span>Table QR Codes &amp; Stands</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-800 text-amber-100">
            {settings.tables?.length || 0}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${activeTab === 'general'
              ? 'bg-amber-900 text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-100 bg-white border border-ink-200'
            }`}
        >
          <Sliders size={14} />
          <span>Menu Rules &amp; Controls</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('reviews');
            fetchReviews();
          }}
          className={`px-4 py-2 rounded-xl transition flex items-center gap-2 ${activeTab === 'reviews'
              ? 'bg-amber-900 text-white shadow-sm'
              : 'text-ink-600 hover:bg-ink-100 bg-white border border-ink-200'
            }`}
        >
          <Star size={14} className="text-amber-400 fill-amber-400" />
          <span>Customer Ratings &amp; Reviews</span>
          {reviewsData.total > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-black">
              {reviewsData.total}
            </span>
          )}
        </button>
      </div>

      {/* ── TAB 1: FOOD DISPLAY & SHORTAGE MANAGER ── */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-ink-200 shadow-xs">
            {/* Search */}
            <div className="relative flex-1 max-w-sm">
              <Search size={14} className="absolute left-3 top-2.5 text-ink-400" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search food title, recipe, code..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-ink-200 outline-none focus:border-amber-600"
              />
            </div>

            {/* Quick Bulk Actions */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                type="button"
                onClick={() => handleBulkVisibility(true)}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1"
              >
                <Eye size={13} /> Turn All ON
              </button>
              <button
                type="button"
                onClick={() => handleBulkVisibility(false)}
                className="px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold transition flex items-center gap-1"
              >
                <EyeOff size={13} /> Turn All OFF
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition ${selectedCategory.toLowerCase() === cat.toLowerCase()
                    ? 'bg-amber-900 text-white'
                    : 'bg-white border border-ink-200 text-ink-600 hover:bg-ink-50'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Products Table */}
          <div className="bg-white rounded-2xl border border-ink-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-50 border-b border-ink-200 text-ink-600 font-bold">
                  <tr>
                    <th className="py-3 px-4">Food Item</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-right">Selling Price</th>
                    <th className="py-3 px-3">Inventory Ingredients Status</th>
                    <th className="py-3 px-3 text-center">Menu Display (On/Off)</th>
                    <th className="py-3 px-3 text-center">Availability / Shortage</th>
                    <th className="py-3 px-3 text-center">Top Carousel</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {filteredProducts.map((p) => {
                    const isVisible = p.isAvailableOnMenu !== false;
                    const isManualOut = !!p.manualOutOfStock;
                    const isFeatured = !!p.isFeatured;

                    // Real-time stock shortage check
                    let hasStockDepleted = false;
                    const ingredientChecks = (p.ingredients || []).map((ing) => {
                      const matId = String(ing.material?._id || ing.material);
                      const matData = materialStockMap.get(matId);
                      const currentBal = matData ? matData.currentStock : 999;
                      if (currentBal <= 0) hasStockDepleted = true;
                      return {
                        name: matData?.name || 'Raw Material',
                        bal: currentBal,
                        unit: matData?.unit || 'unit',
                      };
                    });

                    return (
                      <tr key={p._id} className="hover:bg-amber-50/20 transition-colors">
                        {/* Food Name & Image */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-10 w-10 rounded-xl bg-amber-50 border border-ink-200 flex items-center justify-center text-lg overflow-hidden shrink-0">
                              {p.imageUrl ? (
                                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                              ) : (
                                <span>🥐</span>
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-ink-900 leading-tight">{p.name}</p>
                              {p.nameAmharic && (
                                <p className="text-[11px] text-amber-800 font-medium">{p.nameAmharic}</p>
                              )}
                              <span className="text-[10px] text-ink-400 font-mono">{p.code || 'NO-CODE'}</span>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-ink-100 text-ink-700">
                            {p.category || 'General'}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-3 text-right font-black text-ink-900">
                          ETB {Number(p.sellingPrice || 0).toFixed(2)}
                        </td>

                        {/* Ingredients & Stock Status */}
                        <td className="py-3 px-3">
                          {ingredientChecks.length === 0 ? (
                            <span className="text-ink-400 text-[11px] italic">No recipe linked</span>
                          ) : hasStockDepleted ? (
                            <div className="flex items-center gap-1.5 text-red-600 font-bold text-[11px]">
                              <AlertTriangle size={13} />
                              <span>Ingredient Depleted in Store</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11px]">
                              <CheckCircle2 size={13} />
                              <span>{ingredientChecks.length} ingredients in stock</span>
                            </div>
                          )}
                        </td>

                        {/* Menu Display Toggle */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={updatingId === p._id}
                            onClick={() => handleToggleProduct(p, 'isAvailableOnMenu')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto ${isVisible
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                          >
                            {isVisible ? <Eye size={12} /> : <EyeOff size={12} />}
                            <span>{isVisible ? 'Displayed' : 'Hidden'}</span>
                          </button>
                        </td>

                        {/* Shortage / Available Toggle */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={updatingId === p._id}
                            onClick={() => handleToggleProduct(p, 'manualOutOfStock')}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 mx-auto ${isManualOut
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              }`}
                          >
                            {isManualOut ? <AlertTriangle size={12} /> : <Check size={12} />}
                            <span>{isManualOut ? 'Sold Out / Shortage' : 'In Stock'}</span>
                          </button>
                        </td>

                        {/* Featured Carousel */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            disabled={updatingId === p._id}
                            onClick={() => handleToggleProduct(p, 'isFeatured')}
                            className={`p-1.5 rounded-xl text-xs transition mx-auto ${isFeatured
                                ? 'bg-amber-100 text-amber-800 border border-amber-300 font-bold'
                                : 'text-ink-400 hover:bg-ink-100'
                              }`}
                            title={isFeatured ? 'Featured in top banner' : 'Click to feature in top banner'}
                          >
                            <Sparkles size={14} className={isFeatured ? 'fill-amber-500 text-amber-600' : ''} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: TABLE QR CODES & PRINTABLE STANDS ── */}
      {activeTab === 'qrcodes' && (
        <div className="space-y-5">
          {/* Table Manager & Bulk Print Header */}
          <div className="bg-white p-4 rounded-2xl border border-ink-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-ink-900">Table QR Cards &amp; Stands Station</h3>
              <p className="text-xs text-ink-500 mt-0.5">
                Every table has a dedicated QR code that auto-selects the table for the guest when scanned.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                type="button"
                onClick={printAllTableQRCards}
                className="px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-800 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-2"
              >
                <Printer size={14} />
                <span>Print All Table Stands</span>
              </button>
            </div>
          </div>

          {/* Add New Table Input */}
          <div className="flex items-center gap-2 max-w-md">
            <input
              type="text"
              value={newTableInput}
              onChange={(e) => setNewTableInput(e.target.value)}
              placeholder="Add Table (e.g. Table 38, Garden 01, VIP 02)"
              className="flex-1 text-xs bg-white border border-ink-200 rounded-xl px-3.5 py-2 outline-none focus:border-amber-700"
            />
            <button
              type="button"
              onClick={handleAddTable}
              className="px-4 py-2 rounded-xl bg-ink-900 text-white text-xs font-bold hover:bg-black transition flex items-center gap-1.5"
            >
              <Plus size={14} /> Add Table
            </button>
          </div>

          {/* Tables QR Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {(settings.tables || []).map((table) => {
              const qrImage = qrDataUrls[table];
              const menuUrl = `${window.location.origin}/menu?table=${encodeURIComponent(table)}`;

              return (
                <div
                  key={table}
                  className="bg-white rounded-3xl p-4 border border-ink-200 shadow-xs flex flex-col items-center text-center justify-between space-y-3 relative group hover:border-amber-300 transition"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveTable(table)}
                    className="absolute top-3 right-3 text-ink-300 hover:text-red-600 transition"
                    title="Remove Table"
                  >
                    <Trash2 size={14} />
                  </button>

                  <div className="w-full">
                    <span className="px-3 py-1 rounded-full text-xs font-black bg-amber-950 text-white inline-block">
                      {table}
                    </span>
                    <p className="text-[11px] font-mono text-ink-400 mt-1 truncate max-w-full">
                      /menu?table={encodeURIComponent(table)}
                    </p>
                  </div>

                  {/* QR Image Box */}
                  <div className="p-2.5 rounded-2xl bg-amber-50/70 border border-amber-200 shadow-inner">
                    {qrImage ? (
                      <img src={qrImage} alt={`QR for ${table}`} className="h-36 w-36 rounded-xl" />
                    ) : (
                      <div className="h-36 w-36 flex items-center justify-center">
                        <RefreshCw size={20} className="animate-spin text-amber-700" />
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-1.5 w-full pt-1">
                    <button
                      type="button"
                      onClick={() => printTableQRCard(table)}
                      className="py-1.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold transition flex items-center justify-center gap-1"
                      title="Print laminated table stand card"
                    >
                      <Printer size={12} /> Stand
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadQrPng(table)}
                      className="py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center justify-center gap-1"
                      title="Download high-res PNG image"
                    >
                      <Download size={12} /> PNG
                    </button>
                    <a
                      href={menuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center justify-center gap-1"
                      title="Open table menu in new tab"
                    >
                      <ExternalLink size={12} /> Test
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-3">
            <Button onClick={handleSaveSettings} disabled={savingSettings} className="bg-amber-900 hover:bg-amber-800 text-xs font-bold text-white">
              {savingSettings ? 'Saving Changes...' : 'Save Table Configurations'}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB 3: GENERAL MENU RULES ── */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl border border-ink-200 p-5 sm:p-6 shadow-xs space-y-5 max-w-2xl">
          <h3 className="font-bold text-sm text-ink-900 border-b border-ink-100 pb-2">
            General Digital Ordering Controls
          </h3>

          <div className="space-y-4 text-xs">
            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-ink-200 bg-ink-50/50 cursor-pointer">
              <div>
                <p className="font-bold text-ink-900">Enable Digital Menu</p>
                <p className="text-[11px] text-ink-400">Master on/off switch for customer QR ordering page</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings((p) => ({ ...p, enabled: e.target.checked }))}
                className="h-5 w-5 accent-amber-800"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-ink-200 bg-ink-50/50 cursor-pointer">
              <div>
                <p className="font-bold text-ink-900">Allow Direct Ordering to Kitchen</p>
                <p className="text-[11px] text-ink-400">If disabled, customer can only view the menu catalog without placing orders</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowOrdering}
                onChange={(e) => setSettings((p) => ({ ...p, allowOrdering: e.target.checked }))}
                className="h-5 w-5 accent-amber-800"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-ink-200 bg-ink-50/50 cursor-pointer">
              <div>
                <p className="font-bold text-ink-900">Enable "📞 Call Waiter" Button</p>
                <p className="text-[11px] text-ink-400">Allows customer to alert waiter to their table</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableCallWaiter}
                onChange={(e) => setSettings((p) => ({ ...p, enableCallWaiter: e.target.checked }))}
                className="h-5 w-5 accent-amber-800"
              />
            </label>

            <label className="flex items-center justify-between p-3.5 rounded-2xl border border-ink-200 bg-ink-50/50 cursor-pointer">
              <div>
                <p className="font-bold text-ink-900">Enable "💵 Bill Request" Button</p>
                <p className="text-[11px] text-ink-400">Notifies cashier &amp; captain orders when customer is ready to pay</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enableBillRequest}
                onChange={(e) => setSettings((p) => ({ ...p, enableBillRequest: e.target.checked }))}
                className="h-5 w-5 accent-amber-800"
              />
            </label>

            <div>
              <label className="block font-bold text-ink-800 mb-1">Banner Announcement Text</label>
              <input
                type="text"
                value={settings.bannerText}
                onChange={(e) => setSettings((p) => ({ ...p, bannerText: e.target.value }))}
                className="w-full border border-ink-200 rounded-xl px-3 py-2 outline-none focus:border-amber-700"
              />
            </div>

            <div className="pt-3 border-t border-ink-100 space-y-3">
              <h4 className="font-bold text-xs text-ink-900 uppercase tracking-wider text-amber-900">
                Social Media Channels &amp; Contact Information
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-ink-700 mb-1">TikTok Profile URL</label>
                  <input
                    type="url"
                    value={settings.tiktokUrl || ''}
                    placeholder="https://www.tiktok.com/@babaroti_ethiopia"
                    onChange={(e) => setSettings((p) => ({ ...p, tiktokUrl: e.target.value }))}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2 outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Facebook Page URL</label>
                  <input
                    type="url"
                    value={settings.facebookUrl || ''}
                    placeholder="https://www.facebook.com/babarotiethiopia"
                    onChange={(e) => setSettings((p) => ({ ...p, facebookUrl: e.target.value }))}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2 outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Instagram Profile URL</label>
                  <input
                    type="url"
                    value={settings.instagramUrl || ''}
                    placeholder="https://www.instagram.com/babaroti_ethiopia"
                    onChange={(e) => setSettings((p) => ({ ...p, instagramUrl: e.target.value }))}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2 outline-none focus:border-amber-700"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-ink-700 mb-1">Telegram Link / Handle</label>
                  <input
                    type="text"
                    value={settings.telegramUrl || ''}
                    placeholder="https://t.me/babaroticafe"
                    onChange={(e) => setSettings((p) => ({ ...p, telegramUrl: e.target.value }))}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2 outline-none focus:border-amber-700"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-ink-700 mb-1">Customer Order Hotline / Phone</label>
                  <input
                    type="text"
                    value={settings.phone || ''}
                    placeholder="+251 91 123 4567"
                    onChange={(e) => setSettings((p) => ({ ...p, phone: e.target.value }))}
                    className="w-full border border-ink-200 rounded-xl px-3 py-2 outline-none focus:border-amber-700"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-ink-100">
            <Button type="submit" disabled={savingSettings} className="bg-amber-900 hover:bg-amber-800 text-white font-bold text-xs">
              {savingSettings ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>
        </form>
      )}

      {/* ── TAB 4: CUSTOMER RATINGS & REVIEWS ── */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          {/* Header Metric Card */}
          <div className="rounded-3xl border border-ink-200 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 flex flex-col items-center justify-center shadow-md font-serif font-black shrink-0">
                <span className="text-2xl leading-none">{reviewsData.averageRating}</span>
                <span className="text-[10px] font-sans font-bold">out of 5</span>
              </div>
              <div>
                <h3 className="font-bold text-sm text-ink-900 flex items-center gap-2">
                  <span>Customer Satisfaction Score</span>
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={14}
                        className={s <= Math.round(reviewsData.averageRating) ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}
                      />
                    ))}
                  </div>
                </h3>
                <p className="text-xs text-ink-400 mt-0.5">
                  Based on <strong>{reviewsData.total}</strong> customer review{reviewsData.total === 1 ? '' : 's'} submitted via Customer Digital Menu.
                </p>
              </div>
            </div>

            <button
              onClick={fetchReviews}
              disabled={loadingReviews}
              className="px-3.5 py-2 rounded-xl border border-ink-200 bg-ink-50 hover:bg-ink-100 text-xs font-bold text-ink-700 transition flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
            >
              <RefreshCw size={13} className={loadingReviews ? 'animate-spin' : ''} />
              <span>Refresh Reviews</span>
            </button>
          </div>

          {/* Reviews List */}
          {reviewsData.reviews.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-ink-200 bg-white py-12 text-center text-ink-400 space-y-2">
              <Star size={36} className="mx-auto text-amber-300 stroke-[1.5]" />
              <p className="text-sm font-bold text-ink-800">No Customer Reviews Yet</p>
              <p className="text-xs text-ink-400 max-w-sm mx-auto">
                When customers rate their food and dining experience from the digital menu at their table, their star scores, comments, and compliments will appear here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {reviewsData.reviews.map((rev) => (
                <div
                  key={rev._id}
                  className="rounded-2xl border border-ink-200 bg-white p-4 shadow-xs space-y-2.5 hover:border-amber-300 transition"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-ink-900">
                          {rev.customerName || 'Valued Guest'}
                        </span>
                        {rev.tableNo && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-200">
                            {rev.tableNo}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-ink-400 mt-0.5">
                        {new Date(rev.createdAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex text-amber-500">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            size={13}
                            className={s <= rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleDeleteReview(rev._id)}
                        className="text-ink-300 hover:text-rose-600 transition p-1"
                        title="Delete Review"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {rev.comment && (
                    <p className="text-xs text-ink-700 bg-ink-50/50 p-2.5 rounded-xl border border-ink-100/70 italic leading-relaxed">
                      "{rev.comment}"
                    </p>
                  )}

                  {rev.tags && rev.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {rev.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 border border-amber-200/80 text-amber-900"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

