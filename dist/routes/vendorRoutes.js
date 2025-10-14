"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const vendorController_1 = require("../controllers/vendorController");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, auth_1.requireVendor);
router.post("/airtime", vendorController_1.buyAirtime);
router.post("/databundle", vendorController_1.buyDataBundle);
router.get("/wallet", vendorController_1.getWalletBalanceHandler);
router.get("/transactions", vendorController_1.getMyTransactions);
exports.default = router;
//# sourceMappingURL=vendorRoutes.js.map