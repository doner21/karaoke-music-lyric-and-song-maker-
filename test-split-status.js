
const API_URL = 'http://localhost:3001';

async function run() {
    // First, get a list of jobs from the DB
    const res = await fetch(`${API_URL}/api/library/songs`);
    const songs = await res.json();
    console.log('Songs in DB:', songs.items?.length);

    if (songs.items?.length > 0) {
        const song = songs.items[0];
        console.log('First Song:', song.id, song.canonical_display_name);

        // Get jobs for this song
        const jobsRes = await fetch(`${API_URL}/api/library/songs/${song.id}/jobs`);
        const jobs = await jobsRes.json();
        console.log('Jobs:', jobs);

        // Find a split job
        const splitJob = jobs.find(j => j.kind === 'split');
        if (splitJob) {
            console.log('Split Job ID:', splitJob.id);
            console.log('Split Job State:', splitJob.state);
            console.log('Split Job Result:', splitJob.result);

            // Now test the /split/status endpoint
            const statusRes = await fetch(`${API_URL}/split/status/${splitJob.id}`);
            const status = await statusRes.json();
            console.log('Status API Response:', JSON.stringify(status, null, 2));
        } else {
            console.log('No split jobs found');
        }
    }
}

run().catch(console.error);
