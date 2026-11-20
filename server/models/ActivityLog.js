const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      default: 'System',
    },
    userEmail: {
      type: String,
      trim: true,
      default: '',
    },
    userRole: {
      type: String,
      default: 'guest',
    },
    userDepartment: {
      type: String,
      default: '',
    },
    action: {
      type: String,
      required: true,
      index: true,
      trim: true,
      // e.g. LOGIN, LOGOUT, CREATE, UPDATE, DELETE, ISSUE, REQUEST, APPROVE, REJECT, TRANSFER, VERIFY
    },
    module: {
      type: String,
      required: true,
      index: true,
      trim: true,
      // e.g. Auth, Users, StockRequests, RawMaterials, Transactions, Settings, POS, Employees
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    ip: {
      type: String,
      default: '127.0.0.1',
      index: true,
      trim: true,
    },
    device: {
      type: String,
      default: 'Desktop',
      trim: true,
    },
    userAgent: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: ['success', 'warning', 'failed'],
      default: 'success',
      index: true,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for fast filtering and pagination
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, module: 1, createdAt: -1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
