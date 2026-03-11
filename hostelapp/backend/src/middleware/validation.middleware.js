const Joi = require('joi');

/**
 * Validation middleware factory.
 * Pass a Joi schema for body, params, and/or query.
 * 
 * Usage:
 *   validate({ body: loginSchema })
 *   validate({ body: leaveSchema, params: studentIdSchema })
 */
function validate(schemas) {
    return (req, res, next) => {
        const errors = [];

        for (const [source, schema] of Object.entries(schemas)) {
            if (!req[source]) continue;

            const { error, value } = schema.validate(req[source], {
                abortEarly: false,
                stripUnknown: true,
            });

            if (error) {
                errors.push(
                    ...error.details.map(d => ({
                        field: d.path.join('.'),
                        message: d.message,
                        source,
                    }))
                );
            } else {
                req[source] = value; // Replace with sanitized values
            }
        }

        if (errors.length > 0) {
            return res.status(400).json({
                message: errors.map(e => e.message).join('. '),
                errors,
            });
        }

        next();
    };
}

// ── Reusable Schemas ──

const authSchemas = {
    register: Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        email: Joi.string().email().lowercase().trim().required(),
        password: Joi.string().min(8).max(128).required()
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
            .message('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
        role_id: Joi.number().integer().min(1).max(6).optional(),
    }),

    login: Joi.object({
        email: Joi.string().email().lowercase().trim().required(),
        password: Joi.string().required(),
    }),

    googleLogin: Joi.object({
        credential: Joi.string().required(), // Google ID token (not raw email)
    }),

    refreshToken: Joi.object({
        refreshToken: Joi.string().required(),
    }),
};

const leaveSchemas = {
    apply: Joi.object({
        leaveType: Joi.string().valid('Leave', 'OD', 'Internal OD', 'Internal Training').required(),
        fromDate: Joi.date().iso().required(),
        toDate: Joi.date().iso().min(Joi.ref('fromDate')).required(),
        fromTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
        toTime: Joi.string().pattern(/^\d{2}:\d{2}$/).optional(),
        reason: Joi.string().trim().min(10).max(1000).required(),
    }),

    updateStatus: Joi.object({
        status: Joi.string().valid('approved', 'rejected').required(),
        rejectionReason: Joi.string().trim().max(500).when('status', {
            is: 'rejected',
            then: Joi.optional(),
            otherwise: Joi.forbidden(),
        }),
    }),
};

const complaintSchemas = {
    create: Joi.object({
        complaint_type: Joi.string().trim().max(50).required(),
        category: Joi.string().valid('electrical', 'plumbing', 'furniture', 'cleaning', 'internet', 'security', 'other').default('other'),
        priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
        description: Joi.string().trim().min(10).max(2000).required(),
        location: Joi.string().trim().max(100).optional(),
    }),

    updateStatus: Joi.object({
        status: Joi.string().valid('assigned', 'in_progress', 'resolved', 'closed', 'reopened').required(),
        resolution_notes: Joi.string().trim().max(1000).optional(),
        assigned_to: Joi.number().integer().optional(),
    }),
};

const roomSchemas = {
    changeRequest: Joi.object({
        requested_hostel_id: Joi.number().integer().optional(),
        requested_floor: Joi.number().integer().min(0).max(20).optional(),
        requested_room_id: Joi.number().integer().optional(),
        reason: Joi.string().trim().min(10).max(1000).required(),
    }),
};

const mealSchemas = {
    request: Joi.object({
        meal_date: Joi.date().iso().required(),
        meal_type: Joi.string().valid('breakfast', 'lunch', 'snacks', 'dinner').required(),
        request_type: Joi.string().valid('opt_in', 'opt_out', 'special_diet').default('opt_in'),
        special_notes: Joi.string().trim().max(500).optional(),
    }),
};

const labSchemas = {
    book: Joi.object({
        slot_id: Joi.number().integer().required(),
        system_no: Joi.number().integer().min(1).required(),
    }),

    createSlot: Joi.object({
        venue: Joi.string().trim().max(100).required(),
        from_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
        to_time: Joi.string().pattern(/^\d{2}:\d{2}(:\d{2})?$/).required(),
        slot_date: Joi.date().iso().required(),
        total_systems: Joi.number().integer().min(1).required(),
    }),
};

const bulkSchemas = {
    students: Joi.object({
        students: Joi.array().items(Joi.object({
            name: Joi.string().trim().min(2).max(100).required(),
            email: Joi.string().email().lowercase().trim().required(),
            student_id: Joi.string().trim().max(20).required(),
            contact: Joi.string().trim().max(15).required(),
            department: Joi.string().trim().max(50).optional(),
            year: Joi.string().trim().max(20).optional(),
            hostel_code: Joi.string().trim().max(20).optional(),
            room_number: Joi.string().trim().max(20).optional(),
            warden_id: Joi.string().trim().max(20).optional(),
        })).min(1).max(500).required(),
    }),

    wardens: Joi.object({
        wardens: Joi.array().items(Joi.object({
            name: Joi.string().trim().min(2).max(100).required(),
            email: Joi.string().email().lowercase().trim().required(),
            warden_id: Joi.string().trim().max(20).required(),
            contact: Joi.string().trim().max(15).optional(),
            department: Joi.string().trim().max(50).optional(),
            hostel_code: Joi.string().trim().max(20).optional(),
            floor: Joi.string().trim().max(10).optional(),
        })).min(1).max(500).required(),
    }),
};

const idParamSchema = Joi.object({
    id: Joi.number().integer().positive().required(),
});

const studentIdParamSchema = Joi.object({
    studentId: Joi.string().trim().max(20).required(),
});

module.exports = {
    validate,
    authSchemas,
    leaveSchemas,
    complaintSchemas,
    roomSchemas,
    mealSchemas,
    labSchemas,
    bulkSchemas,
    idParamSchema,
    studentIdParamSchema,
};
