/**
 * Token Data Model for Karaoke Lyrics Editor
 * 
 * All time values are in MILLISECONDS (integer) internally.
 * The JSON adapters convert to/from seconds at boundaries.
 */

/**
 * @typedef {Object} Token
 * @property {string} id - Stable UUID (crypto.randomUUID())
 * @property {string} text - Word text (non-empty)
 * @property {number} startMs - Start time in milliseconds (integer)
 * @property {number} endMs - End time in milliseconds (integer)
 * @property {number} lineIndex - Which line/sentence this token belongs to
 */

/**
 * @typedef {Object} Policy
 * @property {boolean} allowOverlaps - Whether tokens may overlap (default: false)
 * @property {boolean} rippleEnabled - Whether edits ripple to subsequent tokens (default: false)
 * @property {number|null} snapMs - Snap grid in ms, null for no snap (default: null)
 * @property {number} minDurationMs - Minimum token duration (default: 50)
 */

/**
 * @typedef {Object} ValidationIssue
 * @property {string} tokenId - ID of the offending token
 * @property {'invalid_range'|'too_short'|'overlap'|'out_of_bounds'|'empty_text'} type
 * @property {string} message - Human-readable description
 */

/**
 * Default policy settings
 */
export const DEFAULT_POLICY = {
    allowOverlaps: false,
    rippleEnabled: false,
    snapMs: null,
    minDurationMs: 50,
};

/**
 * Create a new token with a random UUID
 * @param {string} text - Word text
 * @param {number} startMs - Start time in milliseconds
 * @param {number} endMs - End time in milliseconds
 * @param {number} lineIndex - Line/sentence index
 * @returns {Token}
 */
export function createToken(text, startMs, endMs, lineIndex) {
    return {
        id: crypto.randomUUID(),
        text,
        startMs: Math.round(startMs),
        endMs: Math.round(endMs),
        lineIndex,
    };
}

/**
 * Create a token with a specified ID (for testing/deserialization)
 * @param {string} id - Token ID
 * @param {string} text - Word text
 * @param {number} startMs - Start time in milliseconds
 * @param {number} endMs - End time in milliseconds
 * @param {number} lineIndex - Line/sentence index
 * @returns {Token}
 */
export function createTokenWithId(id, text, startMs, endMs, lineIndex) {
    return {
        id,
        text,
        startMs: Math.round(startMs),
        endMs: Math.round(endMs),
        lineIndex,
    };
}

/**
 * Apply snap grid to a time value
 * @param {number} timeMs - Time in milliseconds
 * @param {number|null} snapMs - Snap grid in ms, or null for no snap
 * @returns {number} - Snapped time
 */
export function applySnap(timeMs, snapMs) {
    if (snapMs === null || snapMs <= 0) {
        return timeMs;
    }
    return Math.round(timeMs / snapMs) * snapMs;
}

/**
 * Clamp a value to a range
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} - Clamped value
 */
export function clampMs(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
