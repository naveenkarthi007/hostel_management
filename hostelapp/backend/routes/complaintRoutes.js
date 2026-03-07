const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const complaintController = require('../controllers/complaintController');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Save to "uploads" folder
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

router.post('/add/:studentId', upload.single('file'), complaintController.addComplaint);
router.get('/all', complaintController.getAllComplaints);
router.put('/:id/status', complaintController.updateComplaintStatus);
router.get('/student/:studentId', complaintController.getComplaintsByStudent);

module.exports = router;
