const mongoose = require('mongoose');

const rawMaterialSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },
    unit: { type: String, required: true, trim: true }, // kg, ltr, pcs, box...
    currentStock: { type: Number, required: true, default: 0 },
    // Multi-station stock breakdown
    mainStoreStock: { type: Number, default: 0 }, // Bulk warehouse inventory
    kitchenStock:   { type: Number, default: 0 }, // Working stock inside Kitchen
    barStock:       { type: Number, default: 0 }, // Working stock inside Bar / Barista
    reorderLevel: { type: Number, required: true, default: 10 },
    unitCost: { type: Number, default: 0 },
    storeLocation: { type: String, trim: true, default: 'Main Store' },
    // Production / Manufactured item flags
    isProduced: { type: Boolean, default: false },
    itemType: { type: String, enum: ['raw', 'produced', 'semi_finished'], default: 'raw' },
    productionStation: { type: String, enum: ['none', 'kitchen', 'bar'], default: 'none' },
    productionRecipe: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionRecipe', default: null },
    // Security & Audit Trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    createdByRole: { type: String, trim: true, default: '' },
    registrationSource: { type: String, enum: ['manual', 'excel_import', 'system'], default: 'manual' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true, default: '' },
    updatedByRole: { type: String, trim: true, default: '' },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
    deletedFrom: { type: String, default: null }, // 'materials' | 'suppliers' etc.
  },
  { timestamps: true }
);

rawMaterialSchema.index({ isActive: 1, currentStock: 1 });
rawMaterialSchema.index({ code: 1 });
rawMaterialSchema.index({ name: 1 });
rawMaterialSchema.index({ category: 1 });

rawMaterialSchema.pre('save', function (next) {
  const round = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
  if (this.isModified('mainStoreStock') || this.isModified('kitchenStock') || this.isModified('barStock')) {
    this.currentStock = round((this.mainStoreStock || 0) + (this.kitchenStock || 0) + (this.barStock || 0));
  } else if (this.isModified('currentStock') && !this.isModified('mainStoreStock') && !this.isModified('kitchenStock') && !this.isModified('barStock')) {
    const sum = (this.mainStoreStock || 0) + (this.kitchenStock || 0) + (this.barStock || 0);
    const diff = (this.currentStock || 0) - sum;
    this.mainStoreStock = round((this.mainStoreStock || 0) + diff);
  }
  next();
});

rawMaterialSchema.virtual('status').get(function () {
  if (this.currentStock <= 0) return 'out_of_stock';
  if (this.currentStock <= this.reorderLevel) return 'low_stock';
  return 'in_stock';
});

rawMaterialSchema.set('toJSON', { virtuals: true });
rawMaterialSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RawMaterial', rawMaterialSchema);

