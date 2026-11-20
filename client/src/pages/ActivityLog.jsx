import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Activity, Search, RefreshCw, Filter, Calendar, Download,
  Monitor, Smartphone, Laptop, Globe, User, Shield, CheckCircle2,
  AlertTriangle, XCircle, Clock, ArrowRight, Zap, LogIn, LogOut,
  PackageCheck, Inbox, FileText, Database, Settings as SettingsIcon,
  Users as UsersIcon, ChevronLeft, ChevronRight, X, Cpu, Wifi, WifiOff,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';

const ACTION_CONFIG = {
  LOGIN:            { label: 'Login',            color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: LogIn },
  LOGOUT:           { label: 'Logout',           color: 'bg-slate-100 text-slate-700 border-slate-200',      icon: LogOut },
  LOGIN_FAILED:     { label: 'Login Failed',     color: 'bg-rose-50 text-rose-700 border-rose-200',          icon: XCircle },
  REGISTER_USER:    { label: 'User Created',     color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: UsersIcon },
  UPDATE_USER:      { label: 'User Updated',     color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: UsersIcon },
  DEACTIVATE_USER:  { label: 'User Deactivated', color: 'bg-rose-50 text-rose-700 border-rose-200',          icon: AlertTriangle },
  REACTIVATE_USER:  { label: 'User Activated',   color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  DELETE_USER:      { label: 'User Deleted',     color: 'bg-red-50 text-red-700 border-red-200',             icon: XCircle },
  STOCK_REQUEST:    { label: 'Stock Request',    color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Inbox },
  DIRECT_ISSUE:     { label: 'Direct Issue',     color: 'bg-purple-50 text-purple-700 border-purple-200',    icon: Zap },
  APPROVE_REQUEST:  { label: 'Request Approved', color: 'bg-blue-50 text-blue-700 border-blue-200',         icon: CheckCircle2 },
  ISSUE_STOCK:      { label: 'Stock Issued',     color: 'bg-teal-50 text-teal-700 border-teal-200',          icon: PackageCheck },
  REJECT_REQUEST:   { label: 'Request Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200',         icon: XCircle },
  VERIFY_PASSWORD:  { label: 'Password Verified',color: 'bg-indigo-50 text-indigo-700 border-indigo-200',   icon: Shield },
  CREATE_MATERIAL:  { label: 'Material Created', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: Database },
  UPDATE_MATERIAL:  { label: 'Material Updated', color: 'bg-amber-50 text-amber-700 border-amber-200',       icon: Database },
  TRANSFER_STOCK:   { label: 'Stock Transfer',   color: 'bg-blue-50 text-blue-700 border-blue-200',          icon: Activity },
};

const MODULE_OPTIONS = [
  'All Modules',
  'Auth',
  'StockRequests',
  'Users',
  'RawMaterials',
  'Transactions',
  'Settings',
  'POS',
  'Employees',
];

const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '—';
  const diff = Date.now() - new Date(timestamp).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  return `${days}d ago`;
};

