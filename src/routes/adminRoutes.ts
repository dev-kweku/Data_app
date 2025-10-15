
import { Router } from "express";
import { authenticate, requireAdmin } from "../middleware/auth";
import {
  register,
  createVendor,
  listVendors,
  getVendor,
  fundVendor,
  listTransactions,
  getWallet,
  setCommission,
  getCommission,
  getTPPBalanceHandler
} from "../controllers/adminController";

const router = Router();


router.use(authenticate, requireAdmin);

router.post("/register",register)
router.post("/vendors", createVendor);              
router.get("/vendors", listVendors);                
router.get("/vendors/:vendorId", getVendor);        


router.post("/vendors/:vendorId/fund", fundVendor); 
router.get("/wallet/:userId", getWallet);    

router.get('/tpp/balance',getTPPBalanceHandler)


router.get("/transactions", listTransactions);      


router.post("/vendors/:vendorId/commission", setCommission); 
router.get("/vendors/:vendorId/commission",getCommission)

export default router;
