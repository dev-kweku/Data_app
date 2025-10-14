"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureUniqueTransaction = ensureUniqueTransaction;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function ensureUniqueTransaction(trxnRef) {
    if (!trxnRef)
        return null;
    const existing = await prisma.transaction.findUnique({ where: { trxnRef } });
    return existing;
}
//# sourceMappingURL=idempotency.js.map