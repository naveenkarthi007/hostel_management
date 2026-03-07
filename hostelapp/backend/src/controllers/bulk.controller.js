const pool = require('../config/db').promise;
const bcrypt = require('bcryptjs');
const { logAudit } = require('../services/audit.service');

/**
 * Bulk Import Students
 * Accepts an array of student records, creates user accounts + student profiles.
 * Used by hostel managers to onboard entire batches at once.
 */
exports.bulkImportStudents = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { students } = req.body;

        await connection.beginTransaction();

        const results = { success: 0, failed: 0, errors: [] };
        const defaultPassword = 'Hostel@2026'; // Students must change on first login
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        for (let i = 0; i < students.length; i++) {
            const s = students[i];

            try {
                // Check if user already exists
                const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [s.email]);
                if (existing.length > 0) {
                    results.errors.push({ row: i + 1, email: s.email, error: 'Email already exists' });
                    results.failed++;
                    continue;
                }

                // Create user account (role_id = 1 for student)
                const [userResult] = await connection.query(
                    'INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, 1)',
                    [s.name, s.email, hashedPassword]
                );

                // Resolve hostel_id from code
                let hostelId = null;
                if (s.hostel_code) {
                    const [hostel] = await connection.query('SELECT id FROM hostels WHERE code = ?', [s.hostel_code]);
                    hostelId = hostel.length > 0 ? hostel[0].id : null;
                }

                // Resolve room_id
                let roomId = null;
                if (hostelId && s.room_number) {
                    const [room] = await connection.query(
                        'SELECT id FROM rooms WHERE hostel_id = ? AND room_number = ?',
                        [hostelId, s.room_number]
                    );
                    roomId = room.length > 0 ? room[0].id : null;
                }

                // Resolve warden_id
                let wardenInternalId = null;
                if (s.warden_id) {
                    const [warden] = await connection.query('SELECT id FROM wardens WHERE warden_id = ?', [s.warden_id]);
                    wardenInternalId = warden.length > 0 ? warden[0].id : null;
                }

                // Create student profile
                await connection.query(
                    `INSERT INTO students 
                     (user_id, student_id, contact, department, year, hostel_id, room_id, warden_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userResult.insertId, s.student_id, s.contact, s.department || null, s.year || null, hostelId, roomId, wardenInternalId]
                );

                // Update room occupancy
                if (roomId) {
                    await connection.query(
                        'UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = ?',
                        [roomId]
                    );
                }

                results.success++;
            } catch (rowErr) {
                results.errors.push({ row: i + 1, email: s.email, error: rowErr.message });
                results.failed++;
            }
        }

        await connection.commit();

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'BULK_IMPORT', module: 'user',
            newValues: { total: students.length, success: results.success, failed: results.failed },
            req,
        });

        res.json({
            message: `Imported ${results.success} of ${students.length} students.`,
            ...results,
        });
    } catch (err) {
        await connection.rollback();
        console.error('Bulk Import Error:', err);
        res.status(500).json({ message: 'Bulk import failed.' });
    } finally {
        connection.release();
    }
};

/**
 * Bulk Import Wardens
 */
exports.bulkImportWardens = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { wardens } = req.body;

        await connection.beginTransaction();

        const results = { success: 0, failed: 0, errors: [] };
        const defaultPassword = 'Hostel@2026';
        const hashedPassword = await bcrypt.hash(defaultPassword, 12);

        for (let i = 0; i < wardens.length; i++) {
            const w = wardens[i];

            try {
                const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [w.email]);
                if (existing.length > 0) {
                    results.errors.push({ row: i + 1, email: w.email, error: 'Email already exists' });
                    results.failed++;
                    continue;
                }

                // Create user (role_id = 2 for warden)
                const [userResult] = await connection.query(
                    'INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, 2)',
                    [w.name, w.email, hashedPassword]
                );

                let hostelId = null;
                if (w.hostel_code) {
                    const [hostel] = await connection.query('SELECT id FROM hostels WHERE code = ?', [w.hostel_code]);
                    hostelId = hostel.length > 0 ? hostel[0].id : null;
                }

                await connection.query(
                    `INSERT INTO wardens (user_id, warden_id, contact, department, hostel_id, assigned_floor)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [userResult.insertId, w.warden_id, w.contact || null, w.department || null, hostelId, w.floor || null]
                );

                results.success++;
            } catch (rowErr) {
                results.errors.push({ row: i + 1, email: w.email, error: rowErr.message });
                results.failed++;
            }
        }

        await connection.commit();

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'BULK_IMPORT', module: 'user',
            newValues: { type: 'wardens', total: wardens.length, success: results.success },
            req,
        });

        res.json({
            message: `Imported ${results.success} of ${wardens.length} wardens.`,
            ...results,
        });
    } catch (err) {
        await connection.rollback();
        console.error('Bulk Import Wardens Error:', err);
        res.status(500).json({ message: 'Bulk import failed.' });
    } finally {
        connection.release();
    }
};
