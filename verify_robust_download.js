
import { JobMgr } from './server/orchestrator/index.js';
import { getDB } from './server/db/index.js';
import { SongRepo } from './server/db/repo.js';
import path from 'path';
import fs from 'fs-extra';
import crypto from 'crypto';

const TEST_JOB_ID_2 = 'debug-job-v2-' + crypto.randomUUID();
const TEST_SONG_ID_2 = 'debug-song-v2-' + crypto.randomUUID();
const TEST_FILE_PATH = path.resolve('debug_vocal_v2.mp3');

async function testPersistentDownload() {
    console.log('[Verify] Starting Persistent Download Test...');

    // 1. Setup Data
    await fs.writeFile(TEST_FILE_PATH, 'dummy audio v2');
    const db = getDB();

    // Manual Song Creation (to ensure ID control)
    // Override ID because create generates random one in Repo but we want controlled ID for test?
    // Repo.create returns the object with the ID. Let's rely on that or force update.
    // Actually Repo.create generates ID. Let's just update the ID of the song we just made or use SQL directly to ensure ID match.
    // Simpler: Just use SQL for total control.
    db.prepare("DELETE FROM songs WHERE id = ?").run(TEST_SONG_ID_2);
    db.prepare("INSERT INTO songs (id, source_title_raw, artist_name, track_title, source_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(TEST_SONG_ID_2, 'Debug Title V2', 'Debug Artist V2', 'Debug Song V2', 'local', Date.now(), Date.now());

    // Create Job
    db.prepare("INSERT INTO jobs (id, song_id, kind, state, progress, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(TEST_JOB_ID_2, TEST_SONG_ID_2, 'split', 'done', 1, Date.now(), Date.now());

    // Create Artifact (Simulate SplitterQueue logic)
    SongRepo.addArtifact({
        song_id: TEST_SONG_ID_2,
        kind: 'vocal_stem',
        storage_ref: TEST_FILE_PATH,
        filename: 'vocals.mp3',
        mime_type: 'audio/mp3',
        artist_name: 'Debug Artist V2',
        track_title: 'Debug Song V2',
        canonical_display_name: 'Debug Artist V2 - Debug Song V2',
        hash: 'dummy-hash',
        params_hash: 'dummy-params-hash',
        version_tag: 'test'
    });

    console.log('[Verify] Data seeded. Artifact created.');

    // 2. Simulate Download Request (Calling internal logic or spawning server)
    // Spawning server is better to test actual endpoint logic including SongRepo lookup inside Express.
    // But we can also look at DB state to ensure artifact is there.

    const artifacts = SongRepo.getArtifacts(TEST_SONG_ID_2);
    if (artifacts.length === 0) {
        console.error('FAIL: No artifacts found in DB.');
        process.exit(1);
    }
    console.log('[Verify] Artifacts in DB:', artifacts.map(a => a.kind));

    // 3. Spawn Server & Request
    const { spawn } = await import('child_process');
    const SERVER_SCRIPT = 'server-proxy.js';
    const PORT = 3003;

    try {
        const serverProcess = spawn('node', [SERVER_SCRIPT], {
            cwd: process.cwd(),
            env: { ...process.env, PORT: PORT }
        });

        // specific string we expect in filename: "Debug Artist V2 - Debug Song V2 (Vocals).mp3"
        const expectedFilename = "Debug Artist V2 - Debug Song V2 (Vocals).mp3";

        // Reset log file
        fs.writeFileSync('server_debug.log', '');

        serverProcess.stdout.on('data', d => {
            process.stdout.write(d); // Keep console output
            fs.appendFileSync('server_debug.log', `[STDOUT] ${d}`);
        });
        serverProcess.stderr.on('data', d => {
            process.stderr.write(d); // Keep console output
            fs.appendFileSync('server_debug.log', `[STDERR] ${d}`);
        });

        // Wait for boot
        await new Promise(r => setTimeout(r, 4000));

        console.log('[Verify] Requesting download...');
        const res = await fetch(`http://localhost:${PORT}/split/download/${TEST_JOB_ID_2}/vocals`);

        console.log(`[Verify] Status: ${res.status}`);
        if (res.status !== 200) {
            console.error('FAIL: Download failed status', await res.text());
            serverProcess.kill();
            process.exit(1);
        }

        const disp = res.headers.get('content-disposition');
        console.log(`[Verify] Content-Disposition: ${disp}`);

        if (disp && disp.includes(expectedFilename)) {
            console.log('PASS: Correct filename in Content-Disposition.');
        } else {
            console.error(`FAIL: Expected filename '${expectedFilename}' not found in '${disp}'`);
            serverProcess.kill();
            process.exit(1);
        }

        serverProcess.kill();
        process.exit(0);

    } catch (e) {
        console.error('[Verify] Exception:', e);
        process.exit(1);
    } finally {
        await fs.unlink(TEST_FILE_PATH).catch(() => { });
    }
}

testPersistentDownload();
