/**
 * Parses and cleans lyrics text scraped from Genius
 * @param {string} rawText - Raw text content from the lyrics container
 * @returns {string} Cleaned, singable lyrics
 */
export function parseLyrics(rawText) {
    if (!rawText) return '';

    return rawText
        // Remove section headers like [Chorus], [Verse 1], etc.
        .replace(/^\[.*?\]$/gm, '')
        // Remove empty brackets that might remain
        .replace(/\[\]/g, '')
        // Remove embed metadata (sometimes Genius adds "Embed" at the end of lines)
        .replace(/\d*Embed$/gm, '')
        // Remove contributor lines
        .replace(/^.*Contributor.*$/gm, '')
        // Normalize newlines (limit to max 2 consecutive)
        .replace(/\n{3,}/g, '\n\n')
        // Trim each line
        .split('\n')
        .map(line => line.trim())
        .join('\n')
        .trim();
}
