const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { requestLogger } = require('./middleware/logger.middleware');
const { errorHandler } = require('./middleware/error.middleware');
const { sanitize } = require('./middleware/sanitize.middleware');

// ── Route imports ──
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const leaveRoutes = require('./routes/leave.routes');
const wardenLeaveRoutes = require('./routes/wardenLeave.routes');
const complaintRoutes = require('./routes/complaint.routes');
const roomRoutes = require('./routes/room.routes');
const mealRoutes = require('./routes/meal.routes');
const labRoutes = require('./routes/lab.routes');
const notificationRoutes = require('./routes/notification.routes');
const analyticsRoutes = require('./routes/analytics.routes');
const auditRoutes = require('./routes/audit.routes');
const bulkRoutes = require('./routes/bulk.routes');

const app = express();

// ═══════════════════════════════════════════
// SECURITY MIDDLEWARE
// ═══════════════════════════════════════════

// Secure HTTP headers
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://accounts.google.com", "https://apis.google.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: isProduction
                ? ["'self'", "https:", "wss:"]
                : ["'self'", "http://localhost:*", "ws://localhost:*"],
        }
    }
}));

// Prevent HTTP parameter pollution (replaces xss-clean)
app.use(hpp());

// CORS
app.use(cors({
    origin: process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(',')
        : (process.env.VERCEL ? true : 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ═══════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════

const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000,
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/', apiLimiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: { message: 'Too many login attempts, please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/auth/', authLimiter);

// ═══════════════════════════════════════════
// BODY PARSING & SANITIZATION
// ═══════════════════════════════════════════

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// XSS sanitization on req.body / req.query / req.params (replaces xss-clean)
app.use(sanitize);

// ═══════════════════════════════════════════
// STATIC FILES
// ═══════════════════════════════════════════

// Suppress favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// ═══════════════════════════════════════════
// REQUEST LOGGING (winston)
// ═══════════════════════════════════════════

app.use(requestLogger);

// ═══════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/warden-leave', wardenLeaveRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/meals', mealRoutes);
app.use('/api/lab', labRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/bulk', bulkRoutes);

// ═══════════════════════════════════════════
// HEALTH CHECK
// ═══════════════════════════════════════════

app.get('/api/health', (req, res) => {
    const promisePool = require('./config/db').promise;
    promisePool.query('SELECT 1')
        .then(() => {
            res.json({
                status: 'ok',
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                db: 'connected',
            });
        })
        .catch(() => {
            res.status(503).json({
                status: 'degraded',
                version: '2.0.0',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                environment: process.env.NODE_ENV || 'development',
                db: 'error',
                message: 'Database unavailable',
            });
        });
});

// ═══════════════════════════════════════════
// SPA FALLBACK
// ═══════════════════════════════════════════

if (!process.env.VERCEL) {
    // Local/Docker: serve frontend for unmatched routes
    app.get('/{*splat}', (req, res) => {
        res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'index.html'));
    });
} else {
    // Vercel: return 404 JSON for unmatched API routes (frontend handled by Vercel routing)
    app.use((req, res) => {
        res.status(404).json({ message: 'Not found' });
    });
}

// ═══════════════════════════════════════════
// GLOBAL ERROR HANDLER (must be last)
// ═══════════════════════════════════════════

app.use(errorHandler);

module.exports = app;
