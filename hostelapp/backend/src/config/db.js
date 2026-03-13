const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const { logger } = require('../middleware/logger.middleware');

const poolConfig = {
    host: (process.env.DB_HOST || '').trim(),
    port: parseInt(process.env.DB_PORT) || 3306,
    user: (process.env.DB_USER || '').trim(),
    password: (process.env.DB_PASSWORD || '').trim(),
    database: (process.env.DB_NAME || '').trim(),
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

// Enable SSL for cloud databases (Aiven, PlanetScale, Railway, etc.)
if (process.env.DB_SSL?.trim() === 'true') {
    poolConfig.ssl = { rejectUnauthorized: true };
}

const pool = mysql.createPool(poolConfig);

// Test connection on startup (don't exit process in serverless)
pool.getConnection((err, connection) => {
    if (err) {
        logger.error('Database connection failed', { error: err.message });
        if (!process.env.VERCEL) {
            process.exit(1);
        } else {
            logger.error('Running on Vercel — DB connection failed at startup. All queries will fail.');
        }
        return;
    }
    logger.info('✅ MySQL connected');
    connection.release();
});

module.exports = pool;
module.exports.promise = pool.promise();
