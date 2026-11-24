/**
 * Unit Conversion & Normalization Utility
 * Supports culinary weight, volume, and count units.
 */

const WEIGHT_UNITS = {
  kg: 1000,
  kilogram: 1000,
  kilograms: 1000,
  g: 1,
  gram: 1,
  grams: 1,
  gm: 1,
  mg: 0.001,
  milligram: 0.001,
  milligrams: 0.001,
};

const VOLUME_UNITS = {
  l: 1000,
  ltr: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  dl: 100,
  cl: 10,
  ml: 1,
  milliliter: 1,
  milliliters: 1,
};

const COUNT_ALIASES = {
  pc: 'pcs',
  pcs: 'pcs',
  piece: 'pcs',
  pieces: 'pcs',
  unit: 'pcs',
  units: 'pcs',
  item: 'pcs',
  items: 'pcs',
  portion: 'portion',
  portions: 'portion',
  serving: 'portion',
  servings: 'portion',
  box: 'box',
  boxes: 'box',
  pack: 'pack',
  packs: 'pack',
  package: 'pack',
  can: 'can',
  cans: 'can',
  bottle: 'bottle',
  bottles: 'bottle',
  cup: 'cup',
  cups: 'cup',
  shot: 'shot',
  shots: 'shot',
};

function normalizeUnit(unit) {
  if (!unit || typeof unit !== 'string') return '';
  const clean = unit.trim().toLowerCase();
  if (WEIGHT_UNITS[clean]) {
    if (clean === 'kilogram' || clean === 'kilograms') return 'kg';
    if (clean === 'gram' || clean === 'grams' || clean === 'gm') return 'g';
    if (clean === 'milligram' || clean === 'milligrams') return 'mg';
    return clean;
  }
  if (VOLUME_UNITS[clean]) {
    if (clean === 'ltr' || clean === 'liter' || clean === 'liters' || clean === 'litre' || clean === 'litres') return 'l';
    if (clean === 'milliliter' || clean === 'milliliters') return 'ml';
    return clean;
  }
  if (COUNT_ALIASES[clean]) {
    return COUNT_ALIASES[clean];
  }
  return clean;
}

function getUnitFamily(unit) {
  const norm = normalizeUnit(unit);
  if (WEIGHT_UNITS[norm]) return 'weight';
  if (VOLUME_UNITS[norm]) return 'volume';
  if (COUNT_ALIASES[norm]) return 'count';
  return 'other';
}

function areUnitsCompatible(unit1, unit2) {
  const norm1 = normalizeUnit(unit1);
  const norm2 = normalizeUnit(unit2);
  if (!norm1 || !norm2) return true;
  if (norm1 === norm2) return true;
  const fam1 = getUnitFamily(norm1);
  const fam2 = getUnitFamily(norm2);
  return fam1 === fam2 && fam1 !== 'other';
}

/**
 * Converts quantity from fromUnit to toUnit.
 * Example: convertUnit(40, 'g', 'kg') => 0.04
 * Example: convertUnit(2, 'kg', 'g') => 2000
 * Example: convertUnit(250, 'ml', 'l') => 0.25
 * If units are not convertible (e.g. 'pcs' to 'kg'), returns the original quantity.
 */
function convertUnit(quantity, fromUnit, toUnit) {
  const num = Number(quantity);
  if (isNaN(num)) return 0;
  if (!fromUnit || !toUnit) return num;

  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (normFrom === normTo) return num;

  // Weight conversion (base = grams)
  if (WEIGHT_UNITS[normFrom] && WEIGHT_UNITS[normTo]) {
    const inGrams = num * WEIGHT_UNITS[normFrom];
    const result = inGrams / WEIGHT_UNITS[normTo];
    return Math.round(result * 100000) / 100000;
  }

  // Volume conversion (base = ml)
  if (VOLUME_UNITS[normFrom] && VOLUME_UNITS[normTo]) {
    const inMl = num * VOLUME_UNITS[normFrom];
    const result = inMl / VOLUME_UNITS[normTo];
    return Math.round(result * 100000) / 100000;
  }

  // Same count family or fallback
  return num;
}

const DISCRETE_UNITS = new Set([
  'pc', 'pcs', 'piece', 'pieces', 'egg', 'eggs', 'unit', 'units', 'item', 'items',
  'bottle', 'bottles', 'can', 'cans', 'pack', 'packs', 'package', 'packages',
  'packet', 'packets', 'box', 'boxes', 'roll', 'rolls', 'portion', 'portions',
  'serving', 'servings', 'plate', 'plates', 'cup', 'cups', 'shot', 'shots',
  'loaf', 'loaves', 'slice', 'slices', 'bunch', 'bunches'
]);

function isDiscreteUnit(unit = '', name = '') {
  const u = String(unit || '').trim().toLowerCase();
  if (DISCRETE_UNITS.has(u)) return true;
  if (/^(pcs?|piece(s)?)$/i.test(u)) return true;
  const n = String(name || '').toLowerCase();
  if (/\b(egg|eggs|injera|bread|bun|buns|can|bottle)\b/i.test(n) && !/^(kg|kilogram|g|gram|gm|mg|l|ltr|liter|litre|ml|cl|dl)$/i.test(u)) {
    return true;
  }
  return false;
}

function cleanQuantity(val, unit = '', name = '') {
  const num = Number(val);
  if (isNaN(num)) return 0;
  if (isDiscreteUnit(unit, name)) {
    return Math.round(num);
  }
  if (Math.abs(num) < 0.00001) return 0;
  const r2 = Math.round((num + Number.EPSILON) * 100) / 100;
  if (Math.abs(num - r2) < 0.005) {
    return r2;
  }
  return Math.round((num + Number.EPSILON) * 1000) / 1000;
}

function formatUnitQuantity(qty, unit, name = '') {
  const clean = cleanQuantity(qty, unit, name);
  const u = normalizeUnit(unit);
  return `${clean} ${u}`;
}

module.exports = {
  normalizeUnit,
  getUnitFamily,
  areUnitsCompatible,
  convertUnit,
  formatUnitQuantity,
  isDiscreteUnit,
  cleanQuantity,
};
