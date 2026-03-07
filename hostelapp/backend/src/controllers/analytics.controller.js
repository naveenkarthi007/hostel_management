const pool = require('../config/db').promise;
const { cacheGet } = require('../config/redis');

// ── Dashboard Overview ──
exports.dashboard = async (req, res) => {
    try {
        const data = await cacheGet('analytics:dashboard', async () => {
            const [studentCount] = await pool.query('SELECT COUNT(*) as total FROM students WHERE is_active = TRUE');
            const [wardenCount] = await pool.query('SELECT COUNT(*) as total FROM wardens WHERE is_active = TRUE');
            const [hostelCount] = await pool.query('SELECT COUNT(*) as total FROM hostels WHERE is_active = TRUE');

            // Leave stats
            const [leaveStats] = await pool.query(
                `SELECT status, COUNT(*) as count FROM leave_requests
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY status`
            );

            // Complaint stats
            const [complaintStats] = await pool.query(
                `SELECT status, COUNT(*) as count FROM complaints
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY status`
            );

            const [complaintByType] = await pool.query(
                `SELECT complaint_type, COUNT(*) as count FROM complaints
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY complaint_type ORDER BY count DESC LIMIT 10`
            );

            const [complaintByPriority] = await pool.query(
                `SELECT priority, COUNT(*) as count FROM complaints
                 WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                 GROUP BY priority`
            );

            // Room occupancy
            const [occupancy] = await pool.query(
                `SELECT h.name as hostel, 
                        SUM(r.capacity) as total_capacity,
                        SUM(r.current_occupancy) as current_occupancy
                 FROM rooms r
                 JOIN hostels h ON r.hostel_id = h.id
                 WHERE h.is_active = TRUE
                 GROUP BY h.id`
            );

            // Meal stats for today
            const [mealStats] = await pool.query(
                `SELECT meal_type, request_type, COUNT(*) as count 
                 FROM meal_requests 
                 WHERE meal_date = CURDATE()
                 GROUP BY meal_type, request_type`
            );

            return {
                overview: {
                    totalStudents: studentCount[0].total,
                    totalWardens: wardenCount[0].total,
                    totalHostels: hostelCount[0].total,
                },
                leaves: {
                    last30Days: leaveStats,
                },
                complaints: {
                    last30Days: complaintStats,
                    byType: complaintByType,
                    byPriority: complaintByPriority,
                },
                occupancy,
                todayMeals: mealStats,
            };
        }, 300); // Cache for 5 minutes

        res.json(data);
    } catch (err) {
        console.error('Dashboard Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Leave Trends (Weekly/Monthly) ──
exports.leaveTrends = async (req, res) => {
    try {
        const { period = 'weekly' } = req.query;

        const groupBy = period === 'monthly'
            ? "DATE_FORMAT(created_at, '%Y-%m')"
            : "DATE_FORMAT(created_at, '%Y-%u')";

        const interval = period === 'monthly' ? '12 MONTH' : '12 WEEK';

        const [trends] = await pool.query(
            `SELECT ${groupBy} as period, 
                    leave_type, status, COUNT(*) as count
             FROM leave_requests
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
             GROUP BY period, leave_type, status
             ORDER BY period`
        );

        res.json(trends);
    } catch (err) {
        console.error('Leave Trends Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};

// ── Complaint Resolution Time ──
exports.complaintMetrics = async (req, res) => {
    try {
        const [avgResolution] = await pool.query(
            `SELECT 
                complaint_type,
                AVG(TIMESTAMPDIFF(HOUR, created_at, resolved_at)) as avg_hours,
                COUNT(*) as total,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) as resolved
             FROM complaints
             WHERE created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
             GROUP BY complaint_type`
        );

        const [unresolved] = await pool.query(
            `SELECT c.*, s.student_id as student_code, u.name as student_name,
                    TIMESTAMPDIFF(HOUR, c.created_at, NOW()) as hours_open
             FROM complaints c
             JOIN students s ON c.student_id = s.id
             JOIN users u ON s.user_id = u.id
             WHERE c.status NOT IN ('resolved', 'closed')
             AND c.created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)
             ORDER BY c.created_at ASC`
        );

        res.json({ resolutionMetrics: avgResolution, overdue: unresolved });
    } catch (err) {
        console.error('Complaint Metrics Error:', err);
        res.status(500).json({ message: 'Internal server error.' });
    }
};
