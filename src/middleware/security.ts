// src/middleware/security.ts
import helmet from "helmet";
import cors from "cors";
import express from "express";

export function applySecurityMiddleware(app: express.Application) {
  app.use(helmet()); // Security headers
  app.use(cors()); // Cross-origin requests

}
