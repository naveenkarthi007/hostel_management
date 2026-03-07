const pool = require('../config/db').promise;

// Apply for leave
exports.applyLeave = async (req, res) => {
  try {
    const {wardenId}=req.params;
    const {
      leave_type,
      from_date,
      to_date,
      reason,
      alt_warden_contact,
      alt_warden_name,
    } = req.body;

    // Get warden_id from warden table
    const [wardenRows] = await pool.query(
      'SELECT warden_id FROM warden WHERE warden_id = ?',
      [wardenId]
    );
    if (!wardenRows.length)
      return res.status(404).json({ message: 'Warden not found' });

    const warden_id = wardenRows[0].warden_id;

    // Get alternate warden id from contact
    const [altRows] = await pool.query(
      'SELECT warden_id FROM warden WHERE contact = ?',
      [alt_warden_contact]
    );
    if (!altRows.length)
      return res.status(404).json({ message: 'Alternate warden not found' });

    const alternate_wardenId = altRows[0].warden_id;

    // Check if warden has already applied for leave on overlapping dates
    const [existingLeaves] = await pool.query(
      `SELECT * FROM warden_leave_requests 
       WHERE warden_id = ? 
       AND status != 'rejected'
       AND (
         (from_date <= ? AND to_date >= ?) OR
         (from_date <= ? AND to_date >= ?) OR
         (from_date >= ? AND to_date <= ?)
       )`,
      [warden_id, from_date, from_date, to_date, to_date, from_date, to_date]
    );

    if (existingLeaves.length > 0) {
      return res.status(409).json({
        message: 'Leave request already exists for the selected date range',
      });
    }

    // Insert new leave request
    await pool.query(
      `INSERT INTO warden_leave_requests 
       (warden_id, leave_type, from_date, to_date, reason, alternate_warden, alternate_wardenId, contact, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        warden_id,
        leave_type,
        from_date,
        to_date,
        reason,
        alt_warden_name,
        alternate_wardenId,
        alt_warden_contact,
      ]
    );

    res.status(201).json({ message: 'Leave request submitted' });
  } catch (err) {
    console.error('Apply Leave Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


// Delete leave (only if status is pending)
exports.deleteLeave = async (req, res) => {
  const leaveId = req.params.id;
  const wardenEmail = req.user.email;

  try {
    const [wardenRows] = await pool.query(
      'SELECT warden_id FROM warden WHERE email = ?',
      [wardenEmail]
    );
    if (!wardenRows.length)
      return res.status(404).json({ message: 'Warden not found' });

    const warden_id = wardenRows[0].warden_id;

    const [leaveRows] = await pool.query(
      'SELECT * FROM warden_leave_requests WHERE id = ? AND warden_id = ? AND status = "pending"',
      [leaveId, warden_id]
    );

    if (!leaveRows.length)
      return res.status(403).json({ message: 'Not allowed to delete approved/rejected leave' });

    await pool.query('DELETE FROM warden_leave_requests WHERE id = ?', [leaveId]);
    res.json({ message: 'Leave request deleted' });
  } catch (err) {
    console.error('Delete Leave Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Hostel manager approves/rejects leave
exports.updateLeaveStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'approved' or 'rejected'

  if (!['approved', 'rejected'].includes(status))
    return res.status(400).json({ message: 'Invalid status' });

  try {
    await pool.query(
      'UPDATE warden_leave_requests SET status = ? WHERE id = ?',
      [status, id]
    );
    res.json({ message: `Leave request ${status}` });
  } catch (err) {
    console.error('Update Leave Status Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// Get all leave requests (Hostel Manager)
exports.getAllLeaves = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT wl.*, w1.name AS warden_name, w2.name AS alternate_warden_name
       FROM warden_leave_requests wl
       JOIN warden w1 ON wl.warden_id = w1.warden_id
       JOIN warden w2 ON wl.alternate_wardenId = w2.warden_id
      ORDER BY wl.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error('Get Leaves Error:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};