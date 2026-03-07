-- ============================================================
-- Hostel Management System — Enterprise Database Schema v2.0
-- Improvements: Proper FKs, indexes, audit columns, UUIDs,
-- normalized types, soft deletes, timestamps everywhere
-- ============================================================

CREATE DATABASE IF NOT EXISTS hostel_db;
USE hostel_db;

-- ============================================================
-- 1. ROLES (RBAC Foundation)
-- ============================================================
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (role_name, description) VALUES
('student', 'Hostel resident student'),
('warden', 'Floor/hostel warden'),
('caretaker', 'Hostel caretaker staff'),
('mess_manager', 'Mess/dining hall manager'),
('hostel_manager', 'Overall hostel administrator'),
('admin', 'System super administrator');

-- ============================================================
-- 2. PERMISSIONS (Granular RBAC)
-- ============================================================
CREATE TABLE permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    permission_key VARCHAR(100) UNIQUE NOT NULL,  -- e.g. 'leave:approve', 'complaint:resolve'
    description VARCHAR(255),
    module VARCHAR(50) NOT NULL                    -- e.g. 'leave', 'complaint', 'room'
);

INSERT INTO permissions (permission_key, description, module) VALUES
-- Leave permissions
('leave:apply', 'Apply for leave', 'leave'),
('leave:view_own', 'View own leave requests', 'leave'),
('leave:view_all', 'View all leave requests', 'leave'),
('leave:approve', 'Approve/reject student leaves', 'leave'),
('leave:delete', 'Delete own pending leave', 'leave'),
-- Warden leave permissions
('warden_leave:apply', 'Apply for warden leave', 'warden_leave'),
('warden_leave:view_all', 'View all warden leaves', 'warden_leave'),
('warden_leave:approve', 'Approve/reject warden leaves', 'warden_leave'),
-- Complaint permissions
('complaint:create', 'File a complaint', 'complaint'),
('complaint:view_own', 'View own complaints', 'complaint'),
('complaint:view_all', 'View all complaints', 'complaint'),
('complaint:update_status', 'Update complaint status', 'complaint'),
-- Room permissions
('room:request_change', 'Request room change', 'room'),
('room:view_requests', 'View room change requests', 'room'),
('room:approve', 'Approve room changes', 'room'),
-- Meal permissions
('meal:request', 'Request meal changes', 'meal'),
('meal:view_all', 'View all meal requests', 'meal'),
('meal:manage', 'Manage meal requests', 'meal'),
-- Lab permissions
('lab:book', 'Book computer lab slot', 'lab'),
('lab:view_slots', 'View lab slots', 'lab'),
('lab:manage_slots', 'Create/edit lab slots', 'lab'),
-- Profile permissions
('profile:view_own', 'View own profile', 'profile'),
('profile:view_any', 'View any user profile', 'profile'),
('profile:edit_own', 'Edit own profile', 'profile'),
-- Analytics permissions
('analytics:view', 'View analytics dashboard', 'analytics'),
('analytics:export', 'Export analytics data', 'analytics'),
-- Audit permissions
('audit:view', 'View audit logs', 'audit'),
-- User management
('user:create', 'Create users', 'user'),
('user:edit', 'Edit users', 'user'),
('user:delete', 'Delete users', 'user'),
('user:bulk_import', 'Bulk import users', 'user');

-- ============================================================
-- 3. ROLE-PERMISSION MAPPING
-- ============================================================
CREATE TABLE role_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    UNIQUE KEY unique_role_perm (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Student permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.role_name = 'student' AND p.permission_key IN (
    'leave:apply', 'leave:view_own', 'leave:delete',
    'complaint:create', 'complaint:view_own',
    'room:request_change', 'meal:request', 'lab:book', 'lab:view_slots',
    'profile:view_own', 'profile:edit_own'
);

-- Warden permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.role_name = 'warden' AND p.permission_key IN (
    'leave:view_all', 'leave:approve',
    'warden_leave:apply',
    'complaint:view_all', 'complaint:update_status',
    'room:view_requests',
    'profile:view_own', 'profile:view_any', 'profile:edit_own'
);

-- Hostel Manager permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.role_name = 'hostel_manager' AND p.permission_key IN (
    'leave:view_all', 'leave:approve',
    'warden_leave:view_all', 'warden_leave:approve',
    'complaint:view_all', 'complaint:update_status',
    'room:view_requests', 'room:approve',
    'meal:view_all', 'meal:manage',
    'lab:manage_slots', 'lab:view_slots',
    'profile:view_own', 'profile:view_any', 'profile:edit_own',
    'analytics:view', 'analytics:export',
    'user:create', 'user:edit'
);

-- Admin permissions (everything)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.role_name = 'admin';

-- ============================================================
-- 4. USERS TABLE (Unified Auth — improved)
-- ============================================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    uuid CHAR(36) NOT NULL DEFAULT (UUID()),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255),                          -- NULL for OAuth-only users
    role_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    avatar_url VARCHAR(500),
    last_login_at TIMESTAMP NULL,
    last_login_ip VARCHAR(45),
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,                      -- Soft delete
    FOREIGN KEY (role_id) REFERENCES roles(id),
    INDEX idx_users_email (email),
    INDEX idx_users_role (role_id),
    INDEX idx_users_active (is_active)
);

