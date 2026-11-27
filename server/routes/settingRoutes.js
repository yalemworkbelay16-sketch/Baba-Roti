const express = require('express');
const router = express.Router();
const {
  getSettings,
  updateSettings,
  applyProductPriceAdjustment,
  applyRawMaterialPriceAdjustment,
  applyStationCategoryMapping,
  updateDeveloperLicense,
  createMenuReview,
  getMenuReviews,
  deleteMenuReview,
  registerCustomRole,
  deleteCustomRole,
  registerCustomDepartment,
  deleteCustomDepartment,
  registerCustomStation,
  deleteCustomStation,
} = require('../controllers/settingController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.route('/')
  .get(protect, getSettings)
  .put(protect, authorize('admin', 'manager', 'dev'), updateSettings);

router.post('/custom-roles', protect, authorize('admin', 'dev'), registerCustomRole);
router.delete('/custom-roles/:key', protect, authorize('admin', 'dev'), deleteCustomRole);
router.post('/custom-departments', protect, authorize('admin', 'dev'), registerCustomDepartment);
router.delete('/custom-departments/:key', protect, authorize('admin', 'dev'), deleteCustomDepartment);
router.post('/custom-stations', protect, authorize('admin', 'dev'), registerCustomStation);
router.delete('/custom-stations/:key', protect, authorize('admin', 'dev'), deleteCustomStation);

router.put('/developer-license', protect, updateDeveloperLicense);
router.post('/apply-product-price-adjustment', protect, authorize('admin', 'dev'), applyProductPriceAdjustment);
router.post('/apply-raw-material-price-adjustment', protect, authorize('admin', 'dev'), applyRawMaterialPriceAdjustment);
router.post('/apply-station-category-mapping', protect, authorize('admin', 'manager', 'dev'), applyStationCategoryMapping);

// Customer Digital Menu Ratings & Reviews
router.post('/menu-reviews', createMenuReview); // Public submission
router.get('/menu-reviews', getMenuReviews); // Public & Private
router.delete('/menu-reviews/:id', protect, authorize('admin', 'manager', 'dev'), deleteMenuReview);

module.exports = router;
