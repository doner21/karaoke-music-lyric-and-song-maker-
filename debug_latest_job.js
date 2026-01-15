
import { getDB } from './server/db/index.js';
import fs from 'fs';

const db = getDB();

console.log('Waiting for DB init...');
setTimeout(() => {
    try {
        const job = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT 1').get();
        if (!job) {
            console.log('No jobs found.');
        } else {
            console.log('--- LATEST JOB ---');
            console.log(`ID: ${job.id}`);
            console.log(`State: ${job.state}`);
            console.log(`Duration: ${job.updated_at - job.created_at}ms`);
            console.log('--- PARAMS ---');
            console.log(job.params_json);
            console.log('--- ERROR ---');
            console.log(job.error_json);
            if (job.error_json) {
                fs.writeFileSync('latest_error.txt', job.error_json);
            }
            console.log('--- LOGS ---');
            console.log('Raw Logs Length:', job.logs_json ? job.logs_json.length : 0);
            if (job.logs_json) {
                fs.writeFileSync('latest_logs.txt', job.logs_json);
                try {
                    const logs = JSON.parse(job.logs_json);
                    logs.forEach(l => console.log(`[${l.level}] ${l.message}`));
                } catch (e) {
                    console.error('JSON Parse Error for Logs:', e);
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}, 1000);
