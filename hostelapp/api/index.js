const dotenv = require('dotenv');
const path = require('path');

// Load .env from backend root
dotenv.config({ path: path.join(__dirname, '..', 'backend', '.env') });

const app = require('../backend/src/app');

module.exports = app;
