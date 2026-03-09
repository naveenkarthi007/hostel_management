const db = require('./src/config/db');
(async () => {
    const tables = ['meal_requests', 'room_change_requests', 'computerlab_slots', 'computer_bookings', 'leave_requests', 'complaints'];
    for (const t of tables) {
        const [fks] = await db.promise.query(
            `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME 
             FROM information_schema.KEY_COLUMN_USAGE 
             WHERE TABLE_NAME=? AND TABLE_SCHEMA='hostel_db' AND REFERENCED_TABLE_NAME IS NOT NULL`, [t]
        );
        if (fks.length > 0) {
            console.log(`\n=== ${t} FKs ===`);
            fks.forEach(f => console.log(`  ${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`));
        }
        const [cols] = await db.promise.query('DESCRIBE ' + t);
        console.log(`\n=== ${t} columns ===`);
        cols.forEach(c => console.log(`  ${c.Field} : ${c.Type}`));
    }
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
