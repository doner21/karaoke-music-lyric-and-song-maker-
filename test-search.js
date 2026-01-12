import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.YOUTUBE_API_KEY;

if (!API_KEY) {
    console.error('No API KEY found in .env');
    process.exit(1);
}

console.log('Testing YouTube Search with key prefix:', API_KEY.substring(0, 5) + '...');

async function testSearch() {
    try {
        const q = 'karaoke';
        const url = new URL('https://www.googleapis.com/youtube/v3/search');
        url.searchParams.append('part', 'snippet');
        url.searchParams.append('maxResults', '5');
        url.searchParams.append('q', q);
        url.searchParams.append('type', 'video');
        url.searchParams.append('key', API_KEY);

        console.log('Fetching:', url.toString().replace(API_KEY, 'API_KEY'));

        const response = await fetch(url.toString());

        if (!response.ok) {
            console.error('Response status:', response.status);
            console.error('Response text:', await response.text());
            throw new Error(`API ${response.status}`);
        }

        const data = await response.json();
        console.log('Success! Found items:', data.items?.length);
        console.log('First item:', data.items?.[0]?.snippet?.title);

    } catch (e) {
        console.error('Fetch failed:', e);
        if (e.cause) console.error('Cause:', e.cause);
    }
}

testSearch();
