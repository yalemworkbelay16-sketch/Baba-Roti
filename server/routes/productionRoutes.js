const express = require('express');
const router = express.Router();
const {
  getProductionRecipes,
  getProductionRecipeById,
  createProductionRecipe,
  updateProductionRecipe,
  deleteProductionRecipe,
  calculateBatchRequirements,
  produceBatch,
  getProductionBatches,
  getProductionBatchById,
  voidProductionBatch,
  getProducedMaterials,
} = require('../controllers/productionController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/recipes', getProductionRecipes);
router.post('/recipes', createProductionRecipe);
router.get('/recipes/:id', getProductionRecipeById);
router.put('/recipes/:id', updateProductionRecipe);
router.delete('/recipes/:id', deleteProductionRecipe);

router.post('/calculate-requirements', calculateBatchRequirements);
router.post('/produce-batch', produceBatch);

router.get('/batches', getProductionBatches);
router.get('/batches/:id', getProductionBatchById);
router.post('/batches/:id/void', voidProductionBatch);

router.get('/produced-materials', getProducedMaterials);

module.exports = router;
