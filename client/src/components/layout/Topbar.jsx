import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu, LogOut, ChevronDown, User, Shield, Building,
  Layers, Clock, HelpCircle, X, BookOpen, Package,
  ArrowLeftRight, ShoppingCart, BarChart2, Users,
  ChevronRight, Search, Lightbulb, CheckCircle2, PlayCircle,
  Bell, BellRing, Trash2, Globe, QrCode, Utensils, Award,
  Sliders, Activity, Settings as SettingsIcon, FileText, Monitor, Check, Download, Printer,
} from 'lucide-react';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useSessionTimeout } from '../../context/SessionTimeoutContext';
import { useLanguage } from '../../context/LanguageContext';

// ─────────────────────────────────────────
// SVG FLOW DIAGRAM GENERATOR
// ─────────────────────────────────────────
function makeFlowSvg(steps, color = '#2563eb', bg = '#eff6ff', border = '#bfdbfe') {
  const count = steps.length;
  const width = 720;
  const height = 74;
  const arrowW = 24;
  const totalArrowSpace = (count - 1) * arrowW;
  const padX = 14;
  const boxW = Math.floor((width - padX * 2 - totalArrowSpace) / count);
  const boxH = 54;
  const topY = 10;

  let boxes = '';
  steps.forEach((st, i) => {
    const x = padX + i * (boxW + arrowW);
    boxes += `
      <g>
        <rect x="${x}" y="${topY}" width="${boxW}" height="${boxH}" rx="8" fill="${st.bg || bg}" stroke="${st.border || border}" stroke-width="1.2"/>
        <circle cx="${x + 14}" cy="${topY + 16}" r="8" fill="${st.color || color}"/>
        <text x="${x + 14}" y="${topY + 20}" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="800" fill="#ffffff" text-anchor="middle">${i + 1}</text>
        <text x="${x + 28}" y="${topY + 19}" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="700" fill="#0f172a">${st.title}</text>
        <text x="${x + 10}" y="${topY + 38}" font-family="system-ui, -apple-system, sans-serif" font-size="8" fill="#475569">${st.sub}</text>
      </g>
    `;
    if (i < count - 1) {
      const ax = x + boxW + 3;
      const ay = topY + boxH / 2;
      boxes += `
        <g>
          <line x1="${ax}" y1="${ay}" x2="${ax + 13}" y2="${ay}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>
          <polygon points="${ax + 13},${ay - 4} ${ax + 19},${ay} ${ax + 13},${ay + 4}" fill="${color}"/>
        </g>
      `;
    }
  });

  return `<svg viewBox="0 0 ${width} ${height}" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg" style="display:block; max-height:85px; font-family:system-ui, sans-serif;">${boxes}</svg>`;
}

