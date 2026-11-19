import React, { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Warehouse,
  UtensilsCrossed,
  Coffee,
  Save,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Layers,
  ArrowRight,
  Info,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import Card from '../ui/Card';
import Button from '../ui/Button';

// Sensible default mapping for Baba Roti Café & Restaurant
const DEFAULT_RAW_MAP = {
  'Bar': 'bar',
  'Kitchen': 'kitchen',
  'ferash Bazare': 'kitchen',
  'Mendi': 'kitchen',
  'Pastery': 'kitchen',
  'CleanerMaterial': 'mainStore',
  'Material': 'mainStore',
};

export default function StationSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Categories extracted from inventory
  const [rawMaterials, setRawMaterials] = useState([]);
  const [products, setProducts] = useState([]);

  // Station Category Mapping state
  const [rawMap, setRawMap] = useState(DEFAULT_RAW_MAP);
  const [productMap, setProductMap] = useState({});

  // Load settings, raw materials, and products
  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    Promise.all([
      api.get('/settings').catch(() => ({ data: {} })),
      api.get('/materials').catch(() => ({ data: [] })),
      api.get('/products').catch(() => ({ data: [] })),
    ])
      .then(([settingsRes, materialsRes, productsRes]) => {
        if (!isMounted) return;

        const sData = settingsRes.data || {};
        const mapping = sData.stationCategoryMapping || {};

        if (mapping.rawMaterialMap && Object.keys(mapping.rawMaterialMap).length > 0) {
          setRawMap(mapping.rawMaterialMap);
        } else {
          setRawMap(DEFAULT_RAW_MAP);
        }

        if (mapping.productMap) {
          setProductMap(mapping.productMap);
        }

        setRawMaterials(Array.isArray(materialsRes.data) ? materialsRes.data : []);
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      })
      .catch((err) => {
        if (isMounted) setErrorMsg('Failed to load station mapping settings: ' + err.message);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Compute unique raw material categories and item counts
  const rawCategories = useMemo(() => {
    const counts = {};
    rawMaterials.forEach((m) => {
      const cat = String(m.category || 'General').trim();
      counts[cat] = (counts[cat] || 0) + 1;
    });

    // Ensure known default categories are also visible even if empty
    Object.keys(DEFAULT_RAW_MAP).forEach((k) => {
      if (counts[k] === undefined) counts[k] = 0;
    });

    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map((name) => ({
        name,
        count: counts[name] || 0,
        station: rawMap[name] || detectDefaultStation(name),
      }));
  }, [rawMaterials, rawMap]);

  // Compute unique product categories
  const prodCategories = useMemo(() => {
    const set = new Set();
    products.forEach((p) => {
      if (p.category) set.add(String(p.category).trim());
    });
    return Array.from(set).sort().map((name) => {
      const sample = products.find((p) => String(p.category).trim() === name);
      const isDrink =
        sample?.parentCategory === 'BEVERAGE' ||
        /beverage|drink|coffee|tea|juice|soda|beer|wine|water/i.test(name);
      return {
        name,
        sampleProduct: sample?.name || '',
        parentCategory: sample?.parentCategory || (isDrink ? 'BEVERAGE' : 'FOOD'),
        station: productMap[name] || (isDrink ? 'bar' : 'kitchen'),
      };
    });
  }, [products, productMap]);

  function detectDefaultStation(catName) {
    const lower = String(catName || '').toLowerCase();
    if (lower === 'bar' || /beverage|drink|coffee|tea|juice|soda|beer|wine|water/i.test(lower)) {
      return 'bar';
    }
    if (
      lower === 'kitchen' ||
      lower === 'ferash bazare' ||
      lower === 'mendi' ||
      lower === 'pastery' ||
      /produce|meat|poultry|dairy|bakery|grains|spices|food|fresh|fruit|veg/i.test(lower)
    ) {
      return 'kitchen';
    }
    return 'mainStore';
  }

  // Live count summary of materials mapped to each station
  const stationSummary = useMemo(() => {
    let mainCats = 0, mainItems = 0;
    let kitchenCats = 0, kitchenItems = 0;
    let barCats = 0, barItems = 0;

    rawCategories.forEach((c) => {
      if (c.station === 'kitchen') {
        kitchenCats++;
        kitchenItems += c.count;
      } else if (c.station === 'bar') {
        barCats++;
        barItems += c.count;
      } else {
        mainCats++;
        mainItems += c.count;
      }
    });

    return {
      main: { cats: mainCats, items: mainItems },
      kitchen: { cats: kitchenCats, items: kitchenItems },
      bar: { cats: barCats, items: barItems },
      totalItems: rawMaterials.length,
    };
  }, [rawCategories, rawMaterials]);

  // Change mapping for a raw material category
  const setCategoryStation = (catName, station) => {
    setRawMap((prev) => ({
      ...prev,
      [catName]: station,
    }));
  };

  // Change mapping for a product category
  const setProductCategoryStation = (catName, station) => {
    setProductMap((prev) => ({
      ...prev,
      [catName]: station,
    }));
  };

  // Auto-Map All to standard defaults
  const handleAutoMapAll = () => {
    const newRaw = {};
    rawCategories.forEach((c) => {
      newRaw[c.name] = detectDefaultStation(c.name);
    });
    setRawMap(newRaw);

    const newProd = {};
    prodCategories.forEach((p) => {
      newProd[p.name] = p.parentCategory === 'BEVERAGE' ? 'bar' : 'kitchen';
    });
    setProductMap(newProd);

    setSuccessMsg('Recommended station mappings applied! Click "Save Station Mappings" to persist.');
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  // Save mapping to server
  const handleSave = async () => {
    setSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.put('/settings', {
        stationCategoryMapping: {
          rawMaterialMap: rawMap,
          productMap: productMap,
        },
      });
      setSuccessMsg('Station category mapping saved successfully! All station views will now use this mapping.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save station mapping.');
    } finally {
      setSaving(false);
    }
  };

  // Apply to existing raw materials storeLocation in database
  const handleSyncToDatabase = async () => {
    if (!window.confirm('This will update the storeLocation on all active raw materials in the database according to this station mapping. Continue?')) {
      return;
    }
    setSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      // First save current mapping
      await api.put('/settings', {
        stationCategoryMapping: {
          rawMaterialMap: rawMap,
          productMap: productMap,
        },
      });

      const res = await api.post('/settings/apply-station-category-mapping', {
        rawMaterialMap: rawMap,
      });

      setSuccessMsg(
        `Synchronized! ${res.data?.updatedCount || 0} materials updated out of ${res.data?.count || 0} total active items.`
      );
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to synchronize materials.');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <Card className="max-w-4xl py-12 text-center">
        <RefreshCw size={24} className="mx-auto animate-spin text-blue-600 mb-2" />
        <p className="text-sm font-medium text-ink-600">Loading station configuration…</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* ── Top Header & Explainer ── */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50/60 via-white to-indigo-50/40 p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-600 p-2.5 text-white shadow-md">
              <Boxes size={22} />
            </span>
            <div>
              <h3 className="font-display text-lg font-bold text-ink-900">
                Stations &amp; Category Mapping
              </h3>
              <p className="text-xs text-ink-600 mt-0.5">
                Configure which raw material categories and recipe items belong to <strong>Kitchen Station</strong>, <strong>Bar Station</strong>, or <strong>Main Store Warehouse</strong>.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleAutoMapAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-brass-300 bg-brass-50/80 px-3 py-1.5 text-xs font-bold text-brass-800 hover:bg-brass-100 transition shadow-2xs cursor-pointer"
              title="Automatically detect and assign Kitchen, Bar, and Main Store categories"
            >
              <Sparkles size={13} className="text-brass-600" /> Auto-Map Defaults
            </button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2"
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save Station Mappings'}
            </Button>
          </div>
        </div>

        {/* Status Alerts */}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-semibold text-emerald-800 shadow-2xs">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800 shadow-2xs">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </Card>

      {/* ── 3 Station Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {/* 🏢 Main Store */}
        <div className="rounded-2xl border border-blue-200 bg-white p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-blue-900 text-sm">
              <Warehouse size={16} className="text-blue-600" /> Main Store (Central Warehouse)
            </span>
            <span className="rounded-full bg-blue-100 text-blue-800 text-[11px] font-bold px-2 py-0.5">
              {rawMaterials.length} items (100%)
            </span>
          </div>
          <p className="text-[11px] text-ink-500 leading-relaxed">
            Central mother store for <strong>ALL {rawMaterials.length} materials</strong>. Every supply order starts in Main Store before being dispatched to Kitchen or Bar.
          </p>
          <div className="text-xs font-semibold text-blue-800 pt-1 border-t border-blue-100 flex justify-between">
            <span>Warehouse Status:</span>
            <strong>All Materials Available</strong>
          </div>
        </div>

        {/* 🍳 Kitchen Station */}
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-amber-900 text-sm">
              <UtensilsCrossed size={16} className="text-amber-600" /> Kitchen Station
            </span>
            <span className="rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5">
              {stationSummary.kitchen.items} items
            </span>
          </div>
          <p className="text-[11px] text-ink-500 leading-relaxed">
            Food preparation stock (Buns, Mandi, Pastry, Breakfast, Fresh Bazaar meat & vegetables). Consumed on food sales.
          </p>
          <div className="text-xs font-semibold text-amber-800 pt-1 border-t border-amber-100 flex justify-between">
            <span>Mapped categories:</span>
            <strong>{stationSummary.kitchen.cats}</strong>
          </div>
        </div>

        {/* ☕ Bar Station */}
        <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 font-bold text-emerald-900 text-sm">
              <Coffee size={16} className="text-emerald-600" /> Bar Station
            </span>
            <span className="rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2 py-0.5">
              {stationSummary.bar.items} items
            </span>
          </div>
          <p className="text-[11px] text-ink-500 leading-relaxed">
            Beverage and barista stock (Espresso, Milk, Syrups, Tea, Fresh Juices, Soft Drinks, Alcohol). Consumed on drink sales.
          </p>
          <div className="text-xs font-semibold text-emerald-800 pt-1 border-t border-emerald-100 flex justify-between">
            <span>Mapped categories:</span>
            <strong>{stationSummary.bar.cats}</strong>
          </div>
        </div>
      </div>

      {/* ── Section 1: Raw Material Categories Mapping ── */}
      <Card className="p-5 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-ink-100">
          <div>
            <h4 className="font-display text-sm font-bold text-ink-900 flex items-center gap-2">
              <Layers size={16} className="text-blue-600" /> Route Categories to Kitchen or Bar Station
            </h4>
            <p className="text-xs text-ink-500 mt-0.5">
              Main Store holds all items. Below, simply select whether a category belongs to <strong>Kitchen Station</strong> or <strong>Bar Station</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSyncToDatabase}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition shadow-2xs cursor-pointer shrink-0"
            title="Update all existing material records in the database with their mapped store location"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing DB…' : 'Sync to All 161 Materials'}</span>
          </button>
        </div>

        {/* Categories Table */}
        <div className="overflow-hidden rounded-xl border border-ink-200/80 bg-white">
          <table className="min-w-full divide-y divide-ink-100 text-sm">
            <thead className="bg-ink-50 text-[11px] font-bold uppercase tracking-wider text-ink-600">
              <tr>
                <th className="px-4 py-2.5 text-left">Category Name</th>
                <th className="px-4 py-2.5 text-center">Items Count</th>
                <th className="px-4 py-2.5 text-left">Station Assignment</th>
                <th className="px-4 py-2.5 text-right">Route to Station (Kitchen / Bar)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-50">
              {rawCategories.map((c) => {
                const currentStation = c.station;
                const isKitchen = currentStation === 'kitchen';
                const isBar = currentStation === 'bar';
                return (
                  <tr key={c.name} className="hover:bg-ink-50/40 transition">
                    <td className="px-4 py-3 font-semibold text-ink-900">
                      <span className="flex items-center gap-2">
                        {isKitchen && <UtensilsCrossed size={14} className="text-amber-500" />}
                        {isBar && <Coffee size={14} className="text-emerald-500" />}
                        {!isKitchen && !isBar && <Warehouse size={14} className="text-blue-500" />}
                        <span>{c.name}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-bold text-ink-700">
                        {c.count} items
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isKitchen && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200">
                          <UtensilsCrossed size={12} /> Kitchen Station
                        </span>
                      )}
                      {isBar && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <Coffee size={12} /> Bar Station
                        </span>
                      )}
                      {!isKitchen && !isBar && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-500 font-semibold">
                          <Warehouse size={12} className="text-blue-500" /> Main Store (All Items Available)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {/* Segmented station button group (Kitchen or Bar) */}
                      <div className="inline-flex items-center rounded-xl border border-ink-200/90 p-0.5 bg-ink-50/70 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setCategoryStation(c.name, isKitchen ? 'none' : 'kitchen')}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${isKitchen
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'text-ink-600 hover:text-ink-900 hover:bg-white'
                            }`}
                          title={isKitchen ? 'Assigned to Kitchen (Click to unassign)' : 'Assign to Kitchen Station'}
                        >
                          <UtensilsCrossed size={12} /> Kitchen
                        </button>
                        <button
                          type="button"
                          onClick={() => setCategoryStation(c.name, isBar ? 'none' : 'bar')}
                          className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold transition cursor-pointer ${isBar
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-ink-600 hover:text-ink-900 hover:bg-white'
                            }`}
                          title={isBar ? 'Assigned to Bar (Click to unassign)' : 'Assign to Bar Station'}
                        >
                          <Coffee size={12} /> Bar
                        </button>
                        {(isKitchen || isBar) && (
                          <button
                            type="button"
                            onClick={() => setCategoryStation(c.name, 'none')}
                            className="inline-flex items-center rounded-lg px-2 py-1.5 text-xs text-ink-400 hover:text-ink-700 hover:bg-white transition cursor-pointer"
                            title="Remove from station (stays in Main Store only)"
                          >
                            <X size={12} />
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
      </Card>

      {/* ── Section 2: Recipe / Product Categories Mapping ── */}
      {prodCategories.length > 0 && (
        <Card className="p-5 shadow-soft">
          <div className="mb-4 pb-3 border-b border-ink-100">
            <h4 className="font-display text-sm font-bold text-ink-900 flex items-center gap-2">
              <UtensilsCrossed size={16} className="text-amber-600" /> POS Recipe / Product Routing
            </h4>
            <p className="text-xs text-ink-500 mt-0.5">
              When POS orders are completed, sales automatically deduct recipe ingredients from the station selected below.
            </p>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-200/80 bg-white">
            <table className="min-w-full divide-y divide-ink-100 text-sm">
              <thead className="bg-ink-50 text-[11px] font-bold uppercase tracking-wider text-ink-600">
                <tr>
                  <th className="px-4 py-2.5 text-left">Product Category</th>
                  <th className="px-4 py-2.5 text-left">Parent Classification</th>
                  <th className="px-4 py-2.5 text-left">Station Routing</th>
                  <th className="px-4 py-2.5 text-right">Assign Deduction Station</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50">
                {prodCategories.map((p) => {
                  const currentStation = p.station;
                  return (
                    <tr key={p.name} className="hover:bg-ink-50/40 transition">
                      <td className="px-4 py-2.5 font-semibold text-ink-900">
                        {p.name}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-ink-500">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 font-bold text-[10px] uppercase ${p.parentCategory === 'BEVERAGE' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                          }`}>
                          {p.parentCategory}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        {currentStation === 'bar' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                            <Coffee size={13} /> Deduct from Bar Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                            <UtensilsCrossed size={13} /> Deduct from Kitchen Stock
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex rounded-xl border border-ink-200/90 p-0.5 bg-ink-50/70 shadow-2xs">
                          <button
                            type="button"
                            onClick={() => setProductCategoryStation(p.name, 'kitchen')}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${currentStation === 'kitchen'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-ink-600 hover:text-ink-900 hover:bg-white'
                              }`}
                          >
                            <UtensilsCrossed size={11} /> Food (Kitchen)
                          </button>
                          <button
                            type="button"
                            onClick={() => setProductCategoryStation(p.name, 'bar')}
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition cursor-pointer ${currentStation === 'bar'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'text-ink-600 hover:text-ink-900 hover:bg-white'
                              }`}
                          >
                            <Coffee size={11} /> Drink (Bar)
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Save Footer ── */}
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-ink-500">
          Changes take effect immediately across Raw Materials, POS, and Stock Requisitions.
        </span>
        <Button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 shadow-sm"
        >
          <Save size={15} /> {saving ? 'Saving Mappings…' : 'Save Station Mappings'}
        </Button>
      </div>
    </div>
  );
}
