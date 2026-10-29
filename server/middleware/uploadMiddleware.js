const multer = require('multer');
const path = require('path');

// ── Memory storage engine for streaming buffers directly into GridFS ─────
const storage = multer.memoryStorage();

// ── Allowed file types: JPG, PNG, WEBP, PDF (and JPEG, GIF) ──────────────
const fileFilter = (_req, file, cb) => {
  const allowedExts = /^(jpeg|jpg|png|webp|pdf|gif)$/i;
  const allowedMimes = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/i;

  const ext = path.extname(file.originalname).toLowerCase().slice(1);
  const isValidExt = allowedExts.test(ext);
  const isValidMime = allowedMimes.test(file.mimetype);

  if (isValidExt || isValidMime) {
    cb(null, true);
  } else {
    cb(new Error('Only images (JPG, PNG, WEBP) and PDF files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

module.exports = upload;
