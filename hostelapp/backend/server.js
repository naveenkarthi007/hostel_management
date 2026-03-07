const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Debug: Log all incoming requests
app.use((req, res, next) => {
    const fs = require('fs');
    fs.appendFileSync(path.join(__dirname, 'debug.log'), `REQUEST: ${req.method} ${req.url}\n`);
    next();
});

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self' http://localhost:*");
    res.json({});
});

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
    const fs = require('fs');
    fs.writeFileSync(path.join(__dirname, 'debug.log'), 'GLOBAL ERROR: ' + err.message + '\n' + err.stack + '\n');
    console.log('GLOBAL ERROR HANDLER:', err.message, err.stack);
    res.status(500).json({ message: 'Internal Server Error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
