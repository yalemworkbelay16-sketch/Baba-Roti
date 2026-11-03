# 🚀 Digital Menu & QR Ordering System — All-In-One Drop-in Package

This bundle contains the complete, battle-tested Digital Menu & QR Ordering engine.
You can drop this whole folder into any restaurant or café project in **under 3 minutes**.

---

## 📂 Bundle File Structure

```
digital-menu-bundle/
├── client/
│   ├── DigitalMenu.jsx          # Full customer-facing mobile & desktop menu app
│   ├── DigitalMenuSettings.jsx  # Admin settings, QR code generator & Gallery editor
│   ├── audioAlert.js            # Offline Web Audio bell chime + Web Speech TTS alert
│   └── fileUrl.js               # Cross-device LAN / Cloud URL normalizer
└── server/
    ├── digitalMenuStandaloneRouter.js # Drop-in Express Router with all endpoints
    └── digitalMenuSchemas.js          # Mongoose schema fields for Setting, Product & Orders
```

---

## ⚡ 3-Minute Quick Setup

### Step 1: Copy Client Files to your Frontend
Copy the 4 files into your React project:
```
client/DigitalMenu.jsx         --> your-app/src/pages/DigitalMenu.jsx
client/DigitalMenuSettings.jsx --> your-app/src/components/settings/DigitalMenuSettings.jsx
client/audioAlert.js           --> your-app/src/utils/audioAlert.js
client/fileUrl.js              --> your-app/src/utils/fileUrl.js
```

Add the public route in `App.jsx` (No login required):
```jsx
import DigitalMenu from './pages/DigitalMenu';

// In your Routes:
<Route path="/menu" element={<DigitalMenu />} />
```

---

### Step 2: Mount the Server Router
Copy `server/digitalMenuStandaloneRouter.js` to your backend routes, then in `server.js` or `app.js`:
```javascript
const digitalMenuRouter = require('./routes/digitalMenuStandaloneRouter');

// Mount with /api prefix
app.use('/api', digitalMenuRouter);
```

Ensure your `Setting`, `Product`, and `CaptainOrder` schemas include the fields from `server/digitalMenuSchemas.js`.

---

### Step 3: Required npm Dependencies
If not already installed:
**Frontend:**
```bash
npm install lucide-react qrcode.react canvas-confetti axios
```
**Backend:**
```bash
npm install express-async-handler mongoose
```

---

## 🌟 Key Capabilities Out-of-the-Box

1. **Table QR Code Generation & Stands**:
   - Generates high-res QR codes for any table (`/menu?table=Table%2001`).
   - One-click **"Print Table Stand"** formats ready-to-cut acrylic table tent cards.
2. **Table Occupancy Conflict Prevention**:
   - If Table 01 has an active unbilled order, a second guest scanning gets a polite message to pick another table or contact a waiter.
   - Returning guests or same-phone orders can freely append additional items.
3. **Real-Time Staff Audio Chime & Speech**:
   - When an order arrives, waiter / kitchen terminals play a harmonic 3-tone service bell and announce: *"New order received for Table 01"*.
   - Zero audio files needed (uses native Web Audio & Web Speech API).
4. **Kitchen Order Ticket (KOT) Reprinting**:
   - One-click Reprint KOT button dispatches directly to assigned thermal or network printers.
5. **Dynamic About Us Card & Photo Gallery**:
   - Cafe managers can edit brand story in English and Amharic, update feature badges, and upload showcase photos directly from their phone.
6. **Live Real-time SSE Stream**:
   - Built-in `/api/captain-orders/stream` provides instant live updates without requiring Socket.IO setup.

