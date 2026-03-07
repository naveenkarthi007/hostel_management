
const express = require('express');
const router = express.Router();
const { getStudentProfile, getWardenProfile, getStudentByEmail, getWardenByEmail } = require('../controllers/ProfileController');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/student-by-email/:email', verifyToken, getStudentByEmail);
router.get('/warden-by-email/:email', verifyToken, getWardenByEmail);
router.get('/student/:studentId', verifyToken, getStudentProfile);
router.get('/warden/:wardenId', verifyToken, getWardenProfile);
module.exports = router;





