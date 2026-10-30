const express = require("express");
const router = express.Router();
const { protect, verifyModuleLicense } = require("../middleware/authMiddleware");
const {
  createCaptainOrder,
  createCustomerOrder,
  callWaiter,
  trackCustomerOrder,
  getTableOrdersHistory,
  getCaptainOrders,
  getCaptainOrderById,
  updateCaptainOrder,
  sendToKitchen,
  voidCaptainOrder,
  getActiveTables,
} = require("../controllers/captainOrderController");

// Public Customer Self-Ordering & Waiter Calling endpoints (No auth required)
router.post("/customer-order", createCustomerOrder);
router.post("/call-waiter",    callWaiter);
router.get("/track/:orderNo",  trackCustomerOrder);
router.get("/table-history",   getTableOrdersHistory);

router.use(protect);
router.use(verifyModuleLicense('subsystem'));

router.get("/active-tables", getActiveTables);
router.route("/").get(getCaptainOrders).post(createCaptainOrder);
router.route("/:id").get(getCaptainOrderById).patch(updateCaptainOrder);
router.post("/:id/send-to-kitchen", sendToKitchen);
router.post("/:id/void", voidCaptainOrder);
module.exports = router;
