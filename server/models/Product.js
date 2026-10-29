const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    quantity: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' },
    name: { type: String, required: true, trim: true },
    category: { type: String, trim: true, default: 'General' },      // Child Category
    parentCategory: { type: String, trim: true, default: 'FOOD' },   // Parent Category
    uom: { type: String, trim: true, default: 'Pcs' },               // Unit of Measure
    description: { type: String, trim: true, default: '' },
    sellingPrice: { type: Number, default: 0 },                      // Default Value
    imageUrl: { type: String, trim: true, default: '' },             // Food image photo
    ingredients: [ingredientSchema],
    isActive: { type: Boolean, default: true },
    deletedAt:   { type: Date, default: null },
    deletedBy:   { type: String, default: null },
    deletedFrom: { type: String, default: 'products' },
  },
  { timestamps: true }
);

productSchema.index({ isActive: 1, createdAt: -1 });
productSchema.index({ code: 1, isActive: 1 }, { sparse: true });
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });

productSchema.virtual('recipeCost').get(function () {
  return (this.ingredients || []).reduce((sum, ing) => {
    const unitCost = ing.material?.unitCost ?? 0;
    return sum + unitCost * (ing.quantity || 0);
  }, 0);
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', productSchema);

