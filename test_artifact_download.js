/**
 * Verification: Artifact-Based Download
 * 
 * Tests that downloads work via stable artifactId, independent of job state.
 */
import { getDB } from './server/db/index.js';
import { SongRepo } from './server/db/repo.js';
import { spawn } from 'child_process';
import fs from 'fs-extra';
import crypto from 'crypto';
import path from 'path';

const TEST_SONG_ID = 'test-song-' + crypto.randomUUID();
const TEST_ARTIFACT_ID = crypto.randomUUID();
const TEST_FILE_PATH = path.resolve('test_artifact_file.mp3');
const PORT = 3004;

async function runTest() {
    console.log('[Test] Starting Artifact Download Verification...');

    // 1. Setup: Create test file and DB records
    await fs.writeFile(TEST_FILE_PATH, 'dummy audio content for artifact test');

    const db = getDB();

    // Create song
    db.prepare(`INSERT INTO songs (id, source_title_raw, artist_name, track_title, source_type, created_at, updated_at) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
        TEST_SONG_ID, 'Test Raw', 'Test Artist', 'Test Track', 'local', Date.now(), Date.now()
    );

    // Create artifact (directly via SQL to control ID)
    db.prepare(`INSERT INTO artifacts (id, song_id, kind, storage_ref, filename, mime_type, hash, params_hash, version_tag, artist_name, track_title, canonical_display_name, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        TEST_ARTIFACT_ID, TEST_SONG_ID, 'vocal_stem', TEST_FILE_PATH, 'Test Artist - Test Track (Vocal).mp3',
        'audio/mp3', 'hash', 'params', 'v1', 'Test Artist', 'Test Track', 'Test Artist - Test Track', Date.now()
    );

    console.log('[Test] DB Records created. Artifact ID:', TEST_ARTIFACT_ID);

    // 2. Start Server
    const server = spawn('node', ['server-proxy.js'], {
        cwd: process.cwd(),
        env: { ...process.env, PORT }
    });

    server.stdout.on('data', d => process.stdout.write(`[Server] ${d}`));
    server.stderr.on('data', d => process.stderr.write(`[Server ERR] ${d}`));

    await new Promise(r => setTimeout(r, 4000)); // Wait for boot

    // 3. Test: Download via /artifacts/:id/download
    console.log('[Test] Requesting download via artifact endpoint...');
    const res = await fetch(`http://localhost:${PORT}/artifacts/${TEST_ARTIFACT_ID}/download`);

    console.log('[Test] Status:', res.status);

    if (res.status === 200) {
        const disp = res.headers.get('content-disposition');
        console.log('[Test] Content-Disposition:', disp);

        if (disp && disp.includes('Test Artist - Test Track')) {
            console.log('[Test] ✅ PASS: Artifact download successful with correct filename.');
        } else {
            console.log('[Test] ⚠️ WARN: Download worked but filename may be incorrect.');
        }
    } else {
        console.log('[Test] ❌ FAIL: Download returned non-200:', await res.text());
    }

    // 4. Cleanup
    server.kill();
    await fs.unlink(TEST_FILE_PATH).catch(() => { });
    db.prepare('DELETE FROM artifacts WHERE id = ?').run(TEST_ARTIFACT_ID);
    db.prepare('DELETE FROM songs WHERE id = ?').run(TEST_SONG_ID);

    console.log('[Test] Cleanup complete.');
    process.exit(res.status === 200 ? 0 : 1);
}

runTest().catch(e => {
    console.error('[Test] Fatal:', e);
    process.exit(1);
});
