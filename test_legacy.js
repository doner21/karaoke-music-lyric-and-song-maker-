
import helper from './test_download_safety.js'; // Just to ensure deps are there

async function testLegacy() {
    console.log('[Test] Checking legacy job handling...');
    try {
        const res = await fetch('http://localhost:3002/split/download/legacy/vocals');
        console.log(`[Test] Status: ${res.status}`);
        const body = await res.json();
        console.log(`[Test] Body:`, body);

        if (res.status === 410 && body.error.includes('expired')) {
            console.log('PASS: Correctly handled legacy job');
        } else {
            console.error('FAIL: Did not get 410 for legacy job');
            process.exit(1);
        }
    } catch (e) {
        console.error('FAIL: Network error', e);
        process.exit(1);
    }
}

// Reuse the verify script structure but simplified
// We assume the server is running via verify_crash_full.js or we can just hit it if running
// Actually, let's just make this a simple script that hits the port 3002 (from reproduce script)
testLegacy();
