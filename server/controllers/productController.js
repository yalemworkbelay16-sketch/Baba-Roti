const asyncHandler = require('express-async-handler');
const path = require('path');
const XLSX = require('xlsx');
const Product = require('../models/Product');
const RawMaterial = require('../models/RawMaterial');
const Setting = require('../models/Setting');
const { invalidateDashboardCache } = require('./dashboardController');
const tg = require('../utils/telegramNotifier');
const { uploadBufferToGridFS, saveLocalCache } = require('../utils/gridfs');
const { generateAndSaveProductImage } = require('../utils/aiImageService');

// ── Pricing helper — applies settings-based adjustments to recipe cost ──
// Returns full cost breakdown:
//   adjustedMaterialCost  = raw material cost with price adjustment applied
//   withContingency       = + contingency %
//   totalCost             = + overhead %
//   suggestedSellingPrice = totalCost / (foodCostPercent / 100)
function calcRecipeCostBreakdown(ingredients, settings = {}) {
  const {
    contingencyPercent = 10,
    overheadPercent = 25,
    spiceCostPercent = 5,
    defaultFoodCostPercent = 30,
    rawMaterialPriceAdjustType = 'percent',
    rawMaterialPriceAdjustValue = 0,
  } = settings;

  let baseRawCost = 0;
  let adjustedRawCost = 0;

  // Step 1: ingredient line-item pricing with global adjustment support
  const enrichedIngredients = (ingredients || []).map((ing) => {
    const rawCost = Number(ing.material?.unitCost ?? 0);
    let effectiveCost = rawCost;
    if (rawMaterialPriceAdjustValue > 0) {
      if (rawMaterialPriceAdjustType === 'percent') {
        effectiveCost = rawCost * (1 + rawMaterialPriceAdjustValue / 100);
      } else {
        effectiveCost = rawCost + rawMaterialPriceAdjustValue;
      }
    }
    const qty = Number(ing.quantity || 0);
    const subtotal = effectiveCost * qty;
    baseRawCost += rawCost * qty;
    adjustedRawCost += subtotal;

    return {
      material: ing.material,
      quantity: qty,
      baseUnitCost: Math.round(rawCost * 100) / 100,
      effectiveUnitCost: Math.round(effectiveCost * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
    };
  });

  const rawMaterialCost = adjustedRawCost;

  // Step 2: hotel & cafe culinary costing parameters (as per standard recipe cost sheet)
  const contingencyAmount = rawMaterialCost * (contingencyPercent / 100);
  const overheadAmount = rawMaterialCost * (overheadPercent / 100);
  const spiceAmount = rawMaterialCost * (spiceCostPercent / 100);
  const totalCost = rawMaterialCost + contingencyAmount + overheadAmount + spiceAmount;

  // Step 3: suggested selling price (back-calc from food cost %)
  const foodCostFraction = Math.max(defaultFoodCostPercent, 1) / 100;
  const suggestedSellingPrice = totalCost / foodCostFraction;

  return {
    rawMaterialCost: Math.round(rawMaterialCost * 100) / 100,
    baseMaterialCost: Math.round(baseRawCost * 100) / 100,
    contingencyPercent,
    contingencyAmount: Math.round(contingencyAmount * 100) / 100,
    overheadPercent,
    overheadAmount: Math.round(overheadAmount * 100) / 100,
    spiceCostPercent,
    spiceAmount: Math.round(spiceAmount * 100) / 100,
    totalCost: Math.round(totalCost * 100) / 100,
    suggestedSellingPrice: Math.round(suggestedSellingPrice * 100) / 100,
    // Selling prices at common food cost benchmarks
    sellingAt30pct: Math.round((totalCost / 0.30) * 100) / 100,
    sellingAt35pct: Math.round((totalCost / 0.35) * 100) / 100,
    sellingAt40pct: Math.round((totalCost / 0.40) * 100) / 100,
    sellingAt50pct: Math.round((totalCost / 0.50) * 100) / 100,
    ingredients: enrichedIngredients,
    // Settings used (for display in UI)
    settings: {
      contingencyPercent,
      overheadPercent,
      spiceCostPercent,
      defaultFoodCostPercent,
      rawMaterialPriceAdjustType,
      rawMaterialPriceAdjustValue,
    },
  };
}

// GET /api/products
const getProducts = asyncHandler(async (req, res) => {
  const { search, pos } = req.query;
  const filter = { isActive: true };
  if (search && search.trim()) {
    filter.name = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
  }

  // Fast POS Mode: lightweight query, no deep populate/cost calculation needed for cashier terminal
  if (pos === 'true' || pos === '1') {
    const products = await Product.find(filter)
      .select('name code category parentCategory sellingPrice ingredients isActive uom')
      .sort({ name: 1 })
      .lean();
    return res.json(products);
  }

  const [products, settings] = await Promise.all([
    Product.find(filter)
      .populate('ingredients.material', 'name unit unitCost')
      .sort({ createdAt: -1 })
      .lean(),
    Setting.findOne().lean(),
  ]);

  const mapped = products.map((p) => {
    const breakdown = calcRecipeCostBreakdown(p.ingredients, settings || {});
    return {
      ...p,
      recipeCost: breakdown.rawMaterialCost, // backward-compatible: raw cost only
      costBreakdown: breakdown,              // full breakdown for UI
    };
  });

  res.json(mapped);
});

// GET /api/products/:id
const getProductById = asyncHandler(async (req, res) => {
  const [product, settings] = await Promise.all([
    Product.findById(req.params.id)
      .populate('ingredients.material', 'name unit unitCost'),
    Setting.findOne().lean(),
  ]);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  const obj = product.toJSON();
  obj.costBreakdown = calcRecipeCostBreakdown(obj.ingredients, settings || {});
  res.json(obj);
});

// POST /api/products
const createProduct = asyncHandler(async (req, res) => {
  const { name, category, description, sellingPrice, ingredients, code, uom, parentCategory, imageUrl } = req.body;

  if (!name?.trim()) { res.status(400); throw new Error('Product name is required.'); }
  if (sellingPrice !== undefined && Number(sellingPrice) < 0) {
    res.status(400);
    throw new Error('Selling price cannot be negative.');
  }

  // Product code handling: auto-generate next sequential code if blank
  let trimmedCode = (code || '').trim();
  if (!trimmedCode) {
    const allProducts = await Product.find({ code: { $regex: /^P-?\d+$/i } }, 'code').lean();
    let maxNum = 0;
    let detectedPad = 4;
    allProducts.forEach((p) => {
      const match = String(p.code || '').match(/^P-?(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
          detectedPad = match[1].length;
        }
      }
    });
    const nextNum = maxNum + 1;
    trimmedCode = `P-${String(nextNum).padStart(Math.max(detectedPad, 3), '0')}`;
  } else {
    const existing = await Product.findOne({
      code: { $regex: `^${trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-*$`, $options: 'i' },
      isActive: true,
    });
    if (existing) {
      res.status(400);
      throw new Error(`Product code "${trimmedCode}" is already used by "${existing.name}". Please use a different code.`);
    }
  }

  // Duplicate name check
  const existingName = await Product.findOne({
    name: { $regex: `^${name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
    isActive: true,
  });
  if (existingName) {
    res.status(400);
    throw new Error(`A product named "${name.trim()}" already exists (Code: ${existingName.code || 'no code'}). Use a different name.`);
  }

  const product = await Product.create({
    code: trimmedCode,
    name: name.trim(),
    category,
    parentCategory,
    uom,
    description,
    sellingPrice,
    ingredients,
    imageUrl: imageUrl ? imageUrl.trim() : '',
  });
  const populated = await product.populate('ingredients.material', 'name unit unitCost');
  tg.notifyProductCreated(populated, req.user);
  invalidateDashboardCache();
  res.status(201).json(populated);
});


// PUT /api/products/:id
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }

  const { name, category, description, sellingPrice, ingredients, code, uom, parentCategory, imageUrl } = req.body;

  // Duplicate code check — only if code is being changed to a non-empty value
  const trimmedCode = code !== undefined ? (code || '').trim() : null;
  if (trimmedCode && trimmedCode !== (product.code || '').trim()) {
    const conflict = await Product.findOne({
      _id: { $ne: product._id },
      code: { $regex: `^${trimmedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-*$`, $options: 'i' },
      isActive: true,
    });
    if (conflict) {
      res.status(400);
      throw new Error(`Product code "${trimmedCode}" is already used by "${conflict.name}". Choose a different code.`);
    }
  }

  // Duplicate name check — only if name is being changed to something different
  const trimmedName = name !== undefined ? (name || '').trim() : null;
  if (trimmedName && trimmedName.toLowerCase() !== product.name.trim().toLowerCase()) {
    const nameConflict = await Product.findOne({
      _id: { $ne: product._id },
      name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      isActive: true,
    });
    if (nameConflict) {
      res.status(400);
      throw new Error(`A product named "${trimmedName}" already exists. Use a different name.`);
    }
  }

  // Track price change before overwriting
  const oldPrice = product.sellingPrice;
  const oldIngCount = product.ingredients?.length || 0;

  if (trimmedCode !== null) product.code = trimmedCode;
  if (trimmedName) product.name = trimmedName;
  product.category = category ?? product.category;
  product.parentCategory = parentCategory ?? product.parentCategory;
  product.uom = uom ?? product.uom;
  product.description = description ?? product.description;
  product.sellingPrice = sellingPrice ?? product.sellingPrice;
  product.ingredients = ingredients ?? product.ingredients;
  if (imageUrl !== undefined) product.imageUrl = imageUrl ? imageUrl.trim() : '';

  const updated = await product.save();
  const populated = await updated.populate('ingredients.material', 'name unit unitCost');

  // Build diff for notification
  const changes = [];
  if (name !== undefined && name !== populated.name) changes.push({ label: 'Name', from: product.name, to: name });
  if (category !== undefined && category !== populated.category) changes.push({ label: 'Category', from: product.category, to: category });
  if (sellingPrice !== undefined && Number(sellingPrice) !== Number(oldPrice))
    changes.push({ label: 'Selling Price', from: `ETB ${Number(oldPrice).toFixed(2)}`, to: `ETB ${Number(sellingPrice).toFixed(2)}` });
  if (ingredients !== undefined && ingredients.length !== oldIngCount)
    changes.push({ label: 'Ingredients', from: `${oldIngCount} items`, to: `${ingredients.length} items` });

  tg.notifyProductUpdated(populated, req.user, changes);
  invalidateDashboardCache();
  res.json(populated);
});

// DELETE /api/products/:id  (soft delete → recycle bin)
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  product.isActive = false;
  product.deletedAt = new Date();
  product.deletedBy = req.user?.name || 'System';
  product.deletedFrom = 'products';
  await product.save();
  tg.notifyProductDeleted(product, req.user);
  invalidateDashboardCache();
  res.json({ message: 'Product moved to recycle bin.' });
});

// DELETE /api/products/bulk  (bulk soft delete)
const bulkDeleteProducts = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!ids || !ids.length) { res.status(400); throw new Error('No ids provided'); }
  await Product.updateMany(
    { _id: { $in: ids } },
    { isActive: false, deletedAt: new Date(), deletedBy: req.user?.name || 'System', deletedFrom: 'products' }
  );
  invalidateDashboardCache();
  res.json({ message: `${ids.length} product(s) moved to recycle bin.` });
});

// POST /api/products/:id/restore
const restoreProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  product.isActive = true;
  product.deletedAt = null;
  product.deletedBy = null;
  product.deletedFrom = null;
  await product.save();
  invalidateDashboardCache();
  res.json({ message: 'Product restored.', product });
});

// DELETE /api/products/:id/permanent
const permanentDeleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) { res.status(404); throw new Error('Product not found'); }
  await product.deleteOne();
  invalidateDashboardCache();
  res.json({ message: 'Product permanently deleted.' });
});


// GET /api/products/export/excel
// Exports in the Baba Roti  Caféformat:
// Code | Name | UOM | Child Category | Parent Category | Default Value | Default Tax | Created On | State
const exportProductsExcel = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true })
    .populate('ingredients.material', 'name unit unitCost')
    .sort({ createdAt: 1 });

  const rows = products.map((p, i) => ({
    'Code': p.code || `P-${String(i + 1).padStart(4, '0')}`,
    'Name': p.name,
    'UOM': p.uom || 'Pcs',
    'Child Category': p.category || '',
    'Parent Category': p.parentCategory || 'FOOD',
    'Default Value': p.sellingPrice ?? 0,
    'Default Tax': 1,
    'Created On': p.createdAt ? new Date(p.createdAt).toISOString() : '',
    'State': p.isActive ? 'Active' : 'Inactive',
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [12, 30, 6, 18, 16, 14, 12, 22, 8].map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Disposition', 'attachment; filename="products.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// POST /api/products/import/excel
// Accepts the Baba Roti  Caféformat:
// Code | Name | UOM | Child Category | Parent Category | Default Value | Default Tax | Created On | State
const importProductsExcel = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Pre-filter valid rows — only skip truly empty names and the "Count:" summary row
  const validRows = rows.filter(row => {
    const name = String(row['Name'] || row['Product Name'] || '').trim();
    if (!name) return false;
    // Skip the Excel summary row "Count: 203" etc.
    if (/^Count:/i.test(name)) return false;
    // Skip rows where Name is literally a header repeat
    if (name.toLowerCase() === 'name') return false;
    return true;
  });

  const total = validRows.length;
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Use SSE (Server-Sent Events) to stream progress back to client
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  send({ type: 'start', total });

  // Track which DB _ids have already been updated in THIS import run.
  // If the same _id is matched again (duplicate row in Excel), we create a NEW product.
  const processedIds = new Set();

  for (let i = 0; i < validRows.length; i++) {
    const row = validRows[i];

    const name = String(row['Name'] || row['Product Name'] || '').trim();
    // Normalize code — strip trailing dashes/spaces (source system quirk)
    const code = String(row['Code'] || '').trim().replace(/-+$/, '');

    const data = {
      name,
      code,
      uom: String(row['UOM'] || 'Pcs').trim(),
      category: String(row['Child Category'] || row['Category'] || 'General').trim(),
      parentCategory: String(row['Parent Category'] || 'FOOD').trim(),
      sellingPrice: Number(row['Default Value'] ?? row['Selling Price'] ?? 0) || 0,
      description: String(row['Description'] || '').trim(),
    };

    try {
      let existing = null;

      // 1️⃣ Match by normalized Code (exact, case-insensitive)
      if (code) {
        const escapedCode = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Also try matching the code with trailing dash (stored format)
        existing = await Product.findOne({
          code: { $regex: `^${escapedCode}-?$`, $options: 'i' },
        });
        // Only use this match if it hasn't been processed already
        if (existing && processedIds.has(existing._id.toString())) {
          existing = null; // Force create — this DB record was already updated this run
        }
      }

      // 2️⃣ Fall back to exact name match (only if no code match)
      if (!existing) {
        const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const byName = await Product.findOne({ name: { $regex: `^${escapedName}$`, $options: 'i' } });
        // Only use name match if this record hasn't been updated yet this run
        if (byName && !processedIds.has(byName._id.toString())) {
          existing = byName;
        }
      }

      if (existing) {
        // Update existing record — preserve ingredients
        existing.name = data.name;
        existing.code = data.code || existing.code;
        existing.uom = data.uom;
        existing.category = data.category;
        existing.parentCategory = data.parentCategory;
        existing.sellingPrice = data.sellingPrice;
        existing.description = data.description || existing.description;
        existing.isActive = true;
        await existing.save();
        processedIds.add(existing._id.toString()); // Mark as processed
        updated++;
      } else {
        // No match found (or already updated this run) — create a brand-new product
        const created_ = await Product.create({ ...data, ingredients: [] });
        processedIds.add(created_._id.toString());
        created++;
      }
    } catch (err) {
      errors.push(`Row ${i + 1} "${name}": ${err.message}`);
      skipped++;
    }

    // Send progress every row
    send({
      type: 'progress',
      current: i + 1,
      total,
      percent: Math.round(((i + 1) / total) * 100),
      created,
      updated,
      skipped,
    });
  }

  invalidateDashboardCache();
  send({ type: 'done', created, updated, skipped, errors, total });
  res.end();
});


// GET /api/products/export/recipe-template
// Downloads an Excel workbook pre-filled with all active products and their current recipes.
// Users edit this file and re-upload it to bulk-set ingredients.
// Format per row: Product Code | Product Name | Ingredient Name | Quantity | Unit
const exportRecipeTemplate = asyncHandler(async (req, res) => {
  const products = await Product.find({ isActive: true })
    .populate('ingredients.material', 'name unit')
    .sort({ name: 1 });

  const rows = [];

  for (const p of products) {
    if (p.ingredients && p.ingredients.length > 0) {
      for (const ing of p.ingredients) {
        rows.push({
          'Product Code': p.code || '',
          'Product Name': p.name,
          'Ingredient Name': ing.material?.name || '',
          'Quantity': ing.quantity,
          'Unit': ing.material?.unit || '',
        });
      }
    } else {
      // Include products with no recipe so user can easily add one
      rows.push({
        'Product Code': p.code || '',
        'Product Name': p.name,
        'Ingredient Name': '',
        'Quantity': '',
        'Unit': '',
      });
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws['!cols'] = [14, 28, 26, 10, 10].map((w) => ({ wch: w }));

  // Add a bright-yellow Instructions sheet so users know the format
  const instructions = [
    { 'HOW TO USE THIS TEMPLATE': '1. Do NOT rename or reorder columns.' },
    { 'HOW TO USE THIS TEMPLATE': '2. "Product Code" OR "Product Name" must match an existing product.' },
    { 'HOW TO USE THIS TEMPLATE': '3. "Ingredient Name" must exactly match a Raw Material name in the system.' },
    { 'HOW TO USE THIS TEMPLATE': '4. "Quantity" is the amount of the ingredient per 1 unit of the product.' },
    { 'HOW TO USE THIS TEMPLATE': '5. "Unit" is informational — the system reads the unit from the raw material.' },
    { 'HOW TO USE THIS TEMPLATE': '6. To REPLACE a product\'s entire recipe: list all ingredients in consecutive rows.' },
    { 'HOW TO USE THIS TEMPLATE': '7. Leave "Ingredient Name" blank to clear / skip that product\'s recipe.' },
    { 'HOW TO USE THIS TEMPLATE': '8. Save as .xlsx and use the "Import Recipes" button in the Products page.' },
  ];
  const wsInfo = XLSX.utils.json_to_sheet(instructions);
  wsInfo['!cols'] = [{ wch: 90 }];

  XLSX.utils.book_append_sheet(wb, ws, 'Recipes');
  XLSX.utils.book_append_sheet(wb, wsInfo, 'Instructions');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="recipe_template.xlsx"');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});


// POST /api/products/import/recipes
// Accepts the recipe template Excel file and bulk-updates product ingredients.
// Rows are grouped by Product Code / Name; all rows for the same product
// collectively REPLACE that product's entire ingredient list.
const importRecipesExcel = asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('No file uploaded'); }

  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const ws = wb.Sheets[wb.SheetNames[0]]; // always read first sheet
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  // Filter out blank / header rows
  const validRows = rows.filter((r) => {
    const name = String(r['Product Name'] || '').trim();
    const code = String(r['Product Code'] || '').trim();
    return name || code;
  });

  const total = validRows.length;
  let updated = 0;
  let skipped = 0;
  const errors = [];

  // Stream progress via SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'start', total });

  // Pre-load all active raw materials once (name → ObjectId map, case-insensitive)
  const allMaterials = await RawMaterial.find({ isActive: { $ne: false } }).select('name unit').lean();
  const materialMap = new Map(allMaterials.map((m) => [m.name.trim().toLowerCase(), m]));

  // Group rows by product identifier (code takes precedence over name)
  // Map: productKey → { code, name, ingredientRows[] }
  const productGroups = new Map();
  for (const row of validRows) {
    const code = String(row['Product Code'] || '').trim();
    const name = String(row['Product Name'] || '').trim();
    const key = code || name.toLowerCase();
    if (!productGroups.has(key)) {
      productGroups.set(key, { code, name, rows: [] });
    }
    productGroups.get(key).rows.push(row);
  }

  let processed = 0;
  for (const [, group] of productGroups) {
    const { code, name, rows: groupRows } = group;

    try {
      // Resolve the product
      let product = null;
      if (code) {
        const escaped = code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        product = await Product.findOne({ code: { $regex: `^${escaped}-?$`, $options: 'i' }, isActive: true });
      }
      if (!product && name) {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        product = await Product.findOne({ name: { $regex: `^${escaped}$`, $options: 'i' }, isActive: true });
      }

      if (!product) {
        errors.push(`Product not found: "${code || name}" — skipped`);
        skipped += groupRows.length;
        processed += groupRows.length;
        send({ type: 'progress', current: processed, total, percent: Math.round((processed / total) * 100), updated, skipped });
        continue;
      }

      // Build ingredient array from all rows for this product
      const ingredients = [];
      for (const row of groupRows) {
        const ingName = String(row['Ingredient Name'] || '').trim();
        if (!ingName) continue; // blank ingredient = skip row (not an error)

        const qty = parseFloat(row['Quantity']);
        if (!qty || qty <= 0) {
          errors.push(`Row for "${product.name}" — ingredient "${ingName}": invalid quantity "${row['Quantity']}"`);
          continue;
        }

        const mat = materialMap.get(ingName.toLowerCase());
        if (!mat) {
          errors.push(`Row for "${product.name}" — raw material "${ingName}" not found in system`);
          continue;
        }

        // Avoid duplicate ingredients for the same material in the same product
        if (!ingredients.find((i) => i.material.toString() === mat._id.toString())) {
          ingredients.push({ material: mat._id, quantity: qty });
        }
      }

      // Replace the product's ingredient list
      product.ingredients = ingredients;
      await product.save();
      updated++;
    } catch (err) {
      errors.push(`"${code || name}": ${err.message}`);
      skipped++;
    }

    processed += groupRows.length;
    send({
      type: 'progress',
      current: processed,
      total,
      percent: Math.round((processed / total) * 100),
      updated,
      skipped,
    });
  }

  invalidateDashboardCache();
  send({ type: 'done', updated, skipped, errors, total: productGroups.size });
  res.end();
});

// @desc   Get public menu items for customer digital menu (no auth needed)
// @route  GET /api/products/public-menu
// @access Public
const getPublicMenu = asyncHandler(async (req, res) => {
  const [products, rawMaterials, settings] = await Promise.all([
    Product.find({ isActive: true, deletedAt: null, isAvailableOnMenu: { $ne: false } })
      .select('name code category parentCategory sellingPrice description uom imageUrl isFeatured nameAmharic descriptionAmharic manualOutOfStock ingredients')
      .sort({ isFeatured: -1, category: 1, name: 1 })
      .lean(),
    RawMaterial.find({ isActive: true, deletedAt: null }).select('_id currentStock unit').lean(),
    Setting.findOne().lean(),
  ]);

  const stockMap = new Map(rawMaterials.map((m) => [String(m._id), Number(m.currentStock || 0)]));

  // Determine real-time stock shortage for each product
  const enrichedProducts = products.map((p) => {
    let isOutOfStock = !!p.manualOutOfStock;
    let shortageIngredient = '';

    if (!isOutOfStock && p.ingredients && p.ingredients.length > 0) {
      for (const ing of p.ingredients) {
        const matId = String(ing.material?._id || ing.material);
        const available = stockMap.get(matId);
        if (available !== undefined && available <= 0) {
          isOutOfStock = true;
          shortageIngredient = 'Stock Depleted';
          break;
        }
      }
    }

    return {
      _id: p._id,
      name: p.name,
      nameAmharic: p.nameAmharic || '',
      code: p.code,
      category: p.category || 'General',
      parentCategory: p.parentCategory || 'FOOD',
      sellingPrice: p.sellingPrice || 0,
      description: p.description || '',
      descriptionAmharic: p.descriptionAmharic || '',
      uom: p.uom || 'Pcs',
      imageUrl: p.imageUrl || '',
      isFeatured: !!p.isFeatured,
      isOutOfStock,
      shortageIngredient,
    };
  });

  const categories = Array.from(new Set(enrichedProducts.map((p) => p.category || 'General')));

  res.json({
    success: true,
    isLicensed: settings?.licensedModules?.digitalMenu !== false,
    cafeName: settings?.hotelName || 'Baba Roti Café',
    tagline: 'Good Food • Good Mood',
    currency: settings?.currency || 'ETB',
    taxRate: Number(settings?.taxRate ?? 15),
    enableServiceCharge: !!settings?.enableServiceCharge,
    serviceChargeRate: Number(settings?.serviceChargeRate ?? 10),
    digitalMenuSettings: settings?.digitalMenuSettings || {},
    categories,
    products: enrichedProducts,
  });
});

// @desc   Update single product menu visibility / stock availability
// @route  PUT /api/products/:id/menu-visibility
// @access Private
const toggleMenuVisibility = asyncHandler(async (req, res) => {
  const { isAvailableOnMenu, manualOutOfStock, isFeatured } = req.body;
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (isAvailableOnMenu !== undefined) product.isAvailableOnMenu = !!isAvailableOnMenu;
  if (manualOutOfStock !== undefined) product.manualOutOfStock = !!manualOutOfStock;
  if (isFeatured !== undefined) product.isFeatured = !!isFeatured;

  await product.save();
  invalidateDashboardCache();
  res.json({ success: true, product, message: 'Menu display status updated.' });
});

// @desc   Bulk update all products menu visibility (turn all ON or all OFF)
// @route  POST /api/products/bulk-menu-visibility
// @access Private (Admin, Manager)
const bulkMenuVisibility = asyncHandler(async (req, res) => {
  const { isAvailableOnMenu } = req.body;
  await Product.updateMany(
    { isActive: true, deletedAt: null },
    { $set: { isAvailableOnMenu: !!isAvailableOnMenu } }
  );
  invalidateDashboardCache();
  res.json({
    success: true,
    message: `All food items ${isAvailableOnMenu ? 'displayed on' : 'hidden from'} Customer Digital Menu.`,
  });
});

// @desc   Generate AI-based food/beverage photo for product and save to GridFS
// @route  POST /api/products/:id/ai-image
// @access Private (Admin, Manager, Supervisor)
const generateProductAiImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  const { prompt } = req.body;
  const result = await generateAndSaveProductImage(product, prompt);

  product.imageUrl = result.imageUrl;
  await product.save();
  invalidateDashboardCache();

  res.json({
    success: true,
    imageUrl: product.imageUrl,
    prompt: result.prompt,
    product,
    message: `AI image successfully generated and saved for "${product.name}".`,
  });
});

// @desc   Upload manual image file from computer for product and save to GridFS
// @route  POST /api/products/:id/image
// @access Private (Admin, Manager, Supervisor)
const uploadProductImageManual = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  if (!req.file || !req.file.buffer) {
    res.status(400);
    throw new Error('No image file uploaded');
  }

  // Validate mime type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(req.file.mimetype)) {
    res.status(400);
    throw new Error('Invalid image format. Supported formats: JPG, PNG, WEBP, GIF');
  }

  const ext = path.extname(req.file.originalname) || '.jpg';
  const filename = `prod-manual-${product._id}-${Date.now()}${ext}`;

  // 1. Upload buffer directly to MongoDB Atlas GridFS
  await uploadBufferToGridFS(filename, req.file.buffer, req.file.mimetype, {
    productId: product._id,
    productName: product.name,
    originalName: req.file.originalname,
    source: 'manual-upload',
    createdAt: new Date(),
  });

  // 2. Save optional local cache copy
  saveLocalCache(filename, req.file.buffer);

  // 3. Update product imageUrl
  product.imageUrl = `/api/upload/${filename}`;
  await product.save();
  invalidateDashboardCache();

  res.json({
    success: true,
    imageUrl: product.imageUrl,
    product,
    message: `Image for "${product.name}" uploaded successfully.`,
  });
});

// @desc   Bulk generate AI images for multiple or all products without images
// @route  POST /api/products/bulk-ai-images
// @access Private (Admin, Manager)
const bulkGenerateAiImages = asyncHandler(async (req, res) => {
  const { ids, overwrite = false, limit = 100 } = req.body;

  let query = { isActive: true, deletedAt: null };
  if (Array.isArray(ids) && ids.length > 0) {
    query._id = { $in: ids };
  } else if (!overwrite) {
    query.$or = [{ imageUrl: { $exists: false } }, { imageUrl: '' }, { imageUrl: null }];
  }

  const maxLimit = Math.min(Number(limit) || 100, 250);
  const productsToProcess = await Product.find(query).limit(maxLimit);
  if (productsToProcess.length === 0) {
    return res.json({
      success: true,
      total: 0,
      updated: 0,
      failed: 0,
      message: 'All matching products already have images.',
    });
  }

  let updatedCount = 0;
  let failedCount = 0;
  const results = [];

  for (const prod of productsToProcess) {
    try {
      const result = await generateAndSaveProductImage(prod);
      prod.imageUrl = result.imageUrl;
      await prod.save();
      updatedCount++;
      results.push({ id: prod._id, name: prod.name, imageUrl: result.imageUrl, status: 'success' });
      // Brief delay between requests
      await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      console.warn(`[Bulk AI Image] Failed for ${prod.name}:`, err.message);
      failedCount++;
      results.push({ id: prod._id, name: prod.name, error: err.message, status: 'failed' });
    }
  }

  invalidateDashboardCache();

  res.json({
    success: true,
    total: productsToProcess.length,
    updated: updatedCount,
    failed: failedCount,
    results,
    message: `Generated ${updatedCount} AI food images successfully (${failedCount} failed).`,
  });
});

// @desc   Remove image from product
// @route  DELETE /api/products/:id/image
// @access Private (Admin, Manager, Supervisor)
const deleteProductImage = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  product.imageUrl = '';
  await product.save();
  invalidateDashboardCache();

  res.json({
    success: true,
    product,
    message: `Image for "${product.name}" removed.`,
  });
});

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkDeleteProducts,
  restoreProduct,
  permanentDeleteProduct,
  exportProductsExcel,
  importProductsExcel,
  exportRecipeTemplate,
  importRecipesExcel,
  getPublicMenu,
  toggleMenuVisibility,
  bulkMenuVisibility,
  generateProductAiImage,
  uploadProductImageManual,
  bulkGenerateAiImages,
  deleteProductImage,
};
