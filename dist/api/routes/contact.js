"use strict";
/**
 * src/api/routes/contact.ts
 * Public Contact Submission Route with Zod Validation, Anti-Spam Honeypot,
 * Cloudflare Turnstile Verification & Idempotent Ingestion
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const enquiry_service_1 = require("../../services/enquiry.service");
const config_1 = require("../../config");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
// Rate limiter: configurable max requests per 15 minutes per IP
const contactLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: config_1.config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many submissions from this IP address. Please wait 15 minutes before trying again.'
    }
});
router.use(contactLimiter);
// Zod schema for input validation
const contactSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must be under 100 characters'),
    email: zod_1.z.string().email('Invalid email address').max(255),
    message: zod_1.z.string().min(5, 'Message must be at least 5 characters').max(5000, 'Message must be under 5000 characters'),
    _gotcha: zod_1.z.string().optional(),
    turnstileToken: zod_1.z.string().optional()
});
async function verifyTurnstile(token, clientIp) {
    if (!config_1.config.turnstileSecretKey || config_1.config.turnstileSecretKey.startsWith('0x4AAAA')) {
        // Dev bypass
        return true;
    }
    if (!token)
        return false;
    try {
        const params = new URLSearchParams();
        params.append('secret', config_1.config.turnstileSecretKey);
        params.append('response', token);
        if (clientIp)
            params.append('remoteip', clientIp);
        const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body: params
        });
        const data = await res.json();
        return Boolean(data && data.success);
    }
    catch (err) {
        config_1.logger.warn({ err: err.message }, '[Turnstile] Verification call failed');
        return false;
    }
}
router.post('/', (0, validate_1.validateBody)(contactSchema), async (req, res) => {
    try {
        const { name, email, message, _gotcha, turnstileToken } = req.body;
        // 1. Honeypot check (silently deceive bots)
        if (_gotcha && _gotcha.trim() !== '') {
            config_1.logger.warn({ ip: req.ip }, '[AntiSpam] Honeypot triggered; silent drop');
            return res.status(200).json({
                success: true,
                message: 'Thank you! Your message has been received.'
            });
        }
        // 2. Cloudflare Turnstile verification
        const clientIp = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress;
        const isTurnstileValid = await verifyTurnstile(turnstileToken, clientIp);
        if (!isTurnstileValid) {
            return res.status(400).json({
                success: false,
                error: 'CAPTCHA verification failed. Please refresh and try again.'
            });
        }
        // 3. Extract Idempotency-Key from header
        const idempotencyKey = req.headers['idempotency-key'] || null;
        // 4. Create Enquiry with Idempotency & Queue dispatch
        const { enquiry, isDuplicate } = await enquiry_service_1.EnquiryService.createEnquiry({
            name,
            email,
            message,
            idempotencyKey,
            ipAddress: clientIp || null,
            userAgent: req.headers['user-agent'] || null
        });
        if (isDuplicate) {
            return res.status(200).json({
                success: true,
                message: `Thank you for reaching out, ${enquiry.name}! We have your submission on file.`,
                data: { id: enquiry.id, isDuplicate: true }
            });
        }
        return res.status(201).json({
            success: true,
            message: `Thank you for reaching out, ${enquiry.name}! Your message has been received.`,
            data: { id: enquiry.id, isDuplicate: false }
        });
    }
    catch (err) {
        config_1.logger.error({ err: err.message }, '[Contact Route Error]');
        return res.status(500).json({
            success: false,
            error: 'An internal error occurred while processing your message.'
        });
    }
});
exports.default = router;
//# sourceMappingURL=contact.js.map