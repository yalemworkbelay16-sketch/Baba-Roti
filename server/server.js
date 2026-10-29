const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ── Startup diagnostics ────────────────────────────────────────────────
console.log('[STARTUP] NODE_ENV:', process.env.NODE_ENV);
console.log('[STARTUP] PORT:', process.env.PORT);
console.log('[STARTUP] MONGO_URI set:', !!process.env.MONGO_URI);
console.log('[STARTUP] JWT_SECRET set:', !!process.env.JWT_SECRET);
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// ── Auto-seed default accounts on startup ─────────────────────────────
const autoSeed = async () => {
  try {
    const User = require('./models/User');
    const defaults = [
      { name: 'System Developer', email: 'dev@hotel.com', password: 'admin123', role: 'dev' },
      { name: 'Baba Roti  CaféAdmin', email: 'admin@hotel.com', password: 'admin123', role: 'admin', phone: '0918592028' },
      { name: 'Hotel Manager', email: 'manager@hotel.com', password: 'admin123', role: 'manager' },
      { name: 'Floor Supervisor', email: 'supervisor@hotel.com', password: 'admin123', role: 'supervisor' },
      { name: 'Store Keeper', email: 'storekeeper@hotel.com', password: 'admin123', role: 'storekeeper' },
      { name: 'Head Cashier', email: 'cashier@hotel.com', password: 'admin123', role: 'cashier' },
      { name: 'Service Waiter', email: 'waiter@hotel.com', password: 'admin123', role: 'waiter' },
    ];
    for (const u of defaults) {
      const exists = await User.findOne({ email: u.email });
      if (!exists) {
        await User.create(u);
        console.log(`[SEED] Created ${u.role} -> ${u.email}`);
      } else if (u.phone && !exists.phone) {
        // Backfill phone on existing admin account
        exists.phone = u.phone;
        await exists.save();
        console.log(`[SEED] Updated phone for ${u.email}`);
      }
    }
  } catch (err) {
    console.error('[SEED] Auto-seed error:', err.message);
  }
};

const { migrateLocalUploads } = require('./utils/gridfs');

connectDB()
  .then(async () => {
    await autoSeed();
    await migrateLocalUploads();
  })
  .catch((err) => {
    console.error('[DB] Startup connect error:', err.message);
    global.mongoConnectionError = err.message;
  });

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// Always accessible health & diagnostics endpoint
app.get('/api/health', (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const mongoose = require('mongoose');
  res.json({
    status: 'ok',
    service: 'hotel-stock-server',
    mongoUriSet: !!(process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL),
    mongoState: states[mongoose.connection.readyState] || 'unknown',
    mongoError: global.mongoConnectionError || null,
  });
});
// Ensure DB is connected for API requests
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next();
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/suppliers', require('./routes/supplierRoutes'));
app.use('/api/materials', require('./routes/materialRoutes'));
app.use('/api/purchases', require('./routes/purchaseRoutes'));
app.use('/api/transactions', require('./routes/transactionRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/settings', require('./routes/settingRoutes'));
app.use('/api/analytics', require('./routes/analyticsRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));
app.use('/api/inventory-count', require('./routes/inventoryCountRoutes'));
app.use('/api/recycle-bin', require('./routes/recycleBinRoutes'));
app.use('/api/telegram', require('./routes/telegramRoutes'));
app.use('/api/consumption', require('./routes/consumptionRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/stock-requests', require('./routes/stockRequestRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/expenses', require('./routes/expenseRoutes'));
app.use('/api/pos', require('./routes/posRoutes'));
app.use('/api/captain-orders', require('./routes/captainOrderRoutes'));
app.use('/api/printers', require('./routes/printerRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));

// Serve Frontend in production (for Render, Docker, Aletcloud, etc.)
const distPath = path.resolve(__dirname, '../client/dist');
const distExists = require('fs').existsSync(path.join(distPath, 'index.html'));
console.log('[STATIC] Frontend dist exists:', distExists, 'at', distPath);

if (distExists) {
  app.use(
    express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('index.html') || filePath.includes('favicon') || filePath.includes('logo') || filePath.endsWith('.ico')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      },
    })
  );
  // Exclude /api routes from being caught by the wildcard
  app.get(/^(?!\/api).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  console.warn('[STATIC] Warning: client/dist/index.html not found. Check build output.');
  app.get('/', (req, res) => res.send('Baba Roti API Server is running. Frontend build in progress or not mounted.'));
}
app.use(notFound);
app.use(errorHandler);
const PORT = process.env.PORT || 5000;
// Listen on port unless we are in Vercel's serverless environment
if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} (0.0.0.0)`);

    // ── Keep-alive ping every 10 minutes ──────────────────────────
    // Prevents free-tier hosting (Aletcloud, Render) from sleeping.
    // Only runs if a PUBLIC_URL env var is set (set it in Aletcloud
    // to your server URL, e.g. https://baba-roti-1.app.aletcloud.com/
    const publicUrl = process.env.PUBLIC_URL;
    if (publicUrl) {
      const https = require('https');
      const http = require('http');
      const INTERVAL = 10 * 60 * 1000; // 10 minutes

      setInterval(() => {
        try {
          const url = new URL(`${publicUrl}/api/health`);
          const lib = url.protocol === 'https:' ? https : http;
          lib.get(url.toString(), (res) => {
            console.log(`[KEEP-ALIVE] Pinged ${url.toString()} — status ${res.statusCode}`);
            res.resume();
          }).on('error', (err) => {
            console.warn('[KEEP-ALIVE] Ping failed:', err.message);
          });
        } catch (err) {
          console.warn('[KEEP-ALIVE] Invalid PUBLIC_URL:', err.message);
        }
      }, INTERVAL);

      console.log(`[KEEP-ALIVE] Server ping active every 10 min → ${publicUrl}/api/health`);
    }
  });
}

module.exports = app;