-- ============================================================
-- 5. REFRESH TOKENS TABLE
-- ============================================================
CREATE TABLE refresh_tokens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL,               -- SHA-256 hash (never store raw)
    device_info VARCHAR(255),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_refresh_token_hash (token_hash),
    INDEX idx_refresh_user (user_id),
    INDEX idx_refresh_expires (expires_at)
);

-- ============================================================
-- 6. HOSTELS TABLE (Normalized)
-- ============================================================
CREATE TABLE hostels (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,               -- e.g. 'BH1', 'GH2'
    type ENUM('boys', 'girls', 'mixed') NOT NULL,
    total_floors INT NOT NULL,
    total_rooms INT NOT NULL,
    address TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- 7. ROOMS TABLE (Normalized)
-- ============================================================
CREATE TABLE rooms (
    id INT PRIMARY KEY AUTO_INCREMENT,
    hostel_id INT NOT NULL,
    room_number VARCHAR(20) NOT NULL,
    floor INT NOT NULL,
    capacity INT NOT NULL DEFAULT 2,
    current_occupancy INT NOT NULL DEFAULT 0,
    room_type ENUM('single', 'double', 'triple', 'dormitory') DEFAULT 'double',
    is_available BOOLEAN DEFAULT TRUE,
    UNIQUE KEY unique_hostel_room (hostel_id, room_number),
    FOREIGN KEY (hostel_id) REFERENCES hostels(id) ON DELETE CASCADE,
    INDEX idx_rooms_hostel (hostel_id),
    INDEX idx_rooms_available (is_available)
);

-- ============================================================
-- 8. WARDENS TABLE (Linked to users)
-- ============================================================
CREATE TABLE wardens (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    warden_id VARCHAR(20) UNIQUE NOT NULL,          -- Display ID like W001
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
);

-- ============================================================
-- 9. STUDENTS TABLE (Linked to users, rooms)
-- ============================================================
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    student_id VARCHAR(20) UNIQUE NOT NULL,          -- Roll number like S001
    contact VARCHAR(15) NOT NULL,
    department VARCHAR(50),
    year VARCHAR(20),
    semester INT,
    group_type INT,
    hostel_id INT,
    room_id INT,
    warden_id INT,                                   -- FK to wardens.id
    parent_name VARCHAR(100),
    parent_contact VARCHAR(15),
    emergency_contact VARCHAR(15),
    blood_group VARCHAR(5),
    date_of_birth DATE,
    admission_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (hostel_id) REFERENCES hostels(id),
    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (warden_id) REFERENCES wardens(id),
    INDEX idx_students_hostel (hostel_id),
    INDEX idx_students_warden (warden_id),
    INDEX idx_students_student_id (student_id)
);

-- ============================================================
-- 10. HOSTEL STAFF TABLE (Linked to users)
-- ============================================================
CREATE TABLE hostel_staff (
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
);

-- ============================================================
-- 11. LEAVE REQUESTS (Student) — Improved
-- ============================================================
CREATE TABLE leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,                         -- FK to students.id
    warden_id INT NOT NULL,                          -- FK to wardens.id
    leave_type ENUM('leave', 'od', 'internal_od', 'internal_training') NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    from_time TIME,
    to_time TIME,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    approved_by INT,                                 -- FK to users.id who approved
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT,
    parent_notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (warden_id) REFERENCES wardens(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_leave_student (student_id),
    INDEX idx_leave_warden (warden_id),
    INDEX idx_leave_status (status),
    INDEX idx_leave_dates (from_date, to_date)
);

-- ============================================================
-- 12. WARDEN LEAVE REQUESTS — Improved
-- ============================================================
CREATE TABLE warden_leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    warden_id INT NOT NULL,
    leave_type VARCHAR(30) NOT NULL,
    from_date DATE NOT NULL,
    to_date DATE NOT NULL,
    reason TEXT NOT NULL,
    alternate_warden_id INT,                         -- FK to wardens.id
    contact VARCHAR(15),
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (warden_id) REFERENCES wardens(id) ON DELETE CASCADE,
    FOREIGN KEY (alternate_warden_id) REFERENCES wardens(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_wleave_warden (warden_id),
    INDEX idx_wleave_status (status),
    INDEX idx_wleave_dates (from_date, to_date)
);

