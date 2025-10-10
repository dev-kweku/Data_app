    import rateLimit from "express-rate-limit";

    export const generalLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 120, // limit each IP to 120 requests per windowMs
    message: { message: "Too many requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    });

    export const authLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: { message: "Too many auth attempts, try in a minute." }
    });
