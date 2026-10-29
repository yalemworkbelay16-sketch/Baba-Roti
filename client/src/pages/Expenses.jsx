import React, { useState, useEffect, useMemo, useCallback } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import Modal from '../components/ui/Modal';
import ExportDropdown from '../components/ui/ExportDropdown';
import {
  Receipt,
  PlusCircle,
  Search,
  Filter,
  RefreshCw,
  Calendar,
  DollarSign,
  TrendingUp,
  Building,
  Zap,
  Trash2,
  Edit2,
  Eye,
  FileText,
  Paperclip,
  CheckCircle2,
  AlertCircle,
  Droplet,
  Wrench,
  Truck,
  Wifi,
  X,
  Printer,
  ChevronDown,
  UploadCloud,
  ExternalLink,
} from 'lucide-react';
import { normalizeFileUrl, isPdfDocument } from '../utils/fileUrl';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CATEGORY_CONFIG = {
  'Utilities (Power, Water, Gas)': {
    icon: Zap,
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    barColor: '#f59e0b',
  },
  'Rent & Facility': {
    icon: Building,
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    barColor: '#6366f1',
  },
  'Cleaning & Sanitation (Soap, Detergents)': {
    icon: Droplet,
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    barColor: '#06b6d4',
  },
  'Maintenance, Electrical & Repairs (Bulbs, Wiring)': {
    icon: Wrench,
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    barColor: '#f97316',
  },
  'Small Tools & Equipment': {
    icon: Wrench,
    color: 'bg-stone-50 text-stone-700 border-stone-200',
    barColor: '#78716c',
  },
  'Kitchen & Dining Supplies (Non-stock)': {
    icon: Receipt,
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    barColor: '#10b981',
  },
  'Transportation & Logistics': {
    icon: Truck,
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    barColor: '#3b82f6',
  },
  'Communication & Internet': {
    icon: Wifi,
    color: 'bg-violet-50 text-violet-700 border-violet-200',
    barColor: '#8b5cf6',
  },
  'Wages & Daily Casual Labor': {
    icon: DollarSign,
    color: 'bg-rose-50 text-rose-700 border-rose-200',
    barColor: '#f43f5e',
  },
  'Miscellaneous Overhead': {
    icon: Receipt,
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    barColor: '#64748b',
  },
};

const DEFAULT_EXPENSE_CATEGORIES = [
  'Utilities (Power, Water, Gas)',
  'Rent & Facility',
  'Cleaning & Sanitation (Soap, Detergents)',
  'Maintenance, Electrical & Repairs (Bulbs, Wiring)',
  'Small Tools & Equipment',
  'Kitchen & Dining Supplies (Non-stock)',
  'Transportation & Logistics',
  'Communication & Internet',
  'Wages & Daily Casual Labor',
  'Marketing, Printing & Signage',
  'Government, Taxes & Licenses',
  'Miscellaneous Overhead',
];

const DEFAULT_PAYMENT_METHODS = [
  'Cash',
  'Telebirr',
  'Bank Transfer / CBE',
  'Credit / Payable',
  'Check',
  'Other',
];

const QUICK_EXPENSE_TEMPLATES = [
  { title: 'Electricity / Power Bill', category: 'Utilities (Power, Water, Gas)' },
  { title: 'Water Utility Bill', category: 'Utilities (Power, Water, Gas)' },
  { title: 'Dish Soap & Cleaning Detergent', category: 'Cleaning & Sanitation (Soap, Detergents)' },
  { title: 'Kitchen & Dining Light Bulbs', category: 'Maintenance, Electrical & Repairs (Bulbs, Wiring)' },
  { title: 'Monthly Shop Rent', category: 'Rent & Facility' },
  { title: 'Plumbing & Drainage Repair', category: 'Maintenance, Electrical & Repairs (Bulbs, Wiring)' },
  { title: 'Internet & WiFi Subscription', category: 'Communication & Internet' },
  { title: 'Local Transport / Taxi Fare', category: 'Transportation & Logistics' },
];

