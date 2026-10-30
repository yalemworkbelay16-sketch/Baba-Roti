const mongoose = require("mongoose");

const captainOrderItemSchema = new mongoose.Schema(
  {
    product:        { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName:    { type: String, required: true },
    productCode:    { type: String, default: "" },
    category:       { type: String, default: "General" },
    parentCategory: { type: String, default: "FOOD" },
    quantity:       { type: Number, required: true, min: 0.001 },
    unitPrice:      { type: Number, required: true, min: 0 },
    totalPrice:     { type: Number, required: true, min: 0 },
    notes:          { type: String, default: "" },
    station:        { type: String, enum: ["kitchen", "barista", "general"], default: "kitchen" },
    addedRound:     { type: Number, default: 1 },
  },
  { _id: false }
);

const captainOrderSchema = new mongoose.Schema(
  {
    orderNo:       { type: String, required: true, unique: true, index: true },
    dailySequence: { type: Number, default: 1 },
    tableNo:       { type: String, default: "" },
    tableLabel:    { type: String, default: "" },
    customerName:  { type: String, default: "Walk-in Guest" },
    customerPhone: { type: String, default: "" },
    guestCount:    { type: Number, default: 1, min: 1 },
    orderType:     { type: String, enum: ["dine_in", "takeaway", "delivery"], default: "dine_in" },
    waiter:        { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    waiterName:    { type: String, default: "" },
    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
    items:         [captainOrderItemSchema],
    subtotal:        { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount:  { type: Number, default: 0 },
    taxPercent:      { type: Number, default: 15 },
    taxAmount:       { type: Number, default: 0 },
    serviceChargePercent: { type: Number, default: 0 },
    serviceCharge:   { type: Number, default: 0 },
    grandTotal:      { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending_approval", "open", "held", "sent_to_kitchen", "ready", "billed", "paid", "voided", "cancelled"],
      default: "open",
    },
    waiterApproval: {
      required: { type: Boolean, default: false },
      status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
      approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      approvedByName: { type: String, default: "" },
      approvedAt: { type: Date, default: null },
      rejectedReason: { type: String, default: "" },
      rejectedAt: { type: Date, default: null },
    },
    cashSaleRef:  { type: mongoose.Schema.Types.ObjectId, ref: "POSOrder", default: null },
    billedAt:     { type: Date, default: null },
    billedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    billedByName: { type: String, default: "" },
    kotPrinted:   { type: Boolean, default: false },
    kotPrintedAt: { type: Date, default: null },
    tableNotes:   { type: String, default: "" },
    isVoided:     { type: Boolean, default: false },
    voidReason:   { type: String, default: "" },
    voidedBy:     { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    voidedAt:     { type: Date, default: null },
  },
  { timestamps: true }
);

captainOrderSchema.index({ createdAt: -1 });
captainOrderSchema.index({ status: 1 });
captainOrderSchema.index({ tableNo: 1, status: 1 });

module.exports = mongoose.model("CaptainOrder", captainOrderSchema);
