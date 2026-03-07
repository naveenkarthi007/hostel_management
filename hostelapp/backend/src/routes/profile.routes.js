const express = require('express');
const router = express.Router();
const profile = require('../controllers/profile.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/student-by-email/:email', verifyToken, profile.getStudentByEmail);
router.get('/warden-by-email/:email', verifyToken, profile.getWardenByEmail);
router.get('/student/:studentId', verifyToken, profile.getStudentProfile);
router.get('/warden/:wardenId', verifyToken, profile.getWardenProfile);

module.exports = router;
