const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  initiatePosPayoPayment,
  initiateDigitalMenuPayoPayment,
  handlePayoWebhook,
  getPayoStatus,
  confirmPayoPaymentManual,
  testPayoConnection,
} = require('../controllers/paymentController');

// Public routes (Payo webhook + customer Digital Menu checkout & status polling)
router.post('/payo/webhook', handlePayoWebhook);
router.post('/payo/menu-initiate', initiateDigitalMenuPayoPayment);
router.get('/payo/status/:reference', getPayoStatus);

// Protected POS / Staff / Admin routes
router.post('/payo/pos-initiate', protect, initiatePosPayoPayment);
router.post('/payo/confirm/:reference', protect, confirmPayoPaymentManual);
router.post('/payo/test', protect, testPayoConnection);

module.exports = router;
