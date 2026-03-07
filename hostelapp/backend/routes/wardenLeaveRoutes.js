const express = require('express');
const router = express.Router();
const { verifyToken: verifyJWT } = require('../middleware/auth.middleware');
const controller = require('../controllers/wardenLeaveController');

router.post('/apply/:wardenId', verifyJWT, controller.applyLeave);
router.delete('/delete/:id', verifyJWT, controller.deleteLeave);
router.patch('/status/:id', verifyJWT, controller.updateLeaveStatus);
router.get('/all', verifyJWT, controller.getAllLeaves);

module.exports = router;
