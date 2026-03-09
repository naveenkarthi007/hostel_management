const http = require('http');
const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = require('./app');
const { logger } = require('./middleware/logger.middleware');
const { initializeSocket } = require('./services/socket.service');

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

// ── Start Server ──
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    logger.info(`🚀 Server v2.0.0 running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = { app, server };
