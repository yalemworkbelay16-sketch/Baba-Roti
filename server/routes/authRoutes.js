const express = require('express');
const router = express.Router();
const {
  registerUser,
  loginUser,
  logoutUser,
  heartbeat,
  getMe,
  verifyPassword,
  updateProfile,
  updatePassword,
  requestOtp,
  verifyOtp,
} = require('../controllers/authController');
const { protect, authorize, authorizePermission } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);
router.post('/heartbeat', protect, heartbeat);
router.post('/request-otp', requestOtp);   // Step 1: send OTP
router.post('/verify-otp',  verifyOtp);    // Step 2: verify OTP → get otpToken
router.post('/register', protect, authorizePermission('manageAccounts'), registerUser);
router.get('/me', protect, getMe);
router.post('/verify-password', protect, verifyPassword);
router.put('/profile', protect, updateProfile);
router.put('/password', protect, updatePassword);

module.exports = router;
