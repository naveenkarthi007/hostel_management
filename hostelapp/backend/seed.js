const db = require('./config/db').promise;

async function seed() {
  await db.query(
    `INSERT IGNORE INTO warden (name, email, warden_id, contact, department, hostel, floor)
     VALUES ('Dr. Kumar', 'kumar@hostel.com', 'W001', '9876543210', 'CSE', 'Boys Hostel 1', '2')`
  );
  await db.query(
    `INSERT IGNORE INTO warden (name, email, warden_id, contact, department, hostel, floor)
     VALUES ('Dr. Ravi', 'ravi@hostel.com', 'W002', '9876543211', 'ECE', 'Boys Hostel 1', '3')`
  );
  await db.query(
    `INSERT IGNORE INTO students (name, email, student_id, contact, department, year, grouptype, hostel, room, warden_id)
     VALUES ('Test Student', 'test@student.com', 'S001', 1234567890, 'CSE', '3rd', 1, 'Boys Hostel 1', '205', 'W001')`
  );
  console.log('Seed data inserted');
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
