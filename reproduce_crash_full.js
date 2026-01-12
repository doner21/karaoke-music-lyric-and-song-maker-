import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const SERVER_SCRIPT = 'server-proxy.js';
const PORT = 3002;

console.log(`[Test] Spawning ${SERVER_SCRIPT}...`);
const serverProcess = spawn('node', [SERVER_SCRIPT], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, PORT: PORT }
});

serverProcess.stdout.on('data', d => console.log(`[Server stdout] ${d.toString().trim()}`));
serverProcess.stderr.on('data', d => console.error(`[Server stderr] ${d.toString().trim()}`));

serverProcess.on('exit', (code) => {
    console.error(`[Test] Server exited unexpectedly with code ${code}`);
    process.exit(code === 0 ? 0 : 1);
});

// Wait for server to start
setTimeout(async () => {
    console.log('[Test] Server assumed ready. Starting requests...');

    // 1. Request Download for non-existent job
    try {
        console.log('[Test 1] Requesting bad job ID...');
        const res = await fetch(`http://localhost:${PORT}/split/download/bad-job-id/vocals`);
        console.log(`[Test 1] Status: ${res.status}`);
    } catch (e) {
        console.error('[Test 1] Failed', e.message);
    }

    // 2. We can't easily insert a job without accessing DB directly or running a full flow.
    // However, if the server crashed on Test 1, we'll know.

    // Check if server is still alive
    if (serverProcess.exitCode === null) {
        console.log('[Test] Server still alive. SUCCESS.');
        serverProcess.kill();
        process.exit(0);
    } else {
        console.error('[Test] Server is DEAD.');
        process.exit(1);
    }

}, 5000);
