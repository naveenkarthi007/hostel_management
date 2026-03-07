const { body, validationResult } = require('express-validator');

// Validation results checker middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
    });
  }
  next();
};

// Rules for user registration
const registerValidationRules = () => {
  return [
    body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Valid email is required')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
    body('role_id')
        .notEmpty().withMessage('Role ID is required')
        .isInt({ min: 1, max: 5 }).withMessage('Valid Role ID is required (1-5)')
  ];
};

// Rules for user login
const loginValidationRules = () => {
    return [
      body('email')
          .trim()
          .notEmpty().withMessage('Email is required')
          .isEmail().withMessage('Valid email is required')
          .normalizeEmail(),
      body('password')
          .notEmpty().withMessage('Password is required')
    ];
};

module.exports = {
  validateRequest,
  registerValidationRules,
  loginValidationRules
};
