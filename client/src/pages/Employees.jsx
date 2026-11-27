import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Plus, Search, Pencil, Trash2, X, RefreshCw,
  UserCheck, UserX, Clock, Users, Building2, Phone, Mail, Calendar,
  ChevronDown, Camera, Upload, Check, Award, UtensilsCrossed, Eye, Ban,
} from 'lucide-react';
import api from '../api/axios';
import Modal from '../components/ui/Modal';
import WorkflowBadge from '../components/ui/WorkflowBadge';
import ExportDropdown from '../components/ui/ExportDropdown';
import Pagination from '../components/ui/Pagination';
import EmployeeIdBadgeModal from '../components/employee/EmployeeIdBadgeModal';
import SearchableSelect from '../components/ui/SearchableSelect';
import RecordAuditTrail from '../components/common/RecordAuditTrail';
import { normalizeFileUrl } from '../utils/fileUrl';
import { useAuth } from '../context/AuthContext';
import useHighlightRow from '../hooks/useHighlightRow';

const DEPARTMENTS = [
  'Bar', 'Kitchen', 'Main Store', 'Waiter', 'Dining & Service', 'Cashier & Billing',
  'Food & Beverage', 'Finance', 'Finance & Accounting', 'Purchasing & Procurement',
  'Front Office', 'Housekeeping', 'Security', 'Maintenance', 'Human Resources',
  'Sales & Marketing', 'Laundry', 'Restaurant', 'Management', 'Other',
];

const STATUS_CONFIG = {
  active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: UserCheck },
  inactive: { label: 'Inactive', cls: 'bg-red-100 text-red-700 border-red-200', icon: UserX },
  on_leave: { label: 'On Leave', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Clock },
};

const emptyForm = {
  employeeId: '', firstName: '', lastName: '',
  department: 'Waiter', assignedStation: 'all', position: '', phone: '',
  email: '', hireDate: '', status: 'active', notes: '',
  photoUrl: '', mealsDisabled: false, allowedProducts: [],
};

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' }) : '—';

