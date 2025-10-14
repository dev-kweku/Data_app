"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeVendorCost = computeVendorCost;
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
/**
 *  Compute how much the vendor pays and earns
 * based on their commission settings.
 *
 * @param vendorId - Vendor's user ID
 * @param amount - Base transaction amount (GHS)
 * @returns { vendorPays, commission }
 */
async function computeVendorCost(vendorId, amount) {
    if (!vendorId || !amount || amount <= 0) {
        throw new errors_1.AppError("Invalid vendorId or amount", 400);
    }
    const setting = await prisma.commissionSetting.findUnique({
        where: { userId: vendorId },
    });
    const rate = setting?.rate ?? 0.02;
    const model = setting?.modelType ?? "DISCOUNT";
    let vendorPays = amount;
    let commission = 0;
    if (model === "DISCOUNT") {
        commission = amount * rate;
        vendorPays = amount - commission;
    }
    else if (model === "COMMISSION") {
        commission = amount * rate;
        vendorPays = amount;
    }
    else {
        throw new errors_1.AppError(`Unknown commission model: ${model}`, 400);
    }
    return { vendorPays, commission };
}
//# sourceMappingURL=vendorCost.js.map