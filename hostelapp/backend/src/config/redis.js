let redisClient = null;

async function getRedisClient() {
    if (process.env.REDIS_ENABLED !== 'true') return null;

    if (!redisClient || !redisClient.isReady) {
        // Clean up stale client if it exists
        if (redisClient) {
            try { await redisClient.quit(); } catch (_) {}
            redisClient = null;
        }

        const { createClient } = require('redis');
        redisClient = createClient({
            socket: {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
            },
            password: process.env.REDIS_PASSWORD || undefined
        });

        const { logger } = require('../middleware/logger.middleware');
        redisClient.on('error', (err) => logger.error('Redis Error', { error: err.message }));
        redisClient.on('connect', () => logger.info('✅ Redis connected'));

        await redisClient.connect();
    }
    return redisClient;
}

// Cache helper: get or compute
async function cacheGet(key, computeFn, ttlSeconds = 300) {
    const client = await getRedisClient();
    if (!client) return computeFn();

    const cached = await client.get(key);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (parseErr) {
            // Corrupted cache entry — delete it and fall through to recompute
            await client.del(key).catch(() => {});
        }
    }

    const result = await computeFn();
    await client.setEx(key, ttlSeconds, JSON.stringify(result));
    return result;
}

// Invalidate cache by pattern
async function cacheInvalidate(pattern) {
    const client = await getRedisClient();
    if (!client) return;

    const keys = await client.keys(pattern);
    if (keys.length > 0) {
        await client.del(keys);
    }
}

module.exports = { getRedisClient, cacheGet, cacheInvalidate };
