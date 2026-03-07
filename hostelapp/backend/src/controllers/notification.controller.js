const pool = require('../config/db').promise;

// ── Get User's Notifications ──
exports.getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = 'user_id = ?';
        const params = [req.user.id];

        if (unreadOnly === 'true') {
            where += ' AND is_read = FALSE';
        }

        params.push(parseInt(limit), offset);

        const [notifications] = await pool.query(
            `SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            params
        );

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total, SUM(CASE WHEN is_read = FALSE THEN 1 ELSE 0 END) as unread FROM notifications WHERE user_id = ?',
            [req.user.id]
        );

        res.json({
            data: notifications,
            total: countResult[0].total,
            unread: countResult[0].unread,
        });
    } catch (err) {
        console.error('Get Notifications Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Mark Single as Read ──
exports.markRead = async (req, res) => {
    try {
        const { id } = req.params;
        await pool.query(
            'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?',
            [id, req.user.id]
        );
        res.json({ message: 'Marked as read.' });
    } catch (err) {
        console.error('Mark Read Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Mark All as Read ──
exports.markAllRead = async (req, res) => {
    try {
        await pool.query(
            'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
            [req.user.id]
        );
        res.json({ message: 'All marked as read.' });
    } catch (err) {
        console.error('Mark All Read Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
