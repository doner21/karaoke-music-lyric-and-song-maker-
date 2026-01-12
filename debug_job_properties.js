
import { JobMgr } from './server/orchestrator/index.js';
import { getDB } from './server/db/index.js';
import crypto from 'crypto';

async function debugJobProperties() {
    console.log('[Debug] Inserting test song...');
    const db = getDB();
    const songId = 'debug-song-' + crypto.randomUUID();
    db.prepare("INSERT INTO songs (id, source_title_raw, artist_name, track_title, source_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(songId, 'Debug', 'Debug', 'Debug', 'local', Date.now(), Date.now());

    console.log('[Debug] Inserting test job...');
    const result = await JobMgr.submit({
        songId: songId,
        kind: 'debug-check',
        params: { test: 1 }
    });

    console.log('[Debug] Submitted. Result:', result);

    const job = JobMgr.getJob(result.jobId);
    console.log('[Debug] Retrieved Job Keys:', Object.keys(job));
    console.log('[Debug] Job ID Value:', job.id);
    console.log('[Debug] Job ID Type:', typeof job.id);

    if (job.id === undefined) {
        console.error('[Debug] FAIL: job.id is undefined!');
    } else {
        console.log('[Debug] PASS: job.id is defined.');
    }
}

debugJobProperties();
