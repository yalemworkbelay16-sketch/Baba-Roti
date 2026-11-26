const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    provider: {
      type: String,
      enum: ['payo'],
      default: 'payo',
      index: true,
    },
    source: {
      type: String,
      enum: ['pos', 'digital_menu', 'captain_order'],
      required: true,
    },
    captainOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CaptainOrder',
      default: null,
      index: true,
    },
    posOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'POSOrder',
      default: null,
      index: true,
    },
    orderNo: { type: String, default: '', trim: true },
    tableNo: { type: String, default: '', trim: true },
    customerName: { type: String, default: 'Guest', trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    currency: { type: String, default: 'ETB' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'failed', 'expired'],
      default: 'pending',
      index: true,
    },
    payoOrderId: { type: String, default: '', index: true },
    checkoutUrl: { type: String, default: '' },
    verifiedBy: {
      type: String,
      enum: ['', 'webhook', 'poll', 'manual_cashier'],
      default: '',
    },
    paidAt: { type: Date, default: null },
    errorMessage: { type: String, default: '' },
    rawResponse: { type: mongoose.Schema.Types.Mixed, default: null },
    rawWebhook: { type: mongoose.Schema.Types.Mixed, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);
