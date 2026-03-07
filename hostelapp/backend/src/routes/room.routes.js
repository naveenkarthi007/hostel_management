const express = require('express');
const router = express.Router();
const room = require('../controllers/room.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.post('/change/:studentId', verifyToken, authorize('room:request_change'), room.requestChange);
router.get('/changes', verifyToken, authorize('room:view_requests'), room.getAll);
router.patch('/change/:id/status', verifyToken, authorize('room:approve'), room.updateStatus);

module.exports = router;
