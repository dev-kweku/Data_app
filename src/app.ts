    import express from "express";
    import morgan from "morgan";
    import logger from "./utils/logger";
    import helmet from "helmet";
    import authRoutes from "./routes/authRoutes";
    import adminRoutes from "./routes/adminRoutes";
    import vendorRoutes from "./routes/vendorRoutes";
    import dotenv from "dotenv";
    import { AppError } from "./utils/errors";
    import { generalLimiter, authLimiter } from "./middleware/rateLimiter";
    import { errorHandler } from "./middleware/errorHandler";
    import { applySecurityMiddleware } from "./middleware/security";

    dotenv.config();

    const app = express();
    app.use(helmet());
    app.use(morgan("dev"));
    app.use(express.json());
    app.use(generalLimiter);
    app.use("/api/auth", authLimiter);
    app.use(errorHandler)
    applySecurityMiddleware(app)

    app.use(morgan("combined", {
        stream: {
            write: (message) => logger.info(message.trim())
            }
        }));

        app.use("/api/auth", authRoutes);
        app.use("/api/admin", adminRoutes);
        app.use("/api/vendor", vendorRoutes);

    // health
    app.get("/health", (req, res) => res.json({ status: "ok" }));

    // error handler
    app.use((err: any, req: any, res: any, next: any) => {
    console.error(err);
    if (err instanceof AppError) {
        return res.status(err.statusCode).json({ message: err.message });
    }
    res.status(err?.status || 500).json({ message: err?.message || "Internal Server Error" });
    });

    export default app;