const formatETB = (n) =>
  `ETB ${Number(n || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ── Print Voucher (iframe injection – no popup needed) ────────────────────────
function printVoucher(voucher, formatETB) {
  const date = voucher.date ? new Date(voucher.date).toLocaleDateString() : '—';
  const createdAt = voucher.createdAt ? new Date(voucher.createdAt).toLocaleString() : '—';
  const voucherId = 'EXP-' + (voucher._id?.slice(-6).toUpperCase() || '------');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Voucher – ${voucherId}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #fff; color: #111827; padding: 28px; }
    .voucher { max-width: 580px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; }
    .v-header { background: #1e3a8a; color: #fff; padding: 18px 22px; display: flex; justify-content: space-between; align-items: flex-start; }
    .v-header h1 { font-size: 19px; font-weight: 800; }
    .v-header .sub { font-size: 11px; opacity: 0.75; margin-top: 2px; }
    .v-header .badge { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; background: rgba(255,255,255,.15); padding: 3px 8px; border-radius: 5px; margin-top: 6px; display: inline-block; }
    .v-right { text-align: right; }
    .v-right .id { font-size: 13px; font-weight: 700; font-family: monospace; }
    .v-right .dt { font-size: 11px; opacity: .75; margin-top: 3px; }
    .v-body { padding: 22px; }
    .amt-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 9px; padding: 16px; text-align: center; margin-bottom: 18px; }
    .amt-box .lbl { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .1em; color: #1d4ed8; }
    .amt-box .amt { font-size: 28px; font-weight: 900; font-family: monospace; color: #1e3a8a; margin-top: 3px; }
    .amt-box .via { font-size: 12px; color: #1d4ed8; font-weight: 600; margin-top: 3px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 11px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 14px 0; margin-bottom: 14px; }
    .field .lbl { font-size: 10px; color: #6b7280; }
    .field .val { font-size: 12px; font-weight: 700; color: #111827; margin-top: 2px; }
    .notes-lbl { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
    .notes-box { background: #f8fafc; border-radius: 7px; padding: 9px 11px; font-size: 12px; color: #374151; }
    .receipt-img { max-height: 180px; max-width: 100%; border-radius: 7px; border: 1px solid #e2e8f0; margin-top: 7px; }
    .footer { border-top: 1px solid #e2e8f0; padding: 12px 22px; background: #f8fafc; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 0; }
      .voucher { border: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="voucher">
    <div class="v-header">
      <div>
        <h1>Baba Roti Café</h1>
        <p class="sub">Hotel Management &amp; Stock Control</p>
        <span class="badge">Overhead Expense Voucher</span>
      </div>
      <div class="v-right">
        <div style="font-size:9px;opacity:.7;font-weight:600;text-transform:uppercase;letter-spacing:.08em">Voucher ID</div>
        <div class="id">${voucherId}</div>
        <div class="dt">${date}</div>
      </div>
    </div>
    <div class="v-body">
      <div class="amt-box">
        <div class="lbl">Amount Paid</div>
        <div class="amt">${formatETB(voucher.amount)}</div>
        <div class="via">via ${voucher.paymentMethod || 'Cash'}</div>
      </div>
      <div class="grid">
        <div class="field"><div class="lbl">Expense Item</div><div class="val">${voucher.title || '—'}</div></div>
        <div class="field"><div class="lbl">Category</div><div class="val">${voucher.category || '—'}</div></div>
        <div class="field"><div class="lbl">Paid To / Payee</div><div class="val">${voucher.paidTo || '—'}</div></div>
        <div class="field"><div class="lbl">Invoice / Ref #</div><div class="val">${voucher.referenceNo || '—'}</div></div>
        <div class="field"><div class="lbl">Recorded By</div><div class="val">${voucher.recordedBy?.name || 'Staff'}</div></div>
        <div class="field"><div class="lbl">Recorded At</div><div class="val">${createdAt}</div></div>
      </div>
      ${voucher.notes ? `<div class="notes-lbl">Notes / Purpose</div><div class="notes-box">${voucher.notes}</div>` : ''}
      ${voucher.receiptUrl ? (
        isPdfDocument(voucher.receiptUrl)
          ? `<div style="margin-top:14px"><div class="notes-lbl">Attached Receipt (PDF Document)</div><div style="font-size:11px;color:#475569;background:#f8fafc;padding:8px;border-radius:6px;border:1px solid #e2e8f0">PDF Receipt Attached: ${voucher.receiptUrl}</div></div>`
          : `<div style="margin-top:14px"><div class="notes-lbl">Attached Receipt</div><img src="${normalizeFileUrl(voucher.receiptUrl)}" alt="Receipt" class="receipt-img"/></div>`
      ) : ''}
    </div>
    <div class="footer">Baba Roti Café &middot; ${voucherId} &middot; Printed ${new Date().toLocaleString()}</div>
  </div>
</body>
</html>`;

  // Remove any stale print iframe
  const old = document.getElementById('__voucher_print_frame__');
  if (old) old.remove();

  // Create hidden iframe, inject content, then print it
  const iframe = document.createElement('iframe');
  iframe.id = '__voucher_print_frame__';
  iframe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;border:none;opacity:0;pointer-events:none;z-index:-9999';
  document.body.appendChild(iframe);

  iframe.contentDocument.open();
  iframe.contentDocument.write(html);
  iframe.contentDocument.close();

  // Give the iframe a moment to render then print
  iframe.onload = () => {
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 250);
  };
}

