    import cron from "node-cron";
    import { PrismaClient, Role } from "@prisma/client";
    import { getTPPBalance } from "../services/tppClient";

    const prisma = new PrismaClient();

    export function startTPPSyncJob() {

    cron.schedule("*/5 * * * *", async () => {
        console.log("🕐 Running TPP balance sync job...");

        try {
        const tpp = await getTPPBalance();

        if (!tpp || typeof tpp.balance === "undefined") {
            console.warn(" No TPP balance returned, skipping sync.");
            return;
        }

        const tppBalance = Number(tpp.balance || 0);

        const admin = await prisma.user.findFirst({
            where: { role: Role.ADMIN },
        });

        if (!admin) {
            console.warn(" No admin found. Skipping TPP sync.");
            return;
        }

        await prisma.wallet.upsert({
            where: { userId: admin.id },
            update: { balance: tppBalance },
            create: { userId: admin.id, balance: tppBalance },
        });

        console.log(`✅ Synced admin wallet with TPP balance: GHS ${tppBalance.toFixed(2)}`);
        } catch (err: any) {
        console.error("❌ Error syncing TPP balance:", err.message);
        }
    });
    }
