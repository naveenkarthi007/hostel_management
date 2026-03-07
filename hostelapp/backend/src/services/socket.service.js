const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const pool = require('../config/db').promise;

let io = null;

// Map userId → Set of socket IDs
const userSockets = new Map();

function initializeSocket(server) {
    io = new Server(server, {
        cors: {
            origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });

    // Authenticate WebSocket connections via JWT
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = decoded;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.user.id;
        console.log(`🔌 User ${userId} connected [${socket.id}]`);

        // Track user's sockets (supports multiple tabs/devices)
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Join role-based room
        socket.join(`role:${socket.user.role}`);

        // Send unread notification count on connect
        sendUnreadCount(userId);

        // Mark notification as read
        socket.on('notification:read', async (notificationId) => {
            try {
                await pool.query(
                    'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE id = ? AND user_id = ?',
                    [notificationId, userId]
                );
                sendUnreadCount(userId);
            } catch (err) {
                console.error('Mark read error:', err);
            }
        });

        // Mark all as read
        socket.on('notification:readAll', async () => {
            try {
                await pool.query(
                    'UPDATE notifications SET is_read = TRUE, read_at = NOW() WHERE user_id = ? AND is_read = FALSE',
                    [userId]
                );
                sendUnreadCount(userId);
            } catch (err) {
                console.error('Mark all read error:', err);
            }
        });

        socket.on('disconnect', () => {
            const sockets = userSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                }
            }
            console.log(`🔌 User ${userId} disconnected [${socket.id}]`);
        });
    });

    console.log('✅ WebSocket server initialized');
    return io;
}

// ── Notification Helpers ──

/**
 * Send a notification to a specific user (persist in DB + push via WS)
 */
async function notifyUser(userId, { title, message, type = 'info', module, referenceId, referenceType }) {
    try {
        // Persist to DB
        const [result] = await pool.query(
            `INSERT INTO notifications (user_id, title, message, type, module, reference_id, reference_type)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, title, message, type, module, referenceId || null, referenceType || null]
        );

        const notification = {
            id: result.insertId,
            title,
            message,
            type,
            module,
            referenceId,
            referenceType,
            isRead: false,
            createdAt: new Date().toISOString(),
        };

        // Push via WebSocket if user is online
        emitToUser(userId, 'notification:new', notification);
        sendUnreadCount(userId);

        return notification;
    } catch (err) {
        console.error('Notify user error:', err);
    }
}

/**
 * Notify all users with a specific role
 */
async function notifyRole(roleName, notificationData) {
    try {
        const [users] = await pool.query(
            `SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id 
             WHERE r.role_name = ? AND u.is_active = TRUE`,
            [roleName]
        );

        for (const user of users) {
            await notifyUser(user.id, notificationData);
        }
    } catch (err) {
        console.error('Notify role error:', err);
    }
}

/**
 * Emit event to a specific user across all their connected sockets
 */
function emitToUser(userId, event, data) {
    if (!io) return;
    const sockets = userSockets.get(userId);
    if (sockets) {
        for (const socketId of sockets) {
            io.to(socketId).emit(event, data);
        }
    }
}

/**
 * Send unread notification count to user
 */
async function sendUnreadCount(userId) {
    try {
        const [rows] = await pool.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        emitToUser(userId, 'notification:count', rows[0].count);
    } catch (err) {
        console.error('Unread count error:', err);
    }
}

function getIO() {
    return io;
}

module.exports = {
    initializeSocket,
    getIO,
    notifyUser,
    notifyRole,
    emitToUser,
};
