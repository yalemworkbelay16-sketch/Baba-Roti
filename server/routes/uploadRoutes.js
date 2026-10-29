const express = require('express');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { protect } = require('../middleware/authMiddleware');
const {
  uploadsDir,
  uploadBufferToGridFS,
  findGridFSFile,
  openDownloadStream,
  deleteFromGridFS,
  saveLocalCache,
  deleteLocalCache,
  syncLocalFileToGridFS,
  getMimeType,
  getNotFoundSvg,
} = require('../utils/gridfs');

// ── Helper to resolve baseUrl with reverse proxy support ─────────────────
const getBaseUrl = (req) => {
  // Respect x-forwarded-proto if present behind reverse proxies (Aletcloud, Render, Docker, Heroku)
  const protoHeader = req.headers['x-forwarded-proto'];
  const protocol = protoHeader ? protoHeader.split(',')[0].trim() : req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}`;
};

// ── POST /api/upload — upload file buffers directly to GridFS ───────────
router.post('/', protect, upload.array('files', 5), async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded.' });
    }

    const baseUrl = getBaseUrl(req);
    const uploaded = [];

    for (const file of req.files) {
      const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
      const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const filename = `receipt-${uniqueSuffix}${ext}`;
      const mimeType = file.mimetype || getMimeType(filename);

      // 1. Stream buffer directly to MongoDB Atlas GridFS
      await uploadBufferToGridFS(filename, file.buffer, mimeType, {
        originalName: file.originalname,
        size: file.size,
      });

      // 2. Save optional local cache copy for fast local reads
      await saveLocalCache(filename, file.buffer);

      uploaded.push({
        url: `${baseUrl}/api/upload/${filename}`,
        filename: filename,
        name: file.originalname,
        mimeType: mimeType,
        size: file.size,
        uploadedAt: new Date(),
      });
    }

    res.status(201).json({ files: uploaded });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/upload/:filename — query GridFS, fallback to disk + sync ────
router.get('/:filename', async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);

    // 1. Query MongoDB GridFS first
    const fileDoc = await findGridFSFile(filename);
    if (fileDoc) {
      const contentType = fileDoc.contentType || getMimeType(filename);
      res.set('Content-Type', contentType);
      res.set('Content-Length', fileDoc.length);
      res.set('Cache-Control', 'public, max-age=31536000, immutable');

      const stream = openDownloadStream(filename);
      stream.on('error', (err) => {
        console.error(`[GridFS] Stream error for ${filename}:`, err.message);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming file from storage.' });
        }
      });
      return stream.pipe(res);
    }

    // 2. Fall back to local disk if found, and automatically sync to GridFS
    const localFilePath = path.join(uploadsDir, filename);
    if (fs.existsSync(localFilePath)) {
      res.set('Cache-Control', 'public, max-age=31536000, immutable');

      // Asynchronously sync local file to GridFS in the background
      syncLocalFileToGridFS(filename, localFilePath).catch((syncErr) => {
        console.warn(`[GridFS] Background sync failed for ${filename}:`, syncErr.message);
      });

      return res.sendFile(localFilePath);
    }

    // 3. File not found in GridFS or local cache: return SVG placeholder or JSON
    const isJsonExpected =
      req.query.json === 'true' ||
      (req.headers.accept &&
        req.headers.accept.includes('application/json') &&
        !req.headers.accept.includes('image'));

    if (isJsonExpected) {
      return res.status(404).json({ message: 'File not found.' });
    }

    return res
      .status(404)
      .set('Content-Type', 'image/svg+xml')
      .set('Cache-Control', 'no-cache, no-store, must-revalidate')
      .send(getNotFoundSvg(filename));
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/upload/:filename — clean up GridFS chunks and local files ─
router.delete('/:filename', protect, async (req, res, next) => {
  try {
    const filename = path.basename(req.params.filename);

    // Delete chunks and files from MongoDB Atlas GridFS
    const gridFsDeleted = await deleteFromGridFS(filename);

    // Delete from local cache if it exists
    deleteLocalCache(filename);

    res.json({
      message: 'File deleted.',
      filename,
      gridFsDeleted,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
