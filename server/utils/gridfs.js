const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');

let gridFSBucket = null;

// Directory for optional local disk cache
const uploadsDir = path.join(__dirname, '..', 'uploads');

// Ensure local uploads directory exists
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
  } catch (err) {
    console.warn('[GridFS] Warning creating uploads directory:', err.message);
  }
}

// ── MIME types mapping ──────────────────────────────────────────────────
const MIME_TYPES = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf',
  '.svg': 'image/svg+xml',
};

const getMimeType = (filename, fallback = 'application/octet-stream') => {
  const ext = path.extname(filename || '').toLowerCase();
  return MIME_TYPES[ext] || fallback;
};

// ── Get or initialize GridFSBucket ──────────────────────────────────────
const getGridFSBucket = () => {
  if (gridFSBucket && mongoose.connection.readyState === 1) {
    return gridFSBucket;
  }
  if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
    gridFSBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads',
    });
    return gridFSBucket;
  }
  return null;
};

// Reset bucket instance if connection drops
mongoose.connection.on('disconnected', () => {
  gridFSBucket = null;
});

// ── Upload buffer to GridFS ─────────────────────────────────────────────
const uploadBufferToGridFS = async (filename, buffer, mimetype, metadata = {}) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error('MongoDB Atlas is not connected. Unable to save file to GridFS.');
  }

  const cleanFilename = path.basename(filename);
  const contentType = mimetype || getMimeType(cleanFilename);

  // Clean up any existing file with the same filename to avoid stale duplicates
  try {
    const existing = await bucket.find({ filename: cleanFilename }).toArray();
    for (const f of existing) {
      await bucket.delete(f._id);
    }
  } catch (err) {
    console.warn(`[GridFS] Warning cleaning up pre-existing file ${cleanFilename}:`, err.message);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(cleanFilename, {
      contentType,
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });

    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    readable
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream));
  });
};

// ── Find file in GridFS ─────────────────────────────────────────────────
const findGridFSFile = async (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket) return null;
  const cleanFilename = path.basename(filename);
  const files = await bucket.find({ filename: cleanFilename }).sort({ uploadDate: -1 }).toArray();
  return files.length > 0 ? files[0] : null;
};

// ── Open download stream from GridFS ────────────────────────────────────
const openDownloadStream = (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket) {
    throw new Error('GridFS bucket is not available.');
  }
  const cleanFilename = path.basename(filename);
  return bucket.openDownloadStreamByName(cleanFilename);
};

// ── Delete file from GridFS ─────────────────────────────────────────────
const deleteFromGridFS = async (filename) => {
  const bucket = getGridFSBucket();
  if (!bucket) return false;
  const cleanFilename = path.basename(filename);
  const files = await bucket.find({ filename: cleanFilename }).toArray();
  for (const f of files) {
    try {
      await bucket.delete(f._id);
    } catch (err) {
      console.warn(`[GridFS] Error deleting file chunk ${f._id}:`, err.message);
    }
  }
  return files.length > 0;
};

// ── Local Cache Helpers ─────────────────────────────────────────────────
const saveLocalCache = async (filename, buffer) => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const cleanFilename = path.basename(filename);
    await fs.promises.writeFile(path.join(uploadsDir, cleanFilename), buffer);
  } catch (err) {
    // Local cache is purely best-effort (e.g. read-only container disks)
    console.warn(`[GridFS Cache] Local disk cache write skipped for ${filename}:`, err.message);
  }
};

const deleteLocalCache = (filename) => {
  try {
    const cleanFilename = path.basename(filename);
    const localPath = path.join(uploadsDir, cleanFilename);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
  } catch (err) {
    console.warn(`[GridFS Cache] Error deleting local file ${filename}:`, err.message);
  }
};

// ── Background Sync: local disk to GridFS ──────────────────────────────
const syncLocalFileToGridFS = async (filename, localPath) => {
  try {
    const cleanFilename = path.basename(filename);
    const bucket = getGridFSBucket();
    if (!bucket) return;

    // Check if already in GridFS
    const existing = await bucket.find({ filename: cleanFilename }).toArray();
    if (existing.length > 0) return;

    if (!fs.existsSync(localPath)) return;

    const buffer = await fs.promises.readFile(localPath);
    const stat = await fs.promises.stat(localPath);
    const mime = getMimeType(cleanFilename);

    await uploadBufferToGridFS(cleanFilename, buffer, mime, {
      originalName: cleanFilename,
      size: stat.size,
      syncedAt: new Date(),
      source: 'background-sync',
    });
    console.log(`[GridFS] Background synced local file to MongoDB Atlas: ${cleanFilename} (${stat.size} bytes)`);
  } catch (err) {
    console.error(`[GridFS] Background sync failed for ${filename}:`, err.message);
  }
};

