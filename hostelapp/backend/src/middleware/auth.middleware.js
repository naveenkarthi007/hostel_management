const jwt = require('jsonwebtoken');
const pool = require('../config/db').promise;

/**
 * Verify JWT access token.
 * Attaches decoded user to req.user: { id, email, role, roleId }
 */
exports.verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired.', code: 'TOKEN_EXPIRED' });
        }
        return res.status(403).json({ message: 'Invalid token.' });
    }
};

/**
 * Verify refresh token (used only on /auth/refresh endpoint).
 */
exports.verifyRefreshToken = async (req, res, next) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token required.' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        req.refreshPayload = decoded;
        req.rawRefreshToken = refreshToken;
        next();
    } catch (err) {
        return res.status(403).json({ message: 'Invalid or expired refresh token.' });
    }
};
