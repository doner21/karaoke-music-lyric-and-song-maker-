// Gap threshold for detecting instrumental/outro intervals (in seconds)
const GAP_THRESHOLD_SECONDS = 8.0;

/**
 * Normalizes the canonical lyrics JSON into a structure optimized for rendering.
 *
 * @param {Object} canonicalJson - The raw JSON from the alignment engine
 * @param {number} trackDuration - Total duration of the track in seconds (optional, enables outro detection)
 * @returns {Object} Normalized lyrics structure
 */
export function normalizeLyrics(canonicalJson, trackDuration = null) {
    if (!canonicalJson || !canonicalJson.lyrics) {
        return { lines: [], gaps: [], totalDuration: trackDuration || 0 };
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
            // Detect gaps >= threshold between previous word end and this word start
            const timeSinceLastWord = word.start - lastWordEndTime;
            if (lastWordEndTime > 0 && timeSinceLastWord >= GAP_THRESHOLD_SECONDS) {
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

    // Detect outro gap - requires track duration to determine if there's a long gap after final lyrics
    if (trackDuration && trackDuration > lastWordEndTime) {
        const outroGapDuration = trackDuration - lastWordEndTime;
        if (outroGapDuration >= GAP_THRESHOLD_SECONDS) {
            gaps.push({
                type: 'outro',
                startTime: lastWordEndTime,
                endTime: trackDuration,
                duration: outroGapDuration
            });
        }
    }

    return {
        lines,
        gaps,
        totalDuration: trackDuration || lastWordEndTime // Use track duration if available
    };
}
