
const API_URL = 'http://localhost:3001';
const INPUT_PATH = String.raw`C:\Users\donald clark\.gemini\antigravity\scratch\karaoke-box\downloads\57889235-dcb2-4fb7-b2b7-7c9220eb4b0a\audio.mp3`;

async function run() {
    console.log('1. Starting Split Job via API...');

    // We need a valid songId. Since we wiped DB, the song from the file path might not exist in DB?
    // ACTUALLY, if we wiped DB, the song is GONE.
    // So "foreign key constraint" failure IS EXPECTED if we don't re-create the song.
    // But now with try/catch, it should return 500 error instead of crashing.
    // Let's verify THAT first.

    try {
        const res = await fetch(`${API_URL}/split/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source: { inputPath: INPUT_PATH, songId: 'invalid-id' },
                modelId: 'htdemucs',
                stems: 2
            })
        });

        console.log('Status:', res.status);
        const json = await res.json();
        console.log('Response:', json);

        if (res.status === 500) {
            console.log('SUCCESS: Server caught the error and did NOT crash.');
        } else if (res.ok) {
            console.log('SURPRISE: It worked? Maybe FK is not enforced or ID existed?');
        } else {
            console.log('FAILED: Unexpected status');
        }

    } catch (e) {
        console.error('Fetch Failed:', e);
    }
}

run();
