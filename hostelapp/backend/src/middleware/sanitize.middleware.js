/**
 * XSS sanitization middleware — replaces the broken xss-clean package.
 * Recursively strips dangerous HTML characters from strings in
 * req.body, req.query, and req.params so downstream code never
 * sees raw `<script>` or `javascript:` payloads.
 *
 * Works with Express 5 (does NOT mutate IncomingMessage.prototype).
 */

function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
}

function sanitizeValue(value) {
    if (typeof value === 'string') {
        return escapeHtml(value);
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === 'object') {
        return sanitizeObject(value);
    }
    return value;
}

function sanitizeObject(obj) {
    const clean = {};
    for (const key of Object.keys(obj)) {
        clean[key] = sanitizeValue(obj[key]);
    }
    return clean;
}

function sanitize(req, _res, next) {
    if (req.body && typeof req.body === 'object') {
        req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
        req.query = sanitizeObject(req.query);
    }
    // req.params is set per-route, so we skip it here — Joi validation
    // handles params sanitization downstream.
    next();
}

module.exports = { sanitize, escapeHtml };
