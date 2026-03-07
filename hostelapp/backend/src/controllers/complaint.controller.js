const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');
const { notifyRole } = require('../services/socket.service');
const { cacheInvalidate } = require('../config/redis');

// ── Add Complaint ──
exports.addComplaint = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { complaint_type, category, priority, description, location } = req.body;
        const filepath = req.file ? `/uploads/${req.file.filename}` : null;

        // Get student internal ID
        const [students] = await pool.query('SELECT id FROM students WHERE student_id = ?', [studentId]);
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const [result] = await pool.query(
            `INSERT INTO complaints 
             (student_id, complaint_type, category, priority, description, filepath, location)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [students[0].id, complaint_type, category || 'other', priority || 'medium', description, filepath, location || null]
        );

        // Notify hostel managers about new complaint
        await notifyRole('hostel_manager', {
            title: 'New Complaint',
            message: `${complaint_type} complaint filed by ${studentId}: ${description.substring(0, 100)}`,
            type: priority === 'critical' ? 'error' : 'warning',
            module: 'complaint',
            referenceId: result.insertId,
            referenceType: 'complaint',
        });

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'CREATE', module: 'complaint',
            targetTable: 'complaints', targetId: result.insertId,
            newValues: { studentId, complaint_type, category, priority },
            req,
        });

        await cacheInvalidate('complaint:*');

        res.status(201).json({ message: 'Complaint submitted successfully.', id: result.insertId });
    } catch (err) {
        console.error('Add Complaint Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Update Complaint Status ──
exports.updateComplaintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, resolution_notes, assigned_to } = req.body;

        const [current] = await pool.query('SELECT * FROM complaints WHERE id = ?', [id]);
        if (current.length === 0) {
            return res.status(404).json({ message: 'Complaint not found.' });
        }

        const updates = ['status = ?'];
        const values = [status];

        if (resolution_notes) {
            updates.push('resolution_notes = ?');
            values.push(resolution_notes);
        }
        if (assigned_to) {
            updates.push('assigned_to = ?');
            values.push(assigned_to);
        }
        if (status === 'resolved') {
            updates.push('resolved_at = NOW()');
        }

        values.push(id);

        await pool.query(
            `UPDATE complaints SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // Notify student
        const [student] = await pool.query(
            'SELECT user_id FROM students WHERE id = ?',
            [current[0].student_id]
        );
        if (student.length > 0) {
            const { notifyUser } = require('../services/socket.service');
            await notifyUser(student[0].user_id, {
                title: `Complaint ${status}`,
                message: `Your ${current[0].complaint_type} complaint has been ${status}.`,
                type: status === 'resolved' ? 'success' : 'info',
                module: 'complaint',
                referenceId: parseInt(id),
                referenceType: 'complaint',
            });
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'UPDATE', module: 'complaint',
            targetTable: 'complaints', targetId: parseInt(id),
            oldValues: { status: current[0].status },
            newValues: { status, resolution_notes, assigned_to },
            req,
        });

        await cacheInvalidate('complaint:*');

        res.json({ message: 'Complaint status updated.' });
    } catch (err) {
        console.error('Update Complaint Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get Complaints by Student ──
exports.getComplaintsByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [students] = await pool.query('SELECT id FROM students WHERE student_id = ?', [studentId]);
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const [complaints] = await pool.query(
            `SELECT c.*, u.name as assigned_to_name
             FROM complaints c
             LEFT JOIN users u ON c.assigned_to = u.id
             WHERE c.student_id = ?
             ORDER BY c.created_at DESC`,
            [students[0].id]
        );

        res.json(complaints);
    } catch (err) {
        console.error('Get Complaints Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get All Complaints (Manager) ──
exports.getAllComplaints = async (req, res) => {
    try {
        const { status, priority, page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let where = '1=1';
        const params = [];

        if (status) {
            where += ' AND c.status = ?';
            params.push(status);
        }
        if (priority) {
            where += ' AND c.priority = ?';
            params.push(priority);
        }

        params.push(parseInt(limit), offset);

        const [complaints] = await pool.query(
            `SELECT c.*, s.student_id as student_code, u.name as student_name,
                    u2.name as assigned_to_name
             FROM complaints c
             JOIN students s ON c.student_id = s.id
             JOIN users u ON s.user_id = u.id
             LEFT JOIN users u2 ON c.assigned_to = u2.id
             WHERE ${where}
             ORDER BY 
                FIELD(c.priority, 'critical', 'high', 'medium', 'low'),
                c.created_at DESC
             LIMIT ? OFFSET ?`,
            params
        );

        res.json(complaints);
    } catch (err) {
        console.error('Get All Complaints Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
