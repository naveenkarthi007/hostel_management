const express = require('express');
const router = express.Router();
const bulk = require('../controllers/bulk.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');
const { validate, bulkSchemas } = require('../middleware/validation.middleware');

router.post('/students', verifyToken, authorize('user:bulk_import'), validate({ body: bulkSchemas.students }), bulk.bulkImportStudents);
router.post('/wardens', verifyToken, authorize('user:bulk_import'), bulk.bulkImportWardens);

module.exports = router;
