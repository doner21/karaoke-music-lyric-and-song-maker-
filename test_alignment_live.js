
import http from 'http';

const VOCAL_PATH = String.raw`C:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box\downloads\6c171c0f-8b9d-4631-b04a-66ed133bba1f\separated\htdemucs\audio\vocals.mp3`;

const LYRICS = `Scented and tall, hesitating once more
And as I take on myself and the bitterness I felt
Realize that love flows wild`;

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

function get(path) {
    return new Promise((resolve, reject) => {
        http.get(`http://localhost:3001${path}`, res => {
            let buffer = '';
            res.on('data', d => buffer += d);
            res.on('end', () => resolve({ status: res.statusCode, data: buffer }));
        }).on('error', reject);
    });
}

async function run() {
    console.log("Submitting job...");
    const submitRes = await post('/align/submit', {
        vocalStemId: VOCAL_PATH,
        lyricsText: LYRICS,
        videoId: 'test_vid'
    });

    console.log("Submit Status:", submitRes.status);
    console.log("Submit Data:", submitRes.data);

    if (submitRes.status !== 202) {
        return;
    }

    const { jobId } = JSON.parse(submitRes.data);
    console.log("Job ID:", jobId);

    while (true) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await get(`/align/status/${jobId}`);
        const status = JSON.parse(statusRes.data);
        process.stdout.write(`State: ${status.state} ${(status.progress * 100).toFixed(1)}% \r`);

        if (status.state === 'done') {
            console.log("\nDone!");
            const resultRes = await get(`/align/result/${jobId}`);
            console.log("Result Preview:", resultRes.data.substring(0, 500));
            break;
        }
        if (status.providerTaskId) {
            // Log task id occasionally
        }
        if (status.state === 'error') {
            console.log("\nError:", status.error);
            console.log("Logs:", JSON.stringify(status.logs, null, 2));
            break;
        }
    }
}

run();
