const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const complaint = require('../controllers/complaint.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { authorize } = require('../middleware/rbac.middleware');

// File upload config
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', '..', 'uploads')),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only JPEG, PNG, or PDF files are allowed'));
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 }
});

// Student
router.post('/add/:studentId', verifyToken, authorize('complaint:create'), upload.single('file'), complaint.addComplaint);
router.get('/student/:studentId', verifyToken, authorize('complaint:view_own', 'complaint:view_all'), complaint.getComplaintsByStudent);

// Manager / Admin
router.get('/all', verifyToken, authorize('complaint:view_all'), complaint.getAllComplaints);
router.put('/:id/status', verifyToken, authorize('complaint:update_status'), complaint.updateComplaintStatus);

module.exports = router;
