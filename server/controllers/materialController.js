const asyncHandler = require('express-async-handler');
const XLSX = require('xlsx');
const RawMaterial = require('../models/RawMaterial');
const { invalidateDashboardCache } = require('./dashboardController');
const tg = require('../utils/telegramNotifier');

const getMaterials = asyncHandler(async (req, res) => {
  const { search, status } = req.query;
  const filter = { isActive: true };
  if (search && search.trim()) {
    filter.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  let materials = await RawMaterial.find(filter).sort({ name: 1 }).lean();

  materials = materials.map((m) => ({
    ...m,
    status:
      m.currentStock <= 0
        ? 'out_of_stock'
        : m.currentStock <= m.reorderLevel
        ? 'low_stock'
        : 'in_stock',
  }));

  if (status) {
    materials = materials.filter((m) => m.status === status);
  }

  res.json(materials);
});

const getMaterialById = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) {
    res.status(404);
    throw new Error('Raw material not found');
  }
  res.json(material);
});

const createMaterial = asyncHandler(async (req, res) => {
  const { name, unit, unitCost } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Material name is required');
  }
  if (!unit || !unit.trim()) {
    res.status(400);
    throw new Error('Unit of measurement is required');
  }
  if (unitCost !== undefined && Number(unitCost) < 0) {
    res.status(400);
    throw new Error('Unit cost cannot be negative');
  }
  const material = await RawMaterial.create(req.body);
  tg.notifyMaterialCreated(material, req.user);
  invalidateDashboardCache();
  res.status(201).json(material);
});

const updateMaterial = asyncHandler(async (req, res) => {
  // Fetch old values BEFORE update so we can diff them
  const before = await RawMaterial.findById(req.params.id).lean();
  if (!before) { res.status(404); throw new Error('Raw material not found'); }

  const material = await RawMaterial.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });

  // Build a human-readable diff of what actually changed
  const watchedFields = [
    { key: 'name',          label: 'Name' },
    { key: 'category',      label: 'Category' },
    { key: 'unit',          label: 'Unit' },
    { key: 'unitCost',      label: 'Unit Cost',      format: v => `ETB ${Number(v).toFixed(2)}` },
    { key: 'currentStock',  label: 'Current Stock',  format: (v, m) => `${v} ${m?.unit || ''}` },
    { key: 'reorderLevel',  label: 'Reorder Level',  format: (v, m) => `${v} ${m?.unit || ''}` },
    { key: 'storeLocation', label: 'Store Location' },
  ];

  const changes = watchedFields
    .filter(f => req.body[f.key] !== undefined && String(before[f.key]) !== String(req.body[f.key]))
    .map(f => ({
      label: f.label,
      from:  f.format ? f.format(before[f.key], before) : String(before[f.key] ?? '—'),
      to:    f.format ? f.format(req.body[f.key], material) : String(req.body[f.key]),
    }));

  tg.notifyMaterialUpdated(material, req.user, changes);
  invalidateDashboardCache();
  res.json(material);
});

const deleteMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) { res.status(404); throw new Error('Raw material not found'); }
  material.isActive  = false;
  material.deletedAt = new Date();
  material.deletedBy = req.user?.name || 'System';
  material.deletedFrom = 'materials';
  await material.save();
  tg.notifyMaterialDeleted(material, req.user);
  invalidateDashboardCache();
  res.json({ message: 'Raw material moved to recycle bin.' });
});

const bulkDeleteMaterials = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids?.length) { res.status(400); throw new Error('No ids provided'); }
  await RawMaterial.updateMany(
    { _id: { $in: ids } },
    { isActive: false, deletedAt: new Date(), deletedBy: req.user?.name || 'System', deletedFrom: 'materials' }
  );
  tg.notifyBulkDeleted('Raw Materials', ids.length, req.user);
  invalidateDashboardCache();
  res.json({ message: `${ids.length} material(s) moved to recycle bin.` });
});

const restoreMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) { res.status(404); throw new Error('Raw material not found'); }
  material.isActive    = true;
  material.deletedAt   = null;
  material.deletedBy   = null;
  material.deletedFrom = null;
  await material.save();
  invalidateDashboardCache();
  res.json({ message: 'Raw material restored.', material });
});

const permanentDeleteMaterial = asyncHandler(async (req, res) => {
  const material = await RawMaterial.findById(req.params.id);
  if (!material) { res.status(404); throw new Error('Raw material not found'); }
  await material.deleteOne();
  invalidateDashboardCache();
  res.json({ message: 'Raw material permanently deleted.' });
});


