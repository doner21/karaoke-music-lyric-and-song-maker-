/**
 * JSON Adapters for Karaoke Lyrics Editor
 * 
 * Converts between the canonical JSON format (seconds, nested structure)
 * and the internal Token model (milliseconds, flat array).
 */

import { createToken } from './tokenModel.js';

/**
 * Parse canonical karaoke JSON into flat Token array
 * @param {Object} canonicalJson - The canonical lyrics JSON
 * @returns {Token[]} - Flat array of tokens
 */
export function parseJSONToTokens(canonicalJson) {
    if (!canonicalJson) {
        throw new Error('parseJSONToTokens: Input is null or undefined');
    }

    const lyrics = canonicalJson.lyrics;
    if (!lyrics || !Array.isArray(lyrics)) {
        return [];
    }

    const tokens = [];

    for (let lineIndex = 0; lineIndex < lyrics.length; lineIndex++) {
        const line = lyrics[lineIndex];
        const words = line.words;

        if (!words || !Array.isArray(words) || words.length === 0) {
            // Skip empty sentences
            continue;
        }

        for (const word of words) {
            if (!word || typeof word.start !== 'number' || typeof word.end !== 'number') {
                continue;
            }

            const text = word.text || '';
            const startMs = Math.round(word.start * 1000);
            const endMs = Math.round(word.end * 1000);

            tokens.push(createToken(text, startMs, endMs, lineIndex));
        }
    }

    // Sort by startMs for consistent ordering (stable sort preserving lineIndex order)
    tokens.sort((a, b) => {
        if (a.startMs !== b.startMs) {
            return a.startMs - b.startMs;
        }
        // Same startMs: preserve original lineIndex order
        return a.lineIndex - b.lineIndex;
    });

    return tokens;
}

/**
 * Convert Token array back to canonical JSON format
 * @param {Token[]} tokens - Flat array of tokens
 * @param {Object} metadata - Optional metadata { title?, artist?, method? }
 * @returns {Object} - Canonical JSON object
 */
export function tokensToExportJSON(tokens, metadata = {}) {
    if (!tokens || !Array.isArray(tokens)) {
        return {
            ...metadata,
            lyrics: [],
        };
    }

    // Group tokens by lineIndex
    const groupedByLine = new Map();

    for (const token of tokens) {
        const lineIndex = token.lineIndex;
        if (!groupedByLine.has(lineIndex)) {
            groupedByLine.set(lineIndex, []);
        }
        groupedByLine.get(lineIndex).push(token);
    }

    // Sort groups by lineIndex
    const sortedLineIndices = Array.from(groupedByLine.keys()).sort((a, b) => a - b);

    const lyrics = [];

    for (const lineIndex of sortedLineIndices) {
        const lineTokens = groupedByLine.get(lineIndex);

        // Sort tokens within the line by startMs
        lineTokens.sort((a, b) => a.startMs - b.startMs);

        if (lineTokens.length === 0) {
            continue;
        }

        // Compute sentence-level start/end from child words
        const sentenceStart = lineTokens[0].startMs / 1000;
        const sentenceEnd = lineTokens[lineTokens.length - 1].endMs / 1000;
        const sentenceText = lineTokens.map(t => t.text).join(' ');

        // Convert tokens to words
        const words = lineTokens.map(token => ({
            start: token.startMs / 1000,
            end: token.endMs / 1000,
            text: token.text,
        }));

        lyrics.push({
            sentence: {
                start: sentenceStart,
                end: sentenceEnd,
                text: sentenceText,
            },
            words,
        });
    }

    return {
        ...metadata,
        lyrics,
    };
}

/**
 * Validate that a roundtrip produces equivalent timing data
 * Used for testing - times should match within ±1ms tolerance
 * @param {Token[]} original - Original tokens
 * @param {Token[]} roundtripped - Tokens after roundtrip
 * @returns {boolean} - True if roundtrip is stable
 */
export function validateRoundtrip(original, roundtripped) {
    if (original.length !== roundtripped.length) {
        return false;
    }

    // Sort both for comparison
    const sortedOriginal = [...original].sort((a, b) => a.startMs - b.startMs);
    const sortedRoundtripped = [...roundtripped].sort((a, b) => a.startMs - b.startMs);

    for (let i = 0; i < sortedOriginal.length; i++) {
        const orig = sortedOriginal[i];
        const rt = sortedRoundtripped[i];

        if (orig.text !== rt.text) {
            return false;
        }
        if (orig.lineIndex !== rt.lineIndex) {
            return false;
        }
        // Allow ±1ms tolerance due to float/int conversion
        if (Math.abs(orig.startMs - rt.startMs) > 1) {
            return false;
        }
        if (Math.abs(orig.endMs - rt.endMs) > 1) {
            return false;
        }
    }

    return true;
}
