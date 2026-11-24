const mongoose = require('mongoose');

/*
  Consumption Management
  ──────────────────────────────────────────────────────────────────
  Records internal non-cash consumption:
  - Staff meals (duty meals, shift meals)
  - Guest / VIP entertainment
  - Owner / management hosting
  - Training & staff events
  - Complimentary / amenity consumption

  Each record lists products consumed. On approval, the raw materials
  that make up those products (via product recipes) are deducted from
  stock automatically.

  Workflow: draft → pending → approved (stock deducted) | voided
  ──────────────────────────────────────────────────────────────────
*/

const CONSUMPTION_CATEGORIES = [
  'staff_meal',
  'guest_entertainment',
  'owner_management',
  'training_event',
  'complimentary',
  'other',
];

const CATEGORY_LABELS = {
  staff_meal:          'Staff Meal',
  guest_entertainment: 'Guest Entertainment',
  owner_management:    'Owner / Management',
  training_event:      'Training & Events',
  complimentary:       'Complimentary',
  other:               'Other',
};

const consumedItemSchema = new mongoose.Schema(
  {
    product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity:    { type: Number, required: true, min: 0.001 },  // portions/units
    // Snapshot of recipe at time of record (for audit)
    recipeCost:  { type: Number, default: 0 },
    totalCost:   { type: Number, default: 0 },
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

const consumptionSchema = new mongoose.Schema(
  {
    voucherNo:   { type: String, trim: true, default: '' },
    category:    { type: String, enum: CONSUMPTION_CATEGORIES, required: true },
    date:        { type: Date, default: Date.now },

    // Who consumed / beneficiary
    beneficiary: { type: String, trim: true, default: '' }, // e.g. "5 Staff on night shift" or "Mr. John - VIP Guest"
    employee:    { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }, // Direct reference to Employee if staff meal
    pax:         { type: Number, default: 1 },              // number of people
    department:  { type: String, trim: true, default: '' }, // e.g. Kitchen, F&B, Housekeeping

    // Products consumed (linked to recipes)
    items: [consumedItemSchema],

    // Totals
    totalRecipeCost: { type: Number, default: 0 }, // sum of recipe costs

    // Workflow
    status: {
      type: String,
      enum: ['pending', 'approved', 'voided'],
      default: 'pending',
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },

    trail:       [trailEntrySchema],
    notes:       { type: String, trim: true, default: '' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Recycle bin
    deletedAt:   { type: Date, default: null },
    deletedBy:   { type: String, default: null },
  },
  { timestamps: true }
);

consumptionSchema.index({ date: -1 });
consumptionSchema.index({ category: 1, date: -1 });
consumptionSchema.index({ status: 1 });

module.exports = mongoose.model('Consumption', consumptionSchema);
module.exports.CONSUMPTION_CATEGORIES = CONSUMPTION_CATEGORIES;
module.exports.CATEGORY_LABELS = CATEGORY_LABELS;
