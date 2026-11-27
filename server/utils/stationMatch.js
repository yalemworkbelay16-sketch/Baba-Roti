/**
 * Resolve the effective station key from department name, custom departments,
 * and an explicit assignedStation value.
 */
function resolveMatchedStation({ department = '', assignedStation = '', customDepartments = [] } = {}) {
  const explicit = String(assignedStation || '').trim().toLowerCase();
  const dept = String(department || '').trim();
  const deptLower = dept.toLowerCase();

  if (explicit && explicit !== 'all') {
    return explicit;
  }

  if (dept && Array.isArray(customDepartments)) {
    const customMatch = customDepartments.find(
      (d) => String(d.label || '').trim().toLowerCase() === deptLower || String(d.key || '').trim().toLowerCase() === deptLower
    );
    if (customMatch?.defaultStation) {
      return String(customMatch.defaultStation).trim().toLowerCase();
    }
  }

  if (deptLower.includes('kitchen') || deptLower.includes('chef') || deptLower.includes('pastry') || deptLower.includes('bakery')) {
    return 'kitchen';
  }
  if (deptLower === 'bar' || deptLower.includes('bar ') || deptLower.includes(' bar')) {
    return 'bar';
  }
  if (deptLower === 'main store' || deptLower.includes('warehouse') || deptLower.includes('purchas')) {
    return 'main';
  }

  return explicit || 'all';
}

module.exports = { resolveMatchedStation };
