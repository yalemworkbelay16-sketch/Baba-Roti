/**
 * International Unit of Measurement (UOM) Conversion & Normalization Utility
 * Supports SI Metric & US Customary / Imperial weight, volume, length, culinary,
 * and standard packaging/count units (including label-wrapped formats like "Kilogram (kg)").
 */

const WEIGHT_FACTORS = {
  // Base = gram (g)
  mg: 0.001,
  g: 1,
  kg: 1000,
  t: 1000000, // Metric tonne
  oz: 28.349523125,
  lb: 453.59237,
};

const VOLUME_FACTORS = {
  // Base = millilitre (ml)
  ml: 1,
  cl: 10,
  dl: 100,
  l: 1000,
  kl: 1000000,
  tsp: 5,
  tbsp: 15,
  'fl oz': 29.5735295625,
  cup: 240,
  pt: 473.176473,
  qt: 946.352946,
  gal: 3785.411784,
};

const LENGTH_FACTORS = {
  // Base = centimetre (cm)
  mm: 0.1,
  cm: 1,
  m: 100,
  inch: 2.54,
  ft: 30.48,
};

const CONVERTIBLE_COUNT_FACTORS = {
  // Base = pcs
  pcs: 1,
  pair: 2,
  dozen: 12,
};

const ALIAS_TO_CANONICAL = {
  // Weight
  mg: 'mg', milligram: 'mg', milligrams: 'mg', milligramme: 'mg', milligrammes: 'mg',
  g: 'g', gm: 'g', gr: 'g', gram: 'g', grams: 'g', gramme: 'g', grammes: 'g',
  kg: 'kg', kgs: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kilogramme: 'kg', kilogrammes: 'kg',
  t: 't', ton: 't', tons: 't', tonne: 't', tonnes: 't', mt: 't', 'metric ton': 't', 'metric tons': 't', 'metric tonne': 't',
  oz: 'oz', ounce: 'oz', ounces: 'oz',
  lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',

  // Volume
  ml: 'ml', mls: 'ml', cc: 'ml', milliliter: 'ml', milliliters: 'ml', millilitre: 'ml', millilitres: 'ml',
  cl: 'cl', centiliter: 'cl', centiliters: 'cl', centilitre: 'cl', centilitres: 'cl',
  dl: 'dl', deciliter: 'dl', deciliters: 'dl', decilitre: 'dl', decilitres: 'dl',
  l: 'l', lt: 'l', ltr: 'l', ltrs: 'l', liter: 'l', liters: 'l', litre: 'l', litres: 'l',
  kl: 'kl', m3: 'kl', kiloliter: 'kl', kiloliters: 'kl', kilolitre: 'kl', kilolitres: 'kl', 'cubic meter': 'kl', 'cubic metre': 'kl',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tbsps: 'tbsp', tbs: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  'fl oz': 'fl oz', 'fl.oz': 'fl oz', fl_oz: 'fl oz', floz: 'fl oz', 'fluid oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  cup: 'cup', cups: 'cup',
  pt: 'pt', pts: 'pt', pint: 'pt', pints: 'pt',
  qt: 'qt', qts: 'qt', quart: 'qt', quarts: 'qt',
  gal: 'gal', gals: 'gal', gallon: 'gal', gallons: 'gal',

  // Length
  mm: 'mm', millimeter: 'mm', millimeters: 'mm', millimetre: 'mm', millimetres: 'mm',
  cm: 'cm', centimeter: 'cm', centimeters: 'cm', centimetre: 'cm', centimetres: 'cm',
  m: 'm', mtr: 'm', meter: 'm', meters: 'm', metre: 'm', metres: 'm',
  in: 'inch', inch: 'inch', inches: 'inch',
  ft: 'ft', foot: 'ft', feet: 'ft',

  // Convertible count
  pc: 'pcs', pcs: 'pcs', piece: 'pcs', pieces: 'pcs', unit: 'pcs', units: 'pcs', item: 'pcs', items: 'pcs', ea: 'pcs', each: 'pcs',
  pair: 'pair', pairs: 'pair',
  doz: 'dozen', dozen: 'dozen', dozens: 'dozen',

  // Container / Non-interconvertible packaging
  portion: 'portion', portions: 'portion', serving: 'portion', servings: 'portion', plate: 'portion', plates: 'portion',
  pack: 'pack', packs: 'pack', package: 'pack', packages: 'pack', packet: 'pack', packets: 'pack', pkt: 'pack',
  box: 'box', boxes: 'box',
  carton: 'carton', cartons: 'carton', ctn: 'carton', ctns: 'carton', case: 'carton', cases: 'carton',
  bag: 'bag', bags: 'bag', sack: 'bag', sacks: 'bag',
  bottle: 'bottle', bottles: 'bottle', btl: 'bottle',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  roll: 'roll', rolls: 'roll',
  sheet: 'sheet', sheets: 'sheet',
  tray: 'tray', trays: 'tray',
  batch: 'batch', batches: 'batch',
  shot: 'shot', shots: 'shot',
  loaf: 'loaf', loaves: 'loaf',
  slice: 'slice', slices: 'slice',
  bunch: 'bunch', bunches: 'bunch',
  set: 'set', sets: 'set',
  drop: 'drop', drops: 'drop',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
};

