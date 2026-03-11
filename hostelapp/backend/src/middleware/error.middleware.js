const { logger } = require('./logger.middleware');

function errorHandler(err, req, res, _next) {
    if (res.headersSent) {
        return _next(err);
    }

    logger.error('Unhandled error', {
        message: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        userId: req.user?.id,
    });

    // Multer file size error
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File too large. Maximum size is 5MB.' });
    }

    // Multer file type error
    if (err.message && err.message.includes('Only JPEG')) {
        return res.status(400).json({ message: err.message });
    }

    // Joi validation error (shouldn't reach here if middleware is correct, but safety net)
    if (err.isJoi) {
        return res.status(400).json({
            message: 'Validation error',
            errors: err.details.map(d => d.message),
        });
    }

    // Default
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(statusCode).json({ message });
}

module.exports = { errorHandler };