// ─────────────────────────────────────────
// HELP MODAL DATA (12 MODULES WITH VISUAL FLOWS)
// ─────────────────────────────────────────
const HELP_SECTIONS = [
  {
    id: 'getting-started',
    icon: PlayCircle,
    color: 'bg-blue-600',
    title: 'Getting Started & Login',
    titleAm: 'መግቢያና የተጠቃሚዎች መግቢያ',
    role: 'All Staff / ሁሉም ሰራተኞች',
    roleAm: 'ሁሉም ሰራተኞች',
    flowSvg: makeFlowSvg([
      { title: '1. Enter Credentials', sub: 'Username & Password' },
      { title: '2. Capture Machine IP', sub: 'Mark Live 🟢 Online' },
      { title: '3. Smart Role Landing', sub: 'Redirect Workstation' },
      { title: '4. Ready & Auto-Locked', sub: 'Idle Timer Protection' },
    ], '#2563eb', '#eff6ff', '#bfdbfe'),
    steps: [
      {
        title: 'Secure Log In & Online Session',
        titleAm: 'በደህንነት መግባትና የቀጥታ ቆይታ',
        desc: "Enter your username/email and password. Upon sign in, your account immediately activates as 🟢 Online with your machine IP address and device signature recorded.",
        descAm: "የይለፍ ቃልና ስምዎን በማስገባት ይግቡ፤ ሲገቡ ወዲያውኑ እንደ 🟢 Online (በስራ ላይ) ተብሎ ከኮምፒውተርዎ IP አድራሻ ጋር ይመዘገባል።",
        action: 'Login screen ➔ Enter Username & Password ➔ Click Sign In',
        actionAm: 'በመግቢያ ገጽ ላይ ➔ ስምዎንና የይለፍ ቃል ያስገቡ ➔ "Sign In" ይጫኑ',
      },
      {
        title: 'Smart Landing by Role',
        titleAm: 'እንደየስራ ድርሻዎ የሚከፈት ገጽ',
        desc: 'The system automatically routes you to your authorized workstation: Cashiers open at POS, Baristas & Chefs open at Requisitions, Storekeepers at Materials/GRV, Admins at Dashboard.',
        descAm: 'ስርዓቱ እንደተጠቃሚው የስራ ድርሻ በቀጥታ ወደሚገባው ገጽ ይወስድዎታል (ካሳ ወደ POS፣ ባሬስታና ሼፍ ወደ ስቶክ ጥያቄ፣ ስቶር ጠባቂ ወደ እቃዎች፣ አስተዳዳሪ ወደ ዳሽቦርድ)።',
        action: 'Automatic redirection upon successful login',
        actionAm: 'ሲገቡ በራሱ በቀጥታ ወደ ስራ ገጽዎ ይወስድዎታል',
      },
      {
        title: 'Dashboard Overview & Metrics',
        titleAm: 'የዳሽቦርድ አጠቃላይ መረጃ',
        desc: 'Shows real-time inventory balance valuation, safety reorder alerts, daily movement inflow/outflow, and sales cost aggregation.',
        descAm: 'የአጠቃላይ ስቶክ የገንዘብ መጠን፣ የአደጋ ማሳሰቢያዎች፣ የዕለቱ የዕቃ ገቢና ወጪ፣ እና የሽያጭ ትርፍና ኪሳራን በጨረፍታ ያሳያል።',
        action: 'Side Menu ➔ Dashboard / አጠቃላይ እይታ',
        actionAm: 'የግራ ሜኑ ➔ Dashboard',
      },
      {
        title: 'Sidebar Navigation & Auto-Logout Security',
        titleAm: 'የግራ ጎን ሜኑ አጠቃቀምና ራስ-ቆልፍ',
        desc: 'Navigate between stores, movements, requisitions, staff badges, and logs. Set session timeout (15m, 30m, 1h) so unattended terminals securely sign out.',
        descAm: 'በዋና መጋዘን፣ በኩሽና፣ በባር፣ በእንቅስቃሴ መዝገብና በሪፖርቶች መካከል በቀላሉ ይዘዋወሩ። ኮምፒውተሩ ስራ ሳይሰራ ሲቀር ራሱን በራሱ ዘግቶ እንዲቆለፍ ያድርጉ።',
        action: 'Top Bar ➔ Click User Avatar ➔ Auto-Logout Timeout Settings',
        actionAm: 'የላይኛው ባር ➔ የተጠቃሚ ፎቶ ➔ Auto-Logout ማስተካከያ',
      },
    ],
  },
  {
    id: 'station-management',
    icon: Sliders,
    color: 'bg-cyan-600',
    title: 'Station Storage & Routing',
    titleAm: 'የስቶክ ጣቢያዎች ምደባና ማከማቻ',
    role: 'Storekeeper, Admin & Manager',
    roleAm: 'ስቶር ጠባቂ፣ አስተዳዳሪና ስራ አስኪያጅ',
    flowSvg: makeFlowSvg([
      { title: '1. Central Warehouse', sub: '100% Raw Materials' },
      { title: '2. Station Mapping', sub: 'Kitchen vs Bar Groups' },
      { title: '3. Admin Pass Gate', sub: 'Security Authorization' },
      { title: '4. Station Isolation', sub: 'Scoped View by Role' },
    ], '#0891b2', '#ecfeff', '#a5f3fc'),
    steps: [
      {
        title: 'Central Warehouse Concept',
        titleAm: 'ዋና መጋዘን ማዕከላዊ አስተዳደር',
        desc: '100% of all raw materials are registered under and managed centrally by the Main Store. Kitchen and Bar stations receive their items exclusively through approved requisitions.',
        descAm: '100% ሁሉም ጥሬ ዕቃዎች መጀመሪያ የሚገቡትና የሚተዳደሩት በዋና መጋዘን ነው። ኩሽናና ባር ዕቃዎችን የሚያገኙት በጸደቀ ጥያቄ ብቻ ነው።',
        action: 'Side Menu ➔ Raw Materials (Main Store Tab)',
        actionAm: 'የግራ ሜኑ ➔ Raw Materials (Main Store)',
      },
      {
        title: 'Category Station Routing',
        titleAm: 'ምድቦችን ለኩሽና እና ለባር መመደብ',
        desc: 'Categories are mapped either to Kitchen Station (Produce, Meat, Pastry, Mendi, Fresh Bazaar) or Bar Station (Coffee, Tea, Beverages, Drinks).',
        descAm: 'የዕቃ ምድቦች ለኩሽና (ምግብ፣ ፓስትሪ፣ ሜንዲ፣ ፍራሽ ባዛር) ወይም ለባር (ቡና፣ ሻይ፣ መጠጦች) ይመደባሉ።',
        action: 'Raw Materials ➔ Station Storage ➔ Manage Category Routing',
        actionAm: 'Raw Materials ➔ Station Storage ➔ ምድቦችን መድብ',
      },
      {
        title: 'Admin Password Security Gate',
        titleAm: 'የይለፍ ቃል ጥበቃ',
        desc: 'Modifying station category assignments requires entering the Admin/Manager password to prevent accidental or unauthorized routing changes.',
        descAm: 'የጣቢያ ምደባዎችን ለማስተካከልና ለማስቀመጥ የአስተዳዳሪ የይለፍ ቃል ማስገባት ግዴታ ነው፤ ይህም ያልተፈቀደ ለውጥ እንዳይደረግ ይጠብቃል።',
        action: 'Enter Admin Password prompt upon saving category changes',
        actionAm: 'ምድብ ሲቀይሩ የአስተዳዳሪውን የይለፍ ቃል አስገብተው ያጽድቁ',
      },
      {
        title: 'Role-Based Station Scoping',
        titleAm: 'ለእያንዳንዱ ክፍል የራሱን ስቶክ ብቻ ማሳየት',
        desc: 'Baristas see only Bar materials and stock balance; Kitchen staff sees only Kitchen materials. Only Main Storekeepers and Admins have permission to view all stations simultaneously.',
        descAm: 'ባሬስታ የባርን ብቻ፣ ኩሽና ደግሞ የኩሽናን ስቶክ ብቻ ያያሉ። ዋና ስቶር ጠባቂና ስራ አስኪያጅ ብቻ የሁሉንም ክፍሎች ስቶክ በአንድ ላይ ማየት ይችላሉ።',
        action: 'Automatic based on user assigned department (Bar/Kitchen)',
        actionAm: 'እንደተጠቃሚው የስራ ክፍል በቀጥታ የሚገደብ',
      },
    ],
  },
  {
    id: 'stock-requests',
    icon: ArrowLeftRight,
    color: 'bg-amber-600',
    title: 'Stock Requisitions & Dispatch',
    titleAm: 'የጥያቄና ወጪ ስቶክ አሰራር',
    role: 'Baristas, Kitchen Chefs & Storekeeper',
    roleAm: 'ባሬስታ፣ ሼፍ እና ስቶር ጠባቂ',
    flowSvg: makeFlowSvg([
      { title: '1. + New Request', sub: 'Auto Department Locked' },
      { title: '2. Mapped Item Pick', sub: 'Only Station Items' },
      { title: '3. Storekeeper Review', sub: 'Approve & Issue' },
      { title: '4. Stock Transferred', sub: 'Credited to Station' },
    ], '#d97706', '#fffbeb', '#fde68a'),
    steps: [
      {
        title: 'Create Stock Requisition',
        titleAm: 'አዲስ የስቶክ ጥያቄ ማቅረብ',
        desc: 'Go to Stock Issue & Request → click "+ New Request". Baristas automatically default to "Bar" department; chefs automatically default to "Kitchen" department.',
        descAm: 'ወደ ስቶክ ጥያቄ በመሄድ "+ አዲስ ጥያቄ" ይጫኑ፤ ባሬስታ በቀጥታ "Bar"፣ ሼፍ ደግሞ በቀጥታ "Kitchen" ተብሎ ይመረጣል።',
        action: 'Side Menu ➔ Stock Issue & Request ➔ Click "+ New Request"',
        actionAm: 'የግራ ሜኑ ➔ Stock Issue & Request ➔ "+ New Request" ይጫኑ',
      },
      {
        title: 'Mapped Item Requisition Filter',
        titleAm: 'የተመደቡ ዕቃዎችን ብቻ መጠየቅ',
        desc: 'When requesting items, only raw materials mapped to your station (e.g. coffee beans/milk for Bar; flour/meat/vegetables for Kitchen) are displayed.',
        descAm: 'ዕቃዎችን በሚመርጡበት ጊዜ ለክፍልዎ የተፈቀዱትንና የተመደቡትን ጥሬ ዕቃዎች ብቻ ያሳየዎታል።',
        action: 'SearchableSelect Combobox ➔ Type item name or pick from list',
        actionAm: 'በመፈለጊያ ሳጥኑ ውስጥ የዕቃውን ስም ጽፈው ይምረጡ',
      },
      {
        title: 'Storekeeper Exclusive Dispatch',
        titleAm: 'የዋና ስቶር ጠባቂ ብቻ የማውጣት ስልጣን',
        desc: 'Kitchen and Bar employees can only request. Only the Main Storekeeper, Manager, or Admin has authority to Approve and Issue stock from the central warehouse.',
        descAm: 'የኩሽናና የባር ሰራተኞች መጠየቅ ብቻ ይችላሉ፤ ዕቃውን ከዋና መጋዘን የማጽደቅና ወጪ የማድረግ ስልጣን የዋና ስቶር ጠባቂ ብቻ ነው።',
        action: 'Storekeeper logs in ➔ Stock Issue & Request ➔ Click "Approve & Issue"',
        actionAm: 'ስቶር ጠባቂው ገብቶ ➔ "Approve & Issue" የሚለውን ይጫናል',
      },
      {
        title: 'Real-Time Station Transfer',
        titleAm: 'ቀጥታ የክምችት ማስተላለፍ',
        desc: 'When the Storekeeper issues the request, items are automatically deducted from Main Store and credited to the Kitchen or Bar station balance.',
        descAm: 'ስቶር ጠባቂው ዕቃውን ወጪ ሲያደርግ፣ ከዋና መጋዘን ተቀንሶ በቀጥታ ወደ ጠየቀው ኩሽና ወይም ባር ስቶክ ይጨመራል።',
        action: 'Automatic balance synchronization across Main Store and Station',
        actionAm: 'በቅጽበት ክምችቱ ከዋና መጋዘን ወደ ጣቢያው ይተላለፋል',
      },
    ],
  },
  {
    id: 'pos-cash-sales',
    icon: Utensils,
    color: 'bg-emerald-600',
    title: 'POS Orders & Recipe Deduction',
    titleAm: 'የሽያጭና የካሳ አሰራር እና የግብዓት ቅነሳ',
    role: 'Cashiers, Waiters & Captains',
    roleAm: 'ካሳዎች፣ አስተናጋጆችና ካፕቴኖች',
    flowSvg: makeFlowSvg([
      { title: '1. Order Entry', sub: 'Dine-In / Takeaway / Table' },
      { title: '2. Payment Settlement', sub: 'Cash / Telebirr / Card' },
      { title: '3. Recipe Deduct', sub: 'Bar & Kitchen Depleted' },
      { title: '4. Thermal Printing', sub: 'KOT Slip & Bill Receipt' },
    ], '#059669', '#ecfdf5', '#a7f3d0'),
    steps: [
      {
        title: 'Create POS Order & Payment',
        titleAm: 'ትዕዛዝ መውሰድና ክፍያ መቀበል',
        desc: 'Go to POS or Baba Consumption. Choose Dine-in, Takeaway, or Delivery, pick table, select menu items, and settle bill via Cash, Telebirr, or Card.',
        descAm: 'በካሳ ወይም POS ገጽ ላይ ትዕዛዝ ይውሰዱ፤ ክፍያውን በጥሬ ገንዘብ፣ በቴሌብር ወይም በካርድ ይቀበሉ።',
        action: 'Side Menu ➔ POS or Baba Consumption ➔ Select Table ➔ Tap Menu Items',
        actionAm: 'የግራ ሜኑ ➔ POS ወይም Baba Consumption ➔ ጠረጴዛ ይምረጡ ➔ ምግቦችን ይጫኑ',
      },
      {
        title: 'Automated Station Recipe Deduction',
        titleAm: 'አውቶማቲክ የግብዓት ቅነሳ (Recipe Deduction)',
        desc: 'Upon checkout, the system automatically deducts recipe ingredients: drinks and coffee deduct from Bar Stock; meals and pastries deduct from Kitchen Stock.',
        descAm: 'ሽያጭ ሲፈጸም የተዘጋጀበት ግብዓት በሬሲፒው መሰረት በቀጥታ ይቀነሳል፤ መጠጦች ከባር ስቶክ፣ ምግቦች ደግሞ ከኩሽና ስቶክ ይቀነሳሉ።',
        action: 'Click "Pay / Checkout" ➔ Ingredients automatically deducted',
        actionAm: '"Pay / Checkout" ሲጫኑ ግብዓቶች በቀጥታ ከየክፍሉ ይቀነሳሉ',
      },
      {
        title: 'Manager Order Voiding & Security',
        titleAm: 'ትዕዛዝ መሰረዝና የስቶክ መመለሻ',
        desc: 'Voiding an order requires a manager reason. The system automatically reverses all deducted recipe ingredients back into inventory and audits the action in Activity Log.',
        descAm: 'የተሳሳተ ትዕዛዝ ለመሰረዝ የስራ አስኪያጅ ምክንያት ያስፈልጋል፤ የተቀነሱ ግብዓቶች በሙሉ ወደ ስቶክ ይመለሳሉ እንዲሁም በመዝገብ ላይ ይመዘገባል።',
        action: 'Order Card ➔ Click "Void Order" ➔ Enter Manager Reason',
        actionAm: 'በትዕዛዙ ላይ ➔ "Void Order" ይጫኑ ➔ የስራ አስኪያጅ ምክንያት ያስገቡ',
      },
      {
        title: 'Instant KOT & Receipt Printing',
        titleAm: 'የማዘዣ (KOT) እና የደረሰኝ ህትመት',
        desc: 'Direct integration with Windows thermal receipt printers. Automatically prints KOT order slips for the kitchen/bar and final customer receipts.',
        descAm: 'ወደ ኩሽናና ባር የሚላከውን ማዘዣ (KOT) እና ለደንበኛ የሚሰጠውን ደረሰኝ በቴርማል ፕሪንተር በቅጽበት ያትማል።',
        action: 'Click "Print Receipt" or "Print KOT" (Auto on checkout)',
        actionAm: '"Print Receipt" ወይም "Print KOT" ይጫኑ (በክፍያ ወቅት ራሱ ያትማል)',
      },
    ],
  },
  {
    id: 'digital-menu',
    icon: QrCode,
    color: 'bg-purple-600',
    title: 'Digital QR Menu & Guest Ordering',
    titleAm: 'የዲጂታል ሜኑና የደንበኞች ትዕዛዝ',
    role: 'Customers, Waiters & Captains',
    roleAm: 'ደንበኞች፣ አስተናጋጆችና ካፕቴኖች',
    flowSvg: makeFlowSvg([
      { title: '1. Scan Table QR', sub: 'Mobile Browser View' },
      { title: '2. Guest Self-Order', sub: 'Cart & Special Notes' },
      { title: '3. Waiter Verify', sub: 'Physical Table Check' },
      { title: '4. Sent to Kitchen', sub: 'Printed KOT & POS' },
    ], '#7c3aed', '#f5f3ff', '#ddd6fe'),
    steps: [
      {
        title: 'Table QR Code Scan',
        titleAm: 'በሞባይል የጠረጴዛ QR ኮድ ማንበብ',
        desc: 'Customers scan the QR code at their table to view the live digital menu with photos, descriptions, and prices on their mobile phones.',
        descAm: 'ደንበኞች በጠረጴዛቸው ላይ ያለውን የQR ኮድ በስልካቸው ስካን በማድረግ ምግቦችንና መጠጦችን በፎቶ ማየት ይችላሉ።',
        action: 'Open phone camera ➔ Scan table QR badge ➔ Menu opens in browser',
        actionAm: 'በስልክ ካሜራ የጠረጴዛውን QR ስካን ያድርጉ ➔ ሜኑው በስልኩ ይከፈታል',
      },
      {
        title: 'Guest Self-Order',
        titleAm: 'ደንበኛው ከስልኩ በቀጥታ ማዘዝ',
        desc: 'Guests select items, enter their name, and place their order directly from their phone browser.',
        descAm: 'ደንበኞች የፈለጉትን መርጠው በስልካቸው ላይ "ትዕዛዝ ላክ" በማለት በቀጥታ ወደ ሲስተሙ መላክ ይችላሉ።',
        action: 'Select dishes ➔ Add to cart ➔ Enter guest name ➔ Tap "Place Order"',
        actionAm: 'ምግብ ይምረጡ ➔ ወደ ቅርጫት ይጨምሩ ➔ ስም አስገብተው "ትዕዛዝ ላክ" ይጫኑ',
      },
      {
        title: 'Waiter Verification Security Gate',
        titleAm: 'የአስተናጋጅ ማረጋገጫ ጥበቃ',
        desc: 'To prevent fake or accidental table orders, customer QR orders require the table waiter to physically verify the guest presence and approve before reaching the kitchen.',
        descAm: 'የውሸት ትዕዛዞችን ለመከላከል፣ ደንበኛው ከስልኩ ሲያዝ አስተናጋጁ በአካል ደንበኛው መኖሩን አይቶ ሳያጸድቅ ወደ ኩሽና አይላክም።',
        action: 'Captain/Waiter Screen ➔ Review table order ➔ Click "Verify & Send"',
        actionAm: 'በካፕቴን ገጽ ላይ ➔ ደንበኛው መኖሩን አይተው "Verify & Send" ይጫኑ',
      },
      {
        title: 'Call Waiter & Request Bill',
        titleAm: 'አስተናጋጅ መጥሪያ እና ሂሳብ መጠየቂያ',
        desc: 'Guests can tap "Call Waiter" or "Request Bill" to notify floor staff and trigger Telegram alerts instantly.',
        descAm: 'ደንበኛው ከስልኩ ላይ "አስተናጋጅ ጥራ" ወይም "ሂሳብ አምጡ" የሚለውን በመጫን አስተናጋጁን መጥራት ይችላል።',
        action: 'Guest phone screen ➔ Tap "Call Waiter" or "Request Bill"',
        actionAm: 'በስልኩ ገጽ ላይ ➔ "አስተናጋጅ ጥራ" ወይም "ሂሳብ አምጡ" ይጫኑ',
      },
    ],
  },
  {
    id: 'activity-log',
    icon: Activity,
    color: 'bg-indigo-600',
    title: 'Activity Log & Machine IP Audit',
    titleAm: 'የእንቅስቃሴ መዝገብና የመሳሪያ IP ቁጥጥር',
    role: 'System Admin, Manager & Owner',
    roleAm: 'አስተዳዳሪ፣ ስራ አስኪያጅና ባለቤት',
    flowSvg: makeFlowSvg([
      { title: '1. User Action', sub: 'Order, Issue, or Login' },
      { title: '2. Machine IP Track', sub: 'Device Fingerprint' },
      { title: '3. Live Online State', sub: '15-min Active Pulse 🟢' },
      { title: '4. Audit & CSV Export', sub: 'Filter & Excel Export' },
    ], '#4f46e5', '#eef2ff', '#c7d2fe'),
    steps: [
      {
        title: 'Real-Time Online / Offline Status',
        titleAm: 'የቀጥታ በስራ ላይ መሆን ሁኔታ (Online/Offline)',
        desc: 'Live pulsing indicators display who is currently logged in and active within 15 minutes (🟢 Online) vs inactive (⚪ Offline with relative last active time).',
        descAm: 'የትኛው ሰራተኛ አሁን ሲስተሙ ላይ እየሰራ እንደሆነ (🟢 Online) እና መቼ እንደወጣ (⚪ Offline) በግልጽ ያሳያል።',
        action: 'Side Menu ➔ Activity Log ➔ View "Live Online Users" banner',
        actionAm: 'የግራ ሜኑ ➔ Activity Log ➔ "Live Online Users" ይመልከቱ',
      },
      {
        title: 'Machine IP & Device Signature',
        titleAm: 'የመሳሪያው IP አድራሻ እና የኮምፒውተር አይነት',
        desc: 'Every login, order checkout, stock issue, and settings modification logs the physical machine IP (e.g. 192.168.x.x, 196.188.x.x) and device OS/browser.',
        descAm: 'ማንኛውም ተግባር (መግባት፣ መውጣት፣ ሽያጭ፣ ስቶክ ወጪ) የተፈጸመበትን ትክክለኛ የኮምፒውተር IP አድራሻና የብሮውዘር አይነት ይመዘግባል።',
        action: 'Logged automatically on every server API interaction',
        actionAm: 'በሁሉም ተግባራት ወቅት ሲስተሙ ራሱ መዝግቦ ያስቀምጣል',
      },
      {
        title: 'Audit Trail Search & Filtering',
        titleAm: 'መዝገብ መፈለጊያና ማጣሪያ',
        desc: 'Search by staff name, machine IP address, action type (Login, Checkout, Stock Issue, Void), module, or custom date range.',
        descAm: 'በሰራተኛ ስም፣ በIP አድራሻ፣ በተግባሩ አይነት (ሽያጭ፣ ስቶክ ወጪ፣ መግባት) ወይም በቀን በቀላሉ ፈልገው ማግኘት ይችላሉ።',
        action: 'Use search input or Module/Action/Date filter dropdowns',
        actionAm: 'በፍለጋ ሳጥኑ ወይም በማጣሪያዎቹ ተጠቅመው ይፈልጉ',
      },
      {
        title: 'Management CSV Export',
        titleAm: 'የመረጃ ኤክስፖርት (CSV)',
        desc: 'Export the complete audit log to Excel/CSV for management audits, discrepancy checks, and operational security verification.',
        descAm: 'የአጠቃላይ ሰራተኞችን የስራ እንቅስቃሴ ወደ ኤክሴል/CSV በማውረድ ለኦዲትና ለደህንነት ቁጥጥር መጠቀም ይቻላል።',
        action: 'Click "Export CSV" at the top of the Activity Log page',
        actionAm: 'ከላይ በስተቀኝ "Export CSV" የሚለውን ይጫኑ',
      },
    ],
  },
  {
    id: 'staff-accounts',
    icon: Award,
    color: 'bg-rose-600',
    title: 'Staff Accounts & Digital ID Badges',
    titleAm: 'የሰራተኞች አካውንትና ዲጂታል ባጅ',
    role: 'Admin & HR Management',
    roleAm: 'አስተዳዳሪና የሰው ኃይል አስተዳደር',
    flowSvg: makeFlowSvg([
      { title: '1. Register User', sub: 'Full Name & System Role' },
      { title: '2. Department Scope', sub: 'Lock to Kitchen or Bar' },
      { title: '3. 3x4 Photo Upload', sub: 'Passport Alignment' },
      { title: '4. Print PVC Badge', sub: '2-Sided QR ID Card' },
    ], '#e11d48', '#fff1f2', '#fecdd3'),
    steps: [
      {
        title: 'Account Directory & Role Access',
        titleAm: 'የሰራተኞች አካውንትና የስራ ድርሻ',
        desc: 'Register staff accounts and assign roles (Admin, Manager, Supervisor, Storekeeper, Cashier, Waiter, Dev).',
        descAm: 'ለሰራተኞች አካውንት ይክፈቱ እና የስራ ድርሻ (አስተዳዳሪ፣ ስቶር ጠባቂ፣ ካሳ፣ አስተናጋጅ) ይመድቡ።',
        action: 'Side Menu ➔ Staff Accounts (/users) ➔ Click "+ Add User"',
        actionAm: 'የግራ ሜኑ ➔ Staff Accounts ➔ "+ Add User" ይጫኑ',
      },
      {
        title: 'Station & Department Scoping',
        titleAm: 'የስራ ክፍልና የጣቢያ ምደባ',
        desc: 'Set employee department to Kitchen or Bar to automatically restrict their accessible materials and auto-default their requisitions.',
        descAm: 'ሰራተኛውን ለኩሽና ወይም ለባር በመመደብ የክፍላቸውን ዕቃዎች ብቻ እንዲያዩና እንዲጠይቁ ማድረግ ይችላሉ።',
        action: 'User Form ➔ Select Department ("Kitchen" or "Bar")',
        actionAm: 'በቅጹ ላይ ➔ የስራ ክፍል ("Kitchen" ወይም "Bar") ይምረጡ',
      },
      {
        title: '3x4 Photo Upload & Digital ID Card',
        titleAm: 'የሰራተኛ ፎቶና ዲጂታል መታወቂያ ባጅ',
        desc: 'Upload standard 3x4 employee photos. The system generates high-definition, double-sided printable PVC Digital ID Badges complete with QR code and security stamps.',
        descAm: 'የሰራተኛውን ፎቶ በመጫን በፕላስቲክ (PVC) ላይ የሚታተም ደረጃውን የጠበቀ ባለሁለት ገጽ ዲጂታል መታወቂያ ባጅ ከQR ኮድ ጋር ያትሙ።',
        action: 'User Card ➔ Click "ID Badge" ➔ Preview Front/Back ➔ Click "Print Badge"',
        actionAm: 'በሰራተኛው ካርድ ላይ ➔ "ID Badge" ይጫኑ ➔ "Print Badge" ይጫኑ',
      },
      {
        title: 'Disable / Enable Account',
        titleAm: 'አካውንት ማገድ ወይም ማብራት',
        desc: 'Temporarily deactivate an employee account to prevent login and halt Telegram alerts without deleting their historical audit trails.',
        descAm: 'አንድ ሰራተኛ ስራ ሲያቆም ወይም ለእረፍት ሲወጣ አካውንቱን በማገድ ሲስተሙን እንዳይጠቀም መቆጣጠር ይቻላል።',
        action: 'User Card ➔ Toggle Active/Inactive status switch',
        actionAm: 'በሰራተኛው ካርድ ላይ ➔ የማብሪያ/ማጥፊያ ቁልፉን ይቀያይሩ',
      },
    ],
  },
  {
    id: 'raw-materials',
    icon: Package,
    color: 'bg-teal-600',
    title: 'Raw Materials & Stock Balances',
    titleAm: 'ጥሬ እቃዎችና የክምችት ቁጥጥር',
    role: 'Storekeeper, Chefs, Baristas & Admin',
    roleAm: 'ስቶር ጠባቂ፣ ሼፍ፣ ባሬስታና አስተዳዳሪ',
    flowSvg: makeFlowSvg([
      { title: '1. Register Material', sub: 'Name, Unit & Unit Cost' },
      { title: '2. Set Safety Level', sub: 'Reorder Minimum Target' },
      { title: '3. Multi-Store View', sub: 'Main, Kitchen & Bar' },
      { title: '4. Low Stock Alert', sub: 'Dashboard & Telegram' },
    ], '#0d9488', '#f0fdfa', '#99f6e4'),
    steps: [
      {
        title: 'Multi-Station Stock Views',
        titleAm: 'የጣቢያዎች ስቶክ እይታ (Main, Kitchen, Bar)',
        desc: 'Switch between 🏢 Main Store, 🍳 Kitchen Store, and ☕ Bar Store views to check balances in real-time.',
        descAm: 'በዋና መጋዘን፣ በኩሽና ስቶር እና በባር ስቶር መካከል በመቀያየር የየክፍሉን ክምችት በግልጽ ይመልከቱ።',
        action: 'Side Menu ➔ Raw Materials ➔ Switch Station Tabs at the top',
        actionAm: 'የግራ ሜኑ ➔ Raw Materials ➔ ከላይ ያሉትን ጣቢያዎች ይቀያይሩ',
      },
      {
        title: 'Add Raw Material',
        titleAm: 'አዲስ ጥሬ ዕቃ መመዝገብ',
        desc: 'Click "+ Add Material". Fill in name, measurement unit (kg, L, Pcs), category, unit cost, and safety reorder level.',
        descAm: 'አዲስ ጥሬ ዕቃ በስም፣ በስሌት መለኪያ (ኪሎ፣ ሊትር፣ ፍሬ)፣ በምድብና በዋጋ ይመዝግቡ።',
        action: 'Raw Materials page ➔ Click "+ Add Material"',
        actionAm: 'በጥሬ ዕቃዎች ገጽ ላይ ➔ "+ Add Material" ይጫኑ',
      },
      {
        title: 'Safety Reorder Alerts',
        titleAm: 'የማለቂያ አደጋ ማሳሰቢያ',
        desc: 'Materials dropping below their safety minimum are immediately highlighted in amber/red on the dashboard and sent to Telegram.',
        descAm: 'ዕቃዎች ከተቀመጠላቸው ዝቅተኛ መጠን በታች ሲያልቁ ወዲያውኑ በማሳወቂያና በቴሌግራም መልዕክት ይላካል።',
        action: 'Check yellow/red warning badges on Dashboard & Raw Materials',
        actionAm: 'በዳሽቦርዱ ላይ ቢጫና ቀይ የማስጠንቀቂያ ባጆችን ይመልከቱ',
      },
    ],
  },
  {
    id: 'stock-movements',
    icon: ArrowLeftRight,
    color: 'bg-blue-700',
    title: 'Stock Movements & Receiving',
    titleAm: 'የዕቃ መቀበያና ማስተካከያ (GRV)',
    role: 'Storekeeper, Procurement & Manager',
    roleAm: 'ስቶር ጠባቂ፣ ግዢና ስራ አስኪያጅ',
    flowSvg: makeFlowSvg([
      { title: '1. Delivery Arrives', sub: 'Goods from Supplier' },
      { title: '2. Choose GRV Voucher', sub: 'Cash / Credit / Bazaar' },
      { title: '3. Enter Qty & Cost', sub: 'Attach Receipt Photo' },
      { title: '4. Main Store Credit', sub: 'Inventory Balance Up' },
    ], '#1d4ed8', '#eff6ff', '#bfdbfe'),
    steps: [
      {
        title: 'Cash GRV (Goods Receiving Voucher)',
        titleAm: 'የጥሬ ገንዘብ ዕቃ መቀበያ ሰነድ',
        desc: 'Record materials purchased with cash, including supplier, items, quantities, unit prices, and receipt photo attachments.',
        descAm: 'በጥሬ ገንዘብ የተገዙ ዕቃዎችን ከአቅራቢ፣ ከዋጋ እና ከደረሰኝ ፎቶ ጋር መመዝገቢያ።',
        action: 'Side Menu ➔ Stock Movements ➔ "+ New Movement" ➔ Cash GRV',
        actionAm: 'የግራ ሜኑ ➔ Stock Movements ➔ "+ New Movement" ➔ Cash GRV',
      },
      {
        title: 'Credit GRV',
        titleAm: 'የብድር ዕቃ መቀበያ ሰነድ',
        desc: 'Record goods received on credit terms, automatically updating inventory and tracking payables to the supplier.',
        descAm: 'በብድር የመጡ ዕቃዎችን መመዝገቢያ፤ ስቶኩን ጨምሮ ለአቅራቢው የሚከፈለውን ዕዳ ይመዘግባል።',
        action: 'Stock Movements ➔ "+ New Movement" ➔ Credit GRV',
        actionAm: 'Stock Movements ➔ "+ New Movement" ➔ Credit GRV',
      },
      {
        title: 'Fresh Bazaar',
        titleAm: 'የዕለቱ የገበያ ግዢ (ፍራሽ ባዛር)',
        desc: 'Direct market purchases from daily bazaar without formal invoices, immediately crediting inventory.',
        descAm: 'ከዕለታዊ ገበያ ያለደረሰኝ በቀጥታ የተገዙ አትክልቶችና ፍራፍሬዎችን መመዝገቢያ።',
        action: 'Stock Movements ➔ "+ New Movement" ➔ Fresh Bazaar',
        actionAm: 'Stock Movements ➔ "+ New Movement" ➔ Fresh Bazaar',
      },
      {
        title: 'Adjustments & Disposal',
        titleAm: 'የስቶክ ማስተካከያና የተበላሹ ዕቃዎች ወጪ',
        desc: 'Use Positive Adjustment for surplus, Negative Adjustment for shortages, and Goods Disposal for expired or damaged stock.',
        descAm: 'በቆጠራ ወቅት ለተገኘ ትርፍ (+ve)፣ ለጎደለ (-ve) እና ለተበላሹ/ለጊዜያቸው ያለፈባቸው ዕቃዎች ማስወገጃ።',
        action: 'Stock Movements ➔ Select Positive Adjustment, Negative Adjustment, or Disposal',
        actionAm: 'Stock Movements ➔ Positive/Negative Adjustment ወይም Disposal ይምረጡ',
      },
    ],
  },
  {
    id: 'reports',
    icon: BarChart2,
    color: 'bg-amber-600',
    title: 'Reports, Analytics & P&L',
    titleAm: 'ሪፖርቶች፣ ትንተናና የትርፍ/ኪሳራ ሂሳብ',
    role: 'Owner, General Manager & Accountant',
    roleAm: 'ባለቤት፣ ስራ አስኪያጅና አካውንታንት',
    flowSvg: makeFlowSvg([
      { title: '1. Daily Transactions', sub: 'Sales & Inventory Out' },
      { title: '2. COGS Computation', sub: 'Recipe Ingredient Cost' },
      { title: '3. Valuation Balance', sub: 'Main, Kitchen & Bar' },
      { title: '4. Export PDF / Excel', sub: 'Management Reporting' },
    ], '#b45309', '#fffbeb', '#fde68a'),
    steps: [
      {
        title: 'Stock Balance Sheet',
        titleAm: 'የስቶክ ሚዛን ሰነድ (Stock Balance Sheet)',
        desc: 'Complete overview of all raw materials across Main Store, Kitchen, and Bar with valuation, exportable to PDF and Excel.',
        descAm: 'የሁሉንም ክፍሎች ስቶክ ክምችትና የገንዘብ ዋጋ በአንድ ላይ በማሳየት ለህትመትና ለኤክሴል ያዘጋጃል።',
        action: 'Side Menu ➔ Reports ➔ Stock Balance Sheet ➔ Click Export PDF/Excel',
        actionAm: 'የግራ ሜኑ ➔ Reports ➔ Stock Balance Sheet ➔ Export የሚለውን ይጫኑ',
      },
      {
        title: 'Daily Movement Report',
        titleAm: 'የዕለቱ የስቶክ እንቅስቃሴ ሪፖርት',
        desc: 'Tracks daily inflow, outflow, consumption, and transfers with opening and closing balances.',
        descAm: 'የዕለቱን አጠቃላይ የዕቃ ገቢ፣ ወጪ፣ ፍጆታ እና የተላለፉ ዕቃዎችን በዝርዝር ያሳያል።',
        action: 'Side Menu ➔ Reports ➔ Daily Movement Report',
        actionAm: 'የግራ ሜኑ ➔ Reports ➔ Daily Movement Report',
      },
      {
        title: 'Sales, COGS & Gross Profit',
        titleAm: 'የሽያጭ፣ የወጪና የትርፍ ትንተና',
        desc: 'Real-time sales revenue, recipe ingredient cost (COGS), profit margins, and top-selling menu items.',
        descAm: 'የሽያጭ ገቢን፣ የወጣውን የግብዓት ወጪ (COGS) እና የተገኘውን ትርፍ በመቶኛ ያሰላል።',
        action: 'Side Menu ➔ Analytics ➔ View profit margins and sales cost trends',
        actionAm: 'የግራ ሜኑ ➔ Analytics ➔ የሽያጭ ትርፍና የወጪ ግራፎችን ይመልከቱ',
      },
    ],
  },
  {
    id: 'settings-hardware',
    icon: SettingsIcon,
    color: 'bg-slate-700',
    title: 'Settings, Security & Hardware',
    titleAm: 'የስርዓቱ ማስተካከያ፣ ደህንነትና ፕሪንተሮች',
    role: 'Administrator & Technical Support',
    roleAm: 'አስተዳዳሪና የቴክኒክ ድጋፍ',
    flowSvg: makeFlowSvg([
      { title: '1. Role Privileges', sub: 'Permissions & Modules' },
      { title: '2. Printer Bridge', sub: 'Windows ESC/POS Setup' },
      { title: '3. Telegram Bot', sub: 'Mobile Push Notifications' },
      { title: '4. Auto-Logout Lock', sub: 'Terminal Security Timer' },
    ], '#334155', '#f8fafc', '#cbd5e1'),
    steps: [
      {
        title: 'Role Privileges & Permissions',
        titleAm: 'የተጠቃሚዎች ስልጣንና ፈቃድ',
        desc: 'Fine-tune who can view specific menu modules, edit unit costs, or access management settings.',
        descAm: 'የትኛው የስራ ክፍል ምን ማየትና መስራት እንደሚችል በግልጽ የሚወሰንበት ገጽ።',
        action: 'Side Menu ➔ Settings ➔ Role Privileges',
        actionAm: 'የግራ ሜኑ ➔ Settings ➔ Role Privileges',
      },
      {
        title: 'Thermal Printer Bridge',
        titleAm: 'የቴርማል ፕሪንተር ግንኙነት',
        desc: 'Configure local Windows printer bridge, network ESC/POS thermal printers, and customize receipt header/footer details.',
        descAm: 'የደረሰኝና የትዕዛዝ ማዘዣ (KOT) ፕሪንተሮችን ከኮምፒውተሩ ጋር ማገናኛና ማስተካከያ።',
        action: 'Side Menu ➔ Settings ➔ Printers ➔ Test Print KOT & Receipt',
        actionAm: 'የግራ ሜኑ ➔ Settings ➔ Printers ➔ ፕሪንተር ፈትሽ',
      },
      {
        title: 'Telegram Alert Integration',
        titleAm: 'የቴሌግራም መልዕክት ማገናኛ',
        desc: 'Connect Telegram bot token and chat IDs for instant mobile alerts on requisitions, low stock, and daily sales summaries.',
        descAm: 'ለስራ አስኪያጆችና ለባለቤቱ በቴሌግራም ፈጣን የስቶክና የሽያጭ ማሳወቂያ እንዲደርሳቸው ማገናኛ።',
        action: 'Side Menu ➔ Settings ➔ Telegram ➔ Test Telegram Bot',
        actionAm: 'የግራ ሜኑ ➔ Settings ➔ Telegram ➔ የቴሌግራም ቦት ይሞክሩ',
      },
      {
        title: 'Auto-Logout Workstation Security',
        titleAm: 'የስራ ቦታ ደህንነት (Auto-Logout)',
        desc: 'Set automatic session lock timers (15m, 30m, 1h, or Off) so unattended terminals securely sign out.',
        descAm: 'ኮምፒውተሩ ስራ ሳይሰራ ሲቀር ራሱን በራሱ ዘግቶ እንዲቆለፍ በማድረግ ያልተፈቀደ ሰው እንዳይጠቀምበት ይጠብቃል።',
        action: 'Top Bar ➔ Profile Menu ➔ Auto-Logout Timer dropdown',
        actionAm: 'ከላይ በስተቀኝ ➔ የተጠቃሚ ሜኑ ➔ Auto-Logout ይምረጡ',
      },
    ],
  },
  {
    id: 'role-workflows',
    icon: Users,
    color: 'bg-violet-700',
    title: 'Role-by-Role Daily Workflows',
    titleAm: 'ማን ምን ይሰራል? - ዕለታዊ የስራ መመሪያ',
    role: 'All Positions / ሁሉም የስራ ክፍሎች',
    roleAm: 'ሁሉም የስራ ክፍሎች',
    flowSvg: makeFlowSvg([
      { title: '1. Storekeeper', sub: 'Receives & Issues Stock' },
      { title: '2. Chef & Barista', sub: 'Requests & Prepares Items' },
      { title: '3. Floor Waiter', sub: 'Verifies QR & Serves' },
      { title: '4. Cashier & POS', sub: 'Settles Bills & Receipts' },
      { title: '5. Manager / Owner', sub: 'Audits Logs & Profits' },
    ], '#6d28d9', '#f5f3ff', '#ddd6fe'),
    steps: [
      {
        title: 'Main Storekeeper Routine',
        titleAm: 'የዋና ስቶር ጠባቂ ዕለታዊ ስራ',
        desc: 'Morning goods receiving via Cash/Credit GRV and Fresh Bazaar ➔ Check pending requests from Bar and Kitchen ➔ Click "Approve & Issue" to transfer stock ➔ Log negative adjustments/disposals for waste ➔ End-of-day stock count.',
        descAm: 'ጠዋት የዕቃ መቀበያ ሰነድ (GRV) መመዝገብ ➔ የባርና የኩሽና ጥያቄዎችን አይቶ ወጪ ማድረግ (Issue) ➔ የተበላሸ እቃ ማስወጣት ➔ የቀን መጨረሻ ቆጠራ ማካሄድ።',
        action: 'Primary pages: /materials, /transactions, /stock-requests',
        actionAm: 'ዋና ገጾች፡ /materials, /transactions, /stock-requests',
      },
      {
        title: 'Barista & Beverage Staff Routine',
        titleAm: 'የባሬስታና የባር ሰራተኛ ዕለታዊ ስራ',
        desc: 'Login ➔ Go to Stock Requests (auto-defaults to Bar) ➔ Submit requests for milk, coffee beans, syrups ➔ Receive items into Bar balance ➔ Prepare drink orders printing on Bar KOT ➔ Monitor Bar Stock.',
        descAm: 'መግባት ➔ ወደ ስቶክ ጥያቄ ገጽ መሄድ ➔ ለቡና፣ ለወተት፣ ለሻይ ጥያቄ ማቅረብ ➔ የወጡ እቃዎችን መቀበል ➔ በባር KOT የሚመጡ ትዕዛዞችን ማዘጋጀት።',
        action: 'Primary pages: /stock-requests (Bar items only)',
        actionAm: 'ዋና ገጽ፡ /stock-requests (የባር ዕቃዎች ብቻ)',
      },
      {
        title: 'Kitchen Head Chef & Cooks Routine',
        titleAm: 'የኩሽና ዋና ሼፍና ሰራተኞች ዕለታዊ ስራ',
        desc: 'Login ➔ Submit Kitchen requisitions for meat, produce, flour, seasonings ➔ Receive items into Kitchen balance ➔ Cook dishes printing on Kitchen KOT ➔ Report recipe or spoilage notes to manager.',
        descAm: 'መግባት ➔ ለስጋ፣ ለአትክልትና ለዱቄት ጥያቄ ማቅረብ ➔ ስቶር ጠባቂው ያወጣውን መረከብ ➔ በኩሽና ፕሪንተር የሚታተሙ ትዕዛዞችን ማብሰልና ማቅረብ።',
        action: 'Primary pages: /stock-requests (Kitchen items only)',
        actionAm: 'ዋና ገጽ፡ /stock-requests (የኩሽና ዕቃዎች ብቻ)',
      },
      {
        title: 'Floor Waiter & Captain Routine',
        titleAm: 'የአስተናጋጅና የካፕቴን ዕለታዊ ስራ',
        desc: 'Login on workstation/mobile ➔ Verify in-person customer table QR orders before they reach kitchen ➔ Take captain orders for walk-ins ➔ Respond to guest Call Waiter and Bill Request alerts.',
        descAm: 'መግባት ➔ ደንበኛው ከስልኩ ያዘዘውን በአካል አይቶ ማረጋገጥ (Verify) ➔ በአካል ለሚመጡ ትዕዛዝ መውሰድ ➔ ደንበኛው ሲጠራ ወይም ሂሳብ ሲጠይቅ ማስተናገድ።',
        action: 'Primary pages: /captain-order, /menu',
        actionAm: 'ዋና ገጾች፡ /captain-order, /menu',
      },
      {
        title: 'Cashier & POS Operator Routine',
        titleAm: 'የካሳና የሽያጭ ሰራተኛ ዕለታዊ ስራ',
        desc: 'Login at POS counter ➔ Select table and order type (Dine-in, Takeaway, Delivery) ➔ Settle payments via Cash, Telebirr, or Card ➔ Hand tax receipts to customers ➔ Print end-of-shift cash sales report.',
        descAm: 'በካሳ ኮምፒውተር መግባት ➔ ጠረጴዛ መርጦ ትዕዛዝ ማስገባት ➔ በጥሬ ገንዘብ፣ በቴሌብር ወይም በካርድ ክፍያ መቀበል ➔ ደረሰኝ ማተም ➔ የፈረቃ መጨረሻ የሂሳብ ሪፖርት ማውጣት።',
        action: 'Primary pages: /pos, /cash-sales',
        actionAm: 'ዋና ገጾች፡ /pos, /cash-sales',
      },
      {
        title: 'Manager & Owner Routine',
        titleAm: 'የስራ አስኪያጅና የባለቤት ዕለታዊ ስራ',
        desc: 'Review Live Online Users and machine IP audit trail (/activity-log) ➔ Authorize order voids with reason ➔ Review real-time sales revenue, COGS, and gross profit (/analytics) ➔ Manage staff privileges and digital ID badges.',
        descAm: 'በቀጥታ በስራ ላይ ያሉትንና የኮምፒውተር IP መዝገብ መቆጣጠር ➔ የተሳሳተ ትዕዛዝ ሲሰረዝ ማጽደቅ ➔ የዕለቱን ትርፍና የግብዓት ወጪ መከታተል ➔ የሰራተኞችን ፈቃድና ዲጂታል መታወቂያ ማስተዳደር።',
        action: 'Primary pages: /dashboard, /activity-log, /analytics, /users, /reports',
        actionAm: 'ዋና ገጾች፡ /dashboard, /activity-log, /analytics, /users, /reports',
      },
    ],
  },
];

