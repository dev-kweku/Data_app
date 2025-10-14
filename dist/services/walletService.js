"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOrCreateWallet = getOrCreateWallet;
exports.creditWallet = creditWallet;
exports.debitWallet = debitWallet;
exports.getWalletBalance = getWalletBalance;
exports.listWalletTransactions = listWalletTransactions;
exports.adminAdjustWallet = adminAdjustWallet;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
/**
 * Get or create a wallet for a user
 */
async function getOrCreateWallet(userId) {
    let wallet = await prisma.wallet.findUnique({ where: { userId } });
    if (!wallet) {
        wallet = await prisma.wallet.create({
            data: { userId, balance: 0 },
        });
    }
    return wallet;
}
/**
 * Credit wallet — atomic with transaction log
 */
async function creditWallet(userId, amount, metadata) {
    if (amount <= 0)
        throw new errors_1.AppError("Invalid amount to credit", 400);
    return prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new errors_1.AppError("Wallet not found", 404);
        const updated = await tx.wallet.update({
            where: { userId },
            data: { balance: { increment: amount } },
        });
        await tx.walletTransaction.create({
            data: {
                userId,
                type: "CREDIT",
                amount,
                // ✅ convert Decimal to number
                balanceAfter: Number(updated.balance),
                metadata: metadata || "Wallet credited",
            },
        });
        return updated;
    });
}
/**
 * Debit wallet — atomic with transaction log
 */
async function debitWallet(userId, amount, metadata) {
    if (amount <= 0)
        throw new errors_1.AppError("Invalid amount to debit", 400);
    return prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet)
            throw new errors_1.AppError("Wallet not found", 404);
        const currentBalance = Number(wallet.balance);
        if (currentBalance < amount)
            throw new errors_1.AppError("Insufficient wallet balance", 400);
        const updated = await tx.wallet.update({
            where: { userId },
            data: { balance: { decrement: amount } },
        });
        await tx.walletTransaction.create({
            data: {
                userId,
                type: "DEBIT",
                amount,
                // ✅ convert Decimal to number
                balanceAfter: Number(updated.balance),
                metadata: metadata || "Wallet debited",
            },
        });
        return updated;
    });
}
/**
 * Get wallet balance
 */
async function getWalletBalance(userId) {
    const wallet = await getOrCreateWallet(userId);
    return Number(wallet.balance);
}
/**
 * List user’s wallet transactions (for frontend)
 */
async function listWalletTransactions(userId, limit = 50) {
    return prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}
/**
 * Admin adjusts wallet manually
 */
async function adminAdjustWallet(userId, amount, type, reason) {
    if (type === "CREDIT") {
        return creditWallet(userId, amount, `Admin credit: ${reason}`);
    }
    else {
        return debitWallet(userId, amount, `Admin debit: ${reason}`);
    }
}
//# sourceMappingURL=walletService.js.map