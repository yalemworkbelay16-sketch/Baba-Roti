const Employee = require('../models/Employee');

/**
 * Split a full name into firstName and lastName.
 * Guarantees neither is empty since both are required on Employee.
 */
function splitFullName(fullName) {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: 'Staff', lastName: 'Member' };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
}

/**
 * Convert user role to human-readable employee position.
 */
function roleToPosition(role) {
  const map = {
    admin: 'Administrator',
    dev: 'System Developer',
    manager: 'Manager',
    supervisor: 'Supervisor',
    storekeeper: 'Storekeeper',
    cashier: 'Cashier',
    waiter: 'Waiter',
    fb_team: 'F & B Team',
  };
  return map[role] || (role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Staff');
}

/**
 * Normalize department for employee directory.
 */
function normalizeDepartment(dept, role) {
  if (dept && String(dept).trim()) {
    return String(dept).trim();
  }
  if (role === 'waiter') return 'Waiter';
  if (role === 'cashier' || role === 'fb_team') return 'Food & Beverage';
  if (role === 'storekeeper') return 'Main Store';
  if (['manager', 'admin', 'supervisor', 'dev'].includes(role)) return 'Management';
  return 'Other';
}

/**
 * Synchronize a User record directly into the Employee directory.
 * If matching employee exists (by email, employeeId, or name), updates it.
 * If not, creates a new Employee entry.
 */
async function syncUserToEmployee(user) {
  if (!user) return null;

  try {
    const { firstName, lastName } = splitFullName(user.name);
    const cleanEmail = user.email ? String(user.email).trim().toLowerCase() : '';
    const cleanEmpId = user.employeeId ? String(user.employeeId).trim() : '';

    // Search query: match by email, employeeId, or exact full name
    const matchConditions = [];
    if (cleanEmail) {
      matchConditions.push({ email: cleanEmail });
    }
    if (cleanEmpId) {
      matchConditions.push({ employeeId: cleanEmpId });
    }
    matchConditions.push({
      firstName: new RegExp(`^${firstName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      lastName: new RegExp(`^${lastName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });

    let emp = await Employee.findOne({
      $or: matchConditions,
      deletedAt: null,
    });

    // Also check soft-deleted if not found in active
    if (!emp) {
      emp = await Employee.findOne({ $or: matchConditions });
      if (emp) {
        emp.deletedAt = null;
        emp.deletedBy = null;
      }
    }

    const dept = normalizeDepartment(user.department, user.role);
    const pos = roleToPosition(user.role);
    const photo = user.photoUrl || user.avatar || '';
    const station = user.assignedStation || 'all';
    const status = user.isActive === false ? 'inactive' : 'active';
    const finalEmpId = cleanEmpId || (emp?.employeeId) || `STAFF-${String(user._id).slice(-4).toUpperCase()}`;

    if (emp) {
      // Update existing employee
      emp.firstName = firstName;
      emp.lastName = lastName;
      if (cleanEmail) emp.email = cleanEmail;
      if (user.phone) emp.phone = user.phone;
      if (dept) emp.department = dept;
      emp.assignedStation = station;
      emp.position = pos;
      emp.status = status;
      if (photo) emp.photoUrl = photo;
      if (!emp.employeeId) emp.employeeId = finalEmpId;
      if (user.allowedProducts?.length) emp.allowedProducts = user.allowedProducts;
      if (user.dailyMealLimit) emp.dailyMealLimit = user.dailyMealLimit;
      if (user.mealLimits?.length) emp.mealLimits = user.mealLimits;
      await emp.save();
      return emp;
    }

    // Create new employee
    emp = await Employee.create({
      employeeId: finalEmpId,
      firstName,
      lastName,
      department: dept,
      assignedStation: station,
      position: pos,
      phone: user.phone || '',
      email: cleanEmail,
      hireDate: user.createdAt || new Date(),
      status,
      photoUrl: photo,
      allowedProducts: user.allowedProducts || [],
      dailyMealLimit: user.dailyMealLimit || 1,
      mealLimits: user.mealLimits || [],
    });

    return emp;
  } catch (err) {
    console.error(`[employeeSync] Failed to sync user "${user?.name}" to Employee:`, err.message);
    return null;
  }
}

/**
 * Sync all existing users to the employee directory.
 */
async function syncAllUsersToEmployees() {
  const User = require('../models/User');
  const users = await User.find({}).lean();
  let count = 0;
  for (const u of users) {
    const res = await syncUserToEmployee(u);
    if (res) count++;
  }
  return count;
}

module.exports = {
  syncUserToEmployee,
  syncAllUsersToEmployees,
  splitFullName,
  roleToPosition,
  normalizeDepartment,
};
