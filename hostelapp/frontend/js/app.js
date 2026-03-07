/**
 * Hostel Management System — Frontend API Client
 * Handles JWT refresh, WebSocket, and API calls.
 */

const API = window.location.origin;

// ── Token Management ──

function getAccessToken() {
    return localStorage.getItem('accessToken');
}

function getRefreshToken() {
    return localStorage.getItem('refreshToken');
}

function setTokens(accessToken, refreshToken) {
    localStorage.setItem('accessToken', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
}

function clearTokens() {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
}

function getUser() {
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

// ── API Fetch with Auto-Refresh ──

async function apiFetch(url, options = {}) {
    const token = getAccessToken();

    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        },
    };

    // Don't set Content-Type for FormData (multer uploads)
    if (options.body instanceof FormData) {
        delete config.headers['Content-Type'];
    }

    let response = await fetch(`${API}${url}`, config);

    // If token expired, try refresh
    if (response.status === 401) {
        const data = await response.json().catch(() => ({}));

        if (data.code === 'TOKEN_EXPIRED') {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                // Retry original request with new token
                config.headers.Authorization = `Bearer ${getAccessToken()}`;
                response = await fetch(`${API}${url}`, config);
            } else {
                clearTokens();
                window.location.href = '/';
                return null;
            }
        } else {
            clearTokens();
            window.location.href = '/';
            return null;
        }
    }

    return response;
}

async function refreshAccessToken() {
    const refreshToken = getRefreshToken();
    if (!refreshToken) return false;

    try {
        const res = await fetch(`${API}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) return false;

        const data = await res.json();
        setTokens(data.accessToken, data.refreshToken);
        return true;
    } catch {
        return false;
    }
}

// ── WebSocket Connection ──

let socket = null;
let notificationCallbacks = [];

function connectWebSocket() {
    const token = getAccessToken();
    if (!token) return;

    // Load Socket.IO client from CDN if not already loaded
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.socket.io/4.7.5/socket.io.min.js';
        script.onload = () => initSocket(token);
        document.head.appendChild(script);
    } else {
        initSocket(token);
    }
}

function initSocket(token) {
    socket = io(API, {
        auth: { token },
        transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
        console.log('🔌 WebSocket connected');
    });

    socket.on('notification:new', (notification) => {
        showNotificationToast(notification);
        notificationCallbacks.forEach(cb => cb(notification));
    });

    socket.on('notification:count', (count) => {
        updateNotificationBadge(count);
    });

    socket.on('disconnect', () => {
        console.log('🔌 WebSocket disconnected');
    });

    socket.on('connect_error', (err) => {
        console.warn('WebSocket error:', err.message);
    });
}

function onNotification(callback) {
    notificationCallbacks.push(callback);
}

function markNotificationRead(notificationId) {
    if (socket) {
        socket.emit('notification:read', notificationId);
    }
}

function markAllNotificationsRead() {
    if (socket) {
        socket.emit('notification:readAll');
    }
}

// ── UI Helpers ──

function showNotificationToast(notification) {
    const toast = document.createElement('div');
    toast.className = `notification-toast notification-${notification.type}`;
    toast.innerHTML = `
        <strong>${escapeHtml(notification.title)}</strong>
        <p>${escapeHtml(notification.message)}</p>
    `;
    toast.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 10000;
        background: white; padding: 16px 20px; border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.15); max-width: 350px;
        border-left: 4px solid ${notification.type === 'success' ? '#22c55e' : notification.type === 'error' ? '#ef4444' : '#6366f1'};
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

function updateNotificationBadge(count) {
    const badges = document.querySelectorAll('.notification-badge');
    badges.forEach(badge => {
        badge.textContent = count;
        badge.style.display = count > 0 ? 'flex' : 'none';
    });
}

function showAlert(id, msg, type) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.className = 'alert alert-' + type;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ── Auth Helpers ──

async function login(email, password) {
    const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (res.ok) {
        setTokens(data.accessToken, data.refreshToken);
        setUser(data.user);
        connectWebSocket();
    }
    return { ok: res.ok, data };
}

async function logout() {
    const refreshToken = getRefreshToken();
    await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
    });
    if (socket) socket.disconnect();
    clearTokens();
    window.location.href = '/';
}

// ── Initialize ──
function initApp() {
    const token = getAccessToken();
    if (token) {
        connectWebSocket();
    }
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
