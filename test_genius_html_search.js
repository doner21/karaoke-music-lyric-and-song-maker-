
import axios from 'axios';
import * as cheerio from 'cheerio';

async function run() {
    const query = 'Queen Bohemian Rhapsody';
    const url = `https://genius.com/search?q=${encodeURIComponent(query)}`;
    console.log(`Scraping: ${url}`);

    try {
        const { data: html } = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        const $ = cheerio.load(html);
        console.log('Page Title:', $('title').text());

        // Try to find results
        // Genius search page is React-heavy, might be empty in initial HTML
        // But let's check for any list items or JSON data in script tags.

        const scripts = $('script');
        let foundData = false;
        scripts.each((i, s) => {
            const txt = $(s).html();
            if (txt && txt.includes('__PRELOADED_STATE__')) {
                console.log('Found __PRELOADED_STATE__');
                // Could parse this JSON...
                foundData = true;
            }
        });

        // Or look for search results in DOM
        // Common class for result items?
        const items = $('search-result-item');
        console.log('search-result-item count:', items.length);

        const cards = $('div[class*="mini_card"]');
        console.log('mini_card count:', cards.length);

    } catch (e) {
        console.error('Failed:', e.message);
    }
}

run();
