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

// Buffer time before next lyrics where countdown hides and lyrics become visible
const PREP_BUFFER_SECONDS = 3.0;

/**
 * Determines the current page based on playback time.
 * Supports gap-aware page pre-loading: during the 3s prep buffer before lyrics resume,
 * returns the page containing the upcoming lyrics.
 *
 * @param {Array} pages - Calculated pages
 * @param {number} currentTime - Current playback time
 * @param {Array} gaps - Array of gap objects from normalizedLyrics (optional)
 * @returns {Object} { currentPage, nextPage }
 */
export function getCurrentPage(pages, currentTime, gaps = []) {
    if (!pages || pages.length === 0) return { currentPage: null, nextPage: null };

    // Check if we're in a gap's 3s prep buffer - if so, pre-load the next page
    if (gaps && gaps.length > 0) {
        for (const gap of gaps) {
            const countdownDuration = Math.max(0, gap.duration - PREP_BUFFER_SECONDS);
            const countdownEndTime = gap.startTime + countdownDuration;

            // Check if we're in the 3s prep buffer (after countdown ends, before gap ends)
            if (currentTime >= countdownEndTime && currentTime < gap.endTime) {
                // Find the page that contains lyrics starting at or after gap.endTime
                const nextPageIndex = pages.findIndex(p => p.startTime >= gap.endTime - 0.1);
                if (nextPageIndex !== -1) {
                    return {
                        currentPage: pages[nextPageIndex],
                        nextPage: pages[nextPageIndex + 1] || null
                    };
                }
                // If no page starts exactly at gap end, find page that contains the gap end time
                const containingPageIndex = pages.findIndex(p =>
                    gap.endTime >= p.startTime && gap.endTime <= p.endTime
                );
                if (containingPageIndex !== -1) {
                    return {
                        currentPage: pages[containingPageIndex],
                        nextPage: pages[containingPageIndex + 1] || null
                    };
                }
            }
        }
    }

    // Standard page selection: find the first page where currentTime < endTime
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
