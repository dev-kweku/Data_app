"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const authController_1 = require("../controllers/authController");
const adminController_1 = require("../controllers/adminController");
const router = (0, express_1.Router)();
router.post("/register", authController_1.register);
router.post("/login", authController_1.login);
router.get("/profile", auth_1.authenticate, authController_1.getProfile);
router.get("/admin/vendors", auth_1.authenticate, auth_1.requireAdmin, adminController_1.listVendors); // 👨‍💼 Admin: list all vendors
exports.default = router;
//# sourceMappingURL=authRoutes.js.map