const QUICK_TIPS = [
  {
    icon: '🔒',
    tip: 'All system activities, logins, and POS orders record the machine IP address for complete security accountability.',
    tipAm: 'ሁሉም ተግባራትና ሽያጮች የተፈጸሙበትን የኮምፒውተር IP አድራሻ በመመዝገብ ሙሉ የደህንነት ቁጥጥር ያደርጋሉ።'
  },
  {
    icon: '🏢',
    tip: '100% of materials begin in Main Store. Stations receive stock through requisitions approved by the Storekeeper.',
    tipAm: 'ሁሉም ዕቃዎች መጀመሪያ የሚገቡት ዋና መጋዘን ነው፤ ኩሽናና ባር ዕቃ የሚያገኙት በስቶር ጠባቂው ሲጸድቅ ብቻ ነው።'
  },
  {
    icon: '🍳',
    tip: 'Baristas and Kitchen staff are automatically restricted to only request and view their mapped station items.',
    tipAm: 'የባርና የኩሽና ሰራተኞች ለክፍላቸው የተመደቡላቸውን ዕቃዎች ብቻ እንዲያዩና እንዲጠይቁ ተደርገው የተገደቡ ናቸው።'
  },
  {
    icon: '🎫',
    tip: 'Generate and print high-resolution PVC Digital ID Badges for all staff directly from Staff Accounts.',
    tipAm: 'ለሰራተኞች በፕላስቲክ (PVC) ላይ የሚታተሙ ዲጂታል የመታወቂያ ባጆችን ከሰራተኞች ገጽ ላይ ማመንጨት ይችላሉ።'
  },
  {
    icon: '📱',
    tip: 'Customer QR orders require waiter verification before sending to the kitchen to prevent accidental orders.',
    tipAm: 'ደንበኞች በሞባይላቸው ያዘዙት ትዕዛዝ ወደ ኩሽና ከመላኩ በፊት አስተናጋጅ በአካል ማረጋገጥ አለበት።'
  },
  {
    icon: '⚡',
    tip: 'Check the live Activity Log (/activity-log) to see which team members are currently online and working.',
    tipAm: 'የትኛው ሰራተኛ አሁን በስራ ላይ እንዳለ በቀጥታ በእንቅስቃሴ መዝገብ (/activity-log) ላይ ማየት ይችላሉ።'
  },
];

