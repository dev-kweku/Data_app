"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const app_1 = __importDefault(require("./app"));
const syncTPPBalanceJob_1 = require("./jobs/syncTPPBalanceJob");
const prisma = new client_1.PrismaClient();
const PORT = process.env.PORT || 4000;
(0, syncTPPBalanceJob_1.startTPPSyncJob)();
async function main() {
    app_1.default.listen(PORT, () => {
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
//# sourceMappingURL=server.js.map