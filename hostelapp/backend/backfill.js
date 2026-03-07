const pool = require('./config/db').promise;

(async () => {
  try {
    // Find student users not yet in the students table
    const [missing] = await pool.query(`
      SELECT u.name, u.email
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.role_name = 'student'
      AND u.email NOT IN (SELECT COALESCE(email,'') FROM students)
    `);
    console.log('Students to back-fill:', missing.length);
    for (const u of missing) {
      await pool.query('INSERT INTO students (name, email, contact) VALUES (?, ?, ?)', [u.name, u.email, 0]);
      console.log('  Inserted student:', u.email);
    }

    // Find warden users not yet in the warden table
    const [missingW] = await pool.query(`
      SELECT u.name, u.email
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.role_name = 'warden'
      AND u.email NOT IN (SELECT COALESCE(email,'') FROM warden)
    `);
    console.log('Wardens to back-fill:', missingW.length);
    for (const u of missingW) {
      await pool.query('INSERT INTO warden (name, email) VALUES (?, ?)', [u.name, u.email]);
      console.log('  Inserted warden:', u.email);
    }

    console.log('Back-fill complete!');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
