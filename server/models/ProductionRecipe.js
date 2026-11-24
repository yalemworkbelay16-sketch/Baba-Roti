const mongoose = require('mongoose');

const productionIngredientSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    quantity: { type: Number, required: true, min: 0.0001 },
    unit:     { type: String, default: '', trim: true },
    notes:    { type: String, default: '', trim: true },
  },
  { _id: false }
);

const productionRecipeSchema = new mongoose.Schema(
  {
    code:           { type: String, trim: true, default: '' },
    name:           { type: String, required: true, trim: true },
    station:        { type: String, enum: ['kitchen', 'bar'], default: 'kitchen', required: true },
    targetMaterial: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    yieldQuantity:  { type: Number, required: true, default: 1, min: 0.001 },
    yieldUnit:      { type: String, required: true, default: 'kg', trim: true },
    ingredients:    [productionIngredientSchema],
    instructions:   { type: String, default: '', trim: true },
    estimatedUnitCost: { type: Number, default: 0 },
    isActive:       { type: Boolean, default: true },
    createdBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productionRecipeSchema.index({ station: 1, isActive: 1 });
productionRecipeSchema.index({ targetMaterial: 1 });
productionRecipeSchema.index({ name: 1 });

module.exports = mongoose.model('ProductionRecipe', productionRecipeSchema);
