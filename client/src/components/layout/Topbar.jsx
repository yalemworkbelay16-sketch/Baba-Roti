import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, LogOut, ChevronDown, User, Shield, Building,
  Layers, Clock, HelpCircle, X, BookOpen, Package,
  ArrowLeftRight, ShoppingCart, BarChart2, Users,
  ChevronRight, Search, Lightbulb, CheckCircle2, PlayCircle,
  Bell, BellRing, Trash2, Globe,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useSessionTimeout } from '../../context/SessionTimeoutContext';
import { useLanguage } from '../../context/LanguageContext';

// ─────────────────────────────────────────
// HELP MODAL DATA
// ─────────────────────────────────────────
const HELP_SECTIONS = [
  {
    id: 'getting-started',
    icon: PlayCircle,
    color: 'bg-blue-600',
    title: 'Getting Started',
    steps: [
      { title: 'Log In', desc: "Enter your username and password on the login page. Contact your Admin if you don't have credentials." },
      { title: 'Dashboard Overview', desc: 'After login, the Dashboard shows total stock value, reorder alerts, today\'s movements, and recent activity.' },
      { title: 'Navigation', desc: 'Use the left sidebar to navigate between modules. Click the menu icon to collapse or expand it.' },
      { title: 'Quick Actions', desc: 'Use the buttons at the top of the Dashboard to quickly create a Cash GRV, Credit GRV, or view Inventory Count.' },
    ],
  },
  {
    id: 'raw-materials',
    icon: Package,
    color: 'bg-emerald-600',
    title: 'Raw Materials',
    steps: [
      { title: 'View Materials', desc: 'Go to Raw Materials in the sidebar. All active materials are listed with their current stock, unit, and category.' },
      { title: 'Add a Material', desc: 'Click "+ Add Material". Fill in the name, unit (kg, L, pcs), category, and reorder level, then save.' },
      { title: 'Edit / Archive', desc: "Click the action menu on any material row to edit its details or archive it." },
      { title: 'Reorder Alerts', desc: 'Materials below their reorder level are highlighted in amber/red on the Dashboard and Reports.' },
    ],
  },
  {
    id: 'stock-movements',
    icon: ArrowLeftRight,
    color: 'bg-indigo-600',
    title: 'Stock Movements',
    steps: [
      { title: 'Cash GRV', desc: 'Use for goods purchased with cash. Go to Stock Movements → Cash Goods Receiving → fill in supplier, items, quantities, and unit cost.' },
      { title: 'Credit GRV', desc: 'Use for goods received on credit. Same as Cash GRV but payment is deferred. Linked to a supplier account.' },
      { title: 'Positive Adjustment', desc: 'Use to correct stock upward (e.g., after a physical count finds extra items). Requires a reason.' },
      { title: 'Negative Adjustment', desc: 'Use to correct stock downward. Requires reason and manager/admin approval.' },
      { title: 'Goods Disposal', desc: 'Record expired or damaged goods removed from stock. These reduce stock balance and appear in disposal reports.' },
      { title: 'Fresh Bazaar', desc: 'For direct market purchases without a formal supplier invoice.' },
    ],
  },
  {
    id: 'purchases',
    icon: ShoppingCart,
    color: 'bg-violet-600',
    title: 'Purchases & Approvals',
    steps: [
      { title: 'Create a Purchase Order', desc: 'Go to Purchases → New Purchase. Select a supplier, add items and quantities, then submit as Draft.' },
      { title: 'Approval Workflow', desc: 'Draft → Manager checks → Admin approves → Storekeeper receives. Each step requires the appropriate role.' },
      { title: 'Receive Goods', desc: 'Once approved, the storekeeper marks the PO as Received. Stock is automatically added to inventory.' },
      { title: 'Cancel a PO', desc: 'Any step before Received can be cancelled. Cancelled POs are archived and visible in history.' },
    ],
  },
  {
    id: 'reports',
    icon: BarChart2,
    color: 'bg-amber-600',
    title: 'Reports & Analytics',
    steps: [
      { title: 'Stock Balance Sheet', desc: 'Shows current stock quantity and value for all materials. Export to PDF or Excel using the Export button.' },
      { title: 'Daily Report', desc: 'Summary of all stock movements for a selected day — inflow, outflow, adjustments, and disposals.' },
      { title: 'GRV Reports', desc: 'View all Cash, Credit, or Fresh Bazaar receiving records filtered by date range or supplier.' },
      { title: 'Inventory Count', desc: 'Physical count reconciliation. Compare system stock vs physical count and record variances.' },
      { title: 'Analytics & P&L', desc: 'View stock value trends, category breakdown, top assets, and profit/loss overview from the Analytics page.' },
    ],
  },
  {
    id: 'users',
    icon: Users,
    color: 'bg-rose-600',
    title: 'Users & Access',
    steps: [
      { title: 'User Roles', desc: 'Admin: full access. Manager: approve, report, manage materials. Storekeeper: record movements. Viewer: read-only.' },
      { title: 'Add a Staff Member', desc: 'Go to Staff Accounts → Add User. Set name, email, password, and role.' },
      { title: 'Change Password', desc: 'Click your name at the top right → Security & Password → enter current and new password.' },
      { title: 'Session Timeout', desc: 'The system auto-logs you out after inactivity. You can change the timeout in the top-right menu.' },
    ],
  },
];

