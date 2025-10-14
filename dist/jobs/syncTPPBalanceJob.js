"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTPPSyncJob = startTPPSyncJob;
const node_cron_1 = __importDefault(require("node-cron"));
const client_1 = require("@prisma/client");
const tppClient_1 = require("../services/tppClient");
const prisma = new client_1.PrismaClient();
function startTPPSyncJob() {
    node_cron_1.default.schedule("*/5 * * * *", async () => {
        console.log("🕐 Running TPP balance sync job...");
        try {
            const tpp = await (0, tppClient_1.getTPPBalance)();
            if (!tpp || typeof tpp.balance === "undefined") {
                console.warn(" No TPP balance returned, skipping sync.");
                return;
            }
            const tppBalance = Number(tpp.balance || 0);
            const admin = await prisma.user.findFirst({
                where: { role: client_1.Role.ADMIN },
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
        }
        catch (err) {
            console.error("❌ Error syncing TPP balance:", err.message);
        }
    });
}
//# sourceMappingURL=syncTPPBalanceJob.js.map