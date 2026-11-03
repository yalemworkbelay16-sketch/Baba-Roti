/**
 * Standalone Mongoose Schemas & Schema Snippets for Digital Menu
 * ──────────────────────────────────────────────────────────────────
 * Copy or merge these fields into your existing Mongoose schemas.
 */

const mongoose = require('mongoose');

// 1. Setting Schema Snippet
const SettingDigitalMenuFields = {
  digitalMenuSettings: {
    type: Object,
    default: {
      enabled: true,
      allowOrdering: true,
      enableCallWaiter: true,
      enableBillRequest: true,
      bannerText: 'Delicious Food Freshly Made',
      bannerSubtitle: 'Signature Dishes, Specialty Coffee & Drinks',
      phone: '+251 91 123 4567',
      landline: '+251 11 667 8900',
      googleMapsLink: 'https://maps.google.com/?q=Restaurant+Location',
      googleMapsEmbedUrl: 'https://maps.google.com/maps?q=Restaurant+Location&output=embed',
      tiktokUrl: 'https://www.tiktok.com/@restaurant',
      facebookUrl: 'https://www.facebook.com/restaurant',
      instagramUrl: 'https://www.instagram.com/restaurant',
      telegramUrl: 'https://t.me/restaurant',
      tables: [
        'Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05',
        'Table 06', 'Table 07', 'Table 08', 'Table 09', 'Table 10',
        'Table 12', 'Table 15', 'VIP 01', 'Patio 01'
      ],
      // Editable About Us Card
      aboutTitle: 'Restaurant Name & Café',
      aboutSubtitle: 'Location Details, City, Country',
      aboutDescription: 'Famous for fresh signature recipes, specialty coffee, and warm welcoming hospitality.',
      aboutDescriptionAmharic: 'በልዩ ጥራትና ፍቅር የሚዘጋጁ ምርጥ ምግቦችና መጠጦች ከሞቅ ያለ እንግዳ ተቀባይነት ጋር።',
      aboutBadge1Icon: '☕',
      aboutBadge1Label: 'Specialty Coffee',
      aboutBadge2Icon: '🥐',
      aboutBadge2Label: 'Fresh Buns',
      aboutBadge3Icon: '👨‍🍳',
      aboutBadge3Label: 'Master Chefs',
      // Atmosphere Showcase Gallery
      galleryTitle: 'Our Chefs, Baristas & Atmosphere',
      galleryTitleAmharic: 'የካፌው ድባብ እና የእጅ ሙያ',
      gallerySubtitle: 'Photo Gallery',
      galleryItems: [
        {
          imageUrl: 'https://images.unsplash.com/photo-1541167760496-1628856ab772?auto=format&fit=crop&w=600&q=80',
          caption: '☕ Barista Latte Craft',
        },
        {
          imageUrl: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80',
          caption: '🥐 Fresh Caramel Buns',
        },
        {
          imageUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
          caption: '👨‍🍳 Chef Kitchen Plating',
        },
        {
          imageUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80',
          caption: '✨ Cozy Dining Ambiance',
        },
      ],
    },
  },
};

// 2. Product Schema Snippet (Menu Visibility & Amharic Support)
const ProductMenuFields = {
  isAvailableOnMenu:  { type: Boolean, default: true },
  manualOutOfStock:   { type: Boolean, default: false },
  isFeatured:          { type: Boolean, default: false },
  nameAmharic:         { type: String, default: '' },
  descriptionAmharic:  { type: String, default: '' },
  imageUrl:            { type: String, default: '' },
};

// 3. Captain Order Schema Snippet
const CaptainOrderFields = {
  orderNo:        { type: String, required: true, unique: true },
  dailySequence:  { type: Number },
  tableNo:        { type: String, required: true },
  tableLabel:     { type: String },
  customerName:   { type: String, default: 'Walk-in Guest' },
  customerPhone:  { type: String, default: '' },
  orderType:      { type: String, enum: ['dine_in', 'takeaway'], default: 'dine_in' },
  status: {
    type: String,
    enum: ['pending_approval', 'open', 'sent_to_kitchen', 'preparing', 'ready', 'billed', 'voided'],
    default: 'pending_approval',
  },
  waiterApproval: {
    required:   { type: Boolean, default: true },
    status:     { type: String, enum: ['pending', 'approved'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
  },
  items: [{
    product:     { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    productName: String,
    productCode: String,
    quantity:    Number,
    unitPrice:   Number,
    totalPrice:  Number,
    notes:       String,
  }],
  subtotal:       Number,
  taxPercent:     Number,
  taxAmount:      Number,
  serviceCharge:  Number,
  grandTotal:     Number,
  tableNotes:     String,
};

module.exports = {
  SettingDigitalMenuFields,
  ProductMenuFields,
  CaptainOrderFields,
};

