const mongoose = require('mongoose');

const consumedIngredientSchema = new mongoose.Schema(
  {
    material:     { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    materialName: { type: String, required: true },
    quantity:     { type: Number, required: true }, // amount in material's base unit
    inputQuantity: { type: Number, default: 0 },   // amount in recipe unit
    unit:         { type: String, default: '' },
    unitCost:     { type: Number, default: 0 },
    totalCost:    { type: Number, default: 0 },
  },
  { _id: false }
);

const productionSchema = new mongoose.Schema(
  {
    batchNo:            { type: String, required: true, unique: true, index: true },
    recipe:             { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionRecipe', required: true },
    recipeName:         { type: String, required: true },
    station:            { type: String, enum: ['kitchen', 'bar'], required: true },
    targetMaterial:     { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    targetMaterialName: { type: String, required: true },
    producedQuantity:   { type: Number, required: true, min: 0.001 },
    producedUnit:       { type: String, required: true },
    ingredientsConsumed: [consumedIngredientSchema],
    totalCost:          { type: Number, default: 0 },
    calculatedUnitCost: { type: Number, default: 0 },
    producedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    producedByName:     { type: String, default: 'Staff' },
    productionDate:     { type: Date, default: Date.now, index: true },
    notes:              { type: String, trim: true, default: '' },
    status:             { type: String, enum: ['completed', 'voided'], default: 'completed' },
    isVoided:           { type: Boolean, default: false },
    voidReason:         { type: String, default: '' },
    voidedBy:           { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    voidedByName:       { type: String, default: '' },
    voidedAt:           { type: Date },
    stockTransaction:   { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
  },
  { timestamps: true }
);

productionSchema.index({ station: 1, productionDate: -1 });
productionSchema.index({ targetMaterial: 1 });

module.exports = mongoose.model('Production', productionSchema);
