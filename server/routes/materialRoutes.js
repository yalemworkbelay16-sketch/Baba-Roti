const express = require('express');
const multer = require('multer');
const router = express.Router();
const {
  getMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial,
  deleteMaterial,
  bulkDeleteMaterials,
  restoreMaterial,
  permanentDeleteMaterial,
  exportMaterialsExcel,
  exportMaterialTemplate,
  importMaterialsExcel,
} = require('../controllers/materialController');
const { protect, authorize } = require('../middleware/authMiddleware');

const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// Excel import/export/template (before /:id to avoid conflict)
router.get('/export/excel', authorize('admin', 'manager'), exportMaterialsExcel);
router.get('/template/excel', authorize('admin', 'manager', 'storekeeper', 'supervisor'), exportMaterialTemplate);
router.post('/import/excel', authorize('admin', 'manager'), upload.single('file'), importMaterialsExcel);

// Bulk + restore (before /:id)
router.delete('/bulk',          authorize('admin', 'manager'), bulkDeleteMaterials);
router.post('/:id/restore',     authorize('admin', 'manager'), restoreMaterial);
router.delete('/:id/permanent', authorize('admin'), permanentDeleteMaterial);

router.get('/', getMaterials);
router.get('/:id', getMaterialById);
router.post('/', authorize('admin', 'manager'), createMaterial);
router.put('/:id', authorize('admin', 'manager'), updateMaterial);
router.delete('/:id', authorize('admin'), deleteMaterial);

module.exports = router;
