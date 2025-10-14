"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.restrictTo = restrictTo;
exports.requireAdmin = requireAdmin;
exports.requireVendor = requireVendor;
exports.protect = protect;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const errors_1 = require("../utils/errors");
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
/**
 * 🔒 Authenticate JWT Token
 * Verifies token and attaches user to request.
 */
async function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new errors_1.AppError("Authentication required", 401);
        }
        const token = authHeader.split(" ")[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true },
        });
        if (!user)
            throw new errors_1.AppError("User not found", 401);
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
        };
        next();
    }
    catch (err) {
        console.error("JWT Authentication Error:", err.message);
        next(new errors_1.AppError("Invalid or expired token", 401));
    }
}
/**
 * 🧩 Role Restriction Helper
 * Allows only specific roles to access a route.
 */
function restrictTo(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user)
            return next(new errors_1.AppError("Not authenticated", 401));
        if (!allowedRoles.includes(req.user.role)) {
            return next(new errors_1.AppError("Forbidden: insufficient privileges", 403));
        }
        next();
    };
}
/**
 * 🧑‍💼 Require Admin Role
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "ADMIN") {
        return next(new errors_1.AppError("Admin access only", 403));
    }
    next();
}
/**
 * 🧾 Require Vendor Role
 */
function requireVendor(req, res, next) {
    if (!req.user || req.user.role !== "VENDOR") {
        return next(new errors_1.AppError("Vendor access only", 403));
    }
    next();
}
/**
 * 🧍‍♂️ Protect Middleware (Legacy-compatible)
 * Similar to authenticate(), but more general-purpose for any role.
 */
async function protect(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
            throw new errors_1.AppError("Not authorized, token missing", 401);
        }
        const token = authHeader.split(" ")[1];
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { id: true, email: true, role: true },
        });
        if (!user)
            throw new errors_1.AppError("User not found", 401);
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role,
        };
        next();
    }
    catch (err) {
        next(new errors_1.AppError("Unauthorized: " + err.message, 401));
    }
}
//# sourceMappingURL=auth.js.map