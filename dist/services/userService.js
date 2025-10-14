"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findUserByEmail = findUserByEmail;
exports.createUser = createUser;
exports.verifyUserCredentials = verifyUserCredentials;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
/**
 * Find a user by email
 */
async function findUserByEmail(email) {
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
async function createUser(data) {
    const normalizedEmail = data.email.toLowerCase().trim();
    // 1️⃣ Check for existing user
    const existing = await findUserByEmail(normalizedEmail);
    if (existing)
        throw new errors_1.AppError("Email already exists", 400);
    // 2️⃣ Hash password
    const passwordHash = await bcrypt_1.default.hash(data.password, 10);
    // 3️⃣ Create user and wallet transactionally
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
                    rate: 0.02,
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
async function verifyUserCredentials(email, password) {
    const user = await findUserByEmail(email);
    if (!user)
        throw new errors_1.AppError("Invalid email or password", 401);
    const valid = await bcrypt_1.default.compare(password, user.passwordHash);
    if (!valid)
        throw new errors_1.AppError("Invalid email or password", 401);
    const { passwordHash, ...safeUser } = user;
    return safeUser;
}
//# sourceMappingURL=userService.js.map