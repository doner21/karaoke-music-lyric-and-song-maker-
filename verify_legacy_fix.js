import { spawn } from 'child_process';

const SERVER_SCRIPT = 'server-proxy.js';
const PORT = 3002;

console.log(`[Verify] Spawning ${SERVER_SCRIPT}...`);
const serverProcess = spawn('node', [SERVER_SCRIPT], {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env, PORT: PORT }
});

serverProcess.stdout.on('data', d => console.log(`[Server] ${d.toString().trim()}`));
serverProcess.stderr.on('data', d => console.error(`[Server Err] ${d.toString().trim()}`));

setTimeout(async () => {
    console.log('[Verify] Testing legacy endpoint...');
    try {
        const res = await fetch(`http://localhost:${PORT}/split/download/legacy/vocals`);
        console.log(`[Verify] Status: ${res.status}`);
        const body = await res.json();
        console.log(`[Verify] Body:`, body);

        if (res.status === 410 && body.error && body.error.includes('expired')) {
            console.log('PASS: Correctly handled legacy job');
            serverProcess.kill();
            process.exit(0);
        } else {
            console.error('FAIL: Expected 410');
            serverProcess.kill();
            process.exit(1);
        }
    } catch (e) {
        console.error('FAIL: Network error', e);
        serverProcess.kill();
        process.exit(1);
    }
}, 3000);
