/**
 * Finds the active gap for the current playback time.
 * 
 * @param {Array} gaps - Array of gap objects from normalizedLyrics
 * @param {number} currentTime - Current playback time
 * @returns {Object|null} The active gap object or null
 */
export function getActiveGap(gaps, currentTime) {
    if (!gaps || gaps.length === 0) return null;

    // A gap is active if we are within its time range.
    // We might want to show the countdown slightly *before* the gap ends (as per plan).
    // Plan: "Countdown displays during gap, ends 3.0s early".

    // So the gap strictly exists between startTime and endTime.
    // The UI determines when to show/hide the countdown based on this.

    return gaps.find(gap => currentTime >= gap.startTime && currentTime < gap.endTime);
}
