"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBalance = getBalance;
exports.getTransactions = getTransactions;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const walletService_1 = require("../services/walletService");
const prisma = new client_1.PrismaClient();
/**
 * 🔐 Helper: Convert Prisma Decimal or any numeric value safely to number
 */
function toNumber(value) {
    if (value == null)
        return 0;
    if (typeof value === "number")
        return value;
    if (typeof value.toNumber === "function")
        return value.toNumber();
    return Number(value);
}
/**
 * 💰 Get current user's wallet balance
 */
async function getBalance(req, res, next) {
    try {
        const user = req.user;
        if (!user)
            throw new errors_1.AppError("Not authenticated", 401);
        const wallet = await (0, walletService_1.getOrCreateWallet)(user.id);
        res.json({
            userId: user.id,
            balance: toNumber(wallet.balance),
            updatedAt: wallet.updatedAt,
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * 📜 Get current user's transaction history
 */
async function getTransactions(req, res, next) {
    try {
        const user = req.user;
        if (!user)
            throw new errors_1.AppError("Not authenticated", 401);
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
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=walletController.js.map