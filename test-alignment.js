
const API_URL = 'http://localhost:3001';

async function run() {
    console.log('1. Listing songs...');
    const songsRes = await fetch(`${API_URL}/api/library/songs`);
    const songs = await songsRes.json();
    console.log(`   Found ${songs.items?.length || 0} songs`);

    if (!songs.items || songs.items.length === 0) {
        console.log('No songs found. Please download a song first.');
        return;
    }

    const song = songs.items[0];
    console.log(`2. Using song: ${song.id} - ${song.canonical_display_name}`);

    // Get artifacts
    const artRes = await fetch(`${API_URL}/api/library/songs/${song.id}/artifacts`);
    const arts = await artRes.json();
    console.log(`   Artifacts: ${arts.length}`);

    const vocalStem = arts.find(a => a.kind === 'vocal_stem');
    if (!vocalStem) {
        console.log('No vocal stem found. Please run split first.');
        return;
    }
    console.log(`3. Vocal stem path: ${vocalStem.storage_ref}`);

    // Submit alignment
    console.log('4. Submitting alignment job...');
    const submitRes = await fetch(`${API_URL}/align/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            vocalStemId: vocalStem.storage_ref, // Use path directly
            lyricsText: 'Test lyrics for alignment',
            provider: 'audioshake',
            videoId: song.video_id
        })
    });

    console.log(`   Status: ${submitRes.status}`);
    const submitData = await submitRes.json();
    console.log(`   Response:`, submitData);

    if (!submitRes.ok) {
        console.log('Alignment submission failed!');
        return;
    }

    const jobId = submitData.jobId;
    console.log(`5. Job ID: ${jobId}`);

    // Poll status
    for (let i = 0; i < 10; i++) {
        await new Promise(r => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_URL}/align/status/${jobId}`);
        const status = await statusRes.json();
        console.log(`   [${i * 2}s] State: ${status.state} | Progress: ${status.progress}`);

        if (status.state === 'done' || status.state === 'error') {
            console.log('Final status:', JSON.stringify(status, null, 2));
            break;
        }
    }
}

run().catch(console.error);
