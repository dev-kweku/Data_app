
import { Router } from "express";
import { authenticate, requireVendor } from "../middleware/auth";
import {
  buyAirtime,
  buyDataBundle,
  getWalletBalanceHandler,
  getMyTransactions,
} from "../controllers/vendorController";

const router = Router();


router.use(authenticate, requireVendor);


router.post("/airtime", buyAirtime);         
router.post("/databundle", buyDataBundle);   


router.get("/wallet", getWalletBalanceHandler); 


router.get("/transactions", getMyTransactions);

export default router;
