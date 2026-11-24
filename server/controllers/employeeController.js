const asyncHandler = require('express-async-handler');
const Employee = require('../models/Employee');
const { DEPARTMENTS } = require('../models/Employee');
const tg = require('../utils/telegramNotifier');
const notify = require('../utils/notificationHelper');
const { logActivity } = require('../utils/activityLogger');
// ── Auto employee ID ──────────────────────────────────────────────────
const generateEmployeeId = async () => {
  const count = await Employee.countDocuments();
  return `EMP-${String(count + 1).padStart(4, '0')}`;
};

// ── GET /api/employees ────────────────────────────────────────────────
const getEmployees = asyncHandler(async (req, res) => {
  const { department, status, search } = req.query;
  const filter = { deletedAt: null };

  if (department) filter.department = { $regex: new RegExp(`^${department.trim()}$`, 'i') };
  if (status) filter.status = { $regex: new RegExp(`^${status.trim()}$`, 'i') };
  if (search) {
    const q = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: q }, { lastName: q }, { employeeId: q }, { position: q }];
  }

  const employees = await Employee.find(filter)
    .populate('allowedProducts', 'name code uom sellingPrice category station parentCategory')
    .populate('mealLimits.product', 'name code uom sellingPrice category station parentCategory')
    .sort({ department: 1, firstName: 1 })
    .lean();
  res.json(employees);
});
// ── GET /api/employees/departments ────────────────────────────────────
const getDepartments = asyncHandler(async (req, res) => {
  res.json(DEPARTMENTS);
});

// ── POST /api/employees ───────────────────────────────────────────────
const createEmployee = asyncHandler(async (req, res) => {
  const { firstName, lastName, department, position, phone, email, hireDate, status, notes, employeeId, photoUrl, allowedProducts, dailyMealLimit, mealLimits } = req.body;

  if (!firstName || !lastName) {
    res.status(400); throw new Error('First name and last name are required.');
  }

  const emp = await Employee.create({
    employeeId: employeeId || (await generateEmployeeId()),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    department: department || 'Other',
    position: position || '',
    phone: phone || '',
    email: email || '',
    hireDate: hireDate ? new Date(hireDate) : null,
    status: status || 'active',
    notes: notes || '',
    photoUrl: photoUrl || '',
    allowedProducts: Array.isArray(allowedProducts) ? allowedProducts : [],
    dailyMealLimit:  Number(dailyMealLimit) || 1,
    mealLimits:      Array.isArray(mealLimits) ? mealLimits : [],
  });

  tg.notifyEmployeeCreated(emp, req.user);
  notify.push({ type: 'employee', title: 'New Employee Added', message: `${req.user?.name || 'Staff'} added ${emp.firstName} ${emp.lastName} to ${emp.department}`, icon: '👷', link: '/employees', severity: 'info', userId: req.user?._id });

  try {
    logActivity(req, {
      action: 'CREATE_EMPLOYEE',
      module: 'Employees',
      description: `Registered employee "${emp.firstName} ${emp.lastName}" (${emp.employeeId}) — ${emp.position || 'Staff'} in ${emp.department}`,
      status: 'success',
      details: { id: emp._id, employeeId: emp.employeeId, fullName: `${emp.firstName} ${emp.lastName}`, department: emp.department },
    });
  } catch (_) { }

  res.status(201).json(emp);
});

// ── PUT /api/employees/:id ────────────────────────────────────────────
const updateEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp || emp.deletedAt) { res.status(404); throw new Error('Employee not found'); }

  const fields = ['firstName', 'lastName', 'department', 'position', 'phone', 'email', 'hireDate', 'status', 'notes', 'employeeId', 'photoUrl', 'allowedProducts', 'dailyMealLimit', 'mealLimits'];
  fields.forEach(f => {
    if (req.body[f] !== undefined) {
      emp[f] = f === 'hireDate' ? (req.body[f] ? new Date(req.body[f]) : null) : req.body[f];
    }
  });

  await emp.save();

  // Sync allowed meal quota and daily limits to matching User record if one exists by email or name
  if (req.body.allowedProducts !== undefined || req.body.dailyMealLimit !== undefined || req.body.mealLimits !== undefined) {
    try {
      const User = require('../models/User');
      const userMatch = await User.findOne({
        $or: [
          ...(emp.email ? [{ email: emp.email }] : []),
          { name: new RegExp(`^${emp.firstName}\\s+${emp.lastName}$`, 'i') }
        ]
      });
      if (userMatch) {
        if (req.body.allowedProducts !== undefined) userMatch.allowedProducts = emp.allowedProducts;
        if (req.body.dailyMealLimit !== undefined) userMatch.dailyMealLimit = emp.dailyMealLimit;
        if (req.body.mealLimits !== undefined) userMatch.mealLimits = emp.mealLimits;
        await userMatch.save();
      }
    } catch (_) { }
  }

  tg.notifyEmployeeUpdated(emp, req.user);
  notify.push({ type: 'employee', title: 'Employee Updated', message: `${req.user?.name || 'Staff'} updated ${emp.firstName} ${emp.lastName}`, icon: '✏️', link: '/employees', severity: 'info', userId: req.user?._id });

  try {
    logActivity(req, {
      action: 'UPDATE_EMPLOYEE',
      module: 'Employees',
      description: `Updated employee profile for "${emp.firstName} ${emp.lastName}" (${emp.employeeId})`,
      status: 'success',
      details: { id: emp._id, employeeId: emp.employeeId, fullName: `${emp.firstName} ${emp.lastName}` },
    });
  } catch (_) { }

  const populated = await Employee.findById(emp._id)
    .populate('allowedProducts', 'name code uom sellingPrice category station parentCategory')
    .populate('mealLimits.product', 'name code uom sellingPrice category station parentCategory')
    .lean();

  res.json(populated || emp);
});

// ── DELETE /api/employees/:id  (soft delete) ──────────────────────────
const deleteEmployee = asyncHandler(async (req, res) => {
  const emp = await Employee.findById(req.params.id);
  if (!emp || emp.deletedAt) { res.status(404); throw new Error('Employee not found'); }

  emp.deletedAt = new Date();
  emp.deletedBy = req.user?.name || 'System';
  await emp.save();
  tg.notifyEmployeeDeleted(emp, req.user);
  notify.push({ type: 'employee', title: 'Employee Removed', message: `${req.user.name} removed ${emp.firstName} ${emp.lastName} from ${emp.department}`, icon: '🗑️', link: '/employees', severity: 'warning', userId: req.user._id });

  try {
    logActivity(req, {
      action: 'DELETE_EMPLOYEE',
      module: 'Employees',
      description: `Removed employee "${emp.firstName} ${emp.lastName}" (${emp.employeeId})`,
      status: 'warning',
      details: { id: emp._id, employeeId: emp.employeeId, fullName: `${emp.firstName} ${emp.lastName}` },
    });
  } catch (_) { }

  res.json({ message: 'Employee removed.' });
});

module.exports = { getEmployees, getDepartments, createEmployee, updateEmployee, deleteEmployee };
