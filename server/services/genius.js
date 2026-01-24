import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseLyrics } from '../utils/lyricsParser.js';
import dotenv from 'dotenv';

dotenv.config();

const GENIUS_API_URL = 'https://api.genius.com';

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
        console.error('[GeniusService] Search failed:', error.message);
        throw error;
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
