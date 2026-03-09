const pool = require('../config/db').promise;
const { logger } = require('../middleware/logger.middleware');

/**
 * Log an auditable action.
 * Called from controllers after successful mutations.
 * 
 * @param {Object} params
 * @param {number} params.userId - Who performed the action
 * @param {string} params.userEmail - Email of the actor
 * @param {string} params.action - CREATE, UPDATE, DELETE, LOGIN, LOGOUT
 * @param {string} params.module - auth, leave, complaint, etc.
 * @param {string} params.targetTable - DB table affected
 * @param {number} params.targetId - Row ID affected
 * @param {Object} params.oldValues - Previous state (for updates)
 * @param {Object} params.newValues - New state
 * @param {Object} params.req - Express request (for IP, user-agent)
 */
async function logAudit({
    userId, userEmail, action, module, targetTable, targetId,
    oldValues = null, newValues = null, req = null
}) {
    try {
        await pool.query(
            `INSERT INTO audit_logs 
             (user_id, user_email, action, module, target_table, target_id, 
              old_values, new_values, ip_address, user_agent, session_id)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId || null,
                userEmail || null,
                action,
                module,
                targetTable || null,
                targetId || null,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                req?.ip || null,
                req?.get('user-agent')?.substring(0, 500) || null,
                req?.headers['x-session-id'] || null,
            ]
        );
    } catch (err) {
        // Audit logging should never crash the main request
        logger.error('Audit log failed', { error: err.message });
    }
}

module.exports = { logAudit };
