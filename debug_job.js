
import { JobMgr } from './server/orchestrator/index.js';
import { Queue } from './server/downloader/job-queue.js';
import { initDB } from './server/db/index.js';

async function run() {
    console.log('--- Debug Job Start ---');
    initDB();
    console.log('JobMgr Stmts:', Object.keys(JobMgr.stmts));

    console.log('JobMgr Stmts:', Object.keys(JobMgr.stmts));

    class DebugMockAdapter {
        async download(jobId, request, storage, onProgress) {
            console.log('[DebugMock] Downloading...');
            onProgress(50);
            return [{
                path: "mock_file.mp3",
                filename: "mock_file.mp3",
                type: "audio",
                format: "mp3"
            }];
        }
    }
    Queue.registerEngine('mock', new DebugMockAdapter());

    // Mock request
    const request = {
        video: { videoId: 'debug_vid', title: 'Start' },
        enginePreference: 'mock'
    };

    console.log('Submitting job...');
    const result = await Queue.submit(request);
    console.log('Job Submitted:', result);

    console.log('Processing Next Job...');
    await JobMgr.processNext('download');

    console.log('Processing Done.');

    // Check DB state
    const job = JobMgr.getJob(result); // result is ID? Queue.submit returns ID.
    console.log('Final Job State:', job);
}

run().catch(e => console.error('Script Error:', e));