function VoucherReceiptPreview({ rawUrl, voucherId, onReuploaded }) {
  const [hasError, setHasError] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const safeUrl = normalizeFileUrl(rawUrl);
  const isPdf   = isPdfDocument(safeUrl);

  const handleReupload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setReplacing(true);
    try {
      const uploadForm = new FormData();
      uploadForm.append('files', file);
      const res = await api.post('/upload', uploadForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const newUrl = res.data?.files?.[0]?.url;
      if (newUrl) {
        if (voucherId) {
          await api.put(`/expenses/${voucherId}`, { receiptUrl: newUrl });
        }
        setHasError(false);
        if (onReuploaded) onReuploaded(newUrl);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Re-upload failed.');
    } finally {
      setReplacing(false);
    }
  };

  if (isPdf) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl border border-red-200 bg-red-50/70">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-red-100 border border-red-200 flex flex-col items-center justify-center shrink-0 text-red-600">
            <FileText size={18} />
            <span className="text-[8px] font-bold">PDF</span>
          </div>
          <div>
            <p className="font-semibold text-ink-800 text-xs">PDF Document Receipt</p>
            <p className="text-[11px] text-ink-400">Stored in MongoDB Atlas</p>
          </div>
        </div>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-xs transition"
        >
          <FileText size={13} /> View PDF <ExternalLink size={11} />
        </a>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex items-center justify-between p-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900">
        <div className="flex items-center gap-2.5">
          <AlertCircle size={20} className="text-amber-600 shrink-0" />
          <div>
            <p className="font-semibold text-xs">Receipt Image Unavailable</p>
            <p className="text-[11px] text-amber-700">Wiped from ephemeral server storage</p>
          </div>
        </div>
        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs cursor-pointer transition">
          <UploadCloud size={13} /> {replacing ? 'Uploading…' : 'Re-upload'}
          <input
            type="file"
            accept="image/*,.pdf"
            disabled={replacing}
            onChange={handleReupload}
            className="hidden"
          />
        </label>
      </div>
    );
  }

  return (
    <a
      href={safeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block group relative overflow-hidden rounded-xl border border-ink-200 bg-ink-50 hover:border-blue-300 transition"
      title="Click to view full receipt"
    >
      <img
        src={safeUrl}
        alt="Receipt"
        className="max-h-56 w-full object-contain"
        onError={() => setHasError(true)}
      />
      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-[10px] opacity-0 group-hover:opacity-100 transition">
        <ExternalLink size={10} /> Open full image
      </span>
    </a>
  );
}

