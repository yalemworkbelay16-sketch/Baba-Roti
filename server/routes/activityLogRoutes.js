const express = require('express');
const router = express.Router();
const {
  getActivityLogs,
  getActivityLogSummary,
  getOnlineUsers,
  clearActivityLogs,
} = require('../controllers/activityLogController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);
router.use(authorize('admin', 'manager', 'operation_manager', 'finance', 'supervisor', 'dev'));

router.get('/', getActivityLogs);
router.get('/summary', getActivityLogSummary);
router.get('/online-users', getOnlineUsers);
router.delete('/clear', authorize('admin', 'dev'), clearActivityLogs);

module.exports = router;
