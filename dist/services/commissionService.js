"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVendorCommission = getVendorCommission;
exports.computeVendorCost1 = computeVendorCost1;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function getVendorCommission(vendorId) {
    const setting = await prisma.commissionSetting.findUnique({
        where: { userId: vendorId },
        select: {
            rate: true,
            modelType: true,
        },
    });
    return (setting || {
        rate: 0.02,
        modelType: "DISCOUNT",
    });
}
/**
 * Compute the vendor’s payable amount and commission.
 * Supports DISCOUNT (vendor keeps commission),
 * MARKUP (vendor pays commission),
 * and FLAT (fixed fee deduction).
 */
// optional use @use on in utils
async function computeVendorCost1(vendorId, baseAmount) {
    if (baseAmount <= 0) {
        throw new Error("Invalid base amount");
    }
    const { rate, modelType } = await getVendorCommission(vendorId);
    const numericRate = Number(rate);
    let commission = 0;
    let vendorPays = baseAmount;
    switch (modelType) {
        case "DISCOUNT":
            commission = Number((baseAmount * numericRate).toFixed(2));
            vendorPays = Number((baseAmount - commission).toFixed(2));
            break;
        case "MARKUP":
            commission = Number((baseAmount * numericRate).toFixed(2));
            vendorPays = Number((baseAmount + commission).toFixed(2));
            break;
        case "FLAT":
            commission = Number(numericRate.toFixed(2));
            vendorPays = Number((baseAmount - commission).toFixed(2));
            break;
        default:
            commission = Number((baseAmount * 0.02).toFixed(2));
            vendorPays = Number((baseAmount - commission).toFixed(2));
            break;
    }
    return { vendorPays, commission };
}
//# sourceMappingURL=commissionService.js.map