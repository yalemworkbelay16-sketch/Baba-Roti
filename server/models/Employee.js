const mongoose = require('mongoose');

const DEPARTMENTS = [
  'Bar',
  'Kitchen',
  'Waiter',
  'Food & Beverage',
  'Front Office',
  'Housekeeping',
  'Security',
  'Maintenance',
  'Finance & Accounting',
  'Human Resources',
  'Sales & Marketing',
  'Laundry',
  'Management',
  'Other',
];

const employeeSchema = new mongoose.Schema(
  {
    employeeId: { type: String, trim: true, default: '' },   // e.g. EMP-001
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    department: { type: String, trim: true, default: 'Other' },
    assignedStation: { type: String, enum: ['all', 'main', 'kitchen', 'bar'], default: 'all' },
    position: { type: String, trim: true, default: '' },   // e.g. Chef, Waiter
    phone: { type: String, trim: true, default: '' },
    email: { type: String, trim: true, lowercase: true, default: '' },
    hireDate: { type: Date, default: null },
    status: { type: String, enum: ['active', 'inactive', 'on_leave'], default: 'active' },
    notes: { type: String, trim: true, default: '' },
    photoUrl: { type: String, trim: true, default: '' },   // 3x4 portrait employee photo
    // Allowed staff meal / consumption items and daily limits
    allowedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    dailyMealLimit: { type: Number, default: 1, min: 1 }, // Max meals/portions allowed per day
    mealLimits: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        maxPerDay: { type: Number, default: 1, min: 1 },
      },
    ],
    // Security & Audit Trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, trim: true, default: '' },
    createdByRole: { type: String, trim: true, default: '' },
    registrationSource: { type: String, enum: ['manual', 'staff_sync', 'excel_import', 'system'], default: 'manual' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true, default: '' },
    updatedByRole: { type: String, trim: true, default: '' },
    // Soft delete
    deletedAt: { type: Date, default: null },
    deletedBy: { type: String, default: null },
  },
  { timestamps: true }
);

// Virtual: full name
employeeSchema.virtual('name').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

employeeSchema.set('toJSON', { virtuals: true });
employeeSchema.set('toObject', { virtuals: true });

employeeSchema.index({ department: 1, status: 1 });
employeeSchema.index({ firstName: 1, lastName: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
module.exports.DEPARTMENTS = DEPARTMENTS;
