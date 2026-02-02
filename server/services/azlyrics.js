/**
 * AZLyrics Scraper Service
 * Secondary backup lyrics source for Karaoke-Box
 *
 * Note: AZLyrics has no official API - this uses web scraping
 * Be respectful of rate limits and add delays between requests
 */

const axios = require('axios');
const cheerio = require('cheerio');
const { parseLyrics } = require('../utils/lyricsParser');

const BASE_URL = 'https://www.azlyrics.com';

// Rotating user agents to avoid detection
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
];

/**
 * Normalize text for AZLyrics URL format
 * - Lowercase
 * - Remove leading "The "
 * - Remove all non-alphanumeric characters
 * @param {string} text
 * @returns {string}
 */
function normalizeForUrl(text) {
  return text
    .toLowerCase()
    .replace(/^the\s+/i, '')  // Remove leading "The"
    .replace(/[^a-z0-9]/g, ''); // Keep only alphanumeric
}

/**
 * Add random delay to appear more human-like
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 */
async function randomDelay(minMs = 1000, maxMs = 3000) {
  const delay = minMs + Math.random() * (maxMs - minMs);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Get a random user agent
 * @returns {string}
 */
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Construct AZLyrics URL from artist and title
 * @param {string} artist
 * @param {string} title
 * @returns {string}
 */
function constructUrl(artist, title) {
  const normalizedArtist = normalizeForUrl(artist);
  const normalizedTitle = normalizeForUrl(title);
  return `${BASE_URL}/lyrics/${normalizedArtist}/${normalizedTitle}.html`;
}

/**
 * Scrape lyrics from AZLyrics
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {object} options - Scraping options
 * @returns {Promise<{lyrics: string, url: string, source: string}>}
 */
async function scrapeLyrics(artist, title, options = {}) {
  const { skipDelay = false, retryCount = 0 } = options;

  const url = constructUrl(artist, title);

  // Add delay unless explicitly skipped (for testing)
  if (!skipDelay) {
    await randomDelay(2000, 5000);
  }

  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/',
        'Cache-Control': 'max-age=0'
      },
      timeout: 15000,
      // Handle redirects
      maxRedirects: 5
    });

    const $ = cheerio.load(response.data);

    // AZLyrics stores lyrics in a specific div structure:
    // The lyrics div has no class/id, comes after .ringtone div
    // and before the comment section

    // Method 1: Find div after ringtone
    let lyricsDiv = $('div.ringtone').nextAll('div').first();
    let lyrics = lyricsDiv.text().trim();

    // Method 2: If method 1 fails, try alternate selector
    if (!lyrics || lyrics.length < 50) {
      // Look for the main content area and find unclassed div with substantial text
      const mainContent = $('div.col-xs-12.col-lg-8.text-center');
      mainContent.find('div').each((i, el) => {
        const $el = $(el);
        // Lyrics div has no class and contains substantial text
        if (!$el.attr('class') && $el.text().trim().length > 200) {
          const text = $el.text().trim();
          // Skip if it's clearly not lyrics (contains common non-lyric patterns)
          if (!text.includes('Album:') && !text.includes('Submit Corrections')) {
            lyrics = text;
            return false; // Break the loop
          }
        }
      });
    }

    // Method 3: Regex extraction as last resort
    if (!lyrics || lyrics.length < 50) {
      const htmlContent = response.data;
      // Lyrics are between specific comment markers
      const match = htmlContent.match(/<!-- Usage of azlyrics\.com content.*?-->([\s\S]*?)<!-- MxM banner/);
      if (match && match[1]) {
        const $fragment = cheerio.load(match[1]);
        lyrics = $fragment.text().trim();
      }
    }

    if (!lyrics || lyrics.length < 50) {
      throw new Error('Could not extract lyrics from page');
    }

    // Clean the lyrics
    const cleanedLyrics = parseLyrics(lyrics);

    // Extract additional metadata if available
    const songTitle = $('div.ringtone').prev('b').text().replace(/"/g, '').trim();
    const artistName = $('div.lyricsh h2 b').text().replace(' Lyrics', '').trim();

    return {
      lyrics: cleanedLyrics,
      url,
      source: 'AZLyrics',
      metadata: {
        extractedTitle: songTitle || title,
        extractedArtist: artistName || artist
      }
    };

  } catch (error) {
    // Handle specific error cases
    if (error.response?.status === 404) {
      throw new Error(`Song not found on AZLyrics: ${artist} - ${title}`);
    }

    if (error.response?.status === 403) {
      // Possible bot detection - retry with different user agent
      if (retryCount < 2) {
        console.log(`AZLyrics 403 error, retrying (attempt ${retryCount + 1})...`);
        await randomDelay(5000, 10000); // Longer delay before retry
        return scrapeLyrics(artist, title, { skipDelay: true, retryCount: retryCount + 1 });
      }
      throw new Error('AZLyrics blocked request (possible bot detection)');
    }

    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      throw new Error('AZLyrics request timed out');
    }

    throw error;
  }
}

