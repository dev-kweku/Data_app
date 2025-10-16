    import { Request, Response, NextFunction } from "express";
    import { PrismaClient, TrxnType, TrxnStatus } from "@prisma/client";
    import { AppError } from "../utils/errors";
    import {
    debitWallet,
    getWalletBalance,
    getOrCreateWallet,
    } from "../services/walletService";
    import { computeVendorCost } from "../utils/vendorCost";
    import {
    createTransaction,
    listTransactionsForUser,
    } from "../services/transactionService";
    import {
    tppAirtimeTopup,
    tppDataBundle,
    sendTPPSms,
    tppGetDataBundleList,
    } from "../services/tppClient";

    const prisma = new PrismaClient();
    const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
    if (!ADMIN_USER_ID) throw new Error("ADMIN_USERID environment variable not set");
    const ADMIN_USER_ID_STRING = ADMIN_USER_ID as string;

    // --- Helpers ---
    function toNumber(value: any): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    if (typeof value.toNumber === "function") return value.toNumber();
    return Number(value);
    }

    function getStatusCode(apiResp: any): string {
    return apiResp?.["status-code"] ?? apiResp?.status_code ?? apiResp?.statusCode ?? "99";
    }

    async function processTransactionCompletion(
    transactionRef: string,
    vendorId: string,
    vendorPays: number,
    baseAmount: number,
    commission: number,
    vendorEmail: string,
    transactionType: TrxnType,
    phoneNumber: string,
    networkId: number,
    planId?: string,
    success: boolean = false
    ) {
    await prisma.$transaction(async (tx) => {
        await tx.transaction.update({
        where: { trxnRef: transactionRef },
        data: { status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED },
        });

        if (success) {
        await tx.wallet.update({
            where: { userId: vendorId },
            data: { balance: { decrement: vendorPays } },
        });

        const note = planId
            ? `Vendor ${vendorEmail} sold data bundle ${planId}`
            : `Vendor ${vendorEmail} sold airtime`;

        await tx.transaction.create({
            data: {
            trxnRef: `admin_ref_${transactionRef}_${Date.now()}`,
            userId: ADMIN_USER_ID_STRING,
            type: transactionType,
            amount: baseAmount,
            commission,
            status: TrxnStatus.SUCCESS,
            recipient: phoneNumber,
            networkId,
            bundlePlanId: planId,
            apiResponse: { note },
            },
        });
        }
    });
    }

    // --- Controllers ---

    export async function buyAirtime(req: Request, res: Response, next: NextFunction) {
    try {
        const vendor = (req as any).user;
        if (!vendor || vendor.role !== "VENDOR") throw new AppError("Vendor access only", 403);

        const { networkId, phoneNumber, amount } = req.body;
        if (!networkId || !phoneNumber || !amount)
        throw new AppError("networkId, phoneNumber, and amount are required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);
        if (!/^\d+$/.test(phoneNumber)) throw new AppError("Invalid phone number format", 400);

        const { vendorPays, commission } = await computeVendorCost(vendor.id, baseAmount);
        const wallet = await getOrCreateWallet(vendor.id);
        if (toNumber(wallet.balance) < vendorPays)
        throw new AppError(
            `Insufficient wallet balance. Required: ${vendorPays}, Available: ${wallet.balance}`,
            400
        );

        const trx = await createTransaction({
        userId: vendor.id,
        type: TrxnType.AIRTIME,
        amount: baseAmount,
        commission,
        recipient: phoneNumber,
        networkId,
        status: TrxnStatus.PENDING,
        });

        let apiResp: any;
        let success = false;

        try {
        apiResp = await tppAirtimeTopup({
            network: networkId,
            recipient: phoneNumber,
            amount: baseAmount,
            trxn: trx.trxnRef,
        });

        const statusCode = getStatusCode(apiResp);
        success = statusCode === "00";

        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: { apiResponse: apiResp },
        });

        await processTransactionCompletion(
            trx.trxnRef,
            vendor.id,
            vendorPays,
            baseAmount,
            commission,
            vendor.email,
            TrxnType.AIRTIME,
            phoneNumber,
            networkId,
            undefined,
            success
        );
        } catch (apiError: any) {
        console.error("TPP Airtime API Error:", apiError);
        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: { status: TrxnStatus.FAILED, apiResponse: { error: apiError.message } },
        });
        throw new AppError("Service temporarily unavailable", 503);
        }

        if (success) {
        const msg = `Airtime top-up successful! ${phoneNumber} credited with GHS ${baseAmount.toFixed(
            2
        )}. New balance: GHS ${apiResp.balance_after ?? "N/A"}.`;
        try {
            await sendTPPSms(phoneNumber, msg, "DataApp");
        } catch (smsErr) {
            console.error("SMS sending failed:", smsErr);
        }
        }

        return res.status(success ? 200 : 400).json({
        message: success ? "Airtime purchase successful" : "Airtime purchase failed",
        trxnRef: trx.trxnRef,
        status: success ? "SUCCESS" : "FAILED",
        statusCode: getStatusCode(apiResp),
        apiResponse: apiResp,
        });
    } catch (err) {
        console.error("buyAirtime error:", err);
        return next(err);
    }
    }

    export async function buyDataBundle(req: Request, res: Response, next: NextFunction) {
    try {
        const vendor = (req as any).user;
        if (!vendor || vendor.role !== "VENDOR") throw new AppError("Vendor access only", 403);

        const { networkId, phoneNumber, planId, amount } = req.body;
        if (!networkId || !phoneNumber || !planId || !amount)
        throw new AppError("networkId, phoneNumber, planId and amount required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);
        if (!/^\d+$/.test(phoneNumber)) throw new AppError("Invalid phone number format", 400);

        const { vendorPays, commission } = await computeVendorCost(vendor.id, baseAmount);
        const wallet = await getOrCreateWallet(vendor.id);
        if (toNumber(wallet.balance) < vendorPays)
        throw new AppError(
            `Insufficient wallet balance. Required: ${vendorPays}, Available: ${wallet.balance}`,
            400
        );

        const trx = await createTransaction({
        userId: vendor.id,
        type: TrxnType.DATABUNDLE,
        amount: baseAmount,
        commission,
        recipient: phoneNumber,
        networkId,
        bundlePlanId: planId,
        status: TrxnStatus.PENDING,
        });

        let apiResp: any;
        let success = false;

        try {
        apiResp = await tppDataBundle({
            network: networkId,
            recipient: phoneNumber,
            data_code: planId,
            trxn: trx.trxnRef,
        });

        const statusCode = getStatusCode(apiResp);
        success = statusCode === "00";

        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: { apiResponse: apiResp },
        });

        await processTransactionCompletion(
            trx.trxnRef,
            vendor.id,
            vendorPays,
            baseAmount,
            commission,
            vendor.email,
            TrxnType.DATABUNDLE,
            phoneNumber,
            networkId,
            planId,
            success
        );
        } catch (apiError: any) {
        console.error("TPP Data API Error:", apiError);
        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: { status: TrxnStatus.FAILED, apiResponse: { error: apiError.message } },
        });
        throw new AppError("Service temporarily unavailable", 503);
        }

        if (success) {
        const msg = `Data bundle purchase successful! Plan ${planId} for ${phoneNumber}, costing GHS ${baseAmount.toFixed(
            2
        )}.`;
        try {
            await sendTPPSms(phoneNumber, msg, "DataApp");
        } catch (smsErr) {
            console.error("SMS sending failed:", smsErr);
        }
        }

        return res.status(success ? 200 : 400).json({
        message: success ? "Data bundle purchase successful" : "Data bundle purchase failed",
        trxnRef: trx.trxnRef,
        status: success ? "SUCCESS" : "FAILED",
        statusCode: getStatusCode(apiResp),
        apiResponse: apiResp,
        });
    } catch (err) {
        console.error("buyDataBundle error:", err);
        return next(err);
    }
    }

    export async function getWalletBalanceHandler(req: Request, res: Response, next: NextFunction) {
    try {
        const vendor = (req as any).user;
        if (!vendor || vendor.role !== "VENDOR") throw new AppError("Vendor access only", 403);

        const balance = await getWalletBalance(vendor.id);
        return res.json({ balance: toNumber(balance), currency: "GHS" });
    } catch (err) {
        return next(err);
    }
    }

    export async function getMyTransactions(req: Request, res: Response, next: NextFunction) {
    try {
        const vendor = (req as any).user;
        if (!vendor || vendor.role !== "VENDOR") throw new AppError("Vendor access only", 403);

        const limit = Math.min(100, Number(req.query.limit) || 20);
        const page = Math.max(1, Number(req.query.page) || 1);

        const transactions = await listTransactionsForUser(vendor.id, limit);
        return res.json({
        transactions: transactions.map((t) => ({
            id: t.id,
            trxnRef: t.trxnRef,
            type: t.type,
            amount: toNumber(t.amount),
            commission: toNumber(t.commission),
            status: t.status,
            recipient: t.recipient,
            networkId: t.networkId,
            bundlePlanId: t.bundlePlanId,
            createdAt: t.createdAt,
        })),
        pagination: { page, limit, hasMore: transactions.length === limit },
        });
    } catch (err) {
        return next(err);
    }
    }


    // export async function getDataBundleList(req: Request, res: Response, next: NextFunction) {
    //     try {
    //         const vendor = (req as any).user;
    //         if (!vendor || vendor.role !== "VENDOR") throw new AppError("Vendor access only", 403);
        
    //         const networkId = Number(req.query.networkId);
    //         if (!networkId || isNaN(networkId)) {
    //             throw new AppError("networkId query parameter must be a number", 400);
    //         }
        
    //         const bundles = await tppGetDataBundleList(networkId);
        
    //         return res.status(200).json({ networkId, bundles });
    //         } catch (err) {
    //         console.error("getDataBundleList error:", err);
    //         return next(err);
    //         }
    //     }


    export async function getDataBundleList(req: Request, res: Response, next: NextFunction) {
        try {
            const vendor = (req as any).user;
            if (!vendor || vendor.role !== "VENDOR")
                throw new AppError("Vendor access only", 403);
    
            const networkId = Number(req.query.networkId);
            if (!networkId || isNaN(networkId)) {
                throw new AppError("networkId query parameter must be a number", 400);
            }
    
            let bundles: any[] = [];
            try {
                const tppBundles = await tppGetDataBundleList(networkId);
                if (Array.isArray(tppBundles)) bundles = tppBundles;
            } catch (tppErr) {
                console.error("TPP getDataBundleList failed:", tppErr);
                bundles = []; // fallback empty array
            }
    
            return res.status(200).json({ networkId, bundles });
        } catch (err) {
            console.error("getDataBundleList error:", err);
            return next(err);
        }
    }
    
        
