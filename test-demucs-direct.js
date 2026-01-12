
import { DemucsAdapter } from './server/splitter/demucs-adapter.js';
import path from 'path';

// Use a known existing file from previous step
const INPUT_FILE = String.raw`C:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box\downloads\57889235-dcb2-4fb7-b2b7-7c9220eb4b0a\audio.mp3`;
const JOB_ID = 'test-split-job-1';

async function run() {
    console.log('Testing Demucs Adapter directly...');
    const adapter = new DemucsAdapter();

    // Check Health
    const health = await adapter.checkHealth();
    console.log('Health:', health);

    if (!health.available) return;

    // Run Separation
    try {
        console.log('Starting separation...');
        const result = await adapter.separate(JOB_ID, INPUT_FILE, {
            modelId: 'htdemucs',
            stems: 2
        }, (p, msg) => {
            console.log(`[Progress] ${Math.round(p * 100)}% - ${msg || ''}`);
        });
        console.log('Success:', result);
    } catch (e) {
        console.error('Failure:', e);
    }
}

run();
