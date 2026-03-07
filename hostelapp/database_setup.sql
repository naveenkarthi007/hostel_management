-- ============================================
-- Hostel Management System - Full Database Setup
-- ============================================

-- Create and use the database
CREATE DATABASE IF NOT EXISTS hostel_db;
USE hostel_db;

-- ============================================
-- 1. ROLES TABLE
-- ============================================
CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(50) UNIQUE NOT NULL
);

-- Insert default roles
INSERT INTO roles (role_name) VALUES 
('student'), 
('warden'), 
('caretaker'), 
('messmanager'), 
('hostelmanager');

-- ============================================
-- 2. USERS TABLE (Authentication)
-- ============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255),
    role_id INT,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- ============================================
-- 3. WARDEN TABLE
-- ============================================
CREATE TABLE warden (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    warden_id VARCHAR(20) UNIQUE,
    contact VARCHAR(15),
    department VARCHAR(50),
    hostel VARCHAR(20),
    floor VARCHAR(10)
);

-- ============================================
-- 4. STUDENTS TABLE
-- ============================================
CREATE TABLE students (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    student_id VARCHAR(20) UNIQUE,
    contact INT NOT NULL,
    department VARCHAR(50),
    year VARCHAR(20),
    grouptype INT,
    hostel VARCHAR(50),
    room VARCHAR(15),
    warden_id VARCHAR(20),
    FOREIGN KEY (warden_id) REFERENCES warden(warden_id)
);

-- ============================================
-- 5. HOSTEL STAFF TABLE
-- ============================================
CREATE TABLE hostelstaff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE,
    name VARCHAR(100),
    email VARCHAR(100),
    contact VARCHAR(15),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- ============================================
-- 6. LEAVE REQUESTS TABLE (Student Leaves)
-- ============================================
CREATE TABLE leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20),
    warden_id VARCHAR(20),
    from_date DATE,
    to_date DATE,
    reason TEXT,
    leave_type ENUM('Leave', 'OD', 'Internal OD', 'Internal Training') NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (warden_id) REFERENCES warden(warden_id)
);

-- ============================================
-- 7. STUDENT LEAVES TABLE (Extended Leave Info)
-- ============================================
CREATE TABLE student_leaves (
    id INT AUTO_INCREMENT PRIMARY KEY,
    student_id VARCHAR(20),
    warden_id VARCHAR(20),
    leave_type ENUM('Leave', 'OD', 'Internal OD', 'Internal Training') NOT NULL,
    from_date DATE,
    to_date DATE,
    from_time TIME,
    to_time TIME,
    reason TEXT,
    warden_approval ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (warden_id) REFERENCES warden(warden_id)
);

-- ============================================
-- 8. WARDEN LEAVE REQUESTS TABLE
-- ============================================
CREATE TABLE warden_leave_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    warden_id VARCHAR(20),
    leave_type VARCHAR(20),
    from_date DATE,
    to_date DATE,
    reason TEXT,
    alternate_warden VARCHAR(20),
    alternate_wardenId VARCHAR(20),
    contact VARCHAR(15),
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (warden_id) REFERENCES warden(warden_id),
    FOREIGN KEY (alternate_wardenId) REFERENCES warden(warden_id)
);

-- ============================================
-- 9. COMPLAINTS TABLE
-- ============================================
CREATE TABLE complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT,
    complaint_type VARCHAR(50),
    filepath VARCHAR(255),
    issue TEXT,
    status ENUM('pending', 'assigned', 'resolved') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ============================================
-- 10. COMPUTER LAB SLOTS TABLE
-- ============================================
CREATE TABLE computerlab_slots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    venue VARCHAR(50),
    from_time TIME,
    to_time TIME,
    slot_date DATE,
    total_systems INT
);

-- ============================================
-- 11. COMPUTER BOOKINGS TABLE
-- ============================================
CREATE TABLE computer_bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(50),
    slot_id INT,
    system_no INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(student_id),
    FOREIGN KEY (slot_id) REFERENCES computerlab_slots(id),
    UNIQUE (slot_id, system_no)
);

-- ============================================
-- 12. ROOM CHANGE REQUESTS TABLE
-- ============================================
CREATE TABLE room_change_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20),
    hostel VARCHAR(10),
    floor VARCHAR(10),
    room_no INT,
    cot VARCHAR(10),
    reason TEXT,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);

-- ============================================
-- 13. MEAL REQUESTS TABLE
-- ============================================
CREATE TABLE meal_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id VARCHAR(20),
    date DATE,
    meal_type ENUM('breakfast', 'lunch', 'dinner'),
    status ENUM('requested', 'cancelled', 'served') DEFAULT 'requested',
    FOREIGN KEY (student_id) REFERENCES students(student_id)
);
