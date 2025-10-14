"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
const logger_1 = __importDefault(require("./utils/logger"));
const helmet_1 = __importDefault(require("helmet"));
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const vendorRoutes_1 = __importDefault(require("./routes/vendorRoutes"));
const dotenv_1 = __importDefault(require("dotenv"));
const errors_1 = require("./utils/errors");
const rateLimiter_1 = require("./middleware/rateLimiter");
const errorHandler_1 = require("./middleware/errorHandler");
const security_1 = require("./middleware/security");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, morgan_1.default)("dev"));
app.use(express_1.default.json());
app.use(rateLimiter_1.generalLimiter);
app.use("/api/auth", rateLimiter_1.authLimiter);
app.use(errorHandler_1.errorHandler);
(0, security_1.applySecurityMiddleware)(app);
app.use((0, morgan_1.default)("combined", {
    stream: {
        write: (message) => logger_1.default.info(message.trim())
    }
}));
app.use("/api/auth", authRoutes_1.default);
app.use("/api/admin", adminRoutes_1.default);
app.use("/api/vendor", vendorRoutes_1.default);
// health
app.get("/health", (req, res) => res.json({ status: "ok" }));
// error handler
app.use((err, req, res, next) => {
    console.error(err);
    if (err instanceof errors_1.AppError) {
        return res.status(err.statusCode).json({ message: err.message });
    }
    res.status(err?.status || 500).json({ message: err?.message || "Internal Server Error" });
});
exports.default = app;
//# sourceMappingURL=app.js.map