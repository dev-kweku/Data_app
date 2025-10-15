    import { Request, Response, NextFunction } from "express";
    import { PrismaClient, Role, TrxnType, TrxnStatus } from "@prisma/client";
    import bcrypt from "bcrypt";
    import { AppError } from "../utils/errors";
    import { getOrCreateWallet } from "../services/walletService";
    import { getTPPBalance } from "../services/tppClient";
    import jwt from "jsonwebtoken"


    const prisma = new PrismaClient();

    /**
     * Helper to enforce admin-only access
     */
    function ensureAdmin(user: any) {
    if (!user || user.role !== Role.ADMIN) {
        throw new AppError("Only admin can perform this action", 403);
    }
    }


    // admin register endpoint
    // export async function register(req: Request, res: Response, next: NextFunction) {
    //     try {
    //         const { email, password, name,  role } = req.body;
        
            
    //         if (!email || !password) {
    //             throw new AppError("Email and password are required", 400);
    //         }
        
            
    //         const existingUser = await prisma.user.findUnique({ where: { email } });
    //         if (existingUser) {
    //             throw new AppError("User already exists", 400);
    //         }
        
            
    //         const hashedPassword = await bcrypt.hash(password, 10);
        
            
    //         const newUser = await prisma.user.create({
    //             data: {
    //             email,
    //             passwordHash: hashedPassword,
    //             name,
    //             role: (role as Role) || Role.USER, 
    //             },
    //         });
        
        
    //         if (!process.env.JWT_SECRET) {
    //             throw new AppError("JWT secret not configured", 500);
    //         }
        
        
    //         const token = jwt.sign(
    //             { id: newUser.id, role: newUser.role },
    //             process.env.JWT_SECRET,
    //             { expiresIn: "7d" }
    //         );
        
            
    //         res.status(201).json({
    //             success: true,
    //             message: "User registered successfully",
    //             user: {
    //             id: newUser.id,
    //             email: newUser.email,
    //             role: newUser.role,
    //             },
    //             token,
    //         });
    //         } catch (error:any) {
    //         next(error instanceof AppError ? error : new AppError(error.message, 500));
    //         }
    //     }

    /**
     * 🧱 Create a new Vendor (Admin Only)
     */
    export async function createVendor(req: Request, res: Response, next: NextFunction) {
    try {
        ensureAdmin((req as any).user);
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
        throw new AppError("email, name & password required", 400);
        }

        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) throw new AppError("Email already registered", 400);

        const hash = await bcrypt.hash(password, 10);
        const vendor = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
            data: { email, name, passwordHash: hash, role: Role.VENDOR },
        });

        await tx.wallet.create({ data: { userId: user.id, balance: 0 } });

        await tx.commissionSetting.upsert({
            where: { userId: user.id },
            update: {},
            create: { userId: user.id, rate: 0.02, modelType: "DISCOUNT" },
        });

        return user;
        });

        res.status(201).json({
        message: "Vendor created successfully",
        vendor: { id: vendor.id, email: vendor.email, name: vendor.name },
        });
    } catch (err) {
        next(err);
    }
    }

    /**
     * 📜 List all vendors with wallet balances
     */
    export async function listVendors(req: Request, res: Response, next: NextFunction) {
    try {
        ensureAdmin((req as any).user);

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(100, Number(req.query.limit) || 20);
        const search = (req.query.search as string) || "";

        const where: any = { role: Role.VENDOR };
        if (search.trim()) {
        where.OR = [
            { email: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
        ];
        }

        const [vendors, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where }),
        ]);

        const wallets = await prisma.wallet.findMany({
        where: { userId: { in: vendors.map((v) => v.id) } },
        });
        const walletMap = new Map(wallets.map((w) => [w.userId, w.balance]));

        res.json({
        page,
        limit,
        total,
        vendors: vendors.map((v) => ({
            id: v.id,
            email: v.email,
            name: v.name,
            balance: Number(walletMap.get(v.id) ?? 0),
            createdAt: v.createdAt,
        })),
        });
    } catch (err) {
        next(err);
    }
    }

    /**
     * 🔍 Get Vendor Details
     */
    export async function getVendor(req: Request, res: Response, next: NextFunction) {
    try {
        ensureAdmin((req as any).user);

        const vendorId = String(req.params.vendorId);
        const vendor = await prisma.user.findUnique({ where: { id: vendorId } });
        if (!vendor) throw new AppError("Vendor not found", 404);
        if (vendor.role !== Role.VENDOR) throw new AppError("User is not a vendor", 400);

        const wallet = await getOrCreateWallet(vendorId);

        res.json({
        id: vendor.id,
        email: vendor.email,
        name: vendor.name,
        balance: Number(wallet.balance),
        createdAt: vendor.createdAt,
        });
    } catch (err) {
        next(err);
    }
    }

    // export async function fundVendor(req: Request, res: Response, next: NextFunction) {
    //     try {
    //         const admin = (req as any).user;
    //         if (!admin || admin.role !== Role.ADMIN)
    //             throw new AppError("Only admin can perform this action", 403);
        
    //         const { vendorId, amount } = req.body;
    //         if (!vendorId || amount === undefined)
    //             throw new AppError("vendorId & amount required", 400);
        
    //         const amt = Number(amount);
    //         if (isNaN(amt) || amt <= 0) throw new AppError("Invalid amount", 400);
        
    //         const tpp = await getTPPBalance();
    //         const tppBalance = Number(tpp.balance || 0);
    //         if (tppBalance <= 0) {
    //             throw new AppError("Your TPP account has insufficient balance.", 400);
    //         }
        
    //         const adminWallet = await getOrCreateWallet(admin.id);
    //         let adminBalance = Number(adminWallet.balance);
        
    //         if (adminBalance < amt && tppBalance >= amt) {
    //             const topUpAmount = Math.min(tppBalance, amt * 2); // optional: sync double
    //             await prisma.wallet.update({
    //             where: { userId: admin.id },
    //             data: { balance: { increment: topUpAmount } },
    //             });
        
    //             adminBalance += topUpAmount;
    //             console.log(` Synced Admin wallet from TPP by GHS ${topUpAmount}`);
    //         }
        
    //         if (adminBalance < amt) {
    //             throw new AppError(
    //             `Insufficient Admin wallet & TPP balance. Admin: ${adminBalance}, TPP: ${tppBalance}`,
    //             400
    //             );
    //         }
    //         await prisma.$transaction(async (tx) => {
    //             await tx.wallet.update({
    //             where: { userId: admin.id },
    //             data: { balance: { decrement: amt } },
    //             });
        
    //             await tx.wallet.upsert({
    //             where: { userId: vendorId },
    //             update: { balance: { increment: amt } },
    //             create: { userId: vendorId, balance: amt },
    //             });
        
    //             await tx.transaction.create({
    //             data: {
    //                 trxnRef: `fund_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    //                 userId: admin.id,
    //                 type: TrxnType.FUND_TRANSFER,
    //                 amount: amt,
    //                 recipient: vendorId,
    //                 status: TrxnStatus.SUCCESS,
    //                 apiResponse: { note: "Admin funded vendor (auto-synced from TPP)" },
    //             },
    //             });
    //         });
        
    //         res.json({
    //             message: `Vendor funded successfully. 
    //             Local Admin Wallet now synced with TPP.
    //             Remaining TPP balance: GHS ${(tppBalance - amt).toFixed(2)}`,
    //         });
    //         } catch (err) {
    //         next(err);
    //         }
    //     }

    // updated fund wallet 
    export async function fundVendor(req: Request, res: Response, next: NextFunction) {
        try {
            const admin = (req as any).user;
            if (!admin || admin.role !== Role.ADMIN) {
                throw new AppError("Only admin can perform this action", 403);
            }
        
            const { vendorId, amount } = req.body;
            if (!vendorId || amount === undefined)
                throw new AppError("vendorId & amount are required", 400);
        
            const amt = Number(amount);
            if (isNaN(amt) || amt <= 0) throw new AppError("Invalid amount", 400);
        
            
            const tpp = await getTPPBalance();
            const tppBalance = Number(tpp.balance || 0);
        
            if (isNaN(tppBalance)) {
                throw new AppError("Invalid TPP balance response", 500);
            }
        
            if (tppBalance <= 0) {
                throw new AppError("Your TPP account has insufficient balance.", 400);
            }
        
        
            const adminWallet = await getOrCreateWallet(admin.id);
            let adminBalance = Number(adminWallet.balance || 0);
        
            
            if (adminBalance < amt && tppBalance >= amt) {
                const topUpAmount = Math.min(tppBalance, amt);
                await prisma.wallet.update({
                where: { userId: admin.id },
                data: { balance: { increment: topUpAmount } },
                });
        
                adminBalance += topUpAmount;
                console.log(`Synced admin wallet with TPP by GHS ${topUpAmount}`);
            }
        
            if (adminBalance < amt) {
                throw new AppError(
                `Insufficient funds: Admin (${adminBalance}) < Amount (${amt})`,
                400
                );
            }
        
            
            await prisma.$transaction(async (tx) => {
                
                await tx.wallet.update({
                where: { userId: admin.id },
                data: { balance: { decrement: amt } },
                });
        
                
                await tx.wallet.upsert({
                where: { userId: vendorId },
                update: { balance: { increment: amt } },
                create: { userId: vendorId, balance: amt },
                });
        
                
                await tx.transaction.create({
                data: {
                    trxnRef: `fund_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                    userId: admin.id,
                    type: TrxnType.FUND_TRANSFER,
                    amount: amt,
                    recipient: vendorId,
                    status: TrxnStatus.SUCCESS,
                    apiResponse: { note: "Admin funded vendor (synced with TPP)" },
                },
                });
            });
        
            return res.status(200).json({
                status: "success",
                message: `Vendor funded successfully with GHS ${amt.toFixed(2)}.`,
                remainingTPPBalance: tppBalance - amt,
            });
            } catch (err: any) {
            console.error("Fund vendor error:", err.message);
            next(err);
            }
        }
    


    export async function listTransactions(req: Request, res: Response, next: NextFunction) {
    try {
        ensureAdmin((req as any).user);

        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = Math.min(200, Number(req.query.limit) || 50);
        const filters: any = {};

        if (req.query.status) filters.status = String(req.query.status).toUpperCase();
        if (req.query.vendorId) filters.userId = String(req.query.vendorId);
        if (req.query.dateFrom || req.query.dateTo) {
        filters.createdAt = {};
        if (req.query.dateFrom) filters.createdAt.gte = new Date(String(req.query.dateFrom));
        if (req.query.dateTo) filters.createdAt.lte = new Date(String(req.query.dateTo));
        }

        const [transactions, total] = await Promise.all([
        prisma.transaction.findMany({
            where: filters,
            skip: (page - 1) * limit,
            take: limit,
            orderBy: { createdAt: "desc" },
        }),
        prisma.transaction.count({ where: filters }),
        ]);

        res.json({
        page,
        limit,
        total,
        transactions: transactions.map((t) => ({
            ...t,
            amount: Number(t.amount),
            commission: Number(t.commission ?? 0),
        })),
        });
    } catch (err) {
        next(err);
    }
    }

    /**
     * 💼 View Wallet
     */
    export async function getWallet(req: Request, res: Response, next: NextFunction) {
    try {
        ensureAdmin((req as any).user);

        const userId = String(req.params.userId);
        const wallet = await getOrCreateWallet(userId);

        res.json({ userId, balance: Number(wallet.balance) });
    } catch (err) {
        next(err);
    }
    }

    /**
     * ⚙️ Set Vendor Commission
     */
    export async function setCommission(req: Request, res: Response, next: NextFunction) {
    try {
        ensureAdmin((req as any).user);

        const vendorId = String(req.params.vendorId);
        const { rate, modelType } = req.body;

        if (rate === undefined || !modelType)
        throw new AppError("rate & modelType required", 400);

        const r = Number(rate);
        if (isNaN(r) || r < 0 || r > 0.5)
        throw new AppError("rate must be between 0 and 0.5", 400);

        const commission = await prisma.commissionSetting.upsert({
        where: { userId: vendorId },
        update: { rate: r, modelType },
        create: { userId: vendorId, rate: r, modelType },
        });

        res.json({ message: "Commission updated successfully", commission });
    } catch (err) {
        next(err);
    }
    }

    export async function getCommission(req: Request, res: Response, next: NextFunction) {
        try {
            const vendorId = req.params.vendorId;
            const commission = await prisma.commissionSetting.findUnique({ where: { userId: vendorId } });
            res.json({ commission });
            } catch (err) {
            next(err);
            }
        }


// get balance controller
export async function getTPPBalanceHandler(
    req: Request,
    res: Response,
    next: NextFunction
    ) {
        try {
        ensureAdmin((req as any).user);
    
        const tpp=await getTPPBalance();

        const balance=Number(tpp.balance||0);

    
        res.json({
            message: "TPP Balance fetched successfully",
            balance,
            status:tpp.status||"success",
            statusCode:tpp["status-code"]||200,
            
        });
        } catch (err) {
        next(err);
        }
    }
