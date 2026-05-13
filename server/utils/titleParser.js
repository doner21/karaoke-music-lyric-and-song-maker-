/**
 * Shared YouTube title parser
 * Extracts artist name and track title from raw YouTube video titles.
 * Used by both downloader/index.js and server-proxy.js.
 */

/**
 * Parse a YouTube video title into artist name and track title.
 * Handles common patterns: "Artist - Song", "Artist – Song" (en-dash)
 * Strips suffix patterns like "(Official Video)", "[Lyrics]", "(Audio)"
 *
 * @param {string} rawTitle - The raw YouTube video title
 * @returns {{ artistName: string, trackTitle: string }}
 */
export function parseVideoTitle(rawTitle) {
    if (!rawTitle) {
        return { artistName: 'Unknown Artist', trackTitle: 'Unknown Track' };
    }

    let artistName = 'Unknown Artist';
    let trackTitle = rawTitle;

    const delimiterMatch = rawTitle.match(/^(.+?)\s*[-–]\s*(.+)$/);
    if (delimiterMatch) {
        artistName = delimiterMatch[1].trim();
        trackTitle = delimiterMatch[2].trim();
    }

    // Remove common suffix patterns
    trackTitle = trackTitle
        .replace(/\s*[\(\[](?:Official|Lyric|Audio|Video|HD|HQ|Lyrics|Music Video|Official Video|Official Audio).*?[\)\]]\s*/gi, '')
        .trim();

    return { artistName, trackTitle };
}