function normalizeUnit(unit) {
  if (!unit || typeof unit !== 'string') return '';
  const clean = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (ALIAS_TO_CANONICAL[clean]) return ALIAS_TO_CANONICAL[clean];

  // Handle formatted UI strings like "Kilogram (kg)", "Litre (L)", "Piece (Pcs)", "Tablespoon (tbsp)"
  const parenMatch = clean.match(/\(([^)]+)\)/);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    if (ALIAS_TO_CANONICAL[inside]) return ALIAS_TO_CANONICAL[inside];
  }
  const stripped = clean.replace(/\s*\([^)]*\)\s*/g, '').trim();
  if (stripped && ALIAS_TO_CANONICAL[stripped]) {
    return ALIAS_TO_CANONICAL[stripped];
  }

  return clean;
}

function getUnitFamily(unit) {
  const norm = normalizeUnit(unit);
  if (!norm) return 'other';
  if (WEIGHT_FACTORS[norm]) return 'weight';
  if (VOLUME_FACTORS[norm]) return 'volume';
  if (LENGTH_FACTORS[norm]) return 'length';
  if (CONVERTIBLE_COUNT_FACTORS[norm]) return 'convertible_count';
  if (ALIAS_TO_CANONICAL[norm]) return 'packaging';
  return 'other';
}

function areUnitsCompatible(unit1, unit2) {
  const norm1 = normalizeUnit(unit1);
  const norm2 = normalizeUnit(unit2);
  if (!norm1 || !norm2) return true;
  if (norm1 === norm2) return true;
  const fam1 = getUnitFamily(norm1);
  const fam2 = getUnitFamily(norm2);
  if (fam1 === 'weight' || fam1 === 'volume' || fam1 === 'length' || fam1 === 'convertible_count') {
    return fam1 === fam2;
  }
  return false;
}

/**
 * Converts quantity from fromUnit to toUnit within any compatible international family.
 * Examples:
 *   convertUnit(500, 'g', 'Kilogram (kg)') => 0.5
 *   convertUnit(1, 'lb', 'g')              => 453.59237
 *   convertUnit(2, 'tbsp', 'ml')           => 30
 *   convertUnit(6, 'pcs', 'Dozen')         => 0.5
 * If units belong to different incompatible families (e.g. 'pcs' vs 'kg'), returns original quantity.
 */
function convertUnit(quantity, fromUnit, toUnit) {
  const num = Number(quantity);
  if (isNaN(num)) return 0;
  if (!fromUnit || !toUnit) return num;

  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);
  if (!normFrom || !normTo || normFrom === normTo) return num;

  const tables = [WEIGHT_FACTORS, VOLUME_FACTORS, LENGTH_FACTORS, CONVERTIBLE_COUNT_FACTORS];
  for (const table of tables) {
    if (table[normFrom] && table[normTo]) {
      const baseVal = num * table[normFrom];
      const converted = baseVal / table[normTo];
      return Math.round(converted * 1000000) / 1000000;
    }
  }

  return num;
}

const DISCRETE_UNITS = new Set([
  'pcs', 'bottle', 'can', 'pack', 'box', 'carton', 'bag',
  'roll', 'sheet', 'tray', 'portion', 'shot', 'loaf', 'slice', 'bunch', 'set',
  'egg', 'eggs',
]);

function isDiscreteUnit(unit = '', name = '') {
  const norm = normalizeUnit(unit);
  if (DISCRETE_UNITS.has(norm)) return true;
  const n = String(name || '').toLowerCase();
  const fam = getUnitFamily(norm);
  if (/\b(egg|eggs|injera|bread|bun|buns|can|bottle)\b/i.test(n) && fam === 'other') {
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
  if (Math.abs(num) < 0.000001) return 0;
  const r2 = Math.round((num + Number.EPSILON) * 100) / 100;
  if (Math.abs(num - r2) < 0.0005) {
    return r2;
  }
  const r3 = Math.round((num + Number.EPSILON) * 1000) / 1000;
  if (Math.abs(num - r3) < 0.00005) {
    return r3;
  }
  return Math.round((num + Number.EPSILON) * 10000) / 10000;
}

function formatUnitQuantity(qty, unit, name = '') {
  const clean = cleanQuantity(qty, unit, name);
  const u = normalizeUnit(unit);
  return `${clean} ${u}`.trim();
}

module.exports = {
  WEIGHT_FACTORS,
  VOLUME_FACTORS,
  LENGTH_FACTORS,
  CONVERTIBLE_COUNT_FACTORS,
  normalizeUnit,
  getUnitFamily,
  areUnitsCompatible,
  convertUnit,
  formatUnitQuantity,
  isDiscreteUnit,
  cleanQuantity,
};
