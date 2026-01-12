const API_URL = 'http://localhost:3001';
const TEST_FILE = 'c:\\Users\\donald clark\\.gemini\\antigravity\\scratch\\karaoke-box\\test.mp3';

async function run() {
    console.log('Submitting alignment job...');
    try {
        const res = await fetch(`${API_URL}/align/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                vocalStemId: TEST_FILE,
                lyricsText: 'Test lyrics',
                provider: 'audioshake',
                videoId: 'test-video'
            })
        });

        if (!res.ok) {
            console.error('Submit failed:', res.status, await res.text());
            return;
        }

        const { jobId } = await res.json();
        console.log('Job submitted:', jobId);

        // Poll
        while (true) {
            const statusRes = await fetch(`${API_URL}/align/status/${jobId}`);
            const status = await statusRes.json();
            console.log('Status:', status.state, status.error ? JSON.stringify(status.error) : '');

            if (status.state === 'done' || status.state === 'error') break;

            await new Promise(r => setTimeout(r, 2000));
        }
    } catch (e) {
        console.error('Script error:', e);
    }
}

run();
