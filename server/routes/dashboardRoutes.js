const express = require('express');
const router = express.Router();
const { getSummary, getSalesAnalytics } = require('../controllers/dashboardController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/summary', getSummary);
router.get('/sales-analytics', getSalesAnalytics);

module.exports = router;
