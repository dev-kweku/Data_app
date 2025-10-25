    import { Request, Response, NextFunction } from "express";
    import { PrismaClient, TrxnStatus, TrxnType } from "@prisma/client";
    import { AppError } from "../utils/errors";
    import {
    tppAirtimeTopup,
    tppDataBundle,
    tppCollectMoMo,
    tppTransactionStatus,
    sendTPPSms,
    } from "../services/tppClient";

    const prisma = new PrismaClient();

    /** Helpers */
    function toNumber(val: any): number {
    if (val == null) return 0;
    if (typeof val === "number") return val;
    if (typeof val.toNumber === "function") return val.toNumber();
    return Number(val);
    }

    function getStatusCode(apiResp: any): string {
    return (
        apiResp?.["status-code"] ??
        apiResp?.status_code ??
        apiResp?.statusCode ??
        "99"
    );
    }

    /**
     * FUND WALLET VIA MOMO (C2B)
     */
    export async function fundWalletViaMomo(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { amount, customer, network } = req.body;
        if (!amount || !customer)
        throw new AppError("Amount and customer number required", 400);

        const trxn = `FUND_${Date.now()}_${user.id.slice(0, 6)}`;

        const apiResp = await tppCollectMoMo({
        customer,
        amount,
        trxn,
        network,
        });

        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";

        await prisma.transaction.create({
        data: {
            trxnRef: trxn,
            userId: user.id,
            type: TrxnType.FUND_TRANSFER,
            amount,
            recipient: customer,
            networkId: network ?? 0,
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.PENDING,
            apiResponse: apiResp,
        },
        });

        if (success) {
        await prisma.wallet.upsert({
            where: { userId: user.id },
            update: { balance: { increment: amount } },
            create: { userId: user.id, balance: amount },
        });
        }

        return res.status(success ? 200 : 202).json({
        message: success
            ? "Wallet funded successfully"
            : "Awaiting MOMO Confirmation",
        trxn,
        status: success ? "SUCCESS" : "PENDING",
        apiResponse: apiResp,
        });
    } catch (err: any) {
        console.error("FundWalletViaMomo error:", err.message);
        return next(err);
    }
    }

    /**
     * BUY AIRTIME VIA MOMO
     */
    export async function buyAirtimeViaMomo(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { phoneNumber, amount, network, customer } = req.body;
        if (!phoneNumber || !amount || !network || !customer)
        throw new AppError(
            "phoneNumber, amount, network and customer are required",
            400
        );

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0)
        throw new AppError("Invalid amount", 400);

        const fundTrxn = `AIRTIME_MOMO_${Date.now()}_${user.id.slice(0, 6)}`;

        // Step 1: Collect MoMo payment
        const momoResp = await tppCollectMoMo({
        customer,
        amount: baseAmount,
        trxn: fundTrxn,
        network,
        });

        const momoStatus = getStatusCode(momoResp);
        if (momoStatus !== "00") {
        throw new AppError("MoMo payment failed or pending confirmation", 400);
        }

        // Step 2: Proceed to buy airtime
        const trx = await prisma.transaction.create({
        data: {
            trxnRef: fundTrxn,
            userId: user.id,
            type: TrxnType.AIRTIME,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            status: TrxnStatus.PENDING,
        },
        });

        const apiResp = await tppAirtimeTopup({
        network,
        recipient: phoneNumber,
        amount: baseAmount,
        trxn: trx.trxnRef,
        });

        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";

        await prisma.transaction.update({
        where: { trxnRef: trx.trxnRef },
        data: {
            apiResponse: apiResp,
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED,
        },
        });

        if (success) {
        try {
            await sendTPPSms(
            phoneNumber,
            `Airtime purchase of ${baseAmount} sent to ${phoneNumber}`,
            "DataApp"
            );
        } catch (smsErr) {
            console.error("SMS send failed:", smsErr);
        }
        }

        return res.status(success ? 200 : 400).json({
        message: success
            ? "Airtime purchase successful"
            : "Airtime purchase failed",
        trxnRef: trx.trxnRef,
        status: success ? "SUCCESS" : "FAILED",
        momoResponse: momoResp,
        apiResponse: apiResp,
        });
    } catch (err: any) {
        console.error("buyAirtimeViaMomo error:", err);
        return next(err);
    }
    }

    /**
     * BUY DATA VIA MOMO
     */
    export async function buyDataViaMomo(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { phoneNumber, planId, amount, network, customer } = req.body;
        if (!phoneNumber || !planId || !amount || !network || !customer)
        throw new AppError(
            "phoneNumber, planId, amount, network, and customer required",
            400
        );

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0)
        throw new AppError("Invalid amount", 400);

        const fundTrxn = `DATA_MOMO_${Date.now()}_${user.id.slice(0, 6)}`;

        // Step 1 — Collect MoMo payment
        const momoResp = await tppCollectMoMo({
        customer,
        amount: baseAmount,
        trxn: fundTrxn,
        network,
        });

        const momoStatus = getStatusCode(momoResp);
        if (momoStatus !== "00") {
        throw new AppError("MoMo payment failed or pending confirmation", 400);
        }

        // Step 2 — Perform data bundle purchase
        const trx = await prisma.transaction.create({
        data: {
            trxnRef: fundTrxn,
            userId: user.id,
            type: TrxnType.DATABUNDLE,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            bundlePlanId: planId,
            status: TrxnStatus.PENDING,
        },
        });

        const apiResp = await tppDataBundle({
        network,
        recipient: phoneNumber,
        data_code: planId,
        trxn: trx.trxnRef,
        });

        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";

        await prisma.transaction.update({
        where: { trxnRef: trx.trxnRef },
        data: {
            apiResponse: apiResp,
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED,
        },
        });

        if (success) {
        try {
            await sendTPPSms(
            phoneNumber,
            `Data purchase successful! Plan ${planId} activated for ${phoneNumber}.`,
            "DataApp"
            );
        } catch (smsErr) {
            console.error("SMS send failed:", smsErr);
        }
        }

        return res.status(success ? 200 : 400).json({
        message: success
            ? "Data bundle purchase successful"
            : "Data purchase failed",
        trxnRef: trx.trxnRef,
        status: success ? "SUCCESS" : "FAILED",
        momoResponse: momoResp,
        apiResponse: apiResp,
        });
    } catch (err) {
        console.error("buyDataViaMomo error:", err);
        return next(err);
    }
    }

    /**
     * GET USER WALLET BALANCE
     */
    export async function Userwallet(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const user = (req as any).user;
        const wallet = await prisma.wallet.findUnique({
        where: { userId: user.id },
        });
        res.json({ balance: wallet?.balance || 0 });
    } catch (err: any) {
        next(err);
    }
    }

    /**
     * VERIFY WALLET FUNDING STATUS
     */
    export async function verifyWalletFunding(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Authentication required", 401);

        const { trxn } = req.params;
        if (!trxn) throw new AppError("Transaction reference is required", 400);

        const transaction = await prisma.transaction.findUnique({
        where: { trxnRef: trxn },
        });
        if (!transaction) throw new AppError("Transaction not found", 404);

        if (transaction.status === TrxnStatus.SUCCESS) {
        return res.status(200).json({
            message: "Wallet funding already successful",
            status: "SUCCESS",
        });
        }

        const tppResp = await tppTransactionStatus(trxn);
        const statusCode = getStatusCode(tppResp);
        const success = statusCode === "00";

        await prisma.transaction.update({
        where: { trxnRef: trxn },
        data: {
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED,
            apiResponse: tppResp,
        },
        });

        if (success) {
        await prisma.wallet.upsert({
            where: { userId: user.id },
            update: { balance: { increment: transaction.amount } },
            create: { userId: user.id, balance: transaction.amount },
        });
        }

        return res.status(success ? 200 : 400).json({
        message: success
            ? "Wallet funding verified successfully"
            : "Wallet funding verification failed",
        status: success ? "SUCCESS" : "FAILED",
        apiResponse: tppResp,
        });
    } catch (err: any) {
        console.error("VerifyWalletFunding error:", err.message);
        next(err);
    }
    }

    /**
     * LIST USER TRANSACTIONS
     */
    export async function getUserTransactions(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
    try {
        const user = (req as any).user;
        const transactions = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        });
        res.json({ transactions });
    } catch (err: any) {
        next(err);
    }
    }
