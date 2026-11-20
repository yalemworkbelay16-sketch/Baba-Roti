# Baba Roti Cafe & Restaurant - Complete System User Manual & Operating Guide
**የባባ ሮቲ ካፌና ሬስቶራንት የተሟላ የአሰራርና የተጠቃሚዎች መመሪያ መጽሐፍ**  
*System Version: 2.4.0 Live · Powered by MEGA Technology*

---

## 📑 Table of Contents / ማውጫ
1. [Getting Started & Login / መግቢያና የተጠቃሚዎች መግቢያ](#1-getting-started--login)
2. [Station Storage & Routing / የስቶክ ጣቢያዎች ምደባና ማከማቻ](#2-station-storage--routing)
3. [Stock Requisitions & Dispatch / የጥያቄና ወጪ ስቶክ አሰራር](#3-stock-requisitions--dispatch)
4. [POS Orders & Recipe Deduction / የሽያጭና የካሳ አሰራር እና የግብዓት ቅነሳ](#4-pos-orders--recipe-deduction)
5. [Digital QR Menu & Guest Ordering / የዲጂታል ሜኑና የደንበኞች ትዕዛዝ](#5-digital-qr-menu--guest-ordering)
6. [Activity Log & Machine IP Audit / የእንቅስቃሴ መዝገብና የመሳሪያ IP ቁጥጥር](#6-activity-log--machine-ip-audit)
7. [Staff Accounts & Digital ID Badges / የሰራተኞች አካውንትና ዲጂታል ባጅ](#7-staff-accounts--digital-id-badges)
8. [Raw Materials & Stock Balances / ጥሬ እቃዎችና የክምችት ቁጥጥር](#8-raw-materials--stock-balances)
9. [Stock Movements & Receiving / የዕቃ መቀበያና ማስተካከያ (GRV)](#9-stock-movements--receiving)
10. [Reports, Analytics & P&L / ሪፖርቶች፣ ትንተናና የትርፍ/ኪሳራ ሂሳብ](#10-reports-analytics--pl)
11. [Settings, Security & Hardware / የስርዓቱ ማስተካከያ፣ ደህንነትና ፕሪንተሮች](#11-settings-security--hardware)
12. [Role-by-Role Daily Workflows / ማን ምን ይሰራል? - ዕለታዊ የስራ መመሪያ](#12-role-by-role-daily-workflows)
13. [Key Rules & Best Practices / ወሳኝ ደንቦች](#13-key-rules--best-practices)

---

## 1. Getting Started & Login
### መግቢያና የተጠቃሚዎች መግቢያ
**Target Role / የስራ ድርሻ:** All Staff / ሁሉም ሰራተኞች

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Enter Credentials] ──▶ [2. Capture Machine IP 🟢] ──▶ [3. Smart Role Landing] ──▶ [4. Ready & Auto-Locked]
```

#### Step 1: Secure Log In & Online Session (በደህንነት መግባትና የቀጥታ ቆይታ)
- **English:** Enter your username/email and password. Upon sign in, your account immediately activates as 🟢 Online with your machine IP address and device signature recorded.
- **አማርኛ:** የይለፍ ቃልና ስምዎን በማስገባት ይግቡ፤ ሲገቡ ወዲያውኑ እንደ 🟢 Online (በስራ ላይ) ተብሎ ከኮምፒውተርዎ IP አድራሻ ጋር ይመዘገባል።
- **👉 Action / አሰራር:** Login screen ➔ Enter Username & Password ➔ Click Sign In | በመግቢያ ገጽ ላይ ➔ ስምዎንና የይለፍ ቃል ያስገቡ ➔ "Sign In" ይጫኑ

#### Step 2: Smart Landing by Role (እንደየስራ ድርሻዎ የሚከፈት ገጽ)
- **English:** The system automatically routes you to your authorized workstation: Cashiers open at POS, Baristas & Chefs open at Requisitions, Storekeepers at Materials/GRV, Admins at Dashboard.
- **አማርኛ:** ስርዓቱ እንደተጠቃሚው የስራ ድርሻ በቀጥታ ወደሚገባው ገጽ ይወስድዎታል (ካሳ ወደ POS፣ ባሬስታና ሼፍ ወደ ስቶክ ጥያቄ፣ ስቶር ጠባቂ ወደ እቃዎች፣ አስተዳዳሪ ወደ ዳሽቦርድ)።
- **👉 Action / አሰራር:** Automatic redirection upon successful login | ሲገቡ በራሱ በቀጥታ ወደ ስራ ገጽዎ ይወስድዎታል

#### Step 3: Dashboard Overview & Metrics (የዳሽቦርድ አጠቃላይ መረጃ)
- **English:** Shows real-time inventory balance valuation, safety reorder alerts, daily movement inflow/outflow, and sales cost aggregation.
- **አማርኛ:** የአጠቃላይ ስቶክ የገንዘብ መጠን፣ የአደጋ ማሳሰቢያዎች፣ የዕለቱ የዕቃ ገቢና ወጪ፣ እና የሽያጭ ትርፍና ኪሳራን በጨረፍታ ያሳያል።
- **👉 Action / አሰራር:** Side Menu ➔ Dashboard / አጠቃላይ እይታ | የግራ ሜኑ ➔ Dashboard

#### Step 4: Sidebar Navigation & Auto-Logout Security (የግራ ጎን ሜኑ አጠቃቀምና ራስ-ቆልፍ)
- **English:** Navigate between stores, movements, requisitions, staff badges, and logs. Set session timeout (15m, 30m, 1h) so unattended terminals securely sign out.
- **አማርኛ:** በዋና መጋዘን፣ በኩሽና፣ በባር፣ በእንቅስቃሴ መዝገብና በሪፖርቶች መካከል በቀላሉ ይዘዋወሩ። ኮምፒውተሩ ስራ ሳይሰራ ሲቀር ራሱን በራሱ ዘግቶ እንዲቆለፍ ያድርጉ።
- **👉 Action / አሰራር:** Top Bar ➔ Click User Avatar ➔ Auto-Logout Timeout Settings | የላይኛው ባር ➔ የተጠቃሚ ፎቶ ➔ Auto-Logout ማስተካከያ

---

## 2. Station Storage & Routing
### የስቶክ ጣቢያዎች ምደባና ማከማቻ
**Target Role / የስራ ድርሻ:** Storekeeper, Admin & Manager / ስቶር ጠባቂ፣ አስተዳዳሪና ስራ አስኪያጅ

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Central Warehouse] ──▶ [2. Station Mapping] ──▶ [3. Admin Pass Gate] ──▶ [4. Station Isolation]
```

#### Step 1: Central Warehouse Concept (ዋና መጋዘን ማዕከላዊ አስተዳደር)
- **English:** 100% of all raw materials are registered under and managed centrally by the Main Store. Kitchen and Bar stations receive their items exclusively through approved requisitions.
- **አማርኛ:** 100% ሁሉም ጥሬ ዕቃዎች መጀመሪያ የሚገቡትና የሚተዳደሩት በዋና መጋዘን ነው። ኩሽናና ባር ዕቃዎችን የሚያገኙት በጸደቀ ጥያቄ ብቻ ነው።
- **👉 Action / አሰራር:** Side Menu ➔ Raw Materials (Main Store Tab) | የግራ ሜኑ ➔ Raw Materials (Main Store)

#### Step 2: Category Station Routing (ምድቦችን ለኩሽና እና ለባር መመደብ)
- **English:** Categories are mapped either to Kitchen Station (Produce, Meat, Pastry, Mendi, Fresh Bazaar) or Bar Station (Coffee, Tea, Beverages, Drinks).
- **አማርኛ:** የዕቃ ምድቦች ለኩሽና (ምግብ፣ ፓስትሪ፣ ሜንዲ፣ ፍራሽ ባዛር) ወይም ለባር (ቡና፣ ሻይ፣ መጠጦች) ይመደባሉ።
- **👉 Action / አሰራር:** Raw Materials ➔ Station Storage ➔ Manage Category Routing | Raw Materials ➔ Station Storage ➔ ምድቦችን መድብ

#### Step 3: Admin Password Security Gate (የይለፍ ቃል ጥበቃ)
- **English:** Modifying station category assignments requires entering the Admin/Manager password to prevent accidental or unauthorized routing changes.
- **አማርኛ:** የጣቢያ ምደባዎችን ለማስተካከልና ለማስቀመጥ የአስተዳዳሪ የይለፍ ቃል ማስገባት ግዴታ ነው፤ ይህም ያልተፈቀደ ለውጥ እንዳይደረግ ይጠብቃል።
- **👉 Action / አሰራር:** Enter Admin Password prompt upon saving category changes | ምድብ ሲቀይሩ የአስተዳዳሪውን የይለፍ ቃል አስገብተው ያጽድቁ

#### Step 4: Role-Based Station Scoping (ለእያንዳንዱ ክፍል የራሱን ስቶክ ብቻ ማሳየት)
- **English:** Baristas see only Bar materials and stock balance; Kitchen staff sees only Kitchen materials. Only Main Storekeepers and Admins have permission to view all stations simultaneously.
- **አማርኛ:** ባሬስታ የባርን ብቻ፣ ኩሽና ደግሞ የኩሽናን ስቶክ ብቻ ያያሉ። ዋና ስቶር ጠባቂና ስራ አስኪያጅ ብቻ የሁሉንም ክፍሎች ስቶክ በአንድ ላይ ማየት ይችላሉ።
- **👉 Action / አሰራር:** Automatic based on user assigned department (Bar/Kitchen) | እንደተጠቃሚው የስራ ክፍል በቀጥታ የሚገደብ

---

## 3. Stock Requisitions & Dispatch
### የጥያቄና ወጪ ስቶክ አሰራር
**Target Role / የስራ ድርሻ:** Baristas, Kitchen Chefs & Storekeeper / ባሬስታ፣ ሼፍ እና ስቶር ጠባቂ

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. + New Request] ──▶ [2. Mapped Item Pick] ──▶ [3. Storekeeper Review] ──▶ [4. Stock Transferred]
```

#### Step 1: Create Stock Requisition (አዲስ የስቶክ ጥያቄ ማቅረብ)
- **English:** Go to Stock Issue & Request → click "+ New Request". Baristas automatically default to "Bar" department; chefs automatically default to "Kitchen" department.
- **አማርኛ:** ወደ ስቶክ ጥያቄ በመሄድ "+ አዲስ ጥያቄ" ይጫኑ፤ ባሬስታ በቀጥታ "Bar"፣ ሼፍ ደግሞ በቀጥታ "Kitchen" ተብሎ ይመረጣል።
- **👉 Action / አሰራር:** Side Menu ➔ Stock Issue & Request ➔ Click "+ New Request" | የግራ ሜኑ ➔ Stock Issue & Request ➔ "+ New Request" ይጫኑ

#### Step 2: Mapped Item Requisition Filter (የተመደቡ ዕቃዎችን ብቻ መጠየቅ)
- **English:** When requesting items, only raw materials mapped to your station (e.g. coffee beans/milk for Bar; flour/meat/vegetables for Kitchen) are displayed.
- **አማርኛ:** ዕቃዎችን በሚመርጡበት ጊዜ ለክፍልዎ የተፈቀዱትንና የተመደቡትን ጥሬ ዕቃዎች ብቻ ያሳየዎታል።
- **👉 Action / አሰራር:** SearchableSelect Combobox ➔ Type item name or pick from list | በመፈለጊያ ሳጥኑ ውስጥ የዕቃውን ስም ጽፈው ይምረጡ

#### Step 3: Storekeeper Exclusive Dispatch (የዋና ስቶር ጠባቂ ብቻ የማውጣት ስልጣን)
- **English:** Kitchen and Bar employees can only request. Only the Main Storekeeper, Manager, or Admin has authority to Approve and Issue stock from the central warehouse.
- **አማርኛ:** የኩሽናና የባር ሰራተኞች መጠየቅ ብቻ ይችላሉ፤ ዕቃውን ከዋና መጋዘን የማጽደቅና ወጪ የማድረግ ስልጣን የዋና ስቶር ጠባቂ ብቻ ነው።
- **👉 Action / አሰራር:** Storekeeper logs in ➔ Stock Issue & Request ➔ Click "Approve & Issue" | ስቶር ጠባቂው ገብቶ ➔ "Approve & Issue" የሚለውን ይጫናል

#### Step 4: Real-Time Station Transfer (ቀጥታ የክምችት ማስተላለፍ)
- **English:** When the Storekeeper issues the request, items are automatically deducted from Main Store and credited to the Kitchen or Bar station balance.
- **አማርኛ:** ስቶር ጠባቂው ዕቃውን ወጪ ሲያደርግ፣ ከዋና መጋዘን ተቀንሶ በቀጥታ ወደ ጠየቀው ኩሽና ወይም ባር ስቶክ ይጨመራል።
- **👉 Action / አሰራር:** Automatic balance synchronization across Main Store and Station | በቅጽበት ክምችቱ ከዋና መጋዘን ወደ ጣቢያው ይተላለፋል

---

## 4. POS Orders & Recipe Deduction
### የሽያጭና የካሳ አሰራር እና የግብዓት ቅነሳ
**Target Role / የስራ ድርሻ:** Cashiers, Waiters & Captains / ካሳዎች፣ አስተናጋጆችና ካፕቴኖች

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Order Entry] ──▶ [2. Payment Settlement] ──▶ [3. Recipe Deduct] ──▶ [4. Thermal Printing]
```

#### Step 1: Create POS Order & Payment (ትዕዛዝ መውሰድና ክፍያ መቀበል)
- **English:** Go to POS or Cash Sales. Choose Dine-in, Takeaway, or Delivery, pick table, select menu items, and settle bill via Cash, Telebirr, or Card.
- **አማርኛ:** በካሳ ወይም POS ገጽ ላይ ትዕዛዝ ይውሰዱ፤ ክፍያውን በጥሬ ገንዘብ፣ በቴሌብር ወይም በካርድ ይቀበሉ።
- **👉 Action / አሰራር:** Side Menu ➔ POS or Cash Sales ➔ Select Table ➔ Tap Menu Items | የግራ ሜኑ ➔ POS ወይም Cash Sales ➔ ጠረጴዛ ይምረጡ ➔ ምግቦችን ይጫኑ

#### Step 2: Automated Station Recipe Deduction (አውቶማቲክ የግብዓት ቅነሳ)
- **English:** Upon checkout, the system automatically deducts recipe ingredients: drinks and coffee deduct from Bar Stock; meals and pastries deduct from Kitchen Stock.
- **አማርኛ:** ሽያጭ ሲፈጸም የተዘጋጀበት ግብዓት በሬሲፒው መሰረት በቀጥታ ይቀነሳል፤ መጠጦች ከባር ስቶክ፣ ምግቦች ደግሞ ከኩሽና ስቶክ ይቀነሳሉ።
- **👉 Action / አሰራር:** Click "Pay / Checkout" ➔ Ingredients automatically deducted | "Pay / Checkout" ሲጫኑ ግብዓቶች በቀጥታ ከየክፍሉ ይቀነሳሉ

#### Step 3: Manager Order Voiding & Security (ትዕዛዝ መሰረዝና የስቶክ መመለሻ)
- **English:** Voiding an order requires a manager reason. The system automatically reverses all deducted recipe ingredients back into inventory and audits the action in Activity Log.
- **አማርኛ:** የተሳሳተ ትዕዛዝ ለመሰረዝ የስራ አስኪያጅ ምክንያት ያስፈልጋል፤ የተቀነሱ ግብዓቶች በሙሉ ወደ ስቶክ ይመለሳሉ እንዲሁም በመዝገብ ላይ ይመዘገባል።
- **👉 Action / አሰራር:** Order Card ➔ Click "Void Order" ➔ Enter Manager Reason | በትዕዛዙ ላይ ➔ "Void Order" ይጫኑ ➔ የስራ አስኪያጅ ምክንያት ያስገቡ

#### Step 4: Instant KOT & Receipt Printing (የማዘዣ - KOT እና የደረሰኝ ህትመት)
- **English:** Direct integration with Windows thermal receipt printers. Automatically prints KOT order slips for the kitchen/bar and final customer receipts.
- **አማርኛ:** ወደ ኩሽናና ባር የሚላከውን ማዘዣ (KOT) እና ለደንበኛ የሚሰጠውን ደረሰኝ በቴርማል ፕሪንተር በቅጽበት ያትማል።
- **👉 Action / አሰራር:** Click "Print Receipt" or "Print KOT" (Auto on checkout) | "Print Receipt" ወይም "Print KOT" ይጫኑ (በክፍያ ወቅት ራሱ ያትማል)

---

## 5. Digital QR Menu & Guest Ordering
### የዲጂታል ሜኑና የደንበኞች ትዕዛዝ
**Target Role / የስራ ድርሻ:** Customers, Waiters & Captains / ደንበኞች፣ አስተናጋጆችና ካፕቴኖች

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Scan Table QR] ──▶ [2. Guest Self-Order] ──▶ [3. Waiter Verify] ──▶ [4. Sent to Kitchen]
```

#### Step 1: Table QR Code Scan (በሞባይል የጠረጴዛ QR ኮድ ማንበብ)
- **English:** Customers scan the QR code at their table to view the live digital menu with photos, descriptions, and prices on their mobile phones.
- **አማርኛ:** ደንበኞች በጠረጴዛቸው ላይ ያለውን የQR ኮድ በስልካቸው ስካን በማድረግ ምግቦችንና መጠጦችን በፎቶ ማየት ይችላሉ።
- **👉 Action / አሰራር:** Open phone camera ➔ Scan table QR badge ➔ Menu opens in browser | በስልክ ካሜራ የጠረጴዛውን QR ስካን ያድርጉ ➔ ሜኑው በስልኩ ይከፈታል

#### Step 2: Guest Self-Order (ደንበኛው ከስልኩ በቀጥታ ማዘዝ)
- **English:** Guests select items, enter their name, and place their order directly from their phone browser.
- **አማርኛ:** ደንበኞች የፈለጉትን መርጠው በስልካቸው ላይ "ትዕዛዝ ላክ" በማለት በቀጥታ ወደ ሲስተሙ መላክ ይችላሉ።
- **👉 Action / አሰራር:** Select dishes ➔ Add to cart ➔ Enter guest name ➔ Tap "Place Order" | ምግብ ይምረጡ ➔ ወደ ቅርጫት ይጨምሩ ➔ ስም አስገብተው "ትዕዛዝ ላክ" ይጫኑ

#### Step 3: Waiter Verification Security Gate (የአስተናጋጅ ማረጋገጫ ጥበቃ)
- **English:** To prevent fake or accidental table orders, customer QR orders require the table waiter to physically verify the guest presence and approve before reaching the kitchen.
- **አማርኛ:** የውሸት ትዕዛዞችን ለመከላከል፣ ደንበኛው ከስልኩ ሲያዝ አስተናጋጁ በአካል ደንበኛው መኖሩን አይቶ ሳያጸድቅ ወደ ኩሽና አይላክም።
- **👉 Action / አሰራር:** Captain/Waiter Screen ➔ Review table order ➔ Click "Verify & Send" | በካፕቴን ገጽ ላይ ➔ ደንበኛው መኖሩን አይተው "Verify & Send" ይጫኑ

#### Step 4: Call Waiter & Request Bill (አስተናጋጅ መጥሪያ እና ሂሳብ መጠየቂያ)
- **English:** Guests can tap "Call Waiter" or "Request Bill" to notify floor staff and trigger Telegram alerts instantly.
- **አማርኛ:** ደንበኛው ከስልኩ ላይ "አስተናጋጅ ጥራ" ወይም "ሂሳብ አምጡ" የሚለውን በመጫን አስተናጋጁን መጥራት ይችላል።
- **👉 Action / አሰራር:** Guest phone screen ➔ Tap "Call Waiter" or "Request Bill" | በስልኩ ገጽ ላይ ➔ "አስተናጋጅ ጥራ" ወይም "ሂሳብ አምጡ" ይጫኑ

---

## 6. Activity Log & Machine IP Audit
### የእንቅስቃሴ መዝገብና የመሳሪያ IP ቁጥጥር
**Target Role / የስራ ድርሻ:** System Admin, Manager & Owner / አስተዳዳሪ፣ ስራ አስኪያጅና ባለቤት

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. User Action] ──▶ [2. Machine IP Track] ──▶ [3. Live Online State 🟢] ──▶ [4. Audit & CSV Export]
```

#### Step 1: Real-Time Online / Offline Status (የቀጥታ በስራ ላይ መሆን ሁኔታ)
- **English:** Live pulsing indicators display who is currently logged in and active within 15 minutes (🟢 Online) vs inactive (⚪ Offline with relative last active time).
- **አማርኛ:** የትኛው ሰራተኛ አሁን ሲስተሙ ላይ እየሰራ እንደሆነ (🟢 Online) እና መቼ እንደወጣ (⚪ Offline) በግልጽ ያሳያል።
- **👉 Action / አሰራር:** Side Menu ➔ Activity Log ➔ View "Live Online Users" banner | የግራ ሜኑ ➔ Activity Log ➔ "Live Online Users" ይመልከቱ

#### Step 2: Machine IP & Device Signature (የመሳሪያው IP አድራሻ እና የኮምፒውተር አይነት)
- **English:** Every login, order checkout, stock issue, and settings modification logs the physical machine IP (e.g. 192.168.x.x, 196.188.x.x) and device OS/browser.
- **አማርኛ:** ማንኛውም ተግባር (መግባት፣ መውጣት፣ ሽያጭ፣ ስቶክ ወጪ) የተፈጸመበትን ትክክለኛ የኮምፒውተር IP አድራሻና የብሮውዘር አይነት ይመዘግባል።
- **👉 Action / አሰራር:** Logged automatically on every server API interaction | በሁሉም ተግባራት ወቅት ሲስተሙ ራሱ መዝግቦ ያስቀምጣል

#### Step 3: Audit Trail Search & Filtering (መዝገብ መፈለጊያና ማጣሪያ)
- **English:** Search by staff name, machine IP address, action type (Login, Checkout, Stock Issue, Void), module, or custom date range.
- **አማርኛ:** በሰራተኛ ስም፣ በIP አድራሻ፣ በተግባሩ አይነት (ሽያጭ፣ ስቶክ ወጪ፣ መግባት) ወይም በቀን በቀላሉ ፈልገው ማግኘት ይችላሉ።
- **👉 Action / አሰራር:** Use search input or Module/Action/Date filter dropdowns | በፍለጋ ሳጥኑ ወይም በማጣሪያዎቹ ተጠቅመው ይፈልጉ

#### Step 4: Management CSV Export (የመረጃ ኤክስፖርት - CSV)
- **English:** Export the complete audit log to Excel/CSV for management audits, discrepancy checks, and operational security verification.
- **አማርኛ:** የአጠቃላይ ሰራተኞችን የስራ እንቅስቃሴ ወደ ኤክሴል/CSV በማውረድ ለኦዲትና ለደህንነት ቁጥጥር መጠቀም ይቻላል።
- **👉 Action / አሰራር:** Click "Export CSV" at the top of the Activity Log page | ከላይ በስተቀኝ "Export CSV" የሚለውን ይጫኑ

---

## 7. Staff Accounts & Digital ID Badges
### የሰራተኞች አካውንትና ዲጂታል ባጅ
**Target Role / የስራ ድርሻ:** Admin & HR Management / አስተዳዳሪና የሰው ኃይል አስተዳደር

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Register User] ──▶ [2. Department Scope] ──▶ [3. 3x4 Photo Upload] ──▶ [4. Print PVC Badge]
```

#### Step 1: Account Directory & Role Access (የሰራተኞች አካውንትና የስራ ድርሻ)
- **English:** Register staff accounts and assign roles (Admin, Manager, Supervisor, Storekeeper, Cashier, Waiter, Dev).
- **አማርኛ:** ለሰራተኞች አካውንት ይክፈቱ እና የስራ ድርሻ (አስተዳዳሪ፣ ስቶር ጠባቂ፣ ካሳ፣ አስተናጋጅ) ይመድቡ።
- **👉 Action / አሰራር:** Side Menu ➔ Staff Accounts (/users) ➔ Click "+ Add User" | የግራ ሜኑ ➔ Staff Accounts ➔ "+ Add User" ይጫኑ

#### Step 2: Station & Department Scoping (የስራ ክፍልና የጣቢያ ምደባ)
- **English:** Set employee department to Kitchen or Bar to automatically restrict their accessible materials and auto-default their requisitions.
- **አማርኛ:** ሰራተኛውን ለኩሽና ወይም ለባር በመመደብ የክፍላቸውን ዕቃዎች ብቻ እንዲያዩና እንዲጠይቁ ማድረግ ይችላሉ።
- **👉 Action / አሰራር:** User Form ➔ Select Department ("Kitchen" or "Bar") | በቅጹ ላይ ➔ የስራ ክፍል ("Kitchen" ወይም "Bar") ይምረጡ

#### Step 3: 3x4 Photo Upload & Digital ID Card (የሰራተኛ ፎቶና ዲጂታል መታወቂያ ባጅ)
- **English:** Upload standard 3x4 employee photos. The system generates high-definition, double-sided printable PVC Digital ID Badges complete with QR code and security stamps.
- **አማርኛ:** የሰራተኛውን ፎቶ በመጫን በፕላስቲክ (PVC) ላይ የሚታተም ደረጃውን የጠበቀ ባለሁለት ገጽ ዲጂታል መታወቂያ ባጅ ከQR ኮድ ጋር ያትሙ።
- **👉 Action / አሰራር:** User Card ➔ Click "ID Badge" ➔ Preview Front/Back ➔ Click "Print Badge" | በሰራተኛው ካርድ ላይ ➔ "ID Badge" ይጫኑ ➔ "Print Badge" ይጫኑ

#### Step 4: Disable / Enable Account (አካውንት ማገድ ወይም ማብራት)
- **English:** Temporarily deactivate an employee account to prevent login and halt Telegram alerts without deleting their historical audit trails.
- **አማርኛ:** አንድ ሰራተኛ ስራ ሲያቆም ወይም ለእረፍት ሲወጣ አካውንቱን በማገድ ሲስተሙን እንዳይጠቀም መቆጣጠር ይቻላል።
- **👉 Action / አሰራር:** User Card ➔ Toggle Active/Inactive status switch | በሰራተኛው ካርድ ላይ ➔ የማብሪያ/ማጥፊያ ቁልፉን ይቀያይሩ

---

## 8. Raw Materials & Stock Balances
### ጥሬ እቃዎችና የክምችት ቁጥጥር
**Target Role / የስራ ድርሻ:** Storekeeper, Chefs, Baristas & Admin / ስቶር ጠባቂ፣ ሼፍ፣ ባሬስታና አስተዳዳሪ

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Register Material] ──▶ [2. Set Safety Level] ──▶ [3. Multi-Store View] ──▶ [4. Low Stock Alert]
```

#### Step 1: Multi-Station Stock Views (የጣቢያዎች ስቶክ እይታ - Main, Kitchen, Bar)
- **English:** Switch between 🏢 Main Store, 🍳 Kitchen Store, and ☕ Bar Store views to check balances in real-time.
- **አማርኛ:** በዋና መጋዘን፣ በኩሽና ስቶር እና በባር ስቶር መካከል በመቀያየር የየክፍሉን ክምችት በግልጽ ይመልከቱ።
- **👉 Action / አሰራር:** Side Menu ➔ Raw Materials ➔ Switch Station Tabs at the top | የግራ ሜኑ ➔ Raw Materials ➔ ከላይ ያሉትን ጣቢያዎች ይቀያይሩ

#### Step 2: Add Raw Material (አዲስ ጥሬ ዕቃ መመዝገብ)
- **English:** Click "+ Add Material". Fill in name, measurement unit (kg, L, Pcs), category, unit cost, and safety reorder level.
- **አማርኛ:** አዲስ ጥሬ ዕቃ በስም፣ በስሌት መለኪያ (ኪሎ፣ ሊትር፣ ፍሬ)፣ በምድብና በዋጋ ይመዝግቡ።
- **👉 Action / አሰራር:** Raw Materials page ➔ Click "+ Add Material" | በጥሬ ዕቃዎች ገጽ ላይ ➔ "+ Add Material" ይጫኑ

#### Step 3: Safety Reorder Alerts (የማለቂያ አደጋ ማሳሰቢያ)
- **English:** Materials dropping below their safety minimum are immediately highlighted in amber/red on the dashboard and sent to Telegram.
- **አማርኛ:** ዕቃዎች ከተቀመጠላቸው ዝቅተኛ መጠን በታች ሲያልቁ ወዲያውኑ በማሳወቂያና በቴሌግራም መልዕክት ይላካል።
- **👉 Action / አሰራር:** Check yellow/red warning badges on Dashboard & Raw Materials | በዳሽቦርዱ ላይ ቢጫና ቀይ የማስጠንቀቂያ ባጆችን ይመልከቱ

---

## 9. Stock Movements & Receiving
### የዕቃ መቀበያና ማስተካከያ (GRV)
**Target Role / የስራ ድርሻ:** Storekeeper, Procurement & Manager / ስቶር ጠባቂ፣ ግዢና ስራ አስኪያጅ

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Delivery Arrives] ──▶ [2. Choose GRV Voucher] ──▶ [3. Enter Qty & Cost] ──▶ [4. Main Store Credit]
```

#### Step 1: Cash GRV (Goods Receiving Voucher) (የጥሬ ገንዘብ ዕቃ መቀበያ ሰነድ)
- **English:** Record materials purchased with cash, including supplier, items, quantities, unit prices, and receipt photo attachments.
- **አማርኛ:** በጥሬ ገንዘብ የተገዙ ዕቃዎችን ከአቅራቢ፣ ከዋጋ እና ከደረሰኝ ፎቶ ጋር መመዝገቢያ።
- **👉 Action / አሰራር:** Side Menu ➔ Stock Movements ➔ "+ New Movement" ➔ Cash GRV | የግራ ሜኑ ➔ Stock Movements ➔ "+ New Movement" ➔ Cash GRV

#### Step 2: Credit GRV (የብድር ዕቃ መቀበያ ሰነድ)
- **English:** Record goods received on credit terms, automatically updating inventory and tracking payables to the supplier.
- **አማርኛ:** በብድር የመጡ ዕቃዎችን መመዝገቢያ፤ ስቶኩን ጨምሮ ለአቅራቢው የሚከፈለውን ዕዳ ይመዘግባል።
- **👉 Action / አሰራር:** Stock Movements ➔ "+ New Movement" ➔ Credit GRV | Stock Movements ➔ "+ New Movement" ➔ Credit GRV

#### Step 3: Fresh Bazaar (የዕለቱ የገበያ ግዢ - ፍራሽ ባዛር)
- **English:** Direct market purchases from daily bazaar without formal invoices, immediately crediting inventory.
- **አማርኛ:** ከዕለታዊ ገበያ ያለደረሰኝ በቀጥታ የተገዙ አትክልቶችና ፍራፍሬዎችን መመዝገቢያ።
- **👉 Action / አሰራር:** Stock Movements ➔ "+ New Movement" ➔ Fresh Bazaar | Stock Movements ➔ "+ New Movement" ➔ Fresh Bazaar

#### Step 4: Adjustments & Disposal (የስቶክ ማስተካከያና የተበላሹ ዕቃዎች ወጪ)
- **English:** Use Positive Adjustment for surplus, Negative Adjustment for shortages, and Goods Disposal for expired or damaged stock.
- **አማርኛ:** በቆጠራ ወቅት ለተገኘ ትርፍ (+ve)፣ ለጎደለ (-ve) እና ለተበላሹ/ለጊዜያቸው ያለፈባቸው ዕቃዎች ማስወገጃ።
- **👉 Action / አሰራር:** Stock Movements ➔ Select Positive Adjustment, Negative Adjustment, or Disposal | Stock Movements ➔ Positive/Negative Adjustment ወይም Disposal ይምረጡ

---

## 10. Reports, Analytics & P&L
### ሪፖርቶች፣ ትንተናና የትርፍ/ኪሳራ ሂሳብ
**Target Role / የስራ ድርሻ:** Owner, General Manager & Accountant / ባለቤት፣ ስራ አስኪያጅና አካውንታንት

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Daily Transactions] ──▶ [2. COGS Computation] ──▶ [3. Valuation Balance] ──▶ [4. Export PDF / Excel]
```

#### Step 1: Stock Balance Sheet (የስቶክ ሚዛን ሰነድ)
- **English:** Complete overview of all raw materials across Main Store, Kitchen, and Bar with valuation, exportable to PDF and Excel.
- **አማርኛ:** የሁሉንም ክፍሎች ስቶክ ክምችትና የገንዘብ ዋጋ በአንድ ላይ በማሳየት ለህትመትና ለኤክሴል ያዘጋጃል።
- **👉 Action / አሰራር:** Side Menu ➔ Reports ➔ Stock Balance Sheet ➔ Click Export PDF/Excel | የግራ ሜኑ ➔ Reports ➔ Stock Balance Sheet ➔ Export የሚለውን ይጫኑ

#### Step 2: Daily Movement Report (የዕለቱ የስቶክ እንቅስቃሴ ሪፖርት)
- **English:** Tracks daily inflow, outflow, consumption, and transfers with opening and closing balances.
- **አማርኛ:** የዕለቱን አጠቃላይ የዕቃ ገቢ፣ ወጪ፣ ፍጆታ እና የተላለፉ ዕቃዎችን በዝርዝር ያሳያል።
- **👉 Action / አሰራር:** Side Menu ➔ Reports ➔ Daily Movement Report | የግራ ሜኑ ➔ Reports ➔ Daily Movement Report

#### Step 3: Sales, COGS & Gross Profit (የሽያጭ፣ የወጪና የትርፍ ትንተና)
- **English:** Real-time sales revenue, recipe ingredient cost (COGS), profit margins, and top-selling menu items.
- **አማርኛ:** የሽያጭ ገቢን፣ የወጣውን የግብዓት ወጪ (COGS) እና የተገኘውን ትርፍ በመቶኛ ያሰላል።
- **👉 Action / አሰራር:** Side Menu ➔ Analytics ➔ View profit margins and sales cost trends | የግራ ሜኑ ➔ Analytics ➔ የሽያጭ ትርፍና የወጪ ግራፎችን ይመልከቱ

---

## 11. Settings, Security & Hardware
### የስርዓቱ ማስተካከያ፣ ደህንነትና ፕሪንተሮች
**Target Role / የስራ ድርሻ:** Administrator & Technical Support / አስተዳዳሪና የቴክኒክ ድጋፍ

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Role Privileges] ──▶ [2. Printer Bridge] ──▶ [3. Telegram Bot] ──▶ [4. Auto-Logout Lock]
```

#### Step 1: Role Privileges & Permissions (የተጠቃሚዎች ስልጣንና ፈቃድ)
- **English:** Fine-tune who can view specific menu modules, edit unit costs, or access management settings.
- **አማርኛ:** የትኛው የስራ ክፍል ምን ማየትና መስራት እንደሚችል በግልጽ የሚወሰንበት ገጽ።
- **👉 Action / አሰራር:** Side Menu ➔ Settings ➔ Role Privileges | የግራ ሜኑ ➔ Settings ➔ Role Privileges

#### Step 2: Thermal Printer Bridge (የቴርማል ፕሪንተር ግንኙነት)
- **English:** Configure local Windows printer bridge, network ESC/POS thermal printers, and customize receipt header/footer details.
- **አማርኛ:** የደረሰኝና የትዕዛዝ ማዘዣ (KOT) ፕሪንተሮችን ከኮምፒውተሩ ጋር ማገናኛና ማስተካከያ።
- **👉 Action / አሰራር:** Side Menu ➔ Settings ➔ Printers ➔ Test Print KOT & Receipt | የግራ ሜኑ ➔ Settings ➔ Printers ➔ ፕሪንተር ፈትሽ

#### Step 3: Telegram Alert Integration (የቴሌግራም መልዕክት ማገናኛ)
- **English:** Connect Telegram bot token and chat IDs for instant mobile alerts on requisitions, low stock, and daily sales summaries.
- **አማርኛ:** ለስራ አስኪያጆችና ለባለቤቱ በቴሌግራም ፈጣን የስቶክና የሽያጭ ማሳወቂያ እንዲደርሳቸው ማገናኛ።
- **👉 Action / አሰራር:** Side Menu ➔ Settings ➔ Telegram ➔ Test Telegram Bot | የግራ ሜኑ ➔ Settings ➔ Telegram ➔ የቴሌግራም ቦት ይሞክሩ

#### Step 4: Auto-Logout Workstation Security (የስራ ቦታ ደህንነት - Auto-Logout)
- **English:** Set automatic session lock timers (15m, 30m, 1h, or Off) so unattended terminals securely sign out.
- **አማርኛ:** ኮምፒውተሩ ስራ ሳይሰራ ሲቀር ራሱን በራሱ ዘግቶ እንዲቆለፍ በማድረግ ያልተፈቀደ ሰው እንዳይጠቀምበት ይጠብቃል።
- **👉 Action / አሰራር:** Top Bar ➔ Profile Menu ➔ Auto-Logout Timer dropdown | ከላይ በስተቀኝ ➔ የተጠቃሚ ሜኑ ➔ Auto-Logout ይምረጡ

---

## 12. Role-by-Role Daily Workflows
### ማን ምን ይሰራል? - ዕለታዊ የስራ መመሪያ
**Target Role / የስራ ድርሻ:** All Positions / ሁሉም የስራ ክፍሎች

#### 🔄 Visual Process Flow / የአሰራር ሂደት:
```
[1. Storekeeper] ──▶ [2. Chef & Barista] ──▶ [3. Floor Waiter] ──▶ [4. Cashier & POS] ──▶ [5. Manager / Owner]
```

#### Step 1: Main Storekeeper Routine (የዋና ስቶር ጠባቂ ዕለታዊ ስራ)
- **English:** Morning goods receiving via Cash/Credit GRV and Fresh Bazaar ➔ Check pending requests from Bar and Kitchen ➔ Click "Approve & Issue" to transfer stock ➔ Log negative adjustments/disposals for waste ➔ End-of-day stock count.
- **አማርኛ:** ጠዋት የዕቃ መቀበያ ሰነድ (GRV) መመዝገብ ➔ የባርና የኩሽና ጥያቄዎችን አይቶ ወጪ ማድረግ (Issue) ➔ የተበላሸ እቃ ማስወጣት ➔ የቀን መጨረሻ ቆጠራ ማካሄድ።
- **👉 Action / አሰራር:** Primary pages: /materials, /transactions, /stock-requests | ዋና ገጾች፡ /materials, /transactions, /stock-requests

#### Step 2: Barista & Beverage Staff Routine (የባሬስታና የባር ሰራተኛ ዕለታዊ ስራ)
- **English:** Login ➔ Go to Stock Requests (auto-defaults to Bar) ➔ Submit requests for milk, coffee beans, syrups ➔ Receive items into Bar balance ➔ Prepare drink orders printing on Bar KOT ➔ Monitor Bar Stock.
- **አማርኛ:** መግባት ➔ ወደ ስቶክ ጥያቄ ገጽ መሄድ ➔ ለቡና፣ ለወተት፣ ለሻይ ጥያቄ ማቅረብ ➔ የወጡ እቃዎችን መቀበል ➔ በባር KOT የሚመጡ ትዕዛዞችን ማዘጋጀት።
- **👉 Action / አሰራር:** Primary pages: /stock-requests (Bar items only) | ዋና ገጽ፡ /stock-requests (የባር ዕቃዎች ብቻ)

#### Step 3: Kitchen Head Chef & Cooks Routine (የኩሽና ዋና ሼፍና ሰራተኞች ዕለታዊ ስራ)
- **English:** Login ➔ Submit Kitchen requisitions for meat, produce, flour, seasonings ➔ Receive items into Kitchen balance ➔ Cook dishes printing on Kitchen KOT ➔ Report recipe or spoilage notes to manager.
- **አማርኛ:** መግባት ➔ ለስጋ፣ ለአትክልትና ለዱቄት ጥያቄ ማቅረብ ➔ ስቶር ጠባቂው ያወጣውን መረከብ ➔ በኩሽና ፕሪንተር የሚታተሙ ትዕዛዞችን ማብሰልና ማቅረብ።
- **👉 Action / አሰራር:** Primary pages: /stock-requests (Kitchen items only) | ዋና ገጽ፡ /stock-requests (የኩሽና ዕቃዎች ብቻ)

#### Step 4: Floor Waiter & Captain Routine (የአስተናጋጅና የካፕቴን ዕለታዊ ስራ)
- **English:** Login on workstation/mobile ➔ Verify in-person customer table QR orders before they reach kitchen ➔ Take captain orders for walk-ins ➔ Respond to guest Call Waiter and Bill Request alerts.
- **አማርኛ:** መግባት ➔ ደንበኛው ከስልኩ ያዘዘውን በአካል አይቶ ማረጋገጥ (Verify) ➔ በአካል ለሚመጡ ትዕዛዝ መውሰድ ➔ ደንበኛው ሲጠራ ወይም ሂሳብ ሲጠይቅ ማስተናገድ።
- **👉 Action / አሰራር:** Primary pages: /captain-order, /menu | ዋና ገጾች፡ /captain-order, /menu

#### Step 5: Cashier & POS Operator Routine (የካሳና የሽያጭ ሰራተኛ ዕለታዊ ስራ)
- **English:** Login at POS counter ➔ Select table and order type (Dine-in, Takeaway, Delivery) ➔ Settle payments via Cash, Telebirr, or Card ➔ Hand tax receipts to customers ➔ Print end-of-shift cash sales report.
- **አማርኛ:** በካሳ ኮምፒውተር መግባት ➔ ጠረጴዛ መርጦ ትዕዛዝ ማስገባት ➔ በጥሬ ገንዘብ፣ በቴሌብር ወይም በካርድ ክፍያ መቀበል ➔ ደረሰኝ ማተም ➔ የፈረቃ መጨረሻ የሂሳብ ሪፖርት ማውጣት።
- **👉 Action / አሰራር:** Primary pages: /pos, /cash-sales | ዋና ገጾች፡ /pos, /cash-sales

#### Step 6: Manager & Owner Routine (የስራ አስኪያጅና የባለቤት ዕለታዊ ስራ)
- **English:** Review Live Online Users and machine IP audit trail (/activity-log) ➔ Authorize order voids with reason ➔ Review real-time sales revenue, COGS, and gross profit (/analytics) ➔ Manage staff privileges and digital ID badges.
- **አማርኛ:** በቀጥታ በስራ ላይ ያሉትንና የኮምፒውተር IP መዝገብ መቆጣጠር ➔ የተሳሳተ ትዕዛዝ ሲሰረዝ ማጽደቅ ➔ የዕለቱን ትርፍና የግብዓት ወጪ መከታተል ➔ የሰራተኞችን ፈቃድና ዲጂታል መታወቂያ ማስተዳደር።
- **👉 Action / አሰራር:** Primary pages: /dashboard, /activity-log, /analytics, /users, /reports | ዋና ገጾች፡ /dashboard, /activity-log, /analytics, /users, /reports

---

## 13. Key Rules & Best Practices
### ወሳኝ የአሰራር ደንቦች

1. **🔒 Machine IP Security Tracking / የኮምፒውተር IP ቁጥጥር**
   - *English:* All system activities, logins, and POS orders record the machine IP address for complete security accountability.
   - *አማርኛ:* ሁሉም ተግባራትና ሽያጮች የተፈጸሙበትን የኮምፒውተር IP አድራሻ በመመዝገብ ሙሉ የደህንነት ቁጥጥር ያደርጋሉ።

2. **🏢 Central Warehouse Priority / የዋና መጋዘን ቅድሚያ**
   - *English:* 100% of materials begin in Main Store. Stations receive stock through requisitions approved by the Storekeeper.
   - *አማርኛ:* ሁሉም ዕቃዎች መጀመሪያ የሚገቡት ዋና መጋዘን ነው፤ ኩሽናና ባር ዕቃ የሚያገኙት በስቶር ጠባቂው ሲጸድቅ ብቻ ነው።

3. **🍳 Station Item Restriction / የጣቢያ ዕቃዎች ገደብ**
   - *English:* Baristas and Kitchen staff are automatically restricted to only request and view their mapped station items.
   - *አማርኛ:* የባርና የኩሽና ሰራተኞች ለክፍላቸው የተመደቡላቸውን ዕቃዎች ብቻ እንዲያዩና እንዲጠይቁ ተደርገው የተገደቡ ናቸው።

4. **🎫 Digital PVC ID Badges / ዲጂታል መታወቂያ ባጆች**
   - *English:* Generate and print high-resolution PVC Digital ID Badges for all staff directly from Staff Accounts.
   - *አማርኛ:* ለሰራተኞች በፕላስቲክ (PVC) ላይ የሚታተሙ ዲጂታል የመታወቂያ ባጆችን ከሰራተኞች ገጽ ላይ ማመንጨት ይችላሉ።

5. **📱 QR Table Order Verification / የQR ትዕዛዝ ማረጋገጫ**
   - *English:* Customer QR orders require waiter verification before sending to the kitchen to prevent accidental orders.
   - *አማርኛ:* ደንበኞች በሞባይላቸው ያዘዙት ትዕዛዝ ወደ ኩሽና ከመላኩ በፊት አስተናጋጅ በአካል ማረጋገጥ አለበት።

6. **⚡ Live User Activity Monitoring / የቀጥታ ሰራተኞች እንቅስቃሴ**
   - *English:* Check the live Activity Log (/activity-log) to see which team members are currently online and working.
   - *አማርኛ:* የየትኛው ሰራተኛ አሁን በስራ ላይ እንዳለ በቀጥታ በእንቅስቃሴ መዝገብ (/activity-log) ላይ ማየት ይችላሉ።

---

*Baba Roti Cafe & Restaurant Management System · Developed by MEGA Technology*
