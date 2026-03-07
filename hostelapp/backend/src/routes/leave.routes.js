const express = require('express');
const router = express.Router();
const leave = require('../controllers/leave.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize, authorizeRole } = require('../middleware/rbac.middleware');
const { validate, leaveSchemas } = require('../middleware/validation.middleware');

// Student
router.post('/apply/:studentId', verifyToken, authorize('leave:apply'), validate({ body: leaveSchemas.apply }), leave.applyLeave);
router.get('/student/:studentId', verifyToken, authorize('leave:view_own', 'leave:view_all'), leave.getLeavesByStudent);
router.delete('/delete/:leaveId', verifyToken, authorize('leave:delete'), leave.deleteLeave);

// Warden / Manager
router.get('/all', verifyToken, authorize('leave:view_all'), leave.getAllLeaves);
router.put('/status/:leaveId', verifyToken, authorize('leave:approve'), validate({ body: leaveSchemas.updateStatus }), leave.updateLeaveStatus);

module.exports = router;
