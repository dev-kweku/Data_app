
    import { Request, Response, NextFunction } from "express";
    import jwt from "jsonwebtoken";
    import { PrismaClient } from "@prisma/client";
    import { AppError } from "../utils/errors";

    const prisma = new PrismaClient();
    const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

    /** User roles */
    export type UserRole = "ADMIN" | "VENDOR" | "USER";

    /** Authenticated user structure */
    export interface AuthUser {
    id: string;
    email?: string | null;
    phone?: string | null;
    role: UserRole;
    }

    /** Extend Express Request interface */
    declare global {
    namespace Express {
    interface Request {
    user?: AuthUser;
    }
    }
    }

    /**

    *  Authenticate JWT Token
    * Works for both email-password and OTP-based users.
    */
        export async function authenticate(req: Request, res: Response, next: NextFunction) {
        try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
        throw new AppError("Authentication required", 401);
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: UserRole };

        const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, phone: true, role: true },
        });

        if (!user) throw new AppError("User not found", 401);

        req.user = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role as UserRole,
        };

        next();
        } catch (err: any) {
        console.error("JWT Authentication Error:", err.message);
        next(new AppError("Invalid or expired token", 401));
        }
        }

        /**

        * Restrict access to specific roles
        */
        export function restrictTo(...allowedRoles: UserRole[]) {
        return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) return next(new AppError("Not authenticated", 401));
        if (!allowedRoles.includes(req.user.role)) {
        return next(new AppError("Forbidden: insufficient privileges", 403));
        }
        next();
        };
        }

        /**

        * Require Admin Role
        */
        export function requireAdmin(req: Request, res: Response, next: NextFunction) {
        if (!req.user || req.user.role !== "ADMIN") {
        return next(new AppError("Admin access only", 403));
        }
        next();
        }

        /**

        * Require Vendor Role
        */
        export function requireVendor(req: Request, res: Response, next: NextFunction) {
        if (!req.user || req.user.role !== "VENDOR") {
        return next(new AppError("Vendor access only", 403));
        }
        next();
        }

        /**

        * Protect Middleware (Legacy-Compatible)
        */
        export async function protect(req: Request, res: Response, next: NextFunction) {
        try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith("Bearer ")) {
        throw new AppError("Not authorized, token missing", 401);
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; role: UserRole };

        const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, phone: true, role: true },
        });

        if (!user) throw new AppError("User not found", 401);

        req.user = {
        id: user.id,
        email: user.email,
        phone: user.phone,
        role: user.role as UserRole,
        };

        next();
        } catch (err: any) {
        next(new AppError("Unauthorized: " + err.message, 401));
        }
        }

