    import { PrismaClient } from "@prisma/client";
    import { AppError } from "../utils/errors";

    const prisma = new PrismaClient();

    /**
     *  Compute how much the vendor pays and earns
     * based on their commission settings.
     *
     * @param vendorId - Vendor's user ID
     * @param amount - Base transaction amount (GHS)
     * @returns { vendorPays, commission }
     */
    export async function computeVendorCost(vendorId: string, amount: number) {
    if (!vendorId || !amount || amount <= 0) {
        throw new AppError("Invalid vendorId or amount", 400);
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
    } else if (model === "COMMISSION") {
    
        commission = amount * rate;
        vendorPays = amount;
    } else {
        throw new AppError(`Unknown commission model: ${model}`, 400);
    }

    return { vendorPays, commission };
    }
