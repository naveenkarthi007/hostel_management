const pool = require('../config/db').promise;

/**
 * RBAC Middleware Factory
 * 
 * Usage:
 *   authorize('leave:approve')               — single permission
 *   authorize('leave:approve', 'leave:view') — any of these permissions
 *   authorizeRole('warden', 'hostel_manager') — role-based shortcut
 */
function authorize(...requiredPermissions) {
    return async (req, res, next) => {
        try {
            if (!req.user || !req.user.id) {
                return res.status(401).json({ message: 'Authentication required.' });
            }

            const [permissions] = await pool.query(
                `SELECT DISTINCT p.permission_key 
                 FROM role_permissions rp
                 JOIN permissions p ON rp.permission_id = p.id
                 JOIN users u ON u.role_id = rp.role_id
                 WHERE u.id = ?`,
                [req.user.id]
            );

            const userPermissions = permissions.map(p => p.permission_key);

            // Check if user has ANY of the required permissions
            const hasPermission = requiredPermissions.some(perm =>
                userPermissions.includes(perm)
            );

            if (!hasPermission) {
                return res.status(403).json({
                    message: 'Insufficient permissions.',
                    required: requiredPermissions,
                });
            }

            req.userPermissions = userPermissions;
            next();
        } catch (err) {
            console.error('RBAC Error:', err);
            return res.status(500).json({ message: 'Authorization check failed.' });
        }
    };
}

/**
 * Role-based shortcut (checks role_name directly).
 * Faster than permission check for simple role gates.
 */
function authorizeRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.role) {
            return res.status(401).json({ message: 'Authentication required.' });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                message: 'Access denied. Insufficient role.',
                required: allowedRoles,
                current: req.user.role,
            });
        }

        next();
    };
}

module.exports = { authorize, authorizeRole };
