
import http from 'http';

function post(path, body) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(body);
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };
        const req = http.request(options, res => {
            let buffer = '';
            res.on('data', d => buffer += d);
            res.on('end', () => resolve({ status: res.statusCode, data: buffer }));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function run() {
    console.log("Submitting download job for verification...");
    // Use a small video: 'dQw4w9WgXcQ' (Rick Roll) or something small.
    // Let's use a very short sound effect to be fast.
    const TEST_VIDEO_ID = 'tPEE9ZwTmy0'; // "Shortest Video on Youtube" 

    // 1. Submit Download
    const res = await post('/api/v1/audio/acquire', {
        selectedSong: { videoId: TEST_VIDEO_ID, title: 'Verification Test' },
        enginePreference: 'mock'
    });

    console.log("Submit Response:", res.data);
    const { jobId } = JSON.parse(res.data);

    if (!jobId) {
        console.error("No Job ID returned!");
        return;
    }

    // 2. Poll Status
    console.log(`Polling Job ${jobId}...`);
    while (true) {
        await new Promise(r => setTimeout(r, 1000));
        // Use legacy status endpoint which maps to JobMgr via getJob in Queue?
        // server/downloader/index.js: router.get('/status/:jobId', (req, res) => { const job = Queue.getJob(req.params.jobId); ... })
        // Queue.getJob -> JobMgr.getJob -> DB

        const sRes = await new Promise((resolve) => {
            http.get(`http://localhost:3001/api/v1/audio/status/${jobId}`, res => {
                let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
            });
        });

        const status = JSON.parse(sRes);
        console.log(`State: ${status.state} ${(status.progress * 100).toFixed(1)}%`);

        if (status.state === 'done') {
            console.log("Job Done!");
            console.log("Result:", JSON.stringify(status.result, null, 2));
            break;
        }
        if (status.state === 'error') {
            console.error("Job Failed:", status.error);
            break;
        }
    }
}

// Wait for server to be ready
setTimeout(run, 3000);
