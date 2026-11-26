const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['dev', 'admin', 'manager', 'operation_manager', 'executive_chef', 'supervisor', 'storekeeper', 'cashier', 'waiter', 'fb_team'],
      default: 'storekeeper',
    },
    phone: { type: String, trim: true, default: '' },
    telegramChatId: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    photoUrl: { type: String, trim: true, default: '' },
    employeeId: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    assignedStation: {
      type: String,
      enum: ['all', 'main', 'kitchen', 'bar'],
      default: 'all',
    },
    // Allowed staff meal / consumption items and daily limits
    allowedProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    dailyMealLimit: { type: Number, default: 1, min: 1 },
    mealLimits: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        maxPerDay: { type: Number, default: 1, min: 1 },
      },
    ],
    isActive: { type: Boolean, default: true },
    // Real-time online/offline and machine tracking
    isOnline: { type: Boolean, default: false },
    lastActiveAt: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: '' },
    lastLoginDevice: { type: String, default: '' },
    // OTP fields for 2-step login
    otpHash: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    // Telegram granular alert overrides (if undefined, inherits system role defaults)
    telegramAlerts: { type: [String], default: undefined },
    // Security & Audit Trail
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    createdByName: { type: String, default: '' },
    createdByRole: { type: String, default: '' },
    registrationSource: { type: String, default: 'manual' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, default: '' },
    updatedByRole: { type: String, default: '' },
  },
  { timestamps: true }
);
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});
userSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};
module.exports = mongoose.model('User', userSchema);
