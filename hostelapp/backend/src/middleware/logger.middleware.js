const winston = require('winston');
const path = require('path');

// ── Winston Logger ──
const isVercel = !!process.env.VERCEL;

const transports = [];

if (!isVercel) {
    // File transports only when running on a persistent server
    transports.push(
        new winston.transports.File({
            filename: path.join(__dirname, '..', '..', 'logs', 'error.log'),
            level: 'error',
            maxsize: 5242880,  // 5MB
            maxFiles: 5,
        }),
        new winston.transports.File({
            filename: path.join(__dirname, '..', '..', 'logs', 'combined.log'),
            maxsize: 5242880,
            maxFiles: 10,
        })
    );
}

// Console transport for Vercel (serverless) and development
if (isVercel || process.env.NODE_ENV !== 'production') {
    transports.push(
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            ),
        })
    );
}

const logger = winston.createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'hostel-api' },
    transports,
});

// ── Request Logger Middleware ──
function requestLogger(req, res, next) {
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            status: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            userId: req.user?.id || null,
        };

        if (res.statusCode >= 400) {
            logger.warn('Request failed', logData);
        } else {
            logger.info('Request completed', logData);
        }
    });

    next();
}

module.exports = { logger, requestLogger };
