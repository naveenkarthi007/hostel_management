const { logger } = require('../middleware/logger.middleware');
const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');

// ── Request Meal ──
exports.requestMeal = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { meal_date, meal_type, request_type, special_notes } = req.body;

        const [students] = await pool.query('SELECT id, student_id as sid FROM students WHERE student_id = ?', [studentId]);
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const [result] = await pool.query(
            `INSERT INTO meal_requests (student_id, meal_date, meal_type, request_type, special_notes)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE request_type = VALUES(request_type), special_notes = VALUES(special_notes), status = 'requested'`,
            [students[0].sid, meal_date, meal_type, request_type || 'opt_in', special_notes || null]
        );

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'CREATE', module: 'meal',
            targetTable: 'meal_requests', targetId: result.insertId,
            newValues: { studentId, meal_date, meal_type, request_type },
            req,
        });

        res.status(201).json({ message: 'Meal request submitted.' });
    } catch (err) {
        logger.error('Meal Request Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get Student's Meal Requests ──
exports.getByStudent = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [students] = await pool.query('SELECT id, student_id as sid FROM students WHERE student_id = ?', [studentId]);
        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const [meals] = await pool.query(
            'SELECT * FROM meal_requests WHERE student_id = ? ORDER BY meal_date DESC, FIELD(meal_type, "breakfast", "lunch", "snacks", "dinner") LIMIT 30',
            [students[0].sid]
        );

        res.json(meals);
    } catch (err) {
        logger.error('Get Meals Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get All Meal Requests (Manager) ──
exports.getAll = async (req, res) => {
    try {
        const { date, meal_type } = req.query;

        let where = '1=1';
        const params = [];

        if (date) { where += ' AND mr.meal_date = ?'; params.push(date); }
        if (meal_type) { where += ' AND mr.meal_type = ?'; params.push(meal_type); }

        const [meals] = await pool.query(
            `SELECT mr.*, s.student_id as student_code, u.name as student_name
             FROM meal_requests mr
             JOIN students s ON mr.student_id = s.student_id
             JOIN users u ON s.user_id = u.id
             WHERE ${where}
             ORDER BY mr.meal_date DESC, mr.meal_type`,
            params
        );

        res.json(meals);
    } catch (err) {
        logger.error('Get All Meals Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Cancel Meal Request ──
exports.cancel = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(
            "UPDATE meal_requests SET status = 'cancelled' WHERE id = ? AND status = 'requested'",
            [id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Meal request not found or already processed.' });
        }

        res.json({ message: 'Meal request cancelled.' });
    } catch (err) {
        logger.error('Cancel Meal Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};
