const asyncHandler = require('express-async-handler');
const ProductionRecipe = require('../models/ProductionRecipe');
const Production = require('../models/Production');
const RawMaterial = require('../models/RawMaterial');
const StockTransaction = require('../models/StockTransaction');
const Setting = require('../models/Setting');
const { convertUnit, areUnitsCompatible, isDiscreteUnit, cleanQuantity } = require('../utils/unitConverter');
const { getStationField, getStationLabel } = require('../utils/stationHelper');
const { invalidateDashboardCache } = require('./dashboardController');
const tg = require('../utils/telegramNotifier');
const { logActivity } = require('../utils/activityLogger');

// ── Auto Voucher Sequencers ──────────────────────────────────────────
const generateBatchNo = async () => {
  const count = await Production.countDocuments();
  return `PRD-${String(count + 1).padStart(5, '0')}`;
};
const generateRecipeCode = async (station = 'kitchen') => {
  const prefix = station === 'bar' ? 'BPRC' : 'KPRC';
  const count = await ProductionRecipe.countDocuments({ station });
  return `${prefix}-${String(count + 1).padStart(4, '0')}`;
};
// ── GET /api/production/recipes ──────────────────────────────────────
const getProductionRecipes = asyncHandler(async (req, res) => {
  const { station, search, isActive } = req.query;
  const filter = {};
  if (station && station !== 'all') {
    filter.station = station;
  }
  if (isActive !== undefined) {
    filter.isActive = isActive === 'true';
  }
  if (search && search.trim()) {
    const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { name: new RegExp(q, 'i') },
      { code: new RegExp(q, 'i') },
    ];
  }
  const recipes = await ProductionRecipe.find(filter)
    .populate('targetMaterial', 'name unit currentStock mainStoreStock kitchenStock barStock unitCost category storeLocation isProduced')
    .populate('ingredients.material', 'name unit currentStock mainStoreStock kitchenStock barStock unitCost category storeLocation')
    .sort({ name: 1 })
    .lean();
  res.json(recipes);
});
// ── GET /api/production/recipes/:id ──────────────────────────────────
const getProductionRecipeById = asyncHandler(async (req, res) => {
  const recipe = await ProductionRecipe.findById(req.params.id)
    .populate('targetMaterial', 'name unit currentStock mainStoreStock kitchenStock barStock unitCost category storeLocation isProduced')
    .populate('ingredients.material', 'name unit currentStock mainStoreStock kitchenStock barStock unitCost category storeLocation')
    .lean();

  if (!recipe) {
    res.status(404);
    throw new Error('Production recipe not found');
  }
  res.json(recipe);
});
// ── POST /api/production/recipes ─────────────────────────────────────
const createProductionRecipe = asyncHandler(async (req, res) => {
  const {
    name,
    station = 'kitchen',
    targetMaterial,
    yieldQuantity = 1,
    yieldUnit = 'kg',
    ingredients = [],
    instructions = '',
  } = req.body;
  if (!name || !name.trim()) {
    res.status(400);
    throw new Error('Recipe name is required');
  }
  if (!targetMaterial) {
    res.status(400);
    throw new Error('Target produced material is required');
  }
  if (Number(yieldQuantity) <= 0) {
    res.status(400);
    throw new Error('Yield quantity must be greater than zero');
  }
  if (!ingredients || ingredients.length === 0) {
    res.status(400);
    throw new Error('At least one ingredient is required in the production recipe');
  }
  const targetMat = await RawMaterial.findById(targetMaterial);
  if (!targetMat) {
    res.status(404);
    throw new Error('Target produced material does not exist in inventory');
  }
  // Pre-load ingredients to calculate estimated unit cost
  let totalCost = 0;
  const processedIngredients = [];
  for (const item of ingredients) {
    if (!item.material) continue;
    const mat = await RawMaterial.findById(item.material).lean();
    if (!mat) continue;
    const qty = Number(item.quantity) || 0;
    const ingUnit = (item.unit || mat.unit || '').trim();
    // Convert to material base unit for costing
    const baseQty = convertUnit(qty, ingUnit, mat.unit);
    const lineCost = baseQty * (Number(mat.unitCost) || 0);
    totalCost += lineCost;
    processedIngredients.push({
      material: mat._id,
      quantity: qty,
      unit: ingUnit,
      notes: (item.notes || '').trim(),
    });
  }
  const code = req.body.code?.trim() || await generateRecipeCode(station);
  const estimatedUnitCost = totalCost > 0 ? (totalCost / Number(yieldQuantity)) : 0;
  const recipe = await ProductionRecipe.create({
    code,
    name: name.trim(),
    station,
    targetMaterial: targetMat._id,
    yieldQuantity: Number(yieldQuantity),
    yieldUnit: (yieldUnit || targetMat.unit || 'kg').trim(),
    ingredients: processedIngredients,
    instructions: (instructions || '').trim(),
    estimatedUnitCost: Math.round(estimatedUnitCost * 100) / 100,
    createdBy: req.user?._id,
  });
  // Automatically mark target material as an internally produced item
  targetMat.isProduced = true;
  targetMat.itemType = 'produced';
  targetMat.productionStation = station;
  targetMat.productionRecipe = recipe._id;
  if (estimatedUnitCost > 0 && targetMat.unitCost === 0) {
    targetMat.unitCost = Math.round(estimatedUnitCost * 100) / 100;
  }
  await targetMat.save();

  logActivity(req, {
    action: 'CREATE_PRODUCTION_RECIPE',
    module: 'PRODUCTION',
    description: `Created production recipe "${recipe.name}" for ${targetMat.name} (Station: ${station.toUpperCase()})`,
    details: { recipeId: recipe._id, code: recipe.code, station, yieldQuantity, estimatedUnitCost },
  });
  res.status(201).json(recipe);
});
// ── PUT /api/production/recipes/:id ──────────────────────────────────
const updateProductionRecipe = asyncHandler(async (req, res) => {
  const recipe = await ProductionRecipe.findById(req.params.id);
  if (!recipe) {
    res.status(404);
    throw new Error('Production recipe not found');
  }
  const {
    name,
    station,
    targetMaterial,
    yieldQuantity,
    yieldUnit,
    ingredients,
    instructions,
    isActive,
  } = req.body;

  if (name !== undefined) recipe.name = name.trim();
  if (station !== undefined) recipe.station = station;
  if (yieldQuantity !== undefined) recipe.yieldQuantity = Number(yieldQuantity);
  if (yieldUnit !== undefined) recipe.yieldUnit = yieldUnit.trim();
  if (instructions !== undefined) recipe.instructions = instructions.trim();
  if (isActive !== undefined) recipe.isActive = Boolean(isActive);

  if (targetMaterial && String(targetMaterial) !== String(recipe.targetMaterial)) {
    recipe.targetMaterial = targetMaterial;
    await RawMaterial.findByIdAndUpdate(targetMaterial, {
      isProduced: true,
      itemType: 'produced',
      productionStation: recipe.station,
      productionRecipe: recipe._id,
    });
  }

  if (ingredients && Array.isArray(ingredients)) {
    let totalCost = 0;
    const processedIngredients = [];

    for (const item of ingredients) {
      if (!item.material) continue;
      const mat = await RawMaterial.findById(item.material).lean();
      if (!mat) continue;

      const qty = Number(item.quantity) || 0;
      const ingUnit = (item.unit || mat.unit || '').trim();
      const baseQty = convertUnit(qty, ingUnit, mat.unit);
      const lineCost = baseQty * (Number(mat.unitCost) || 0);
      totalCost += lineCost;

      processedIngredients.push({
        material: mat._id,
        quantity: qty,
        unit: ingUnit,
        notes: (item.notes || '').trim(),
      });
    }

    recipe.ingredients = processedIngredients;
    recipe.estimatedUnitCost = totalCost > 0 ? Math.round((totalCost / recipe.yieldQuantity) * 100) / 100 : 0;
  }

  recipe.updatedBy = req.user?._id;
  await recipe.save();

  logActivity(req, {
    action: 'UPDATE_PRODUCTION_RECIPE',
    module: 'PRODUCTION',
    description: `Updated production recipe "${recipe.name}"`,
    details: { recipeId: recipe._id, code: recipe.code },
  });
  res.json(recipe);
});
// ── DELETE /api/production/recipes/:id ───────────────────────────────
const deleteProductionRecipe = asyncHandler(async (req, res) => {
  const recipe = await ProductionRecipe.findById(req.params.id);
  if (!recipe) {
    res.status(404);
    throw new Error('Production recipe not found');
  }

  recipe.isActive = false;
  await recipe.save();

  logActivity(req, {
    action: 'DEACTIVATE_PRODUCTION_RECIPE',
    module: 'PRODUCTION',
    description: `Deactivated production recipe "${recipe.name}"`,
    details: { recipeId: recipe._id },
  });

  res.json({ success: true, message: 'Production recipe deactivated successfully' });
});

