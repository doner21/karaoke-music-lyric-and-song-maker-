
import dotenv from 'dotenv';
import { searchSong } from './server/services/genius.js';

dotenv.config();

async function run() {
    // Tests the fallback since API is 500ing
    const query = 'Queen Bohemian Rhapsody';
    console.log(`Testing searchSong with: "${query}"`);

    try {
        const matches = await searchSong(query);
        console.log(`Found ${matches.length} matches`);
        matches.forEach(m => {
            console.log(`- [${m.id}] ${m.title} by ${m.artist} (${m.url})`);
        });
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

run();
