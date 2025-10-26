    import { PrismaClient, Role } from "@prisma/client";
    import bcrypt from "bcrypt";
    import { AppError } from "../utils/errors";

    const prisma = new PrismaClient();

    /**
     * Find a user by email
     */
    export async function findUserByEmail(email: string) {
    return prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
    });
    }

    /**
     * Create a new user with a hashed password and default wallet.
     * - Prevents duplicate emails.
     * - Automatically initializes wallet.
     * - If role is "VENDOR", creates default commission settings.
     */
    export async function createUser(data: {
    email: string;
    name: string;
    password: string;
    role: Role;
    }) {
    const normalizedEmail = data.email.toLowerCase().trim();

    // 1️ Check for existing user
    const existing = await findUserByEmail(normalizedEmail);
    if (existing) throw new AppError("Email already exists", 400);

    // 2️ Hash password
    const passwordHash = await bcrypt.hash(data.password, 10);

    // 3 Create user and wallet transactionally
    const user = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
        data: {
            email: normalizedEmail,
            name: data.name.trim(),
            passwordHash,
            role: data.role,
        },
        });

        await tx.wallet.create({
        data: { userId: newUser.id, balance: 0 },
        });

        // Optional: auto-create vendor commission defaults
        if (data.role === "VENDOR") {
        await tx.commissionSetting.create({
            data: {
            userId: newUser.id,
            rate: 0.035,
            modelType: "DISCOUNT",
            },
        });
        }

        return newUser;
    });

    // Never return passwordHash
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
    }

    /**
     * Verify user credentials (email + password)
     */
    export async function verifyUserCredentials(email: string, password: string) {
        const user = await findUserByEmail(email);
        if (!user || !user.passwordHash)
            throw new AppError("Invalid email or password", 401);
        
            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid)
            throw new AppError("Invalid email or password", 401);
        
            const { passwordHash, ...safeUser } = user;
            return safeUser;
        }
        
