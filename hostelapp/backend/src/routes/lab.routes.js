const express = require('express');
const router = express.Router();
const lab = require('../controllers/lab.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const { validate, labSchemas } = require('../middleware/validation.middleware');

router.get('/slots', verifyToken, authorize('lab:view_slots'), lab.getSlots);
router.post('/book/:studentId', verifyToken, authorize('lab:book'), validate({ body: labSchemas.book }), lab.bookSystem);
router.patch('/booking/:id/cancel', verifyToken, authorize('lab:book'), lab.cancelBooking);
router.post('/slots', verifyToken, authorize('lab:manage_slots'), validate({ body: labSchemas.createSlot }), lab.createSlot);

module.exports = router;
