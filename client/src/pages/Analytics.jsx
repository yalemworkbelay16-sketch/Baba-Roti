import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import { exportToExcel } from '../utils/exportUtils';
import {
  TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon,
  BarChart3, Calendar, Layers, AlertTriangle, CheckCircle2,
  Package, Search, RefreshCw, Eye, Trash2, ArrowUpRight,
  Flame, Filter, ChevronRight, ChevronLeft, ChevronDown, Download, CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, BarChart, Bar, Legend
} from 'recharts';

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('pl'); // 'pl' | 'consumption' | 'prediction' | 'records'
  const [dateRange, setDateRange] = useState('30d'); // 'daily' | 'monthly' | '7d' | '30d' | 'all' | 'custom'
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);

  // Data states
  const [plData, setPlData] = useState(null);
  const [consumptionData, setConsumptionData] = useState(null);
  const [predictionData, setPredictionData] = useState(null);
  const [recordsData, setRecordsData] = useState([]);

  // Selected item / modal
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [deletingRecordId, setDeletingRecordId] = useState(null);
  const [batchSearch, setBatchSearch] = useState('');
  const [expandedLineIndex, setExpandedLineIndex] = useState(null);
  const [expandedProduct, setExpandedProduct] = useState(null);
  const [productFilter, setProductFilter] = useState('');
  const [matrixFilter, setMatrixFilter] = useState('ALL'); // 'ALL' | 'Star' | 'Workhorse' | 'Puzzle' | 'Dog'
  const [ingredientFilter, setIngredientFilter] = useState('');

  // Stepping helpers for date navigator
  const handleStepDay = (delta) => {
    const base = selectedDay ? new Date(selectedDay + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + delta);
    setSelectedDay(base.toISOString().slice(0, 10));
    setDateRange('daily');
  };

  const handleStepMonth = (delta) => {
    const baseStr = selectedMonth || new Date().toISOString().slice(0, 7);
    const [y, m] = baseStr.split('-').map(Number);
    const base = new Date(y, m - 1 + delta, 1);
    const nextY = base.getFullYear();
    const nextM = String(base.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${nextY}-${nextM}`);
    setDateRange('monthly');
  };

  // Calculate actual from/to dates based on dateRange preset
  const dateParams = useMemo(() => {
    const now = new Date();
    let from = null;
    let to = null;

    if (dateRange === 'daily' || dateRange === 'today') {
      const d = selectedDay || now.toISOString().slice(0, 10);
      from = d;
      to = d;
    } else if (dateRange === 'monthly') {
      const mStr = selectedMonth || now.toISOString().slice(0, 7);
      const [y, m] = mStr.split('-').map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      from = `${y}-${String(m).padStart(2, '0')}-01`;
      to = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    } else if (dateRange === '7d') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (dateRange === '30d') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      from = d.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (dateRange === 'custom') {
      from = customFrom || null;
      to = customTo || null;
    }
    return { from, to };
  }, [dateRange, selectedDay, selectedMonth, customFrom, customTo]);

  const fetchData = async () => {
    setLoading(true);
    const { from, to } = dateParams;
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;

    try {
      if (activeTab === 'pl') {
        const res = await api.get('/analytics/pl', { params });
        setPlData(res.data);
      } else if (activeTab === 'consumption') {
        const res = await api.get('/analytics/consumption', { params });
        setConsumptionData(res.data);
      } else if (activeTab === 'prediction') {
        const res = await api.get('/analytics/prediction');
        setPredictionData(res.data);
      } else if (activeTab === 'records') {
        const res = await api.get('/analytics/records', { params });
        setRecordsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab, dateParams]);

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this sales import batch? This will remove it from your records and reverse any raw material deductions.')) return;
    setDeletingRecordId(id);
    try {
      await api.delete(`/analytics/records/${id}`);
      setRecordsData(prev => prev.filter(r => r._id !== id));
      if (selectedRecord?._id === id) setSelectedRecord(null);
      await fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete record');
    } finally {
      setDeletingRecordId(null);
    }
  };

  const handleExportBatchLines = () => {
    if (!selectedRecord?.lines?.length) return;
    const exportRows = selectedRecord.lines.map((l, idx) => ({
      '#': idx + 1,
      'Product Code': l.productCode || '—',
      'Product Name': l.productName,
      'Category': l.category || 'General',
      'Quantity Sold': l.quantitySold,
      'Unit Price (ETB)': Number(l.sellingPrice || 0).toFixed(2),
      'Revenue (ETB)': Number(l.revenue || 0).toFixed(2),
      'COGS (ETB)': Number(l.cogs || 0).toFixed(2),
      'Gross Profit (ETB)': Number(l.grossProfit || 0).toFixed(2),
      'Status': l.matchStatus || '—',
    }));
    const cleanRef = String(selectedRecord.reference || 'POS_Batch').replace(/[^\w\d-_]/g, '_');
    exportToExcel(exportRows, `Sales_Batch_${cleanRef}`, 'Sold Products');
  };

  const filteredBatchLines = useMemo(() => {
    if (!selectedRecord?.lines) return [];
    if (!batchSearch.trim()) return selectedRecord.lines;
    const q = batchSearch.trim().toLowerCase();
    return selectedRecord.lines.filter(l =>
      String(l.productName || '').toLowerCase().includes(q) ||
      String(l.productCode || '').toLowerCase().includes(q) ||
      String(l.category || '').toLowerCase().includes(q)
    );
  }, [selectedRecord, batchSearch]);

  const fmt = (n) => (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = (n) => `${(Number(n) || 0).toFixed(1)}%`;

  // ── Export data by active tab ──
  const exportData = useMemo(() => {
    if (activeTab === 'pl' && plData) {
      return (plData.products || []).map(p => ({
        'Product':      p.name,
        'Units Sold':   p.unitsSold ?? 0,
        'Revenue (ETB)': Number(p.revenue || 0).toFixed(2),
        'COGS (ETB)':   Number(p.cogs || 0).toFixed(2),
        'Gross Profit (ETB)': Number((p.revenue || 0) - (p.cogs || 0)).toFixed(2),
        'Food Cost %':  Number(p.foodCostPct || 0).toFixed(1) + '%',
        'Margin %':     Number(p.marginPct || 0).toFixed(1) + '%',
      }));
    }
    if (activeTab === 'consumption' && consumptionData) {
      return (consumptionData.materials || []).map(m => ({
        'Material':       m.name,
        'Unit':           m.unit || '',
        'Total Consumed': Number(m.totalConsumed || 0).toFixed(3),
        'Total Cost (ETB)': Number(m.totalCost || 0).toFixed(2),
        'Avg per Day':    Number(m.avgPerDay || 0).toFixed(3),
      }));
    }
    if (activeTab === 'prediction' && predictionData) {
      return (predictionData.predictions || []).map(p => ({
        'Material':         p.name,
        'Unit':             p.unit || '',
        'Current Stock':    Number(p.currentStock || 0).toFixed(2),
        'Avg Daily Use':    Number(p.avgDailyUse || 0).toFixed(3),
        'Days Remaining':   Number(p.daysRemaining || 0).toFixed(1),
        'Reorder Qty':      Number(p.reorderQty || 0).toFixed(2),
        'Status':           p.status || '',
      }));
    }
    if (activeTab === 'records') {
      return recordsData.map(r => ({
        'Date':           new Date(r.importedAt || r.createdAt).toLocaleDateString(),
        'Product':        r.productName || '—',
        'Units Sold':     r.unitsSold ?? 0,
        'Revenue (ETB)':  Number(r.revenue || 0).toFixed(2),
        'Imported By':    r.importedBy?.name || '—',
      }));
    }
    return [];
  }, [activeTab, plData, consumptionData, predictionData, recordsData]);

  // ── Filtered items and totals for Menu Engineering & Profit Matrix ──
  const filteredMatrixItems = useMemo(() => {
    return (plData?.productBreakdown || []).filter((p) => {
      if (productFilter && !p.productName.toLowerCase().includes(productFilter.toLowerCase())) return false;
      if (matrixFilter !== 'ALL' && p.matrixClass !== matrixFilter) return false;
      return true;
    });
  }, [plData, productFilter, matrixFilter]);

  const matrixTotals = useMemo(() => {
    const count = filteredMatrixItems.length;
    const totalQty = filteredMatrixItems.reduce((s, i) => s + (Number(i.qty) || 0), 0);
    const totalRevenue = filteredMatrixItems.reduce((s, i) => s + (Number(i.revenue) || 0), 0);
    const totalCOGS = filteredMatrixItems.reduce((s, i) => s + (Number(i.cogs) || 0), 0);
    const totalProfit = totalRevenue - totalCOGS;
    const avgSellingPrice = totalQty > 0 ? totalRevenue / totalQty : 0;
    const avgUnitCogs = totalQty > 0 ? totalCOGS / totalQty : 0;
    const overallFoodCostPct = totalRevenue > 0 ? (totalCOGS / totalRevenue) * 100 : 0;
    const overallMarginPct = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    return {
      count,
      totalQty,
      avgSellingPrice,
      avgUnitCogs,
      totalRevenue,
      totalCOGS,
      totalProfit,
      overallFoodCostPct,
      overallMarginPct,
    };
  }, [filteredMatrixItems]);

  // ── Dedicated export for Menu Engineering & Profit Matrix ──
  const matrixExportData = useMemo(() => {
    const rows = filteredMatrixItems.map((item) => ({
      'Product Name': item.productName,
      'Category': item.matrixClass,
      'Qty Sold': item.qty,
      'Avg Selling Price (ETB)': Number(item.avgPrice || 0).toFixed(2),
      'Recipe COGS (ETB)': Number(item.unitCogs || 0).toFixed(2),
      'Total Revenue (ETB)': Number(item.revenue || 0).toFixed(2),
      'Gross Profit (ETB)': Number(item.profit || 0).toFixed(2),
      'Food Cost %': pct(item.costRatio),
      'Margin %': pct(item.margin),
    }));

    if (rows.length > 0) {
      rows.push({
        'Product Name': `TOTAL SUMMARY (${matrixTotals.count} Products)`,
        'Category': 'TOTAL',
        'Qty Sold': matrixTotals.totalQty,
        'Avg Selling Price (ETB)': Number(matrixTotals.avgSellingPrice || 0).toFixed(2),
        'Recipe COGS (ETB)': Number(matrixTotals.totalCOGS || 0).toFixed(2),
        'Total Revenue (ETB)': Number(matrixTotals.totalRevenue || 0).toFixed(2),
        'Gross Profit (ETB)': Number(matrixTotals.totalProfit || 0).toFixed(2),
        'Food Cost %': pct(matrixTotals.overallFoodCostPct),
        'Margin %': pct(matrixTotals.overallMarginPct),
      });
    }

    return rows;
  }, [filteredMatrixItems, matrixTotals]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
              <TrendingUp size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-ink-900">
                P&amp;L &amp; Stock Analytics
              </h1>
              <p className="text-xs text-ink-500 font-medium">
                International Hotel &amp; Restaurant Standard · POS Sales, Recipe COGS, Food Cost % &amp; Par Predictions
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Preset range filters */}
          {activeTab !== 'prediction' && (
            <div className="inline-flex rounded-xl bg-ink-100/70 p-1 text-xs font-semibold text-ink-600">
              {[
                { id: 'daily', label: 'Daily' },
                { id: 'monthly', label: 'Monthly' },
                { id: '7d', label: '7 Days' },
                { id: '30d', label: '30 Days' },
                { id: 'all', label: 'All Time' },
                { id: 'custom', label: 'Custom' },
              ].map((btn) => (
                <button
                  key={btn.id}
                  onClick={() => setDateRange(btn.id)}
                  className={`rounded-lg px-3 py-1.5 transition ${
                    dateRange === btn.id || (btn.id === 'daily' && dateRange === 'today')
                      ? 'bg-white text-blue-600 shadow-sm font-bold'
                      : 'hover:text-ink-900'
                  }`}
                >
                  {btn.label}
                </button>
              ))}
            </div>
          )}

          <Button
            variant="outline"
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs py-2"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </Button>
          <ExportDropdown
            data={exportData}
            fileName={`analytics_${activeTab}`}
            sheetName={activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            pdfTitle={`Analytics — ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            pdfColumns={exportData[0]
              ? Object.keys(exportData[0]).map(k => ({ header: k, accessor: k }))
              : []
            }
          />
        </div>
      </div>

      {/* Date Range Picker Banner for Daily, Monthly & Custom */}
      {activeTab !== 'prediction' && (dateRange === 'daily' || dateRange === 'today' || dateRange === 'monthly' || dateRange === 'custom') && (
        <Card className="p-3">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            {(dateRange === 'daily' || dateRange === 'today') && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600" /> Daily Report Date:
                </span>
                <button
                  type="button"
                  onClick={() => handleStepDay(-1)}
                  className="rounded-lg border border-ink-200 bg-white p-1 text-ink-500 hover:bg-ink-50"
                  title="Previous Day"
                >
                  <ChevronLeft size={13} />
                </button>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => {
                    setSelectedDay(e.target.value);
                    setDateRange('daily');
                  }}
                  className="rounded-lg border border-ink-200 px-2.5 py-1 text-xs outline-none focus:border-blue-500 bg-white font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleStepDay(1)}
                  className="rounded-lg border border-ink-200 bg-white p-1 text-ink-500 hover:bg-ink-50"
                  title="Next Day"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDay(new Date().toISOString().slice(0, 10));
                    setDateRange('daily');
                  }}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                >
                  Today
                </button>
              </div>
            )}

            {dateRange === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink-700 flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-600" /> Monthly Report Month:
                </span>
                <button
                  type="button"
                  onClick={() => handleStepMonth(-1)}
                  className="rounded-lg border border-ink-200 bg-white p-1 text-ink-500 hover:bg-ink-50"
                  title="Previous Month"
                >
                  <ChevronLeft size={13} />
                </button>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => {
                    setSelectedMonth(e.target.value);
                    setDateRange('monthly');
                  }}
                  className="rounded-lg border border-ink-200 px-2.5 py-1 text-xs outline-none focus:border-blue-500 bg-white font-medium"
                />
                <button
                  type="button"
                  onClick={() => handleStepMonth(1)}
                  className="rounded-lg border border-ink-200 bg-white p-1 text-ink-500 hover:bg-ink-50"
                  title="Next Month"
                >
                  <ChevronRight size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMonth(new Date().toISOString().slice(0, 7));
                    setDateRange('monthly');
                  }}
                  className="rounded px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50"
                >
                  This Month
                </button>
              </div>
            )}

            {dateRange === 'custom' && (
              <>
                <span className="font-bold text-ink-700">Custom Date Range:</span>
                <div className="flex items-center gap-2">
                  <label className="text-ink-500">From:</label>
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="rounded-lg border border-ink-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-ink-500">To:</label>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="rounded-lg border border-ink-200 px-2 py-1 text-xs outline-none focus:border-blue-500"
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      {/* ── Navigation Tabs ── */}
      <div className="border-b border-ink-200 flex gap-2 overflow-x-auto text-sm">
        {[
          { id: 'pl', label: 'Profit & Loss (P&L)', icon: DollarSign },
          { id: 'consumption', label: 'Ingredient Consumption', icon: Layers },
          { id: 'prediction', label: 'Demand & Par-Level Forecasting', icon: TrendingUp },
          { id: 'records', label: 'Imported POS Batches', icon: Calendar },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 font-semibold transition whitespace-nowrap ${
                isActive
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent text-ink-500 hover:text-ink-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 1: PROFIT & LOSS (P&L) STATEMENT
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pl' && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
            <div className="rounded-2xl border border-blue-100 bg-gradient-to-b from-blue-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Total Revenue</p>
              <p className="mt-1 text-xl font-extrabold text-ink-900">
                ETB {fmt(plData?.summary?.totalRevenue)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Gross POS Sales</p>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-gradient-to-b from-orange-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-orange-600">Total COGS</p>
              <p className="mt-1 text-xl font-extrabold text-orange-700">
                ETB {fmt(plData?.summary?.totalCOGS)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Raw Ingredients Cost</p>
            </div>

            <div className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Gross Profit</p>
              <p className={`mt-1 text-xl font-extrabold ${(plData?.summary?.grossProfit || 0) >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                ETB {fmt(plData?.summary?.grossProfit)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Revenue minus COGS</p>
            </div>

            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Gross Margin</p>
              <p className="mt-1 text-xl font-extrabold text-indigo-700">
                {pct(plData?.summary?.profitMargin)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Gross profitability</p>
            </div>

            {/* Row 2: Overheads & Bottom Line */}
            <div className="rounded-2xl border border-rose-100 bg-gradient-to-b from-rose-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-rose-600">Overhead Expenses</p>
              <p className="mt-1 text-xl font-extrabold text-rose-700">
                ETB {fmt(plData?.summary?.totalOverheadExpenses)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Utilities, Rent &amp; Overheads</p>
            </div>

            <div className="rounded-2xl border border-teal-100 bg-gradient-to-b from-teal-50/60 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Net Profit</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  (plData?.summary?.netProfit || 0) >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'
                }`}>
                  {pct(plData?.summary?.netMargin)}
                </span>
              </div>
              <p className={`mt-1 text-xl font-extrabold ${(plData?.summary?.netProfit || 0) >= 0 ? 'text-teal-800' : 'text-red-600'}`}>
                ETB {fmt(plData?.summary?.netProfit)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Gross Profit minus Overheads</p>
            </div>

            <div className="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50/60 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600">Food Cost %</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  (plData?.summary?.foodCostPct || 0) <= 35 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {(plData?.summary?.foodCostPct || 0) <= 35 ? 'Optimal' : 'High'}
                </span>
              </div>
              <p className="mt-1 text-xl font-extrabold text-violet-800">
                {pct(plData?.summary?.foodCostPct)}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Target: 28% – 35%</p>
            </div>

            <div className="rounded-2xl border border-ink-100 bg-gradient-to-b from-ink-50/60 to-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ink-500">Items Sold</p>
              <p className="mt-1 text-xl font-extrabold text-ink-800">
                {plData?.summary?.totalItemsSold || 0}
              </p>
              <p className="mt-1 text-[11px] text-ink-400">{plData?.summary?.recordCount || 0} POS Batches</p>
            </div>
          </div>

          {/* Daily Trend Chart */}
          <Card>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-4">
              <div>
                <h3 className="font-bold text-ink-900 text-base">Revenue vs. Ingredient Cost Trend</h3>
                <p className="text-xs text-ink-400">Daily performance breakdown from imported POS transactions</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-blue-500 inline-block" /> Revenue</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-orange-400 inline-block" /> COGS (Cost)</span>
                <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" /> Gross Profit</span>
              </div>
            </div>

            {plData?.dailyTrend && plData.dailyTrend.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={plData.dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCogs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val) => `ETB ${fmt(val)}`}
                      contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorRev)" name="Revenue" />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorProfit)" name="Gross Profit" />
                    <Area type="monotone" dataKey="cogs" stroke="#f97316" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCogs)" name="COGS" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center rounded-xl bg-ink-50 text-xs text-ink-400">
                No sales records found for this period. Import a POS Excel file to view the trend.
              </div>
            )}
          </Card>

          {/* Menu Engineering & Product P&L Matrix */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-ink-900 text-base">Menu Engineering &amp; Profit Matrix</h3>
                  <span className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700">
                    Kasavana &amp; Smith Standard
                  </span>
                </div>
                <p className="text-xs text-ink-400 mt-1 flex flex-wrap items-center gap-1.5">
                  <span>Itemized profitability, recipe food cost percentage, and popularity analysis ·</span>
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-700 border border-blue-200">
                    <Calendar size={11} />
                    {dateRange === 'daily' || dateRange === 'today'
                      ? `Daily Report: ${selectedDay}`
                      : dateRange === 'monthly'
                      ? `Monthly Report: ${selectedMonth}`
                      : dateRange === '7d'
                      ? 'Last 7 Days'
                      : dateRange === '30d'
                      ? 'Last 30 Days'
                      : dateRange === 'custom'
                      ? `Custom: ${customFrom || 'Start'} → ${customTo || 'Now'}`
                      : 'All Time Summary'}
                  </span>
                </p>
              </div>

              {/* Filters toolbar — Daily & Monthly Date Controls (User requested) */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Period Selector Toggle */}
                <div className="inline-flex rounded-xl bg-ink-100/80 p-0.5 text-xs font-semibold text-ink-700 border border-ink-200/60">
                  <button
                    type="button"
                    onClick={() => setDateRange('daily')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${
                      dateRange === 'daily' || dateRange === 'today'
                        ? 'bg-white text-blue-600 shadow-sm font-bold'
                        : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    Daily
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRange('monthly')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${
                      dateRange === 'monthly'
                        ? 'bg-white text-blue-600 shadow-sm font-bold'
                        : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRange('30d')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${
                      dateRange === '30d'
                        ? 'bg-white text-blue-600 shadow-sm font-bold'
                        : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    30D
                  </button>
                  <button
                    type="button"
                    onClick={() => setDateRange('all')}
                    className={`rounded-lg px-2.5 py-1 text-xs transition ${
                      dateRange === 'all'
                        ? 'bg-white text-blue-600 shadow-sm font-bold'
                        : 'text-ink-600 hover:text-ink-900'
                    }`}
                  >
                    All
                  </button>
                </div>

                {/* Specific Day Picker with Step Buttons */}
                {(dateRange === 'daily' || dateRange === 'today') && (
                  <div className="flex items-center gap-1 bg-white rounded-xl border border-ink-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleStepDay(-1)}
                      className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 transition"
                      title="Previous Day"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <input
                      type="date"
                      value={selectedDay}
                      onChange={(e) => {
                        setSelectedDay(e.target.value);
                        setDateRange('daily');
                      }}
                      className="border-none py-1 px-1.5 text-xs outline-none bg-transparent font-medium text-ink-900 cursor-pointer"
                      title="Choose report day"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepDay(1)}
                      className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 transition"
                      title="Next Day"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Specific Month Picker with Step Buttons */}
                {dateRange === 'monthly' && (
                  <div className="flex items-center gap-1 bg-white rounded-xl border border-ink-200 p-0.5">
                    <button
                      type="button"
                      onClick={() => handleStepMonth(-1)}
                      className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 transition"
                      title="Previous Month"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <input
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setDateRange('monthly');
                      }}
                      className="border-none py-1 px-1.5 text-xs outline-none bg-transparent font-medium text-ink-900 cursor-pointer"
                      title="Choose report month"
                    />
                    <button
                      type="button"
                      onClick={() => handleStepMonth(1)}
                      className="rounded-lg p-1 text-ink-500 hover:bg-ink-100 transition"
                      title="Next Month"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                )}

                {/* Product Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
                  <input
                    type="text"
                    placeholder="Search product..."
                    value={productFilter}
                    onChange={(e) => setProductFilter(e.target.value)}
                    className="rounded-xl border border-ink-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 w-36 sm:w-44 bg-white"
                  />
                </div>

                {/* Category Classification Filter */}
                <select
                  value={matrixFilter}
                  onChange={(e) => setMatrixFilter(e.target.value)}
                  className="rounded-xl border border-ink-200 py-1.5 px-2.5 text-xs outline-none focus:border-blue-500 bg-white"
                >
                  <option value="ALL">All Categories</option>
                  <option value="Star">⭐ Stars (High Vol, High Profit)</option>
                  <option value="Workhorse">🐎 Workhorses (High Vol, Low Profit)</option>
                  <option value="Puzzle">🧩 Puzzles (Low Vol, High Profit)</option>
                  <option value="Dog">🐕 Dogs (Low Vol, Low Profit)</option>
                </select>

                {/* Export Matrix Dropdown */}
                <ExportDropdown
                  data={matrixExportData}
                  fileName={`menu_matrix_${dateRange === 'daily' || dateRange === 'today' ? selectedDay : dateRange === 'monthly' ? selectedMonth : dateRange}`}
                  sheetName="Profit Matrix"
                  pdfTitle={`Menu Engineering & Profit Matrix — ${dateRange === 'daily' || dateRange === 'today' ? `Daily (${selectedDay})` : dateRange === 'monthly' ? `Monthly (${selectedMonth})` : dateRange}`}
                  pdfColumns={[
                    { header: 'Product Name', accessor: 'Product Name' },
                    { header: 'Category', accessor: 'Category' },
                    { header: 'Qty Sold', accessor: 'Qty Sold', align: 'right' },
                    { header: 'Avg Price (ETB)', accessor: 'Avg Selling Price (ETB)', align: 'right' },
                    { header: 'COGS (ETB)', accessor: 'Recipe COGS (ETB)', align: 'right' },
                    { header: 'Revenue (ETB)', accessor: 'Total Revenue (ETB)', align: 'right' },
                    { header: 'Gross Profit (ETB)', accessor: 'Gross Profit (ETB)', align: 'right' },
                    { header: 'Food Cost %', accessor: 'Food Cost %', align: 'right' },
                    { header: 'Margin %', accessor: 'Margin %', align: 'right' },
                  ]}
                />
              </div>
            </div>

            {/* Matrix Legend Badges */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 py-3 border-b border-ink-50 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-50/70 p-2 rounded-lg">
                <span className="text-base">⭐</span>
                <div>
                  <p className="font-bold">Stars</p>
                  <p className="text-[10px] text-emerald-600">High Profit &amp; High Popularity</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-blue-800 bg-blue-50/70 p-2 rounded-lg">
                <span className="text-base">🐎</span>
                <div>
                  <p className="font-bold">Workhorses</p>
                  <p className="text-[10px] text-blue-600">High Volume, Lower Margin</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-amber-800 bg-amber-50/70 p-2 rounded-lg">
                <span className="text-base">🧩</span>
                <div>
                  <p className="font-bold">Puzzles</p>
                  <p className="text-[10px] text-amber-600">High Margin, Needs Promotion</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-red-800 bg-red-50/70 p-2 rounded-lg">
                <span className="text-base">🐕</span>
                <div>
                  <p className="font-bold">Dogs</p>
                  <p className="text-[10px] text-red-600">Low Margin &amp; Low Volume</p>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Qty Sold</th>
                    <th className="py-2.5 px-3 text-right">Avg Selling Price</th>
                    <th className="py-2.5 px-3 text-right">Recipe COGS</th>
                    <th className="py-2.5 px-3 text-right">Total Revenue</th>
                    <th className="py-2.5 px-3 text-right">Gross Profit</th>
                    <th className="py-2.5 px-3 text-right">Food Cost %</th>
                    <th className="py-2.5 px-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {filteredMatrixItems.map((item, idx) => {
                    const badgeMap = {
                      Star: { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: '⭐', label: 'Star' },
                      Workhorse: { bg: 'bg-blue-100 text-blue-800 border-blue-200', icon: '🐎', label: 'Workhorse' },
                      Puzzle: { bg: 'bg-amber-100 text-amber-800 border-amber-200', icon: '🧩', label: 'Puzzle' },
                      Dog: { bg: 'bg-rose-100 text-rose-800 border-rose-200', icon: '🐕', label: 'Dog' },
                    };
                    const b = badgeMap[item.matrixClass] || badgeMap.Dog;
                    return (
                      <tr key={idx} className="hover:bg-ink-50/40 transition">
                        <td className="py-3 px-3 font-bold text-ink-900">{item.productName}</td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${b.bg}`}>
                            <span>{b.icon}</span> {b.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-medium">{item.qty}</td>
                        <td className="py-3 px-3 text-right font-mono">ETB {fmt(item.avgPrice)}</td>
                        <td className="py-3 px-3 text-right font-mono text-orange-600">ETB {fmt(item.unitCogs)}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">ETB {fmt(item.revenue)}</td>
                        <td className={`py-3 px-3 text-right font-mono font-bold ${item.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          ETB {fmt(item.profit)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            item.costRatio <= 35 ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                          }`}>
                            {pct(item.costRatio)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                          {pct(item.margin)}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredMatrixItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-xs text-ink-400">
                        No product breakdown data available.
                      </td>
                    </tr>
                  )}
                </tbody>
                {filteredMatrixItems.length > 0 && (
                  <tfoot className="border-t-2 border-ink-300 bg-ink-100/70 font-bold text-ink-900">
                    <tr>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5 font-black text-ink-900 text-xs">
                          <span>TOTAL SUMMARY</span>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                            {matrixTotals.count} Products
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-ink-400 font-normal">—</td>
                      <td className="py-3.5 px-3 text-right font-black text-blue-700 tabular text-sm">
                        {matrixTotals.totalQty.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-ink-700">
                        ETB {fmt(matrixTotals.avgSellingPrice)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono text-orange-700">
                        ETB {fmt(matrixTotals.totalCOGS)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black text-ink-900 text-sm">
                        ETB {fmt(matrixTotals.totalRevenue)}
                      </td>
                      <td className={`py-3.5 px-3 text-right font-mono font-black text-sm ${
                        matrixTotals.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}>
                        ETB {fmt(matrixTotals.totalProfit)}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                          matrixTotals.overallFoodCostPct <= 35 ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                        }`}>
                          {pct(matrixTotals.overallFoodCostPct)}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono font-black text-indigo-700 text-sm">
                        {pct(matrixTotals.overallMarginPct)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 2: INGREDIENT CONSUMPTION ("ONE PRODUCT HOW MUCH CONSUMED")
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'consumption' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
            <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
              <Layers size={18} /> Recipe Ingredient Consumption Breakdown
            </h3>
            <p className="text-xs text-blue-700 mt-1">
              Analyze how each POS product consumed raw materials from inventory based on recipe yields. Click on any product below to expand its precise recipe and ingredient deduction details.
            </p>
          </div>

          {/* Product-by-Product Recipe Consumption Drilldown */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-ink-900 text-base">One Product → Ingredients Consumed</h3>
                <p className="text-xs text-ink-400">
                  Exact recipe deduction per unit and aggregate consumption for each sold item
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
                <input
                  type="text"
                  placeholder="Filter product..."
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="rounded-xl border border-ink-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 w-52"
                />
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {consumptionData?.productConsumption
                ?.filter((p) => !productFilter || p.productName.toLowerCase().includes(productFilter.toLowerCase()))
                .map((prod, idx) => {
                  const isExpanded = expandedProduct === prod.productName;
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-ink-100 transition overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedProduct(isExpanded ? null : prod.productName)}
                        className={`w-full flex items-center justify-between p-3.5 text-left transition ${
                          isExpanded ? 'bg-ink-50/80 font-bold' : 'hover:bg-ink-50/40'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-ink-900">{prod.productName}</p>
                            <p className="text-[11px] text-ink-400">
                              {prod.qtySold} units sold · Revenue: ETB {fmt(prod.revenue)} · Margin: {pct(prod.margin)}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right hidden sm:block">
                            <p className="text-[11px] text-ink-400">Total Ingredient Cost</p>
                            <p className="font-mono font-bold text-orange-600">ETB {fmt(prod.totalIngredientCost)}</p>
                          </div>
                          {isExpanded ? <ChevronDown size={18} className="text-ink-400" /> : <ChevronRight size={18} className="text-ink-400" />}
                        </div>
                      </button>

                      {/* Expanded Recipe Breakdown */}
                      {isExpanded && (
                        <div className="border-t border-ink-100 bg-white p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-xs font-bold text-ink-700">
                              Recipe Consumption for "{prod.productName}" ({prod.ingredients.length} ingredients)
                            </p>
                            <span className="text-[11px] text-ink-400">
                              Formula: 1 unit uses × units sold = Total stock deducted
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead>
                                <tr className="border-b border-ink-100 bg-ink-50/50 text-left font-semibold text-ink-600">
                                  <th className="py-2 px-3">Ingredient (Raw Material)</th>
                                  <th className="py-2 px-3 text-right">Per 1 Unit Uses</th>
                                  <th className="py-2 px-3 text-right">Total Deducted (All Sales)</th>
                                  <th className="py-2 px-3 text-right">Raw Material Unit Cost</th>
                                  <th className="py-2 px-3 text-right">Total Ingredient Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-ink-50 text-ink-700">
                                {prod.ingredients.map((ing, iIdx) => (
                                  <tr key={iIdx} className="hover:bg-blue-50/20">
                                    <td className="py-2 px-3 font-semibold text-ink-900">{ing.materialName}</td>
                                    <td className="py-2 px-3 text-right font-mono text-ink-600">
                                      {ing.perUnitQuantity.toFixed(3)} {ing.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-blue-700">
                                      {ing.totalUsed.toFixed(2)} {ing.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono">
                                      ETB {fmt(ing.unitCost)} / {ing.unit}
                                    </td>
                                    <td className="py-2 px-3 text-right font-mono font-bold text-orange-600">
                                      ETB {fmt(ing.totalCost)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              {(!consumptionData?.productConsumption || consumptionData.productConsumption.length === 0) && (
                <div className="py-8 text-center text-xs text-ink-400">
                  No recipe consumption records available.
                </div>
              )}
            </div>
          </Card>

          {/* Aggregate Raw Materials Depletion Leaderboard */}
          <Card>
            <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-ink-900 text-base">Total Stock Depletion Leaderboard</h3>
                <p className="text-xs text-ink-400">
                  Highest consumed raw materials across all recipes during this period
                </p>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-2.5 text-ink-400" />
                <input
                  type="text"
                  placeholder="Search ingredient..."
                  value={ingredientFilter}
                  onChange={(e) => setIngredientFilter(e.target.value)}
                  className="rounded-xl border border-ink-200 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-blue-500 w-48"
                />
              </div>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Raw Material</th>
                    <th className="py-2.5 px-3 text-right">Total Quantity Consumed</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total Cost of Consumption</th>
                    <th className="py-2.5 px-3 text-right">Current Stock Remaining</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {consumptionData?.ingredients
                    ?.filter((ing) => !ingredientFilter || ing.materialName.toLowerCase().includes(ingredientFilter.toLowerCase()))
                    .map((ing, idx) => (
                      <tr key={idx} className="hover:bg-ink-50/40">
                        <td className="py-2.5 px-3 text-ink-400 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-ink-900">{ing.materialName}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-blue-700">
                          {Number(ing.totalQty).toFixed(2)} {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-ink-600">
                          ETB {fmt(ing.unitCost)} / {ing.unit}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-orange-600">
                          ETB {fmt(ing.totalCost)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-medium">
                          {ing.currentStock !== null ? `${ing.currentStock} ${ing.unit}` : '—'}
                        </td>
                      </tr>
                    ))}
                  {(!consumptionData?.ingredients || consumptionData.ingredients.length === 0) && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs text-ink-400">
                        No raw material depletion data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 3: AI & PAR-LEVEL DEMAND PREDICTION
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'prediction' && (
        <div className="space-y-6">
          {/* Prediction Highlights */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-indigo-100 bg-gradient-to-b from-indigo-50/60 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-indigo-700">
                <TrendingUp size={18} />
                <p className="text-xs font-bold uppercase tracking-wider">Projected Daily Sales</p>
              </div>
              <p className="mt-2 text-2xl font-black text-ink-900">
                ETB {fmt(predictionData?.summary?.predictedDailyRevenue)}
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Expected daily gross revenue based on 30-day velocity
              </p>
            </div>

            <div className="rounded-2xl border border-red-100 bg-gradient-to-b from-red-50/60 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle size={18} />
                <p className="text-xs font-bold uppercase tracking-wider">Critical Stockout Risk</p>
              </div>
              <p className="mt-2 text-2xl font-black text-red-700">
                {predictionData?.summary?.criticalItemsCount || 0} Materials
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Will run out in less than 3 days at current sales pace!
              </p>
            </div>

            <div className="rounded-2xl border border-amber-100 bg-gradient-to-b from-amber-50/60 to-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <Package size={18} />
                <p className="text-xs font-bold uppercase tracking-wider">Reorder Needed Soon</p>
              </div>
              <p className="mt-2 text-2xl font-black text-amber-700">
                {predictionData?.summary?.warningItemsCount || 0} Materials
              </p>
              <p className="mt-1 text-xs text-ink-400">
                Stock run-out projected within 3 to 7 days
              </p>
            </div>
          </div>

          {/* 7-Day Future Projections */}
          <Card>
            <h3 className="font-bold text-ink-900 text-base mb-1">7-Day Sales &amp; Profit Forecast</h3>
            <p className="text-xs text-ink-400 mb-4">
              Projected daily revenue, COGS, and gross profit using weighted 7-day moving averages
            </p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-7">
              {predictionData?.predictions?.map((day, idx) => (
                <div key={idx} className="rounded-xl border border-ink-100 bg-ink-50/50 p-3 text-center">
                  <p className="text-[11px] font-bold text-blue-600">{day.dayName}</p>
                  <p className="text-[10px] text-ink-400">{day.date.slice(5)}</p>
                  <div className="mt-2 border-t border-ink-100 pt-2">
                    <p className="text-[11px] font-mono font-bold text-ink-900">
                      ETB {fmt(day.predictedRevenue)}
                    </p>
                    <p className="text-[10px] font-mono text-emerald-600 font-semibold mt-0.5">
                      +ETB {fmt(day.predictedProfit)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Stock Coverage & Automated Reorder Suggestions */}
          <Card>
            <div className="border-b border-ink-100 pb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-ink-900 text-base">
                  Inventory Run-Out Forecast &amp; Suggested Par Reorders
                </h3>
                <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  Par Level: 14 Days
                </span>
              </div>
              <p className="text-xs text-ink-400 mt-1">
                Calculates days of stock remaining for each ingredient based on actual sales burn rate and recommends exact reorder quantities
              </p>
            </div>

            <div className="overflow-x-auto mt-2">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                    <th className="py-2.5 px-3">Ingredient</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-right">Current Stock</th>
                    <th className="py-2.5 px-3 text-right">Daily Burn Rate</th>
                    <th className="py-2.5 px-3 text-center">Days Remaining</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Recommended Reorder (14d)</th>
                    <th className="py-2.5 px-3 text-right">Est. Reorder Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-50 text-ink-700">
                  {predictionData?.stockCoverage?.map((item, idx) => {
                    const statusBadge = {
                      critical: { bg: 'bg-red-100 text-red-800 border-red-200', label: 'CRITICAL (<3d)' },
                      warning:  { bg: 'bg-amber-100 text-amber-800 border-amber-200', label: 'REORDER (3-7d)' },
                      ok:       { bg: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'HEALTHY (>7d)' },
                    }[item.status];

                    return (
                      <tr key={idx} className="hover:bg-ink-50/40">
                        <td className="py-3 px-3 font-bold text-ink-900">{item.materialName}</td>
                        <td className="py-3 px-3 text-ink-500">{item.category}</td>
                        <td className="py-3 px-3 text-right font-mono font-semibold">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-ink-600">
                          {item.avgDailyUsage} {item.unit} / day
                        </td>
                        <td className="py-3 px-3 text-center font-mono font-bold">
                          <span className={item.daysNum < 3 ? 'text-red-600' : item.daysNum < 7 ? 'text-amber-600' : 'text-emerald-600'}>
                            {item.daysRemaining} days
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadge.bg}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-blue-700">
                          {item.reorderSuggested > 0 ? `${item.reorderSuggested} ${item.unit}` : 'None needed'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold text-ink-900">
                          {item.estimatedCost > 0 ? `ETB ${fmt(item.estimatedCost)}` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                  {(!predictionData?.stockCoverage || predictionData.stockCoverage.length === 0) && (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-xs text-ink-400">
                        No active stock coverage predictions available yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TAB 4: IMPORTED POS BATCHES (AUDIT TRAIL)
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <Card>
          <div className="flex flex-col gap-3 border-b border-ink-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-bold text-ink-900 text-base">Imported POS Batches History</h3>
              <p className="text-xs text-ink-400">
                Log of all uploaded sales files, total revenues, ingredient deductions, and P&amp;L records
              </p>
            </div>
            <a
              href="/sales-import"
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
            >
              + Import New POS Batch
            </a>
          </div>

          <div className="overflow-x-auto mt-2">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-left font-bold text-ink-600">
                  <th className="py-2.5 px-3">Sale Date</th>
                  <th className="py-2.5 px-3">Reference / File</th>
                  <th className="py-2.5 px-3 text-right">Items Sold</th>
                  <th className="py-2.5 px-3 text-right">Total Revenue</th>
                  <th className="py-2.5 px-3 text-right">Total COGS</th>
                  <th className="py-2.5 px-3 text-right">Gross Profit</th>
                  <th className="py-2.5 px-3 text-right">Margin %</th>
                  <th className="py-2.5 px-3">Imported By</th>
                  <th className="py-2.5 px-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 text-ink-700">
                {recordsData.map((rec) => (
                  <tr key={rec._id} className="hover:bg-ink-50/40">
                    <td className="py-3 px-3 font-semibold text-ink-900">
                      {new Date(rec.saleDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-3">
                      <p className="font-semibold text-ink-800">{rec.reference || 'POS Batch'}</p>
                      <p className="text-[10px] text-ink-400">{rec.notes}</p>
                    </td>
                    <td className="py-3 px-3 text-right font-medium">{rec.lines?.length || 0} lines</td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-blue-700">
                      ETB {fmt(rec.totalRevenue)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-orange-600">
                      ETB {fmt(rec.totalCOGS)}
                    </td>
                    <td className={`py-3 px-3 text-right font-mono font-bold ${rec.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      ETB {fmt(rec.grossProfit)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-semibold text-indigo-700">
                      {pct(rec.profitMargin)}
                    </td>
                    <td className="py-3 px-3 text-ink-500">
                      {rec.importedBy?.name || 'System'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRecord(rec);
                            setBatchSearch('');
                            setExpandedLineIndex(null);
                          }}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-100 transition cursor-pointer"
                          title="View Batch Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(rec._id)}
                          disabled={deletingRecordId === rec._id}
                          className="rounded-lg p-1.5 text-red-500 hover:bg-red-100 transition cursor-pointer disabled:opacity-40"
                          title="Delete Batch"
                        >
                          {deletingRecordId === rec._id ? (
                            <RefreshCw size={15} className="animate-spin text-red-500" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {recordsData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-xs text-ink-400">
                      No POS sales batches have been imported yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Batch Details Modal (Fully functional View & Actions) ── */}
      {selectedRecord && (
        <Modal
          open={Boolean(selectedRecord)}
          title={`Batch Details: ${selectedRecord.reference || 'POS Import'}`}
          onClose={() => {
            setSelectedRecord(null);
            setBatchSearch('');
            setExpandedLineIndex(null);
          }}
          width="max-w-4xl"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Top Stats Cards */}
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4 bg-ink-50/80 p-3.5 rounded-xl border border-ink-100">
              <div>
                <p className="text-ink-400 font-medium">Sale Date:</p>
                <p className="font-bold text-ink-900 mt-0.5">{new Date(selectedRecord.saleDate).toLocaleDateString()}</p>
                <p className="text-[10px] text-ink-500 mt-0.5">By {selectedRecord.importedBy?.name || 'System'}</p>
              </div>
              <div>
                <p className="text-ink-400 font-medium">Total Revenue:</p>
                <p className="font-bold text-blue-700 text-sm mt-0.5">ETB {fmt(selectedRecord.totalRevenue)}</p>
                <p className="text-[10px] text-blue-600 font-medium mt-0.5">{selectedRecord.lines?.length || 0} product lines</p>
              </div>
              <div>
                <p className="text-ink-400 font-medium">Total Recipe COGS:</p>
                <p className="font-bold text-orange-600 text-sm mt-0.5">ETB {fmt(selectedRecord.totalCOGS)}</p>
                <p className="text-[10px] text-orange-700 mt-0.5">Deducted raw stock</p>
              </div>
              <div>
                <p className="text-ink-400 font-medium">Gross Profit:</p>
                <p className={`font-bold text-sm mt-0.5 ${selectedRecord.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                  ETB {fmt(selectedRecord.grossProfit)}
                </p>
                <p className="text-[10px] font-semibold text-emerald-700 mt-0.5">{pct(selectedRecord.profitMargin)} Margin</p>
              </div>
            </div>

            {/* Action & Filter Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder={`Search among ${selectedRecord.lines?.length || 0} items in this batch…`}
                  className="w-full rounded-xl border border-ink-200 bg-white pl-8 pr-3 py-1.5 text-xs outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedRecord.lines?.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportBatchLines}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-2xs"
                  >
                    <Download size={13} /> Export Excel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDeleteRecord(selectedRecord._id)}
                  disabled={deletingRecordId === selectedRecord._id}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition shadow-2xs disabled:opacity-50"
                >
                  {deletingRecordId === selectedRecord._id ? (
                    <RefreshCw size={13} className="animate-spin text-red-600" />
                  ) : (
                    <Trash2 size={13} />
                  )}
                  Delete Batch
                </button>
              </div>
            </div>

            {/* Items Table */}
            {selectedRecord.lines?.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-ink-100">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/70 font-semibold text-ink-500 text-[11px]">
                      <th className="py-2 px-2.5 text-center w-8">#</th>
                      <th className="py-2 px-2.5 text-left">Code</th>
                      <th className="py-2 px-2.5 text-left">Product Name</th>
                      <th className="py-2 px-2.5 text-right">Qty</th>
                      <th className="py-2 px-2.5 text-right">Avg Price</th>
                      <th className="py-2 px-2.5 text-right">Revenue</th>
                      <th className="py-2 px-2.5 text-right">COGS</th>
                      <th className="py-2 px-2.5 text-right">Profit</th>
                      <th className="py-2 px-2.5 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-50 text-ink-700">
                    {filteredBatchLines.map((line, idx) => {
                      const isExpanded = expandedLineIndex === idx;
                      const hasIngredients = line.ingredientsUsed?.length > 0;
                      return (
                        <React.Fragment key={idx}>
                          <tr
                            onClick={() => hasIngredients && setExpandedLineIndex(isExpanded ? null : idx)}
                            className={`hover:bg-ink-50/50 ${hasIngredients ? 'cursor-pointer' : ''}`}
                          >
                            <td className="py-2.5 px-2.5 text-center text-[10px] text-ink-400">{idx + 1}</td>
                            <td className="py-2.5 px-2.5 font-mono text-[11px] text-ink-500">{line.productCode || '—'}</td>
                            <td className="py-2.5 px-2.5 font-bold text-ink-900">
                              <div className="flex items-center gap-1.5">
                                <span>{line.productName}</span>
                                {hasIngredients && (
                                  <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.2 rounded font-normal">
                                    {isExpanded ? '▲ hide recipe' : '▼ recipe'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-semibold">{line.quantitySold}</td>
                            <td className="py-2.5 px-2.5 text-right text-ink-600 font-mono">ETB {fmt(line.sellingPrice)}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono font-bold text-blue-700">ETB {fmt(line.revenue)}</td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-orange-600">ETB {fmt(line.cogs)}</td>
                            <td className={`py-2.5 px-2.5 text-right font-mono font-bold ${line.grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                              ETB {fmt(line.grossProfit)}
                            </td>
                            <td className="py-2.5 px-2.5 text-center">
                              {line.matchStatus === 'recipe_deducted' ? (
                                <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                  Recipe Deducted
                                </span>
                              ) : line.matchStatus === 'direct_material' ? (
                                <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                  Direct Stock
                                </span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Unmatched
                                </span>
                              )}
                            </td>
                          </tr>

                          {/* Expandable ingredient breakdown */}
                          {isExpanded && hasIngredients && (
                            <tr className="bg-slate-50/80">
                              <td colSpan={9} className="p-3 pl-8">
                                <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs">
                                  <p className="font-bold text-ink-700 text-[11px] mb-1.5">
                                    🥗 Ingredients Deducted for {line.productName} (×{line.quantitySold}):
                                  </p>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                    {line.ingredientsUsed.map((ing, iIdx) => (
                                      <div key={iIdx} className="flex items-center justify-between p-1.5 rounded bg-slate-50 border border-slate-100">
                                        <span>• {ing.materialName}: <strong>{ing.quantityUsed} {ing.unit}</strong></span>
                                        <span className="font-mono text-orange-700">ETB {fmt(ing.totalCost)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                    {filteredBatchLines.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-xs text-ink-400">
                          No items match your search &ldquo;{batchSearch}&rdquo;.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center bg-ink-50/60 rounded-xl border border-ink-100">
                <AlertTriangle size={24} className="mx-auto text-amber-500 mb-2" />
                <p className="font-bold text-sm text-ink-800">0 Lines Recorded in This Batch</p>
                <p className="text-xs text-ink-500 mt-1 max-w-md mx-auto">
                  This batch contains 0 product lines (for example, from an empty or duplicate import). You can safely click &ldquo;Delete Batch&rdquo; to clean it up.
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteRecord(selectedRecord._id)}
                  disabled={deletingRecordId === selectedRecord._id}
                  className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700 transition shadow-xs"
                >
                  <Trash2 size={13} /> Delete Empty Batch
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
