const { logger } = require('../middleware/logger.middleware');
const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');

// ── Get Available Slots ──
exports.getSlots = async (req, res) => {
    try {
        const { date, venue } = req.query;

        let where = 'cs.is_active = TRUE';
        const params = [];

        if (date) { where += ' AND cs.slot_date = ?'; params.push(date); }
        if (venue) { where += ' AND cs.venue = ?'; params.push(venue); }

        const [slots] = await pool.query(
            `SELECT cs.*, 
                    (cs.total_systems - COALESCE(booked.count, 0)) as available
             FROM computerlab_slots cs
             LEFT JOIN (
                 SELECT slot_id, COUNT(*) as count 
                 FROM computer_bookings 
                 WHERE status = 'booked' 
                 GROUP BY slot_id
             ) booked ON cs.id = booked.slot_id
             WHERE ${where}
             ORDER BY cs.slot_date, cs.from_time`,
            params
        );

        res.json(slots);
    } catch (err) {
        logger.error('Get Slots Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Book a System ──
exports.bookSystem = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { slot_id, system_no } = req.body;

        const [students] = await pool.query('SELECT id, student_id as sid FROM students WHERE student_id = ?', [studentId]);
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        // Check slot exists and system is available
        const [slot] = await pool.query('SELECT * FROM computerlab_slots WHERE id = ? AND is_active = TRUE', [slot_id]);
        if (slot.length === 0) {
            return res.status(404).json({ message: 'Slot not found.' });
        }

        if (system_no > slot[0].total_systems) {
            return res.status(400).json({ message: 'Invalid system number.' });
        }

        const [result] = await pool.query(
            'INSERT INTO computer_bookings (student_id, slot_id, system_no) VALUES (?, ?, ?)',
            [students[0].sid, slot_id, system_no]
        );

        // Update available count
        await pool.query(
            'UPDATE computerlab_slots SET available_systems = GREATEST(available_systems - 1, 0) WHERE id = ?',
            [slot_id]
        );

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'CREATE', module: 'lab',
            targetTable: 'computer_bookings', targetId: result.insertId,
            newValues: { studentId, slot_id, system_no },
            req,
        });

        res.status(201).json({ message: 'System booked successfully.', id: result.insertId });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'This system is already booked for this slot.' });
        }
        logger.error('Book System Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Cancel Booking ──
exports.cancelBooking = async (req, res) => {
    try {
        const { id } = req.params;

        const [booking] = await pool.query('SELECT * FROM computer_bookings WHERE id = ?', [id]);
        if (booking.length === 0) {
            return res.status(404).json({ message: 'Booking not found.' });
        }

        await pool.query("UPDATE computer_bookings SET status = 'cancelled' WHERE id = ?", [id]);
        await pool.query(
            'UPDATE computerlab_slots SET available_systems = available_systems + 1 WHERE id = ?',
            [booking[0].slot_id]
        );

        res.json({ message: 'Booking cancelled.' });
    } catch (err) {
        logger.error('Cancel Booking Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Create Slot (Admin/Manager) ──
exports.createSlot = async (req, res) => {
    try {
        const { venue, from_time, to_time, slot_date, total_systems } = req.body;

        const [result] = await pool.query(
            `INSERT INTO computerlab_slots (venue, from_time, to_time, slot_date, total_systems, available_systems)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [venue, from_time, to_time, slot_date, total_systems, total_systems]
        );

        res.status(201).json({ message: 'Slot created.', id: result.insertId });
    } catch (err) {
        logger.error('Create Slot Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};
