import fs from 'fs';
import path from 'path';

async function testHardening() {
    console.log('--- STARTING VERIFICATION ---');

    // 0. Clean DB
    const dbPath = path.resolve(process.cwd(), 'karaoke.db');
    if (fs.existsSync(dbPath)) {
        console.log('Deleting existing DB for fresh verification...');
        try {
            fs.unlinkSync(dbPath);
        } catch (e) { console.warn("Could not delete DB:", e.message); }
    }

    // 1. Dynamic Imports (to ensure fresh DB init)
    const { initDB } = await import('./db/index.js');
    const { JobMgr } = await import('./orchestrator/index.js');
    const { SongRepo } = await import('./db/repo.js');
    const { UnifiedSearch } = await import('./library/search.js');

    initDB();

    // 2. Test Song Creation
    console.log('\n[TEST 1] Song Creation');
    let song = SongRepo.create({
        videoId: 'TEST_VID_' + Date.now(),
        sourceTitleRaw: 'Test Song',
        artistName: 'Tester',
        trackTitle: 'Hardening',
        canonicalDisplayName: 'Tester - Hardening'
    });
    console.log('Created Song:', song.id);

    // 3. Test Job Submission (Idempotency)
    console.log('\n[TEST 2] Job Idempotency');
    const params = { foo: 'bar' };

    const res1 = await JobMgr.submit({
        songId: song.id,
        kind: 'test_job',
        params,
        force: false
    });
    console.log('Result 1:', res1);

    const res2 = await JobMgr.submit({
        songId: song.id,
        kind: 'test_job',
        params,
        force: false
    });
    console.log('Result 2 (Should be existing):', res2);

    if (res1.jobId === res2.jobId && res2.existing) {
        console.log('PASS: Idempotency verified.');
    } else {
        console.error('FAIL: Idempotency check failed.');
    }

    // 4. Test Startup Recovery
    // console.log('\n[TEST 3] Startup Recovery');
    // // Manually set state to 'processing'
    // JobMgr.stmts.updateState.run({
    //     id: res1.jobId,
    //     state: 'processing',
    //     completed_at: null,
    //     error_json: null,
    //     result_json: null,
    //     params_json: null // preserve
    // });
    // console.log('Manipulated job state to processing.');

    // // Simulate Restart
    // console.log('Simulating restart (JobMgr.startPolling calls recoverStuckJobs)...');

    // // We can't easily re-instantiate singleton JobMgr without module reload, 
    // // but we can call recoverStuckJobs directly.
    // try {
    //     JobMgr.recoverStuckJobs();
    // } catch (e) {
    //     console.error('Recover Stuck Jobs Failed:', e);
    // }

    // const recoveredJob = JobMgr.getJob(res1.jobId);
    // console.log('Recovered Job State:', recoveredJob.state);

    // if (recoveredJob.state === 'queued') {
    //     console.log('PASS: Recovery verified.');
    // } else {
    //     console.error('FAIL: Job not recovered to queued.');
    // }

    // 5. Test Unified Search
    console.log('\n[TEST 4] Unified Search');
    // Search for our local song
    const searchRes = await UnifiedSearch.search('Hardening', 'mock_key');
    console.log('Search Items:', searchRes.items.length);
    const foundLocal = searchRes.items.find(i => i.isLocal && i.title === 'Test Song');

    if (foundLocal) {
        console.log('PASS: Local song found in unified search.');
    } else {
        console.error('FAIL: Local song not found.');
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
}

testHardening().catch(console.error);
