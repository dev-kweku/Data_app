    import { PrismaClient } from "@prisma/client";
    const prisma = new PrismaClient(); 
    import bcrypt from "bcrypt";

    async function main() {
    const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
    const adminPass = process.env.SEED_ADMIN_PASSWORD || "Password123!";
    const initialBalance = Number(process.env.SEED_ADMIN_BALANCE || 1000);

    const existing = await prisma.user.findUnique({ where: { email: adminEmail }});
    if (existing) {
        console.log("Admin already exists:", adminEmail);
        // ensure wallet exists and top up
        const wallet = await prisma.wallet.upsert({
        where: { userId: existing.id },
        update: { balance: initialBalance },
        create: { userId: existing.id, balance: initialBalance }
        });
        console.log("Wallet ensured:", wallet);
        return;
    }

    const hash = await bcrypt.hash(adminPass, 10);
    const user = await prisma.user.create({
        data: { email: adminEmail, name: "Admin", passwordHash: hash, role: "ADMIN" }
    });

    await prisma.wallet.create({ data: { userId: user.id, balance: initialBalance }});
    console.log("Admin created:", adminEmail);
    }

    main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
