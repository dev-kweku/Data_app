"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTransaction = getTransaction;
exports.getTransactionHistory = getTransactionHistory;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
/**
 * Get single transaction by ID
 */
async function getTransaction(req, res, next) {
    try {
        const { id } = req.params;
        const trx = await prisma.transaction.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
            },
        });
        if (!trx)
            throw new errors_1.AppError("Transaction not found", 404);
        const user = req.user;
        if (!user)
            throw new errors_1.AppError("Not authenticated", 401);
        // Only admin or owner can view
        if (user.role !== "ADMIN" && trx.userId !== user.id) {
            throw new errors_1.AppError("Forbidden", 403);
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
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get transaction history for authenticated user (or all if admin)
 */
async function getTransactionHistory(req, res, next) {
    try {
        const user = req.user;
        if (!user)
            throw new errors_1.AppError("Not authenticated", 401);
        const where = user.role === "ADMIN" ? {} : { userId: user.id };
        const transactions = await prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: user.role === "ADMIN"
                ? { user: { select: { id: true, name: true, email: true } } }
                : undefined,
        });
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
            user: t.user,
        }));
        res.json({
            count: formatted.length,
            transactions: formatted,
        });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=transactionController.js.map