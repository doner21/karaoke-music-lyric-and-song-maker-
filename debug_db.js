
import { initDB } from './server/db/index.js';

const db = initDB();
const info = db.pragma('table_info(jobs)');
console.log('Table Info for jobs:', JSON.stringify(info, null, 2));

const createStmt = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs'`).get();
console.log('Create SQL:', createStmt.sql);
