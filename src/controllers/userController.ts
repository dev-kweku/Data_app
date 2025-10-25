    import { Request, Response, NextFunction } from "express";
    import { PrismaClient, Role, TrxnStatus, TrxnType } from "@prisma/client";
    import { AppError } from "../utils/errors";
    import {
    tppAirtimeTopup,
    tppDataBundle,
    tppCollectMoMo,
    tppTransactionStatus,
    sendTPPSms,
    } from "../services/tppClient";
    import bcrypt from "bcrypt"
    import jwt,{SignOptions} from "jsonwebtoken"

    const prisma = new PrismaClient();
    const JWT_SECRET:string=process.env.JWT_SECRET||"dev-secret";
    const JWT_EXPIRES_IN:string=process.env.JWT_EXPIRES_IN||"7d";

    function generateToken(user:{id:string;role:Role}){
        const options:SignOptions={expiresIn:JWT_EXPIRES_IN as any};
        return jwt.sign({id:user.id,role:user.role},JWT_SECRET,options)
    }

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


    export async function registerUser(req: Request, res: Response, next: NextFunction) {
        try {
            const { email, name, password } = req.body;
        
            if (!email || !name || !password) {
                throw new AppError("Email, name, and password are required", 400);
            }
        
            const existing = await prisma.user.findUnique({ where: { email } });
            if (existing) throw new AppError("Email already registered", 400);
        
            const passwordHash = await bcrypt.hash(password, 10);
        
            const user = await prisma.user.create({
                data: {
                email,
                name,
                passwordHash,
                role: Role.USER,
                },
            });
        
            await prisma.wallet.create({
                data: { userId: user.id, balance: 0 },
            });
        
            const token = generateToken(user);
        
            return res.status(201).json({
                message: "Registration successful",
                token,
                user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                },
            });
            } catch (err) {
            next(err);
            }
        }
        

        export async function loginUser(req: Request, res: Response, next: NextFunction) {
            try {
            const { email, password } = req.body;
        
            if (!email || !password) throw new AppError("Email and password required", 400);
        
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user) throw new AppError("Invalid credentials", 401);
        
            const validPassword = await bcrypt.compare(password, user.passwordHash);
            if (!validPassword) throw new AppError("Invalid credentials", 401);
        
            const token = generateToken(user);
        
            return res.json({
                message: "Login successful",
                token,
                user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                },
            });
            } catch (err) {
            next(err);
            }
        }
        

    /**
     * FUND WALLET VIA MOMO (C2B)
     */
    export async function fundWalletViaMomo(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { amount, customer, network } = req.body;
        if (!amount || !customer) throw new AppError("Amount and customer number required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);

        const trxnRef = `FUND_${Date.now()}_${user.id.slice(0, 6)}`;

        const apiResp = await tppCollectMoMo({ customer, amount: baseAmount, trxn: trxnRef, network });

        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";

        await prisma.transaction.create({
        data: {
            trxnRef,
            userId: user.id,
            type: TrxnType.FUND_TRANSFER,
            amount: baseAmount,
            recipient: customer,
            networkId: network ?? 0,
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.PENDING,
            apiResponse: apiResp,
        },
        });

        if (success) {
        await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.upsert({
            where: { userId: user.id },
            update: { balance: { increment: baseAmount } },
            create: { userId: user.id, balance: baseAmount },
            });

            await tx.walletTransaction.create({
            data: {
                userId: user.id,
                type: "CREDIT",
                amount: baseAmount,
                balanceAfter: toNumber(wallet.balance),
                metadata: JSON.stringify({ trxnRef, source: "MOMO_C2B" }),
            },
            });
        });
        }

        return res.status(success ? 200 : 202).json({
        message: success ? "Wallet funded successfully" : "Awaiting MOMO confirmation",
        trxnRef,
        status: success ? "SUCCESS" : "PENDING",
        apiResponse: apiResp,
        });
    } catch (err: any) {
        console.error("fundWalletViaMomo error:", err);
        return next(err);
    }
    }

    /**
     * BUY AIRTIME VIA MOMO
     */
    export async function buyAirtimeViaMomo(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { phoneNumber, amount, network, customer } = req.body;
        if (!phoneNumber || !amount || !network || !customer)
        throw new AppError("phoneNumber, amount, network and customer are required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);

        const trxnRef = `AIRTIME_MOMO_${Date.now()}_${user.id.slice(0, 6)}`;

        const momoResp = await tppCollectMoMo({ customer, amount: baseAmount, trxn: trxnRef, network });
        const momoStatus = getStatusCode(momoResp);
        if (momoStatus !== "00") throw new AppError("MoMo payment failed or pending", 400);

        const trx = await prisma.transaction.create({
        data: {
            trxnRef,
            userId: user.id,
            type: TrxnType.AIRTIME,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            status: TrxnStatus.PENDING,
            apiResponse: momoResp,
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
        data: { apiResponse: apiResp, status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED },
        });

        if (success) {
        await sendTPPSms(phoneNumber, `Airtime GHS ${baseAmount.toFixed(2)} sent to ${phoneNumber}`, "DataApp");
        }

        return res.status(success ? 200 : 400).json({
        message: success ? "Airtime purchase successful" : "Airtime purchase failed",
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
    export async function buyDataViaMomo(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { phoneNumber, planId, amount, network, customer } = req.body;
        if (!phoneNumber || !planId || !amount || !network || !customer)
        throw new AppError("phoneNumber, planId, amount, network, and customer required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);

        const trxnRef = `DATA_MOMO_${Date.now()}_${user.id.slice(0, 6)}`;

        const momoResp = await tppCollectMoMo({ customer, amount: baseAmount, trxn: trxnRef, network });
        const momoStatus = getStatusCode(momoResp);
        if (momoStatus !== "00") throw new AppError("MoMo payment failed or pending", 400);

        const trx = await prisma.transaction.create({
        data: {
            trxnRef,
            userId: user.id,
            type: TrxnType.DATABUNDLE,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            bundlePlanId: planId,
            status: TrxnStatus.PENDING,
            apiResponse: momoResp,
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
        data: { apiResponse: apiResp, status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED },
        });

        if (success) {
        await sendTPPSms(phoneNumber, `Data plan ${planId} activated for ${phoneNumber}`, "DataApp");
        }

        return res.status(success ? 200 : 400).json({
        message: success ? "Data purchase successful" : "Data purchase failed",
        trxnRef: trx.trxnRef,
        status: success ? "SUCCESS" : "FAILED",
        momoResponse: momoResp,
        apiResponse: apiResp,
        });
    } catch (err: any) {
        console.error("buyDataViaMomo error:", err);
        return next(err);
    }
    }

    /**
     * BUY AIRTIME VIA WALLET
     */
    export async function buyAirtimeViaWallet(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { phoneNumber, amount, network } = req.body;
        if (!phoneNumber || !amount || !network)
        throw new AppError("phoneNumber, amount, and network are required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);

        const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet || toNumber(wallet.balance) < baseAmount)
        throw new AppError("Insufficient wallet balance", 400);

        const trxnRef = `AIRTIME_WALLET_${Date.now()}_${user.id.slice(0, 6)}`;

        const apiResp = await tppAirtimeTopup({ network, recipient: phoneNumber, amount: baseAmount, trxn: trxnRef });
        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";

        await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
            data: {
            trxnRef,
            userId: user.id,
            type: TrxnType.AIRTIME,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED,
            apiResponse: apiResp,
            },
        });

        if (success) {
            const updatedWallet = await tx.wallet.update({
            where: { userId: user.id },
            data: { balance: { decrement: baseAmount } },
            });

            await tx.walletTransaction.create({
            data: {
                userId: user.id,
                type: "DEBIT",
                amount: baseAmount,
                balanceAfter: toNumber(updatedWallet.balance),
                metadata: JSON.stringify({ trxnRef }),
            },
            });
        }
        });

        return res.status(success ? 200 : 400).json({
        message: success ? "Airtime purchase successful" : "Airtime purchase failed",
        trxnRef,
        apiResponse: apiResp,
        });
    } catch (err: any) {
        console.error("buyAirtimeViaWallet error:", err);
        return next(err);
    }
    }

    /**
     * BUY DATA VIA WALLET
     */
    export async function buyDataViaWallet(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const { phoneNumber, planId, amount, network } = req.body;
        if (!phoneNumber || !planId || !amount || !network)
        throw new AppError("phoneNumber, planId, amount, and network are required", 400);

        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0) throw new AppError("Invalid amount", 400);

        const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
        if (!wallet || toNumber(wallet.balance) < baseAmount)
        throw new AppError("Insufficient wallet balance", 400);

        const trxnRef = `DATA_WALLET_${Date.now()}_${user.id.slice(0, 6)}`;

        const apiResp = await tppDataBundle({ network, recipient: phoneNumber, data_code: planId, trxn: trxnRef });
        const statusCode = getStatusCode(apiResp);
        const success = statusCode === "00";

        await prisma.$transaction(async (tx) => {
        await tx.transaction.create({
            data: {
            trxnRef,
            userId: user.id,
            type: TrxnType.DATABUNDLE,
            amount: baseAmount,
            recipient: phoneNumber,
            networkId: network,
            bundlePlanId: planId,
            status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED,
            apiResponse: apiResp,
            },
        });

        if (success) {
            const updatedWallet = await tx.wallet.update({
            where: { userId: user.id },
            data: { balance: { decrement: baseAmount } },
            });

            await tx.walletTransaction.create({
            data: {
                userId: user.id,
                type: "DEBIT",
                amount: baseAmount,
                balanceAfter: toNumber(updatedWallet.balance),
                metadata: JSON.stringify({ trxnRef }),
            },
            });
        }
        });

        return res.status(success ? 200 : 400).json({
        message: success ? "Data bundle purchase successful" : "Data purchase failed",
        trxnRef,
        apiResponse: apiResp,
        });
    } catch (err: any) {
        console.error("buyDataViaWallet error:", err);
        return next(err);
    }
    }

    /**
     * GET USER WALLET BALANCE
     */
    export async function getWalletBalance(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const wallet = await prisma.wallet.findUnique({ where: { userId: user.id } });
        return res.json({ balance: toNumber(wallet?.balance ?? 0) });
    } catch (err: any) {
        return next(err);
    }
    }

    /**
     * VERIFY WALLET FUNDING STATUS
     */
    export async function verifyWalletFunding(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Authentication required", 401);

        const { trxn } = req.params;
        if (!trxn) throw new AppError("Transaction reference is required", 400);

        const transaction = await prisma.transaction.findUnique({ where: { trxnRef: trxn } });
        if (!transaction) throw new AppError("Transaction not found", 404);

        if (transaction.status === TrxnStatus.SUCCESS) {
        return res.status(200).json({ message: "Wallet funding already successful", status: "SUCCESS" });
        }

        const tppResp = await tppTransactionStatus(trxn);
        const statusCode = getStatusCode(tppResp);
        const success = statusCode === "00";

        await prisma.transaction.update({
        where: { trxnRef: trxn },
        data: { status: success ? TrxnStatus.SUCCESS : TrxnStatus.FAILED, apiResponse: tppResp },
        });

        if (success) {
        await prisma.$transaction(async (tx) => {
            const wallet = await tx.wallet.upsert({
            where: { userId: user.id },
            update: { balance: { increment: toNumber(transaction.amount) } },
            create: { userId: user.id, balance: toNumber(transaction.amount) },
            });

            await tx.walletTransaction.create({
            data: {
                userId: user.id,
                type: "CREDIT",
                amount: toNumber(transaction.amount),
                balanceAfter: toNumber(wallet.balance),
                metadata: JSON.stringify({ trxnRef: trxn, providerResp: tppResp }),
            },
            });
        });
        }

        return res.status(success ? 200 : 400).json({
        message: success ? "Wallet funding verified successfully" : "Wallet funding verification failed",
        status: success ? "SUCCESS" : "FAILED",
        apiResponse: tppResp,
        });
    } catch (err: any) {
        console.error("verifyWalletFunding error:", err);
        return next(err);
    }
    }

    /**
     * LIST USER TRANSACTIONS
     */
    export async function getUserTransactions(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const transactions = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        });

        return res.json({ transactions });
    } catch (err: any) {
        return next(err);
    }
    }

    // user auth

