const express = require('express');
const router  = express.Router();
const {
  getConsumptions,
  getConsumptionById,
  createConsumption,
  updateConsumption,
  approveConsumption,
  voidConsumption,
  deleteConsumption,
  getConsumptionSummary,
} = require('../controllers/consumptionController');
const { protect, authorize, authorizePermission } = require('../middleware/authMiddleware');

router.use(protect);

router.get('/summary', getConsumptionSummary);
router.get('/',        getConsumptions);
router.get('/:id',     getConsumptionById);

router.post('/',              createConsumption);
router.put('/:id',            updateConsumption);
router.post('/:id/approve',   authorizePermission('approveGoods'), approveConsumption);
router.post('/:id/void',      authorizePermission('voidTransactions'), voidConsumption);
router.delete('/:id',         authorizePermission('voidTransactions'), deleteConsumption);

module.exports = router;