-- ============================================================
-- 13. COMPLAINTS — Improved
-- ============================================================
CREATE TABLE complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    complaint_type VARCHAR(50) NOT NULL,
    category ENUM('electrical', 'plumbing', 'furniture', 'cleaning', 'internet', 'security', 'other') DEFAULT 'other',
    priority ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
    description TEXT NOT NULL,
    filepath VARCHAR(500),
    location VARCHAR(100),                           -- Room/area where issue is
    assigned_to INT,                                 -- Staff member assigned
    status ENUM('pending', 'assigned', 'in_progress', 'resolved', 'closed', 'reopened') DEFAULT 'pending',
    resolution_notes TEXT,
    resolved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_to) REFERENCES users(id),
    INDEX idx_complaints_student (student_id),
    INDEX idx_complaints_status (status),
    INDEX idx_complaints_priority (priority),
    INDEX idx_complaints_type (complaint_type)
);

-- ============================================================
-- 14. COMPUTER LAB SLOTS — Improved
-- ============================================================
CREATE TABLE computerlab_slots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    venue VARCHAR(50) NOT NULL,
    from_time TIME NOT NULL,
    to_time TIME NOT NULL,
    slot_date DATE NOT NULL,
    total_systems INT NOT NULL,
    available_systems INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_lab_date (slot_date),
    INDEX idx_lab_venue (venue)
);

-- ============================================================
-- 15. COMPUTER BOOKINGS — Improved
-- ============================================================
CREATE TABLE computer_bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    slot_id INT NOT NULL,
    system_no INT NOT NULL,
    status ENUM('booked', 'checked_in', 'completed', 'cancelled', 'no_show') DEFAULT 'booked',
    checked_in_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (slot_id) REFERENCES computerlab_slots(id) ON DELETE CASCADE,
    UNIQUE KEY unique_slot_system (slot_id, system_no),
    INDEX idx_booking_student (student_id)
);

-- ============================================================
-- 16. ROOM CHANGE REQUESTS — Improved
-- ============================================================
CREATE TABLE room_change_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    current_room_id INT NOT NULL,
    requested_hostel_id INT,
    requested_floor INT,
    requested_room_id INT,
    reason TEXT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'completed') DEFAULT 'pending',
    approved_by INT,
    approved_at TIMESTAMP NULL,
    completed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (current_room_id) REFERENCES rooms(id),
    FOREIGN KEY (requested_room_id) REFERENCES rooms(id),
    FOREIGN KEY (requested_hostel_id) REFERENCES hostels(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_roomchange_student (student_id),
    INDEX idx_roomchange_status (status)
);

-- ============================================================
-- 17. MEAL REQUESTS — Improved
-- ============================================================
CREATE TABLE meal_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    meal_date DATE NOT NULL,
    meal_type ENUM('breakfast', 'lunch', 'snacks', 'dinner') NOT NULL,
    request_type ENUM('opt_in', 'opt_out', 'special_diet') DEFAULT 'opt_in',
    special_notes TEXT,
    status ENUM('requested', 'confirmed', 'cancelled', 'served') DEFAULT 'requested',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    UNIQUE KEY unique_student_meal (student_id, meal_date, meal_type),
    INDEX idx_meal_date (meal_date),
    INDEX idx_meal_student (student_id)
);

-- ============================================================
-- 18. NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
    module VARCHAR(50),                              -- 'leave', 'complaint', etc.
    reference_id INT,                                -- ID of related record
    reference_type VARCHAR(50),                      -- 'leave_request', 'complaint', etc.
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user (user_id),
    INDEX idx_notif_read (user_id, is_read),
    INDEX idx_notif_created (created_at)
);

-- ============================================================
-- 19. AUDIT LOGS TABLE
-- ============================================================
CREATE TABLE audit_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    user_email VARCHAR(100),
    action VARCHAR(50) NOT NULL,                     -- 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'
    module VARCHAR(50) NOT NULL,                     -- 'auth', 'leave', 'complaint', etc.
    target_table VARCHAR(50),
    target_id INT,
    old_values JSON,                                 -- Previous state (for updates)
    new_values JSON,                                 -- New state
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
);

-- ============================================================
-- 20. ANNOUNCEMENTS TABLE
-- ============================================================
CREATE TABLE announcements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author_id INT NOT NULL,
    target_role_id INT,                              -- NULL = all roles
    target_hostel_id INT,                            -- NULL = all hostels
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    is_pinned BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id),
    FOREIGN KEY (target_role_id) REFERENCES roles(id),
    FOREIGN KEY (target_hostel_id) REFERENCES hostels(id),
    INDEX idx_announce_date (created_at),
    INDEX idx_announce_target (target_role_id, target_hostel_id)
);

-- ============================================================
-- 21. SYSTEM SETTINGS TABLE
-- ============================================================
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    description VARCHAR(255),
    updated_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

INSERT INTO system_settings (setting_key, setting_value, description) VALUES
('max_leave_days', '15', 'Maximum leave days per semester'),
('leave_advance_days', '2', 'Minimum advance days for leave application'),
('meal_cutoff_hours', '2', 'Hours before meal to stop requests'),
('complaint_auto_escalate_days', '3', 'Days before unresolved complaint escalates'),
('lab_max_bookings_per_day', '2', 'Max lab bookings per student per day'),
('session_timeout_minutes', '30', 'Session timeout in minutes');
