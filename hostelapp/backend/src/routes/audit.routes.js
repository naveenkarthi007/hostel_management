const express = require('express');
const router = express.Router();
const audit = require('../controllers/audit.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.get('/', verifyToken, authorize('audit:view'), audit.getLogs);
router.get('/stats', verifyToken, authorize('audit:view'), audit.getStats);

module.exports = router;
