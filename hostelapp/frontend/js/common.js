const API = 'http://localhost:3000';

// ══════════════════════════════════════════
// AUTH HELPERS
// ══════════════════════════════════════════
function saveAuth(data) {
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('user', JSON.stringify(data.user));
}
function getToken() { return localStorage.getItem('token'); }
function getUser() { return JSON.parse(localStorage.getItem('user') || 'null'); }
function logout() {
    localStorage.clear();
    window.location.href = '/';
}
function redirectByRole(user) {
    const role = user.role;
    if (role === 'student') window.location.href = '/student.html';
    else if (role === 'warden') window.location.href = '/warden.html';
    else if (role === 'admin') window.location.href = '/admin.html';
    else if (role === 'hostelmanager' || role === 'hostel_manager' || role === 'caretaker' || role === 'messmanager' || role === 'mess_manager') window.location.href = '/manager.html';
    else {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/';
    }
}
function requireAuth(allowedRoles) {
    const user = getUser();
    const token = getToken();
    if (!user || !token) {
        localStorage.clear();
        window.location.href = '/';
        return null;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        redirectByRole(user);
        return null;
    }
    return user;
}

// ══════════════════════════════════════════
// API FETCH
// ══════════════════════════════════════════
async function apiCall(url, options = {}) {
    const token = getToken();
    const headers = { ...(options.headers || {}) };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(API + url, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'Request failed');
    return data;
}

// ══════════════════════════════════════════
// FORMATTERS
// ══════════════════════════════════════════
function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}
function statusBadge(status) {
    return '<span class="badge badge-' + status + '">' + status + '</span>';
}

// ══════════════════════════════════════════
// TOAST NOTIFICATION SYSTEM
// ══════════════════════════════════════════
(function initToastContainer() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _createToastContainer);
    } else {
        _createToastContainer();
    }
    function _createToastContainer() {
        if (!document.getElementById('toast-container')) {
            const c = document.createElement('div');
            c.id = 'toast-container';
            c.className = 'toast-container';
            document.body.appendChild(c);
        }
    }
})();

const TOAST_ICONS = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
const TOAST_TITLES = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Info' };

function showToast(message, type = 'info', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
        <div class="toast-body">
            <div class="toast-title">${TOAST_TITLES[type] || 'Notification'}</div>
            <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Legacy support — redirect showAlert to toast
function showAlert(id, msg, type) {
    // Map old type names to toast types
    const typeMap = { error: 'error', success: 'success', warning: 'warning', info: 'info' };
    showToast(msg, typeMap[type] || 'info');
}

// ══════════════════════════════════════════
// CUSTOM CONFIRM DIALOG
// ══════════════════════════════════════════
function confirmDialog(message, title = 'Are you sure?') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-box">
                <div class="modal-icon">🗑️</div>
                <div class="modal-title">${title}</div>
                <div class="modal-message">${message}</div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
                    <button class="btn btn-danger" id="modal-confirm">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#modal-confirm').onclick = () => { overlay.remove(); resolve(true); };
        overlay.querySelector('#modal-cancel').onclick = () => { overlay.remove(); resolve(false); };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

// ══════════════════════════════════════════
// BUTTON LOADING STATE
// ══════════════════════════════════════════
function setButtonLoading(btn, isLoading, originalText) {
    if (isLoading) {
        btn.dataset.originalText = btn.innerHTML;
        btn.class = (btn.className + ' loading').trim();
        btn.classList.add('loading');
        btn.disabled = true;
        btn.innerHTML = originalText || btn.dataset.originalText || 'Loading...';
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    }
}

// ══════════════════════════════════════════
// SKELETON LOADERS
// ══════════════════════════════════════════
function showSkeletons(tbodyId, cols, rows = 4) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const widths = ['w-80', 'w-60', 'w-40', 'w-60', 'w-30', 'w-60', 'w-40', 'w-80'];
    tbody.innerHTML = Array.from({ length: rows }, () =>
        `<tr class="skeleton-row">${Array.from({ length: cols }, (_, i) =>
            `<td><div class="skeleton-cell ${widths[i % widths.length]}"></div></td>`
        ).join('')}</tr>`
    ).join('');
}
