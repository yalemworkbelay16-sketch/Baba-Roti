const express = require('express');
const router  = express.Router();
const {
  handleWebhook,
  getSubscribers,
  addSubscriber,
  updateSubscriberPhone,
  removeSubscriber,
  getDailyReportPreview,
  sendManualDailyReport,
} = require('../controllers/telegramController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Telegram calls this — no auth needed
router.post('/webhook', handleWebhook);

// Admin / Developer management
router.get('/subscribers',                   protect, authorize('admin'), getSubscribers);
router.post('/subscribers',                  protect, authorize('admin'), addSubscriber);
router.put('/subscribers/:chatId/phone',     protect, authorize('admin'), updateSubscriberPhone);
router.delete('/subscribers/:chatId',        protect, authorize('admin'), removeSubscriber);

// Daily Sales Report to Telegram (Admin / Developer)
router.get('/daily-report-preview',          protect, authorize('admin'), getDailyReportPreview);
router.post('/send-daily-report',            protect, authorize('admin'), sendManualDailyReport);

module.exports = router;
