const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');
const { notifyUser } = require('../services/socket.service');
const { cacheInvalidate } = require('../config/redis');

// ── Apply Leave ──
exports.applyLeave = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { leaveType, fromDate, toDate, fromTime, toTime, reason } = req.body;

        // Get student's internal ID and warden
        const [students] = await pool.query(
            'SELECT id, warden_id FROM students WHERE student_id = ?',
            [studentId]
        );
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const student = students[0];

        if (!student.warden_id) {
            return res.status(400).json({ message: 'No warden assigned to this student.' });
        }

        // Check for overlapping leave
        const [existing] = await pool.query(
            `SELECT id FROM leave_requests 
             WHERE student_id = ? AND status IN ('pending', 'approved')
             AND ((from_date <= ? AND to_date >= ?) OR (from_date <= ? AND to_date >= ?))`,
            [student.id, toDate, fromDate, fromDate, toDate]
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: 'Overlapping leave request exists.' });
        }

        const [result] = await pool.query(
            `INSERT INTO leave_requests 
             (student_id, warden_id, leave_type, from_date, to_date, from_time, to_time, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [student.id, student.warden_id, leaveType, fromDate, toDate, fromTime || null, toTime || null, reason]
        );

        // Notify warden
        const [wardenUser] = await pool.query(
            'SELECT user_id FROM wardens WHERE id = ?', [student.warden_id]
        );
        if (wardenUser.length > 0) {
            await notifyUser(wardenUser[0].user_id, {
                title: 'New Leave Request',
                message: `Student ${studentId} applied for ${leaveType} from ${fromDate} to ${toDate}`,
                type: 'info',
                module: 'leave',
                referenceId: result.insertId,
                referenceType: 'leave_request',
            });
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'CREATE', module: 'leave',
            targetTable: 'leave_requests', targetId: result.insertId,
            newValues: { studentId, leaveType, fromDate, toDate, reason },
            req,
        });

        await cacheInvalidate('leave:*');

        res.status(201).json({ message: 'Leave applied successfully.', id: result.insertId });
    } catch (err) {
        console.error('Apply Leave Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get Leaves by Student ──
exports.getLeavesByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [student] = await pool.query('SELECT id FROM students WHERE student_id = ?', [studentId]);
        if (student.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const [leaves] = await pool.query(
            `SELECT lr.*, u.name as approved_by_name
             FROM leave_requests lr
             LEFT JOIN users u ON lr.approved_by = u.id
             WHERE lr.student_id = ?
             ORDER BY lr.created_at DESC
             LIMIT 20`,
            [student[0].id]
        );

        res.json(leaves);
    } catch (err) {
        console.error('Get Leaves Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get All Pending Leaves (Warden View) ──
exports.getAllLeaves = async (req, res) => {
    try {
        const { status = 'pending', page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const [leaves] = await pool.query(
            `SELECT lr.*, s.student_id as student_code, u.name as student_name, u.email as student_email
             FROM leave_requests lr
             JOIN students s ON lr.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE lr.status = ?
             ORDER BY lr.created_at DESC
             LIMIT ? OFFSET ?`,
            [status, parseInt(limit), offset]
        );

        const [countResult] = await pool.query(
            'SELECT COUNT(*) as total FROM leave_requests WHERE status = ?',
            [status]
        );

        res.json({
            data: leaves,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0].total,
                totalPages: Math.ceil(countResult[0].total / parseInt(limit)),
            }
        });
    } catch (err) {
        console.error('Get All Leaves Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Update Leave Status (Approve/Reject) ──
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { leaveId } = req.params;
        const { status, rejectionReason } = req.body;

        // Get current leave state for audit
        const [current] = await pool.query('SELECT * FROM leave_requests WHERE id = ?', [leaveId]);
        if (current.length === 0) {
            return res.status(404).json({ message: 'Leave request not found.' });
        }

        if (current[0].status !== 'pending') {
            return res.status(400).json({ message: 'Can only update pending requests.' });
        }

        await pool.query(
            `UPDATE leave_requests 
             SET status = ?, approved_by = ?, approved_at = NOW(), rejection_reason = ?
             WHERE id = ?`,
            [status, req.user.id, rejectionReason || null, leaveId]
        );

        // Notify student
        const [student] = await pool.query(
            'SELECT user_id FROM students WHERE id = ?', [current[0].student_id]
        );
        if (student.length > 0) {
            await notifyUser(student[0].user_id, {
                title: `Leave ${status.charAt(0).toUpperCase() + status.slice(1)}`,
                message: `Your leave request from ${current[0].from_date} to ${current[0].to_date} has been ${status}.`,
                type: status === 'approved' ? 'success' : 'warning',
                module: 'leave',
                referenceId: parseInt(leaveId),
                referenceType: 'leave_request',
            });
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'UPDATE', module: 'leave',
            targetTable: 'leave_requests', targetId: parseInt(leaveId),
            oldValues: { status: current[0].status },
            newValues: { status, rejectionReason },
            req,
        });

        await cacheInvalidate('leave:*');

        res.json({ message: `Leave request ${status}.` });
    } catch (err) {
        console.error('Update Leave Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Delete Leave (Only Pending) ──
exports.deleteLeave = async (req, res) => {
    try {
        const { leaveId } = req.params;

        const [result] = await pool.query(
            'DELETE FROM leave_requests WHERE id = ? AND status = ?',
            [leaveId, 'pending']
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Pending leave not found.' });
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'DELETE', module: 'leave',
            targetTable: 'leave_requests', targetId: parseInt(leaveId),
            req,
        });

        await cacheInvalidate('leave:*');

        res.json({ message: 'Leave request deleted.' });
    } catch (err) {
        console.error('Delete Leave Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
