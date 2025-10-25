import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
    fundWalletViaMomo,
    verifyWalletFunding,
    getWalletBalance,
    buyAirtimeViaMomo,
    buyDataViaMomo,
    buyAirtimeViaWallet,
    buyDataViaWallet,
    getUserTransactions,
} from "../controllers/userController";

const router = Router();

router.use(authenticate);

router.post("/wallet/fund", fundWalletViaMomo); // Initiate MoMo funding
router.get("/wallet/verify/:trxn", verifyWalletFunding); // Verify funding status
router.get("/wallet/balance", getWalletBalance); // Get current wallet balance

router.post("/wallet/airtime", buyAirtimeViaWallet); // Buy airtime using wallet
router.post("/wallet/data", buyDataViaWallet); // Buy data using wallet

router.post("/momo/airtime", buyAirtimeViaMomo); // Buy airtime via MoMo
router.post("/momo/data", buyDataViaMomo); // Buy data via MoMo

router.get("/transactions", getUserTransactions); // View user's recent transactions

export default router;
