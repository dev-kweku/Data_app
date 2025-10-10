import { PrismaClient, TrxnStatus, TrxnType } from "@prisma/client";
import { tppTransactionStatus } from "./tppClient";

const prisma = new PrismaClient();

/**
 * Create a new transaction record
 */
export async function createTransaction(data: {
  userId: string;
  type: TrxnType;
  amount: number;
  commission?: number;
  recipient?: string;
  networkId?: string;
  bundlePlanId?: string;
  status?: TrxnStatus;
  trxnRef?: string;
  apiResponse?: any;
}) {
  const trxnRef =
    data.trxnRef ||
    `${data.type}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const txData: any = {
    userId: data.userId,
    type: data.type,
    amount: data.amount,
    status: data.status || TrxnStatus.PENDING,
    trxnRef,
  };

  if (data.commission !== undefined) txData.commission = data.commission;
  if (data.recipient) txData.recipient = data.recipient;
  if (data.networkId) txData.networkId = data.networkId;
  if (data.bundlePlanId) txData.bundlePlanId = data.bundlePlanId;
  if (data.apiResponse) txData.apiResponse = data.apiResponse;

  return prisma.transaction.create({ data: txData });
}

/**
 * Update transaction status & response
 */
export async function updateTransactionStatus(
  trxnRef: string,
  status: TrxnStatus,
  apiResponse?: any
) {
  return prisma.transaction.update({
    where: { trxnRef },
    data: { status, apiResponse },
  });
}

/**
 * Fetch transaction by reference
 */
export async function getTransactionByRef(trxnRef: string) {
  return prisma.transaction.findUnique({ where: { trxnRef } });
}

/**
 * List all transactions for a user
 */
export async function listTransactionsForUser(userId: string, limit = 50) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * List all transactions (Admin)
 */
export async function listAllTransactions(limit = 100) {
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
export async function syncTransactionStatus(trxnRef: string) {
  try {
    const tppRes = await tppTransactionStatus(trxnRef);

    // Assume TPP returns something like { status: "SUCCESS" | "FAILED" }
    let status: TrxnStatus = TrxnStatus.PENDING;
    if (tppRes.status === "SUCCESS") status = TrxnStatus.SUCCESS;
    else if (tppRes.status === "FAILED") status = TrxnStatus.FAILED;

    await updateTransactionStatus(trxnRef, status, tppRes);

    return { trxnRef, status, tppRes };
  } catch (err: any) {
    console.error("❌ Error syncing transaction:", err.message);
    throw err;
  }
}
