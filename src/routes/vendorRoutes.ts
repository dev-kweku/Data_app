import { Router } from "express";
import { authenticate, requireVendor } from "../middleware/auth";
import {
  buyAirtime,
  buyDataBundle,
  getWalletBalanceHandler,
  getMyTransactions,
  getDataBundleList,
} from "../controllers/vendorController";

const router = Router();


router.use(authenticate, requireVendor);


router.post("/airtime", buyAirtime);


router.post("/data-bundle", buyDataBundle);


router.get("/data-bundles", getDataBundleList);


router.get("/wallet", getWalletBalanceHandler);


router.get("/transactions", getMyTransactions);

export default router;
