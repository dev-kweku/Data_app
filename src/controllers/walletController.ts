
    import { Request, Response, NextFunction } from "express";
    import { PrismaClient } from "@prisma/client";
    import { AppError } from "../utils/errors";
    import { getOrCreateWallet } from "../services/walletService";

    const prisma = new PrismaClient();

    /**
     * 🔐 Helper: Convert Prisma Decimal or any numeric value safely to number
     */
    function toNumber(value: any): number {
    if (value == null) return 0;
    if (typeof value === "number") return value;
    if (typeof value.toNumber === "function") return value.toNumber();
    return Number(value);
    }

    /**
     * 💰 Get current user's wallet balance
     */
    export async function getBalance(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const wallet = await getOrCreateWallet(user.id);
        res.json({
        userId: user.id,
        balance: toNumber(wallet.balance),
        updatedAt: wallet.updatedAt,
        });
    } catch (err) {
        next(err);
    }
    }

    /**
     * 📜 Get current user's transaction history
     */
    export async function getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 20);

        const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where: { userId: user.id },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
            select: {
            id: true,
            trxnRef: true,
            type: true,
            amount: true,
            commission: true,
            status: true,
            createdAt: true,
            },
        }),
        prisma.transaction.count({ where: { userId: user.id } }),
        ]);

        res.json({
        page,
        limit,
        total,
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
