"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buyAirtime = buyAirtime;
exports.buyDataBundle = buyDataBundle;
exports.getWalletBalanceHandler = getWalletBalanceHandler;
exports.getMyTransactions = getMyTransactions;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const walletService_1 = require("../services/walletService");
const vendorCost_1 = require("../utils/vendorCost");
const transactionService_1 = require("../services/transactionService");
const tppClient_1 = require("../services/tppClient");
const prisma = new client_1.PrismaClient();
// Helper: safely convert Decimal or unknown to number
function toNumber(value) {
    if (value == null)
        return 0;
    if (typeof value === "number")
        return value;
    if (typeof value.toNumber === "function")
        return value.toNumber();
    return Number(value);
}
async function buyAirtime(req, res, next) {
    try {
        const vendor = req.user;
        if (!vendor || vendor.role !== "VENDOR")
            throw new errors_1.AppError("Vendor access only", 403);
        const { networkId, phoneNumber, amount } = req.body;
        if (!networkId || !phoneNumber || !amount)
            throw new errors_1.AppError("networkId, phoneNumber and amount required", 400);
        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0)
            throw new errors_1.AppError("Invalid amount", 400);
        const { vendorPays, commission } = await (0, vendorCost_1.computeVendorCost)(vendor.id, baseAmount);
        const wallet = await (0, walletService_1.getOrCreateWallet)(vendor.id);
        if (toNumber(wallet.balance) < vendorPays)
            throw new errors_1.AppError("Insufficient wallet balance", 400);
        await (0, walletService_1.debitWallet)(vendor.id, vendorPays);
        const trx = await (0, transactionService_1.createTransaction)({
            userId: vendor.id,
            type: "AIRTIME",
            amount: baseAmount,
            commission,
            recipient: phoneNumber,
            networkId,
            status: "PENDING",
        });
        const apiResp = await (0, tppClient_1.tppAirtimeTopup)({
            network: networkId,
            recipient: phoneNumber,
            amount: baseAmount,
            trxn: trx.trxnRef,
        });
        const statusCode = apiResp["status-code"] ?? apiResp["status_code"] ?? apiResp["statusCode"];
        const success = statusCode === "00";
        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: {
                status: success ? "SUCCESS" : "PENDING",
                apiResponse: apiResp,
            },
        });
        //  Send confirmation SMS if successful
        if (success) {
            const msg = ` Airtime top-up successful!
        You have recharged ${phoneNumber} with GHS ${baseAmount.toFixed(2)}.
        Your new balance: GHS ${apiResp.balance_after ?? "N/A"}.`;
            await (0, tppClient_1.sendTPPSms)(phoneNumber, msg, "DataApp");
        }
        res.json({
            message: "Airtime purchase initiated",
            trxnRef: trx.trxnRef,
            status: success ? "SUCCESS" : "PENDING",
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * Vendor: Purchase Data Bundle + Auto SMS
 */
async function buyDataBundle(req, res, next) {
    try {
        const vendor = req.user;
        if (!vendor || vendor.role !== "VENDOR")
            throw new errors_1.AppError("Vendor access only", 403);
        const { networkId, phoneNumber, planId, amount } = req.body;
        if (!networkId || !phoneNumber || !planId || !amount)
            throw new errors_1.AppError("networkId, phoneNumber, planId and amount required", 400);
        const baseAmount = Number(amount);
        if (isNaN(baseAmount) || baseAmount <= 0)
            throw new errors_1.AppError("Invalid amount", 400);
        const { vendorPays, commission } = await (0, vendorCost_1.computeVendorCost)(vendor.id, baseAmount);
        const wallet = await (0, walletService_1.getOrCreateWallet)(vendor.id);
        if (toNumber(wallet.balance) < vendorPays)
            throw new errors_1.AppError("Insufficient wallet balance", 400);
        await (0, walletService_1.debitWallet)(vendor.id, vendorPays);
        const trx = await (0, transactionService_1.createTransaction)({
            userId: vendor.id,
            type: "DATABUNDLE",
            amount: baseAmount,
            commission,
            recipient: phoneNumber,
            networkId,
            bundlePlanId: planId,
            status: "PENDING",
        });
        const apiResp = await (0, tppClient_1.tppDataBundle)({
            network: networkId,
            recipient: phoneNumber,
            data_code: planId,
            amount: baseAmount,
            trxn: trx.trxnRef,
        });
        const statusCode = apiResp["status-code"] ?? apiResp["status_code"] ?? apiResp["statusCode"];
        const success = statusCode === "00";
        await prisma.transaction.update({
            where: { trxnRef: trx.trxnRef },
            data: {
                status: success ? "SUCCESS" : "PENDING",
                apiResponse: apiResp,
            },
        });
        //  Send confirmation SMS if successful
        if (success) {
            const msg = ` Data bundle purchase successful!
        You bought a data plan (${planId}) for ${phoneNumber} costing GHS ${baseAmount.toFixed(2)}.
        Your new balance: GHS ${apiResp.balance_after ?? "N/A"}.`;
            await (0, tppClient_1.sendTPPSms)(phoneNumber, msg, "DataApp");
        }
        res.json({
            message: "Data bundle purchase initiated",
            trxnRef: trx.trxnRef,
            status: success ? "SUCCESS" : "PENDING",
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 *  Vendor: Get Wallet Balance
 */
async function getWalletBalanceHandler(req, res, next) {
    try {
        const vendor = req.user;
        if (!vendor || vendor.role !== "VENDOR")
            throw new errors_1.AppError("Vendor access only", 403);
        const balance = await (0, walletService_1.getWalletBalance)(vendor.id);
        res.json({ balance: toNumber(balance) });
    }
    catch (err) {
        next(err);
    }
}
/**
 *  Vendor: View Transaction History
 */
async function getMyTransactions(req, res, next) {
    try {
        const vendor = req.user;
        if (!vendor || vendor.role !== "VENDOR")
            throw new errors_1.AppError("Vendor access only", 403);
        const limit = Math.min(100, Number(req.query.limit) || 20);
        const transactions = await (0, transactionService_1.listTransactionsForUser)(vendor.id, limit);
        res.json({
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
//# sourceMappingURL=vendorController.js.map