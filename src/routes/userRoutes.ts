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
    sendOtp,
    verifyOtp,
    resetOtp
} from "../controllers/userController";

const router = Router();

router.post("/user/auth/send-otp",sendOtp)
router.post("/user/auth/verify-otp",verifyOtp)
router.post("/user/auth/reset-otp",resetOtp)

router.use(authenticate);

/***
 * TODO :UPDATE THE AUTH MIDDLEWARE TO USE OTP INSTEAD OF EMAIL/PASSWORD
 */


router.post("/user/wallet/fund", fundWalletViaMomo); // Initiate MoMo funding
router.get("/user/wallet/verify/:trxn", verifyWalletFunding); // Verify funding status
router.get("/user/wallet/balance", getWalletBalance); // Get current wallet balance

router.post("/user/wallet/airtime", buyAirtimeViaWallet); // Buy airtime using wallet
router.post("/user/wallet/data", buyDataViaWallet); // Buy data using wallet

router.post("/user/momo/airtime", buyAirtimeViaMomo); // Buy airtime via MoMo
router.post("/user/momo/data", buyDataViaMomo); // Buy data via MoMo

router.get("/user/transactions", getUserTransactions); // View user's recent transactions

export default router;
