const db = require('../config/db');

// Add a new complaint
exports.addComplaint = (req, res) => {
  const { studentId } = req.params; // from URL
  const { complaint_type, issue, status } = req.body; // from body

  // If a file is uploaded, multer saves it and sets req.file
  const filepath = req.file ? `/uploads/${req.file.filename}` : null;

  const sql = `
    INSERT INTO complaints (student_id, complaint_type, filepath, issue, status)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [studentId, complaint_type, filepath, issue, status || 'pending'],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: "Complaint submitted successfully" });
    }
  );
};

// Update complaint status
exports.updateComplaintStatus = (req, res) => {
  const { id } = req.params; // complaint id
  const { status } = req.body;

  const sql = `UPDATE complaints SET status = ? WHERE id = ?`;

  db.query(sql, [status, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Complaint not found" });
    }

    res.status(200).json({ message: "Complaint status updated successfully" });
  });
};

// Get complaints by student
exports.getComplaintsByStudent = (req, res) => {
  const { studentId } = req.params;

  const sql = `SELECT * FROM complaints WHERE student_id = ? ORDER BY created_at DESC`;

  db.query(sql, [studentId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(results);
  });
};

// Get all complaints (for manager)
exports.getAllComplaints = (req, res) => {
  const sql = `SELECT * FROM complaints ORDER BY created_at DESC`;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(results);
  });
};