// ── Startup Auto-Migration ──────────────────────────────────────────────
const migrateLocalUploads = async () => {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      return;
    }

    const bucket = getGridFSBucket();
    if (!bucket) {
      console.warn('[GridFS Migration] Skipped: GridFS bucket not ready.');
      return;
    }

    const entries = await fs.promises.readdir(uploadsDir);
    // Ignore hidden files and .gitkeep
    const filesToMigrate = entries.filter((f) => {
      if (f.startsWith('.')) return false;
      const fullPath = path.join(uploadsDir, f);
      return fs.existsSync(fullPath) && fs.statSync(fullPath).isFile();
    });

    if (filesToMigrate.length === 0) {
      console.log('[GridFS Migration] No local files to migrate.');
      return;
    }

    let migratedCount = 0;
    let alreadySyncedCount = 0;

    for (const file of filesToMigrate) {
      const existing = await bucket.find({ filename: file }).toArray();
      if (existing.length > 0) {
        alreadySyncedCount++;
        continue;
      }

      const filePath = path.join(uploadsDir, file);
      const stat = await fs.promises.stat(filePath);
      const buffer = await fs.promises.readFile(filePath);
      const mime = getMimeType(file);

      await uploadBufferToGridFS(file, buffer, mime, {
        originalName: file,
        size: stat.size,
        migratedAt: new Date(),
        source: 'startup-auto-migration',
      });
      migratedCount++;
      console.log(`[GridFS Migration] Migrated "${file}" (${stat.size} bytes) to MongoDB Atlas GridFS.`);
    }

    console.log(
      `[GridFS Migration] Auto-migration complete. ${migratedCount} migrated, ${alreadySyncedCount} already present in GridFS.`
    );
  } catch (err) {
    console.error('[GridFS Migration] Auto-migration error:', err.message);
  }
};

// ── SVG Placeholder for missing files ───────────────────────────────────
const getNotFoundSvg = (filename) => {
  const safeName = (filename || 'Document')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 280" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#f1f5f9" />
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#0f172a" flood-opacity="0.06"/>
    </filter>
  </defs>

  <!-- Background Card -->
  <rect width="440" height="280" rx="16" fill="url(#bgGrad)" stroke="#e2e8f0" stroke-width="1.5" />

  <!-- Document Outline -->
  <g transform="translate(180, 48)">
    <rect x="0" y="0" width="80" height="100" rx="8" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" filter="url(#shadow)" />
    <!-- Folded corner -->
    <path d="M 56 0 L 80 24 L 56 24 Z" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="1.5" />
    <!-- Document lines -->
    <line x1="16" y1="36" x2="64" y2="36" stroke="#94a3b8" stroke-width="2.5" stroke-linecap="round" />
    <line x1="16" y1="50" x2="64" y2="50" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" />
    <line x1="16" y1="64" x2="48" y2="64" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" />

    <!-- Alert / Exclamation badge -->
    <circle cx="68" cy="88" r="14" fill="#f59e0b" stroke="#ffffff" stroke-width="2" />
    <text x="68" y="93" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="bold" fill="#ffffff">!</text>
  </g>

  <!-- Text Info -->
  <text x="220" y="184" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="15" font-weight="700" fill="#334155">
    Attachment Not Found
  </text>
  <text x="220" y="206" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" fill="#64748b">
    This file was cleared on cloud restart or needs to be re-uploaded.
  </text>
  <text x="220" y="234" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" font-size="11" fill="#94a3b8">
    ${safeName}
  </text>
</svg>`;
};

module.exports = {
  uploadsDir,
  getGridFSBucket,
  uploadBufferToGridFS,
  findGridFSFile,
  openDownloadStream,
  deleteFromGridFS,
  saveLocalCache,
  deleteLocalCache,
  syncLocalFileToGridFS,
  migrateLocalUploads,
  getMimeType,
  getNotFoundSvg,
};
