const pool = require('../config/db').promise;

// ── Get Student Profile + Warden Details ──
exports.getStudentProfile = async (req, res) => {
    try {
        const { studentId } = req.params;

        const [students] = await pool.query(
            `SELECT s.*, u.name, u.email, u.avatar_url,
                    h.name as hostel_name, h.code as hostel_code,
                    r.room_number, r.floor
             FROM students s
             JOIN users u ON s.user_id = u.id
             LEFT JOIN hostels h ON s.hostel_id = h.id
             LEFT JOIN rooms r ON s.room_id = r.id
             WHERE s.student_id = ?`,
            [studentId]
        );

        if (students.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }

        const student = students[0];
        let warden = null;

        if (student.warden_id) {
            const [wardens] = await pool.query(
                `SELECT w.warden_id, u.name, w.contact, w.department
                 FROM wardens w
                 JOIN users u ON w.user_id = u.id
                 WHERE w.id = ?`,
                [student.warden_id]
            );
            warden = wardens[0] || null;
        }

        res.json({ student, warden });
    } catch (err) {
        console.error('Student Profile Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get Warden Profile ──
exports.getWardenProfile = async (req, res) => {
    try {
        const { wardenId } = req.params;

        const [wardens] = await pool.query(
            `SELECT w.*, u.name, u.email, u.avatar_url,
                    h.name as hostel_name, h.code as hostel_code
             FROM wardens w
             JOIN users u ON w.user_id = u.id
             LEFT JOIN hostels h ON w.hostel_id = h.id
             WHERE w.warden_id = ?`,
            [wardenId]
        );

        if (wardens.length === 0) {
            return res.status(404).json({ message: 'Warden not found.' });
        }

        res.json(wardens[0]);
    } catch (err) {
        console.error('Warden Profile Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get student_id by email ──
exports.getStudentByEmail = async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const [results] = await pool.query(
            `SELECT s.student_id, s.id FROM students s
             JOIN users u ON s.user_id = u.id
             WHERE u.email = ?`,
            [email]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'Student not found.' });
        }
        res.json(results[0]);
    } catch (err) {
        console.error('Student by email Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get warden_id by email ──
exports.getWardenByEmail = async (req, res) => {
    try {
        const email = decodeURIComponent(req.params.email);
        const [results] = await pool.query(
            `SELECT w.warden_id, w.id FROM wardens w
             JOIN users u ON w.user_id = u.id
             WHERE u.email = ?`,
            [email]
        );

        if (results.length === 0) {
            return res.status(404).json({ message: 'Warden not found.' });
        }
        res.json(results[0]);
    } catch (err) {
        console.error('Warden by email Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
