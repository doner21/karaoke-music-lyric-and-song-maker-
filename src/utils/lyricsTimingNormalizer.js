/**
 * Normalizes the canonical lyrics JSON into a structure optimized for rendering.
 * 
 * @param {Object} canonicalJson - The raw JSON from the alignment engine
 * @returns {Object} Normalized lyrics structure
 */
export function normalizeLyrics(canonicalJson) {
    if (!canonicalJson || !canonicalJson.lyrics) {
        return { lines: [], gaps: [], totalDuration: 0 };
    }

    const lines = [];
    const gaps = [];
    let absoluteWordIndex = 0;
    let lastWordEndTime = 0;

    // Process lyrics into flat lines with words
    canonicalJson.lyrics.forEach((line, lineIndex) => {
        const words = [];

        // Handle case where line might be just text or array
        // Assuming canonical format has a 'words' array or similar structure, 
        // but looking at implementation plan, we need to robustly handle the input.
        // Standardizing on 'words' array being present in canonical output or parsing text.
        // For now, assuming the canonical format provides words with start/end times.

        const lineWords = line.words || [];

        lineWords.forEach((word) => {
            // Detect gaps > 8s between previous word end and this word start
            const timeSinceLastWord = word.start - lastWordEndTime;
            if (lastWordEndTime > 0 && timeSinceLastWord >= 8.0) {
                gaps.push({
                    type: 'instrumental',
                    startTime: lastWordEndTime,
                    endTime: word.start,
                    duration: timeSinceLastWord
                });
            }

            words.push({
                wordIndex: absoluteWordIndex++,
                text: word.text,
                startTime: word.start,
                endTime: word.end,
                syllables: word.syllables || [] // Preserve if present
            });

            lastWordEndTime = word.end;
        });

        if (words.length > 0) {
            lines.push({
                lineIndex: lineIndex,
                words: words,
                startTime: words[0].startTime,
                endTime: words[words.length - 1].endTime,
                text: line.text || words.map(w => w.text).join(' ') // Fallback text
            });
        }
    });

    // Detect outro gap
    // We'd ideally need total song duration to know if there's a long outro
    // For now, we can check if there's a significant gap after the last word if duration is provided
    // But without total duration passed in, we can't definitively mark outro.
    // We'll leave specific outro detection for when we have total duration context.

    return {
        lines,
        gaps,
        totalDuration: lastWordEndTime // Approximate if not provided
    };
}
