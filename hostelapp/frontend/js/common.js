const API = 'http://localhost:3000';

function showAlert(id, msg, type) {
    const el = document.getElementById(id);
    el.textContent = msg;
    el.className = 'alert alert-' + type;
    el.style.display = 'block';
    setTimeout(() => el.style.display = 'none', 4000);
}

function saveAuth(data) {
    localStorage.setItem('token', data.token);
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
    else if (role === 'hostelmanager') window.location.href = '/manager.html';
    else window.location.href = '/student.html';
}

function requireAuth(allowedRoles) {
    const user = getUser();
    const token = getToken();
    if (!user || !token) { window.location.href = '/'; return null; }
    if (allowedRoles && !allowedRoles.includes(user.role)) { window.location.href = '/'; return null; }
    return user;
}

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

function formatDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function statusBadge(status) {
    return '<span class="badge badge-' + status + '">' + status + '</span>';
}
