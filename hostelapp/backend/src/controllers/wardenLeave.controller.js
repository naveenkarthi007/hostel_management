const { logger } = require('../middleware/logger.middleware');
const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');
const { notifyRole } = require('../services/socket.service');
const { cacheInvalidate } = require('../config/redis');

// ── Apply Warden Leave ──
exports.applyLeave = async (req, res) => {
    try {
        const { wardenId } = req.params;
        const { leavetype, from_date, to_date, reason, contact, alternate_warden } = req.body;

        const [wardenRows] = await pool.query(
            'SELECT id, warden_id FROM wardens WHERE warden_id = ?',
            [wardenId]
        );
        if (!wardenRows.length) {
            return res.status(404).json({ message: 'Warden not found.' });
        }

        const warden = wardenRows[0];

        // Find alternate warden (optional)
        let altWardenId = null;
        if (contact) {
            const [altRows] = await pool.query(
                'SELECT id FROM wardens WHERE contact = ? LIMIT 1',
                [contact]
            );
            if (altRows.length > 0) {
                altWardenId = altRows[0].id;
            } else {
                return res.status(404).json({ message: 'Alternate warden with given contact not found.' });
            }
        }

        // Check overlapping dates
        const [existing] = await pool.query(
            `SELECT id FROM warden_leave_requests 
             WHERE warden_id = ? AND status != 'rejected'
             AND ((from_date <= ? AND to_date >= ?) OR (from_date <= ? AND to_date >= ?))`,
            [warden.warden_id, to_date, from_date, from_date, to_date]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: 'Overlapping leave request exists.' });
        }

        const [result] = await pool.query(
            `INSERT INTO warden_leave_requests 
             (warden_id, leave_type, from_date, to_date, reason, alternate_warden_id, contact, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [warden.warden_id, leavetype, from_date, to_date, reason, altWardenId, contact || null]
        );

        // Notify hostel managers
        await notifyRole('hostel_manager', {
            title: 'Warden Leave Request',
            message: `Warden ${wardenId} requested leave from ${from_date} to ${to_date}`,
            type: 'info',
            module: 'warden_leave',
            referenceId: result.insertId,
            referenceType: 'warden_leave_request',
        });

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'CREATE', module: 'warden_leave',
            targetTable: 'warden_leave_requests', targetId: result.insertId,
            newValues: { wardenId, leavetype, from_date, to_date },
            req,
        });

        res.status(201).json({ message: 'Leave request submitted.' });
    } catch (err) {
        logger.error('Warden Apply Leave Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Delete Warden Leave ──
exports.deleteLeave = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            `DELETE FROM warden_leave_requests WHERE id = ? AND status = 'pending'`,
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending leave not found.' });
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'DELETE', module: 'warden_leave',
            targetTable: 'warden_leave_requests', targetId: parseInt(id),
            req,
        });

        res.json({ message: 'Leave request deleted.' });
    } catch (err) {
        logger.error('Delete Warden Leave Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Update Warden Leave Status ──
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        const [current] = await pool.query('SELECT * FROM warden_leave_requests WHERE id = ?', [id]);
        if (current.length === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }

        await pool.query(
            'UPDATE warden_leave_requests SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
            [status, req.user.id, id]
        );

        // Notify the warden
        const [warden] = await pool.query('SELECT user_id FROM wardens WHERE warden_id = ?', [current[0].warden_id]);
        if (warden.length > 0) {
            const { notifyUser } = require('../services/socket.service');
            await notifyUser(warden[0].user_id, {
                title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: `Your leave request has been ${status}.`,
                type: status === 'approved' ? 'success' : 'warning',
                module: 'warden_leave',
                referenceId: parseInt(id),
                referenceType: 'warden_leave_request',
            });
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'UPDATE', module: 'warden_leave',
            targetTable: 'warden_leave_requests', targetId: parseInt(id),
            oldValues: { status: current[0].status },
            newValues: { status },
            req,
        });

        res.json({ message: `Leave request ${status}.` });
    } catch (err) {
        logger.error('Update Warden Leave Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get All Warden Leaves ──
exports.getAllLeaves = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;

        let where = '1=1';
        const params = [];
        if (status && status !== 'all') {
            where += ' AND wl.status = ?';
            params.push(status);
        }

        const [rows] = await pool.query(
            `SELECT wl.*, 
                    u1.name AS warden_name,
                    u2.name AS alternate_warden_name
             FROM warden_leave_requests wl
             JOIN wardens w1 ON wl.warden_id = w1.warden_id
             JOIN users u1 ON w1.user_id = u1.id
             LEFT JOIN wardens w2 ON wl.alternate_warden_id = w2.id
             LEFT JOIN users u2 ON w2.user_id = u2.id
             WHERE ${where}
             ORDER BY wl.created_at DESC`,
            params
        );

        res.json(rows);
    } catch (err) {
        logger.error('Get Warden Leaves Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};
