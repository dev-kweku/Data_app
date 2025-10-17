
    import { Request, Response, NextFunction } from "express";
    import { Prisma, PrismaClient } from "@prisma/client";
    import { AppError } from "../utils/errors";

    const prisma = new PrismaClient();

    /**
     * Get single transaction by ID
     */
    export async function getTransaction(req: Request, res: Response, next: NextFunction) {
    try {
        const { id } = req.params;

        const trx = await prisma.transaction.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, name: true, email: true, role: true } },
        },
        });

        if (!trx) throw new AppError("Transaction not found", 404);

        const user = (req as any).user;
        if (!user) throw new AppError("Not authenticated", 401);

        // Only admin or owner can view
        if (user.role !== "ADMIN" && trx.userId !== user.id) {
        throw new AppError("Forbidden", 403);
        }

        res.json({
        id: trx.id,
        trxnRef: trx.trxnRef,
        userId: trx.userId,
        type: trx.type,
        amount: Number(trx.amount),
        commission: Number(trx.commission ?? 0),
        status: trx.status,
        recipient: trx.recipient,
        networkId: trx.networkId,
        bundlePlanId: trx.bundlePlanId,
        createdAt: trx.createdAt,
        apiResponse: trx.apiResponse,
        user: trx.user,
        });
    } catch (err) {
        next(err);
    }
    }

    /**
     * Get transaction history for authenticated user (or all if admin)
     */
    export async function getTransactionHistory(req: Request, res: Response, next: NextFunction) {
        try {
            const user = (req as any).user;
            if (!user) throw new AppError("Not authenticated", 401);
        
            const where = user.role === "ADMIN" ? {} : { userId: user.id };
        
            
            type TxnWithUser = Prisma.TransactionGetPayload<{
                include: { user: { select: { id: true; name: true; email: true; role: true } } };
            }>;
        
            let transactions: (TxnWithUser | any)[] = [];
        
            if (user.role === "ADMIN") {
                transactions = await prisma.transaction.findMany({
                where,
                distinct: ["id"],
                orderBy: { createdAt: "desc" },
                include: { user: { select: { id: true, name: true, email: true, role: true } } },
                });
            } else {
                transactions = await prisma.transaction.findMany({
                where,
                distinct: ["id"],
                orderBy: { createdAt: "desc" },
                });
            }
        
            const formatted = transactions.map((t) => ({
            id: t.id,
            trxnRef: t.trxnRef,
            userId: t.userId,
            type: t.type,
            amount: Number(t.amount),
            commission: Number(t.commission ?? 0),
            status: t.status,
            recipient: t.recipient,
            networkId: t.networkId,
            bundlePlanId: t.bundlePlanId,
            createdAt: t.createdAt,
            apiResponse: t.apiResponse,
            user: (t as any).user
                ? {
                    id: t.user.id,
                    name: t.user.name,
                    email: t.user.email,
                    role: t.user.role,
                    }
                : null,
            }));
        
            res.json({
                count: formatted.length,
                transactions: formatted,
            });
            } catch (err) {
            next(err);
            }
        }

        