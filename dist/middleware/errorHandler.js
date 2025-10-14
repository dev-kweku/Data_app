"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const errors_1 = require("../utils/errors");
function errorHandler(err, req, res, next) {
    console.error("[ErrorHandler]", err);
    if (err instanceof errors_1.AppError) {
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
//# sourceMappingURL=errorHandler.js.map