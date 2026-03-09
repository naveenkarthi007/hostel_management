const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const db = require('../config/db');

(async () => {
    const pool = db.promise;

    // 1. All tables
    const [tables] = await pool.query(
        "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='hostel_db'"
    );
    for (const t of tables) {
        const [cols] = await pool.query('DESCRIBE ' + t.TABLE_NAME);
        console.log(`\n=== ${t.TABLE_NAME} ===`);
        cols.forEach(c => console.log(`  ${c.Field} : ${c.Type} ${c.Key ? '[' + c.Key + ']' : ''}`));
    }

    // 2. All FKs
    const [fks] = await pool.query(
        "SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='hostel_db' AND REFERENCED_TABLE_NAME IS NOT NULL"
    );
    console.log('\n=== ALL FOREIGN KEYS ===');
    fks.forEach(f => console.log(`  ${f.TABLE_NAME}.${f.COLUMN_NAME} -> ${f.REFERENCED_TABLE_NAME}.${f.REFERENCED_COLUMN_NAME}`));

    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
