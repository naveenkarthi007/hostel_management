const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '.env') });

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Set security HTTP headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for local dev/vanilla HTML setup to avoid breaking inline scripts
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use('/api', limiter); // Apply rate limiter to all API routes


app.use(cors());
// Use Express 5 built-in body parsing (replaces body-parser which conflicts with Express 5)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Debug: Log all incoming requests
app.use((req, res, next) => {
    fs.appendFileSync(path.join(__dirname, 'debug.log'), `REQUEST: ${req.method} ${req.url}\n`);
    next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Chrome DevTools endpoint
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://localhost:*");
    res.json({});
});

// Avoid 500 on missing favicon
app.get('/favicon.ico', (req, res) => res.status(204).end());

const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const wardenLeaveRoutes = require('./routes/wardenLeaveRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const complaintRoutes = require('./routes/complaintRoutes');
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/warden-leave', wardenLeaveRoutes);
app.use('/api/leave', leaveRoutes);
app.use('/api/complaints', complaintRoutes);

// Fallback: serve frontend index.html for unmatched routes
app.get('/{*splat}', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
    fs.appendFileSync(path.join(__dirname, 'debug.log'), 'GLOBAL ERROR: ' + err.message + '\n' + err.stack + '\n');
    console.log('GLOBAL ERROR HANDLER:', err.message, err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
