const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { 
  registerValidationRules, 
  loginValidationRules, 
  validateRequest 
} = require('../middleware/validation.middleware');

router.post('/register', registerValidationRules(), validateRequest, authController.register);
router.post('/login', loginValidationRules(), validateRequest, authController.login);
router.post('/google-login', authController.googleLogin);

module.exports = router;
