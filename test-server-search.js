const PORT = 3001;
const API_URL = `http://localhost:${PORT}`;

async function run() {
    console.log(`Testing Search against ${API_URL}...`);
    try {
        const res = await fetch(`${API_URL}/api/youtube/search?q=test`);

        if (!res.ok) {
            console.error('Search failed:', res.status, await res.text());
            return;
        }

        const data = await res.json();
        console.log('Search Status:', res.status);
        console.log('Info:', data._info); // Should be MOCK_DATA_NO_KEY
        console.log('Items:', data.items?.length);
        console.log('First Title:', data.items?.[0]?.title);

    } catch (e) {
        console.error('Script error:', e);
    }
}

run();
