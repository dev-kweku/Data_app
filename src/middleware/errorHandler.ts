    // src/middleware/errorHandler.ts
    import { Request, Response, NextFunction } from "express";
    import { AppError } from "../utils/errors";

    export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
    console.error("[ErrorHandler]", err);

    if (err instanceof AppError) {
        return res.status(err.statusCode).json({
        status: "error",
        message: err.message,
        });
    }

    res.status(500).json({
        status: "error",
        message: "Internal Server Error",
        error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
    }