// ── POST /api/production/calculate-requirements ───────────────────────
// Live preview: calculates required ingredients for a planned batch qty
const calculateBatchRequirements = asyncHandler(async (req, res) => {
  const { recipeId, quantity = 1 } = req.body;
  if (!recipeId) {
    res.status(400);
    throw new Error('Recipe ID is required');
  }

  const recipe = await ProductionRecipe.findById(recipeId)
    .populate('targetMaterial', 'name unit currentStock kitchenStock barStock unitCost')
    .populate('ingredients.material', 'name unit currentStock kitchenStock barStock unitCost category storeLocation')
    .lean();

  if (!recipe) {
    res.status(404);
    throw new Error('Production recipe not found');
  }

  const plannedQty = Math.max(0.0001, Number(quantity) || 1);
  const ratio = plannedQty / Number(recipe.yieldQuantity || 1);
  const stationField = getStationField(recipe.station);
  const stationName = getStationLabel(recipe.station);

  let totalCost = 0;
  let canProduce = true;

  const ingredientRequirements = (recipe.ingredients || []).map((ing) => {
    const mat = ing.material;
    const isDiscrete = isDiscreteUnit(ing.unit, mat?.name) || isDiscreteUnit(mat?.unit, mat?.name);

    const recipeUnit = (ing.unit || mat?.unit || '').trim();
    const baseUnit = mat?.unit || recipeUnit;

    const rawReqRecipeQty = (Number(ing.quantity) || 0) * ratio;
    const reqRecipeQty = isDiscrete
      ? Math.max(1, Math.round(rawReqRecipeQty))
      : cleanQuantity(rawReqRecipeQty, recipeUnit, mat?.name);

    // Convert required qty from recipe unit to material base unit
    const rawReqBaseQty = convertUnit(reqRecipeQty, recipeUnit, baseUnit);
    const reqBaseQty = isDiscrete
      ? Math.max(1, Math.round(rawReqBaseQty))
      : cleanQuantity(rawReqBaseQty, baseUnit, mat?.name);

    const rawStock = Number(mat ? mat[stationField] || 0 : 0);
    const availableStationStock = cleanQuantity(rawStock, baseUnit, mat?.name);
    const isSufficient = availableStationStock >= reqBaseQty;
    if (!isSufficient) canProduce = false;

    const unitCost = Number(mat?.unitCost || 0);
    const lineCost = Math.round(reqBaseQty * unitCost * 100) / 100;
    totalCost += lineCost;

    const shortage = isSufficient
      ? 0
      : (isDiscrete ? Math.max(1, Math.round(reqBaseQty - availableStationStock)) : cleanQuantity(reqBaseQty - availableStationStock, baseUnit, mat?.name));

    return {
      materialId: mat?._id,
      materialName: mat?.name || 'Unknown Item',
      requiredRecipeQuantity: reqRecipeQty,
      recipeUnit,
      requiredBaseQuantity: reqBaseQty,
      baseUnit,
      availableStationStock,
      isSufficient,
      shortage,
      unitCost,
      totalCost: lineCost,
    };
  });

  const estimatedUnitCost = plannedQty > 0 ? Math.round((totalCost / plannedQty) * 100) / 100 : 0;

  res.json({
    recipeId: recipe._id,
    recipeName: recipe.name,
    station: recipe.station,
    stationName,
    plannedQuantity: plannedQty,
    yieldUnit: recipe.yieldUnit || recipe.targetMaterial?.unit || 'kg',
    targetMaterial: recipe.targetMaterial,
    canProduce,
    totalCost: Math.round(totalCost * 100) / 100,
    estimatedUnitCost,
    ingredients: ingredientRequirements,
  });
});

