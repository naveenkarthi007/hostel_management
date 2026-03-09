const express = require('express');
const router = express.Router();
const profile = require('../controllers/profile.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.get('/all', verifyToken, authorize('profile:view_any'), profile.getAllUsers);
router.get('/student-by-email/:email', verifyToken, profile.getStudentByEmail);
router.get('/warden-by-email/:email', verifyToken, profile.getWardenByEmail);
router.get('/student/:studentId', verifyToken, profile.getStudentProfile);
router.get('/warden/:wardenId', verifyToken, profile.getWardenProfile);

module.exports = router;
