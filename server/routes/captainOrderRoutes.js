const express = require("express");
const router = express.Router();
const { protect, verifyModuleLicense } = require("../middleware/authMiddleware");
const {
  streamOrderEvents,
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
  approveCustomerOrder,
  rejectCustomerOrder,
} = require("../controllers/captainOrderController");

// Public Live SSE Stream & Customer Self-Ordering endpoints
router.get("/stream",          streamOrderEvents);
router.post("/customer-order", createCustomerOrder);
router.post("/call-waiter",    callWaiter);
router.get("/track/:orderNo",  trackCustomerOrder);
router.get("/table-history",   getTableOrdersHistory);

router.use(protect);
router.use(verifyModuleLicense('subsystem'));

router.get("/active-tables", getActiveTables);
router.route("/").get(getCaptainOrders).post(createCaptainOrder);
router.route("/:id").get(getCaptainOrderById).patch(updateCaptainOrder);
router.post("/:id/approve-order", approveCustomerOrder);
router.post("/:id/reject-order", rejectCustomerOrder);
router.post("/:id/send-to-kitchen", sendToKitchen);
router.post("/:id/void", voidCaptainOrder);
module.exports = router;
