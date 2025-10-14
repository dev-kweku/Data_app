"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
exports.login = login;
exports.getProfile = getProfile;
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || "7d");
/**
 * Generate JWT
 */
function generateToken(user) {
    const options = { expiresIn: JWT_EXPIRES_IN };
    return jsonwebtoken_1.default.sign({ id: user.id, role: user.role }, JWT_SECRET, options);
}
/**
 * Register a new user
 */
async function register(req, res, next) {
    try {
        const { email, name, password, role } = req.body;
        if (!email || !name || !password) {
            throw new errors_1.AppError("Email, name, and password are required", 400);
        }
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing)
            throw new errors_1.AppError("Email already registered", 400);
        const passwordHash = await bcrypt_1.default.hash(password, 10);
        const user = await prisma.user.create({
            data: {
                email,
                name,
                passwordHash,
                role: role && Object.values(client_1.Role).includes(role) ? role : client_1.Role.USER,
            },
        });
        // Create wallet for new user
        await prisma.wallet.create({
            data: { userId: user.id, balance: 0 },
        });
        const token = generateToken(user);
        res.status(201).json({
            message: "Registration successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * Login user and return JWT
 */
async function login(req, res, next) {
    try {
        const { email, password } = req.body;
        if (!email || !password)
            throw new errors_1.AppError("Email and password required", 400);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user)
            throw new errors_1.AppError("Invalid credentials", 401);
        const validPassword = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!validPassword)
            throw new errors_1.AppError("Invalid credentials", 401);
        const token = generateToken(user);
        res.json({
            message: "Login successful",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
        });
    }
    catch (err) {
        next(err);
    }
}
/**
 * Get profile of authenticated user
 */
async function getProfile(req, res, next) {
    try {
        const authUser = req.user; // populated by auth middleware
        if (!authUser)
            throw new errors_1.AppError("Not authenticated", 401);
        const dbUser = await prisma.user.findUnique({
            where: { id: authUser.id },
            select: { id: true, name: true, email: true, role: true },
        });
        if (!dbUser)
            throw new errors_1.AppError("User not found", 404);
        res.json({ user: dbUser });
    }
    catch (err) {
        next(err);
    }
}
//# sourceMappingURL=authController.js.map