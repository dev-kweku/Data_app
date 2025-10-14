"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireAdmin);
router.post("/vendors", adminController_1.createVendor);
router.get("/vendors", adminController_1.listVendors);
router.get("/vendors/:vendorId", adminController_1.getVendor);
router.post("/vendors/:vendorId/fund", adminController_1.fundVendor);
router.get("/wallet/:userId", adminController_1.getWallet);
router.get('/tpp/balance', adminController_1.getTPPBalanceHandler);
router.get("/transactions", adminController_1.listTransactions);
router.post("/vendors/:vendorId/commission", adminController_1.setCommission);
router.get("/vendors/:vendorId/commission", adminController_1.getCommission);
exports.default = router;
//# sourceMappingURL=adminRoutes.js.map