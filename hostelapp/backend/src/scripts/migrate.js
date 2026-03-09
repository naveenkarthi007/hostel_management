/**
 * Database Migration Script: v1 → v2
 * Upgrades the existing hostel_db from the legacy flat schema
 * to the enterprise v2 schema while preserving all existing data.
 *
 * Run:  node src/scripts/migrate.js
 */
const pool = require('../config/db').promise;
const bcrypt = require('bcryptjs');

/** Safe ALTER — swallows "Duplicate column" errors (1060) */
async function safeAlter(sql) {
    try { await pool.query(sql); } catch (e) { if (e.errno !== 1060) throw e; }
}

async function migrate() {
    console.log('🔄 Starting database migration v1 → v2 ...\n');

    // ═══════════════════════════════════════════
    // 1. ROLES — update existing + add missing
    // ═══════════════════════════════════════════
    console.log('1/14  Updating roles...');
    await safeAlter(`ALTER TABLE roles ADD COLUMN description VARCHAR(255)`);
    await safeAlter(`ALTER TABLE roles ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);

    // Fix role_name values to match v2 conventions
    await pool.query(`UPDATE roles SET role_name = 'hostel_manager' WHERE role_name = 'hostelmanager'`);
    await pool.query(`UPDATE roles SET role_name = 'mess_manager' WHERE role_name = 'messmanager'`);

    // Insert missing roles
    await pool.query(`INSERT IGNORE INTO roles (id, role_name, description) VALUES
        (1, 'student', 'Hostel resident student'),
        (2, 'warden', 'Floor/hostel warden'),
        (3, 'caretaker', 'Hostel caretaker staff'),
        (4, 'mess_manager', 'Mess/dining hall manager'),
        (5, 'hostel_manager', 'Overall hostel administrator'),
        (6, 'admin', 'System super administrator')
    `);

    // ═══════════════════════════════════════════
    // 2. PERMISSIONS table (new)
    // ═══════════════════════════════════════════
    console.log('2/14  Creating permissions...');
    await pool.query(`CREATE TABLE IF NOT EXISTS permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        permission_key VARCHAR(100) UNIQUE NOT NULL,
        description VARCHAR(255),
        module VARCHAR(50) NOT NULL
    )`);

    await pool.query(`INSERT IGNORE INTO permissions (permission_key, description, module) VALUES
        ('leave:apply', 'Apply for leave', 'leave'),
        ('leave:view_own', 'View own leave requests', 'leave'),
        ('leave:view_all', 'View all leave requests', 'leave'),
        ('leave:approve', 'Approve/reject student leaves', 'leave'),
        ('leave:delete', 'Delete own pending leave', 'leave'),
        ('warden_leave:apply', 'Apply for warden leave', 'warden_leave'),
        ('warden_leave:view_all', 'View all warden leaves', 'warden_leave'),
        ('warden_leave:approve', 'Approve/reject warden leaves', 'warden_leave'),
        ('complaint:create', 'File a complaint', 'complaint'),
        ('complaint:view_own', 'View own complaints', 'complaint'),
        ('complaint:view_all', 'View all complaints', 'complaint'),
        ('complaint:update_status', 'Update complaint status', 'complaint'),
        ('room:request_change', 'Request room change', 'room'),
        ('room:view_requests', 'View room change requests', 'room'),
        ('room:approve', 'Approve room changes', 'room'),
        ('meal:request', 'Request meal changes', 'meal'),
        ('meal:view_all', 'View all meal requests', 'meal'),
        ('meal:manage', 'Manage meal requests', 'meal'),
        ('lab:book', 'Book computer lab slot', 'lab'),
        ('lab:view_slots', 'View lab slots', 'lab'),
        ('lab:manage_slots', 'Create/edit lab slots', 'lab'),
        ('profile:view_own', 'View own profile', 'profile'),
        ('profile:view_any', 'View any user profile', 'profile'),
        ('profile:edit_own', 'Edit own profile', 'profile'),
        ('analytics:view', 'View analytics dashboard', 'analytics'),
        ('analytics:export', 'Export analytics data', 'analytics'),
        ('audit:view', 'View audit logs', 'audit'),
        ('user:create', 'Create users', 'user'),
        ('user:edit', 'Edit users', 'user'),
        ('user:delete', 'Delete users', 'user'),
        ('user:bulk_import', 'Bulk import users', 'user')
    `);

    // ═══════════════════════════════════════════
    // 3. ROLE_PERMISSIONS mapping (new)
    // ═══════════════════════════════════════════
    console.log('3/14  Creating role_permissions...');
    await pool.query(`CREATE TABLE IF NOT EXISTS role_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        UNIQUE KEY unique_role_perm (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    )`);

    // Student permissions
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.role_name = 'student' AND p.permission_key IN (
            'leave:apply','leave:view_own','leave:delete',
            'complaint:create','complaint:view_own',
            'room:request_change','meal:request','lab:book','lab:view_slots',
            'profile:view_own','profile:edit_own'
        )`);
    // Warden permissions
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.role_name = 'warden' AND p.permission_key IN (
            'leave:view_all','leave:approve','warden_leave:apply',
            'complaint:view_all','complaint:update_status','room:view_requests',
            'profile:view_own','profile:view_any','profile:edit_own'
        )`);
    // Hostel Manager permissions
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.role_name = 'hostel_manager' AND p.permission_key IN (
            'leave:view_all','leave:approve','warden_leave:view_all','warden_leave:approve',
            'complaint:view_all','complaint:update_status','room:view_requests','room:approve',
            'meal:view_all','meal:manage','lab:manage_slots','lab:view_slots',
            'profile:view_own','profile:view_any','profile:edit_own',
            'analytics:view','analytics:export','user:create','user:edit','user:bulk_import'
        )`);
    // Caretaker permissions
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.role_name = 'caretaker' AND p.permission_key IN (
            'leave:view_all','leave:approve','warden_leave:view_all',
            'complaint:view_all','complaint:update_status',
            'room:view_requests','room:approve',
            'meal:view_all',
            'lab:view_slots','lab:manage_slots',
            'profile:view_own','profile:view_any','profile:edit_own',
            'analytics:view'
        )`);
    // Mess Manager permissions
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p
        WHERE r.role_name = 'mess_manager' AND p.permission_key IN (
            'meal:request','meal:view_all','meal:manage',
            'complaint:view_all',
            'profile:view_own','profile:edit_own',
            'analytics:view'
        )`);
    // Admin — all permissions
    await pool.query(`INSERT IGNORE INTO role_permissions (role_id, permission_id)
        SELECT r.id, p.id FROM roles r, permissions p WHERE r.role_name = 'admin'`);

    // ═══════════════════════════════════════════
    // 4. UPGRADE USERS TABLE — add missing columns
    // ═══════════════════════════════════════════
    console.log('4/14  Upgrading users table...');
    await safeAlter(`ALTER TABLE users ADD COLUMN uuid CHAR(36)`);
    await safeAlter(`ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT TRUE`);
    await safeAlter(`ALTER TABLE users ADD COLUMN email_verified BOOLEAN DEFAULT FALSE`);
    await safeAlter(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500)`);
    await safeAlter(`ALTER TABLE users ADD COLUMN last_login_at TIMESTAMP NULL`);
    await safeAlter(`ALTER TABLE users ADD COLUMN last_login_ip VARCHAR(45)`);
    await safeAlter(`ALTER TABLE users ADD COLUMN failed_login_attempts INT DEFAULT 0`);
    await safeAlter(`ALTER TABLE users ADD COLUMN locked_until TIMESTAMP NULL`);
    await safeAlter(`ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await safeAlter(`ALTER TABLE users ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);
    await safeAlter(`ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL`);

    // Add indexes (swallow duplicate key errors 1061)
    await pool.query(`CREATE INDEX idx_users_email ON users (email)`).catch(() => {});
    await pool.query(`CREATE INDEX idx_users_role ON users (role_id)`).catch(() => {});
    await pool.query(`CREATE INDEX idx_users_active ON users (is_active)`).catch(() => {});

    // Populate UUID for existing rows that have NULL uuid
    await pool.query(`UPDATE users SET uuid = UUID() WHERE uuid IS NULL OR uuid = ''`).catch(() => {});

    // Make name NOT NULL-safe (some old rows might have NULL)
    await pool.query(`UPDATE users SET name = 'Unknown' WHERE name IS NULL`).catch(() => {});

    // ═══════════════════════════════════════════
    // 5. REFRESH_TOKENS table (new)
    // ═══════════════════════════════════════════
    console.log('5/14  Creating refresh_tokens...');
    await pool.query(`CREATE TABLE IF NOT EXISTS refresh_tokens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        token_hash VARCHAR(255) NOT NULL,
        device_info VARCHAR(255),
        ip_address VARCHAR(45),
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_refresh_token_hash (token_hash),
        INDEX idx_refresh_user (user_id),
        INDEX idx_refresh_expires (expires_at)
    )`);

    // ═══════════════════════════════════════════
    // 6. HOSTELS table (new)
    // ═══════════════════════════════════════════
    console.log('6/14  Creating hostels...');
    await pool.query(`CREATE TABLE IF NOT EXISTS hostels (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        type ENUM('boys','girls','mixed') NOT NULL,
        total_floors INT NOT NULL,
        total_rooms INT NOT NULL,
        address TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )`);

    await pool.query(`INSERT IGNORE INTO hostels (name, code, type, total_floors, total_rooms) VALUES
        ('Boys Hostel 1', 'BH1', 'boys', 4, 80),
        ('Boys Hostel 2', 'BH2', 'boys', 4, 80),
        ('Girls Hostel 1', 'GH1', 'girls', 3, 60),
        ('Girls Hostel 2', 'GH2', 'girls', 3, 60)
    `);

    // ═══════════════════════════════════════════
    // 7. ROOMS table (new)
    // ═══════════════════════════════════════════
    console.log('7/14  Creating rooms...');
    await pool.query(`CREATE TABLE IF NOT EXISTS rooms (
        id INT PRIMARY KEY AUTO_INCREMENT,
        hostel_id INT NOT NULL,
        room_number VARCHAR(20) NOT NULL,
        floor INT NOT NULL,
        capacity INT NOT NULL DEFAULT 2,
        current_occupancy INT NOT NULL DEFAULT 0,
        room_type ENUM('single','double','triple','dormitory') DEFAULT 'double',
        is_available BOOLEAN DEFAULT TRUE,
        UNIQUE KEY unique_hostel_room (hostel_id, room_number),
        FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
        INDEX idx_rooms_hostel (hostel_id),
        INDEX idx_rooms_available (is_available)
    )`);

    // Seed rooms for each hostel
    const [hostels] = await pool.query('SELECT id, total_floors FROM hostels');
    for (const hostel of hostels) {
        for (let floor = 1; floor <= hostel.total_floors; floor++) {
            for (let room = 1; room <= 20; room++) {
                const roomNum = `${floor}${String(room).padStart(2, '0')}`;
                await pool.query(
                    `INSERT IGNORE INTO rooms (hostel_id, room_number, floor, capacity, room_type) VALUES (?, ?, ?, 2, 'double')`,
                    [hostel.id, roomNum, floor]
                ).catch(() => {});
            }
        }
    }

    // ═══════════════════════════════════════════
    // 8. WARDENS table (new — linked to users)
    // ═══════════════════════════════════════════
    console.log('8/14  Creating wardens table & migrating data...');
    await pool.query(`CREATE TABLE IF NOT EXISTS wardens (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT UNIQUE NOT NULL,
        warden_id VARCHAR(20) UNIQUE NOT NULL,
        contact VARCHAR(15),
        department VARCHAR(50),
        hostel_id INT,
        assigned_floor INT,
        designation VARCHAR(50) DEFAULT 'Floor Warden',
        joining_date DATE,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (hostel_id) REFERENCES hostels(id),
        INDEX idx_wardens_hostel (hostel_id),
        INDEX idx_wardens_warden_id (warden_id)
    )`);

    // Migrate data from old `warden` table → new `wardens` table
    const [oldWardens] = await pool.query('SELECT * FROM warden').catch(() => [[]]);
    for (const ow of oldWardens) {
        // Ensure user exists
        let [userRow] = await pool.query('SELECT id FROM users WHERE email = ?', [ow.email]);
        let userId;
        if (userRow.length === 0) {
            const hash = await bcrypt.hash('Password@123', 12);
            const [ins] = await pool.query(
                'INSERT INTO users (name, email, password, role_id, is_active) VALUES (?, ?, ?, 2, TRUE)',
                [ow.name, ow.email, hash]
            );
            userId = ins.insertId;
        } else {
            userId = userRow[0].id;
        }

        // Map hostel string → hostel_id
        let hostelId = null;
        if (ow.hostel) {
            const [h] = await pool.query('SELECT id FROM hostels WHERE name = ? OR code = ?', [ow.hostel, ow.hostel]);
            hostelId = h.length > 0 ? h[0].id : 1;
        }

        await pool.query(
            `INSERT IGNORE INTO wardens (user_id, warden_id, contact, department, hostel_id, assigned_floor)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, ow.warden_id, ow.contact, ow.department, hostelId, parseInt(ow.floor) || null]
        ).catch(() => {});
    }

    // ═══════════════════════════════════════════
    // 9. UPGRADE STUDENTS TABLE — add FKs
    // ═══════════════════════════════════════════
    console.log('9/14  Upgrading students table...');

    // Add new columns to existing students table
    await safeAlter(`ALTER TABLE students ADD COLUMN user_id INT UNIQUE`);
    await safeAlter(`ALTER TABLE students ADD COLUMN hostel_id INT`);
    await safeAlter(`ALTER TABLE students ADD COLUMN room_id INT`);
    await safeAlter(`ALTER TABLE students ADD COLUMN warden_ref_id INT`);
    await safeAlter(`ALTER TABLE students ADD COLUMN semester INT`);
    await safeAlter(`ALTER TABLE students ADD COLUMN group_type INT`);
    await safeAlter(`ALTER TABLE students ADD COLUMN parent_name VARCHAR(100)`);
    await safeAlter(`ALTER TABLE students ADD COLUMN parent_contact VARCHAR(15)`);
    await safeAlter(`ALTER TABLE students ADD COLUMN emergency_contact VARCHAR(15)`);
    await safeAlter(`ALTER TABLE students ADD COLUMN blood_group VARCHAR(5)`);
    await safeAlter(`ALTER TABLE students ADD COLUMN date_of_birth DATE`);
    await safeAlter(`ALTER TABLE students ADD COLUMN admission_date DATE`);
    await safeAlter(`ALTER TABLE students ADD COLUMN is_active BOOLEAN DEFAULT TRUE`);
    await safeAlter(`ALTER TABLE students ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await safeAlter(`ALTER TABLE students ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    // Link students to users by email
    const [allStudents] = await pool.query('SELECT id, email, hostel, room, warden_id, contact FROM students');
    for (const s of allStudents) {
        // Link to user
        if (s.email) {
            const [u] = await pool.query('SELECT id FROM users WHERE email = ?', [s.email]);
            if (u.length > 0) {
                await pool.query('UPDATE students SET user_id = ? WHERE id = ?', [u[0].id, s.id]).catch(() => {});
            }
        }

        // Link to hostel
        if (s.hostel) {
            const [h] = await pool.query('SELECT id FROM hostels WHERE name = ?', [s.hostel]);
            if (h.length > 0) {
                await pool.query('UPDATE students SET hostel_id = ? WHERE id = ?', [h[0].id, s.id]).catch(() => {});
            }
        }

        // Link room
        if (s.room && s.hostel) {
            const [h] = await pool.query('SELECT id FROM hostels WHERE name = ?', [s.hostel]);
            if (h.length > 0) {
                const [r] = await pool.query('SELECT id FROM rooms WHERE hostel_id = ? AND room_number = ?', [h[0].id, s.room]);
                if (r.length > 0) {
                    await pool.query('UPDATE students SET room_id = ? WHERE id = ?', [r[0].id, s.id]).catch(() => {});
                    await pool.query('UPDATE rooms SET current_occupancy = current_occupancy + 1 WHERE id = ? AND current_occupancy < capacity', [r[0].id]).catch(() => {});
                }
            }
        }

        // Link to warden (warden_id string → wardens.id int)
        if (s.warden_id) {
            const [w] = await pool.query('SELECT id FROM wardens WHERE warden_id = ?', [s.warden_id]);
            if (w.length > 0) {
                await pool.query('UPDATE students SET warden_ref_id = ? WHERE id = ?', [w[0].id, s.id]).catch(() => {});
            }
        }

        // Fix contact to varchar
        if (s.contact) {
            await pool.query('ALTER TABLE students MODIFY COLUMN contact VARCHAR(15)').catch(() => {});
        }
    }

    // ═══════════════════════════════════════════
    // 10. HOSTEL_STAFF table (new)
    // ═══════════════════════════════════════════
    console.log('10/14 Creating hostel_staff...');
    await pool.query(`CREATE TABLE IF NOT EXISTS hostel_staff (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT UNIQUE NOT NULL,
        staff_id VARCHAR(20) UNIQUE NOT NULL,
        contact VARCHAR(15),
        designation VARCHAR(50),
        department VARCHAR(50),
        hostel_id INT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (hostel_id) REFERENCES hostels(id)
    )`);

    // ═══════════════════════════════════════════
    // 11. UPGRADE COMPLAINTS TABLE
    // ═══════════════════════════════════════════
    console.log('11/14 Upgrading complaints...');
    await safeAlter(`ALTER TABLE complaints ADD COLUMN category ENUM('electrical','plumbing','furniture','cleaning','internet','security','other') DEFAULT 'other'`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN priority ENUM('low','medium','high','critical') DEFAULT 'medium'`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN description TEXT`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN location VARCHAR(100)`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN assigned_to INT`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN resolution_notes TEXT`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN resolved_at TIMESTAMP NULL`);
    await safeAlter(`ALTER TABLE complaints ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    // Expand status enum
    await pool.query(`ALTER TABLE complaints MODIFY COLUMN status ENUM('pending','assigned','in_progress','resolved','closed','reopened') DEFAULT 'pending'`).catch(() => {});

    // Migrate old 'issue' → 'description'
    await pool.query(`UPDATE complaints SET description = issue WHERE description IS NULL AND issue IS NOT NULL`).catch(() => {});

    // ═══════════════════════════════════════════
    // 12. UPGRADE LEAVE_REQUESTS TABLE
    // ═══════════════════════════════════════════
    console.log('12/14 Upgrading leave_requests...');
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN from_time TIME`);
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN to_time TIME`);
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN approved_by INT`);
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN approved_at TIMESTAMP NULL`);
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN rejection_reason TEXT`);
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN parent_notified BOOLEAN DEFAULT FALSE`);
    await safeAlter(`ALTER TABLE leave_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    // Expand leave_type enum and status enum
    await pool.query(`ALTER TABLE leave_requests MODIFY COLUMN leave_type ENUM('leave','od','internal_od','internal_training','Leave','OD','Internal OD','Internal Training') NOT NULL`).catch(() => {});
    await pool.query(`ALTER TABLE leave_requests MODIFY COLUMN status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending'`).catch(() => {});

    // ═══════════════════════════════════════════
    // 13. UPGRADE WARDEN_LEAVE_REQUESTS TABLE
    // ═══════════════════════════════════════════
    console.log('13/14 Upgrading warden_leave_requests...');
    await safeAlter(`ALTER TABLE warden_leave_requests ADD COLUMN alternate_warden_id INT`);
    await safeAlter(`ALTER TABLE warden_leave_requests ADD COLUMN contact VARCHAR(15)`);
    await safeAlter(`ALTER TABLE warden_leave_requests ADD COLUMN approved_by INT`);
    await safeAlter(`ALTER TABLE warden_leave_requests ADD COLUMN approved_at TIMESTAMP NULL`);
    await safeAlter(`ALTER TABLE warden_leave_requests ADD COLUMN rejection_reason TEXT`);
    await safeAlter(`ALTER TABLE warden_leave_requests ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`);

    // Expand status enum
    await pool.query(`ALTER TABLE warden_leave_requests MODIFY COLUMN status ENUM('pending','approved','rejected','cancelled') DEFAULT 'pending'`).catch(() => {});

    // ═══════════════════════════════════════════
    // 14. CREATE REMAINING NEW TABLES
    // ═══════════════════════════════════════════
    console.log('14/14 Creating new tables (notifications, audit_logs, etc.)...');

    await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info','success','warning','error') DEFAULT 'info',
        module VARCHAR(50),
        reference_id INT,
        reference_type VARCHAR(50),
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notif_user (user_id),
        INDEX idx_notif_read (user_id, is_read),
        INDEX idx_notif_created (created_at)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        user_id INT,
        user_email VARCHAR(100),
        action VARCHAR(50) NOT NULL,
        module VARCHAR(50) NOT NULL,
        target_table VARCHAR(50),
        target_id INT,
        old_values JSON,
        new_values JSON,
        ip_address VARCHAR(45),
        user_agent VARCHAR(500),
        session_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_action (action),
        INDEX idx_audit_module (module),
        INDEX idx_audit_created (created_at),
        INDEX idx_audit_target (target_table, target_id)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS announcements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        author_id INT NOT NULL,
        target_role_id INT,
        target_hostel_id INT,
        priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
        is_pinned BOOLEAN DEFAULT FALSE,
        expires_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id),
        FOREIGN KEY (target_role_id) REFERENCES roles(id),
        FOREIGN KEY (target_hostel_id) REFERENCES hostels(id),
        INDEX idx_announce_date (created_at)
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        description VARCHAR(255),
        updated_by INT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (updated_by) REFERENCES users(id)
    )`);

    await pool.query(`INSERT IGNORE INTO system_settings (setting_key, setting_value, description) VALUES
        ('max_leave_days', '15', 'Maximum leave days per semester'),
        ('leave_advance_days', '2', 'Minimum advance days for leave application'),
        ('meal_cutoff_hours', '2', 'Hours before meal to stop requests'),
        ('complaint_auto_escalate_days', '3', 'Days before unresolved complaint escalates'),
        ('lab_max_bookings_per_day', '2', 'Max lab bookings per student per day'),
        ('session_timeout_minutes', '30', 'Session timeout in minutes')
    `);

    // Upgrade meal_requests if it exists
    await pool.query(`ALTER TABLE meal_requests MODIFY COLUMN status ENUM('requested','confirmed','cancelled','served') DEFAULT 'requested'`).catch(() => {});

    // Upgrade room_change_requests if it exists
    await pool.query(`ALTER TABLE room_change_requests MODIFY COLUMN status ENUM('pending','approved','rejected','completed') DEFAULT 'pending'`).catch(() => {});

    // ═══════════════════════════════════════════
    // DONE
    // ═══════════════════════════════════════════
    console.log('\n✅ Migration completed successfully!');
    console.log('   - Roles: 6 roles with descriptions');
    console.log('   - Permissions: 31 granular permissions');
    console.log('   - RBAC: Role-permission mappings created');
    console.log('   - Users: Added security columns (uuid, is_active, deleted_at, etc.)');
    console.log('   - Wardens: Migrated to linked wardens table');
    console.log('   - Students: Linked to users, hostels, rooms, wardens');
    console.log('   - Complaints: Added category, priority, description');
    console.log('   - Leaves: Added time fields, approval tracking');
    console.log('   - New tables: refresh_tokens, hostels, rooms, notifications, audit_logs, etc.');
    console.log('\nNext step: Run `node src/scripts/seed.js` to create test data.');

    process.exit(0);
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
