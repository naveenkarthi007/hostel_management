const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

const { logger } = require('../middleware/logger.middleware');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 20,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Test connection on startup
pool.getConnection((err, connection) => {
    if (err) {
        logger.error('Database connection failed', { error: err.message });
        process.exit(1);
    }
    logger.info('✅ MySQL connected');
    connection.release();
});

module.exports = pool;
module.exports.promise = pool.promise();
