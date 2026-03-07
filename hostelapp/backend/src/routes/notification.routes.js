const express = require('express');
const router = express.Router();
const notif = require('../controllers/notification.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/', verifyToken, notif.getNotifications);
router.patch('/:id/read', verifyToken, notif.markRead);
router.patch('/read-all', verifyToken, notif.markAllRead);

module.exports = router;