// Helper: find column value by checking candidate names (case-insensitive, ignores spaces & non-alphanumeric)
const getColValue = (row, candidates) => {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const directMatch = keys.find(k => k.trim().toLowerCase() === candidate.toLowerCase());
    if (directMatch && row[directMatch] !== undefined && row[directMatch] !== null && String(row[directMatch]).trim() !== '') {
      return row[directMatch];
    }
  }
  const normKeys = keys.map(k => ({ raw: k, clean: k.toLowerCase().replace(/[^a-z0-9]/g, '') }));
  for (const candidate of candidates) {
    const cleanCand = candidate.toLowerCase().replace(/[^a-z0-9]/g, '');
    const match = normKeys.find(k => k.clean === cleanCand);
    if (match && row[match.raw] !== undefined && row[match.raw] !== null && String(row[match.raw]).trim() !== '') {
      return row[match.raw];
    }
  }
  return undefined;
};

// Helper: robust number parser supporting "10 kg", "ETB 1,500.00", "$50.25", etc.
const parseNumber = (val, fallback = 0) => {
  if (val === undefined || val === null || val === '') return fallback;
  if (typeof val === 'number') return isNaN(val) ? fallback : val;
  const str = String(val).replace(/,/g, '').trim();
  const match = str.match(/-?\d+(?:\.\d+)?/);
  if (match) {
    const n = parseFloat(match[0]);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
};

// Helper: extract unit from text like "10 Kilogram (kg)" or "25 kg"
const extractUnit = (val) => {
  if (!val) return '';
  const str = String(val).replace(/,/g, '').trim();
  const match = str.match(/^-?\d+(?:\.\d+)?\s*(.+)$/);
  return match && match[1] ? match[1].trim() : '';
};

// GET /api/materials/export/excel
const exportMaterialsExcel = asyncHandler(async (req, res) => {
  const materials = await RawMaterial.find({}).sort({ name: 1 });

  const rows = materials.map((m) => ({
    'Code': m.code || '',
    'Material Name': m.name,
    'Category': m.category || 'General',
    'Unit': m.unit || 'pcs',
    'Current Stock': m.currentStock || 0,
    'Reorder Level': m.reorderLevel || 10,
    'Unit Cost (ETB)': m.unitCost || 0,
    'Store Location': m.storeLocation || 'Main Store',
    'Status': m.status,
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [12, 24, 16, 10, 14, 14, 16, 16, 12].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Raw Materials');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="raw_materials.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// GET /api/materials/template/excel
const exportMaterialTemplate = asyncHandler(async (req, res) => {
  const rows = [
    {
      'Code': 'RM-0001',
      'Material Name': 'Special Bread Flour',
      'Category': 'Bakery & Grains',
      'Unit': 'kg',
      'Current Stock': 50,
      'Reorder Level': 10,
      'Unit Cost (ETB)': 120.00,
      'Store Location': 'Dry Store Room A',
    },
    {
      'Code': 'RM-0002',
      'Material Name': 'Butter Unsalted',
      'Category': 'Dairy & Eggs',
      'Unit': 'kg',
      'Current Stock': 20,
      'Reorder Level': 5,
      'Unit Cost (ETB)': 450.00,
      'Store Location': 'Cold Storage',
    },
    {
      'Code': 'RM-0003',
      'Material Name': 'Coffee Beans Arabica',
      'Category': 'Beverages',
      'Unit': 'kg',
      'Current Stock': 15,
      'Reorder Level': 4,
      'Unit Cost (ETB)': 600.00,
      'Store Location': 'Baristas Cupboard',
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [12, 26, 18, 10, 14, 14, 16, 20].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Materials Template');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="baba_roti_materials_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/materials/import/excel
const importMaterialsExcel = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  let ws = null;
  let rows = [];

  // 1. Find the first non-empty worksheet
  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const testRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    if (testRows && testRows.length > 0) {
      ws = sheet;
      rows = testRows;
      break;
    }
  }

  if (!ws || rows.length === 0) {
    return res.status(400).json({ message: 'The uploaded file contains no data rows.' });
  }

  // 2. If row 1 wasn't a standard header, scan 2D sheet to detect header row
  const nameKeys = ['name', 'material name', 'material', 'raw material', 'raw material name', 'item name', 'item', 'ingredient', 'description'];
  const hasValidHeader = rows.some(r => getColValue(r, nameKeys) !== undefined);
  if (!hasValidHeader) {
    const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    const headerIdx = rawRows.findIndex(r =>
      Array.isArray(r) && r.some(cell => typeof cell === 'string' && /^(name|material|item|code|category|stock)/i.test(cell.trim()))
    );
    if (headerIdx !== -1 && headerIdx < rawRows.length - 1) {
      const headers = rawRows[headerIdx].map(h => String(h || '').trim());
      rows = rawRows.slice(headerIdx + 1).map(r => {
        const obj = {};
        headers.forEach((h, idx) => { if (h) obj[h] = r[idx] ?? ''; });
        return obj;
      });
    }
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  const processedIds = new Set();

  // Pre-calculate next sequential RM code if needed
  let nextCodeNum = 1;
  const existingMaterials = await RawMaterial.find({}, 'code');
  for (const m of existingMaterials) {
    const match = String(m.code || '').match(/^RM-?(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num >= nextCodeNum) nextCodeNum = num + 1;
    }
  }

  for (const row of rows) {
    const rawName = getColValue(row, nameKeys);
    const name = String(rawName || '').trim();

    // Skip empty names, summary rows (Count: 10, Total, etc.), or repeated header rows
    if (!name || /^Count:/i.test(name) || /^Total/i.test(name) || name.toLowerCase() === 'name' || name.toLowerCase() === 'material') {
      skipped++;
      continue;
    }

    const rawCode = getColValue(row, ['code', 'material code', 'raw material code', 'item code', 'rm code', 'item no', 'sku', 'id']);
    let code = String(rawCode || '').trim().replace(/-+$/, '');
    if (code === '—' || code === '-') code = '';

    const category = String(getColValue(row, ['category', 'material category', 'group', 'type', 'department']) || 'General').trim();
    
    // Unit resolution: separate Unit column OR extracted from Stock text
    const rawStock = getColValue(row, ['current stock', 'in stock', 'stock', 'current qty', 'qty', 'quantity', 'balance', 'available stock']);
    const rawReorder = getColValue(row, ['reorder level', 'reorder at', 'reorder point', 'reorder', 'min stock', 'minimum stock', 'min']);
    const rawCost = getColValue(row, ['unit cost', 'unit cost (etb)', 'unit cost (birr)', 'cost', 'unit price', 'price', 'purchase cost']);
    const rawUnit = getColValue(row, ['unit', 'uom', 'unit of measure', 'unit of measurement', 'measurement']);

    let unit = String(rawUnit || extractUnit(rawStock) || extractUnit(rawReorder) || 'pcs').trim();
    if (!unit) unit = 'pcs';

    const currentStock = parseNumber(rawStock, 0);
    const reorderLevel = parseNumber(rawReorder, 10);
    const unitCost = parseNumber(rawCost, 0);
    const storeLocation = String(getColValue(row, ['store location', 'location', 'store', 'warehouse']) || 'Main Store').trim();

    const data = {
      name,
      category,
      unit,
      currentStock,
      reorderLevel,
      unitCost,
      storeLocation,
      isActive: true,
    };

    let existing = null;

    // 1️⃣ Match by Code first if code was provided
    if (code) {
      const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      existing = await RawMaterial.findOne({ code: { $regex: `^${escapedCode}-?$`, $options: 'i' } });
      if (existing && processedIds.has(existing._id.toString())) existing = null;
    }

    // 2️⃣ Match by Name (case-insensitive)
    if (!existing) {
      const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const byName = await RawMaterial.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
      if (byName && !processedIds.has(byName._id.toString())) existing = byName;
    }

    if (existing) {
      // If code was provided, update it too
      if (code && !existing.code) data.code = code;
      Object.assign(existing, data);
      await existing.save();
      processedIds.add(existing._id.toString());
      updated++;
    } else {
      if (!code) {
        code = `RM-${String(nextCodeNum++).padStart(4, '0')}`;
      }
      data.code = code;
      const created_ = await RawMaterial.create(data);
      processedIds.add(created_._id.toString());
      created++;
    }
  }

  invalidateDashboardCache();

  if (created === 0 && updated === 0) {
    const sampleHeaders = rows.length > 0 ? Object.keys(rows[0]).join(', ') : 'none';
    return res.status(400).json({
      message: `No materials could be imported. Please ensure your file has a column for Material Name (or Name). Detected columns: ${sampleHeaders}`
    });
  }

  res.json({
    message: `Imported successfully: ${created} created, ${updated} updated${skipped > 0 ? ` (${skipped} empty/header rows skipped)` : ''}`,
    created,
    updated,
    skipped,
  });
});

module.exports = {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  bulkDeleteMaterials,
  restoreMaterial,
  permanentDeleteMaterial,
  exportMaterialsExcel,
  exportMaterialTemplate,
  importMaterialsExcel,
};