export default function ActivityLog() {
  const { user } = useAuth();

  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Summary stats
  const [summary, setSummary] = useState({
    totalToday: 0,
    uniqueIpsToday: 0,
    loginsToday: 0,
    onlineUsersCount: 0,
  });

  // Online users list
  const [onlineUsers, setOnlineUsers] = useState([]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState('All Modules');
  const [selectedAction, setSelectedAction] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Fetch summary and online users
  const fetchOverview = useCallback(async () => {
    try {
      const [sumRes, onlineRes] = await Promise.all([
        api.get('/activity-log/summary'),
        api.get('/activity-log/online-users'),
      ]);
      setSummary(sumRes.data || {});
      setOnlineUsers(onlineRes.data || []);
    } catch (err) {
      console.warn('Failed to fetch activity overview', err);
    }
  }, []);

  // Fetch paginated logs
  const fetchLogs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {
        page,
        limit: 50,
      };
      if (search.trim()) params.search = search.trim();
      if (selectedModule && selectedModule !== 'All Modules') params.module = selectedModule;
      if (selectedAction && selectedAction !== 'all') params.action = selectedAction;
      if (selectedStatus && selectedStatus !== 'all') params.status = selectedStatus;
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await api.get('/activity-log', { params });
      setLogs(res.data?.logs || []);
      setTotal(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch activity logs', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, search, selectedModule, selectedAction, selectedStatus, fromDate, toDate]);

  useEffect(() => {
    fetchLogs();
    fetchOverview();
  }, [fetchLogs, fetchOverview]);

  // Auto-refresh interval (every 15 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchLogs(true);
      fetchOverview();
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchLogs, fetchOverview]);

  // Export to CSV
  const handleExportCSV = () => {
    if (!logs.length) return;
    const headers = ['Timestamp', 'User', 'Role', 'Department', 'Action', 'Module', 'Description', 'Machine IP', 'Device', 'Status'];
    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString(),
      `"${l.userName || ''}"`,
      l.userRole || '',
      l.userDepartment || '',
      l.action || '',
      l.module || '',
      `"${(l.description || '').replace(/"/g, '""')}"`,
      `"${l.ip || ''}"`,
      `"${l.device || ''}"`,
      l.status || '',
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `activity_log_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-700 text-white shadow-md">
              <Activity size={20} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-ink-900 flex items-center gap-2">
                Activity &amp; Audit Log
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Live Monitor
                </span>
              </h1>
              <p className="text-xs text-ink-500 mt-0.5">
                Track which user did what, machine IP addresses, device info, and real-time online status
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-semibold text-ink-700 cursor-pointer hover:bg-ink-50 transition shadow-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={e => setAutoRefresh(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            Auto-refresh (15s)
          </label>

          <button
            onClick={() => { fetchLogs(true); fetchOverview(); }}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 py-2 text-xs font-semibold text-ink-700 hover:bg-ink-50 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin text-blue-600' : ''} />
            Refresh
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!logs.length}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Card 1: Online Users */}
        <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 p-4 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Users Online Now</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Wifi size={15} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-950">{summary.onlineUsersCount || 0}</span>
            <span className="text-xs font-bold text-emerald-700">active sessions</span>
          </div>
          <p className="text-[11px] text-emerald-700/80 mt-1">Logged in within last 15 mins</p>
        </div>

        {/* Card 2: Today's Total Activities */}
        <div className="rounded-3xl border border-blue-200 bg-gradient-to-br from-blue-50/80 via-white to-blue-50/30 p-4 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Total Activities Today</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Activity size={15} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-950">{summary.totalToday || 0}</span>
            <span className="text-xs font-bold text-blue-700">actions logged</span>
          </div>
          <p className="text-[11px] text-blue-700/80 mt-1">Real-time audit events</p>
        </div>

        {/* Card 3: Unique Machine IPs */}
        <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-indigo-50/30 p-4 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">Unique Machine IPs</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Cpu size={15} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-950">{summary.uniqueIpsToday || 0}</span>
            <span className="text-xs font-bold text-indigo-700">machines connected</span>
          </div>
          <p className="text-[11px] text-indigo-700/80 mt-1">Distinct IP addresses today</p>
        </div>

        {/* Card 4: Logins Today */}
        <div className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/30 p-4 shadow-soft">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">Logins Today</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
              <LogIn size={15} />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-amber-950">{summary.loginsToday || 0}</span>
            <span className="text-xs font-bold text-amber-700">login events</span>
          </div>
          <p className="text-[11px] text-amber-700/80 mt-1">Authenticated user logins</p>
        </div>
      </div>

      {/* ── Real-Time Online Users Banner ── */}
      <div className="rounded-3xl border border-emerald-200/90 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-emerald-50/90 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-950">
              Live Online Users ({onlineUsers.length})
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full">
            Active within 15 minutes
          </span>
        </div>

        {onlineUsers.length === 0 ? (
          <p className="text-xs text-emerald-800/80 italic">No staff users currently active.</p>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-thin">
            {onlineUsers.map(u => (
              <div
                key={u._id}
                className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-white px-3 py-2 shadow-xs flex-shrink-0"
              >
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase shadow-2xs">
                    {u.avatar || u.photoUrl ? (
                      <img src={u.avatar || u.photoUrl} alt="" className="h-full w-full rounded-xl object-cover" />
                    ) : (
                      (u.name || 'U').slice(0, 2)
                    )}
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-ink-900 leading-tight">{u.name}</p>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 uppercase">
                      {u.role}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-ink-500 mt-0.5">
                    <span className="font-mono text-blue-700 font-semibold">{u.lastLoginIp || 'IP —'}</span>
                    <span>•</span>
                    <span className="text-ink-400 truncate max-w-[120px]" title={u.lastLoginDevice || ''}>{u.lastLoginDevice || 'Desktop'}</span>
                    <span>•</span>
                    <span className="text-emerald-700 font-medium">{formatRelativeTime(u.lastActiveAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Filters Card ── */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/50 px-3 py-2 flex-1 min-w-[240px]">
            <Search size={14} className="text-ink-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search user, action, description, machine IP, or device..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="flex-1 bg-transparent text-xs outline-none text-ink-900 placeholder-ink-400"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(1); }}>
                <X size={13} className="text-ink-400 hover:text-ink-600" />
              </button>
            )}
          </div>

          {/* Module Filter */}
          <select
            value={selectedModule}
            onChange={e => { setSelectedModule(e.target.value); setPage(1); }}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none focus:border-blue-500"
          >
            {MODULE_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          {/* Action Filter */}
          <select
            value={selectedAction}
            onChange={e => { setSelectedAction(e.target.value); setPage(1); }}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Actions</option>
            <option value="LOGIN">Login</option>
            <option value="LOGOUT">Logout</option>
            <option value="STOCK_REQUEST">Stock Request</option>
            <option value="DIRECT_ISSUE">Direct Issue</option>
            <option value="APPROVE_REQUEST">Approve Request</option>
            <option value="ISSUE_STOCK">Issue Stock</option>
            <option value="REJECT_REQUEST">Reject Request</option>
            <option value="REGISTER_USER">User Created</option>
            <option value="UPDATE_USER">User Updated</option>
            <option value="DELETE_USER">User Deleted</option>
            <option value="VERIFY_PASSWORD">Password Verified</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
            className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs font-medium text-ink-700 outline-none focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="failed">Failed</option>
          </select>

          {/* Date Filter */}
          <div className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-700">
            <Calendar size={13} className="text-ink-400" />
            <input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setPage(1); }}
              className="outline-none text-[11px] bg-transparent"
              title="From Date"
            />
            <span className="text-ink-300">to</span>
            <input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setPage(1); }}
              className="outline-none text-[11px] bg-transparent"
              title="To Date"
            />
          </div>

          {/* Clear button */}
          {(search || selectedModule !== 'All Modules' || selectedAction !== 'all' || selectedStatus !== 'all' || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedModule('All Modules');
                setSelectedAction('all');
                setSelectedStatus('all');
                setFromDate('');
                setToDate('');
                setPage(1);
              }}
              className="text-xs font-bold text-rose-600 hover:text-rose-800 transition"
            >
              Clear filters
            </button>
          )}

          <span className="text-xs font-semibold text-ink-400 ml-auto">
            {total} log record{total !== 1 ? 's' : ''}
          </span>
        </div>
      </Card>

      {/* ── Activity Table ── */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-4 animate-pulse">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-14 bg-ink-100 rounded-xl" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center">
            <Activity size={38} className="mx-auto mb-3 text-ink-300" />
            <p className="text-sm font-bold text-ink-700">No activity logs found</p>
            <p className="text-xs text-ink-400 mt-1">Try clearing or adjusting your search filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60">
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">User &amp; Department</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">Action</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">Activity Description</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">Machine IP</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">Device &amp; OS</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">Timestamp</th>
                  <th className="px-4 py-3 text-left font-bold uppercase tracking-wider text-ink-400 text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100/70">
                {logs.map((log) => {
                  const actionCfg = ACTION_CONFIG[log.action] || {
                    label: log.action,
                    color: 'bg-ink-100 text-ink-700 border-ink-200',
                    icon: Activity,
                  };
                  const ActionIcon = actionCfg.icon;

                  return (
                    <tr key={log._id} className="hover:bg-ink-50/40 transition group">
                      {/* User */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-[11px] uppercase shadow-2xs">
                            {(log.userName || 'U').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-bold text-ink-900 leading-tight">{log.userName || 'System'}</div>
                            <div className="flex items-center gap-1.5 text-[10px] text-ink-500 mt-0.5">
                              <span className="capitalize font-semibold text-blue-700">{log.userRole || 'guest'}</span>
                              {log.userDepartment && (
                                <>
                                  <span>•</span>
                                  <span>{log.userDepartment}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${actionCfg.color}`}>
                          <ActionIcon size={11} />
                          {actionCfg.label}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink-900 max-w-md line-clamp-2 leading-relaxed">
                          {log.description}
                        </div>
                        {log.module && (
                          <span className="text-[9.5px] font-semibold text-ink-400 mt-0.5 block">
                            Module: {log.module}
                          </span>
                        )}
                      </td>

                      {/* Machine IP */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200/80 px-2.5 py-1 rounded-lg">
                          <Wifi size={10} className="text-blue-500" />
                          {log.ip || '127.0.0.1'}
                        </span>
                      </td>

                      {/* Device & OS */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-ink-700 font-medium">
                          {log.device?.toLowerCase().includes('mobile') || log.device?.toLowerCase().includes('android') || log.device?.toLowerCase().includes('iphone') ? (
                            <Smartphone size={13} className="text-ink-400" />
                          ) : (
                            <Laptop size={13} className="text-ink-400" />
                          )}
                          <span className="truncate max-w-[160px]" title={log.device || log.userAgent}>
                            {log.device || 'Desktop'}
                          </span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-semibold text-ink-800">
                          {formatRelativeTime(log.createdAt)}
                        </div>
                        <div className="text-[10px] text-ink-400 mt-0.5">
                          {new Date(log.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {log.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={11} /> Success
                          </span>
                        ) : log.status === 'warning' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                            <AlertTriangle size={11} /> Warning
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                            <XCircle size={11} /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-ink-100 px-6 py-3.5 bg-ink-50/40">
            <span className="text-xs font-semibold text-ink-500">
              Page {page} of {totalPages} ({total} records)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40 transition shadow-2xs"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-200 bg-white text-ink-700 hover:bg-ink-50 disabled:opacity-40 transition shadow-2xs"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
