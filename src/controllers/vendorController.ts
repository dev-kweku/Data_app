
    import { Request, Response, NextFunction } from "express";
    import { PrismaClient } from "@prisma/client";
    import { AppError } from "../utils/errors";
    import {
    debitWallet,
    getWalletBalance,
    getOrCreateWallet,
    } from "../services/walletService";
    import { computeVendorCost } from "../utils/vendorCost"
    import {
    createTransaction,
    listTransactionsForUser,
    } from "../services/transactionService";
    import { tppAirtimeTopup, tppDataBundle,sendTPPSms} from "../services/tppClient";

    const prisma = new PrismaClient();

    // Helper: safely convert Decimal or unknown to number
    function toNumber(value: any): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    if (typeof value.toNumber === "function") return value.toNumber();
    return Number(value);
    }

    
    export async function buyAirtime(req: Request, res: Response, next: NextFunction) {
        try {
            const vendor = (req as any).user;
            if (!vendor || vendor.role !== "VENDOR")
                throw new AppError("Vendor access only", 403);
        
            const { networkId, phoneNumber, amount } = req.body;
            if (!networkId || !phoneNumber || !amount)
                throw new AppError("networkId, phoneNumber and amount required", 400);
        
            const baseAmount = Number(amount);
            if (isNaN(baseAmount) || baseAmount <= 0)
                throw new AppError("Invalid amount", 400);
        
            const { vendorPays, commission } = await computeVendorCost(vendor.id, baseAmount);
            const wallet = await getOrCreateWallet(vendor.id);
            if (toNumber(wallet.balance) < vendorPays)
                throw new AppError("Insufficient wallet balance", 400);
        
            await debitWallet(vendor.id, vendorPays);
        
            const trx = await createTransaction({
                userId: vendor.id,
                type: "AIRTIME",
                amount: baseAmount,
                commission,
                recipient: phoneNumber,
                networkId,
                status: "PENDING",
            });
        
            const apiResp = await tppAirtimeTopup({
                network: networkId,
                recipient: phoneNumber,
                amount: baseAmount,
                trxn: trx.trxnRef,
            });
        
            const statusCode = apiResp["status-code"] ?? apiResp["status_code"] ?? apiResp["statusCode"];
            const success = statusCode === "00";
        
            await prisma.transaction.update({
                where: { trxnRef: trx.trxnRef },
                data: {
                status: success ? "SUCCESS" : "PENDING",
                apiResponse: apiResp,
                },
            });
        
            //  Send confirmation SMS if successful
            if (success) {
                const msg = ` Airtime top-up successful!
        You have recharged ${phoneNumber} with GHS ${baseAmount.toFixed(2)}.
        Your new balance: GHS ${apiResp.balance_after ?? "N/A"}.`;
                await sendTPPSms(phoneNumber, msg, "DataApp");
            }
        
            res.json({
                message: "Airtime purchase initiated",
                trxnRef: trx.trxnRef,
                status: success ? "SUCCESS" : "PENDING",
            });
            } catch (err) {
            next(err);
            }
        }
        
        /**
         * Vendor: Purchase Data Bundle + Auto SMS
         */
        export async function buyDataBundle(req: Request, res: Response, next: NextFunction) {
            try {
            const vendor = (req as any).user;
            if (!vendor || vendor.role !== "VENDOR")
                throw new AppError("Vendor access only", 403);
        
            const { networkId, phoneNumber, planId, amount } = req.body;
            if (!networkId || !phoneNumber || !planId || !amount)
                throw new AppError("networkId, phoneNumber, planId and amount required", 400);
        
            const baseAmount = Number(amount);
            if (isNaN(baseAmount) || baseAmount <= 0)
                throw new AppError("Invalid amount", 400);
        
            const { vendorPays, commission } = await computeVendorCost(vendor.id, baseAmount);
            const wallet = await getOrCreateWallet(vendor.id);
            if (toNumber(wallet.balance) < vendorPays)
                throw new AppError("Insufficient wallet balance", 400);
        
            await debitWallet(vendor.id, vendorPays);
        
            const trx = await createTransaction({
                userId: vendor.id,
                type: "DATABUNDLE",
                amount: baseAmount,
                commission,
                recipient: phoneNumber,
                networkId,
                bundlePlanId: planId,
                status: "PENDING",
            });
        
            const apiResp = await tppDataBundle({
                network: networkId,
                recipient: phoneNumber,
                data_code: planId,
                amount: baseAmount,
                trxn: trx.trxnRef,
            });
        
            const statusCode = apiResp["status-code"] ?? apiResp["status_code"] ?? apiResp["statusCode"];
            const success = statusCode === "00";
        
            await prisma.transaction.update({
                where: { trxnRef: trx.trxnRef },
                data: {
                status: success ? "SUCCESS" : "PENDING",
                apiResponse: apiResp,
                },
            });
        
            //  Send confirmation SMS if successful
            if (success) {
                const msg = ` Data bundle purchase successful!
        You bought a data plan (${planId}) for ${phoneNumber} costing GHS ${baseAmount.toFixed(2)}.
        Your new balance: GHS ${apiResp.balance_after ?? "N/A"}.`;
                await sendTPPSms(phoneNumber, msg, "DataApp");
            }
        
            res.json({
                message: "Data bundle purchase initiated",
                trxnRef: trx.trxnRef,
                status: success ? "SUCCESS" : "PENDING",
            });
            } catch (err) {
            next(err);
            }
        }
    /**
     *  Vendor: Get Wallet Balance
     */
    export async function getWalletBalanceHandler(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const vendor = (req as any).user;
        if (!vendor || vendor.role !== "VENDOR")
        throw new AppError("Vendor access only", 403);

        const balance = await getWalletBalance(vendor.id);
        res.json({ balance: toNumber(balance) });
    } catch (err) {
        next(err);
    }
    }

    /**
     *  Vendor: View Transaction History
     */
    export async function getMyTransactions(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const vendor = (req as any).user;
        if (!vendor || vendor.role !== "VENDOR")
        throw new AppError("Vendor access only", 403);

        const limit = Math.min(100, Number(req.query.limit) || 20);
        const transactions = await listTransactionsForUser(vendor.id, limit);

        res.json({
        transactions: transactions.map((t) => ({
            id: t.id,
            trxnRef: t.trxnRef,
            type: t.type,
            amount: toNumber(t.amount),
            commission: toNumber(t.commission),
            status: t.status,
            createdAt: t.createdAt,
        })),
        });
    } catch (err) {
        next(err);
    }
    }
