const mongoose = require('mongoose');

const posOrderItemSchema = new mongoose.Schema(
  {
    product:        { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName:    { type: String, required: true },
    productCode:    { type: String, default: '' },
    category:       { type: String, default: 'General' },
    parentCategory: { type: String, default: 'FOOD' },
    quantity:       { type: Number, required: true, min: 0.001 },
    unitPrice:      { type: Number, required: true, min: 0 },
    totalPrice:     { type: Number, required: true, min: 0 },
    notes:          { type: String, default: '' },
    station:        { type: String, enum: ['kitchen', 'barista', 'general'], default: 'kitchen' },
    cogs:           { type: Number, default: 0 }, // Recipe cost at time of order
    ingredientsUsed: [
      {
        materialId:   { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
        materialName: { type: String },
        unit:         { type: String },
        quantityUsed: { type: Number },
        unitCost:     { type: Number },
        totalCost:    { type: Number },
        deductedFromStation: { type: String, default: 'mainStore' },
      },
    ],
  },
  { _id: false }
);

const posOrderSchema = new mongoose.Schema(
  {
    orderNo:         { type: String, required: true, unique: true, index: true },
    dailySequence:   { type: Number, default: 1 },
    orderType:       { type: String, enum: ['dine_in', 'takeaway', 'delivery'], default: 'dine_in' },
    tableNo:         { type: String, default: '' },
    customerName:    { type: String, default: 'Walk-in Guest' },
    customerPhone:   { type: String, default: '' },

    cashier:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    cashierName:     { type: String, required: true },

    waiter:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    waiterName:      { type: String, default: '' },
    captainOrderRef: { type: mongoose.Schema.Types.ObjectId, ref: 'CaptainOrder', default: null },

    items:           [posOrderItemSchema],

    subtotal:        { type: Number, required: true, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    taxPercent:      { type: Number, default: 15 },
    taxAmount:       { type: Number, default: 0 },
    serviceChargePercent: { type: Number, default: 0 },
    serviceCharge:   { type: Number, default: 0 },
    grandTotal:      { type: Number, required: true, default: 0 },
    totalCOGS:       { type: Number, default: 0 },

    paymentMethod:   { type: String, enum: ['Cash', 'Telebirr', 'Card', 'Credit', 'Other'], default: 'Cash' },
    amountPaid:      { type: Number, default: 0 },
    changeDue:       { type: Number, default: 0 },
    paymentStatus:   { type: String, enum: ['paid', 'pending', 'voided'], default: 'paid' },

    orderStatus: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'voided'],
      default: 'completed',
    },

    printedKOT:      { type: Boolean, default: false },
    printedReceipt:  { type: Boolean, default: false },
    printCount:      { type: Number, default: 0 },

    isVoided:        { type: Boolean, default: false },
    voidReason:      { type: String, default: '' },
    voidedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    voidedByName:    { type: String, default: '' },
    voidedAt:        { type: Date, default: null },

    // References to created stock deduction and sales record
    stockTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', default: null },
    salesRecord:      { type: mongoose.Schema.Types.ObjectId, ref: 'SalesRecord', default: null },
  },
  { timestamps: true }
);

posOrderSchema.index({ createdAt: -1 });
posOrderSchema.index({ paymentStatus: 1 });
posOrderSchema.index({ orderStatus: 1 });
posOrderSchema.index({ cashier: 1, createdAt: -1 });

module.exports = mongoose.model('POSOrder', posOrderSchema);
