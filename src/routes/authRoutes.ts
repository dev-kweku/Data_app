
import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import { register, login, getProfile } from "../controllers/authController";
import { listVendors } from "../controllers/adminController";

const router = Router();


router.post("/register", register);  
router.post("/login", login);


router.get("/profile", authenticate, getProfile); 


router.get("/admin/vendors", authenticate, requireAdmin, listVendors); // 👨‍💼 Admin: list all vendors

export default router;
