const { logger } = require('../middleware/logger.middleware');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db').promise;
const { logAudit } = require('../services/audit.service');

const BCRYPT_ROUNDS = 12;

// ── Token Generation ──

function generateAccessToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role, roleId: user.roleId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m' }
    );
}

function generateRefreshToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, tokenType: 'refresh' },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
    );
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function storeRefreshToken(userId, token, req) {
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, device_info, ip_address, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, tokenHash, req.get('user-agent')?.substring(0, 255), req.ip, expiresAt]
    );
}

// ── Register ──

exports.register = async (req, res) => {
    try {
        const { name, email, password, role_id } = req.body;

        const [existingUser] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return res.status(409).json({ message: 'Email already in use.' });
        }

        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const selectedRoleId = role_id || 1; // Default: student

        const [result] = await pool.query(
            'INSERT INTO users (name, email, password, role_id) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, selectedRoleId]
        );

        const [roleData] = await pool.query('SELECT role_name FROM roles WHERE id = ?', [selectedRoleId]);
        const roleName = roleData[0]?.role_name || 'student';

        const user = { id: result.insertId, email, role: roleName, roleId: selectedRoleId };

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        await storeRefreshToken(user.id, refreshToken, req);

        await logAudit({
            userId: user.id, userEmail: email,
            action: 'CREATE', module: 'auth',
            targetTable: 'users', targetId: user.id,
            newValues: { name, email, role: roleName },
            req,
        });

        res.status(201).json({
            message: 'Registered successfully',
            accessToken,
            refreshToken,
            user: { id: user.id, name, email, role: roleName },
        });
    } catch (err) {
        logger.error('Register Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Login ──

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const [users] = await pool.query(
            `SELECT u.*, r.role_name FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.email = ? AND u.deleted_at IS NULL`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        const user = users[0];

        // Check account lock
        if (user.locked_until && new Date(user.locked_until) > new Date()) {
            return res.status(423).json({
                message: 'Account temporarily locked. Try again later.',
                lockedUntil: user.locked_until,
            });
        }

        if (!user.is_active) {
            return res.status(403).json({ message: 'Account deactivated. Contact admin.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            // Increment failed attempts
            const newAttempts = (user.failed_login_attempts || 0) + 1;
            const lockUntil = newAttempts >= 5
                ? new Date(Date.now() + 15 * 60 * 1000) // Lock for 15 min after 5 failures
                : null;

            await pool.query(
                'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
                [newAttempts, lockUntil, user.id]
            );

            await logAudit({
                userId: user.id, userEmail: email,
                action: 'LOGIN_FAILED', module: 'auth',
                newValues: { attempts: newAttempts, locked: !!lockUntil },
                req,
            });

            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // Reset failed attempts on success
        await pool.query(
            'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
            [req.ip, user.id]
        );

        const tokenUser = { id: user.id, email: user.email, role: user.role_name, roleId: user.role_id };
        const accessToken = generateAccessToken(tokenUser);
        const refreshToken = generateRefreshToken(tokenUser);
        await storeRefreshToken(user.id, refreshToken, req);

        await logAudit({
            userId: user.id, userEmail: email,
            action: 'LOGIN', module: 'auth', req,
        });

        res.json({
            message: 'Login successful',
            accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
        });
    } catch (err) {
        logger.error('Login Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Refresh Token ──

exports.refresh = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const decoded = req.refreshPayload;
        const tokenHash = hashToken(refreshToken);

        // Verify token exists in DB and is not revoked
        const [tokens] = await pool.query(
            'SELECT * FROM refresh_tokens WHERE token_hash = ? AND user_id = ? AND is_revoked = FALSE AND expires_at > NOW()',
            [tokenHash, decoded.id]
        );

        if (tokens.length === 0) {
            return res.status(403).json({ message: 'Invalid or revoked refresh token.' });
        }

        // Revoke old token (rotation)
        await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = ?', [tokenHash]);

        // Get current user data
        const [users] = await pool.query(
            'SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND u.deleted_at IS NULL',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(403).json({ message: 'User not found.' });
        }

        const user = users[0];
        const tokenUser = { id: user.id, email: user.email, role: user.role_name, roleId: user.role_id };

        const newAccessToken = generateAccessToken(tokenUser);
        const newRefreshToken = generateRefreshToken(tokenUser);
        await storeRefreshToken(user.id, newRefreshToken, req);

        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (err) {
        logger.error('Refresh Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Logout (Revoke refresh token) ──

exports.logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            const tokenHash = hashToken(refreshToken);
            await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE token_hash = ?', [tokenHash]);
        }

        await logAudit({
            userId: req.user?.id, userEmail: req.user?.email,
            action: 'LOGOUT', module: 'auth', req,
        });

        res.json({ message: 'Logged out successfully.' });
    } catch (err) {
        logger.error('Logout Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Logout All Devices ──

exports.logoutAll = async (req, res) => {
    try {
        await pool.query('UPDATE refresh_tokens SET is_revoked = TRUE WHERE user_id = ?', [req.user.id]);

        await logAudit({
            userId: req.user.id, userEmail: req.user.email,
            action: 'LOGOUT_ALL', module: 'auth', req,
        });

        res.json({ message: 'Logged out from all devices.' });
    } catch (err) {
        logger.error('Logout All Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Google Login (Server-verified) ──

exports.googleLogin = async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ message: 'Missing Google credential.' });
        }

        // Server-side verification of Google ID token
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        let payload;
        try {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } catch (verifyErr) {
            logger.warn('Google token verification failed:', { error: verifyErr.message });
            return res.status(401).json({ message: 'Invalid or expired Google token.' });
        }

        const email = payload.email;
        if (!email) {
            return res.status(400).json({ message: 'Email not found in Google token.' });
        }

        const [users] = await pool.query(
            `SELECT u.*, r.role_name FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.email = ? AND u.deleted_at IS NULL`,
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ message: 'User not registered. Contact admin.' });
        }

        const user = users[0];
        if (!user.is_active) {
            return res.status(403).json({ message: 'Account deactivated.' });
        }

        await pool.query(
            'UPDATE users SET last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
            [req.ip, user.id]
        );

        const tokenUser = { id: user.id, email: user.email, role: user.role_name, roleId: user.role_id };
        const accessToken = generateAccessToken(tokenUser);
        const refreshToken = generateRefreshToken(tokenUser);
        await storeRefreshToken(user.id, refreshToken, req);

        await logAudit({
            userId: user.id, userEmail: email,
            action: 'LOGIN', module: 'auth',
            newValues: { method: 'google' },
            req,
        });

        res.json({
            accessToken,
            refreshToken,
            user: { id: user.id, name: user.name, email: user.email, role: user.role_name },
        });
    } catch (err) {
        logger.error('Google Login Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Get Current User ──

exports.me = async (req, res) => {
    try {
        const [users] = await pool.query(
            `SELECT u.id, u.name, u.email, u.avatar_url, u.last_login_at, r.role_name as role
             FROM users u JOIN roles r ON u.role_id = r.id
             WHERE u.id = ? AND u.deleted_at IS NULL`,
            [req.user.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ message: 'User not found.' });
        }

        res.json(users[0]);
    } catch (err) {
        logger.error('Me Error:', { error: err.message, stack: err.stack });
        res.status(500).json({ message: 'Internal server error.' });
    }
};
