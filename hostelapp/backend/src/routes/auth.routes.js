const express = require('express');
const router = express.Router();
const auth = require('../controllers/auth.controller');
const { verifyToken, verifyRefreshToken } = require('../middleware/auth.middleware');
const { validate, authSchemas } = require('../middleware/validation.middleware');

// Public
router.post('/register', validate({ body: authSchemas.register }), auth.register);
router.post('/login', validate({ body: authSchemas.login }), auth.login);
router.post('/google-login', validate({ body: authSchemas.googleLogin }), auth.googleLogin);
router.post('/refresh', validate({ body: authSchemas.refreshToken }), verifyRefreshToken, auth.refresh);

// Authenticated
router.post('/logout', verifyToken, auth.logout);
router.post('/logout-all', verifyToken, auth.logoutAll);
router.get('/me', verifyToken, auth.me);

module.exports = router;
