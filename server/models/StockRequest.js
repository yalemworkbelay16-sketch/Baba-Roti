const mongoose = require('mongoose');

/*
  Stock Issue & Request Workflow
  ─────────────────────────────────────────────────────────────────
  REQUEST FLOW  (initiated by Kitchen / Bar / Housekeeping / etc.)
    pending   → manager/admin reviews
    approved  → storekeeper issues stock  (deducts from RawMaterial.currentStock)
    issued    → goods physically handed over, stock deducted
    rejected  → request declined with reason
    cancelled → requester cancelled before approval

  DIRECT ISSUE FLOW  (storekeeper/admin issues without prior request)
    issued    → stock deducted immediately on creation
  ─────────────────────────────────────────────────────────────────
*/

const DEPARTMENTS = [
  'Kitchen',
  'Bar',
  'Housekeeping',
  'Restaurant',
  'Laundry',
  'Management',
  'Maintenance',
  'Other',
];

const REQUEST_STATUSES = ['pending', 'approved', 'issued', 'rejected', 'cancelled'];

const lineItemSchema = new mongoose.Schema(
  {
    material:        { type: mongoose.Schema.Types.ObjectId, ref: 'RawMaterial', required: true },
    requestedQty:    { type: Number, required: true, min: 0.001 },
    issuedQty:       { type: Number, default: 0 },     // may differ if partial
    unitCost:        { type: Number, default: 0 },
    totalCost:       { type: Number, default: 0 },
    note:            { type: String, default: '' },
  },
  { _id: false }
);

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

const stockRequestSchema = new mongoose.Schema(
  {
    voucherNo:   { type: String, trim: true, default: '' },

    // Who is requesting and from where
    requestType: {
      type: String,
      enum: ['request', 'direct_issue'],
      default: 'request',
    },
    // Multi-station mode: internal departmental issues transfer stock from Main Store to Kitchen/Bar.
    affectsStock: {
      type: Boolean,
      default: true,
    },
    department:  { type: String, enum: DEPARTMENTS, required: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    requestedAt: { type: Date, default: Date.now },

    // Items requested
    items: [lineItemSchema],

    // Urgency
    priority: {
      type: String,
      enum: ['normal', 'urgent'],
      default: 'normal',
    },

    // Workflow status
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'pending',
    },

    // Approval
    approvedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt:  { type: Date },
    approveNote: { type: String, default: '' },

    // Issuance
    issuedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    issuedAt:    { type: Date },
    issueNote:   { type: String, default: '' },

    // Rejection / Cancellation
    rejectedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedAt:   { type: Date },
    rejectReason: { type: String, default: '' },

    // Totals
    totalCost:  { type: Number, default: 0 },

    notes:      { type: String, default: '' },
    date:       { type: Date, default: Date.now },

    // Audit trail
    trail: [trailEntrySchema],

    // Soft delete
    deletedAt:   { type: Date, default: null },
    deletedBy:   { type: String, default: null },
  },
  { timestamps: true }
);

stockRequestSchema.index({ deletedAt: 1, createdAt: -1 });
stockRequestSchema.index({ deletedAt: 1, status: 1 });
stockRequestSchema.index({ deletedAt: 1, status: 1, issuedAt: -1 });
stockRequestSchema.index({ deletedAt: 1, department: 1 });
stockRequestSchema.index({ status: 1, date: -1 });
stockRequestSchema.index({ department: 1, date: -1 });
stockRequestSchema.index({ requestedBy: 1 });
stockRequestSchema.index({ createdAt: -1 });

stockRequestSchema.set('toJSON', { virtuals: true });
stockRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('StockRequest', stockRequestSchema);
module.exports.DEPARTMENTS = DEPARTMENTS;
module.exports.REQUEST_STATUSES = REQUEST_STATUSES;
