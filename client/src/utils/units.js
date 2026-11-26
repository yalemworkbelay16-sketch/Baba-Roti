/**
 * Shared Client International Unit of Measurement (UOM) Utilities
 * Mirrors server/utils/unitConverter.js for exact parity in recipe previews,
 * cost calculations, and international unit conversion hints.
 */

export const WEIGHT_FACTORS = {
  mg: 0.001,
  g: 1,
  kg: 1000,
  t: 1000000,
  oz: 28.349523125,
  lb: 453.59237,
};

export const VOLUME_FACTORS = {
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

export const LENGTH_FACTORS = {
  mm: 0.1,
  cm: 1,
  m: 100,
  inch: 2.54,
  ft: 30.48,
};

export const CONVERTIBLE_COUNT_FACTORS = {
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

  // Container / Packaging
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

/**
 * Standardized International Unit groups for recipe ingredients, products, & production.
 * Values use crisp standard SI/culinary symbols so conversions work uniformly everywhere.
 */
export const INTERNATIONAL_UNIT_GROUPS = [
  {
    group: 'Weight / Mass (SI & Imperial)',
    family: 'weight',
    options: [
      { value: 'kg', label: 'kg — Kilogram (1,000 g)' },
      { value: 'g', label: 'g — Gram' },
      { value: 'mg', label: 'mg — Milligram' },
      { value: 'lb', label: 'lb — Pound (453.6 g)' },
      { value: 'oz', label: 'oz — Ounce (28.35 g)' },
      { value: 't', label: 't — Metric Tonne (1,000 kg)' },
    ],
  },
  {
    group: 'Volume / Liquid & Culinary',
    family: 'volume',
    options: [
      { value: 'L', label: 'L — Litre (1,000 ml)' },
      { value: 'ml', label: 'ml — Millilitre' },
      { value: 'cl', label: 'cl — Centilitre (10 ml)' },
      { value: 'dl', label: 'dl — Decilitre (100 ml)' },
      { value: 'tbsp', label: 'tbsp — Tablespoon (15 ml)' },
      { value: 'tsp', label: 'tsp — Teaspoon (5 ml)' },
      { value: 'cup', label: 'cup — Culinary Cup (240 ml)' },
      { value: 'fl oz', label: 'fl oz — Fluid Ounce (29.57 ml)' },
      { value: 'pt', label: 'pt — Pint (473.2 ml)' },
      { value: 'qt', label: 'qt — Quart (946.4 ml)' },
      { value: 'gal', label: 'gal — Gallon (3.785 L)' },
    ],
  },
  {
    group: 'Count & Packaging',
    family: 'convertible_count',
    options: [
      { value: 'Pcs', label: 'Pcs — Piece / Unit' },
      { value: 'Dozen', label: 'Dozen (12 Pcs)' },
      { value: 'Pair', label: 'Pair (2 Pcs)' },
      { value: 'Portion', label: 'Portion / Serving' },
      { value: 'Pack', label: 'Pack / Packet' },
      { value: 'Bottle', label: 'Bottle' },
      { value: 'Can', label: 'Can / Tin' },
      { value: 'Box', label: 'Box' },
      { value: 'Carton', label: 'Carton / Case' },
      { value: 'Bag', label: 'Bag / Sack' },
      { value: 'Tray', label: 'Tray' },
      { value: 'Roll', label: 'Roll' },
      { value: 'Sheet', label: 'Sheet' },
      { value: 'Slice', label: 'Slice' },
      { value: 'Loaf', label: 'Loaf' },
      { value: 'Bunch', label: 'Bunch' },
      { value: 'Shot', label: 'Shot' },
      { value: 'Batch', label: 'Batch' },
      { value: 'Set', label: 'Set' },
    ],
  },
  {
    group: 'Length',
    family: 'length',
    options: [
      { value: 'm', label: 'm — Metre' },
      { value: 'cm', label: 'cm — Centimetre' },
      { value: 'mm', label: 'mm — Millimetre' },
      { value: 'inch', label: 'inch — Inch (2.54 cm)' },
      { value: 'ft', label: 'ft — Foot (30.48 cm)' },
    ],
  },
];

// Full list for RawMaterials inventory setup (preserves existing labels for backwards compatibility)
export const RAW_MATERIAL_UNIT_GROUPS = [
  { group: 'Weight (International)', items: ['Kilogram (kg)', 'Gram (g)', 'Milligram (mg)', 'Tonne (t)', 'Pound (lb)', 'Ounce (oz)'] },
  { group: 'Volume & Culinary', items: ['Litre (L)', 'Millilitre (ml)', 'Centilitre (cl)', 'Decilitre (dl)', 'Gallon', 'Quart (qt)', 'Pint (pt)', 'Fluid oz', 'Cup', 'Tablespoon (tbsp)', 'Teaspoon (tsp)'] },
  { group: 'Count & Packaging', items: ['Piece (Pcs)', 'Dozen', 'Pair', 'Pack', 'Box', 'Carton', 'Bag', 'Bottle', 'Can', 'Roll', 'Sheet'] },
  { group: 'Length', items: ['Metre (m)', 'Centimetre (cm)', 'Millimetre (mm)', 'Inch (in)'] },
  { group: 'Kitchen / Bar Serving', items: ['Portion', 'Serving', 'Tray', 'Batch', 'Shot', 'Slice', 'Loaf', 'Bunch', 'Set'] },
];

export function normalizeUnit(unit) {
  if (!unit || typeof unit !== 'string') return '';
  const clean = unit.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!clean) return '';
  if (ALIAS_TO_CANONICAL[clean]) return ALIAS_TO_CANONICAL[clean];

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

export function getUnitFamily(unit) {
  const norm = normalizeUnit(unit);
  if (!norm) return 'other';
  if (WEIGHT_FACTORS[norm]) return 'weight';
  if (VOLUME_FACTORS[norm]) return 'volume';
  if (LENGTH_FACTORS[norm]) return 'length';
  if (CONVERTIBLE_COUNT_FACTORS[norm]) return 'convertible_count';
  if (ALIAS_TO_CANONICAL[norm]) return 'packaging';
  return 'other';
}

export function areUnitsCompatible(unit1, unit2) {
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

export function convertUnit(quantity, fromUnit, toUnit) {
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

export function isDiscreteUnit(unit = '', name = '') {
  const norm = normalizeUnit(unit);
  if (DISCRETE_UNITS.has(norm)) return true;
  const n = String(name || '').toLowerCase();
  const fam = getUnitFamily(norm);
  if (/\b(egg|eggs|injera|bread|bun|buns|can|bottle)\b/i.test(n) && fam === 'other') {
    return true;
  }
  return false;
}

export function formatUnitQty(val, unit = '', name = '') {
  const num = Number(val);
  if (isNaN(num)) return '0';
  if (isDiscreteUnit(unit, name)) {
    return String(Math.round(num));
  }
  if (Math.abs(num) < 0.000001) return '0';
  const r2 = Math.round((num + Number.EPSILON) * 100) / 100;
  if (Math.abs(num - r2) < 0.0005) {
    return String(r2);
  }
  const r3 = Math.round((num + Number.EPSILON) * 1000) / 1000;
  if (Math.abs(num - r3) < 0.00005) {
    return String(r3);
  }
  return String(Math.round((num + Number.EPSILON) * 10000) / 10000);
}

/**
 * Returns a human-readable conversion indicator when recipe unit differs from stock base unit.
 */
export function getConversionPreview(quantity, ingUnit, baseUnit) {
  const qty = Number(quantity);
  if (!ingUnit || !baseUnit || isNaN(qty)) return null;
  const normIng = normalizeUnit(ingUnit);
  const normBase = normalizeUnit(baseUnit);
  if (!normIng || !normBase || normIng === normBase) return null;

  const compatible = areUnitsCompatible(ingUnit, baseUnit);
  if (!compatible) {
    return {
      compatible: false,
      convertedQty: qty,
      text: `⚠ ${ingUnit} ≠ ${baseUnit} (no auto-conversion)`,
    };
  }
  const convertedQty = convertUnit(qty, ingUnit, baseUnit);
  return {
    compatible: true,
    convertedQty,
    text: `= ${formatUnitQty(convertedQty, baseUnit)} ${baseUnit}`,
  };
}
