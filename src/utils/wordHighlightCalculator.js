/**
 * Calculates the highlight state for a specific word based on playback time.
 * 
 * @param {Object} word - The word object containing {startTime, endTime, text}
 * @param {number} currentTime - Current playback time in seconds
 * @returns {Object} { state: 'past' | 'current' | 'future', progress: number }
 */
export function calculateWordHighlight(word, currentTime) {
    if (currentTime < word.startTime) {
        return { state: 'future', progress: 0 };
    } else if (currentTime >= word.endTime) {
        return { state: 'past', progress: 1 };
    } else {
        // Current word
        const duration = word.endTime - word.startTime;
        const progress = duration > 0 ? (currentTime - word.startTime) / duration : 1;
        return { state: 'current', progress: Math.min(Math.max(progress, 0), 1) };
    }
}

/**
 * Batch calculates highlight states for a list of words.
 * Optimization: returns a map or localized updates could be done here.
 * 
 * @param {Array} words - Array of word objects
 * @param {number} currentTime - Current playback time
 * @returns {Array} Array of result objects matching input order
 */
export function calculateBatchHighlights(words, currentTime) {
    return words.map(word => calculateWordHighlight(word, currentTime));
}
