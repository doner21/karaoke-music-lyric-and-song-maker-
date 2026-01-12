
import { JobMgr } from './server/orchestrator/index.js';
import { getDB } from './server/db/index.js';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

const TEST_JOB_ID = 'debug-job-' + crypto.randomUUID();
const TEST_FILE_PATH = path.resolve('debug_vocal.mp3');

async function testJobFlow() {
    console.log('[Debug] Starting Job Flow Test...');
    console.log(`[Debug] Job ID: ${TEST_JOB_ID}`);

    // 1. Create Dummy File
    await fs.writeFile(TEST_FILE_PATH, 'dummy audio content');

    try {
        const db = getDB();

        // Ensure dummy song exists (Correct Schema)
        try {
            db.prepare("INSERT INTO songs (id, source_title_raw, artist_name, source_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").run('debug-song', 'Debug Title', 'Debug Artist', 'local', Date.now(), Date.now());
            console.log('[Debug] Dummy song created.');
        } catch (e) {
            console.log('[Debug] Dummy song might exist:', e.message);
        }

        // 2. Submit Job Manually (to force ID)
        const stmt = db.prepare(`
            INSERT INTO jobs (id, song_id, kind, state, progress, created_at, updated_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(TEST_JOB_ID, 'debug-song', 'split', 'queued', 0, Date.now(), Date.now());
        console.log('[Debug] Job inserted manually.');

        // 3. Retrieve Initial State
        let job = JobMgr.getJob(TEST_JOB_ID);
        console.log(`[Debug] Initial State: ${job.state}`);

        // 4. Update to Done with Result (Simulate Queue.processSplit completion)
        const result = {
            files: {
                vocals: TEST_FILE_PATH,
                band: TEST_FILE_PATH
            }
        };
        console.log('[Debug] Completing job with result:', JSON.stringify(result));
        JobMgr.complete(TEST_JOB_ID, result);

        // 5. Retrieve Final State
        job = JobMgr.getJob(TEST_JOB_ID);
        console.log(`[Debug] Final State: ${job.state}`);
        console.log(`[Debug] Result stored:`, JSON.stringify(job.result));

        if (!job.result || !job.result.files) {
            console.error('FAIL: Result not persisted or retrieved correctly.');
        } else {
            console.log('PASS: Job result persisted and retrieved.');
        }

        // 6. Simulate Download Check Logic
        if (!job || !job.result || !job.result.files) {
            console.error('FAIL: Logic check matches 404 condition.');
        } else {
            console.log('PASS: Logic check avoids 404 condition.');

            // Check file path logic
            const filePath = job.result.files['vocals'];
            if (filePath && fs.existsSync(filePath)) {
                console.log('PASS: File path resolution works.');
            } else {
                console.error('FAIL: File path resolution failed.');
            }
        }

    } catch (e) {
        console.error('[Debug] Exception:', e);
    } finally {
        // Cleanup
        await fs.unlink(TEST_FILE_PATH).catch(() => { });
        process.exit(0);
    }
}

testJobFlow();
