import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, RefreshCw,
  UserCheck, UserX, Clock, Users, Building2, Phone, Mail, Calendar,
  ChevronDown,
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import WorkflowBadge from '../components/ui/WorkflowBadge';
import ExportDropdown from '../components/ui/ExportDropdown';
import Pagination from '../components/ui/Pagination';
import { useAuth } from '../context/AuthContext';

const DEPARTMENTS = [
  'Waiter', 'Kitchen', 'Food & Beverage', 'Front Office', 'Housekeeping',
  'Security', 'Maintenance', 'Finance & Accounting', 'Human Resources',
  'Sales & Marketing', 'Laundry', 'Management', 'Other',
];

const STATUS_CONFIG = {
  active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck },
  inactive: { label: 'Inactive', cls: 'bg-red-100 text-red-700 border-red-200', icon: UserX },
  on_leave: { label: 'On Leave', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
};

const emptyForm = {
  employeeId: '', firstName: '', lastName: '',
  department: 'Waiter', position: '', phone: '',
  email: '', hireDate: '', status: 'active', notes: '',
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

export default function Employees() {
  const { hasRole, canCrud } = useAuth();
  const canEdit = canCrud ? canCrud('employees', 'edit') : hasRole('admin', 'manager');
  const canDelete = canCrud ? canCrud('employees', 'delete') : hasRole('admin');

  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState('');

  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formErr, setFormErr] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /* ── load ── */
  const load = useCallback(async () => {
    setLoading(true); setLoadErr('');
    try {
      const params = {};
      if (filterDept) params.department = filterDept;
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/employees', { params });
      setEmployees(Array.isArray(res.data) ? res.data : []);
      setPage(1);
    } catch (e) {
      setLoadErr(e.response?.data?.message || 'Failed to load employees.');
    } finally { setLoading(false); }
  }, [filterDept, filterStatus]);

  useEffect(() => { load(); }, [load]);

  /* ── filtered ── */
  const filtered = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e =>
      e.firstName?.toLowerCase().includes(q) ||
      e.lastName?.toLowerCase().includes(q) ||
      e.employeeId?.toLowerCase().includes(q) ||
      e.position?.toLowerCase().includes(q) ||
      e.department?.toLowerCase().includes(q)
    );
  }, [employees, search]);

  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  /* ── stats ── */
  const stats = useMemo(() => ({
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
    onLeave: employees.filter(e => e.status === 'on_leave').length,
  }), [employees]);

  /* ── modal helpers ── */
  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setFormErr('');
    setModalOpen(true);
  };
  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      employeeId: emp.employeeId || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      department: emp.department || 'Kitchen',
      position: emp.position || '',
      phone: emp.phone || '',
      email: emp.email || '',
      hireDate: emp.hireDate ? new Date(emp.hireDate).toISOString().slice(0, 10) : '',
      status: emp.status || 'active',
      notes: emp.notes || '',
    });
    setFormErr('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true); setFormErr('');
    try {
      if (editing) {
        await api.put(`/employees/${editing._id}`, form);
      } else {
        await api.post('/employees', form);
      }
      setModalOpen(false);
      load();
      try {
        localStorage.setItem('baba_roti_employees_updated', Date.now().toString());
      } catch (_) { }
    } catch (err) {
      setFormErr(err.response?.data?.message || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/employees/${deleteId}`);
      setDeleteId(null);
      load();
      try {
        localStorage.setItem('baba_roti_employees_updated', Date.now().toString());
      } catch (_) { }
    } catch (err) {
      alert(err.response?.data?.message || 'Delete failed.');
    } finally { setDeleting(false); }
  };

  /* ── export data ── */
  const exportData = useMemo(() => employees.map(e => ({
    'Employee ID': e.employeeId || '—',
    'First Name': e.firstName,
    'Last Name': e.lastName,
    'Department': e.department,
    'Position': e.position || '—',
    'Phone': e.phone || '—',
    'Email': e.email || '—',
    'Hire Date': fmt(e.hireDate),
    'Status': STATUS_CONFIG[e.status]?.label || e.status,
  })), [employees]);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  /* ════ RENDER ════ */
  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900">Employee Management</h1>
          <p className="text-xs text-ink-400 mt-0.5">Register and manage hotel staff by department</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown
            data={exportData}
            fileName="employees"
            pdfTitle="Employee List"
            pdfColumns={[
              { header: 'ID', accessor: 'Employee ID' },
              { header: 'First Name', accessor: 'First Name' },
              { header: 'Last Name', accessor: 'Last Name' },
              { header: 'Department', accessor: 'Department' },
              { header: 'Position', accessor: 'Position' },
              { header: 'Phone', accessor: 'Phone' },
              { header: 'Status', accessor: 'Status', align: 'center' },
            ]}
          />
          {canEdit && (
            <button onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition">
              <Plus size={16} /> Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Stat cards (clickable filters) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { key: '', label: 'Total Staff', value: stats.total, icon: Users, cls: 'text-blue-600', bg: 'bg-blue-50', ring: 'ring-blue-500' },
          { key: 'active', label: 'Active', value: stats.active, icon: UserCheck, cls: 'text-emerald-600', bg: 'bg-emerald-50', ring: 'ring-emerald-500' },
          { key: 'inactive', label: 'Inactive', value: stats.inactive, icon: UserX, cls: 'text-red-600', bg: 'bg-red-50', ring: 'ring-red-500' },
          { key: 'on_leave', label: 'On Leave', value: stats.onLeave, icon: Clock, cls: 'text-amber-600', bg: 'bg-amber-50', ring: 'ring-amber-500' },
        ].map(({ key, label, value, icon: Icon, cls, bg, ring }) => {
          const isSelected = filterStatus === key;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setFilterStatus(isSelected && key !== '' ? '' : key)}
              className={`text-left rounded-xl border bg-white p-4 shadow-xs transition cursor-pointer hover:shadow-md ${isSelected
                  ? `border-transparent ring-2 ${ring} shadow-sm`
                  : 'border-ink-100 hover:border-ink-200'
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className={`h-9 w-9 rounded-lg ${bg} flex items-center justify-center ${cls}`}>
                    <Icon size={18} />
                  </span>
                  <div>
                    <p className="text-xs text-ink-500 font-medium">{label}</p>
                    <p className={`text-xl font-bold ${cls}`}>{value}</p>
                  </div>
                </div>
                {isSelected && (
                  <span className="text-[10px] font-bold text-blue-600 rounded-full bg-blue-50 px-2 py-0.5 border border-blue-200">
                    Active
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-300" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, ID, position…"
            className="rounded-lg border border-ink-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-500 w-52" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
          <option value="">All Departments</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="on_leave">On Leave</option>
        </select>
        {(filterDept || filterStatus || search) && (
          <button
            type="button"
            onClick={() => { setFilterDept(''); setFilterStatus(''); setSearch(''); }}
            className="text-xs text-ink-400 hover:text-ink-700 underline pl-1"
          >
            Reset
          </button>
        )}
        <button onClick={load} disabled={loading}
          className="rounded-lg border border-ink-200 p-2 text-ink-500 hover:bg-ink-50 transition ml-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Error */}
      {loadErr && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          ⚠ {loadErr}
          <button onClick={() => setLoadErr('')} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
            <thead style={{ background: 'linear-gradient(90deg,#1e3a8a 0%,#1d4ed8 50%,#2563eb 100%)' }}>
              <tr>
                {['ID', 'Name', 'Department', 'Position', 'Phone', 'Hire Date', 'Status', 'Actions'].map(h => (
                  <th key={h} className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100"
                    style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-ink-400">
                  <RefreshCw size={16} className="inline animate-spin mr-2" />Loading…
                </td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-ink-400">
                  No employees found. <span className="text-blue-600 cursor-pointer hover:underline" onClick={openCreate}>Add the first one →</span>
                </td></tr>
              )}
              {!loading && paginated.map(emp => {
                const st = STATUS_CONFIG[emp.status] || STATUS_CONFIG.active;
                const StIcon = st.icon;
                return (
                  <tr key={emp._id} className="hover:bg-blue-50/20 transition-colors" style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 whitespace-nowrap">{emp.employeeId || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-ink-900 text-xs">{emp.firstName} {emp.lastName}</p>
                          {emp.email && <p className="text-[10px] text-ink-400">{emp.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-700 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-100">
                        <Building2 size={10} /> {emp.department}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-600 whitespace-nowrap">{emp.position || '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{emp.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmt(emp.hireDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                        <StIcon size={10} /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {canEdit && (
                          <button onClick={() => openEdit(emp)}
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-600 px-2 py-1 text-xs font-semibold text-white transition">
                            <Pencil size={11} /> Edit
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => setDeleteId(emp._id)}
                            className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600 transition" title="Delete">
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
        <Pagination page={page} pageSize={pageSize} total={filtered.length}
          onPage={setPage} onPageSize={s => { setPageSize(s); setPage(1); }} />
      </div>

      {/* ══ Create / Edit Modal ══ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Employee' : 'Add New Employee'}
        width="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Row 1: First / Last name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">First Name *</label>
              <input required value={form.firstName} onChange={e => f('firstName', e.target.value)}
                placeholder="e.g. Abebe"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Last Name *</label>
              <input required value={form.lastName} onChange={e => f('lastName', e.target.value)}
                placeholder="e.g. Girma"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Row 2: ID / Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Employee ID
                <span className="ml-1 font-normal text-ink-400">(auto if blank)</span>
              </label>
              <input value={form.employeeId} onChange={e => f('employeeId', e.target.value)}
                placeholder="EMP-0001"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 font-mono" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Department *</label>
              <select required value={form.department} onChange={e => f('department', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* Row 3: Position / Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Position / Job Title</label>
              <input value={form.position} onChange={e => f('position', e.target.value)}
                placeholder="e.g. Chef, Waiter, Receptionist"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Status</label>
              <select value={form.status} onChange={e => f('status', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>

          {/* Row 4: Phone / Email */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                <Phone size={11} className="inline mr-1" />Phone
              </label>
              <input value={form.phone} onChange={e => f('phone', e.target.value)}
                placeholder="+251 91 234 5678"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                <Mail size={11} className="inline mr-1" />Email
              </label>
              <input type="email" value={form.email} onChange={e => f('email', e.target.value)}
                placeholder="abebe@hotel.com"
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Row 5: Hire date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                <Calendar size={11} className="inline mr-1" />Hire Date
              </label>
              <input type="date" value={form.hireDate} onChange={e => f('hireDate', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-ink-700 mb-1">Notes (optional)</label>
            <textarea rows={2} value={form.notes} onChange={e => f('notes', e.target.value)}
              placeholder="Any additional information…"
              className="w-full resize-none rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
          </div>

          {formErr && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <X size={13} /> {formErr}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setModalOpen(false)}
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50 transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition">
              {saving ? 'Saving…' : (editing ? 'Save Changes' : 'Add Employee')}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ Delete Confirmation ══ */}
      <Modal open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove Employee" width="max-w-sm">
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Are you sure you want to remove this employee? They will be soft-deleted and can be restored from the Recycle Bin.
          </p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setDeleteId(null)}
              className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
              Cancel
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition">
              {deleting ? 'Removing…' : 'Remove'}
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
