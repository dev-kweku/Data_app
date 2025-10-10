import { PrismaClient } from "@prisma/client";
const prisma=new PrismaClient()

export async function ensureUniqueTransaction(trxnRef: string) {
    if (!trxnRef) return null;
    const existing = await prisma.transaction.findUnique({ where: { trxnRef }});
    return existing;
}
