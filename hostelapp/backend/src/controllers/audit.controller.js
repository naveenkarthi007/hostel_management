const { logger } = require('../middleware/logger.middleware');
const pool = require('../config/db').promise;

// ── Get Audit Logs ──
exports.getLogs = async (req, res) => {
    try {
        const { module, action, userId, page = 1, limit = 50, from, to } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = '1=1';
        const params = [];

        if (module) { where += ' AND al.module = ?'; params.push(module); }
        if (action) { where += ' AND al.action = ?'; params.push(action); }
        if (userId) { where += ' AND al.user_id = ?'; params.push(parseInt(userId)); }
        if (from) { where += ' AND al.created_at >= ?'; params.push(from); }
        if (to) { where += ' AND al.created_at <= ?'; params.push(to); }

        params.push(parseInt(limit), offset);

        const [logs] = await pool.query(
            `SELECT al.*, u.name as user_name
             FROM audit_logs al
             LEFT JOIN users u ON al.user_id = u.id
             WHERE ${where}
             ORDER BY al.created_at DESC
             LIMIT ? OFFSET ?`,
            params
        );

        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total FROM audit_logs al WHERE ${where.replace(/ AND al\./g, ' AND al.')}`,
            params.slice(0, -2) // Remove limit and offset
        );

        res.json({
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
            },
        });
    } catch (err) {
        logger.error('Get Audit Logs Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get Audit Log Stats ──
exports.getStats = async (req, res) => {
    try {
        const [byModule] = await pool.query(
            `SELECT module, COUNT(*) as count FROM audit_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY module ORDER BY count DESC`
        );

        const [byAction] = await pool.query(
            `SELECT action, COUNT(*) as count FROM audit_logs
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
             GROUP BY action ORDER BY count DESC`
        );

        const [recentLogins] = await pool.query(
            `SELECT al.user_email, al.ip_address, al.created_at, al.user_agent
             FROM audit_logs al
             WHERE al.action IN ('LOGIN', 'LOGIN_FAILED')
             ORDER BY al.created_at DESC LIMIT 20`
        );

        res.json({ byModule, byAction, recentLogins });
    } catch (err) {
        logger.error('Audit Stats Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};