// ── POST /api/production/produce-batch ────────────────────────────────
// Executes a production batch:
// 1. Checks ingredient availability in Kitchen or Bar Store
// 2. Deducts raw ingredients from station stock
// 3. Adds produced quantity to station finished stock
// 4. Updates produced material unit cost
// 5. Saves Production and StockTransaction vouchers
const produceBatch = asyncHandler(async (req, res) => {
  const {
    recipeId,
    quantity,
    notes = '',
    productionDate = new Date(),
  } = req.body;

  if (!recipeId) {
    res.status(400);
    throw new Error('Recipe ID is required');
  }

  const prodQty = Number(quantity);
  if (!prodQty || prodQty <= 0) {
    res.status(400);
    throw new Error('Production quantity must be greater than zero');
  }

  const recipe = await ProductionRecipe.findById(recipeId)
    .populate('targetMaterial')
    .populate('ingredients.material');

  if (!recipe) {
    res.status(404);
    throw new Error('Production recipe not found');
  }

  const targetMat = recipe.targetMaterial;
  if (!targetMat) {
    res.status(404);
    throw new Error('Target produced material does not exist');
  }

  const station = recipe.station; // 'kitchen' or 'bar'
  const stationField = getStationField(station);
  const stationName = getStationLabel(station);

  // Check Settings for allowNegativeStock configuration
  const settings = await Setting.findOne().lean();
  const allowNegativeStock = Boolean(settings?.inventorySettings?.allowNegativeStock);

  const ratio = prodQty / Number(recipe.yieldQuantity || 1);
  const resolvedIngredients = [];
  let totalBatchCost = 0;

  // 1. Validate ingredient availability
  for (const ing of recipe.ingredients) {
    const mat = ing.material;
    if (!mat) continue;

    const isDiscrete = isDiscreteUnit(ing.unit, mat.name) || isDiscreteUnit(mat.unit, mat.name);

    const recipeUnit = (ing.unit || mat.unit || '').trim();
    const baseUnit = mat.unit || recipeUnit;

    const rawReqRecipeQty = (Number(ing.quantity) || 0) * ratio;
    const reqRecipeQty = isDiscrete
      ? Math.max(1, Math.round(rawReqRecipeQty))
      : cleanQuantity(rawReqRecipeQty, recipeUnit, mat.name);

    const rawReqBaseQty = convertUnit(reqRecipeQty, recipeUnit, baseUnit);
    const reqBaseQty = isDiscrete
      ? Math.max(1, Math.round(rawReqBaseQty))
      : cleanQuantity(rawReqBaseQty, baseUnit, mat.name);

    const rawBal = Number(mat[stationField] || 0);
    const availableBal = cleanQuantity(rawBal, baseUnit, mat.name);

    if (!allowNegativeStock && availableBal - reqBaseQty < -0.0001) {
      res.status(400);
      throw new Error(
        `Insufficient ${stationName} stock for ingredient "${mat.name}". Available: ${availableBal} ${mat.unit}, Required: ${reqBaseQty} ${mat.unit}. Please issue stock from Main Store.`
      );
    }

    const unitCost = Number(mat.unitCost || 0);
    const lineCost = Math.round(reqBaseQty * unitCost * 100) / 100;
    totalBatchCost += lineCost;

    resolvedIngredients.push({
      material: mat,
      recipeQuantity: reqRecipeQty,
      recipeUnit,
      baseQuantity: reqBaseQty,
      baseUnit,
      unitCost,
      totalCost: lineCost,
    });
  }

  // 2. Atomically deduct raw ingredients from Kitchen or Bar Store
  const stockTxnItems = [];

  for (const item of resolvedIngredients) {
    const mat = item.material;
    const deductQty = item.baseQuantity;

    const incUpdate = station === 'bar'
      ? { barStock: -deductQty, currentStock: -deductQty }
      : { kitchenStock: -deductQty, currentStock: -deductQty };

    await RawMaterial.findByIdAndUpdate(mat._id, {
      $inc: incUpdate,
    });

    stockTxnItems.push({
      material: mat._id,
      quantity: deductQty,
      unitCost: item.unitCost,
      totalCost: item.totalCost,
      station,
    });
  }

  // 3. Atomically add finished production item to Kitchen or Bar Store
  const incProduced = station === 'bar'
    ? { barStock: prodQty, currentStock: prodQty }
    : { kitchenStock: prodQty, currentStock: prodQty };

  // Calculate new unit cost (weighted average or latest batch cost)
  const calculatedUnitCost = prodQty > 0 ? Math.round((totalBatchCost / prodQty) * 100) / 100 : (targetMat.unitCost || 0);

  await RawMaterial.findByIdAndUpdate(targetMat._id, {
    $inc: incProduced,
    $set: {
      unitCost: calculatedUnitCost > 0 ? calculatedUnitCost : targetMat.unitCost,
      isProduced: true,
      itemType: 'produced',
      productionStation: station,
    },
  });

  // 4. Generate Production Batch Record
  const batchNo = await generateBatchNo();
  const production = await Production.create({
    batchNo,
    recipe: recipe._id,
    recipeName: recipe.name,
    station,
    targetMaterial: targetMat._id,
    targetMaterialName: targetMat.name,
    producedQuantity: prodQty,
    producedUnit: recipe.yieldUnit || targetMat.unit || 'kg',
    ingredientsConsumed: resolvedIngredients.map((i) => ({
      material: i.material._id,
      materialName: i.material.name,
      quantity: i.baseQuantity,
      inputQuantity: i.recipeQuantity,
      unit: i.recipeUnit || i.baseUnit,
      unitCost: i.unitCost,
      totalCost: i.totalCost,
    })),
    totalCost: Math.round(totalBatchCost * 100) / 100,
    calculatedUnitCost,
    producedBy: req.user?._id,
    producedByName: req.user?.name || 'Staff',
    productionDate: productionDate ? new Date(productionDate) : new Date(),
    notes: (notes || '').trim(),
    status: 'completed',
  });

  // 5. Create StockTransaction record for full audit trail
  try {
    const stockTxn = await StockTransaction.create({
      voucherType: 'production',
      voucherNo: batchNo,
      status: 'posted',
      station,
      items: stockTxnItems,
      reason: `Kitchen/Bar Production Batch #${batchNo} (${targetMat.name} x${prodQty} ${recipe.yieldUnit})`,
      performedBy: req.user?._id,
      date: production.productionDate,
      productionRef: production._id,
    });
    production.stockTransaction = stockTxn._id;
    await production.save();
  } catch (txnErr) {
    console.warn('[Production StockTxn Warning]:', txnErr.message);
  }

  invalidateDashboardCache();

  // Telegram alert
  if (tg && typeof tg.sendNotification === 'function') {
    try {
      const summaryMsg = `🏭 <b>${stationName} Production #${batchNo}</b>\n` +
        `📦 Produced: <b>${prodQty} ${recipe.yieldUnit || targetMat.unit}</b> of ${targetMat.name}\n` +
        `💰 Total Cost: ETB ${totalBatchCost.toFixed(2)} (Unit Cost: ETB ${calculatedUnitCost.toFixed(2)})\n` +
        `👨‍🍳 Produced By: ${production.producedByName}\n` +
        `📋 Ingredients Consumed: ${resolvedIngredients.map(i => `${i.material.name} (${i.baseQuantity} ${i.baseUnit})`).join(', ')}`;
      tg.sendNotification(summaryMsg);
    } catch (_) { }
  }

  logActivity(req, {
    action: 'PRODUCE_BATCH',
    module: 'PRODUCTION',
    description: `Produced ${prodQty} ${recipe.yieldUnit} of ${targetMat.name} in ${stationName} (Batch #${batchNo})`,
    details: {
      batchNo,
      recipeId: recipe._id,
      producedQuantity: prodQty,
      targetMaterial: targetMat.name,
      station,
      totalBatchCost,
      calculatedUnitCost,
      ingredientsCount: resolvedIngredients.length,
    },
  });

  res.status(201).json({
    success: true,
    production,
    message: `Batch #${batchNo} produced successfully! Added ${prodQty} ${recipe.yieldUnit} to ${stationName}.`,
  });
});

