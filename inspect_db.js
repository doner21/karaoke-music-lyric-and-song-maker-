import { getDB } from './server/db/index.js';

const db = getDB();
const jobs = db.prepare("SELECT id, state, result_json FROM jobs WHERE id LIKE '%legacy%' OR result_json LIKE '%legacy%'").all();
console.log('Jobs matching "legacy":', JSON.stringify(jobs, null, 2));

const allJobs = db.prepare("SELECT id FROM jobs LIMIT 10").all();
console.log('Sample Job IDs:', allJobs.map(j => j.id));
