const express = require('express');
const router = express.Router();
const wl = require('../controllers/wardenLeave.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.post('/apply/:wardenId', verifyToken, authorize('warden_leave:apply'), wl.applyLeave);
router.delete('/delete/:id', verifyToken, authorize('warden_leave:apply'), wl.deleteLeave);
router.patch('/status/:id', verifyToken, authorize('warden_leave:approve'), wl.updateLeaveStatus);
router.get('/all', verifyToken, authorize('warden_leave:view_all'), wl.getAllLeaves);

module.exports = router;