// ─────────────────────────────────────────
// DOCUMENTATION GENERATORS (PDF & OFFLINE MARKDOWN)
// ─────────────────────────────────────────
function generateGuidePrintHtml() {
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const sectionsHtml = HELP_SECTIONS.map((sec, idx) => {
    const stepsHtml = sec.steps.map((st, sIdx) => `
      <div class="step-card">
        <div class="step-num">${sIdx + 1}</div>
        <div class="step-body">
          <div class="step-title-en">${st.title}</div>
          <div class="step-title-am">${st.titleAm || ''}</div>
          <p class="step-desc-en">${st.desc}</p>
          <p class="step-desc-am">${st.descAm || ''}</p>
          ${st.action ? `
            <div class="step-action-box">
              <span class="action-tag">👉 ACTION / አሰራር:</span>
              <span class="action-text">${st.action} ${st.actionAm ? ' | ' + st.actionAm : ''}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="manual-section" id="section-${sec.id}">
        <div class="sec-header">
          <span class="sec-index">${idx + 1}</span>
          <div class="sec-titles">
            <h2 class="sec-en">${sec.title}</h2>
            <h3 class="sec-am">${sec.titleAm || ''}</h3>
          </div>
          ${sec.role ? `<span class="sec-role-badge">${sec.role}</span>` : ''}
        </div>
        <div class="sec-flow-wrap">
          <div class="flow-label">VISUAL PROCESS FLOW / የአሰራር ሂደት ቅደም ተከተል</div>
          ${sec.flowSvg || ''}
        </div>
        <div class="sec-steps">
          ${stepsHtml}
        </div>
      </div>
    `;
  }).join('');

  const tipsHtml = QUICK_TIPS.map((tip) => `
    <div class="tip-box">
      <span class="tip-icon">${tip.icon}</span>
      <div class="tip-content">
        <div class="tip-en">${tip.tip}</div>
        <div class="tip-am">${tip.tipAm}</div>
      </div>
    </div>
  `).join('');

  const tocHtml = HELP_SECTIONS.map((sec, idx) => `
    <div class="toc-line">
      <span class="toc-num">${idx + 1}.</span>
      <span class="toc-title">${sec.title}</span>
      <span class="toc-am">(${sec.titleAm})</span>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Baba Roti Cafe & Restaurant - User Manual & Operating Guide</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 15mm 14mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans Ethiopic", "Nyala", "Abyssinica SIL", sans-serif;
      color: #0f172a;
      background: #ffffff;
      padding: 24px;
      line-height: 1.5;
    }
    .print-bar {
      position: sticky;
      top: 0;
      z-index: 1000;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      margin-bottom: 24px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.2);
    }
    .print-btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .print-btn:hover { background: #1d4ed8; }
    .close-btn {
      background: #475569;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      margin-left: 8px;
    }
    .manual-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 16px;
      margin-bottom: 20px;
    }
    .main-title {
      font-size: 22pt;
      font-weight: 900;
      color: #1e3a8a;
      letter-spacing: -0.5px;
    }
    .sub-title {
      font-size: 12.5pt;
      font-weight: 700;
      color: #2563eb;
      margin-top: 3px;
    }
    .tagline {
      font-size: 9pt;
      color: #64748b;
      margin-top: 4px;
    }
    .meta-box {
      text-align: right;
      font-size: 8.5pt;
      color: #64748b;
      line-height: 1.4;
    }
    .summary-badge-bar {
      display: flex;
      gap: 12px;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 8px 14px;
      margin-bottom: 20px;
      font-size: 9pt;
      font-weight: 600;
      color: #334155;
    }
    .summary-badge-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .toc-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .toc-header {
      font-size: 10.5pt;
      font-weight: 800;
      color: #1e293b;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
    }
    .toc-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 6px 16px;
    }
    .toc-line {
      font-size: 9pt;
      color: #334155;
    }
    .toc-num {
      font-weight: 800;
      color: #2563eb;
      margin-right: 4px;
    }
    .toc-am {
      color: #64748b;
      font-size: 8.5pt;
    }
    .manual-section {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      overflow: hidden;
      margin-bottom: 24px;
      page-break-inside: avoid;
    }
    .sec-header {
      background: #f1f5f9;
      padding: 10px 14px;
      border-bottom: 1px solid #cbd5e1;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .sec-index {
      background: #2563eb;
      color: white;
      font-weight: 900;
      font-size: 11pt;
      width: 26px;
      height: 26px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .sec-titles { flex: 1; }
    .sec-en {
      font-size: 12pt;
      font-weight: 800;
      color: #0f172a;
    }
    .sec-am {
      font-size: 10pt;
      font-weight: 600;
      color: #475569;
    }
    .sec-role-badge {
      font-size: 8pt;
      font-weight: 700;
      background: #e0e7ff;
      color: #3730a3;
      padding: 3px 8px;
      border-radius: 6px;
      border: 1px solid #c7d2fe;
    }
    .sec-flow-wrap {
      background: #ffffff;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
    }
    .flow-label {
      font-size: 7.5pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .sec-steps {
      padding: 12px 14px;
    }
    .step-card {
      display: flex;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px dashed #e2e8f0;
    }
    .step-card:last-child {
      border-bottom: none;
      padding-bottom: 0;
    }
    .step-num {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: #dbeafe;
      color: #1e40af;
      font-weight: 800;
      font-size: 9pt;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .step-body { flex: 1; }
    .step-title-en {
      font-size: 10pt;
      font-weight: 700;
      color: #0f172a;
    }
    .step-title-am {
      font-size: 9pt;
      font-weight: 600;
      color: #2563eb;
      margin-bottom: 3px;
    }
    .step-desc-en {
      font-size: 8.5pt;
      color: #334155;
      line-height: 1.45;
      margin-bottom: 2px;
    }
    .step-desc-am {
      font-size: 8.5pt;
      color: #475569;
      line-height: 1.45;
      margin-bottom: 4px;
    }
    .step-action-box {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: 4px 8px;
      margin-top: 4px;
    }
    .action-tag {
      font-size: 7.5pt;
      font-weight: 800;
      color: #1d4ed8;
      flex-shrink: 0;
    }
    .action-text {
      font-size: 8pt;
      font-weight: 600;
      color: #1e3a8a;
    }
    .tips-card {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 10px;
      padding: 14px 18px;
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .tips-header {
      font-size: 10.5pt;
      font-weight: 800;
      color: #92400e;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tip-box {
      display: flex;
      gap: 10px;
      margin-bottom: 8px;
    }
    .tip-box:last-child { margin-bottom: 0; }
    .tip-icon { font-size: 12pt; flex-shrink: 0; }
    .tip-en { font-size: 8.5pt; font-weight: 600; color: #78350f; }
    .tip-am { font-size: 8pt; color: #92400e; }
    .manual-footer {
      border-top: 2px solid #e2e8f0;
      padding-top: 12px;
      margin-top: 24px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
      .print-bar { display: none !important; }
      .manual-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="print-bar">
    <div>
      <div style="font-weight: 800; font-size: 14px;">Baba Roti Cafe & Restaurant - User Guide (12 Modules)</div>
      <div style="font-size: 11px; color: #94a3b8;">Click "Save as PDF / Print" to export. Ensure destination is set to "Save as PDF".</div>
    </div>
    <div>
      <button class="print-btn" onclick="window.print()">🖨️ Save as PDF / Print</button>
      <button class="close-btn" onclick="window.close()">✕ Close</button>
    </div>
  </div>

  <div class="manual-header">
    <div>
      <h1 class="main-title">Baba Roti Cafe & Restaurant</h1>
      <h2 class="sub-title">Complete User Manual & System Guide / የተጠቃሚዎች መመሪያ መጽሐፍ</h2>
      <p class="tagline">Official Operating Documentation, Workflows & Flowcharts · Powered by MEGA Technology</p>
    </div>
    <div class="meta-box">
      <div><strong>Date:</strong> ${currentDate}</div>
      <div><strong>System Version:</strong> 2.4.0 Live</div>
      <div><strong>Audit:</strong> Real-Time Machine IP Tracking</div>
    </div>
  </div>

  <div class="summary-badge-bar">
    <div class="summary-badge-item">📚 <strong>12 System Modules</strong></div>
    <div class="summary-badge-item">🔄 <strong>12 Vector Process Flowcharts</strong></div>
    <div class="summary-badge-item">🌐 <strong>Bilingual (English & Amharic)</strong></div>
    <div class="summary-badge-item">🎯 <strong>Step-by-Step Action Navigation</strong></div>
  </div>

  <div class="toc-card">
    <div class="toc-header">Table of Contents / ማውጫ (12 Operating Modules)</div>
    <div class="toc-grid">
      ${tocHtml}
    </div>
  </div>

  ${sectionsHtml}

  <div class="tips-card">
    <div class="tips-header">Key System Rules & Best Practices / ወሳኝ የአሰራር ደንቦች</div>
    ${tipsHtml}
  </div>

  <div class="manual-footer">
    <div>Baba Roti Cafe & Restaurant Management System · All Rights Reserved</div>
    <div>Technical Development & Engineering: MEGA Technology</div>
  </div>
</body>
</html>`;
}

function generateGuideMarkdown() {
  const currentDate = new Date().toISOString().split('T')[0];
  let md = `# Baba Roti Cafe & Restaurant - Complete System User Manual & Operating Guide
**የባባ ሮቲ ካፌና ሬስቶራንት የተሟላ የአሰራርና የተጠቃሚዎች መመሪያ መጽሐፍ**  
*System Version: 2.4.0 Live | Date: ${currentDate} | Powered by MEGA Technology*

---

## 📑 Table of Contents / ማውጫ
`;

  HELP_SECTIONS.forEach((sec, idx) => {
    md += `${idx + 1}. [${sec.title} / ${sec.titleAm}](#section-${sec.id})
`;
  });
  md += `13. [Key Rules & Quick Tips / ወሳኝ ደንቦች](#quick-tips)

---

`;

  HELP_SECTIONS.forEach((sec, idx) => {
    md += `## <a id="section-${sec.id}"></a>${idx + 1}. ${sec.title}
`;
    md += `### ${sec.titleAm}
`;
    md += `**Target Role / የስራ ድርሻ:** ${sec.role || 'All Staff'}

`;

    md += '#### 🔄 Visual Process Flow / የአሰራር ሂደት:\n```\n';
    md += sec.steps.map((s, i) => `[${i + 1}. ${s.title}]`).join(' ──▶ ') + '\n```\n\n';

    sec.steps.forEach((st, sIdx) => {
      md += `#### Step ${sIdx + 1}: ${st.title} (${st.titleAm})
`;
      md += `- **English:** ${st.desc}
`;
      md += `- **አማርኛ:** ${st.descAm}
`;
      if (st.action) {
        md += `- **👉 Action / አሰራር:** ${st.action} ${st.actionAm ? ' | ' + st.actionAm : ''}
`;
      }
      md += `
`;
    });
    md += `---

`;
  });

  md += `## <a id="quick-tips"></a>13. Key Rules & Best Practices / ወሳኝ ደንቦች

`;
  QUICK_TIPS.forEach((tip, idx) => {
    md += `${idx + 1}. **${tip.icon} English:** ${tip.tip}
   - **አማርኛ:** ${tip.tipAm}

`;
  });

  md += `
---
*Baba Roti Stock & POS System · Technical Support & Development: MEGA Technology*
`;
  return md;
}

// ─────────────────────────────────────────
// HELP MODAL COMPONENT
// ─────────────────────────────────────────
const HelpModal = ({ onClose }) => {
  const { isAmharic } = useLanguage();
  const [activeSection, setActiveSection] = useState('getting-started');
  const [search, setSearch] = useState('');

  const handleDownloadPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(isAmharic ? 'እባክዎ ፖፕ-አፕ (Popups) ይፍቀዱ መመሪያውን ለማውረድ።' : 'Please allow popups in your browser to download or print the PDF manual.');
      return;
    }
    printWindow.document.write(generateGuidePrintHtml());
    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 400);
  };

  const handleDownloadMarkdown = () => {
    const md = generateGuideMarkdown();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'BABA_ROTI_COMPLETE_USER_MANUAL_AND_GUIDE.md';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const current = HELP_SECTIONS.find(s => s.id === activeSection) || HELP_SECTIONS[0];

  const filtered = search.trim()
    ? HELP_SECTIONS.flatMap(s =>
      s.steps
        .filter(st => {
          const q = search.toLowerCase();
          return (
            st.title.toLowerCase().includes(q) ||
            (st.titleAm && st.titleAm.toLowerCase().includes(q)) ||
            st.desc.toLowerCase().includes(q) ||
            (st.descAm && st.descAm.toLowerCase().includes(q)) ||
            (st.action && st.action.toLowerCase().includes(q)) ||
            s.title.toLowerCase().includes(q) ||
            (s.titleAm && s.titleAm.toLowerCase().includes(q))
          );
        })
        .map(st => ({
          ...st,
          section: isAmharic && s.titleAm ? s.titleAm : s.title,
          color: s.color,
        }))
    )
    : null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl rounded-3xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b border-ink-100"
          style={{ background: 'linear-gradient(135deg, #1a3cdb 0%, #4f46e5 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/20">
              <BookOpen size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">
                {isAmharic ? 'የእርዳታና አሰራር መመሪያዎች' : 'Help & Documentation'}
              </h2>
              <p className="text-xs text-blue-200">
                {isAmharic ? 'ለእያንዳንዱ አዲስ ገጽና አሰራር ደረጃ በደረጃ የቀረበ ማብራሪያና ሂደት' : 'Step-by-step documentation, flowcharts & workflows'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              title={isAmharic ? 'መመሪያውን እንደ PDF አውርድ / አትም' : 'Download / Print Guide as PDF'}
              className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm"
            >
              <Download size={14} />
              <span>{isAmharic ? 'PDF አውርድ' : 'Download PDF'}</span>
            </button>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30 transition"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-ink-100 bg-ink-50/40">
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2">
            <Search size={14} className="text-ink-400 flex-shrink-0" />
            <input
              type="text"
              placeholder={isAmharic ? 'ርዕስ፣ አሰራር ወይም መመሪያ ይፈልጉ...' : 'Search help topics, features, workflows...'}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 text-xs outline-none text-ink-800 placeholder-ink-400 bg-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-ink-400 hover:text-ink-700">
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Section nav */}
          {!search && (
            <div className="w-60 flex-shrink-0 border-r border-ink-100 overflow-y-auto bg-ink-50/40 py-3 px-2">
              {HELP_SECTIONS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-xs font-medium transition mb-0.5 ${activeSection === s.id
                    ? 'bg-white shadow-sm text-blue-700 font-bold border border-ink-100'
                    : 'text-ink-600 hover:bg-white/70 hover:text-ink-900'
                    }`}
                >
                  <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg ${s.color}`}>
                    <s.icon size={12} className="text-white" />
                  </span>
                  <span className="truncate">{isAmharic && s.titleAm ? s.titleAm : s.title}</span>
                  {activeSection === s.id && (
                    <ChevronRight size={12} className="ml-auto text-blue-400 flex-shrink-0" />
                  )}
                </button>
              ))}
              <div className="mt-4 px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400 px-2 mb-2">
                  {isAmharic ? 'ጠቃሚ ምክሮች' : 'Quick Tips'}
                </p>
                {QUICK_TIPS.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg p-2 text-[11px] text-ink-600 hover:bg-white/70 transition">
                    <span className="flex-shrink-0 text-sm">{t.icon}</span>
                    <span className="leading-relaxed">{isAmharic && t.tipAm ? t.tipAm : t.tip}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content area */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {filtered !== null ? (
              <div>
                <p className="text-xs font-bold text-ink-500 mb-4">
                  {filtered.length} result{filtered.length !== 1 ? 's' : ''} for{' '}
                  <span className="text-blue-600">"{search}"</span>
                </p>
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-ink-400">
                    <Search size={32} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">{isAmharic ? 'ምንም ውጤት አልተገኘም' : 'No results found'}</p>
                    <p className="text-xs mt-1">{isAmharic ? 'ሌላ ቃል ይሞክሩ' : 'Try a different keyword'}</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map((r, i) => (
                      <div key={i} className="rounded-xl border border-ink-100 bg-ink-50/50 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 text-white ${r.color}`}>
                            {r.section}
                          </span>
                          <p className="text-sm font-bold text-ink-900">{isAmharic && r.titleAm ? r.titleAm : r.title}</p>
                        </div>
                        <p className="text-xs text-ink-600 leading-relaxed mb-2">{isAmharic && r.descAm ? r.descAm : r.desc}</p>
                        {r.action && (
                          <div className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-medium text-blue-700 flex items-center gap-1.5">
                            <span>👉</span>
                            <span>{isAmharic && r.actionAm ? r.actionAm : r.action}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              current && (
                <div>
                  {/* Module Title & Role Tag */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${current.color} shadow-sm`}>
                        <current.icon size={18} className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-ink-900">{isAmharic && current.titleAm ? current.titleAm : current.title}</h3>
                        <p className="text-xs text-ink-400">{current.steps.length} {isAmharic ? 'ደረጃዎች' : 'key steps'}</p>
                      </div>
                    </div>
                    {current.role && (
                      <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[10px] font-bold text-blue-700">
                        {isAmharic && current.roleAm ? current.roleAm : current.role}
                      </span>
                    )}
                  </div>

                  {/* Visual Process Flowchart */}
                  {current.flowSvg && (
                    <div className="mb-5 rounded-2xl border border-ink-200/80 bg-white p-3 shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400 flex items-center gap-1.5">
                          <Layers size={11} className="text-blue-600" />
                          {isAmharic ? 'የስራው ሂደት ቅደም ተከተል (Visual Flow)' : 'Process Workflow Flowchart'}
                        </span>
                        <span className="text-[10px] font-medium text-ink-400">
                          {current.steps.length} {isAmharic ? 'ደረጃዎች' : 'steps'}
                        </span>
                      </div>
                      <div className="overflow-x-auto" dangerouslySetInnerHTML={{ __html: current.flowSvg }} />
                    </div>
                  )}

                  {/* Step-by-Step Instructions */}
                  <div className="space-y-3">
                    {current.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="rounded-2xl border border-ink-100 bg-white p-4 hover:border-blue-200 hover:bg-blue-50/20 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-black mt-0.5 shadow-sm">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-ink-900 mb-1">
                              {isAmharic && step.titleAm ? step.titleAm : step.title}
                            </p>
                            <p className="text-xs text-ink-600 leading-relaxed mb-2">
                              {isAmharic && step.descAm ? step.descAm : step.desc}
                            </p>
                            {(step.action || step.actionAm) && (
                              <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-3 py-1.5 text-[11px] text-blue-800 flex items-center gap-1.5 font-medium">
                                <span className="text-blue-500 font-bold">👉</span>
                                <span>{isAmharic && step.actionAm ? step.actionAm : step.action}</span>
                              </div>
                            )}
                          </div>
                          <CheckCircle2 size={16} className="flex-shrink-0 text-ink-200 mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex items-start gap-3">
                    <Lightbulb size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-amber-900 mb-1">{isAmharic ? 'ተጨማሪ እርዳታ ይፈልጋሉ?' : 'Need more help?'}</p>
                      <p className="text-xs text-amber-700 leading-relaxed">
                        {isAmharic
                          ? 'እባክዎ የስርዓቱን አስተዳዳሪ ወይም የMEGA Technology የቴክኒክ ድጋፍ ቡድንን ያነጋግሩ።'
                          : 'Contact your system administrator or reach MEGA Technology support for assistance.'}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-ink-100 bg-ink-50/40 px-6 py-3">
          <p className="text-[10px] text-ink-400">Baba Roti Cafe · Hotel & Restaurant System · Powered by MEGA Technology</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-ink-100 transition"
              title={isAmharic ? 'የማርክዳውን ፋይል አውርድ' : 'Download Offline Markdown Manual'}
            >
              <FileText size={13} />
              <span>{isAmharic ? 'ኦፍላይን (.md)' : 'Offline (.md)'}</span>
            </button>
            <button
              onClick={handleDownloadPDF}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              title={isAmharic ? 'መመሪያውን እንደ PDF አውርድ / አትም' : 'Download / Print Complete PDF Manual'}
            >
              <Download size={13} />
              <span>{isAmharic ? 'መመሪያውን አውርድ (PDF)' : 'Download Guide (PDF)'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-ink-200 bg-white px-3.5 py-1.5 text-xs font-bold text-ink-600 hover:bg-ink-100 transition"
            >
              {isAmharic ? 'ዝጋ' : 'Close'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────
// NOTIFICATION BELL COMPONENT
// ─────────────────────────────────────────
const SEVERITY_STYLES = {
  info: { dot: 'bg-blue-500', bg: 'bg-blue-50', text: 'text-blue-700' },
  success: { dot: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  warning: { dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700' },
  error: { dot: 'bg-rose-500', bg: 'bg-rose-50', text: 'text-rose-700' },
};

const TYPE_ICONS = {
  purchase: '🛒',
  stock_request: '📦',
  transaction: '↔️',
  consumption: '🍽️',
  expense: '💸',
  material: '🧱',
  employee: '👷',
  user: '👤',
  production: '🍳',
  pos: '🧾',
  system: '⚙️',
  low_stock: '⚠️',
};

const NotificationBell = () => {
  const { user, canSeeNav, hasRole, hasCapability } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const bellRef = useRef(null);
  const navigate = useNavigate();

  const isAllowedForRole = useCallback((n) => {
    const role = user?.role;
    if (!role || role === 'dev' || role === 'admin') return true;
    if (Array.isArray(n.allowedRoles) && n.allowedRoles.length > 0 && !n.allowedRoles.includes(role)) {
      return false;
    }
    switch (n.type) {
      case 'stock_request': return canSeeNav('stockRequests');
      case 'transaction': return canSeeNav('stockMovements');
      case 'consumption': return canSeeNav('consumption');
      case 'purchase': return hasRole('admin', 'manager', 'supervisor', 'dev');
      case 'expense': return canSeeNav('expenses');
      case 'material':
      case 'low_stock': return canSeeNav('rawMaterials');
      case 'production': return canSeeNav('production');
      case 'pos': return canSeeNav('pos');
      case 'employee':
      case 'user': return canSeeNav('staffAccounts') || hasCapability('manageAccounts');
      case 'system': return hasRole('admin', 'manager', 'supervisor', 'dev');
      default: return true;
    }
  }, [user?.role, canSeeNav, hasRole, hasCapability]);

  const resolveNotificationTarget = useCallback((n) => {
    const rawLink = n?.link || '';
    if (!rawLink) return null;
    if (!isAllowedForRole(n)) return null;

    if (n.entityId) {
      if (rawLink.includes('highlight=')) return rawLink;
      return `${rawLink}${rawLink.includes('?') ? '&' : '?'}highlight=${encodeURIComponent(n.entityId)}`;
    }
    if (n.voucherNo) {
      if (rawLink.includes('voucher=')) return rawLink;
      return `${rawLink}${rawLink.includes('?') ? '&' : '?'}voucher=${encodeURIComponent(n.voucherNo)}`;
    }
    // Fallback for legacy notifications containing voucher code in message text (e.g. REQ-00012 / CONS-00005 / GRV-...)
    const voucherMatch = String(n.message || '').match(/\b([A-Z]{2,5}-\d{3,6})\b/);
    if (voucherMatch) {
      return `${rawLink}${rawLink.includes('?') ? '&' : '?'}voucher=${encodeURIComponent(voucherMatch[1])}`;
    }
    return rawLink;
  }, [isAllowedForRole]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      const visible = (res.data.notifications || []).filter(isAllowedForRole);
      setNotifications(visible);
      setUnread(visible.length > 0 ? Math.min(res.data.unread || visible.length, visible.length) : 0);
    } catch { /* silent */ }
  }, [isAllowedForRole]);

  // Poll every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Click = dismiss for this user + redirect with marked row target according to role
  const handleClick = (n) => {
    setNotifications(prev => prev.filter(x => x._id !== n._id));
    setUnread(prev => Math.max(0, prev - 1));
    api.delete(`/notifications/${n._id}`).catch(() => { });
    setOpen(false);
    if (n.link !== null) {
      const target = resolveNotificationTarget(n);
      if (target) navigate(target);
    }
  };

  // Clear all
  const clearAll = async () => {
    setNotifications([]);
    setUnread(0);
    api.delete('/notifications').catch(() => { });
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div className="relative" ref={bellRef}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) fetchNotifications(); }}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition ${unread > 0
          ? 'border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100'
          : 'border-ink-200 bg-white text-ink-500 hover:bg-ink-50'
          }`}
        title="Notifications"
      >
        {unread > 0 ? <BellRing size={16} /> : <Bell size={16} />}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-black text-white shadow-sm">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-2 right-2 top-14 sm:left-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-80 rounded-2xl border border-ink-100 bg-white shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100 bg-ink-50/60">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-blue-600" />
              <span className="text-xs font-bold text-ink-900">Notifications</span>
              {unread > 0 && (
                <span className="rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold px-1.5 py-0.5">
                  {unread} new
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-[11px] font-semibold text-rose-500 hover:text-rose-700 transition"
              >
                <Trash2 size={11} /> Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="mx-auto mb-2 text-ink-200" />
                <p className="text-xs font-medium text-ink-500">All caught up!</p>
                <p className="text-[10px] text-ink-400 mt-0.5">New activity will appear here</p>
              </div>
            ) : (
              notifications.map((n) => {
                const sev = SEVERITY_STYLES[n.severity] || SEVERITY_STYLES.info;
                return (
                  <div key={n._id} className="flex items-start gap-0 border-b border-ink-50 last:border-0 group hover:bg-ink-50/60 transition">
                    {/* Main clickable area */}
                    <button
                      onClick={() => handleClick(n)}
                      className="flex flex-1 items-start gap-3 px-4 py-3 text-left"
                    >
                      <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-sm ${sev.bg}`}>
                        {TYPE_ICONS[n.type] || '📋'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-bold text-ink-900 truncate">{n.title}</p>
                          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${sev.dot}`} />
                        </div>
                        <p className="text-[11px] text-ink-500 leading-relaxed mt-0.5 line-clamp-2">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-ink-400 mt-1">{timeAgo(n.createdAt)}</p>
                      </div>
                    </button>
                    {/* Dismiss X button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleClick({ ...n, link: null }); }}
                      className="px-2 py-3 text-ink-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                      title="Dismiss"
                    >
                      <X size={12} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-ink-100 px-4 py-2.5 bg-ink-50/40 flex items-center justify-between">
            <span className="text-[10px] text-ink-400">Click to view · X to dismiss</span>
            <button
              onClick={() => { fetchNotifications(); }}
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 transition"
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────
// TOPBAR COMPONENT
// ─────────────────────────────────────────
const Topbar = ({ onMenuClick, onToggleCollapse, title }) => {
  const { user, logout, hasRole } = useAuth();
  const { timeoutMinutes, setTimeoutMinutes } = useSessionTimeout();
  const { language, isAmharic, toggleLanguage, setLanguage, t } = useLanguage();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleNav = (path) => {
    setMenuOpen(false);
    navigate(path);
  };

  const roleBadgeStyle = {
    admin: 'bg-amber-50 text-amber-800 border-amber-200',
    manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    operation_manager: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    executive_chef: 'bg-amber-50 text-amber-700 border-amber-200',
    finance: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    storekeeper: 'bg-blue-50 text-blue-700 border-blue-200',
    fb_team: 'bg-teal-50 text-teal-700 border-teal-200',
    waiter: 'bg-purple-50 text-purple-700 border-purple-200',
    cashier: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    supervisor: 'bg-blue-50 text-blue-700 border-blue-200',
  }[user?.role || 'storekeeper'] || 'bg-slate-50 text-slate-700 border-slate-200';

  const roleDisplayName = {
    admin: 'Admin',
    manager: 'Manager',
    operation_manager: 'Operation Manager',
    executive_chef: 'Executive Chef',
    finance: 'Finance',
    supervisor: 'Supervisor',
    storekeeper: 'Store Keeper',
    cashier: 'Cashier',
    waiter: 'Waiter',
    fb_team: 'F & B Team',
    dev: 'System Developer',
  }[user?.role] || (user?.role ? String(user.role).split('_').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '');

  return (
    <>
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <header
        className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-slate-200/60 px-2.5 py-2 backdrop-blur-md shadow-sm sm:px-8 sm:py-3"
        style={{ background: 'rgba(255,255,255,0.88)' }}
      >
        {/* Left: menu toggle + title */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          <button
            onClick={onMenuClick}
            className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 lg:hidden shrink-0"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex items-center justify-center rounded-md p-1.5 text-ink-500 hover:bg-ink-100 transition shrink-0"
            title="Toggle sidebar"
          >
            <Menu size={22} />
          </button>
          <div className="min-w-0">
            <p className="text-sm sm:text-xl font-bold text-ink-900 truncate">{title}</p>
            <p className="hidden sm:block text-xs text-ink-500 truncate">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        {/* Right: session indicator + notifications + user menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Session timeout indicator */}
          <div
            onClick={() => setMenuOpen(v => !v)}
            title={`Session Timeout: ${timeoutMinutes === 0 ? 'Disabled' : `Signs out after ${timeoutMinutes} minutes of inactivity`}`}
            className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200/90 bg-slate-50/80 px-2.5 py-1 text-xs text-slate-600 cursor-pointer hover:bg-slate-100 transition"
          >
            <span className={`h-1.5 w-1.5 rounded-full ${timeoutMinutes === 0 ? 'bg-slate-400' : 'bg-emerald-500 animate-pulse'}`} />
            <Clock size={12} className="text-slate-400" />
            <span className="text-[11px] font-medium text-slate-600">
              {timeoutMinutes === 0 ? t('topbar.timeoutOff') : `${t('topbar.autoLogout')}: ${timeoutMinutes}${t('topbar.minutes')}`}
            </span>
          </div>

          {/* Dual Language Switcher (EN | አማርኛ) - Compact on phones */}
          <div className="flex items-center rounded-full border border-ink-200/90 bg-white p-0.5 text-[11px] sm:text-xs font-bold shadow-xs select-none shrink-0">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`flex items-center gap-1 rounded-full px-2 sm:px-2.5 py-1 transition-all ${!isAmharic
                ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                : 'text-ink-500 hover:text-ink-900'
                }`}
              title="Switch to English"
            >
              <Globe size={11} className={!isAmharic ? 'text-white' : 'text-blue-600'} />
              <span className="hidden sm:inline">English</span>
              <span className="sm:hidden">EN</span>
            </button>
            <button
              type="button"
              onClick={() => setLanguage('am')}
              className={`flex items-center gap-1 rounded-full px-2 sm:px-2.5 py-1 transition-all ${isAmharic
                ? 'bg-blue-600 text-white shadow-xs font-extrabold'
                : 'text-ink-500 hover:text-ink-900'
                }`}
              title="ወደ አማርኛ ቀይር"
            >
              <span className="hidden sm:inline">አማርኛ</span>
              <span className="sm:hidden">አማ</span>
            </button>
          </div>

          {/* Notification Bell */}
          <NotificationBell />

          {/* User menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="flex items-center gap-1.5 sm:gap-2.5 rounded-full border border-ink-200/80 bg-white py-0.5 pl-0.5 pr-1.5 sm:py-1 sm:pl-1 sm:pr-3 shadow-xs hover:border-ink-300 hover:bg-ink-50/60 transition"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt={user?.name} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover ring-1 ring-ink-200" />
              ) : (
                <span className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
                  {user?.name?.[0]?.toUpperCase()}
                </span>
              )}
              <div className="hidden text-left sm:block">
                <p className="text-xs font-semibold leading-tight text-ink-800">{user?.name}</p>
                <p className="text-[10px] leading-none text-ink-400">{roleDisplayName}</p>
              </div>
              <ChevronDown size={13} className={`text-ink-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-ink-100 bg-white p-2 shadow-xl ring-1 ring-black/5 z-50">
                {/* Profile card */}
                <div className="rounded-xl bg-ink-50/70 p-3 mb-1">
                  <div className="flex items-center gap-2.5">
                    {user?.avatar ? (
                      <img src={user.avatar} alt={user?.name} className="h-9 w-9 rounded-xl object-cover ring-1 ring-ink-200" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 font-bold text-white text-sm">
                        {user?.name?.[0]?.toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-ink-900 truncate">{user?.name}</p>
                      <p className="text-[11px] text-ink-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between border-t border-ink-100/80 pt-2">
                    <span className="text-[10px] uppercase font-bold text-ink-400">Role</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${roleBadgeStyle}`}>
                      {roleDisplayName}
                    </span>
                  </div>
                </div>

                {/* Nav items */}
                <div className="space-y-0.5 pt-1">
                  <button
                    onClick={() => handleNav('/settings?tab=profile')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                  >
                    <User size={15} className="text-ink-400" />
                    {t('topbar.myProfile')}
                  </button>
                  <button
                    onClick={() => handleNav('/settings?tab=security')}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                  >
                    <Shield size={15} className="text-ink-400" />
                    {t('topbar.changePassword')}
                  </button>
                  {hasRole('admin') && (
                    <button
                      onClick={() => handleNav('/settings?tab=system')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                    >
                      <Building size={15} className="text-ink-400" />
                      {t('topbar.systemSettings')}
                    </button>
                  )}
                  {hasRole('admin') && (
                    <button
                      onClick={() => handleNav('/settings?tab=permissions')}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition"
                    >
                      <Layers size={15} className="text-ink-400" />
                      Role Privileges
                    </button>
                  )}
                  {/* Help & Documentation */}
                  <button
                    onClick={() => { setMenuOpen(false); setHelpOpen(true); }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 transition"
                  >
                    <HelpCircle size={15} className="text-blue-500" />
                    {t('topbar.help')}
                  </button>
                </div>

                {/* Session timeout selector */}
                <div className="mt-2 rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 text-xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Clock size={13} className="text-blue-600" />
                      {t('topbar.autoLogout')}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200">
                      {timeoutMinutes === 0 ? t('topbar.timeoutOff') : `${timeoutMinutes} min`}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mb-2 leading-tight">
                    Auto-signs out after idle time to secure workstation:
                  </p>
                  <select
                    value={timeoutMinutes}
                    onChange={(e) => setTimeoutMinutes(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white py-1.5 px-2 text-[11px] font-medium text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value={1}>1 Minute (High Security)</option>
                    <option value={2}>2 Minutes (Default Policy)</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                    <option value={60}>60 Minutes (1 Hour)</option>
                    <option value={0}>Never (Off)</option>
                  </select>
                </div>

                {/* Sign out */}
                <div className="mt-1 border-t border-ink-100 pt-1">
                  <button
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
                  >
                    <LogOut size={15} />
                    {t('topbar.signOut')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
};

export default Topbar;
