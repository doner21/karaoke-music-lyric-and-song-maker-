/**
 * Groups lines into pages based on the configured linesPerPage.
 * Calculates start and end times for each page based on its content.
 * 
 * @param {Object} normalizedLyrics - Structure from lyricsTimingNormalizer
 * @param {number} linesPerPage - Number of lines to show per page
 * @returns {Array} Array of page objects
 */
export function calculatePages(normalizedLyrics, linesPerPage = 2) {
    if (!normalizedLyrics || !normalizedLyrics.lines) return [];

    const pages = [];
    const lines = normalizedLyrics.lines;

    for (let i = 0; i < lines.length; i += linesPerPage) {
        const pageLines = lines.slice(i, i + linesPerPage);

        if (pageLines.length === 0) continue;

        const firstWord = pageLines[0].words[0];
        const lastLine = pageLines[pageLines.length - 1];
        const lastWord = lastLine.words[lastLine.words.length - 1];

        // Determine page start/end times
        // Page effectively "starts" when the previous page ends, or 0 for first page
        // Page "ends" when the last word of the page finishes

        const startTime = firstWord ? firstWord.startTime : 0;
        const endTime = lastWord ? lastWord.endTime : 0;

        pages.push({
            pageIndex: pages.length,
            lines: pageLines,
            startTime,
            endTime
        });
    }

    return pages;
}

/**
 * Find the next highlightable word based on current time.
 * A word is "highlightable" if its endTime > currentTime (not yet fully completed).
 * 
 * KEY INVARIANT: This is the ground truth for page selection. The page shown
 * should always be the one containing the next word to highlight, ensuring
 * we never show a "future" page during an instrumental if there are still
 * words to highlight on the current page.
 * 
 * @param {Object} normalizedLyrics - Normalized lyrics structure
 * @param {number} currentTime - Current playback time
 * @returns {Object|null} { wordIndex, lineIndex, word } or null if all complete
 */
export function findNextHighlightableWord(normalizedLyrics, currentTime) {
    if (!normalizedLyrics?.lines) return null;

    for (const line of normalizedLyrics.lines) {
        for (const word of line.words) {
            // First word whose endTime is after currentTime (not yet fully highlighted)
            if (word.endTime > currentTime) {
                return {
                    wordIndex: word.wordIndex,
                    lineIndex: line.lineIndex,
                    word
                };
            }
        }
    }
    return null; // All words complete
}

/**
 * Find which page contains a specific line by lineIndex.
 * 
 * @param {Array} pages - Array of page objects
 * @param {number} lineIndex - Line index to find
 * @returns {number} Page index containing the line, or -1 if not found
 */
export function findPageContainingLine(pages, lineIndex) {
    return pages.findIndex(page =>
        page.lines.some(line => line.lineIndex === lineIndex)
    );
}

/**
 * Determines the current page based on playback time.
 * 
 * KEY INVARIANT: Page selection is derived from the next highlightable word,
 * NOT from gap timing. This ensures we never show a "future" page during
 * an instrumental if there are still words to highlight on the current page.
 * 
 * This fixes the bug where:
 * 1. An instrumental gap begins mid-page (unfinished words remain)
 * 2. Old logic would pre-load the post-gap page during prep buffer
 * 3. When lyrics resume, it would jump BACK to finish the previous page
 * 
 * New behavior:
 * - During instrumental, page stays on the one with unfinished words
 * - No backward page jumps when lyrics resume
 *
 * @param {Array} pages - Calculated pages
 * @param {number} currentTime - Current playback time
 * @param {Array} gaps - Array of gap objects (kept for API compatibility, not used for page selection)
 * @param {Object} normalizedLyrics - Full normalized lyrics structure (optional but recommended)
 * @returns {Object} { currentPage, nextPage }
 */
export function getCurrentPage(pages, currentTime, gaps = [], normalizedLyrics = null) {
    if (!pages || pages.length === 0) return { currentPage: null, nextPage: null };

    // CORE FIX: Derive page from next highlightable word
    // This ensures we stay on the correct page during instrumental gaps
    if (normalizedLyrics) {
        const nextWord = findNextHighlightableWord(normalizedLyrics, currentTime);

        if (nextWord) {
            // Find page containing this word's line
            const pageIndex = findPageContainingLine(pages, nextWord.lineIndex);

            if (pageIndex !== -1) {
                return {
                    currentPage: pages[pageIndex],
                    nextPage: pages[pageIndex + 1] || null
                };
            }
        }
    }

    // Fallback: use time-based logic for cases where normalizedLyrics not available
    // or all words are complete (used for outro/end-of-song scenarios)
    let activeIndex = pages.findIndex(page => currentTime < page.endTime);

    // If all pages have finished, return the last page
    if (activeIndex === -1) {
        activeIndex = pages.length - 1;
    }

    return {
        currentPage: pages[activeIndex],
        nextPage: pages[activeIndex + 1] || null
    };
}
