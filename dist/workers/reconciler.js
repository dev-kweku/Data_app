"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runReconcilerOnce = runReconcilerOnce;
exports.startReconciler = startReconciler;
const client_1 = require("@prisma/client");
const tppClient_1 = require("../services/tppClient");
const walletService_1 = require("../services/walletService");
const prisma = new client_1.PrismaClient();
const POLL_INTERVAL_MS = Number(process.env.RECONCILER_INTERVAL_MS) || 30000;
async function reconcileOne(trx) {
    try {
        const trxnRef = trx.trxnRef;
        const tppResp = await (0, tppClient_1.tppTransactionStatus)(trxnRef);
        const statusCode = tppResp["status-code"] ?? tppResp["status_code"] ?? tppResp["statusCode"];
        const dbTrx = await prisma.transaction.findUnique({ where: { trxnRef } });
        if (!dbTrx) {
            console.warn(`[reconciler] trx not found ${trxnRef}`);
            return;
        }
        if (dbTrx.status !== client_1.TrxnStatus.PENDING)
            return;
        if (statusCode === "00") {
            // SUCCESS
            await prisma.$transaction(async (tx) => {
                const vendorId = dbTrx.userId;
                const baseAmount = Number(dbTrx.amount);
                const commission = Number(dbTrx.commission || 0);
                // cost vendor pays
                let cost = baseAmount;
                if (commission > 0) {
                    cost = Number((baseAmount - commission).toFixed(4));
                    if (cost <= 0)
                        cost = baseAmount;
                }
                // Debit vendor
                await (0, walletService_1.debitWallet)(vendorId, cost);
                // Credit admin commission
                if (commission > 0) {
                    const admin = await tx.user.findFirst({ where: { role: client_1.Role.ADMIN } });
                    if (admin) {
                        await (0, walletService_1.creditWallet)(admin.id, commission);
                    }
                }
                // Mark transaction SUCCESS
                await tx.transaction.update({
                    where: { trxnRef },
                    data: { status: client_1.TrxnStatus.SUCCESS, apiResponse: tppResp },
                });
            });
            console.log(`[reconciler] SUCCESS ${trxnRef}`);
        }
        else if (statusCode === "09") {
            // STILL PENDING
            await prisma.transaction.update({
                where: { trxnRef },
                data: { apiResponse: tppResp, updatedAt: new Date() },
            });
            console.log(`[reconciler] STILL PENDING ${trxnRef}`);
        }
        else {
            // FAILED
            await prisma.transaction.update({
                where: { trxnRef },
                data: { status: client_1.TrxnStatus.FAILED, apiResponse: tppResp },
            });
            console.log(`[reconciler] FAILED ${trxnRef}`);
        }
    }
    catch (err) {
        console.error(`[reconciler] error reconciling ${trx.trxnRef}:`, err?.message || err);
    }
}
async function runReconcilerOnce(limit = 50) {
    const pending = await prisma.transaction.findMany({
        where: { status: client_1.TrxnStatus.PENDING },
        orderBy: { createdAt: "asc" },
        take: limit,
    });
    for (const p of pending) {
        await reconcileOne(p);
    }
}
function startReconciler() {
    console.log("[reconciler] starting worker, interval ms:", POLL_INTERVAL_MS);
    runReconcilerOnce().catch((err) => console.error("[reconciler] startup error", err));
    setInterval(() => {
        runReconcilerOnce().catch((err) => console.error("[reconciler] ping error", err));
    }, POLL_INTERVAL_MS);
}
if (require.main === module) {
    startReconciler();
}
//# sourceMappingURL=reconciler.js.map