// ── GET /api/production/batches ───────────────────────────────────────
const getProductionBatches = asyncHandler(async (req, res) => {
  const { station, status, from, to, search, limit = 100 } = req.query;
  const filter = {};

  if (station && station !== 'all') {
    filter.station = station;
  }
  if (status) {
    filter.status = status;
  }
  if (from || to) {
    filter.productionDate = {};
    if (from) {
      const f = new Date(from);
      f.setHours(0, 0, 0, 0);
      filter.productionDate.$gte = f;
    }
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      filter.productionDate.$lte = t;
    }
  }
  if (search && search.trim()) {
    const q = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = [
      { batchNo: new RegExp(q, 'i') },
      { recipeName: new RegExp(q, 'i') },
      { targetMaterialName: new RegExp(q, 'i') },
      { producedByName: new RegExp(q, 'i') },
    ];
  }

  const batches = await Production.find(filter)
    .populate('targetMaterial', 'name unit currentStock kitchenStock barStock unitCost')
    .sort({ productionDate: -1, createdAt: -1 })
    .limit(Number(limit))
    .lean();

  const sanitizeBatch = (b) => {
    if (!b) return b;
    return {
      ...b,
      producedQuantity: cleanQuantity(b.producedQuantity, b.producedUnit, b.targetMaterialName),
      ingredientsConsumed: (b.ingredientsConsumed || []).map((i) => ({
        ...i,
        quantity: cleanQuantity(i.quantity, i.unit, i.materialName),
        inputQuantity: cleanQuantity(i.inputQuantity, i.unit, i.materialName),
      })),
    };
  };

  res.json(batches.map(sanitizeBatch));
});