const QUICK_TIPS = [
  { icon: '💡', tip: 'Always set a reorder level for critical materials so the system can alert you before stock runs out.' },
  { icon: '🔒', tip: 'Never share your login credentials. Each user should have their own account for a proper audit trail.' },
  { icon: '📊', tip: 'Export your Stock Balance Sheet at the end of each week and save it for management review.' },
  { icon: '🔄', tip: "Use the Refresh button on the Dashboard to get the latest stock data if you've been idle for a while." },
  { icon: '🗑️', tip: 'Accidentally deleted something? Check the Recycle Bin (Admin/Manager only) to restore it.' },
];

// ─────────────────────────────────────────
// HELP MODAL COMPONENT
// ─────────────────────────────────────────
const HelpModal = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState('getting-started');
  const [search, setSearch] = useState('');

  const current = HELP_SECTIONS.find(s => s.id === activeSection);

  const filtered = search.trim()
    ? HELP_SECTIONS.flatMap(s =>
      s.steps
        .filter(st =>
          st.title.toLowerCase().includes(search.toLowerCase()) ||
          st.desc.toLowerCase().includes(search.toLowerCase())
        )
        .map(st => ({ ...st, section: s.title, color: s.color }))
    )
    : null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-ink-100"
          style={{ background: 'linear-gradient(135deg, #1a3cdb 0%, #4f46e5 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Help &amp; Documentation</h2>
              <p className="text-xs text-blue-200">Step-by-step guides for every feature</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-ink-100 bg-ink-50/40">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
            <Search size={14} className="text-ink-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search help topics..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-xs outline-none text-ink-800 placeholder-ink-400 bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-ink-400 hover:text-ink-700">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Section nav */}
          {!search && (
            <div className="w-52 flex-shrink-0 border-r border-ink-100 overflow-y-auto bg-ink-50/40 py-3 px-2">
              {HELP_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition mb-0.5 ${activeSection === s.id
                    ? 'bg-white shadow-sm text-blue-700 font-bold border border-ink-100'
                    : 'text-ink-600 hover:bg-white/70 hover:text-ink-900'
                    }`}
                >
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                    <s.icon size={12} className="text-white" />
                  </span>
                  {s.title}
                  {activeSection === s.id && (
                    <ChevronRight size={12} className="ml-auto text-blue-400" />
                  )}
                </button>
              ))}
              <div className="mt-4 px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 px-2 mb-2">Quick Tips</p>
                {QUICK_TIPS.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg p-2 text-[11px] text-ink-600 hover:bg-white/70 transition">
                    <span className="flex-shrink-0 text-sm">{t.icon}</span>
                    <span className="leading-relaxed">{t.tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {filtered !== null ? (
              <div>
                <p className="text-xs font-bold text-ink-500 mb-4">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for{' '}
                  <span className="text-blue-600">"{search}"</span>
                </p>
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-ink-400">
                    <Search size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No results found</p>
                    <p className="text-xs mt-1">Try a different keyword</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((r, i) => (
                      <div key={i} className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 text-white ${r.color}`}>
                            {r.section}
                          </span>
                          <p className="text-sm font-bold text-ink-900">{r.title}</p>
                        </div>
                        <p className="text-xs text-ink-600 leading-relaxed">{r.desc}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              current && (
                <div>
                  <div className="flex items-center gap-3 mb-5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${current.color} shadow-sm`}>
                      <current.icon size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-base font-black text-ink-900">{current.title}</h3>
                      <p className="text-xs text-ink-400">{current.steps.length} steps</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {current.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex gap-4 rounded-2xl border border-ink-100 bg-white p-4 hover:border-blue-200 hover:bg-blue-50/20 transition"
                      >
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black mt-0.5">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-ink-900 mb-0.5">{step.title}</p>
                          <p className="text-xs text-ink-500 leading-relaxed">{step.desc}</p>
                        </div>
                        <CheckCircle2 size={16} className="flex-shrink-0 text-ink-200 mt-1" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                    <Lightbulb size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 mb-1">Need more help?</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        Contact your system administrator or reach MEGA Technology support for assistance.
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/40 px-6 py-3">
          <p className="text-[10px] text-ink-400">Baba Roti  CaféHotel Management · Powered by MEGA Technology</p>
          <button
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────
// NOTIFICATION BELL COMPONENT
// ─────────────────────────────────────────
const SEVERITY_STYLES = {
  info: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  success: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  error: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
};

const TYPE_ICONS = {
  purchase: '🛒',
  stock_request: '📦',
  transaction: '↔️',
  consumption: '🍽️',
  material: '🧱',
  employee: '👷',
  user: '👤',
  system: '⚙️',
  low_stock: '⚠️',
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const bellRef = useRef(null);
  const navigate = useNavigate();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.notifications || []);
      setUnread(res.data.unread || 0);
    } catch { /* silent */ }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Click = remove instantly from UI + delete from DB
  const handleClick = (n) => {
    setNotifications(prev => prev.filter(x => x._id !== n._id));
    setUnread(prev => Math.max(0, prev - 1));
    api.delete(`/notifications/${n._id}`).catch(() => { });
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  // Clear all
  const clearAll = async () => {
    setNotifications([]);
    setUnread(0);
    api.delete('/notifications').catch(() => { });
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications(); }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${unread > 0
          ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
          : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
          }`}
        title="Notifications"
      >
        {unread > 0 ? <BellRing size={16} /> : <Bell size={16} />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-ink-100 bg-white shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-ink-50/60">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-blue-600" />
              <span className="text-xs font-bold text-ink-900">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5">
                  {unread} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition"
              >
                <Trash2 size={11} /> Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto mb-2 text-ink-200" />
                <p className="text-xs font-medium text-ink-500">All caught up!</p>
                <p className="text-[10px] text-ink-400 mt-0.5">New activity will appear here</p>
              </div>
            ) : (
              notifications.map((n) => {
                const sev = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info;
                return (
                  <div key={n._id} className="flex items-start gap-0 border-b border-ink-50 last:border-0 group hover:bg-ink-50/60 transition">
                    {/* Main clickable area */}
                    <button
                      onClick={() => handleClick(n)}
                      className="flex flex-1 items-start gap-3 px-4 py-3 text-left"
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-sm ${sev.bg}`}>
                        {TYPE_ICONS[n.type] || '📋'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-ink-900 truncate">{n.title}</p>
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${sev.dot}`} />
                        </div>
                        <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-ink-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                    {/* Dismiss X button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClick({ ...n, link: null }); }}
                      className="px-2 py-3 text-ink-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ink-100 px-4 py-2.5 bg-ink-50/40 flex items-center justify-between">
            <span className="text-[10px] text-ink-400">Click to view · X to dismiss</span>
            <button
              onClick={() => { fetchNotifications(); }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────
// TOPBAR COMPONENT
// ─────────────────────────────────────────
const Topbar = ({ onMenuClick, onToggleCollapse, title }) => {
  const { user, logout, hasRole } = useAuth();
  const { timeoutMinutes, setTimeoutMinutes } = useSessionTimeout();
  const { language, isAmharic, toggleLanguage, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleNav = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const roleBadgeStyle = {
    admin: 'bg-amber-50 text-amber-800 border-amber-200',
    manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    storekeeper: 'bg-blue-50 text-blue-700 border-blue-200',
  }[user?.role || 'storekeeper'];

  return (
    <>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <header
        className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200/60 px-4 py-3 backdrop-blur-md shadow-sm sm:px-8"
        style={{ background: 'rgba(255,255,255,0.85)' }}
      >
        {/* Left: menu toggle + title */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 lg:hidden"
          >
            <Menu size={22} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center rounded-md p-1.5 text-ink-500 hover:bg-ink-100 transition"
            title="Toggle sidebar"
          >
            <Menu size={22} />
          </button>
          <div>
            <p className="text-xl font-bold text-ink-900">{title}</p>
            <p className="text-xs text-ink-500">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Right: session indicator + notifications + user menu */}
        <div className="flex items-center gap-2.5">
          {/* Session timeout indicator */}
          <div
            onClick={() => setMenuOpen(v => !v)}
            title={`Session Timeout: ${timeoutMinutes === 0 ? 'Disabled' : `Signs out after ${timeoutMinutes} minutes of inactivity`}`}
            className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 transition"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${timeoutMinutes === 0 ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
            <Clock size={12} className="text-slate-400" />
            <span className="text-[11px] font-medium text-slate-600">
              {timeoutMinutes === 0 ? t('topbar.timeoutOff') : `${t('topbar.autoLogout')}: ${timeoutMinutes}${t('topbar.minutes')}`}
            </span>
          </div>

          {/* Dual Language Switcher (EN | አማርኛ) - Crystal clear active indicator */}
          <div className="flex items-center rounded-full border border-ink-200/90 bg-white p-0.5 text-xs font-bold shadow-xs select-none">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-all ${!isAmharic
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'text-ink-500 hover:text-ink-900'
                }`}
              title="Switch to English"
            >
              <Globe size={11} className={!isAmharic ? 'text-white' : 'text-blue-600'} />
              <span>English</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('am')}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 transition-all ${isAmharic
                  ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                  : 'text-ink-500 hover:text-ink-900'
                }`}
              title="ወደ አማርኛ ቀይር"
            >
              <span>አማርኛ</span>
            </button>
          </div>

          {/* Notification Bell */}
          <NotificationBell />

          {/* User menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-2.5 rounded-full border border-ink-200/80 bg-white py-1 pl-1 pr-3 shadow-xs hover:border-ink-300 hover:bg-ink-50/60 transition"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name} className="h-8 w-8 rounded-full object-cover ring-1 ring-ink-200" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
                  {user?.name?.[0]?.toUpperCase()}
                </span>
              )}
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight text-ink-800">{user?.name}</p>
                <p className="text-[10px] capitalize leading-none text-ink-400">{user?.role}</p>
              </div>
              <ChevronDown size={14} className={`text-ink-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-ink-100 bg-white p-2 shadow-xl ring-1 ring-black/5 z-50">
                {/* Profile card */}
                <div className="rounded-xl bg-ink-50/70 p-3 mb-1">
                  <div className="flex items-center gap-2.5">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user?.name} className="h-9 w-9 rounded-xl object-cover ring-1 ring-ink-200" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm">
                        {user?.name?.[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 truncate">{user?.name}</p>
                      <p className="text-[11px] text-ink-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-ink-100/80 pt-2">
                    <span className="text-[10px] uppercase font-bold text-ink-400">Role</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold capitalize ${roleBadgeStyle}`}>
                      {user?.role}
                    </span>
                  </div>
                </div>

                {/* Nav items */}
                <div className="space-y-0.5 pt-1">
                  <button
                    onClick={() => handleNav('/settings?tab=profile')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                  >
                    <User size={15} className="text-ink-400" />
                    {t('topbar.myProfile')}
                  </button>
                  <button
                    onClick={() => handleNav('/settings?tab=security')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                  >
                    <Shield size={15} className="text-ink-400" />
                    {t('topbar.changePassword')}
                  </button>
                  {hasRole('admin') && (
                    <button
                      onClick={() => handleNav('/settings?tab=system')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                    >
                      <Building size={15} className="text-ink-400" />
                      {t('topbar.systemSettings')}
                    </button>
                  )}
                  <button
                    onClick={() => handleNav('/settings?tab=permissions')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                  >
                    <Layers size={15} className="text-ink-400" />
                    Role Privileges
                  </button>
                  {/* Help & Documentation */}
                  <button
                    onClick={() => { setMenuOpen(false); setHelpOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
                  >
                    <HelpCircle size={15} className="text-blue-500" />
                    {t('topbar.help')}
                  </button>
                </div>

                {/* Session timeout selector */}
                <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Clock size={13} className="text-blue-600" />
                      {t('topbar.autoLogout')}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                      {timeoutMinutes === 0 ? t('topbar.timeoutOff') : `${timeoutMinutes} min`}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                    Auto-signs out after idle time to secure workstation:
                  </p>
                  <select
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-[11px] font-medium text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value={1}>1 Minute (High Security)</option>
                    <option value={2}>2 Minutes (Default Policy)</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={0}>Never (Off)</option>
                  </select>
                </div>

                {/* Sign out */}
                <div className="mt-1 border-t border-ink-100 pt-1">
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut size={15} />
                    {t('topbar.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Topbar;
