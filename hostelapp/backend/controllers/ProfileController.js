const db = require('../config/db');

// Get Student Profile + Warden Details
exports.getStudentProfile = (req, res) => {
  const { studentId } = req.params;

  // Step 1: Get Student details (including warden_id)
  // Support lookup by student_id (string) or by numeric id
  const isNumeric = /^\d+$/.test(studentId);
  const studentSql = isNumeric
    ? `SELECT name, email, student_id, contact, department, year,
             grouptype, hostel, room, warden_id
       FROM students WHERE id = ?`
    : `SELECT name, email, student_id, contact, department, year,
             grouptype, hostel, room, warden_id
       FROM students WHERE student_id = ?`;


  db.query(studentSql, [studentId], (err, studentResults) => {
    if (err) return res.status(500).json({ error: err.message });

    if (studentResults.length === 0) {
      return res.status(404).json({ error: "Student not found" });
    }

    const student = studentResults[0];
    const wardenId = student.warden_id;

    if (!wardenId) {
      // If no warden assigned, just return student details
      return res.status(200).json({ student, warden: null });
    }

    // Step 2: Get Warden details using warden_id
    const wardenSql = `
      SELECT id, name, email, warden_id, contact
      FROM warden
      WHERE warden_id = ?
    `;

    db.query(wardenSql, [wardenId], (err2, wardenResults) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const warden = wardenResults.length > 0 ? wardenResults[0] : null;

      // Step 3: Return both student & warden
      res.status(200).json({
        student,
        warden
      });
    });
  });
};

// Get Warden Profile Only
exports.getWardenProfile = (req, res) => {
  const { wardenId } = req.params;

  const sql = `
    SELECT id, name, email, warden_id, contact, department, hostel, floor
    FROM warden
    WHERE warden_id = ?
  `;

  db.query(sql, [wardenId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    if (results.length === 0) {
      return res.status(404).json({ error: "Warden not found" });
    }

    res.status(200).json(results[0]);
  });
};

// Get student_id by email
exports.getStudentByEmail = (req, res) => {
  const email = decodeURIComponent(req.params.email);
  db.query('SELECT id, student_id FROM students WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Student not found' });
    const row = results[0];
    // Auto-generate student_id if it was never set
    if (!row.student_id) {
      const generated = 'STU' + String(row.id).padStart(5, '0');
      db.query('UPDATE students SET student_id = ? WHERE id = ? AND student_id IS NULL', [generated, row.id], () => {});
      return res.json({ id: row.id, student_id: generated });
    }
    res.json({ id: row.id, student_id: row.student_id });
  });
};

// Get warden_id by email
exports.getWardenByEmail = (req, res) => {
  const email = decodeURIComponent(req.params.email);
  db.query('SELECT warden_id FROM warden WHERE email = ?', [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Warden not found' });
    res.json({ warden_id: results[0].warden_id });
  });
};
