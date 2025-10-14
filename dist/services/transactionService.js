"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTransaction = createTransaction;
exports.updateTransactionStatus = updateTransactionStatus;
exports.getTransactionByRef = getTransactionByRef;
exports.listTransactionsForUser = listTransactionsForUser;
exports.listAllTransactions = listAllTransactions;
exports.syncTransactionStatus = syncTransactionStatus;
const client_1 = require("@prisma/client");
const tppClient_1 = require("./tppClient");
const prisma = new client_1.PrismaClient();
/**
 * Create a new transaction record
 */
async function createTransaction(data) {
    const trxnRef = data.trxnRef ||
        `${data.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const txData = {
        userId: data.userId,
        type: data.type,
        amount: data.amount,
        status: data.status || client_1.TrxnStatus.PENDING,
        trxnRef,
    };
    if (data.commission !== undefined)
        txData.commission = data.commission;
    if (data.recipient)
        txData.recipient = data.recipient;
    if (data.networkId)
        txData.networkId = data.networkId;
    if (data.bundlePlanId)
        txData.bundlePlanId = data.bundlePlanId;
    if (data.apiResponse)
        txData.apiResponse = data.apiResponse;
    return prisma.transaction.create({ data: txData });
}
/**
 * Update transaction status & response
 */
async function updateTransactionStatus(trxnRef, status, apiResponse) {
    return prisma.transaction.update({
        where: { trxnRef },
        data: { status, apiResponse },
    });
}
/**
 * Fetch transaction by reference
 */
async function getTransactionByRef(trxnRef) {
    return prisma.transaction.findUnique({ where: { trxnRef } });
}
/**
 * List all transactions for a user
 */
async function listTransactionsForUser(userId, limit = 50) {
    return prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: limit,
    });
}
/**
 * List all transactions (Admin)
 */
async function listAllTransactions(limit = 100) {
    return prisma.transaction.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
            user: { select: { id: true, name: true, email: true, role: true } },
        },
    });
}
/**
 * Sync transaction status from TPP (check API status)
 */
async function syncTransactionStatus(trxnRef) {
    try {
        const tppRes = await (0, tppClient_1.tppTransactionStatus)(trxnRef);
        // Assume TPP returns something like { status: "SUCCESS" | "FAILED" }
        let status = client_1.TrxnStatus.PENDING;
        if (tppRes.status === "SUCCESS")
            status = client_1.TrxnStatus.SUCCESS;
        else if (tppRes.status === "FAILED")
            status = client_1.TrxnStatus.FAILED;
        await updateTransactionStatus(trxnRef, status, tppRes);
        return { trxnRef, status, tppRes };
    }
    catch (err) {
        console.error("❌ Error syncing transaction:", err.message);
        throw err;
    }
}
//# sourceMappingURL=transactionService.js.map