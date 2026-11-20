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
12. [Key Rules & Best Practices / ወሳኝ ደንቦች](#12-key-rules--best-practices)

---

## 1. Getting Started & Login
### መግቢያና የተጠቃሚዎች መግቢያ

#### Step 1: Secure Log In & Online Session (በደህንነት መግባትና የቀጥታ ቆይታ)
- **English:** Enter your username/email and password. Upon sign in, your account immediately activates as 🟢 Online with your machine IP address and device signature recorded.
- **አማርኛ:** የይለፍ ቃልና ስምዎን በማስገባት ይግቡ፤ ሲገቡ ወዲያውኑ እንደ 🟢 Online (በስራ ላይ) ተብሎ ከኮምፒውተርዎ IP አድራሻ ጋር ይመዘገባል።

#### Step 2: Smart Landing by Role (እንደየስራ ድርሻዎ የሚከፈት ገጽ)
- **English:** The system automatically routes you to your authorized workstation (e.g., Cashiers open at POS, Baristas & Chefs open at Requisitions, Admins open at Dashboard).
- **አማርኛ:** ስርዓቱ እንደተጠቃሚው የስራ ድርሻ በቀጥታ ወደሚገባው ገጽ ይወስድዎታል (ካሳ ወደ POS፣ ባሬስታና ሼፍ ወደ ስቶክ ጥያቄ፣ አስተዳዳሪ ወደ ዳሽቦርድ)።

#### Step 3: Dashboard Overview & Metrics (የዳሽቦርድ አጠቃላይ መረጃ)
- **English:** Shows real-time inventory balance valuation, safety reorder alerts, daily movement inflow/outflow, and sales cost aggregation.
- **አማርኛ:** የአጠቃላይ ስቶክ የገንዘብ መጠን፣ የአደጋ ማሳሰቢያዎች፣ የዕለቱ የዕቃ ገቢና ወጪ፣ እና የሽያጭ ትርፍና ኪሳራን በጨረፍታ ያሳያል።

#### Step 4: Sidebar Navigation (የግራ ጎን ሜኑ አጠቃቀም)
- **English:** Navigate between Main Store, Kitchen Store, Bar Store, Stock Movements, Requisitions, Staff ID Badges, and Activity Logs.
- **አማርኛ:** በዋና መጋዘን፣ በኩሽና፣ በባር፣ በእንቅስቃሴ መዝገብ፣ በሰራተኞችና በሪፖርቶች መካከል በቀላሉ ለመዘዋወር ይጠቀሙበት።

---

## 2. Station Storage & Routing
### የስቶክ ጣቢያዎች ምደባና ማከማቻ

#### Step 1: Central Warehouse Concept (ዋና መጋዘን ማዕከላዊ አስተዳደር)
- **English:** 100% of all raw materials are registered under and managed centrally by the Main Store. Kitchen and Bar stations receive their items exclusively through approved requisitions.
- **አማርኛ:** 100% ሁሉም ጥሬ ዕቃዎች መጀመሪያ የሚገቡትና የሚተዳደሩት በዋና መጋዘን ነው። ኩሽናና ባር ዕቃዎችን የሚያገኙት በጸደቀ ጥያቄ ብቻ ነው።

#### Step 2: Category Station Routing (ምድቦችን ለኩሽና እና ለባር መመደብ)
- **English:** Categories are mapped either to Kitchen Station (Produce, Meat, Pastry, Mendi, Ferash Bazaar) or Bar Station (Coffee, Tea, Beverages, Drinks).
- **አማርኛ:** የዕቃ ምድቦች ለኩሽና (ምግብ፣ ፓስትሪ፣ ሜንዲ፣ ፍራሽ ባዛር) ወይም ለባር (ቡና፣ ሻይ፣ መጠጦች) ይመደባሉ።

#### Step 3: Admin Password Security Gate (የይለፍ ቃል ጥበቃ)
- **English:** Modifying station category assignments requires entering the Admin/Manager password to prevent accidental or unauthorized routing changes.
- **አማርኛ:** የጣቢያ ምደባዎችን ለማስተካከልና ለማስቀመጥ የአስተዳዳሪ የይለፍ ቃል ማስገባት ግዴታ ነው፤ ይህም ያልተፈቀደ ለውጥ እንዳይደረግ ይጠብቃል።

#### Step 4: Role-Based Station Scoping (ለእያንዳንዱ ክፍል የራሱን ስቶክ ብቻ ማሳየት)
- **English:** Baristas see only Bar materials and stock balance; Kitchen staff sees only Kitchen materials. Only Main Storekeepers and Admins have permission to view all stations simultaneously.
- **አማርኛ:** ባሬስታ የባርን ብቻ፣ ኩሽና ደግሞ የኩሽናን ስቶክ ብቻ ያያሉ። ዋና ስቶር ጠባቂና ስራ አስኪያጅ ብቻ የሁሉንም ክፍሎች ስቶክ በአንድ ላይ ማየት ይችላሉ።

---

## 3. Stock Requisitions & Dispatch
### የጥያቄና ወጪ ስቶክ አሰራር

#### Step 1: Create Stock Requisition (አዲስ የስቶክ ጥያቄ ማቅረብ)
- **English:** Go to Stock Issue & Request → click "+ New Request". Baristas automatically default to "Bar" department; chefs automatically default to "Kitchen" department.
- **አማርኛ:** ወደ ስቶክ ጥያቄ በመሄድ "+ አዲስ ጥያቄ" ይጫኑ፤ ባሬስታ በቀጥታ "Bar"፣ ሼፍ ደግሞ በቀጥታ "Kitchen" ተብሎ ይመረጣል።

#### Step 2: Mapped Item Requisition Filter (የተመደቡ ዕቃዎችን ብቻ መጠየቅ)
- **English:** When requesting items, only raw materials mapped to your station (e.g. coffee beans/milk for Bar; flour/meat/vegetables for Kitchen) are displayed.
- **አማርኛ:** ዕቃዎችን በሚመርጡበት ጊዜ ለክፍልዎ የተፈቀዱትንና የተመደቡትን ጥሬ ዕቃዎች ብቻ ያሳየዎታል።

#### Step 3: Storekeeper Exclusive Dispatch (የዋና ስቶር ጠባቂ ብቻ የማውጣት ስልጣን)
- **English:** Kitchen and Bar employees can only request. Only the Main Storekeeper, Manager, or Admin has authority to Approve and Issue stock from the central warehouse.
- **አማርኛ:** የኩሽናና የባር ሰራተኞች መጠየቅ ብቻ ይችላሉ፤ ዕቃውን ከዋና መጋዘን የማጽደቅና ወጪ የማድረግ ስልጣን የዋና ስቶር ጠባቂ ብቻ ነው።

#### Step 4: Real-Time Station Transfer (ቀጥታ የክምችት ማስተላለፍ)
- **English:** When the Storekeeper issues the request, items are automatically deducted from Main Store and credited to the Kitchen or Bar station balance.
- **አማርኛ:** ስቶር ጠባቂው ዕቃውን ወጪ ሲያደርግ፣ ከዋና መጋዘን ተቀንሶ በቀጥታ ወደ ጠየቀው ኩሽና ወይም ባር ስቶክ ይጨመራል።

---

## 4. POS Orders & Recipe Deduction
### የሽያጭና የካሳ አሰራር እና የግብዓት ቅነሳ

#### Step 1: Create POS Order & Payment (ትዕዛዝ መውሰድና ክፍያ መቀበል)
- **English:** Go to POS or Cash Sales. Choose Dine-in, Takeaway, or Delivery, pick table, select menu items, and settle bill via Cash, Telebirr, or Card.
- **አማርኛ:** በካሳ ወይም POS ገጽ ላይ ትዕዛዝ ይውሰዱ፤ ክፍያውን በጥሬ ገንዘብ፣ በቴሌብር ወይም በካርድ ይቀበሉ።

#### Step 2: Automated Station Recipe Deduction (አውቶማቲክ የግብዓት ቅነሳ - Recipe Deduction)
- **English:** Upon checkout, the system automatically deducts recipe ingredients: drinks and coffee deduct from Bar Stock; meals and pastries deduct from Kitchen Stock.
- **አማርኛ:** ሽያጭ ሲፈጸም የተዘጋጀበት ግብዓት በሬሲፒው መሰረት በቀጥታ ይቀነሳል፤ መጠጦች ከባር ስቶክ፣ ምግቦች ደግሞ ከኩሽና ስቶክ ይቀነሳሉ።

#### Step 3: Manager Order Voiding & Security (ትዕዛዝ መሰረዝና የስቶክ መመለሻ)
- **English:** Voiding an order requires a manager reason. The system automatically reverses all deducted recipe ingredients back into inventory and audits the action in Activity Log.
- **አማርኛ:** የተሳሳተ ትዕዛዝ ለመሰረዝ የስራ አስኪያጅ ምክንያት ያስፈልጋል፤ የተቀነሱ ግብዓቶች በሙሉ ወደ ስቶክ ይመለሳሉ እንዲሁም በመዝገብ ላይ ይመዘገባል።

#### Step 4: Instant KOT & Receipt Printing (የማዘዣ - KOT እና የደረሰኝ ህትመት)
- **English:** Direct integration with Windows thermal receipt printers. Automatically prints KOT order slips for the kitchen/bar and final customer receipts.
- **አማርኛ:** ወደ ኩሽናና ባር የሚላከውን ማዘዣ (KOT) እና ለደንበኛ የሚሰጠውን ደረሰኝ በቴርማል ፕሪንተር በቅጽበት ያትማል።

---

## 5. Digital QR Menu & Guest Ordering
### የዲጂታል ሜኑና የደንበኞች ትዕዛዝ

#### Step 1: Table QR Code Scan (በሞባይል የጠረጴዛ QR ኮድ ማንበብ)
- **English:** Customers scan the QR code at their table to view the live digital menu with photos, descriptions, and prices on their mobile phones.
- **አማርኛ:** ደንበኞች በጠረጴዛቸው ላይ ያለውን የQR ኮድ በስልካቸው ስካን በማድረግ ምግቦችንና መጠጦችን በፎቶ ማየት ይችላሉ።

#### Step 2: Guest Self-Order (ደንበኛው ከስልኩ በቀጥታ ማዘዝ)
- **English:** Guests select items, enter their name, and place their order directly from their phone browser.
- **አማርኛ:** ደንበኞች የፈለጉትን መርጠው በስልካቸው ላይ "ትዕዛዝ ላክ" በማለት በቀጥታ ወደ ሲስተሙ መላክ ይችላሉ።

#### Step 3: Waiter Verification Security Gate (የአስተናጋጅ ማረጋገጫ ጥበቃ)
- **English:** To prevent fake or accidental table orders, customer QR orders require the table waiter to physically verify the guest presence and approve before reaching the kitchen.
- **አማርኛ:** የውሸት ትዕዛዞችን ለመከላከል፣ ደንበኛው ከስልኩ ሲያዝ አስተናጋጁ በአካል ደንበኛው መኖሩን አይቶ ሳያጸድቅ ወደ ኩሽና አይላክም።

#### Step 4: Call Waiter & Request Bill (አስተናጋጅ መጥሪያ እና ሂሳብ መጠየቂያ)
- **English:** Guests can tap "Call Waiter" or "Request Bill" to notify floor staff and trigger Telegram alerts instantly.
- **አማርኛ:** ደንበኛው ከስልኩ ላይ "አስተናጋጅ ጥራ" ወይም "ሂሳብ አምጡ" የሚለውን በመጫን አስተናጋጁን መጥራት ይችላል።

---

## 6. Activity Log & Machine IP Audit
### የእንቅስቃሴ መዝገብና የመሳሪያ IP ቁጥጥር

#### Step 1: Real-Time Online / Offline Status (የቀጥታ በስራ ላይ መሆን ሁኔታ)
- **English:** Live pulsing indicators display who is currently logged in and active within 15 minutes (🟢 Online) vs inactive (⚪ Offline with relative last active time).
- **አማርኛ:** የትኛው ሰራተኛ አሁን ሲስተሙ ላይ እየሰራ እንደሆነ (🟢 Online) እና መቼ እንደወጣ (⚪ Offline) በግልጽ ያሳያል።

#### Step 2: Machine IP & Device Signature (የመሳሪያው IP አድራሻ እና የኮምፒውተር አይነት)
- **English:** Every login, order checkout, stock issue, and settings modification logs the physical machine IP (e.g. 192.168.x.x, 196.188.x.x) and device OS/browser.
- **አማርኛ:** ማንኛውም ተግባር (መግባት፣ መውጣት፣ ሽያጭ፣ ስቶክ ወጪ) የተፈጸመበትን ትክክለኛ የኮምፒውተር IP አድራሻና የብሮውዘር አይነት ይመዘግባል።

#### Step 3: Audit Trail Search & Filtering (መዝገብ መፈለጊያና ማጣሪያ)
- **English:** Search by staff name, machine IP address, action type (Login, Checkout, Stock Issue, Void), module, or custom date range.
- **አማርኛ:** በሰራተኛ ስም፣ በIP አድራሻ፣ በተግባሩ አይነት (ሽያጭ፣ ስቶክ ወጪ፣ መግባት) ወይም በቀን በቀላሉ ፈልገው ማግኘት ይችላሉ።

#### Step 4: Management CSV Export (የመረጃ ኤክስፖርት - CSV)
- **English:** Export the complete audit log to Excel/CSV for management audits, discrepancy checks, and operational security verification.
- **አማርኛ:** የአጠቃላይ ሰራተኞችን የስራ እንቅስቃሴ ወደ ኤክሴል/CSV በማውረድ ለኦዲትና ለደህንነት ቁጥጥር መጠቀም ይቻላል።

---

## 7. Staff Accounts & Digital ID Badges
### የሰራተኞች አካውንትና ዲጂታል ባጅ

#### Step 1: Account Directory & Role Access (የሰራተኞች አካውንትና የስራ ድርሻ)
- **English:** Register staff accounts and assign roles (Admin, Manager, Supervisor, Storekeeper, Cashier, Waiter, Dev).
- **አማርኛ:** ለሰራተኞች አካውንት ይክፈቱ እና የስራ ድርሻ (አስተዳዳሪ፣ ስቶር ጠባቂ፣ ካሳ፣ አስተናጋጅ) ይመድቡ።

#### Step 2: Station & Department Scoping (የስራ ክፍልና የጣቢያ ምደባ)
- **English:** Set employee department to Kitchen or Bar to automatically restrict their accessible materials and auto-default their requisitions.
- **አማርኛ:** ሰራተኛውን ለኩሽና ወይም ለባር በመመደብ የክፍላቸውን ዕቃዎች ብቻ እንዲያዩና እንዲጠይቁ ማድረግ ይችላሉ።

#### Step 3: 3x4 Photo Upload & Digital ID Card (የሰራተኛ ፎቶና ዲጂታል መታወቂያ ባጅ)
- **English:** Upload standard 3x4 employee photos. The system generates high-definition, double-sided printable PVC Digital ID Badges complete with QR code and security stamps.
- **አማርኛ:** የሰራተኛውን ፎቶ በመጫን በፕላስቲክ (PVC) ላይ የሚታተም ደረጃውን የጠበቀ ባለሁለት ገጽ ዲጂታል መታወቂያ ባጅ ከQR ኮድ ጋር ያትሙ።

#### Step 4: Disable / Enable Account (አካውንት ማገድ ወይም ማብራት)
- **English:** Temporarily deactivate an employee account to prevent login and halt Telegram alerts without deleting their historical audit trails.
- **አማርኛ:** አንድ ሰራተኛ ስራ ሲያቆም ወይም ለእረፍት ሲወጣ አካውንቱን በማገድ ሲስተሙን እንዳይጠቀም መቆጣጠር ይቻላል።

---

## 8. Raw Materials & Stock Balances
### ጥሬ እቃዎችና የክምችት ቁጥጥር

#### Step 1: Multi-Station Stock Views (የጣቢያዎች ስቶክ እይታ - Main, Kitchen, Bar)
- **English:** Switch between 🏢 Main Store, 🍳 Kitchen Store, and ☕ Bar Store views to check balances in real-time.
- **አማርኛ:** በዋና መጋዘን፣ በኩሽና ስቶር እና በባር ስቶር መካከል በመቀያየር የየክፍሉን ክምችት በግልጽ ይመልከቱ።

#### Step 2: Add Raw Material (አዲስ ጥሬ ዕቃ መመዝገብ)
- **English:** Click "+ Add Material". Fill in name, measurement unit (kg, L, Pcs), category, unit cost, and safety reorder level.
- **አማርኛ:** አዲስ ጥሬ ዕቃ በስም፣ በስሌት መለኪያ (ኪሎ፣ ሊትር፣ ፍሬ)፣ በምድብና በዋጋ ይመዝግቡ።

#### Step 3: Safety Reorder Alerts (የማለቂያ አደጋ ማሳሰቢያ)
- **English:** Materials dropping below their safety minimum are immediately highlighted in amber/red on the dashboard and sent to Telegram.
- **አማርኛ:** ዕቃዎች ከተቀመጠላቸው ዝቅተኛ መጠን በታች ሲያልቁ ወዲያውኑ በማሳወቂያና በቴሌግራም መልዕክት ይላካል።

---

## 9. Stock Movements & Receiving
### የዕቃ መቀበያና ማስተካከያ (GRV)

#### Step 1: Cash GRV (Goods Receiving Voucher) (የጥሬ ገንዘብ ዕቃ መቀበያ ሰነድ)
- **English:** Record materials purchased with cash, including supplier, items, quantities, unit prices, and receipt photo attachments.
- **አማርኛ:** በጥሬ ገንዘብ የተገዙ ዕቃዎችን ከአቅራቢ፣ ከዋጋ እና ከደረሰኝ ፎቶ ጋር መመዝገቢያ።

#### Step 2: Credit GRV (የብድር ዕቃ መቀበያ ሰነድ)
- **English:** Record goods received on credit terms, automatically updating inventory and tracking payables to the supplier.
- **አማርኛ:** በብድር የመጡ ዕቃዎችን መመዝገቢያ፤ ስቶኩን ጨምሮ ለአቅራቢው የሚከፈለውን ዕዳ ይመዘግባል።

#### Step 3: Fresh Bazaar (የዕለቱ የገበያ ግዢ - ፍራሽ ባዛር)
- **English:** Direct market purchases from daily bazaar without formal invoices, immediately crediting inventory.
- **አማርኛ:** ከዕለታዊ ገበያ ያለደረሰኝ በቀጥታ የተገዙ አትክልቶችና ፍራፍሬዎችን መመዝገቢያ።

#### Step 4: Adjustments & Disposal (የስቶክ ማስተካከያና የተበላሹ ዕቃዎች ወጪ)
- **English:** Use Positive Adjustment for surplus, Negative Adjustment for shortages, and Goods Disposal for expired or damaged stock.
- **አማርኛ:** በቆጠራ ወቅት ለተገኘ ትርፍ (+ve)፣ ለጎደለ (-ve) እና ለተበላሹ/ለጊዜያቸው ያለፈባቸው ዕቃዎች ማስወገጃ።

---

## 10. Reports, Analytics & P&L
### ሪፖርቶች፣ ትንተናና የትርፍ/ኪሳራ ሂሳብ

#### Step 1: Stock Balance Sheet (የስቶክ ሚዛን ሰነድ)
- **English:** Complete overview of all raw materials across Main Store, Kitchen, and Bar with valuation, exportable to PDF and Excel.
- **አማርኛ:** የሁሉንም ክፍሎች ስቶክ ክምችትና የገንዘብ ዋጋ በአንድ ላይ በማሳየት ለህትመትና ለኤክሴል ያዘጋጃል።

#### Step 2: Daily Movement Report (የዕለቱ የስቶክ እንቅስቃሴ ሪፖርት)
- **English:** Tracks daily inflow, outflow, consumption, and transfers with opening and closing balances.
- **አማርኛ:** የዕለቱን አጠቃላይ የዕቃ ገቢ፣ ወጪ፣ ፍጆታ እና የተላለፉ ዕቃዎችን በዝርዝር ያሳያል።

#### Step 3: Sales, COGS & Gross Profit (የሽያጭ፣ የወጪና የትርፍ ትንተና)
- **English:** Real-time sales revenue, recipe ingredient cost (COGS), profit margins, and top-selling menu items.
- **አማርኛ:** የሽያጭ ገቢን፣ የወጣውን የግብዓት ወጪ (COGS) እና የተገኘውን ትርፍ በመቶኛ ያሰላል።

---

## 11. Settings, Security & Hardware
### የስርዓቱ ማስተካከያ፣ ደህንነትና ፕሪንተሮች

#### Step 1: Role Privileges & Permissions (የተጠቃሚዎች ስልጣንና ፈቃድ)
- **English:** Fine-tune who can view specific menu modules, edit unit costs, or access management settings.
- **አማርኛ:** የትኛው የስራ ክፍል ምን ማየትና መስራት እንደሚችል በግልጽ የሚወሰንበት ገጽ።

#### Step 2: Thermal Printer Bridge (የቴርማል ፕሪንተር ግንኙነት)
- **English:** Configure local Windows printer bridge, network ESC/POS thermal printers, and customize receipt header/footer details.
- **አማርኛ:** የደረሰኝና የትዕዛዝ ማዘዣ (KOT) ፕሪንተሮችን ከኮምፒውተሩ ጋር ማገናኛና ማስተካከያ።

#### Step 3: Telegram Alert Integration (የቴሌግራም መልዕክት ማገናኛ)
- **English:** Connect Telegram bot token and chat IDs for instant mobile alerts on requisitions, low stock, and daily sales summaries.
- **አማርኛ:** ለስራ አስኪያጆችና ለባለቤቱ በቴሌግራም ፈጣን የስቶክና የሽያጭ ማሳወቂያ እንዲደርሳቸው ማገናኛ።

#### Step 4: Auto-Logout Workstation Security (የስራ ቦታ ደህንነት - Auto-Logout)
- **English:** Set automatic session lock timers (15m, 30m, 1h, or Off) so unattended terminals securely sign out.
- **አማርኛ:** ኮምፒውተሩ ስራ ሳይሰራ ሲቀር ራሱን በራሱ ዘግቶ እንዲቆለፍ በማድረግ ያልተፈቀደ ሰው እንዳይጠቀምበት ይጠብቃል።

---

## 12. Key Rules & Best Practices
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
