const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');

const dbUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;

async function seed(isCli = false) {
  if (mongoose.connection.readyState === 0) {
    if (!dbUri) {
      console.error('No MongoDB URI found in environment variables!');
      if (isCli) process.exit(1);
      return;
    }
    await mongoose.connect(dbUri);
    console.log('Connected to MongoDB:', mongoose.connection.name);
  }

  const RawMaterial = require('./models/RawMaterial');
  const ProductionRecipe = require('./models/ProductionRecipe');
  const Product = require('./models/Product');
  const { convertUnit } = require('./utils/unitConverter');

  // 1. Helper to find or create raw material
  async function findOrCreateMaterial(name, unit, category, kitchenStock, mainStoreStock, unitCost) {
    let mat = await RawMaterial.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      isActive: true,
    });

    if (!mat) {
      mat = await RawMaterial.create({
        name,
        unit,
        category,
        kitchenStock,
        mainStoreStock,
        barStock: 0,
        currentStock: kitchenStock + mainStoreStock,
        unitCost,
        storeLocation: 'Kitchen Station',
        reorderLevel: 5,
      });
      console.log(`+ Created raw material: ${mat.name} (${kitchenStock} ${unit} in Kitchen)`);
    } else {
      // Ensure kitchen has enough stock for demonstration
      if ((mat.kitchenStock || 0) < kitchenStock) {
        mat.kitchenStock = kitchenStock;
        mat.currentStock = (mat.mainStoreStock || 0) + (mat.kitchenStock || 0) + (mat.barStock || 0);
        await mat.save();
        console.log(`✓ Updated kitchen stock for existing material: ${mat.name} -> ${mat.kitchenStock} ${mat.unit}`);
      } else {
        console.log(`✓ Existing material found: ${mat.name} (${mat.kitchenStock} ${mat.unit} in Kitchen)`);
      }
    }
    return mat;
  }

  // Raw materials for Mayonnaise
  const eggMat = await findOrCreateMaterial('Fresh Eggs', 'pcs', 'Kitchen', 50, 150, 15);
  const oilMat = await findOrCreateMaterial('Cooking Oil (Pure)', 'ltr', 'Kitchen', 20, 60, 180);
  const saltMat = await findOrCreateMaterial('Table Salt (Iodized)', 'kg', 'Kitchen', 10, 30, 35);
  const vinegarMat = await findOrCreateMaterial('White Vinegar / Lemon Juice', 'ltr', 'Kitchen', 5, 15, 65);

  // 2. Find or create the Target Produced Material: "Homemade Mayonnaise"
  let mayoMat = await RawMaterial.findOne({
    name: { $regex: /^Homemade Mayonnaise$|^Mayonnaise$/i },
    isActive: true,
  });

  if (!mayoMat) {
    mayoMat = await RawMaterial.create({
      code: 'PRD-MAYO',
      name: 'Homemade Mayonnaise',
      unit: 'kg',
      category: 'Kitchen Production',
      isProduced: true,
      itemType: 'produced',
      productionStation: 'kitchen',
      storeLocation: 'Kitchen Station',
      kitchenStock: 0, // starts at 0, will increase when produced!
      mainStoreStock: 0,
      barStock: 0,
      currentStock: 0,
      unitCost: 0,
      reorderLevel: 2,
    });
    console.log(`+ Created production item: ${mayoMat.name}`);
  } else {
    mayoMat.isProduced = true;
    mayoMat.itemType = 'produced';
    mayoMat.productionStation = 'kitchen';
    await mayoMat.save();
    console.log(`✓ Marked existing item as produced: ${mayoMat.name}`);
  }

  // 3. Find or create the Production Recipe (Formula / BOM)
  const recipeIngredients = [
    { material: eggMat._id, quantity: 4, unit: 'pcs', notes: '4 large egg yolks' },
    { material: oilMat._id, quantity: 0.75, unit: 'ltr', notes: '750ml pure cooking oil' },
    { material: saltMat._id, quantity: 0.01, unit: 'kg', notes: '10g fine salt' },
    { material: vinegarMat._id, quantity: 0.05, unit: 'ltr', notes: '50ml vinegar or lemon juice' },
  ];

  // Calculate estimated cost
  let estimatedCost = 0;
  estimatedCost += 4 * (eggMat.unitCost || 15);
  estimatedCost += 0.75 * (oilMat.unitCost || 180);
  estimatedCost += 0.01 * (saltMat.unitCost || 35);
  estimatedCost += 0.05 * (vinegarMat.unitCost || 65);

  let mayoRecipe = await ProductionRecipe.findOne({
    targetMaterial: mayoMat._id,
    isActive: true,
  });

  if (!mayoRecipe) {
    mayoRecipe = await ProductionRecipe.create({
      code: 'KPRC-0001',
      name: 'Homemade Mayonnaise Formula',
      station: 'kitchen',
      targetMaterial: mayoMat._id,
      yieldQuantity: 1,
      yieldUnit: 'kg',
      ingredients: recipeIngredients,
      instructions:
        '1. Place 4 egg yolks, 10g salt, and 50ml vinegar into a clean food processor or mixing bowl.\n' +
        '2. Blend on low speed until smooth and slightly pale.\n' +
        '3. Slowly drizzle in 750ml cooking oil in a continuous thin stream while blending until emulsion forms.\n' +
        '4. Taste and adjust seasoning if necessary.\n' +
        '5. Transfer to clean food-grade containers, label with date and batch #, and store in Kitchen refrigerator (2-4°C).',
      estimatedUnitCost: Math.round(estimatedCost * 100) / 100,
    });
    console.log(`+ Created Production Recipe: "${mayoRecipe.name}" (Est. Cost: ETB ${mayoRecipe.estimatedUnitCost} / kg)`);
  } else {
    mayoRecipe.ingredients = recipeIngredients;
    mayoRecipe.estimatedUnitCost = Math.round(estimatedCost * 100) / 100;
    await mayoRecipe.save();
    console.log(`✓ Updated Production Recipe: "${mayoRecipe.name}"`);
  }

  // Link recipe to material
  mayoMat.productionRecipe = mayoRecipe._id;
  if (!mayoMat.unitCost) mayoMat.unitCost = mayoRecipe.estimatedUnitCost;
  await mayoMat.save();

  // 4. Create or update saleable POS menu product: "Extra Mayonnaise"
  let extraMayoProduct = await Product.findOne({
    name: { $regex: /^Extra Mayonnaise/i },
    isActive: true,
  });

  if (!extraMayoProduct) {
    extraMayoProduct = await Product.create({
      code: 'EXTRA-MAYO',
      name: 'Extra Mayonnaise (Serving)',
      category: 'Side & Extra',
      parentCategory: 'FOOD',
      uom: 'Portion',
      sellingPrice: 30,
      description: 'House-made creamy mayonnaise side portion (40g). Consumes finished mayonnaise from Kitchen Store.',
      isAvailableOnMenu: true,
      ingredients: [
        {
          material: mayoMat._id,
          quantity: 40,
          unit: 'g', // 40 grams = 0.04 kg
        },
      ],
    });
    console.log(`+ Created POS Menu Item: "${extraMayoProduct.name}" (Selling Price: ETB 30, Recipe: 40g Mayonnaise)`);
  } else {
    extraMayoProduct.ingredients = [
      {
        material: mayoMat._id,
        quantity: 40,
        unit: 'g',
      },
    ];
    await extraMayoProduct.save();
    console.log(`✓ Updated POS Menu Item: "${extraMayoProduct.name}" with 40g Mayonnaise recipe`);
  }

  console.log('\n======================================================');
  console.log('✓ EXAMPLE SETUP COMPLETE!');
  console.log('1. Production Recipe: "Homemade Mayonnaise Formula" (Yield: 1 KG)');
  console.log('   Ingredients: 4 Eggs, 0.75 L Oil, 0.01 KG Salt, 0.05 L Vinegar');
  console.log(`2. Kitchen Raw Stock Ready: Eggs (${eggMat.kitchenStock}), Oil (${oilMat.kitchenStock}L), Salt (${saltMat.kitchenStock}kg)`);
  console.log('3. Finished Mayonnaise Current Stock: 0 KG (Ready to produce)');
  console.log('4. POS Product: "Extra Mayonnaise (Serving)" -> Consumes 40g Mayonnaise');
  console.log('======================================================');
  if (isCli) process.exit(0);
}

if (require.main === module) {
  seed(true).catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  });
}

module.exports = { seedExampleProduction: seed };
