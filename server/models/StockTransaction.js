const mongoose = require('mongoose');

/*
  voucherType drives all business logic:
  ─────────────────────────────────────────────────────────────────────
  cash_grv       Cash Goods Receiving Voucher     → stock IN  (paid cash)
  credit_grv     Credit Goods Receiving Voucher   → stock IN  (on credit)
  disposal       Goods Disposal Voucher           → stock OUT (write-off)
  neg_adjustment Negative Stock Adjustment        → stock OUT (correction down)
  pos_adjustment Positive Stock Adjustment        → stock IN  (correction up)
  fresh_bazaar   Fresh Bazaar Receiving Voucher   → stock IN  (direct market purchase)
  ─────────────────────────────────────────────────────────────────────
*/

const VOUCHER_TYPES = [
  'cash_grv',
  'credit_grv',
  'disposal',
  'neg_adjustment',
  'pos_adjustment',
  'fresh_bazaar',
  'sales_import',
  'pos_sale',
  'manual_sale',
  'production',
  'production_void',
];

// Direction each voucher type moves stock
const VOUCHER_DIRECTION = {
  cash_grv:       'in',
  credit_grv:     'in',
  disposal:       'out',
  neg_adjustment: 'out',
  pos_adjustment: 'in',
  fresh_bazaar:   'in',
  sales_import:   'out',
  pos_sale:       'out',
  manual_sale:    'out',
  production:     'out',
  production_void: 'in',
};

const lineItemSchema = new mongoose.Schema(
  {
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    quantity: { type: Number, required: true, min: 0.001 },
    unitCost: { type: Number, default: 0 },
    totalCost: { type: Number, default: 0 },
    station:   { type: String, default: 'mainStore' },
  },
  { _id: false }
);

/*
  Approval workflow for stock transactions:
  ─────────────────────────────────────────────────────────
  pending  →  [checker password]  →  checked
  checked  →  [approver password] →  approved
  approved →  [poster password]   →  posted  (stock already applied on create)
  any      →  [admin password]    →  voided  (stock reversed)
  ─────────────────────────────────────────────────────────
  Stock is applied immediately on creation (optimistic).
  Voiding reverses stock. Approved = final authorisation.
  Posted = document is filed and locked.
*/
const trailEntrySchema = new mongoose.Schema(
  {
    action:  { type: String },
    by:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    byName:  { type: String },
    byRole:  { type: String },
    at:      { type: Date, default: Date.now },
    note:    { type: String, default: '' },
  },
  { _id: false }
);

const stockTransactionSchema = new mongoose.Schema(
  {
    voucherType: { type: String, enum: VOUCHER_TYPES, required: true },
    voucherNo:   { type: String, trim: true, default: '' },

    // Workflow status
    status: {
      type: String,
      enum: ['pending', 'checked', 'approved', 'posted', 'voided'],
      default: 'pending',
    },

    // Per-stage sign-off
    checkedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    checkedAt:  { type: Date },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    postedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    postedAt:   { type: Date },

    // Audit trail
    trail: [trailEntrySchema],

    // Legacy single-material fields kept for backward compat
    material: { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial' },
    type:     { type: String, enum: ['in', 'out'] },
    quantity: { type: Number, min: 0 },
    unitCost: { type: Number, default: 0 },

    items: [lineItemSchema],

    supplier: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier' },
    reason:    { type: String, trim: true, default: '' },
    reference: { type: String, trim: true, default: '' },
    productionRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Production', default: null },

    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String, trim: true, default: '' },
    date:  { type: Date, default: Date.now },

    // Receipt / Invoice Attachments
    attachment:  { type: String, default: '' },
    attachments: [
      {
        url:        { type: String, required: true },
        name:       { type: String, default: 'Receipt' },
        mimeType:   { type: String, default: 'image/jpeg' },
        size:       { type: Number, default: 0 },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    totalAmount: { type: Number, default: 0 },
    // Recycle bin fields
    deletedAt:   { type: Date, default: null },
    deletedBy:   { type: String, default: null },
    deletedFrom: { type: String, default: 'transactions' },
  },
  { timestamps: true }
);

stockTransactionSchema.index({ date: -1 });
stockTransactionSchema.index({ createdAt: -1 });
stockTransactionSchema.index({ voucherType: 1, date: -1 });
stockTransactionSchema.index({ status: 1 });
stockTransactionSchema.index({ material: 1 });

// Virtual: human-readable label
stockTransactionSchema.virtual('voucherLabel').get(function () {
  const labels = {
    cash_grv:       'Cash GRV',
    credit_grv:     'Credit GRV',
    disposal:       'Goods Disposal',
    neg_adjustment: 'Negative Adjustment',
    pos_adjustment: 'Positive Adjustment',
    fresh_bazaar:   'Fresh Bazaar GRV',
    sales_import:   'Imported Sales',
    pos_sale:       'Baba Roti POS Sale',
    manual_sale:    'Manual Sale',
  };
  return labels[this.voucherType] ?? this.voucherType;
});

stockTransactionSchema.set('toJSON', { virtuals: true });
stockTransactionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
module.exports.VOUCHER_TYPES = VOUCHER_TYPES;
module.exports.VOUCHER_DIRECTION = VOUCHER_DIRECTION;

