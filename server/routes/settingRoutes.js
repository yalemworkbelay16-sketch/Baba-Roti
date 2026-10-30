const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  applyProductPriceAdjustment,
  applyRawMaterialPriceAdjustment,
  updateDeveloperLicense,
  createMenuReview,
  getMenuReviews,
  deleteMenuReview,
} = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getSettings)
  .put(protect, authorize('admin', 'manager', 'dev'), updateSettings);

router.put('/developer-license', protect, updateDeveloperLicense);
router.post('/apply-product-price-adjustment', protect, authorize('admin', 'dev'), applyProductPriceAdjustment);
router.post('/apply-raw-material-price-adjustment', protect, authorize('admin', 'dev'), applyRawMaterialPriceAdjustment);

// Customer Digital Menu Ratings & Reviews
router.post('/menu-reviews', createMenuReview); // Public submission
router.get('/menu-reviews', getMenuReviews); // Public & Private
router.delete('/menu-reviews/:id', protect, authorize('admin', 'manager', 'dev'), deleteMenuReview);

module.exports = router;
