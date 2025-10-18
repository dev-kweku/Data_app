    import { Request, Response, NextFunction } from "express";
    import { PrismaClient, Role, TrxnType, TrxnStatus } from "@prisma/client";
    import bcrypt from "bcrypt";
    import { AppError } from "../utils/errors";
    import { getOrCreateWallet } from "../services/walletService";
    import { getTPPBalance, tppGetDataBundleList } from "../services/tppClient";
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
            create: { userId: user.id, rate: 0.035, modelType: "DISCOUNT" },
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

    export async function fundVendor(req: Request, res: Response, next: NextFunction) {
        try {
            // Ensure only admins can fund vendors
            const admin = (req as any).user;
            ensureAdmin(admin);
    
            const vendorId = req.params.vendorId;
            const { amount } = req.body;
    
            if (!vendorId || amount === undefined) {
                throw new AppError("vendorId & amount are required", 400);
            }
    
            const amt = Number(amount);
            if (isNaN(amt) || amt <= 0) {
                throw new AppError("Invalid amount", 400);
            }
    
            // Fetch TPP balance (read-only) — just for syncing
            const tpp = await getTPPBalance();
            const tppBalance = Number(tpp.balance || 0);
            if (isNaN(tppBalance)) throw new AppError("Invalid TPP balance response", 500);
    
            // Get admin wallet
            const adminWallet = await getOrCreateWallet(admin.id);
            let adminBalance = Number(adminWallet.balance || 0);
    
            // Sync admin wallet with TPP balance if admin wallet is lower
            if (adminBalance < amt && tppBalance >= amt) {
                const topUpAmount = Math.min(tppBalance, amt);
                await prisma.wallet.update({
                    where: { userId: admin.id },
                    data: { balance: { increment: topUpAmount } },
                });
                adminBalance += topUpAmount;
                console.log(`Synced admin wallet with TPP by GHS ${topUpAmount}`);
            }
    
            // Ensure admin has enough balance to fund vendor
            if (adminBalance < amt) {
                throw new AppError(
                    `Insufficient funds: Admin (${adminBalance}) < Amount (${amt})`,
                    400
                );
            }
    
            // Fund vendor inside a transaction
            await prisma.$transaction(async (tx) => {
                // Deduct from admin
                await tx.wallet.update({
                    where: { userId: admin.id },
                    data: { balance: { decrement: amt } },
                });
    
                // Credit vendor
                await tx.wallet.upsert({
                    where: { userId: vendorId },
                    update: { balance: { increment: amt } },
                    create: { userId: vendorId, balance: amt },
                });
    
                // Record internal transaction (no TPP b2c call)
                await tx.transaction.create({
                    data: {
                        trxnRef: `fund_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
                        userId: admin.id,
                        type: TrxnType.FUND_TRANSFER,
                        amount: amt,
                        recipient: vendorId,
                        status: TrxnStatus.SUCCESS,
                        apiResponse: { note: "Admin funded vendor (internal wallet transfer, synced with TPP)" },
                    },
                });
            });
    
            return res.status(200).json({
                status: "success",
                message: `Vendor funded successfully with GHS ${amt.toFixed(2)}.`,
                remainingTPPBalance: tppBalance, // optional: can show pre-sync balance
            });
    
        } catch (err: any) {
            console.error("Fund vendor error:", err.message);
            next(err);
        }
    }

    export async function getDataBundleList(req: Request, res: Response, next: NextFunction) {
        try {
            const admin = (req as any).user;
            if (!admin || admin.role !== "ADMIN")
                throw new AppError("Admin access only", 403);
    
            const networkId = Number(req.query.networkId);
            if (!networkId || isNaN(networkId)) {
                throw new AppError("networkId query parameter must be a number", 400);
            }
    
            let bundles: any[] = [];
            try {
                const tppBundles = await tppGetDataBundleList(networkId);
                if (Array.isArray(tppBundles)) bundles = tppBundles;
            } catch (tppErr) {
                console.error("TPP getDataBundleList failed:", tppErr);
                bundles = []; // fallback empty array
            }
    
            return res.status(200).json({ networkId, bundles });
        } catch (err) {
            console.error("getDataBundleList error:", err);
            return next(err);
        }
    }
    
    
    


    export async function listTransactions(req: Request, res: Response, next: NextFunction) {
        try {
            const user = req.user;
            if (!user || user.role !== "ADMIN") {
                return next(new AppError("Admin access only", 403));
            }
        
            const transactions = await prisma.transaction.findMany({
                include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                },
            orderBy: { createdAt: "desc" },
            take: 100,
            });
        
            const formatted = transactions.map((t) => ({
                id: t.id,
                trxnRef: t.trxnRef,
                type: t.type,
                amount: Number(t.amount),
                commission: Number(t.commission ?? 0),
                status: t.status,
                recipient: t.recipient,
                networkId: t.networkId,
                bundlePlanId: t.bundlePlanId,
                createdAt: t.createdAt,
                user: t.user,
            }));
        
            res.json({ transactions: formatted });
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
