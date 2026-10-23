const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getPrinters,
  getPrinter,
  createPrinter,
  updatePrinter,
  deletePrinter,
  pingPrinter,
  printKOTEndpoint,
  printReceiptEndpoint,
  printTestPageEndpoint,
  getRelayJobs,
  updateRelayJobStatus,
  relayHeartbeat,
  getRelayStatus,
} = require('../controllers/printerController');

// CRUD
router.route('/').get(protect, getPrinters).post(protect, createPrinter);
router.route('/:id').get(protect, getPrinter).put(protect, updatePrinter).delete(protect, deletePrinter);

// Utility actions
router.post('/action/ping',      protect, pingPrinter);
router.post('/action/test-page', protect, printTestPageEndpoint);
router.post('/action/kot',       protect, printKOTEndpoint);
router.post('/action/receipt',   protect, printReceiptEndpoint);

// Cloud Relay Agent endpoints (accessible by standalone background agent)
router.get('/relay/jobs',                   getRelayJobs);
router.post('/relay/jobs/:jobId/status',    updateRelayJobStatus);
router.post('/relay/heartbeat',             relayHeartbeat);
router.get('/relay/status',                 getRelayStatus);

module.exports = router;
