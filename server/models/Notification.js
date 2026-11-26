const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        'purchase', 'stock_request', 'transaction', 'consumption',
        'expense', 'material', 'employee', 'user', 'production', 'pos', 'system', 'low_stock',
      ],
      default: 'system',
    },
    title:       { type: String, required: true },
    message:     { type: String, required: true },
    icon:        { type: String, default: '📦' },
    link:        { type: String, default: '' },       // frontend route to navigate to
    entityId:    { type: String, default: '' },       // exact document ID for row highlight
    voucherNo:   { type: String, default: '' },       // voucher / PO number fallback
    severity:    { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    targetUserId:{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    allowedRoles:{ type: [String], default: [] },
    readBy:      [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dismissedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
