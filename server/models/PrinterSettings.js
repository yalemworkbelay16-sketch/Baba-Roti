const mongoose = require('mongoose');

/**
 * PrinterSettings – stores network thermal printer configurations per restaurant.
 * Supports ESC/POS-compatible printers (Epson, Star, Datecs, Generic 80mm/58mm).
 */
const printerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Kitchen Printer',
    },
    type: {
      type: String,
      enum: ['kitchen', 'receipt', 'bar', 'both'],
      default: 'kitchen',
    },
    brand: {
      type: String,
      trim: true,
      default: 'Generic',
    },
    model: {
      type: String,
      trim: true,
      default: '',
    },
    paperWidth: {
      type: String,
      enum: ['58mm', '80mm', 'A4'],
      default: '80mm',
    },
    connectionType: {
      type: String,
      enum: ['network', 'system', 'usb', 'serial'],
      default: 'network',
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    port: {
      type: Number,
      default: 9100,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    printOnOrder: {
      type: Boolean,
      default: true, // auto-print KOT when order is placed
    },
    printOnCheckout: {
      type: Boolean,
      default: true, // auto-print receipt on checkout
    },
    copies: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
    },
    headerLine1: { type: String, default: 'Baba Roti Café' },
    headerLine2: { type: String, default: '' },
    footerLine: { type: String, default: 'Thank you! Come again.' },
    charWidth: { type: Number, default: 42 }, // chars per line for 80mm
  },
  { timestamps: true }
);
module.exports = mongoose.model('PrinterSettings', printerSchema);