export default function Employees() {
  const { hasRole, canCrud, allDepartments = [], allStations = [], getStationLabel, matchStationForDepartment } = useAuth();
  const mergedDepartments = useMemo(() => {
    const labels = allDepartments.length > 0 ? allDepartments.map(d => d.label) : DEPARTMENTS;
    return labels;
  }, [allDepartments]);
  const canEdit = canCrud ? canCrud('employees', 'edit') : hasRole('admin', 'manager', 'operation_manager');
  const canDelete = canCrud ? canCrud('employees', 'delete') : hasRole('admin');

  const [employees, setEmployees] = useState([]);
  const [products, setProducts] = useState([]);
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

  // 3x4 Photo upload state
  const fileInputRef = useRef(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadErr, setPhotoUploadErr] = useState('');

  // Digital ID Badge Modal state
  const [badgeModalOpen, setBadgeModalOpen] = useState(false);
  const [badgeEmployee, setBadgeEmployee] = useState(null);
  const [isNewlyCreated, setIsNewlyCreated] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailEmp, setDetailEmp] = useState(null);

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
  useEffect(() => {
    api.get('/products')
      .then(r => setProducts(Array.isArray(r.data) ? r.data : []))
      .catch(() => setProducts([]));
  }, []);

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

  const { setRowRef, rowClass } = useHighlightRow({
    items: employees,
    displayed: filtered,
    pageSize,
    setPage,
    onEnsureVisible: () => { setFilterStatus(''); setSearch(''); },
  });

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
    setPhotoUploadErr('');
    setModalOpen(true);
  };
  const openEdit = (emp) => {
    setEditing(emp);
    setForm({
      employeeId: emp.employeeId || '',
      firstName: emp.firstName || '',
      lastName: emp.lastName || '',
      department: emp.department || 'Kitchen',
      assignedStation: emp.assignedStation || 'all',
      position: emp.position || '',
      phone: emp.phone || '',
      email: emp.email || '',
      hireDate: emp.hireDate ? new Date(emp.hireDate).toISOString().slice(0, 10) : '',
      status: emp.status || 'active',
      notes: emp.notes || '',
      photoUrl: emp.photoUrl || '',
      mealsDisabled: Boolean(emp.mealsDisabled),
      allowedProducts: Array.isArray(emp.allowedProducts)
        ? emp.allowedProducts.map(p => (typeof p === 'object' && p !== null ? p._id : p))
        : [],
    });
    setFormErr('');
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
    setSaving(true); setFormErr('');
    try {
      let savedEmp = null;
      if (editing) {
        const res = await api.put(`/employees/${editing._id}`, form);
        savedEmp = res.data;
      } else {
        const res = await api.post('/employees', form);
        savedEmp = res.data;
      }
      setModalOpen(false);
      load();
      try {
        localStorage.setItem('baba_roti_employees_updated', Date.now().toString());
      } catch (_) { }

      // Auto-open Digital ID Badge for the registered / updated employee
      if (savedEmp) {
        setBadgeEmployee(savedEmp);
        setIsNewlyCreated(!editing);
        setBadgeModalOpen(true);
      }
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
          {mergedDepartments.map(d => <option key={d} value={d}>{d}</option>)}
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
                  <tr key={emp._id} ref={setRowRef(emp)} className={rowClass(emp, 'hover:bg-blue-50/20 transition-colors')} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="px-4 py-3 font-mono text-xs text-blue-600 whitespace-nowrap">{emp.employeeId || '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full overflow-hidden border border-slate-200 bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 shadow-2xs">
                          {emp.photoUrl ? (
                            <img
                              src={normalizeFileUrl(emp.photoUrl)}
                              alt={emp.firstName}
                              className="h-full w-full object-cover"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <span>{emp.firstName?.[0]}{emp.lastName?.[0]}</span>
                          )}
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
                    <td className="px-4 py-3 text-xs text-ink-600 whitespace-nowrap">
                      <div>{emp.position || '—'}</div>
                      {emp.mealsDisabled ? (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-md mt-0.5">
                          <Ban size={9} className="text-red-600" />
                          <span>Not allowed all meals</span>
                        </div>
                      ) : Array.isArray(emp.allowedProducts) && emp.allowedProducts.length > 0 ? (
                        <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md mt-0.5" title={emp.allowedProducts.map(p => (p && typeof p === 'object' ? p.name : p)).filter(Boolean).join(', ')}>
                          <UtensilsCrossed size={9} className="text-amber-600" />
                          <span>{emp.allowedProducts.length} meals restricted</span>
                        </div>
                      ) : (
                        <div className="text-[9.5px] text-emerald-600 font-medium">All meals allowed</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{emp.phone || '—'}</td>
                    <td className="px-4 py-3 text-xs text-ink-500 whitespace-nowrap">{fmt(emp.hireDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                        <StIcon size={10} /> {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => { setDetailEmp(emp); setDetailOpen(true); }}
                          className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 hover:text-blue-800 transition cursor-pointer"
                          title="View employee & security audit details"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setBadgeEmployee(emp);
                            setIsNewlyCreated(false);
                            setBadgeModalOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 px-2.5 py-1 text-xs font-semibold text-white transition shadow-2xs"
                          title="View & Print Digital Staff ID Badge"
                        >
                          <Award size={12} /> ID Badge
                        </button>
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

          {/* Row 2: ID / Department / Assigned Station */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
              <select
                required
                value={form.department}
                onChange={e => {
                  const dept = e.target.value;
                  const matchedSt = matchStationForDepartment ? matchStationForDepartment(dept) : 'all';
                  setForm(prev => ({ ...prev, department: dept, assignedStation: matchedSt }));
                }}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
              >
                {mergedDepartments.map(d => <option key={d} value={d}>{d}</option>)}
                {form.department && !mergedDepartments.some(d => d.toLowerCase() === String(form.department).toLowerCase()) && (
                  <option value={form.department}>{form.department}</option>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">Assigned Station</label>
              <select
                value={form.assignedStation || 'all'}
                onChange={e => f('assignedStation', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500 bg-white"
              >
                {(allStations.length > 0
                  ? allStations
                  : [
                      { key: 'all', shortLabel: 'All Stations' },
                      { key: 'kitchen', shortLabel: 'Kitchen Station' },
                      { key: 'bar', shortLabel: 'Bar Station' },
                      { key: 'main', shortLabel: 'Main Store' },
                    ]
                ).map(st => (
                  <option key={st.key} value={st.key}>{st.shortLabel || st.label}</option>
                ))}
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

          {/* Row 5: Hire date & 3x4 Photo Upload */}
          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1">
                <Calendar size={11} className="inline mr-1" />Hire Date
              </label>
              <input type="date" value={form.hireDate} onChange={e => f('hireDate', e.target.value)}
                className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm outline-none focus:border-blue-500" />
            </div>

            {/* 3x4 Photo Upload (matches user red-box position) */}
            <div>
              <label className="block text-xs font-semibold text-ink-700 mb-1 flex items-center justify-between">
                <span>
                  <Camera size={11} className="inline mr-1 text-blue-600" />
                  3×4 Passport Photo
                </span>
                {form.photoUrl && (
                  <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                    <Check size={10} /> Ready
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
                  {/* 3:4 aspect ratio preview thumbnail */}
                  <div
                    className="relative rounded-lg overflow-hidden border border-blue-300 shadow-xs bg-white shrink-0"
                    style={{ width: '45px', height: '60px' }} // 3:4 aspect ratio
                  >
                    <img
                      src={normalizeFileUrl(form.photoUrl)}
                      alt="3x4 Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">
                      3×4 Photo
                    </span>
                    <p className="text-[11px] text-ink-500 truncate mt-0.5">Ready for Digital ID</p>
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
                          Passport size (JPG, PNG)
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
          </div>

          {/* Allowed Staff Meal Products Quota */}
          <div className={`rounded-xl border p-3 space-y-2 ${form.mealsDisabled
            ? 'border-red-300 bg-red-50/50'
            : 'border-amber-200/90 bg-amber-50/40'
            }`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className={`text-xs font-bold flex items-center gap-1.5 ${form.mealsDisabled ? 'text-red-900' : 'text-amber-950'}`}>
                {form.mealsDisabled
                  ? <Ban size={14} className="text-red-600" />
                  : <UtensilsCrossed size={14} className="text-amber-600" />}
                Allowed Staff Meal Products
              </label>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold ${form.mealsDisabled ? 'text-red-700' : 'text-amber-800'}`}>
                  {form.mealsDisabled
                    ? 'Not Allowed All Meals'
                    : form.allowedProducts?.length > 0
                      ? `${form.allowedProducts.length} items allowed`
                      : 'All Menu Items Allowed'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (form.mealsDisabled) {
                      f('mealsDisabled', false);
                    } else {
                      setForm(prev => ({ ...prev, mealsDisabled: true, allowedProducts: [] }));
                    }
                  }}
                  className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold border transition cursor-pointer ${form.mealsDisabled
                    ? 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700'
                    : 'bg-red-600 border-red-600 text-white hover:bg-red-700'
                    }`}
                  title={form.mealsDisabled ? 'Re-enable staff meals for this employee' : 'Restrict this employee from ordering any staff meals'}
                >
                  {form.mealsDisabled ? (
                    <><Check size={11} /> Re-enable Meals</>
                  ) : (
                    <><Ban size={11} /> Not Allowed All Meals</>
                  )}
                </button>
              </div>
            </div>
            <p className={`text-[11px] leading-relaxed ${form.mealsDisabled ? 'text-red-800/90' : 'text-amber-800/80'}`}>
              When this employee orders Staff Meals in Consumption, they will strictly be limited to these permitted foods (e.g. Tibs, Tea, Sandwich). Leave empty to allow all menu items, or click <strong>Not Allowed All Meals</strong> to block staff meals completely.
            </p>

            {form.mealsDisabled ? (
              <div className="text-[11px] font-semibold text-red-700 bg-red-50 rounded-lg p-2.5 border border-red-200 flex items-center gap-2">
                <Ban size={13} className="text-red-600 shrink-0" />
                <span>Restricted employee: All staff meals are blocked and cannot be ordered in Consumption Management.</span>
              </div>
            ) : (
              <>
                <SearchableSelect
                  placeholder="Search product to add to staff meal quota…"
                  options={products
                    .filter(p => !form.allowedProducts?.includes(p._id))
                    .map(p => ({
                      value: p._id,
                      label: `${p.name} (${p.uom || 'Unit'})`,
                      sublabel: p.sellingPrice ? `Price: ETB ${p.sellingPrice} • ${p.category || 'General'}` : (p.category || ''),
                    }))}
                  value=""
                  onChange={val => {
                    if (val && !form.allowedProducts?.includes(val)) {
                      setForm(prev => ({
                        ...prev,
                        mealsDisabled: false,
                        allowedProducts: [...(prev.allowedProducts || []), val],
                      }));
                    }
                  }}
                />

                {/* Chips of selected allowed products */}
                {form.allowedProducts?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {form.allowedProducts.map(pId => {
                      const prod = products.find(p => p._id === pId);
                      return (
                        <span
                          key={pId}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 border border-amber-300/80 px-2.5 py-1 text-xs font-bold text-amber-900 shadow-2xs"
                        >
                          <span>{prod?.name || 'Item'}</span>
                          <button
                            type="button"
                            onClick={() => f('allowedProducts', form.allowedProducts.filter(id => id !== pId))}
                            className="rounded-full hover:bg-amber-200 p-0.5 text-amber-700 hover:text-amber-950 transition cursor-pointer"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => f('allowedProducts', [])}
                      className="text-[10.5px] font-bold text-amber-800 hover:text-amber-950 underline self-center ml-1 cursor-pointer"
                    >
                      Clear all restrictions
                    </button>
                  </div>
                ) : (
                  <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 rounded-lg p-2 border border-emerald-200 flex items-center gap-1.5">
                    <Check size={12} className="text-emerald-600 shrink-0" />
                    No restrictions active. Employee can order any menu item.
                  </div>
                )}
              </>
            )}
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

      {/* ══ Employee Detail & Security Audit Modal ══ */}
      <Modal
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailEmp(null); }}
        title={detailEmp ? `${detailEmp.firstName} ${detailEmp.lastName} (${detailEmp.employeeId || 'No ID'})` : 'Employee Details'}
        width="max-w-lg"
      >
        {detailEmp && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm rounded-xl border border-slate-200 bg-white p-3.5">
              <div><p className="text-[11px] text-ink-400">Employee ID</p><p className="font-mono font-semibold">{detailEmp.employeeId || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Department</p><p className="font-semibold">{detailEmp.department || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Position / Role</p><p className="font-semibold">{detailEmp.position || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Station</p><p className="font-medium">{getStationLabel ? getStationLabel(detailEmp.assignedStation || 'all') : (detailEmp.assignedStation || 'all')}</p></div>
              <div><p className="text-[11px] text-ink-400">Phone</p><p className="font-medium">{detailEmp.phone || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Email</p><p className="font-medium">{detailEmp.email || '—'}</p></div>
              <div><p className="text-[11px] text-ink-400">Hire Date</p><p className="font-medium">{fmt(detailEmp.hireDate)}</p></div>
              <div><p className="text-[11px] text-ink-400">Status</p><p className="font-semibold capitalize">{detailEmp.status || 'active'}</p></div>
              {detailEmp.notes && (
                <div className="col-span-2"><p className="text-[11px] text-ink-400">Notes</p><p className="font-medium">{detailEmp.notes}</p></div>
              )}
            </div>

            <RecordAuditTrail record={detailEmp} />

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setDetailOpen(false)}
                className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-semibold text-ink-600 hover:bg-ink-50">
                Close
              </button>
              {canEdit && (
                <button type="button" onClick={() => { setDetailOpen(false); openEdit(detailEmp); }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
                  <Pencil size={14} /> Edit
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ══ Digital Staff ID Badge Modal ══ */}
      <EmployeeIdBadgeModal
        open={badgeModalOpen}
        onClose={() => setBadgeModalOpen(false)}
        employee={badgeEmployee}
        onEdit={(emp) => {
          setBadgeModalOpen(false);
          openEdit(emp);
        }}
        isNewlyCreated={isNewlyCreated}
      />

    </div>
  );
}