// ── GET /api/production/batches/:id ──────────────────────────────────
const getProductionBatchById = asyncHandler(async (req, res) => {
  const batch = await Production.findById(req.params.id)
    .populate('targetMaterial', 'name unit currentStock kitchenStock barStock unitCost')
    .populate('recipe')
    .lean();

  if (!batch) {
    res.status(404);
    throw new Error('Production batch not found');
  }

  const sanitized = {
    ...batch,
    producedQuantity: cleanQuantity(batch.producedQuantity, batch.producedUnit, batch.targetMaterialName),
    ingredientsConsumed: (batch.ingredientsConsumed || []).map((i) => ({
      ...i,
      quantity: cleanQuantity(i.quantity, i.unit, i.materialName),
      inputQuantity: cleanQuantity(i.inputQuantity, i.unit, i.materialName),
    })),
  };

  res.json(sanitized);
});

// ── POST /api/production/batches/:id/void ────────────────────────────
// Reverses a production batch:
// - Deducts produced item from station stock
// - Restores consumed ingredients back to station stock
const voidProductionBatch = asyncHandler(async (req, res) => {
  const { reason = 'Production batch cancelled' } = req.body;
  const batch = await Production.findById(req.params.id);

  if (!batch) {
    res.status(404);
    throw new Error('Production batch not found');
  }
  if (batch.isVoided) {
    res.status(400);
    throw new Error('This production batch has already been voided');
  }

  const station = batch.station;
  const prodQty = Number(batch.producedQuantity || 0);

  // 1. Deduct finished product back from station stock
  const incReverseProduced = station === 'bar'
    ? { barStock: -prodQty, currentStock: -prodQty }
    : { kitchenStock: -prodQty, currentStock: -prodQty };

  await RawMaterial.findByIdAndUpdate(batch.targetMaterial, {
    $inc: incReverseProduced,
  });

  // 2. Restore consumed raw ingredients back to station stock
  for (const ing of batch.ingredientsConsumed) {
    const restoreQty = Number(ing.quantity || 0);
    if (ing.material && restoreQty > 0) {
      const incRestore = station === 'bar'
        ? { barStock: restoreQty, currentStock: restoreQty }
        : { kitchenStock: restoreQty, currentStock: restoreQty };

      await RawMaterial.findByIdAndUpdate(ing.material, {
        $inc: incRestore,
      });
    }
  }

  // 3. Mark batch as voided
  batch.isVoided = true;
  batch.status = 'voided';
  batch.voidReason = reason;
  batch.voidedBy = req.user?._id;
  batch.voidedByName = req.user?.name || 'Staff';
  batch.voidedAt = new Date();
  await batch.save();

  // 4. Mark linked stock transaction as voided
  if (batch.stockTransaction) {
    await StockTransaction.findByIdAndUpdate(batch.stockTransaction, {
      status: 'voided',
      reason: `[VOIDED PRODUCTION] ${reason}`,
    });
  }

  invalidateDashboardCache();

  logActivity(req, {
    action: 'VOID_PRODUCTION_BATCH',
    module: 'PRODUCTION',
    description: `Voided Production Batch #${batch.batchNo} (${batch.targetMaterialName} x${prodQty}) — Reason: ${reason}`,
    details: { batchNo: batch.batchNo, reason },
  });

  res.json({
    success: true,
    message: `Production batch #${batch.batchNo} voided successfully and stock was reversed.`,
    batch,
  });
});

// ── GET /api/production/produced-materials ───────────────────────────
// Returns all materials that are produced in Kitchen or Bar
const getProducedMaterials = asyncHandler(async (req, res) => {
  const { station } = req.query;
  const filter = { isActive: true, isProduced: true };
  if (station && station !== 'all') {
    filter.productionStation = station;
  }

  const materials = await RawMaterial.find(filter)
    .populate('productionRecipe', 'code name yieldQuantity yieldUnit estimatedUnitCost')
    .sort({ name: 1 })
    .lean();

  res.json(materials);
});

module.exports = {
  getProductionRecipes,
  getProductionRecipeById,
  createProductionRecipe,
  updateProductionRecipe,
  deleteProductionRecipe,
  calculateBatchRequirements,
  produceBatch,
  getProductionBatches,
  getProductionBatchById,
  voidProductionBatch,
  getProducedMaterials,
};
