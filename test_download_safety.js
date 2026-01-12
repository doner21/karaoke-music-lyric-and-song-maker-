import express from 'express';
import splitterRouter from './server/splitter/index.js';
import { Queue } from './server/splitter/queue.js';
import { JobMgr } from './server/orchestrator/index.js';
import fs from 'fs-extra';
import path from 'path';

// Mock DB and JobMgr
JobMgr.getJob = (jobId) => {
    if (jobId === 'test-job-missing-file') {
        return {
            id: 'test-job-missing-file', state: 'done',
            result: { files: { vocals: 'C:/fake/path/vocals.mp3' } }
        };
    }
    if (jobId === 'test-job-success') {
        return {
            id: 'test-job-success', state: 'done',
            result: { files: { vocals: path.resolve('test_vocal.mp3') } }
        };
    }
    return null;
};

// Create dummy file for success test
fs.writeFileSync('test_vocal.mp3', 'dummy audio content');

const app = express();
app.use('/split', splitterRouter);

const server = app.listen(3033, async () => {
    console.log('Test server running on 3033');

    // Test 1: Missing File (Should be 404, not crash)
    try {
        const res = await fetch('http://localhost:3033/split/download/test-job-missing-file/vocals');
        console.log(`[Test 1] Missing File Status: ${res.status}`);
        if (res.status === 404) console.log('PASS: Handled missing file gracefully');
        else console.error('FAIL: Expected 404');
    } catch (e) {
        console.error('FAIL: Crash or Network Error on Test 1', e);
    }

    // Test 2: Success File
    try {
        const res = await fetch('http://localhost:3033/split/download/test-job-success/vocals');
        console.log(`[Test 2] Success File Status: ${res.status}`);
        if (res.status === 200) console.log('PASS: Download succeeded');
        else {
            console.error('FAIL: Expected 200');
            const text = await res.text();
            console.error('Error Body:', text);
        }
    } catch (e) {
        console.error('FAIL: Crash or Network Error on Test 2', e);
    }

    server.close();
    fs.unlinkSync('test_vocal.mp3');
    process.exit(0);
});
