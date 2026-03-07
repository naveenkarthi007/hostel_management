const express = require('express');
const router = express.Router();
const analytics = require('../controllers/analytics.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.get('/dashboard', verifyToken, authorize('analytics:view'), analytics.dashboard);
router.get('/leave-trends', verifyToken, authorize('analytics:view'), analytics.leaveTrends);
router.get('/complaint-metrics', verifyToken, authorize('analytics:view'), analytics.complaintMetrics);

module.exports = router;
