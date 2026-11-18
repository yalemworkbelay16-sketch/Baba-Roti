import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ShoppingBag,
  Sparkles,
  PieChart as PieIcon,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  Receipt,
  Calendar,
  CalendarRange,
} from 'lucide-react';
import api from '../../api/axios';

const formatETB = (n) =>
  `ETB ${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatCompactETB = (n) => {
  const num = Number(n || 0);
  if (num >= 1_000_000) return `ETB ${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `ETB ${(num / 1_000).toFixed(1)}k`;
  return `ETB ${num.toFixed(0)}`;
};

// Vibrant palette matching the reference charts in screenshot
const DONUT_COLORS = [
  '#4a7bb0', // Slate Blue (break fast)
  '#c0392b', // Crimson Red (Hot Drink)
  '#8bb352', // Olive Green (Soft drink)
  '#16a085', // Teal (Juice)
  '#8e44ad', // Purple (Cold drink)
  '#e67e22', // Amber Orange (Burger & sandwich)
  '#2980b9', // Ocean Blue (Mendi)
  '#d35400', // Rust (Pizza)
  '#27ae60', // Emerald (Pasta)
  '#f39c12', // Yellow (Cakes)
  '#7f8c8d', // Gray (Other)
];

// Custom Tooltip for Child Category by Amount
const ChildAmountTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="rounded-xl border border-ink-100 bg-white/98 p-3 shadow-xl backdrop-blur-md text-xs">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.payload.fill || item.color }} />
          <span className="font-bold text-ink-900">{item.name}</span>
        </div>
        <p className="text-ink-600">
          Amount: <strong className="text-ink-900">{formatETB(item.value)}</strong>
        </p>
        {item.payload.quantity !== undefined && (
          <p className="text-ink-400 mt-0.5">{item.payload.quantity} units sold</p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Child Category by Quantity
const ChildQtyTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const item = payload[0];
    return (
      <div className="rounded-xl border border-ink-100 bg-white/98 p-3 shadow-xl backdrop-blur-md text-xs">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.payload.fill || item.color }} />
          <span className="font-bold text-ink-900">{item.name}</span>
        </div>
        <p className="text-ink-600">
          Quantity: <strong className="text-ink-900">{item.value} units</strong>
        </p>
        {item.payload.amount !== undefined && (
          <p className="text-ink-400 mt-0.5">Total: {formatETB(item.payload.amount)}</p>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for Profit vs Cost
const ProfitChartTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const rev = payload.find(p => p.dataKey === 'revenue')?.value || 0;
    const cogs = payload.find(p => p.dataKey === 'recipeCost')?.value || 0;
    const profit = payload.find(p => p.dataKey === 'grossProfit')?.value || (rev - cogs);
    const margin = rev > 0 ? Math.round((profit / rev) * 100) : 0;

    return (
      <div className="rounded-2xl border border-ink-100 bg-white/98 p-4 shadow-xl backdrop-blur-md text-xs min-w-[210px]">
        <p className="font-bold text-ink-900 text-sm mb-2 pb-1.5 border-b border-ink-100">
          {label} Category
        </p>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-ink-600">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              Sales Revenue:
            </span>
            <span className="font-bold text-blue-900 tabular-nums">{formatETB(rev)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-ink-600">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Recipe Cost (COGS):
            </span>
            <span className="font-bold text-amber-900 tabular-nums">{formatETB(cogs)}</span>
          </div>
          <div className="flex items-center justify-between pt-1.5 border-t border-ink-100">
            <span className="flex items-center gap-1.5 text-emerald-700 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
              Gross Profit:
            </span>
            <span className="font-bold text-emerald-800 tabular-nums">{formatETB(profit)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-ink-500">
            <span>Profit Margin:</span>
            <span className="font-black text-emerald-700 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200">
              {margin}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export default function SalesAnalyticsSection({ salesAnalytics }) {
  const [period, setPeriod] = useState('daily'); // 'daily' (default) | 'latest' | 'week' | 'month' | 'all' | 'custom'
  const [customRange, setCustomRange] = useState({
    startDate: new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [customData, setCustomData] = useState(null);
  const [loadingCustom, setLoadingCustom] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Extract selected period data or fallback
  const activeData = useMemo(() => {
    if (period === 'custom' && customData) return customData;
    if (!salesAnalytics) return null;
    return salesAnalytics[period] || salesAnalytics.daily || salesAnalytics.latest || salesAnalytics.week || null;
  }, [salesAnalytics, period, customData]);

  const handleApplyCustomRange = async (overrideDates) => {
    const sDate = overrideDates?.startDate || customRange.startDate;
    const eDate = overrideDates?.endDate || customRange.endDate;
    if (!sDate || !eDate) return;

    try {
      setLoadingCustom(true);
      const res = await api.get('/dashboard/sales-analytics', {
        params: { startDate: sDate, endDate: eDate },
      });
      if (res.data?.custom) {
        setCustomData(res.data.custom);
        setPeriod('custom');
      } else if (res.data) {
        setCustomData(res.data.custom || res.data);
        setPeriod('custom');
      }
    } catch (err) {
      console.error('Failed to load custom date range analytics:', err);
    } finally {
      setLoadingCustom(false);
    }
  };

  const applyPreset = (presetKey) => {
    const now = new Date();
    let s = new Date();
    let e = new Date();

    if (presetKey === 'yesterday') {
      s.setDate(now.getDate() - 1);
      e.setDate(now.getDate() - 1);
    } else if (presetKey === 'last14') {
      s.setDate(now.getDate() - 13);
    } else if (presetKey === 'last30') {
      s.setDate(now.getDate() - 29);
    } else if (presetKey === 'lastMonth') {
      s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      e = new Date(now.getFullYear(), now.getMonth(), 0);
    }

    const sStr = s.toISOString().split('T')[0];
    const eStr = e.toISOString().split('T')[0];
    setCustomRange({ startDate: sStr, endDate: eStr });
    handleApplyCustomRange({ startDate: sStr, endDate: eStr });
  };

  const formattedCustomLabel = useMemo(() => {
    if (!customRange.startDate || !customRange.endDate) return 'Date Range';
    const s = new Date(customRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const e = new Date(customRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${s} – ${e}`;
  }, [customRange]);

  const handleTabClick = (tabId) => {
    if (tabId === 'custom') {
      setShowDatePicker((prev) => !prev);
      if (!customData) {
        handleApplyCustomRange();
      } else {
        setPeriod('custom');
      }
    } else {
      setPeriod(tabId);
    }
  };

  if (!activeData) return null;

  const {
    totalRevenue = 0,
    totalQty = 0,
    totalRecipeCost = 0,
    grossProfit = 0,
    grossMargin = 0,
    parentList = [],
    childByAmt = [],
    childByQty = [],
    profitByParent = [],
    latestDate,
    dailyDate,
    isDailyToday,
    latestRef,
  } = activeData;

  const formattedDate = latestDate
    ? new Date(latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recent';

  const dailyDateObj = salesAnalytics?.daily?.dailyDate || salesAnalytics?.daily?.latestDate;
  const dailyFormatted = dailyDateObj
    ? new Date(dailyDateObj).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : formattedDate;

  const batchFormatted = salesAnalytics?.latest?.latestDate
    ? new Date(salesAnalytics.latest.latestDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : formattedDate;

  const filterTabs = [
    { id: 'daily',  label: `Daily (${dailyFormatted})` },
    { id: 'latest', label: `Latest Batch (${batchFormatted})` },
    { id: 'week',   label: 'Last 7 Days' },
    { id: 'month',  label: 'This Month' },
    { id: 'all',    label: 'All Time' },
    { id: 'custom', label: period === 'custom' && customData ? `Range: ${formattedCustomLabel}` : 'Date Range' },
  ];

  return (
    <div className="space-y-6 rounded-3xl border border-blue-200/80 bg-gradient-to-b from-white via-blue-50/20 to-white p-5 sm:p-7 shadow-sm">
      {/* ── Top Section Header & Period Filters ── */}
      <div className="flex flex-col gap-4 border-b border-ink-100 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 p-2 text-white shadow-sm">
                <Receipt size={18} />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-ink-900 tracking-tight">
                Sales, Category Breakdown &amp; Profit Report
              </h2>
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                Live Aggregated
              </span>
            </div>
            <p className="text-xs sm:text-sm text-ink-500 mt-1">
              Real-time sales revenue, recipe ingredient cost &amp; gross margin from <strong>Sales Import</strong>, <strong>POS Orders</strong> &amp; <strong>Digital Menu</strong>
            </p>
          </div>

          {/* Period Selector Tabs — Daily by default + Date Range */}
          <div className="flex items-center gap-1.5 rounded-2xl border border-ink-200 bg-white p-1 shadow-2xs self-start lg:self-auto flex-wrap">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  period === tab.id
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
                }`}
              >
                {tab.id === 'custom' && (
                  <Calendar size={13} className={period === 'custom' ? 'text-white' : 'text-blue-600'} />
                )}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Interactive Date Range Picker Drawer ── */}
        {showDatePicker && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-50/90 via-white to-indigo-50/90 p-3.5 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-blue-950 flex items-center gap-1.5">
                <CalendarRange size={15} className="text-blue-700" />
                Select Range:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-500 font-medium">From</span>
                <input
                  type="date"
                  value={customRange.startDate}
                  onChange={(e) => setCustomRange((p) => ({ ...p, startDate: e.target.value }))}
                  className="rounded-xl border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-800 outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-ink-500 font-medium">To</span>
                <input
                  type="date"
                  value={customRange.endDate}
                  onChange={(e) => setCustomRange((p) => ({ ...p, endDate: e.target.value }))}
                  className="rounded-xl border border-blue-200 bg-white px-2.5 py-1 text-xs font-semibold text-ink-800 outline-none focus:border-blue-500 shadow-2xs"
                />
              </div>
              <button
                type="button"
                onClick={() => handleApplyCustomRange()}
                disabled={loadingCustom}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
              >
                {loadingCustom ? (
                  <span>Filtering...</span>
                ) : (
                  <>
                    <CheckCircle2 size={13} />
                    <span>Apply Range</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-ink-400 font-medium mr-1 text-[11px]">Presets:</span>
              {[
                { label: 'Yesterday', key: 'yesterday' },
                { label: 'Last 14D',  key: 'last14' },
                { label: 'Last 30D',  key: 'last30' },
                { label: 'Last Month', key: 'lastMonth' },
              ].map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  disabled={loadingCustom}
                  className="rounded-lg border border-blue-200/80 bg-white px-2 py-0.5 text-[11px] font-semibold text-blue-900 hover:border-blue-400 hover:bg-blue-50 transition cursor-pointer shadow-2xs"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── KPI Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Total Revenue */}
        <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50/80 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider">Total Sales</p>
            <span className="rounded-xl bg-blue-600 p-1.5 text-white shadow-xs">
              <DollarSign size={15} />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-blue-950 tabular-nums">
            {formatETB(totalRevenue)}
          </p>
          <p className="mt-1 text-[11px] text-blue-700/80 font-medium">Gross revenue with VAT</p>
        </div>

        {/* Total Quantity */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">Quantity Sold</p>
            <span className="rounded-xl bg-indigo-600 p-1.5 text-white shadow-xs">
              <ShoppingBag size={15} />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-indigo-950 tabular-nums">
            {totalQty.toLocaleString()} <span className="text-xs font-normal text-indigo-700">units</span>
          </p>
          <p className="mt-1 text-[11px] text-indigo-700/80 font-medium">Menu items ordered</p>
        </div>

        {/* Recipe Cost (COGS) */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50/80 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-amber-900 uppercase tracking-wider">Recipe Cost (COGS)</p>
            <span className="rounded-xl bg-amber-500 p-1.5 text-white shadow-xs">
              <Package size={15} />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-amber-950 tabular-nums">
            {formatETB(totalRecipeCost)}
          </p>
          <p className="mt-1 text-[11px] text-amber-700/80 font-medium">Raw material ingredient cost</p>
        </div>

        {/* Gross Profit & Margin */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-emerald-900 uppercase tracking-wider">Gross Profit</p>
            <span className="rounded-xl bg-emerald-600 p-1.5 text-white shadow-xs">
              <TrendingUp size={15} />
            </span>
          </div>
          <p className="mt-2 text-xl sm:text-2xl font-black text-emerald-950 tabular-nums">
            {formatETB(grossProfit)}
          </p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-emerald-700/80 font-medium">Profit margin:</span>
            <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.2 text-[10px] font-black text-emerald-800">
              {grossMargin}%
            </span>
          </div>
        </div>
      </div>

      {/* ── Visual Section 1: Child Category Donut Charts (Matching User Screenshot 1) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Child Category By Amount */}
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-blue-100 p-1.5 text-blue-700">
                  <PieIcon size={14} />
                </span>
                <h3 className="font-extrabold text-base text-ink-900">Child Category By Amt</h3>
              </div>
              <span className="text-xs font-semibold text-ink-400">Amount (ETB)</span>
            </div>

            <div className="relative h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={childByAmt}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    strokeWidth={1}
                    stroke="#fff"
                  >
                    {childByAmt.map((entry, index) => (
                      <Cell
                        key={`amt-${index}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChildAmountTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Donut Center */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Total Amt</span>
                <span className="text-sm font-black text-ink-900 leading-tight">
                  {formatCompactETB(totalRevenue)}
                </span>
              </div>
            </div>

            {/* Category breakdown pill list */}
            <div className="mt-4 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {childByAmt.slice(0, 10).map((cat, idx) => {
                const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                const pct = totalRevenue > 0 ? Math.round((cat.value / totalRevenue) * 100) : 0;
                return (
                  <div key={cat.name} className="flex items-center justify-between rounded-lg bg-ink-50/60 px-2.5 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 truncate max-w-[110px]" title={cat.name}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-ink-800 truncate">{cat.name}:</span>
                    </span>
                    <span className="font-bold text-ink-900 text-[11px] tabular-nums shrink-0">
                      ({Number(cat.value).toLocaleString('en-US', { maximumFractionDigits: 0 })})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Child Category By Quantity */}
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-indigo-100 p-1.5 text-indigo-700">
                  <PieIcon size={14} />
                </span>
                <h3 className="font-extrabold text-base text-ink-900">Child Category By Qty</h3>
              </div>
              <span className="text-xs font-semibold text-ink-400">Item Count</span>
            </div>

            <div className="relative h-64 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={childByQty}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={3}
                    strokeWidth={1}
                    stroke="#fff"
                  >
                    {childByQty.map((entry, index) => (
                      <Cell
                        key={`qty-${index}`}
                        fill={DONUT_COLORS[index % DONUT_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<ChildQtyTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Donut Center */}
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Total Qty</span>
                <span className="text-base font-black text-ink-900 leading-tight">
                  {totalQty.toLocaleString()}
                </span>
                <span className="text-[9px] text-ink-400">units</span>
              </div>
            </div>

            {/* Category breakdown pill list */}
            <div className="mt-4 grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {childByQty.slice(0, 10).map((cat, idx) => {
                const color = DONUT_COLORS[idx % DONUT_COLORS.length];
                return (
                  <div key={cat.name} className="flex items-center justify-between rounded-lg bg-ink-50/60 px-2.5 py-1.5 text-xs">
                    <span className="flex items-center gap-1.5 truncate max-w-[110px]" title={cat.name}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span className="font-semibold text-ink-800 truncate">{cat.name}:</span>
                    </span>
                    <span className="font-bold text-ink-900 text-[11px] tabular-nums shrink-0">
                      ({cat.value})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Visual Section 2: Parent Category Sales Table (Matching User Screenshot 2) ── */}
      <div className="overflow-hidden rounded-2xl border border-blue-200/80 bg-white shadow-soft">
        <div className="p-4 sm:p-5 border-b border-blue-100 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-blue-900 p-1.5 text-white">
              <Layers size={14} />
            </span>
            <h3 className="font-extrabold text-base text-ink-900">Parent Category Sales</h3>
          </div>
          <span className="text-xs text-ink-500 font-medium">
            Aggregated by parent department (Food, Beverage, Juices, Cakes)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
                <th className="px-5 py-3 text-left text-xs font-bold uppercase tracking-wider text-blue-100">
                  Description
                </th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-blue-100">
                  Quantity
                </th>
                <th className="px-5 py-3 text-right text-xs font-bold uppercase tracking-wider text-blue-100">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {parentList.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-5 py-8 text-center text-ink-400">
                    No parent category sales recorded in this period.
                  </td>
                </tr>
              ) : (
                parentList.map((row) => (
                  <tr
                    key={row.description}
                    className="border-b border-ink-100/70 hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="px-5 py-3.5 font-bold text-ink-900">
                      {row.description}
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold text-ink-700 tabular-nums">
                      {Number(row.quantity).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-extrabold text-ink-900 tabular-nums">
                      {Number(row.total).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Grand Total Footer (Exact Match to User Screenshot 2) */}
            <tfoot>
              <tr className="bg-blue-50/90 border-t-2 border-blue-200">
                <td className="px-5 py-3.5 font-black text-ink-900 text-sm">
                  Grand Total (With VAT)
                </td>
                <td className="px-5 py-3.5 text-right font-black text-ink-900 text-sm tabular-nums">
                  {Number(totalQty).toFixed(1)}
                </td>
                <td className="px-5 py-3.5 text-right font-black text-blue-900 text-sm tabular-nums">
                  {Number(totalRevenue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Visual Section 3: Clear Gross Profit & Recipe Cost Graph (User's Second Request) ── */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 p-2 text-white shadow-sm">
              <BarChart3 size={16} />
            </span>
            <div>
              <h3 className="font-black text-lg text-ink-900 tracking-tight">
                Gross Profit &amp; Recipe Cost Analysis
              </h3>
              <p className="text-xs text-ink-400">
                Simple visual comparison of Sales Revenue vs Ingredient Cost vs Net Gross Profit
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-blue-800">
              <span className="h-3 w-3 rounded-md bg-blue-600" /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-amber-800">
              <span className="h-3 w-3 rounded-md bg-amber-500" /> Recipe Cost (COGS)
            </span>
            <span className="flex items-center gap-1.5 text-emerald-800">
              <span className="h-3 w-3 rounded-md bg-emerald-600" /> Gross Profit
            </span>
          </div>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={profitByParent}
              margin={{ top: 10, right: 16, left: 10, bottom: 10 }}
              barCategoryGap="25%"
            >
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>
                <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="#e8edf5" vertical={false} />
              <XAxis
                dataKey="category"
                tick={{ fontSize: 12, fill: '#334155', fontWeight: 700 }}
                axisLine={false}
                tickLine={false}
                dy={6}
              />
              <YAxis
                tickFormatter={formatCompactETB}
                tick={{ fontSize: 11, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<ProfitChartTooltip />} cursor={{ fill: '#f8fafc', radius: 8 }} />
              <Bar dataKey="revenue" name="Sales Revenue" fill="url(#revGrad)" radius={[6, 6, 2, 2]} maxBarSize={28} />
              <Bar dataKey="recipeCost" name="Recipe Cost" fill="url(#costGrad)" radius={[6, 6, 2, 2]} maxBarSize={28} />
              <Bar dataKey="grossProfit" name="Gross Profit" fill="url(#profitGrad)" radius={[6, 6, 2, 2]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Profit Insight Strip */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl bg-emerald-50/70 border border-emerald-200/80 p-3.5 text-xs text-emerald-900 gap-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>
              <strong>Profitability Summary:</strong> Total Revenue of <strong>{formatETB(totalRevenue)}</strong> with recipe costs of <strong>{formatETB(totalRecipeCost)}</strong> generates <strong>{formatETB(grossProfit)}</strong> in gross profit ({grossMargin}% gross margin).
            </span>
          </div>
          {totalRecipeCost === 0 && (
            <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 shrink-0">
              💡 Tip: Link ingredients in Products &amp; Recipes to view exact COGS breakdown.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
