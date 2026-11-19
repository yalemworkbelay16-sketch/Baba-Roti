const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ['dev', 'admin', 'manager', 'supervisor', 'storekeeper', 'cashier', 'waiter'],
      default: 'storekeeper',
    },
    phone: { type: String, trim: true, default: '' },
    telegramChatId: { type: String, trim: true, default: '' },
    avatar: { type: String, default: '' },
    photoUrl: { type: String, trim: true, default: '' },
    employeeId: { type: String, trim: true, default: '' },
    assignedStation: {
      type: String,
      enum: ['all', 'main', 'kitchen', 'bar'],
      default: 'all',
    },
    isActive: { type: Boolean, default: true },
    // OTP fields for 2-step login
    otpHash:   { type: String, default: null },
    otpExpiry: { type: Date,   default: null },
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
