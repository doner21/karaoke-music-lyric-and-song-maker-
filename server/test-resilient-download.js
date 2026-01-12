// import fetch from 'node-fetch'; // Built-in in Node 18+
import crypto from 'crypto';
import fs from 'fs-extra';
import path from 'path';

const API_URL = 'http://127.0.0.1:3001';
const MOCK_VIDEO_ID = 'TEST_VID_' + crypto.randomUUID().slice(0, 8);
const MOCK_FILE_CONTENT = 'FAKE AUDIO CONTENT';

async function run() {
    console.log('--- TEST V1: Resilient Artifact Downloads ---');

    console.log(`1. Creating Mock Song and Artifact manually in DB for Video ${MOCK_VIDEO_ID}`);
    // We can't easily inject SQL from here without the DB instance.
    // Instead, we will simulate the flow:
    // a) Acquire (creates Song)
    // b) Split (creates Artifacts)
    // c) Wait (simulate expiry)
    // d) Download via Artifact URL

    // TRIGGER ACQUIRE (To get a Song ID)
    console.log('-> Triggering Acquire...');
    const acqRes = await fetch(`${API_URL}/audio/acquire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId: MOCK_VIDEO_ID, title: 'Resilience Test Song' })
    });
    const acqData = await acqRes.json();
    console.log('   Job ID:', acqData.jobId);

    // POLL ACQUIRE
    let songId = null;
    let assetId = null;
    while (!songId) {
        await new Promise(r => setTimeout(r, 200));
        const s = await (await fetch(`${API_URL}/audio/status/${acqData.jobId}`)).json();
        if (s.state === 'done') {
            assetId = s.result.assetId;
            // The acquire job result currently doesn't return songId directly in the mock, 
            // but we can infer or use another endpoint.
            // Actually, server-proxy.js 'acquire' creates an AudioAsset but maybe not a Song row yet?
            // Wait, server-proxy.js doesn't touch SongRepo in 'acquire'. 
            // It touches AudioAssets map.
            // The SPLITTER creates the song row? 
            // Let's look at splitter/index.js -> start -> SongRepo.getByVideoId

            // Actually, we might need to rely on the fact that existing logic handles this.
            // If SongRepo doesn't have it, Splitter inserts it?
            // "if (!finalSongId && req.body.videoId) { const song = SongRepo.getByVideoId... }"
            // If not found, it warns.
            // This suggests we might need to create the song first.
            break;
        }
    }
    console.log('   Acquire Done. Asset:', assetId);

    // TRIGGER SPLIT (This should create the Artifacts)
    console.log('-> Triggering Split...');
    const splitRes = await fetch(`${API_URL}/split/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: { inputPath: 'C:\\Users\\donald clark\\.gemini\\antigravity\\scratch\\karaoke-box\\test_valid.mp3' }, videoId: MOCK_VIDEO_ID, modelId: 'htdemucs', stems: 2 })
    });
    const splitData = await splitRes.json();
    console.log('   Split Response:', splitData);
    const splitJobId = splitData.jobId;
    console.log('   Split Job:', splitJobId);

    // POLL SPLIT
    let artifacts = [];
    while (true) {
        await new Promise(r => setTimeout(r, 200));
        const s = await (await fetch(`${API_URL}/split/status/${splitJobId}`)).json();
        if (s.state === 'done') {
            console.log('   Split Done. Result:', s.result);
            break;
        }
        if (s.state === 'error' || s.state === 'canceled') {
            console.error('FAIL: Split Job failed:', s);
            process.exit(1);
        }
    }

    // CHECK FOR ARTIFACTS VIA VIDEO ID (The new robust endpoint)
    console.log('-> Checking for Artifacts via VideoId...');
    const checkRes = await fetch(`${API_URL}/artifacts/check?videoId=${MOCK_VIDEO_ID}`);
    const checkData = await checkRes.json();
    console.log(`   Found ${checkData.length} artifacts.`);

    if (checkData.length === 0) {
        console.error('FAIL: No artifacts found after split.');
        process.exit(1);
    }

    const downloadUrl = checkData[0].downloadUrl;
    console.log('   Target Download URL:', downloadUrl);

    // SIMULATE EXPIRY / RESTART
    // We can't restart the server from here easily, but we can verify the URL is NOT job-dependent.
    // The URL is like `/artifacts/:id/download`.
    if (downloadUrl.includes('/split/download/')) {
        console.error('FAIL: URL is still using legacy split job path!');
        process.exit(1);
    }
    console.log('SUCCSSS: URL is artifact-based.');

    // DOWNLOAD
    console.log('-> Attempting Download...');
    const dlRes = await fetch(`${API_URL}${downloadUrl}`);
    if (dlRes.ok) {
        console.log('   Download OK:', dlRes.headers.get('content-type'));
    } else {
        console.error('FAIL: Download returned', dlRes.status, dlRes.statusText);
        const errJson = await dlRes.json();
        console.error('Error:', errJson);
    }
}

run().catch(console.error);
