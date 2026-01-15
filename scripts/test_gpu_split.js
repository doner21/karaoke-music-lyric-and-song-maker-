
import { DemucsAdapter } from '../server/splitter/demucs-adapter.js';
import path from 'path';

async function test() {
    console.log('--- TESTING GPU SPLIT MANUALLY ---');

    // 1. Setup
    const adapter = new DemucsAdapter();
    const inputPath = path.resolve('downloads/2a847880-d412-48b2-bcbf-e8e562f1ce9c/audio.mp3');
    const jobId = 'test_gpu_manual_' + Date.now();

    console.log('Input:', inputPath);
    console.log('Job:', jobId);

    // 2. Run with device='gpu'
    try {
        console.log('Invoking adapter.separate with device="gpu"...');
        await adapter.separate(jobId, inputPath, {
            modelId: 'htdemucs',
            stems: 2,
            device: 'gpu'
        }, (p, msg) => {
            console.log(`[Progress] ${(p * 100).toFixed(1)}% - ${msg}`);
        });
        console.log('SUCCESS: Split completed.');
    } catch (e) {
        console.error('FAILED:', e);
    }
}

test();
