
const API_URL = 'http://localhost:3001';

async function run() {
    console.log('1. Submitting Download Job...');

    // Song to download (short one to save time)
    const videoId = 'jNQXAC9IVRw'; // Me at the zoo (short)
    const title = 'Me at the zoo';
    const thumbnailUrl = 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg';

    try {
        const res = await fetch(`${API_URL}/api/v1/audio/acquire`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                selectedSong: { videoId, title, thumbnailUrl },
                enginePreference: 'yt-dlp', // Force yt-dlp
                options: {}
            })
        });

        if (!res.ok) {
            console.error('Submit Failed:', res.status, await res.text());
            return;
        }

        const { jobId } = await res.json();
        console.log(`Job Submitted: ${jobId}`);

        // Poll
        let attempts = 0;
        while (attempts < 60) { // 60 seconds max
            await new Promise(r => setTimeout(r, 1000));
            const statusRes = await fetch(`${API_URL}/api/v1/audio/status/${jobId}`);
            const status = await statusRes.json();

            console.log(`[${attempts}s] Job State: ${status.state} | Progress: ${Math.round(status.progress * 100)}%`);

            if (status.state === 'done') {
                console.log('SUCCESS: Job Done');
                console.log('Result:', JSON.stringify(status.result, null, 2));
                break;
            }
            if (status.state === 'error' || status.state === 'canceled') {
                console.error('FAILURE: Job Ended', status);
                break;
            }
            attempts++;
        }

    } catch (e) {
        console.error('Test Failed:', e);
    }
}

run();
