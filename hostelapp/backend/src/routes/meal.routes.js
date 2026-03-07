const express = require('express');
const router = express.Router();
const meal = require('../controllers/meal.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

router.post('/request/:studentId', verifyToken, authorize('meal:request'), meal.requestMeal);
router.get('/student/:studentId', verifyToken, authorize('meal:request'), meal.getByStudent);
router.get('/all', verifyToken, authorize('meal:view_all'), meal.getAll);
router.patch('/:id/cancel', verifyToken, authorize('meal:request'), meal.cancel);

module.exports = router;