export default function Expenses() {
  const { user, hasRole, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('expenses', 'edit') : (hasRole('admin') || hasRole('manager'));
  const canDelete = canCrud ? canCrud('expenses', 'delete') : (hasRole('admin') || hasRole('manager'));

  // Filter states
  const [datePreset, setDatePreset] = useState('month'); // 'all' | 'today' | 'week' | 'month' | 'last_month' | 'custom'
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPayment, setSelectedPayment] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [stats, setStats] = useState(null);
  const [categoriesList, setCategoriesList] = useState(DEFAULT_EXPENSE_CATEGORIES);
  const [paymentMethodsList, setPaymentMethodsList] = useState(DEFAULT_PAYMENT_METHODS);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Detail / Voucher Modal
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);
  const [activeVoucher, setActiveVoucher] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    category: 'Utilities (Power, Water, Gas)',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Cash',
    paidTo: '',
    referenceNo: '',
    notes: '',
    receiptUrl: '',
    status: 'Paid',
  });
  const [formReceiptError, setFormReceiptError] = useState(false);

  // Calculate actual from/to dates based on preset
  const dateParams = useMemo(() => {
    const now = new Date();
    let from = null;
    let to = null;

    if (datePreset === 'today') {
      const d = now.toISOString().slice(0, 10);
      from = d;
      to = d;
    } else if (datePreset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      from = d.toISOString().slice(0, 10);
      to = now.toISOString().slice(0, 10);
    } else if (datePreset === 'month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      from = `${y}-${m}-01`;
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    } else if (datePreset === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      from = `${y}-${m}-01`;
      const lastDay = new Date(y, d.getMonth() + 1, 0).getDate();
      to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    } else if (datePreset === 'custom') {
      from = customFrom || null;
      to = customTo || null;
    }
    return { from, to };
  }, [datePreset, customFrom, customTo]);

  // Load metadata (categories & payment methods)
  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const res = await api.get('/expenses/meta');
        if (res.data?.categories?.length) setCategoriesList(res.data.categories);
        if (res.data?.paymentMethods?.length) setPaymentMethodsList(res.data.paymentMethods);
      } catch (err) {
        console.warn('Could not load expense metadata, using fallback defaults', err);
      }
    };
    fetchMeta();
  }, []);

  // Fetch expenses list
  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateParams.from) params.from = dateParams.from;
      if (dateParams.to) params.to = dateParams.to;
      if (selectedCategory && selectedCategory !== 'ALL') params.category = selectedCategory;
      if (selectedPayment && selectedPayment !== 'ALL') params.paymentMethod = selectedPayment;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/expenses', { params });
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }, [dateParams, selectedCategory, selectedPayment, searchQuery]);

  // Fetch expense stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const params = {};
      if (dateParams.from) params.from = dateParams.from;
      if (dateParams.to) params.to = dateParams.to;
      const res = await api.get('/expenses/stats', { params });
      setStats(res.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, [dateParams]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Reset form to defaults
  const openNewExpenseModal = (template = null) => {
    setEditingExpense(null);
    setFormError('');
    setFormReceiptError(false);
    setFormData({
      title: template?.title || '',
      category: template?.category || categoriesList[0] || 'Utilities (Power, Water, Gas)',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      paymentMethod: 'Cash',
      paidTo: '',
      referenceNo: '',
      notes: '',
      receiptUrl: '',
      status: 'Paid',
    });
    setModalOpen(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setFormError('');
    setFormReceiptError(false);
    setFormData({
      title: expense.title || '',
      category: expense.category || 'Utilities (Power, Water, Gas)',
      amount: expense.amount || '',
      date: expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '',
      paymentMethod: expense.paymentMethod || 'Cash',
      paidTo: expense.paidTo || '',
      referenceNo: expense.referenceNo || '',
      notes: expense.notes || '',
      receiptUrl: expense.receiptUrl || '',
      status: expense.status || 'Paid',
    });
    setModalOpen(true);
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Please enter an expense title or item description.');
      return;
    }
    const num = Number(formData.amount);
    if (!num || num <= 0) {
      setFormError('Please enter a valid amount greater than 0 ETB.');
      return;
    }

    setSaving(true);
    setFormError('');
    try {
      if (editingExpense) {
        await api.put(`/expenses/${editingExpense._id}`, formData);
      } else {
        await api.post('/expenses', formData);
      }
      setModalOpen(false);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save expense record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteExpense = async (id, title) => {
    if (!window.confirm(`Move "${title}" to Recycle Bin?`)) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
      fetchStats();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete expense.');
    }
  };

  // Upload receipt image or PDF
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const uploadForm = new FormData();
    uploadForm.append('files', file);
    try {
      const res = await api.post('/upload', uploadForm, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.files?.[0]?.url) {
        setFormData((prev) => ({ ...prev, receiptUrl: res.data.files[0].url }));
        setFormReceiptError(false);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Receipt upload failed');
    }
  };

  // Export prepared data
  const exportData = useMemo(() => {
    return expenses.map((e) => ({
      Date: e.date ? new Date(e.date).toLocaleDateString() : '—',
      Item: e.title,
      Category: e.category,
      'Amount (ETB)': Number(e.amount || 0).toFixed(2),
      'Payment Method': e.paymentMethod,
      'Paid To': e.paidTo || '—',
      'Ref / Bill No': e.referenceNo || '—',
      'Recorded By': e.recordedBy?.name || '—',
      Notes: e.notes || '—',
    }));
  }, [expenses]);

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header Banner ── */}
      <div className="relative rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 sm:p-8 text-white shadow-xl">
        {/* Decorative blur layer (clips background blur circles without clipping dropdowns) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute right-40 -bottom-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl" />
        </div>

        <div className="relative z-20 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-md">
              <Receipt size={14} className="text-amber-300" />
              <span>Overhead & Operational Cost Recorder</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Overhead Expenses
            </h1>
            <p className="text-xs sm:text-sm text-blue-200/80 max-w-2xl leading-relaxed">
              Record and control non-stock operational costs like water, electricity, rent, soap & detergents,
              bulbs, repairs, and daily operational overheads.
            </p>
          </div>

          <div className="relative z-30 flex flex-wrap items-center gap-2.5">
            {canEdit && (
              <button
                type="button"
                onClick={() => openNewExpenseModal()}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 active:scale-95 text-white font-semibold shadow-lg shadow-blue-500/25 px-4 py-2.5 rounded-xl border border-white/20 transition-all cursor-pointer hover:scale-[1.02]"
              >
                <PlusCircle size={16} /> Record Expense
              </button>
            )}

            <ExportDropdown
              data={exportData}
              fileName={`Overhead_Expenses_${new Date().toISOString().slice(0, 10)}`}
              sheetName="Overhead Expenses"
              pdfTitle="Baba Roti Café - Overhead Expenses Report"
              buttonClassName="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-white/20 hover:border-white/30 transition backdrop-blur-md cursor-pointer"
              pdfColumns={[
                { header: 'Date', dataKey: 'Date' },
                { header: 'Item / Description', dataKey: 'Item' },
                { header: 'Category', dataKey: 'Category' },
                { header: 'Amount (ETB)', dataKey: 'Amount (ETB)' },
                { header: 'Payment', dataKey: 'Payment Method' },
                { header: 'Paid To', dataKey: 'Paid To' },
                { header: 'Recorded By', dataKey: 'Recorded By' },
              ]}
              pdfSummary={
                stats
                  ? `Total Filtered Overhead: ETB ${Number(stats.totalPeriodAmount || 0).toLocaleString()} across ${stats.totalPeriodCount || 0} entries.`
                  : null
              }
            />

            <button
              onClick={() => {
                fetchExpenses();
                fetchStats();
              }}
              title="Refresh Data"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition backdrop-blur-md border border-white/10 cursor-pointer"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ── Quick Expense Suggestion Chips ── */}
        <div className="mt-6 pt-4 border-t border-white/10">
          <p className="text-[11px] font-semibold text-blue-200/70 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Zap size={12} className="text-amber-300" /> Fast Templates (Click to record)
          </p>
          <div className="flex flex-wrap gap-2">
            {QUICK_EXPENSE_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.title}
                onClick={() => openNewExpenseModal(tmpl)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 text-xs font-medium text-white transition backdrop-blur-sm border border-white/10 hover:border-white/25 active:scale-95"
              >
                <span>+</span> {tmpl.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stat KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Period Total
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <DollarSign size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-ink-900 mt-2">
            {statsLoading ? '…' : formatETB(stats?.totalPeriodAmount)}
          </p>
          <p className="text-xs text-ink-400 mt-1 flex items-center gap-1">
            <span>{stats?.totalPeriodCount || 0} expenses recorded</span>
          </p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              This Month
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Calendar size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-indigo-900 mt-2">
            {statsLoading ? '…' : formatETB(stats?.monthTotal)}
          </p>
          <p className="text-xs text-ink-400 mt-1">Calendar month expenses</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Today's Expenses
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <TrendingUp size={16} />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-2">
            {statsLoading ? '…' : formatETB(stats?.todayTotal)}
          </p>
          <p className="text-xs text-ink-400 mt-1">Recorded today</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm hover:shadow-md transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-ink-500 uppercase tracking-wider">
              Top Category
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <Zap size={16} />
            </span>
          </div>
          <p className="text-base font-black text-ink-900 mt-2 truncate" title={stats?.byCategory?.[0]?.category}>
            {statsLoading ? '…' : stats?.byCategory?.[0]?.category || 'None'}
          </p>
          <p className="text-xs text-amber-700 font-semibold mt-1">
            {stats?.byCategory?.[0]
              ? `${formatETB(stats.byCategory[0].total)} (${stats.byCategory[0].percentage}%)`
              : 'No expenses'}
          </p>
        </div>
      </div>

      {/* ── Visual Analytics Section ── */}
      {stats?.monthlyTrend && stats.monthlyTrend.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Trend Bar Chart */}
          <div className="lg:col-span-2 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-ink-900">Overhead Cost Trend (Last 6 Months)</h3>
                <p className="text-xs text-ink-400">Monthly breakdown of operational overheads</p>
              </div>
              <span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700">
                Monthly ETB
              </span>
            </div>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.monthlyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} stroke="#cbd5e1" />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    stroke="#cbd5e1"
                    tickFormatter={(v) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                  />
                  <Tooltip
                    formatter={(val) => [`${formatETB(val)}`, 'Total Expenses']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                  <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Category Distribution */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-ink-900">Category Share</h3>
                <span className="text-xs text-ink-400">Current Period</span>
              </div>
              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {stats?.byCategory && stats.byCategory.length > 0 ? (
                  stats.byCategory.map((cat) => {
                    const cfg = CATEGORY_CONFIG[cat.category] || { barColor: '#94a3b8' };
                    return (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink-800 truncate max-w-[170px]" title={cat.category}>
                            {cat.category}
                          </span>
                          <span className="text-ink-500 font-mono text-[11px]">
                            {cat.percentage}% ({formatETB(cat.total)})
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-ink-100 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.min(cat.percentage, 100)}%`, backgroundColor: cfg.barColor }}
                          />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-ink-400 py-6 text-center">No category breakdown data</p>
                )}
              </div>
            </div>

            {/* Quick Stat Footer */}
            <div className="mt-4 pt-3 border-t border-ink-100 flex items-center justify-between text-xs text-ink-500">
              <span>Categories active:</span>
              <span className="font-bold text-ink-800">{stats?.byCategory?.length || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Filters & Search Toolbar ── */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Last 7 Days' },
              { id: 'month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  datePreset === p.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
                }`}
              >
                {p.label}
              </button>
            ))}

            {/* Custom Date Pickers */}
            {datePreset === 'custom' && (
              <div className="flex items-center gap-2 text-xs ml-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-ink-400">to</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          {/* Arranged Toolbar Export Button */}
          <div className="flex items-center gap-2">
            <ExportDropdown
              data={exportData}
              fileName={`Overhead_Expenses_${new Date().toISOString().slice(0, 10)}`}
              sheetName="Overhead Expenses"
              pdfTitle="Baba Roti Café - Overhead Expenses Report"
              buttonClassName="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-ink-700 shadow-xs hover:border-ink-300 hover:bg-ink-50 transition cursor-pointer"
              pdfColumns={[
                { header: 'Date', dataKey: 'Date' },
                { header: 'Item / Description', dataKey: 'Item' },
                { header: 'Category', dataKey: 'Category' },
                { header: 'Amount (ETB)', dataKey: 'Amount (ETB)' },
                { header: 'Payment', dataKey: 'Payment Method' },
                { header: 'Paid To', dataKey: 'Paid To' },
                { header: 'Recorded By', dataKey: 'Recorded By' },
              ]}
              pdfSummary={
                stats
                  ? `Total Filtered Overhead: ETB ${Number(stats.totalPeriodAmount || 0).toLocaleString()} across ${stats.totalPeriodCount || 0} entries.`
                  : null
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-ink-100">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search expenses, vendors, notes..."
              className="w-full rounded-xl border border-ink-200 pl-9 pr-3 py-2 text-xs text-ink-800 placeholder-ink-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Categories</option>
              {categoriesList.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Method Filter */}
          <div>
            <select
              value={selectedPayment}
              onChange={(e) => setSelectedPayment(e.target.value)}
              className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Payment Methods</option>
              {paymentMethodsList.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Expenses Data Table ── */}
      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-ink-100 bg-ink-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink-900">Recorded Expenses</h3>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-blue-800">
              {expenses.length}
            </span>
          </div>

          <p className="text-xs text-ink-400">
            Total: <strong className="text-ink-900 font-mono">{formatETB(stats?.totalPeriodAmount)}</strong>
          </p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-400">
            <RefreshCw size={24} className="animate-spin text-blue-500 mb-2" />
            <p className="text-xs">Loading expenses...</p>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-ink-400">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-500 mb-3">
              <Receipt size={24} />
            </div>
            <p className="text-sm font-bold text-ink-700">No expenses found</p>
            <p className="text-xs text-ink-400 max-w-sm mt-1">
              No overhead expenses match your current date and category filters. Click "Record Expense" to add one.
            </p>
            <button
              type="button"
              onClick={() => openNewExpenseModal()}
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold px-4 py-2.5 shadow-md shadow-blue-500/20 transition-all cursor-pointer"
            >
              <PlusCircle size={15} /> Record First Expense
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-ink-100 text-left text-xs">
              <thead className="bg-ink-50/70 text-ink-600 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Expense Item / Details</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Paid To</th>
                  <th className="px-4 py-3">Payment</th>
                  <th className="px-4 py-3">Ref #</th>
                  <th className="px-4 py-3 text-right">Amount (ETB)</th>
                  <th className="px-4 py-3">Recorded By</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-50 text-ink-700">
                {expenses.map((exp) => {
                  const catCfg = CATEGORY_CONFIG[exp.category] || {
                    icon: Receipt,
                    color: 'bg-slate-50 text-slate-700 border-slate-200',
                  };
                  const CatIcon = catCfg.icon;

                  return (
                    <tr key={exp._id} className="hover:bg-blue-50/30 transition-colors">
                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap text-ink-600 font-mono text-[11px]">
                        {exp.date ? new Date(exp.date).toLocaleDateString() : '—'}
                      </td>

                      {/* Title & Notes */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-ink-900 flex items-center gap-1.5">
                          <span>{exp.title}</span>
                          {exp.receiptUrl && (
                            <a
                              href={normalizeFileUrl(exp.receiptUrl)}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View attached document / receipt"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center text-blue-600 bg-blue-50 hover:bg-blue-100 rounded px-1.5 py-0.5 text-[10px] font-medium transition"
                            >
                              <Paperclip size={10} className="mr-0.5" /> receipt
                            </a>
                          )}
                        </div>
                        {exp.notes && (
                          <p className="text-[11px] text-ink-400 truncate max-w-xs">{exp.notes}</p>
                        )}
                      </td>

                      {/* Category Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold border ${catCfg.color}`}
                        >
                          <CatIcon size={12} />
                          <span className="truncate max-w-[150px]">{exp.category}</span>
                        </span>
                      </td>

                      {/* Paid To */}
                      <td className="px-4 py-3 whitespace-nowrap text-ink-800">
                        {exp.paidTo || <span className="text-ink-400 italic">—</span>}
                      </td>

                      {/* Payment Method */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-700">
                          {exp.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      {/* Ref / Bill No */}
                      <td className="px-4 py-3 whitespace-nowrap font-mono text-[11px] text-ink-500">
                        {exp.referenceNo || '—'}
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 whitespace-nowrap text-right font-black text-ink-900 font-mono text-sm">
                        {formatETB(exp.amount)}
                      </td>

                      {/* Recorded By */}
                      <td className="px-4 py-3 whitespace-nowrap text-ink-500 text-[11px]">
                        <span className="font-medium text-ink-700">{exp.recordedBy?.name || 'Staff'}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => {
                              setActiveVoucher(exp);
                              setVoucherModalOpen(true);
                            }}
                            title="View Voucher & Receipt"
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-blue-50 hover:text-blue-600 transition"
                          >
                            <Eye size={13} />
                          </button>

                          {canEdit && (
                            <button
                              onClick={() => openEditModal(exp)}
                              title="Edit Expense"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-amber-50 hover:text-amber-600 transition"
                            >
                              <Edit2 size={13} />
                            </button>
                          )}

                          {canDelete && (
                            <button
                              onClick={() => handleDeleteExpense(exp._id, exp.title)}
                              title="Move to Recycle Bin"
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-500 hover:bg-red-50 hover:text-red-600 transition"
                            >
                              <Trash2 size={13} />
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
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: RECORD / EDIT EXPENSE
      ══════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <Modal
          open={modalOpen}
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          title={editingExpense ? 'Edit Overhead Expense' : 'Record Overhead Expense'}
        >
          <form onSubmit={handleSaveExpense} className="space-y-4">
            {formError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 border border-red-200">
                <AlertCircle size={15} className="shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Title / Description */}
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1">
                Expense Title / Item Description <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData((p) => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Electricity bill, Light bulbs for kitchen, Soap & detergent"
                className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Category & Amount */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2.5 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {categoriesList.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">
                  Amount (ETB) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.amount}
                  onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2.5 text-xs font-mono font-bold text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Date & Payment Method */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">
                  Expense Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">Payment Method</label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value }))}
                  className="w-full rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {paymentMethodsList.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Paid To & Reference / Bill # */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">
                  Paid To / Vendor / Landlord
                </label>
                <input
                  type="text"
                  value={formData.paidTo}
                  onChange={(e) => setFormData((p) => ({ ...p, paidTo: e.target.value }))}
                  placeholder="e.g. Electric Utility, Local Hardware, Landlord"
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-ink-800 mb-1">
                  Receipt / Invoice / Bill #
                </label>
                <input
                  type="text"
                  value={formData.referenceNo}
                  onChange={(e) => setFormData((p) => ({ ...p, referenceNo: e.target.value }))}
                  placeholder="e.g. INV-98432 or Bill #45"
                  className="w-full rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1">Notes / Purpose</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
                placeholder="Additional notes about this expenditure..."
                className="w-full rounded-xl border border-ink-200 px-3.5 py-2 text-xs text-ink-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Receipt Image / PDF Attachment */}
            <div>
              <label className="block text-xs font-bold text-ink-800 mb-1">
                Receipt Attachment (Optional)
              </label>
              {formData.receiptUrl ? (
                (() => {
                  const safeUrl = normalizeFileUrl(formData.receiptUrl);
                  const isPdf   = isPdfDocument(safeUrl);
                  return (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-blue-50/70 border border-blue-200">
                      {isPdf ? (
                        <div className="h-12 w-12 rounded-lg bg-red-100 border border-red-200 flex flex-col items-center justify-center shrink-0 text-red-600">
                          <FileText size={20} />
                          <span className="text-[9px] font-bold">PDF</span>
                        </div>
                      ) : formReceiptError ? (
                        <div className="h-12 w-12 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0 text-amber-700">
                          <AlertCircle size={20} />
                        </div>
                      ) : (
                        <img
                          src={safeUrl}
                          alt="Receipt"
                          className="h-12 w-12 object-cover rounded-lg border border-blue-200 shrink-0"
                          onError={() => setFormReceiptError(true)}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-blue-900 truncate">
                          {isPdf ? 'PDF Receipt Attached' : 'Receipt Uploaded'}
                        </p>
                        {formReceiptError ? (
                          <label className="text-[11px] text-amber-700 font-medium underline cursor-pointer hover:text-amber-900">
                            Image wiped — click to re-upload
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              onChange={(e) => {
                                setFormReceiptError(false);
                                handleReceiptUpload(e);
                              }}
                              className="hidden"
                            />
                          </label>
                        ) : (
                          <a
                            href={safeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 underline"
                          >
                            {isPdf ? 'View PDF' : 'View full image'} <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFormData((p) => ({ ...p, receiptUrl: '' }));
                          setFormReceiptError(false);
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Remove attachment"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  );
                })()
              ) : (
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-ink-200 hover:border-blue-400 hover:bg-blue-50/30 rounded-xl p-3 cursor-pointer text-xs text-ink-500 transition">
                  <UploadCloud size={16} className="text-blue-500" />
                  <span>Upload receipt image or PDF (up to 10 MB)</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleReceiptUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-3 border-t border-ink-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
              >
                {saving ? 'Saving...' : editingExpense ? 'Update Expense' : 'Save Expense Record'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: VIEW EXPENSE VOUCHER / RECEIPT
      ══════════════════════════════════════════════════════════════ */}
      {voucherModalOpen && activeVoucher && (
        <Modal
          open={voucherModalOpen}
          isOpen={voucherModalOpen}
          onClose={() => setVoucherModalOpen(false)}
          title="Payment Voucher"
        >
          <div className="space-y-4">
            <div
              id="printable-voucher"
              className="rounded-2xl border border-ink-200 bg-white p-6 shadow-sm space-y-4"
            >
              {/* Slip Header */}
              <div className="border-b border-ink-100 pb-3 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-black text-ink-900 tracking-tight">Baba Roti Café</h2>
                  <p className="text-[11px] text-ink-500 font-medium">Hotel Management & Stock Control</p>
                  <p className="text-xs font-bold text-blue-700 mt-1 uppercase tracking-wider">
                    Overhead Expense Voucher
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-ink-400 uppercase tracking-widest block">
                    Voucher ID
                  </span>
                  <span className="font-mono text-xs font-bold text-ink-700">
                    EXP-{activeVoucher._id?.slice(-6).toUpperCase()}
                  </span>
                  <p className="text-[11px] text-ink-500 mt-0.5">
                    {activeVoucher.date ? new Date(activeVoucher.date).toLocaleDateString() : '—'}
                  </p>
                </div>
              </div>

              {/* Amount Highlight */}
              <div className="rounded-xl bg-blue-50/70 border border-blue-100 p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  Amount Paid
                </p>
                <p className="text-3xl font-black text-blue-950 font-mono mt-1">
                  {formatETB(activeVoucher.amount)}
                </p>
                <p className="text-xs text-blue-700 mt-0.5 font-medium">
                  via {activeVoucher.paymentMethod || 'Cash'}
                </p>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs border-y border-ink-100 py-3">
                <div>
                  <p className="text-ink-400 font-medium">Expense Item</p>
                  <p className="font-bold text-ink-900 mt-0.5">{activeVoucher.title}</p>
                </div>
                <div>
                  <p className="text-ink-400 font-medium">Category</p>
                  <p className="font-bold text-ink-900 mt-0.5">{activeVoucher.category}</p>
                </div>
                <div>
                  <p className="text-ink-400 font-medium">Paid To / Payee</p>
                  <p className="font-bold text-ink-900 mt-0.5">{activeVoucher.paidTo || '—'}</p>
                </div>
                <div>
                  <p className="text-ink-400 font-medium">Invoice / Ref #</p>
                  <p className="font-bold text-ink-900 mt-0.5">{activeVoucher.referenceNo || '—'}</p>
                </div>
                <div>
                  <p className="text-ink-400 font-medium">Recorded By</p>
                  <p className="font-bold text-ink-900 mt-0.5">{activeVoucher.recordedBy?.name || 'Staff'}</p>
                </div>
                <div>
                  <p className="text-ink-400 font-medium">Recorded At</p>
                  <p className="font-bold text-ink-900 mt-0.5">
                    {activeVoucher.createdAt ? new Date(activeVoucher.createdAt).toLocaleString() : '—'}
                  </p>
                </div>
              </div>

              {/* Notes */}
              {activeVoucher.notes && (
                <div className="text-xs">
                  <p className="text-ink-400 font-medium">Notes / Purpose</p>
                  <p className="text-ink-800 mt-0.5 bg-ink-50 p-2 rounded-lg">{activeVoucher.notes}</p>
                </div>
              )}

              {/* Receipt Preview if any */}
              {activeVoucher.receiptUrl && (
                <div className="text-xs pt-2">
                  <p className="text-ink-400 font-medium mb-1">Attached Receipt</p>
                  <VoucherReceiptPreview
                    rawUrl={activeVoucher.receiptUrl}
                    voucherId={activeVoucher._id}
                    onReuploaded={(newUrl) => {
                      setActiveVoucher((prev) => (prev ? { ...prev, receiptUrl: newUrl } : null));
                      fetchExpenses();
                    }}
                  />
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="flex justify-between items-center pt-2">
              <Button
                variant="outline"
                onClick={() => setVoucherModalOpen(false)}
                className="text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => printVoucher(activeVoucher, formatETB)}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3.5 py-2 rounded-xl"
              >
                <Printer size={14} /> Print Voucher
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
