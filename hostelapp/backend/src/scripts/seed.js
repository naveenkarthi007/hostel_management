/**
 * Enterprise Seed Script
 * Seeds the database with comprehensive test data for all modules.
 * Run: node src/scripts/seed.js
 */
const bcrypt = require('bcryptjs');
const pool = require('../config/db').promise;

async function seed() {
    console.log('🌱 Starting database seed...\n');

    const hashedPassword = await bcrypt.hash('Password@123', 12);

    // ── 1. Hostels ──
    console.log('Creating hostels...');
    await pool.query(`INSERT IGNORE INTO hostels (name, code, type, total_floors, total_rooms) VALUES
        ('Boys Hostel 1', 'BH1', 'boys', 4, 80),
        ('Boys Hostel 2', 'BH2', 'boys', 4, 80),
        ('Girls Hostel 1', 'GH1', 'girls', 3, 60),
        ('Girls Hostel 2', 'GH2', 'girls', 3, 60)
    `);

    // ── 2. Rooms ──
    console.log('Creating rooms...');
    const [hostels] = await pool.query('SELECT id, total_floors FROM hostels');
    for (const hostel of hostels) {
        for (let floor = 1; floor <= hostel.total_floors; floor++) {
            for (let room = 1; room <= 20; room++) {
                const roomNum = `${floor}${String(room).padStart(2, '0')}`;
                await pool.query(
                    `INSERT IGNORE INTO rooms (hostel_id, room_number, floor, capacity, room_type)
                     VALUES (?, ?, ?, 2, 'double')`,
                    [hostel.id, roomNum, floor]
                ).catch(() => {}); // Ignore duplicates
            }
        }
    }

    // ── 3. Admin User ──
    console.log('Creating admin user...');
    await pool.query(
        `INSERT IGNORE INTO users (name, email, password, role_id, is_active, email_verified) 
         VALUES ('System Admin', 'admin@hostel.com', ?, 6, TRUE, TRUE)`,
        [hashedPassword]
    );

    // ── 4. Hostel Manager ──
    console.log('Creating hostel manager...');
    await pool.query(
        `INSERT IGNORE INTO users (name, email, password, role_id, is_active, email_verified) 
         VALUES ('Mr. Ramesh', 'manager@hostel.com', ?, 5, TRUE, TRUE)`,
        [hashedPassword]
    );

    // ── 5. Wardens ──
    console.log('Creating wardens...');
    const wardens = [
        { name: 'Dr. Kumar', email: 'kumar@hostel.com', warden_id: 'W001', contact: '9876543210', dept: 'CSE', hostel: 'BH1', floor: 1 },
        { name: 'Dr. Ravi', email: 'ravi@hostel.com', warden_id: 'W002', contact: '9876543211', dept: 'ECE', hostel: 'BH1', floor: 2 },
        { name: 'Dr. Priya', email: 'priya@hostel.com', warden_id: 'W003', contact: '9876543212', dept: 'IT', hostel: 'BH2', floor: 1 },
        { name: 'Dr. Lakshmi', email: 'lakshmi@hostel.com', warden_id: 'W004', contact: '9876543213', dept: 'MECH', hostel: 'GH1', floor: 1 },
    ];

    for (const w of wardens) {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [w.email]);
        let userId;

        if (existing.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO users (name, email, password, role_id, is_active, email_verified) VALUES (?, ?, ?, 2, TRUE, TRUE)',
                [w.name, w.email, hashedPassword]
            );
            userId = result.insertId;
        } else {
            userId = existing[0].id;
        }

        const [hostel] = await pool.query('SELECT id FROM hostels WHERE code = ?', [w.hostel]);
        await pool.query(
            `INSERT IGNORE INTO wardens (user_id, warden_id, contact, department, hostel_id, assigned_floor)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, w.warden_id, w.contact, w.dept, hostel[0]?.id || null, w.floor]
        );
    }

    // ── 6. Students ──
    console.log('Creating students...');
    const departments = ['CSE', 'ECE', 'IT', 'MECH', 'EEE', 'CIVIL'];
    const years = ['1st', '2nd', '3rd', '4th'];

    for (let i = 1; i <= 20; i++) {
        const studentId = `S${String(i).padStart(3, '0')}`;
        const email = `student${i}@hostel.com`;
        const name = `Student ${i}`;
        const dept = departments[i % departments.length];
        const year = years[i % years.length];
        const wardenIdx = (i % wardens.length);

        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        let userId;

        if (existing.length === 0) {
            const [result] = await pool.query(
                'INSERT INTO users (name, email, password, role_id, is_active, email_verified) VALUES (?, ?, ?, 1, TRUE, TRUE)',
                [name, email, hashedPassword]
            );
            userId = result.insertId;
        } else {
            userId = existing[0].id;
        }

        const [warden] = await pool.query('SELECT id, hostel_id FROM wardens WHERE warden_id = ?', [wardens[wardenIdx].warden_id]);
        const hostelId = warden[0]?.hostel_id || 1;

        // Assign a room
        const [rooms] = await pool.query(
            'SELECT id FROM rooms WHERE hostel_id = ? AND current_occupancy < capacity LIMIT 1',
            [hostelId]
        );
        const roomId = rooms.length > 0 ? rooms[0].id : null;

        await pool.query(
            `INSERT IGNORE INTO students 
             (user_id, student_id, contact, department, year, hostel_id, room_id, warden_ref_id, warden_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, studentId, `98765${String(43210 + i)}`, dept, year, hostelId, roomId, warden[0]?.id || null, wardens[wardenIdx].warden_id]
        );

        if (roomId) {
            await pool.query('UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = ?', [roomId]);
        }
    }

    // ── 7. Sample Leave Requests ──
    console.log('Creating sample leave requests...');
    const [studentRecords] = await pool.query('SELECT id, warden_id FROM students LIMIT 10');
    for (let i = 0; i < Math.min(5, studentRecords.length); i++) {
        const s = studentRecords[i];
        if (!s.warden_id) continue;

        await pool.query(
            `INSERT INTO leave_requests (student_id, warden_id, leave_type, from_date, to_date, reason)
             VALUES (?, ?, 'Leave', DATE_ADD(CURDATE(), INTERVAL ? DAY), DATE_ADD(CURDATE(), INTERVAL ? DAY), ?)`,
            [s.id, s.warden_id, i + 1, i + 3, `Family function - sample leave ${i + 1}`]
        ).catch(() => {});
    }

    // ── 8. Sample Complaints ──
    console.log('Creating sample complaints...');
    const complaintTypes = ['electrical', 'plumbing', 'furniture', 'internet', 'cleaning'];
    for (let i = 0; i < Math.min(5, studentRecords.length); i++) {
        const s = studentRecords[i];
        await pool.query(
            `INSERT INTO complaints (student_id, complaint_type, category, priority, description)
             VALUES (?, ?, ?, ?, ?)`,
            [s.id, complaintTypes[i], complaintTypes[i], ['low', 'medium', 'high'][i % 3], `Sample complaint about ${complaintTypes[i]} issue in room`]
        ).catch(() => {});
    }

    // ── 9. Computer Lab Slots ──
    console.log('Creating lab slots...');
    await pool.query(
        `INSERT IGNORE INTO computerlab_slots (venue, from_time, to_time, slot_date, total_systems)
         VALUES 
         ('Lab A', '09:00', '11:00', CURDATE(), 30),
         ('Lab A', '11:00', '13:00', CURDATE(), 30),
         ('Lab B', '14:00', '16:00', CURDATE(), 20),
         ('Lab A', '09:00', '11:00', DATE_ADD(CURDATE(), INTERVAL 1 DAY), 30)`
    );

    console.log('\n✅ Seed completed successfully!');
    console.log('\n📋 Test Accounts:');
    console.log('   Admin:    admin@hostel.com    / Password@123');
    console.log('   Manager:  manager@hostel.com  / Password@123');
    console.log('   Warden:   kumar@hostel.com    / Password@123');
    console.log('   Student:  student1@hostel.com / Password@123');

    process.exit(0);
}

seed().catch(err => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
});
