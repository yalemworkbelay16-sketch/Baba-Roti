const mongoose = require('mongoose');

const DEFAULT_NAV_VISIBILITY = {
  dashboard:     { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  pos:           { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true },
  captainOrder:  { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true },
  cashSales:     { storekeeper: true,  cashier: true,  waiter: false, supervisor: true,  manager: true,  admin: true },
  rawMaterials:  { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  products:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  stockMovements:{ storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  suppliers:     { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  consumption:   { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  reports:       { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  expenses:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
  analytics:     { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: true,  admin: true },
  staffAccounts: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
};

const DEFAULT_CRUD_PERMISSIONS = {
  rawMaterials:   { view: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
  products:       { view: { storekeeper: true,  cashier: true,  waiter: true,  supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
  suppliers:      { view: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
  expenses:       { view: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
  stockMovements: { view: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
  purchases:      { view: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
  employees:      { view: { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true }, edit: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: true,  admin: true }, delete: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true } },
};

const settingSchema = new mongoose.Schema(
  {
    hotelName: { type: String, default: 'Baba Roti  Café' },
    systemEmail: { type: String, default: 'info@Baba Roti  Café.com' },
    phone: { type: String, default: '+251 911 000 111' },
    address: { type: String, default: 'Addis Ababa, Ethiopia' },
    currency: { type: String, default: 'ETB' },
    currencySymbol: { type: String, default: 'ETB' },
    lowStockThresholdDefault: { type: Number, default: 15 },
    taxRate: { type: Number, default: 15 },
    // ── Service Charge & Hospitality Fees ────────────────────────
    enableServiceCharge: { type: Boolean, default: false },
    serviceChargeRate: { type: Number, default: 10, min: 0, max: 100 },
    serviceChargePresets: { type: [Number], default: [5, 10, 15] },
    autoApplyServiceChargeDineIn: { type: Boolean, default: false },
    autoGenerateVoucherNo: { type: Boolean, default: true },
    allowNegativeStock: { type: Boolean, default: false },
    rolePermissions: {
      type: Object,
      default: {
        recordGoods:      { storekeeper: true,  cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
        checkReview:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
        approveGoods:     { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
        postLedger:       { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
        voidTransactions: { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
        viewReports:      { storekeeper: false, cashier: false, waiter: false, supervisor: true,  manager: true,  admin: true },
        manageAccounts:   { storekeeper: false, cashier: false, waiter: false, supervisor: false, manager: false, admin: true },
      },
    },
    navVisibility: {
      type: Object,
      default: DEFAULT_NAV_VISIBILITY,
    },
    crudPermissions: {
      type: Object,
      default: DEFAULT_CRUD_PERMISSIONS,
    },
    // Developer & System Owner Master Licensing Controls
    licensedModules: {
      type: Object,
      default: {
        subsystem: true, // Subsystem: POS Ordering, Captain Order, Cash Sales
        digitalMenu: true, // Customer Digital Menu, QR Ordering & Tracking Suite (standalone sellable add-on)
        finance: true, // Finance & Expenses Suite: Overhead Expenses, Analytics & P&L
        themeCustomization: true, // Allow Hotel Admin to customize Sidebar Appearance & Brand Theme
        materialIcons: true, // Material UI Icons with colorful badges (true) vs Classic minimal icons (false)
        sidebarTheme: 'navy', // 'navy' | 'slate' | 'espresso' | 'emerald' | 'violet' | 'black' | etc.
      },
    },
    sidebarTheme: {
      type: String,
      default: 'navy',
    },
    sidebarMaterialIcons: {
      type: Boolean,
      default: true,
    },
    devMasterKey: {
      type: String,
      default: 'dev-owner-2026',
    },
    // Telegram bot subscribers — array of { chatId, name, username, subscribedAt }
    telegramSubscribers: {
      type: Array,
      default: [],
    },
    notes: { type: String, default: 'Baba Roti  CaféHotel Management & Stock Control System' },

    // ── Pricing & Cost Parameters ─────────────────────────────────
    // Contingency: % buffer added on top of raw material cost (waste, price fluctuation)
    contingencyPercent: { type: Number, default: 10, min: 0, max: 100 },
    // Overhead: % of total cost added for electricity, labour, etc.
    overheadPercent: { type: Number, default: 25, min: 0, max: 100 },
    // Spice Cost: % added for spices, seasoning, culinary oils (Ethiopian hotel/cafe standard)
    spiceCostPercent: { type: Number, default: 5, min: 0, max: 100 },
    // Default Food Cost %: used to back-calculate suggested selling price
    // e.g. if food cost % = 30, selling price = totalCost / 0.30
    defaultFoodCostPercent: { type: Number, default: 30, min: 1, max: 100 },
    // Raw Material Price Adjustment: apply globally before recipe cost calculation
    // 'percent' = add X% to every unit cost | 'fixed' = add fixed ETB amount
    rawMaterialPriceAdjustType: { type: String, default: 'percent', enum: ['percent', 'fixed'] },
    rawMaterialPriceAdjustValue: { type: Number, default: 0, min: 0 },
    // Product Selling Price Bulk Adjustment — percentage to add to ALL product selling prices
    productSellingPriceAdjustPercent: { type: Number, default: 0, min: 0, max: 500 },

    // Store Locations for Inventory Count & Warehouses
    storeLocations: {
      type: [String],
      default: [
        'Main Store',
        'Kitchen Store',
        'Bar Store',
        'Pastry & Bakery Store',
      ],
    },

    // ── Customer Digital Menu & QR Settings ───────────────────────
    digitalMenuSettings: {
      type: Object,
      default: {
        enabled: true,
        allowOrdering: true,
        enableCallWaiter: true,
        enableBillRequest: true,
        bannerText: 'Delicious Food Freshly Made',
        bannerSubtitle: 'Fresh Buns, Hot Specialty Coffee & Savory Meals',
        phone: '+251 91 123 4567',
        landline: '+251 11 667 8900',
        googleMapsLink: 'https://maps.google.com/?q=Alem+Cinema+Bole+Addis+Ababa',
        googleMapsEmbedUrl: 'https://maps.google.com/maps?q=Alem%20Cinema,%20Bole,%20Addis%20Ababa,%20Ethiopia&t=&z=16&ie=UTF8&iwloc=&output=embed',
        tiktokUrl: 'https://www.tiktok.com/@babaroti_ethiopia',
        facebookUrl: 'https://www.facebook.com/babarotiethiopia',
        instagramUrl: 'https://www.instagram.com/babaroti_ethiopia',
        telegramUrl: 'https://t.me/babaroticafe',
        tables: [
          'Table 01', 'Table 02', 'Table 03', 'Table 04', 'Table 05',
          'Table 06', 'Table 07', 'Table 08', 'Table 09', 'Table 10',
          'Table 12', 'Table 15', 'Table 20', 'Table 36', 'VIP 01', 'Patio 01', 'Patio 02'
        ],
        // About Section
        aboutTitle: 'Baba Roti Café & Restaurant',
        aboutSubtitle: 'Bole Road • Addis Ababa, Ethiopia',
        aboutDescription: 'Famous for our freshly baked signature Mexican coffee buns with crisp caramelized butter crust, specialty coffee hand-crafted by master baristas, and gourmet dining in a warm, welcoming ambience.',
        aboutDescriptionAmharic: 'በልዩ ጥራትና ፍቅር የሚዘጋጁ ትኩስ የካራሜል ቡኖች፣ በእደ-ጥበብ የተጠበሱ ምርጥ የባሪስታ ቡናዎች፣ ጣፋጭ በርገሮች እና የድንጋይ ምድጃ ፒሳዎች ከሞቅ ያለ እንግዳ ተቀባይነት ጋር።',
        aboutBadge1Icon: '☕',
        aboutBadge1Label: 'Specialty Coffee',
        aboutBadge2Icon: '🥐',
        aboutBadge2Label: 'Fresh Buns',
        aboutBadge3Icon: '👨‍🍳',
        aboutBadge3Label: 'Master Chefs',
        // Showcase Gallery
        galleryTitle: 'Our Baristas, Chefs & Atmosphere',
        galleryTitleAmharic: 'የካፌው ድባብ እና የእጅ ሙያ',
        gallerySubtitle: 'Baba Roti Gallery',
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

    // ── Automated Daily Sales Summary via Telegram ────────────────
    telegramDailyReportEnabled: {
      type: Boolean,
      default: true,
    },
    telegramDailyReportTime: {
      type: String,
      default: '12:00', // 24-hr format (e.g. '12:00', '09:00', '21:00')
    },
    lastDailyReportDate: {
      type: String,
      default: '',
    },
    lastDailyReportExecution: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Setting', settingSchema);
module.exports.DEFAULT_NAV_VISIBILITY = DEFAULT_NAV_VISIBILITY;
