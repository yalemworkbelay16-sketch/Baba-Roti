import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Plus, Users as UsersIcon, Phone, Send, Pencil, X, Trash2, BellOff,
  Search, ShieldCheck, Camera, Upload, Check, Award, RefreshCw,
} from 'lucide-react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import Pagination from '../components/ui/Pagination';
import EmployeeIdBadgeModal from '../components/employee/EmployeeIdBadgeModal';
import { normalizeFileUrl } from '../utils/fileUrl';

const emptyForm = {
  name: '', email: '', password: '', role: 'storekeeper',
  phone: '', telegramChatId: '', photoUrl: '',
};

const roleColor = {
  admin: 'brass',
  manager: 'green',
  supervisor: 'blue',
  storekeeper: 'ink',
  cashier: 'emerald',
  waiter: 'purple',
  dev: 'amber',
};

const roleLabels = {
  admin: 'Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
  storekeeper: 'Store Keeper',
  cashier: 'Cashier',
  waiter: 'Waiter',
  dev: 'System Developer',
};

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 3x4 Photo upload state
  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadErr, setPhotoUploadErr] = useState('');

  // Digital ID Badge Modal state
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [badgeStaff, setBadgeStaff] = useState(null);
  const [isNewlyCreated, setIsNewlyCreated] = useState(false);

  const load = () => api.get('/users')
    .then((res) => {
      let list = Array.isArray(res.data) ? res.data : [];
      // Hide dev accounts from non-dev users
      if (currentUser?.role !== 'dev') {
        list = list.filter(u => u.role !== 'dev');
      }
      setUsers(list);
    })
    .catch(() => setUsers([]));

  useEffect(() => { load(); }, []);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [roleFilter, statusFilter, search]);

  const roleCounts = useMemo(() => {
    const counts = { all: users.length, active: 0, inactive: 0 };
    users.forEach(u => {
      counts[u.role] = (counts[u.role] || 0) + 1;
      if (u.isActive) counts.active++;
      else counts.inactive++;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (statusFilter === 'active' && !u.isActive) return false;
      if (statusFilter === 'inactive' && u.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        const matchName = u.name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchPhone = u.phone?.toLowerCase().includes(q);
        const matchRole = roleLabels[u.role]?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchRole) return false;
      }
      return true;
    });
  }, [users, roleFilter, statusFilter, search]);

  const openCreate = () => {
    setEditUser(null);
    setForm(emptyForm);
    setError('');
    setPhotoUploadErr('');
    setModalOpen(true);
  };

  const openEdit = (u) => {
    setEditUser(u);
    setForm({
      name: u.name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'storekeeper',
      phone: u.phone || '',
      telegramChatId: u.telegramChatId || '',
      photoUrl: u.photoUrl || u.avatar || '',
    });
    setError('');
    setPhotoUploadErr('');
    setModalOpen(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setPhotoUploadErr('Please select a valid image file (JPG, PNG, WEBP).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoUploadErr('Photo must be under 10MB.');
      return;
    }

    setUploadingPhoto(true);
    setPhotoUploadErr('');
    try {
      const formData = new FormData();
      formData.append('files', file);

      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const uploadedUrl = res.data?.files?.[0]?.url;
      if (uploadedUrl) {
        setForm(p => ({ ...p, photoUrl: uploadedUrl }));
      } else {
        setPhotoUploadErr('Upload failed. No file URL returned.');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      setPhotoUploadErr(err.response?.data?.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSaving(true);
    try {
      let savedStaff = null;
      if (editUser) {
        const payload = {
          name: form.name,
          role: form.role,
          phone: form.phone,
          telegramChatId: form.telegramChatId,
          photoUrl: form.photoUrl,
          avatar: form.photoUrl,
        };
        if (form.password) payload.password = form.password;
        const res = await api.put(`/users/${editUser._id}`, payload);
        savedStaff = res.data;
      } else {
        const res = await api.post('/auth/register', form);
        savedStaff = res.data;
      }
      setModalOpen(false);
      setForm(emptyForm);
      load();

      // Automatically present Digital ID Badge for staff account
      if (savedStaff) {
        setBadgeStaff(savedStaff);
        setIsNewlyCreated(!editUser);
        setBadgeModalOpen(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not save account.');
    } finally { setSaving(false); }
  };

  const toggleActive = async (u) => {
    const willDisable = u.isActive;
    if (willDisable) {
      if (!window.confirm(`Disable account for "${u.name}" (${u.email})?\n\nTheir login access will be deactivated and Telegram notifications will be automatically stopped.`)) {
        return;
      }
    }
    try {
      await api.put(`/users/${u._id}`, { isActive: !u.isActive });
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update account status.');
    }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete staff account for "${u.name}" (${u.email})?\n\nThis will remove their system access and automatically remove them from Telegram notifications permanently.`)) {
      return;
    }
    try {
      await api.delete(`/users/${u._id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not delete user account.');
    }
  };

  const paginated = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Staff Accounts</h1>
          <p className="text-xs text-ink-400 mt-0.5">{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-60">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-300" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search staff accounts…"
              className="w-full rounded-lg border border-ink-200 py-1.5 pl-9 pr-3 text-xs outline-none focus:border-blue-500 shadow-2xs"
            />
          </div>
          <Button variant="brass" onClick={openCreate}>
            <Plus size={16} /> Add staff account
          </Button>
        </div>
      </div>

      {/* Quick Role & Status Filter Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 rounded-xl border border-ink-100 bg-white p-3 shadow-2xs">
        {/* Role Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRoleFilter('all')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${roleFilter === 'all'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
          >
            <UsersIcon size={13} className={roleFilter === 'all' ? 'text-white' : 'text-blue-600'} />
            <span>All Staff</span>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${roleFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
              {users.length}
            </span>
          </button>

          {['admin', 'manager', 'supervisor', 'storekeeper', 'cashier', 'waiter'].map((r) => {
            if (!roleCounts[r]) return null;
            const isActive = roleFilter === r;
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(isActive ? 'all' : r)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${isActive
                  ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-400/40'
                  : 'bg-blue-50 text-blue-800 border border-blue-200/80 hover:bg-blue-100'
                  }`}
              >
                <span>{roleLabels[r] || r}</span>
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${isActive ? 'bg-white/25 text-white' : 'bg-blue-200 text-blue-900'
                  }`}>
                  {roleCounts[r]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2 text-xs text-ink-600 self-end sm:self-auto">
          <span className="font-medium text-ink-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-700 outline-none focus:border-blue-500 shadow-2xs"
          >
            <option value="all">All ({users.length})</option>
            <option value="active">Active ({roleCounts.active || 0})</option>
            <option value="inactive">Disabled ({roleCounts.inactive || 0})</option>
          </select>
          {(roleFilter !== 'all' || statusFilter !== 'all' || search) && (
            <button
              type="button"
              onClick={() => { setRoleFilter('all'); setStatusFilter('all'); setSearch(''); }}
              className="text-xs text-ink-400 hover:text-ink-700 underline pl-1"
              title="Reset filters"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(90deg,#1e3a8a 0%,#1d4ed8 50%,#2563eb 100%)' }}>
              <tr>
                {['Name', 'Email', 'Phone', 'Telegram', 'Role', 'Status', 'Actions'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100"
                    style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-400">
                    {roleFilter !== 'all' || statusFilter !== 'all' || search
                      ? 'No staff accounts match your filters.'
                      : 'No accounts yet.'}
                  </td>
                </tr>
              )}
              {paginated.map(u => (
                <tr key={u._id} className="hover:bg-blue-50/20 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200 bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 shadow-2xs">
                        {u.photoUrl || u.avatar ? (
                          <img
                            src={normalizeFileUrl(u.photoUrl || u.avatar)}
                            alt={u.name}
                            className="h-full w-full object-cover"
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          <span>{u.name?.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-ink-900 text-xs">{u.name}</p>
                        <p className="text-[10px] text-ink-400 font-mono">STAFF-{u._id?.slice(-4).toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{u.email}</td>
                  <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">
                    {u.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={11} className="text-ink-400" /> {u.phone}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {!u.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500" title="Notifications stopped because account is disabled">
                        <BellOff size={9} /> Stopped (Disabled)
                      </span>
                    ) : u.telegramChatId ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
                        <Send size={9} /> Subscribed
                      </span>
                    ) : (
                      <span className="text-xs text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge color={roleColor[u.role] || 'ink'}>{roleLabels[u.role] || u.role}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Badge color={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Disabled'}</Badge>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setBadgeStaff(u);
                          setIsNewlyCreated(false);
                          setBadgeModalOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-xs font-semibold text-white transition shadow-2xs"
                        title="View & Print Digital Staff ID Badge"
                      >
                        <Award size={12} /> ID Badge
                      </button>
                      <button onClick={() => openEdit(u)}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 px-2 py-1 text-xs font-semibold text-white transition">
                        <Pencil size={11} /> Edit
                      </button>
                      <button onClick={() => toggleActive(u)}
                        className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-semibold transition border ${u.isActive
                          ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          }`}>
                        {u.isActive ? 'Disable' : 'Enable'}
                      </button>
                      {u.role !== 'dev' && currentUser?._id !== u._id && (
                        <button onClick={() => handleDelete(u)}
                          className="inline-flex items-center rounded-lg p-1 text-ink-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition"
                          title="Delete staff account">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pageSize={pageSize} total={filteredUsers.length}
          onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
      </div>

      {/* ── Modal ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editUser ? `Edit — ${editUser.name}` : 'Add Staff Account'}
        width="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600">
              <X size={13} /> {error}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Full Name *</label>
            <input required value={form.name} onChange={e => f('name', e.target.value)}
              placeholder="e.g. Abebe Girma"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700">Email *</label>
            <input type="email" required={!editUser} value={form.email}
              onChange={e => f('email', e.target.value)}
              disabled={!!editUser}
              placeholder="abebe@hotel.com"
              className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:bg-ink-50 disabled:text-ink-400" />
          </div>

          {/* Phone + Telegram */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                <Phone size={11} className="inline mr-1" />Phone Number
              </label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)}
                placeholder="+251 91 234 5678"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                <Send size={11} className="inline mr-1 text-sky-500" />Telegram Chat ID
              </label>
              <input value={form.telegramChatId} onChange={e => f('telegramChatId', e.target.value)}
                placeholder="e.g. 123456789"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
              <p className="text-[10px] text-ink-400 mt-0.5">Get from @userinfobot on Telegram</p>
            </div>
          </div>

          {/* Role + Password */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">Role *</label>
              <select value={form.role} onChange={e => f('role', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                <option value="storekeeper">Store Keeper</option>
                <option value="cashier">Cashier</option>
                <option value="waiter">Waiter (POS Mobile Order)</option>
                <option value="supervisor">Supervisor</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {/* Dev option only visible to system owner */}
                {currentUser?.role === 'dev' && (
                  <option value="dev">🔒 System Developer (Owner)</option>
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-700">
                {editUser ? 'New Password (leave blank to keep)' : 'Temporary Password *'}
              </label>
              <input type="text" required={!editUser} minLength={6}
                value={form.password} onChange={e => f('password', e.target.value)}
                placeholder={editUser ? '••••••' : 'min 6 chars'}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* 3x4 Passport Photo Upload for Staff Account */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-700 flex items-center justify-between">
              <span>
                <Camera size={11} className="inline mr-1 text-blue-600" />
                3×4 Passport Photo
              </span>
              {form.photoUrl && (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                  <Check size={10} /> Photo ready
                </span>
              )}
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/jpg"
              className="hidden"
              onChange={handlePhotoUpload}
            />

            {form.photoUrl ? (
              <div className="flex items-center gap-2.5 p-2 rounded-xl border border-blue-200 bg-blue-50/40">
                <div
                  className="relative rounded-lg overflow-hidden border border-blue-300 shadow-xs bg-white shrink-0"
                  style={{ width: '45px', height: '60px' }} // Exact 3:4 passport aspect ratio
                >
                  <img
                    src={normalizeFileUrl(form.photoUrl)}
                    alt="Staff 3x4"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                    3×4 Photo Linked
                  </span>
                  <p className="text-[11px] text-ink-500 truncate mt-0.5">Ready for Digital Staff ID Pass</p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Change
                    </button>
                    <span className="text-ink-300">·</span>
                    <button
                      type="button"
                      onClick={() => f('photoUrl', '')}
                      disabled={uploadingPhoto}
                      className="text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => !uploadingPhoto && fileInputRef.current?.click()}
                className={`w-full rounded-xl border-2 border-dashed px-3 py-2 text-center cursor-pointer transition flex items-center justify-center gap-2.5 ${uploadingPhoto
                    ? 'border-blue-400 bg-blue-50/60 cursor-wait'
                    : 'border-ink-200 hover:border-blue-400 hover:bg-blue-50/20 bg-ink-50/30'
                  }`}
                style={{ minHeight: '60px' }}
              >
                {uploadingPhoto ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-blue-600">
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Uploading 3×4 photo…</span>
                  </div>
                ) : (
                  <>
                    <div className="h-8 w-6 rounded border border-ink-300 bg-white shadow-2xs flex items-center justify-center text-ink-400 shrink-0">
                      <Camera size={13} className="text-blue-600" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="text-xs font-semibold text-ink-700 leading-tight">
                        Upload 3×4 Photo
                      </div>
                      <div className="text-[10px] text-ink-400 leading-tight">
                        Passport size (JPG, PNG) for Staff ID Pass
                      </div>
                    </div>
                    <Upload size={13} className="text-ink-400 shrink-0" />
                  </>
                )}
              </div>
            )}

            {photoUploadErr && (
              <p className="text-[10px] text-red-600 mt-1">⚠ {photoUploadErr}</p>
            )}
          </div>

          {form.telegramChatId && (
            <div className="rounded-lg bg-sky-50 border border-sky-200 px-3 py-2 text-xs text-sky-800">
              <Send size={11} className="inline mr-1" />
              This Chat ID will be automatically subscribed to Telegram notifications.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" variant="brass" disabled={saving}>
              {saving ? 'Saving…' : (editUser ? 'Save Changes' : 'Create Account')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ══ Digital Staff ID Badge Modal ══ */}
      <EmployeeIdBadgeModal
        open={badgeModalOpen}
        onClose={() => setBadgeModalOpen(false)}
        employee={badgeStaff}
        onEdit={(staff) => {
          setBadgeModalOpen(false);
          openEdit(staff);
        }}
        isNewlyCreated={isNewlyCreated}
      />
    </div>
  );
};

export default Users;