/**
 * Search AZLyrics using their search page
 * Fallback when direct URL construction fails
 * @param {string} query - Search query (artist + title)
 * @returns {Promise<Array<{artist: string, title: string, url: string}>>}
 */
async function searchLyrics(query) {
  await randomDelay(2000, 4000);

  try {
    // AZLyrics search uses Google Custom Search
    const searchUrl = `${BASE_URL}/search.html`;

    const response = await axios.get(searchUrl, {
      params: { q: query },
      headers: {
        'User-Agent': getRandomUserAgent(),
        'Referer': BASE_URL
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const results = [];

    // Parse search results
    $('td.text-left a').each((i, el) => {
      const $link = $(el);
      const href = $link.attr('href');

      if (href && href.includes('/lyrics/')) {
        const text = $link.text().trim();
        // Format is usually "Artist - Title"
        const parts = text.split(' - ');

        results.push({
          artist: parts[0] || 'Unknown',
          title: parts[1] || text,
          url: href.startsWith('http') ? href : `${BASE_URL}${href}`
        });
      }
    });

    return results.slice(0, 10); // Return top 10 results

  } catch (error) {
    console.error('AZLyrics search failed:', error.message);
    return [];
  }
}

/**
 * Scrape lyrics directly from URL
 * Useful when you already have the AZLyrics URL
 * @param {string} url - Full AZLyrics URL
 * @returns {Promise<{lyrics: string, url: string, source: string}>}
 */
async function scrapeFromUrl(url) {
  await randomDelay(2000, 4000);

  const response = await axios.get(url, {
    headers: {
      'User-Agent': getRandomUserAgent(),
      'Referer': 'https://www.google.com/'
    },
    timeout: 15000
  });

  const $ = cheerio.load(response.data);

  let lyricsDiv = $('div.ringtone').nextAll('div').first();
  let lyrics = lyricsDiv.text().trim();

  if (!lyrics || lyrics.length < 50) {
    throw new Error('Could not extract lyrics from URL');
  }

  return {
    lyrics: parseLyrics(lyrics),
    url,
    source: 'AZLyrics'
  };
}

/**
 * Check if a song exists on AZLyrics without fetching full lyrics
 * Uses HEAD request to check URL validity
 * @param {string} artist
 * @param {string} title
 * @returns {Promise<boolean>}
 */
async function checkExists(artist, title) {
  const url = constructUrl(artist, title);

  try {
    const response = await axios.head(url, {
      headers: { 'User-Agent': getRandomUserAgent() },
      timeout: 5000
    });
    return response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Generate URL variations to try for tricky artist/title combinations
 * @param {string} artist
 * @param {string} title
 * @returns {string[]}
 */
function generateUrlVariations(artist, title) {
  const variations = [
    constructUrl(artist, title),
  ];

  // Try without "feat." or "ft."
  if (/\b(feat\.?|ft\.?)\b/i.test(title)) {
    const cleanTitle = title.replace(/\s*\b(feat\.?|ft\.?)\b.*/i, '').trim();
    variations.push(constructUrl(artist, cleanTitle));
  }

  // Try without parenthetical content
  if (/\(.*?\)/.test(title)) {
    const cleanTitle = title.replace(/\s*\(.*?\)/g, '').trim();
    variations.push(constructUrl(artist, cleanTitle));
  }

  // Try alternate artist formats (for "The X" artists)
  if (/^the\s+/i.test(artist)) {
    const withoutThe = artist.replace(/^the\s+/i, '');
    variations.push(constructUrl(withoutThe, title));
  } else {
    variations.push(constructUrl(`The ${artist}`, title));
  }

  return [...new Set(variations)]; // Remove duplicates
}

module.exports = {
  scrapeLyrics,
  searchLyrics,
  scrapeFromUrl,
  checkExists,
  constructUrl,
  generateUrlVariations,
  normalizeForUrl
};
