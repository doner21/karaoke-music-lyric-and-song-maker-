
import axios from 'axios';

function slugify(text) {
    // Basic slugify for Genius
    // "Queen Bohemian Rhapsody" -> "Queen-bohemian-rhapsody-lyrics"
    return text
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, '') // Remove special chars
        .replace(/\s+/g, '-')         // Spaces to dashes
        // .toLowerCase() // Genius URLs often use Title Case or Mixed?
        // Let's try mixed first, or whatever the input is.
        + '-lyrics';
}

async function check(artist, title) {
    // Strategy 1: Title Case-ish
    // Strategy 2: Lowercase ?? 
    // Actually Genius URLs are usually "Artist-name-song-title-lyrics"
    // e.g. https://genius.com/Queen-bohemian-rhapsody-lyrics

    // Let's try to just dash-separate and capitalized first letter?
    // "Queen Bohemian Rhapsody" -> "Queen-Bohemian-Rhapsody-Lyrics" ??

    const parts = `${artist} ${title}`.split(' ');
    const slug = parts.map(p => p.replace(/[^a-zA-Z0-9]/g, '')).join('-');

    const candidates = [
        `https://genius.com/${slug}-lyrics`,
        `https://genius.com/${slug.toLowerCase()}-lyrics`,
        // capitalized first letter of each word
        `https://genius.com/${parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('-')}-Lyrics`
    ];

    console.log(`Checking candidates for ${artist} - ${title}:`);

    for (const url of candidates) {
        try {
            console.log(`Trying: ${url}`);
            const res = await axios.get(url, { validateStatus: s => s === 200 });
            console.log(`MATCH! ${url}`);
            return url;
        } catch (e) {
            // console.log(`Fail: ${url} (${e.response?.status || e.message})`);
        }
    }
    console.log('No match found.');
}

async function run() {
    await check('Queen', 'Bohemian Rhapsody');
    // await check('Adele', 'Hello');
    // await check('Kendrick Lamar', 'DNA');
}

run();
