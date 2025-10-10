    import { PrismaClient } from "@prisma/client";

    const prisma = new PrismaClient();


    export async function getVendorCommission(vendorId: string) {
    const setting = await prisma.commissionSetting.findUnique({
        where: { userId: vendorId },
        select: {
        rate: true,
        modelType: true, 
        },
    });

    
    return (
        setting || {
        rate: 0.02,
        modelType: "DISCOUNT" as "DISCOUNT" | "MARKUP" | "FLAT",
        }
    );
    }

    /**
     * Compute the vendor’s payable amount and commission.
     * Supports DISCOUNT (vendor keeps commission),
     * MARKUP (vendor pays commission),
     * and FLAT (fixed fee deduction).
     */
    export async function computeVendorCost(
    vendorId: string,
    baseAmount: number
    ): Promise<{ vendorPays: number; commission: number }> {
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
