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
 * Determines the current page based on playback time.
 * Logic: A page is active until the NEXT page's first word starts? 
 * Or stricter: Page turns when its last word ends? 
 * Plan says: "Page turns ONLY after final word on current page completes"
 * 
 * @param {Array} pages - Calculated pages
 * @param {number} currentTime - Current playback time
 * @returns {Object} { currentPage, nextPage }
 */
export function getCurrentPage(pages, currentTime) {
    if (!pages || pages.length === 0) return { currentPage: null, nextPage: null };

    // Find the page where the time is currently active or recently finished
    // We want to hold the page until the next page is supposed to start?
    // Let's follow the rule: Page holds until its endTime passed?
    // Actually, standard karaoke usually holds the page until it's time for the next page's first line.
    // BUT the plan explicitly says "Page turns ONLY after final word on current page completes".
    // This implies we switch to the next page immediately after the current one finishes or slightly after.

    // Let's find the first page where currentTime < endTime.
    // Actually, if we are in the gap between Page A (end 10s) and Page B (start 20s),
    // we might want to show Page A until some threshold, then clear or show Page B.
    // Plan says: "Pre-load next page... Page turns ONLY after final word on current page completes".

    // So if Time > Page A.endTime, we should probably switch to Page B (or transition).

    // Find index where currentTime <= endTime
    // This might need refinement for strict gaps.

    let activeIndex = pages.findIndex(page => currentTime < page.endTime);

    // If all pages have finished (activeIndex === -1), show the last page?
    // Or if we are in a long outro, maybe clear?
    if (activeIndex === -1) {
        // If we are past the last page, return the last page (lyrics stay on screen potentially)
        // or return null to clear. Let's return the last page for now.
        // But wait, if we are in a gap between Page 1 index 0 (end 10s) and Page 2 index 1 (start 20s)
        // and time is 15s. 
        // findIndex(t < page.endTime) will return index 1 (Page 2) because 15 < 20? No.
        // Page 2 ends at 25s. So 15 < 25. Correct. It returns Page 2.

        // But wait, if Page 1 ends at 10s. Page 2 starts at 20s.
        // Time 15s.
        // Page 1: 15 < 10 (False)
        // Page 2: 15 < 25 (True) -> Returns Page 2.
        // So at 15s (during gap), we show Page 2 (future).
        // This matches "Pre-load next page".

        // What if we are actively singing Page 1?
        // Time 5s.
        // Page 1: 5 < 10 (True) -> Returns Page 1.

        // This logic holds up: Show the page that is strictly current/future.
        // Once a page is fully 'past' (time > endTime), we move to the next candidates.

        activeIndex = activeIndex === -1 ? pages.length - 1 : activeIndex;
    }

    return {
        currentPage: pages[activeIndex],
        nextPage: pages[activeIndex + 1] || null
    };
}
