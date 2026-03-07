const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');

// ── Request Room Change ──
exports.requestChange = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { requested_hostel_id, requested_floor, requested_room_id, reason } = req.body;

        const [students] = await pool.query(
            'SELECT id, room_id FROM students WHERE student_id = ?',
            [studentId]
        );
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Check for existing pending request
        const [existing] = await pool.query(
            "SELECT id FROM room_change_requests WHERE student_id = ? AND status = 'pending'",
            [students[0].id]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: 'You already have a pending room change request.' });
        }

        const [result] = await pool.query(
            `INSERT INTO room_change_requests 
             (student_id, current_room_id, requested_hostel_id, requested_floor, requested_room_id, reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [students[0].id, students[0].room_id, requested_hostel_id || null, requested_floor || null, requested_room_id || null, reason]
        );

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'CREATE', module: 'room',
            targetTable: 'room_change_requests', targetId: result.insertId,
            newValues: { studentId, reason },
            req,
        });

        res.status(201).json({ message: 'Room change request submitted.', id: result.insertId });
    } catch (err) {
        console.error('Room Change Request Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get All Room Change Requests ──
exports.getAll = async (req, res) => {
    try {
        const { status = 'pending' } = req.query;

        const [requests] = await pool.query(
            `SELECT rcr.*, s.student_id as student_code, u.name as student_name,
                    h1.name as current_hostel, r1.room_number as current_room,
                    h2.name as requested_hostel, r2.room_number as requested_room
             FROM room_change_requests rcr
             JOIN students s ON rcr.student_id = s.id
             JOIN users u ON s.user_id = u.id
             LEFT JOIN rooms r1 ON rcr.current_room_id = r1.id
             LEFT JOIN hostels h1 ON r1.hostel_id = h1.id
             LEFT JOIN rooms r2 ON rcr.requested_room_id = r2.id
             LEFT JOIN hostels h2 ON rcr.requested_hostel_id = h2.id
             WHERE rcr.status = ?
             ORDER BY rcr.created_at DESC`,
            [status]
        );

        res.json(requests);
    } catch (err) {
        console.error('Get Room Requests Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Approve/Reject Room Change ──
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status.' });
        }

        const [current] = await pool.query('SELECT * FROM room_change_requests WHERE id = ?', [id]);
        if (current.length === 0) {
            return res.status(404).json({ message: 'Request not found.' });
        }

        await pool.query(
            'UPDATE room_change_requests SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
            [status, req.user.id, id]
        );

        // If approved, update student's room
        if (status === 'approved' && current[0].requested_room_id) {
            await pool.query(
                'UPDATE students SET room_id = ?, hostel_id = COALESCE(?, hostel_id) WHERE id = ?',
                [current[0].requested_room_id, current[0].requested_hostel_id, current[0].student_id]
            );

            // Update room occupancy
            if (current[0].current_room_id) {
                await pool.query(
                    'UPDATE rooms SET current_occupancy = GREATEST(current_occupancy - 1, 0) WHERE id = ?',
                    [current[0].current_room_id]
                );
            }
            await pool.query(
                'UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = ?',
                [current[0].requested_room_id]
            );

            await pool.query(
                'UPDATE room_change_requests SET completed_at = NOW(), status = ? WHERE id = ?',
                ['completed', id]
            );
        }

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'UPDATE', module: 'room',
            targetTable: 'room_change_requests', targetId: parseInt(id),
            oldValues: { status: current[0].status },
            newValues: { status },
            req,
        });

        res.json({ message: `Room change request ${status}.` });
    } catch (err) {
        console.error('Update Room Status Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
