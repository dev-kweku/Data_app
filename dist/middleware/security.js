"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applySecurityMiddleware = applySecurityMiddleware;
// src/middleware/security.ts
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
function applySecurityMiddleware(app) {
    app.use((0, helmet_1.default)()); // Security headers
    app.use((0, cors_1.default)()); // Cross-origin requests
}
//# sourceMappingURL=security.js.map