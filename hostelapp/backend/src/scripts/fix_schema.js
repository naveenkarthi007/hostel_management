/**
 * Fix DB schema mismatches — adds missing columns/tables expected by v2 controllers.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const db = require('../config/db');
const pool = db.promise;

async function safeQuery(sql, label) {
    try {
        await pool.query(sql);
        console.log('OK:', label);
    } catch (e) {
        if (e.errno === 1060) console.log('SKIP (exists):', label);
        else if (e.errno === 1061) console.log('SKIP (index exists):', label);
        else console.log('ERR:', label, '-', e.message);
    }
}

(async () => {
    console.log('=== Fixing users table ===');
    await safeQuery("ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE", 'users.is_active');
    await safeQuery("ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL", 'users.last_login_at');
    await safeQuery("ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45)", 'users.last_login_ip');
    await safeQuery("ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0", 'users.failed_login_attempts');
    await safeQuery("ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL", 'users.locked_until');
    await safeQuery("ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL", 'users.deleted_at');
    await safeQuery("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", 'users.created_at');
    await safeQuery("ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", 'users.updated_at');

    console.log('\n=== Fixing meal_requests ===');
    await safeQuery("ALTER TABLE meal_requests ADD COLUMN meal_date DATE AFTER student_id", 'meal_date');
    await safeQuery("UPDATE meal_requests SET meal_date = date WHERE meal_date IS NULL", 'copy date -> meal_date');
    await safeQuery("ALTER TABLE meal_requests ADD COLUMN request_type ENUM('opt_in','opt_out','special') DEFAULT 'opt_in' AFTER meal_type", 'request_type');
    await safeQuery("ALTER TABLE meal_requests ADD COLUMN special_notes TEXT AFTER request_type", 'special_notes');
    await safeQuery("ALTER TABLE meal_requests ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", 'created_at');
    await safeQuery("ALTER TABLE meal_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", 'updated_at');

    console.log('\n=== Fixing room_change_requests ===');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN current_room_id INT AFTER student_id", 'current_room_id');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN requested_hostel_id INT AFTER current_room_id", 'requested_hostel_id');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN requested_floor VARCHAR(10) AFTER requested_hostel_id", 'requested_floor');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN requested_room_id INT AFTER requested_floor", 'requested_room_id');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN approved_by INT AFTER status", 'approved_by');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by", 'approved_at');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN completed_at TIMESTAMP NULL AFTER approved_at", 'completed_at');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", 'created_at');
    await safeQuery("ALTER TABLE room_change_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", 'updated_at');

    console.log('\n=== Fixing computerlab_slots ===');
    await safeQuery("ALTER TABLE computerlab_slots ADD COLUMN is_active BOOLEAN DEFAULT TRUE", 'is_active');
    await safeQuery("ALTER TABLE computerlab_slots ADD COLUMN available_systems INT DEFAULT 0 AFTER total_systems", 'available_systems');
    await safeQuery("UPDATE computerlab_slots SET available_systems = total_systems WHERE available_systems = 0 OR available_systems IS NULL", 'sync available');
    await safeQuery("ALTER TABLE computerlab_slots ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP", 'created_at');

    console.log('\n=== Creating computer_bookings table ===');
    await safeQuery(`CREATE TABLE IF NOT EXISTS computer_bookings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        student_id VARCHAR(50) NOT NULL,
        slot_id INT NOT NULL,
        system_no INT NOT NULL,
        status ENUM('booked','cancelled','completed') DEFAULT 'booked',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unique_slot_system (slot_id, system_no),
        FOREIGN KEY (student_id) REFERENCES students(student_id),
        FOREIGN KEY (slot_id) REFERENCES computerlab_slots(id) ON DELETE CASCADE
    )`, 'computer_bookings table');

    // If table already existed without status column, add it
    await safeQuery("ALTER TABLE computer_bookings ADD COLUMN status ENUM('booked','cancelled','completed') DEFAULT 'booked' AFTER system_no", 'cb.status');
    await safeQuery("ALTER TABLE computer_bookings ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP", 'cb.updated_at');

    console.log('\n✅ Schema fix complete!');
    process.exit(0);
})().catch(e => {
    console.error('Fatal:', e);
    process.exit(1);
});
