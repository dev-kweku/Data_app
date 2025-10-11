    import { PrismaClient } from "@prisma/client";
    import app from "./app";
    import { startTPPSyncJob } from "./jobs/syncTPPBalanceJob";
    
    const prisma=new PrismaClient()
    const PORT = process.env.PORT || 4000;

    startTPPSyncJob();

    async function main() {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
    }

    // handle shutdown
    process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await prisma.$disconnect();
    process.exit(0);
    });

    main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
    });
