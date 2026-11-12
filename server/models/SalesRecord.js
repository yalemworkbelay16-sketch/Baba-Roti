const mongoose = require('mongoose');

const saleLineSchema = new mongoose.Schema(
  {
    productName:    { type: String, required: true },
    productCode:    { type: String, default: '' },
    productId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    quantitySold:   { type: Number, required: true, default: 1 },
    sellingPrice:   { type: Number, default: 0 },   // revenue per unit (if known)
    revenue:        { type: Number, default: 0 },   // total revenue for this line
    cogs:           { type: Number, default: 0 },   // total ingredient cost
    grossProfit:    { type: Number, default: 0 },   // revenue - cogs
    matchStatus:    { type: String, default: 'matched' }, // 'recipe_deducted', 'direct_material', 'no_recipe', 'unmatched'
    ingredientsUsed: [
      {
        materialId:   { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
        materialName: { type: String },
        unit:         { type: String },
        quantityUsed: { type: Number },
        unitCost:     { type: Number },
        totalCost:    { type: Number },
      }
    ],
  },
  { _id: false }
);

const salesRecordSchema = new mongoose.Schema(
  {
    importDate:    { type: Date, default: Date.now },
    saleDate:      { type: Date, default: Date.now },
    reference:     { type: String, default: '' },         // e.g. POS order code
    notes:         { type: String, default: '' },
    source:        { type: String, default: 'excel_import' },

    lines:         [saleLineSchema],

    // Totals (aggregated from lines)
    totalRevenue:  { type: Number, default: 0 },
    totalCOGS:     { type: Number, default: 0 },
    grossProfit:   { type: Number, default: 0 },
    profitMargin:  { type: Number, default: 0 },          // percentage

    // Link to stock transaction created during import
    stockTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },

    importedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

salesRecordSchema.index({ 'lines.productCode': 1 });
salesRecordSchema.index({ saleDate: -1 });
salesRecordSchema.index({ importDate: -1 });

module.exports = mongoose.model('SalesRecord', salesRecordSchema);
