    import { PrismaClient } from "@prisma/client";
    import { AppError } from "../utils/errors";

    const prisma = new PrismaClient();

    /**
     * Get or create a wallet for a user
     */
    export async function getOrCreateWallet(userId: string) {
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
    export async function creditWallet(userId: string, amount: number, metadata?: string) {
    if (amount <= 0) throw new AppError("Invalid amount to credit", 400);

    return prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new AppError("Wallet not found", 404);

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
    export async function debitWallet(userId: string, amount: number, metadata?: string) {
    if (amount <= 0) throw new AppError("Invalid amount to debit", 400);

    return prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({ where: { userId } });
        if (!wallet) throw new AppError("Wallet not found", 404);

        const currentBalance = Number(wallet.balance);
        if (currentBalance < amount) throw new AppError("Insufficient wallet balance", 400);

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
    export async function getWalletBalance(userId: string) {
    const wallet = await getOrCreateWallet(userId);
    return Number(wallet.balance);
    }

    /**
     * List user’s wallet transactions (for frontend)
     */
    export async function listWalletTransactions(userId: string, limit = 50) {
    return prisma.walletTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
    }

    /**
     * Admin adjusts wallet manually
     */
    export async function adminAdjustWallet(
    userId: string,
    amount: number,
    type: "CREDIT" | "DEBIT",
    reason: string
    ) {
    if (type === "CREDIT") {
        return creditWallet(userId, amount, `Admin credit: ${reason}`);
    } else {
        return debitWallet(userId, amount, `Admin debit: ${reason}`);
    }
    }
