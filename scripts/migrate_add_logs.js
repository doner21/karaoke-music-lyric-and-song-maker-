
import { getDB } from '../server/db/index.js';

const db = getDB();

console.log('Running migration: ADD logs_json to jobs');

try {
    // Check if column exists
    const tableInfo = db.prepare('PRAGMA table_info(jobs)').all();
    const hasLogs = tableInfo.some(col => col.name === 'logs_json');

    if (hasLogs) {
        console.log('Column logs_json already exists. Skipping.');
    } else {
        db.prepare('ALTER TABLE jobs ADD COLUMN logs_json TEXT').run();
        console.log('Successfully added logs_json column.');
    }
} catch (e) {
    console.error('Migration failed:', e);
}
