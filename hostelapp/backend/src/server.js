const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = require('./app');
const { logger } = require('./middleware/logger.middleware');
const { initializeSocket } = require('./services/socket.service');

// ── Validate required env vars ──
const requiredEnvVars = ['JWT_SECRET', 'JWT_REFRESH_SECRET'];
for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]?.trim()) {
        logger.error(`Missing required environment variable: ${envVar}`);
        process.exit(1);
    }
}

const server = http.createServer(app);

// ── WebSocket Setup ──
initializeSocket(server);

// ── Graceful Shutdown ──
function shutdown(signal) {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
    // Force close after 10 s
    setTimeout(() => process.exit(1), 10_000);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', { reason: reason?.message || reason });
});

process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', { error: err.message, stack: err.stack });
    shutdown('uncaughtException');
});

// ── Start Server ──
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`🚀 Server v2.0.0 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = { app, server };
