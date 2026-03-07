const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const complaintController = require('../controllers/complaintController');
const { verifyToken: verifyJWT } = require('../middleware/auth.middleware');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
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

const upload = multer({ storage, fileFilter });

router.post('/add/:studentId', verifyJWT, upload.single('file'), complaintController.addComplaint);
router.get('/all', verifyJWT, complaintController.getAllComplaints);
router.put('/:id/status', verifyJWT, complaintController.updateComplaintStatus);
router.get('/student/:studentId', verifyJWT, complaintController.getComplaintsByStudent);

module.exports = router;
