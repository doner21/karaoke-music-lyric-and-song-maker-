import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseLyrics } from '../utils/lyricsParser.js';
import dotenv from 'dotenv';

dotenv.config();

const GENIUS_API_URL = 'https://api.genius.com';

/**
 * Helper to slugify text for Genius URLs
 * "Queen Bohemian Rhapsody" -> "Queen-Bohemian-Rhapsody-Lyrics"
 */
function attemptSlugify(text) {
    return text
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .split(/\s+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join('-');
}

/**
 * Search for a song on Genius
 * @param {string} query - Artist and title
 * @returns {Promise<Array>} List of matches
 */
export async function searchSong(query) {
    if (!process.env.GENIUS_ACCESS_TOKEN) {
        throw new Error('GENIUS_ACCESS_TOKEN is missing');
    }

    try {
        const response = await axios.get(`${GENIUS_API_URL}/search`, {
            params: { q: query },
            headers: {
                Authorization: `Bearer ${process.env.GENIUS_ACCESS_TOKEN}`
            }
        });

        const hits = response.data?.response?.hits || [];

        return hits
            .filter(hit => hit.type === 'song')
            .map(hit => ({
                id: hit.result.id,
                title: hit.result.title,
                artist: hit.result.primary_artist.name,
                thumbnail: hit.result.song_art_image_thumbnail_url,
                url: hit.result.url
            }));

    } catch (error) {
        console.error('[GeniusService] Search API failed:', error.message);

        // Fallback: Try to guess the URL
        try {
            console.log('[GeniusService] Attempting fallback URL guess...');
            const slug = attemptSlugify(query);
            const candidates = [
                `https://genius.com/${slug}-lyrics`,
                `https://genius.com/${slug.toLowerCase()}-lyrics`
            ];

            for (const url of candidates) {
                try {
                    await axios.get(url, {
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                        timeout: 5000,
                        validateStatus: s => s === 200
                    });

                    console.log('[GeniusService] Fallback found:', url);
                    return [{
                        id: 'fallback_guess',
                        title: query,
                        artist: 'Genius Web (Fallback)',
                        thumbnail: 'https://assets.genius.com/images/default_cover_image.png',
                        url: url
                    }];
                } catch (e) {
                    // Continue
                }
            }
        } catch (fbError) {
            console.error('[GeniusService] Fallback failed:', fbError.message);
        }

        // Return empty array if both fail, don't throw to avoid crashing UI completely?
        // But original code threw. Let's return empty if fallback fails, so user sees "No results" instead of 500
        console.warn('[GeniusService] No results found (API + Fallback)');
        return [];
    }
}

/**
 * Scrape lyrics from a Genius song URL
 * @param {string} url - Genius song page URL
 * @returns {Promise<Object>} Lyrics data
 */
export async function getLyrics(url) {
    try {
        const { data: html } = await axios.get(url);
        const $ = cheerio.load(html);

        // Genius uses different containers sometimes. 
        // Modern pages usually have data-lyrics-container="true"
        let rawLyrics = '';

        const lyricsContainers = $('div[data-lyrics-container="true"]');

        if (lyricsContainers.length > 0) {
            lyricsContainers.each((i, el) => {
                // Replace <br> with newlines before getting text
                $(el).find('br').replaceWith('\n');
                rawLyrics += $(el).text() + '\n';
            });
        } else {
            // Fallback for older pages
            rawLyrics = $('.lyrics').text();
        }

        const cleanedLyrics = parseLyrics(rawLyrics);

        return {
            lyrics: cleanedLyrics,
            source: 'Genius',
            url
        };

    } catch (error) {
        console.error('[GeniusService] Scraping failed:', error.message);
        throw new Error('Failed to fetch lyrics from Genius');
    }
}
