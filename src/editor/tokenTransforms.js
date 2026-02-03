/**
 * Token Transform Functions for Karaoke Lyrics Editor
 * 
 * All functions are PURE - they return new arrays without mutating inputs.
 * Policy parameter controls overlap prevention, ripple, snap, and minimum duration.
 */

import { createToken, applySnap, clampMs, DEFAULT_POLICY } from './tokenModel.js';

// ============================================================================
// HELPER FUNCTIONS (internal)
// ============================================================================

/**
 * Find a token by ID
 * @param {Token[]} tokens
 * @param {string} id
 * @returns {Token|undefined}
 */
function findToken(tokens, id) {
    return tokens.find(t => t.id === id);
}

/**
 * Find token index by ID
 * @param {Token[]} tokens
 * @param {string} id
 * @returns {number}
 */
function findIndex(tokens, id) {
    return tokens.findIndex(t => t.id === id);
}

/**
 * Get tokens on the same line, sorted by startMs
 * @param {Token[]} tokens
 * @param {number} lineIndex
 * @returns {Token[]}
 */
function lineNeighbors(tokens, lineIndex) {
    return tokens
        .filter(t => t.lineIndex === lineIndex)
        .sort((a, b) => a.startMs - b.startMs);
}

/**
 * Find the previous token on the same line
 * @param {Token[]} tokens
 * @param {Token} token
 * @returns {Token|null}
 */
function prevToken(tokens, token) {
    const neighbors = lineNeighbors(tokens, token.lineIndex);
    const idx = neighbors.findIndex(t => t.id === token.id);
    return idx > 0 ? neighbors[idx - 1] : null;
}

/**
 * Find the next token on the same line
 * @param {Token[]} tokens
 * @param {Token} token
 * @returns {Token|null}
 */
function nextToken(tokens, token) {
    const neighbors = lineNeighbors(tokens, token.lineIndex);
    const idx = neighbors.findIndex(t => t.id === token.id);
    return idx >= 0 && idx < neighbors.length - 1 ? neighbors[idx + 1] : null;
}

/**
 * Apply snap from policy
 * @param {number} ms
 * @param {Object} policy
 * @returns {number}
 */
function snap(ms, policy) {
    return applySnap(ms, policy.snapMs);
}

// ============================================================================
// TRANSFORM FUNCTIONS (T1-T11)
// ============================================================================

/**
 * T1: Move selected tokens by deltaMs
 * @param {Token[]} tokens
 * @param {Set<string>|string[]} selectionIds
 * @param {number} deltaMs
 * @param {Object} policy
 * @returns {Token[]}
 */
export function moveTokens(tokens, selectionIds, deltaMs, policy = DEFAULT_POLICY) {
    const selectedSet = selectionIds instanceof Set ? selectionIds : new Set(selectionIds);

    return tokens.map(token => {
        if (!selectedSet.has(token.id)) {
            return token;
        }

        let newStartMs = snap(token.startMs + deltaMs, policy);
        let newEndMs = snap(token.endMs + deltaMs, policy);

        // Clamp to [0, Infinity]
        newStartMs = clampMs(newStartMs, 0, Infinity);
        newEndMs = clampMs(newEndMs, 0, Infinity);

        // Overlap prevention
        if (!policy.allowOverlaps) {
            const prev = prevToken(tokens, token);
            const next = nextToken(tokens, token);

            // Don't count other selected tokens as neighbors for clamping
            if (prev && !selectedSet.has(prev.id)) {
                if (newStartMs < prev.endMs) {
                    const shift = prev.endMs - newStartMs;
                    newStartMs = prev.endMs;
                    newEndMs += shift;
                }
            }
            if (next && !selectedSet.has(next.id)) {
                if (newEndMs > next.startMs) {
                    const shift = newEndMs - next.startMs;
                    newEndMs = next.startMs;
                    newStartMs -= shift;
                    // Ensure we don't go below 0 or overlap prev
                    newStartMs = clampMs(newStartMs, prev ? prev.endMs : 0, newEndMs);
                }
            }
        }

        return { ...token, startMs: newStartMs, endMs: newEndMs };
    });
}

/**
 * T2: Resize token start time
 * @param {Token[]} tokens
 * @param {string} tokenId
 * @param {number} newStartMs
 * @param {Object} policy
 * @returns {Token[]}
 */
export function resizeTokenStart(tokens, tokenId, newStartMs, policy = DEFAULT_POLICY) {
    return tokens.map(token => {
        if (token.id !== tokenId) {
            return token;
        }

        let startMs = snap(newStartMs, policy);

        // Enforce minimum duration
        const maxStart = token.endMs - policy.minDurationMs;
        startMs = clampMs(startMs, 0, maxStart);

        // Overlap prevention
        if (!policy.allowOverlaps) {
            const prev = prevToken(tokens, token);
            if (prev) {
                startMs = clampMs(startMs, prev.endMs, maxStart);
            }
        }

        return { ...token, startMs };
    });
}

/**
 * T3: Resize token end time
 * @param {Token[]} tokens
 * @param {string} tokenId
 * @param {number} newEndMs
 * @param {Object} policy
 * @returns {Token[]}
 */
export function resizeTokenEnd(tokens, tokenId, newEndMs, policy = DEFAULT_POLICY) {
    return tokens.map(token => {
        if (token.id !== tokenId) {
            return token;
        }

        let endMs = snap(newEndMs, policy);

        // Enforce minimum duration
        const minEnd = token.startMs + policy.minDurationMs;
        endMs = clampMs(endMs, minEnd, Infinity);

        // Overlap prevention
        if (!policy.allowOverlaps) {
            const next = nextToken(tokens, token);
            if (next) {
                endMs = clampMs(endMs, minEnd, next.startMs);
            }
        }

        return { ...token, endMs };
    });
}

/**
 * T4: Nudge selected tokens by stepMs
 * @param {Token[]} tokens
 * @param {Set<string>|string[]} selectionIds
 * @param {number} stepMs
 * @param {Object} policy
 * @returns {Token[]}
 */
export function nudgeTokens(tokens, selectionIds, stepMs, policy = DEFAULT_POLICY) {
    return moveTokens(tokens, selectionIds, stepMs, policy);
}

/**
 * T5: Edit token text
 * @param {Token[]} tokens
 * @param {string} tokenId
 * @param {string} newText
 * @returns {Token[]}
 */
export function editTokenText(tokens, tokenId, newText) {
    // Reject empty text
    if (!newText || newText.trim() === '') {
        return tokens;
    }

    return tokens.map(token => {
        if (token.id !== tokenId) {
            return token;
        }
        return { ...token, text: newText };
    });
}

/**
 * T6: Insert a new token before or after an anchor
 * @param {Token[]} tokens
 * @param {string} anchorTokenId
 * @param {'before'|'after'} position
 * @param {string} text
 * @param {'split_gap'|'zero_duration'} timingStrategy
 * @param {Object} policy
 * @returns {Token[]}
 */
export function insertToken(tokens, anchorTokenId, position, text, timingStrategy = 'zero_duration', policy = DEFAULT_POLICY) {
    const anchor = findToken(tokens, anchorTokenId);
    if (!anchor) {
        return tokens;
    }

    let newStartMs, newEndMs;

    if (position === 'before') {
        const prev = prevToken(tokens, anchor);
        if (timingStrategy === 'split_gap' && prev) {
            // Split the gap between prev and anchor
            const gapStart = prev.endMs;
            const gapEnd = anchor.startMs;
            const midpoint = Math.round((gapStart + gapEnd) / 2);
            newStartMs = gapStart;
            newEndMs = midpoint;
        } else {
            // Zero duration at anchor boundary
            newEndMs = anchor.startMs;
            newStartMs = newEndMs - policy.minDurationMs;
        }
    } else {
        // position === 'after'
        const next = nextToken(tokens, anchor);
        if (timingStrategy === 'split_gap' && next) {
            // Split the gap between anchor and next
            const gapStart = anchor.endMs;
            const gapEnd = next.startMs;
            const midpoint = Math.round((gapStart + gapEnd) / 2);
            newStartMs = midpoint;
            newEndMs = gapEnd;
        } else {
            // Zero duration at anchor boundary
            newStartMs = anchor.endMs;
            newEndMs = newStartMs + policy.minDurationMs;
        }
    }

    // Clamp to [0, Infinity]
    newStartMs = clampMs(newStartMs, 0, Infinity);
    newEndMs = clampMs(newEndMs, newStartMs + policy.minDurationMs, Infinity);

    const newToken = createToken(text, newStartMs, newEndMs, anchor.lineIndex);

    // Insert into the array
    const result = [...tokens];
    const anchorIdx = findIndex(result, anchorTokenId);

    if (position === 'before') {
        result.splice(anchorIdx, 0, newToken);
    } else {
        result.splice(anchorIdx + 1, 0, newToken);
    }

    return result;
}

/**
 * T7: Delete selected tokens
 * @param {Token[]} tokens
 * @param {Set<string>|string[]} selectionIds
 * @param {Object} policy
 * @returns {Token[]}
 */
export function deleteTokens(tokens, selectionIds, policy = DEFAULT_POLICY) {
    const selectedSet = selectionIds instanceof Set ? selectionIds : new Set(selectionIds);

    if (!policy.rippleEnabled) {
        // Simple deletion
        return tokens.filter(t => !selectedSet.has(t.id));
    }

    // With ripple: close gaps on same line
    const result = [];
    const deletedByLine = new Map(); // lineIndex -> total gap to close

    for (const token of tokens) {
        if (selectedSet.has(token.id)) {
            // Track the duration for ripple
            const duration = token.endMs - token.startMs;
            const current = deletedByLine.get(token.lineIndex) || 0;
            deletedByLine.set(token.lineIndex, current + duration);
        }
    }

    // Track cumulative shift per line
    const shiftByLine = new Map();

    for (const token of tokens) {
        if (selectedSet.has(token.id)) {
            continue;
        }

        const lineIndex = token.lineIndex;
        const shift = shiftByLine.get(lineIndex) || 0;

        if (shift !== 0) {
            result.push({
                ...token,
                startMs: token.startMs - shift,
                endMs: token.endMs - shift,
            });
        } else {
            result.push(token);
        }

        // Update shift for subsequent tokens
        // (This simplified approach shifts all tokens after any deleted token)
    }

    return result;
}

/**
 * T8: Split a token into two
 * @param {Token[]} tokens
 * @param {string} tokenId
 * @param {Object} splitPoint - { textLeft, textRight, splitMs }
 * @param {Object} policy
 * @returns {Token[]}
 */
export function splitToken(tokens, tokenId, splitPoint, policy = DEFAULT_POLICY) {
    const token = findToken(tokens, tokenId);
    if (!token) {
        return tokens;
    }

    const { textLeft, textRight, splitMs } = splitPoint;

    // Validate split point
    if (splitMs <= token.startMs + policy.minDurationMs) {
        return tokens;
    }
    if (splitMs >= token.endMs - policy.minDurationMs) {
        return tokens;
    }

    // Create two new tokens
    const leftToken = createToken(textLeft, token.startMs, splitMs, token.lineIndex);
    const rightToken = createToken(textRight, splitMs, token.endMs, token.lineIndex);

    // Replace in array
    const idx = findIndex(tokens, tokenId);
    const result = [...tokens];
    result.splice(idx, 1, leftToken, rightToken);

    return result;
}

/**
 * T9: Merge consecutive tokens
 * @param {Token[]} tokens
 * @param {string[]} tokenIds
 * @param {'space'|'concat'} joinStrategy
 * @returns {Token[]}
 */
export function mergeTokens(tokens, tokenIds, joinStrategy = 'space') {
    if (!tokenIds || tokenIds.length < 2) {
        return tokens;
    }

    // Get the tokens to merge
    const toMerge = tokenIds.map(id => findToken(tokens, id)).filter(Boolean);

    if (toMerge.length < 2) {
        return tokens;
    }

    // Verify they're on the same line
    const lineIndex = toMerge[0].lineIndex;
    if (!toMerge.every(t => t.lineIndex === lineIndex)) {
        return tokens;
    }

    // Sort by startMs
    toMerge.sort((a, b) => a.startMs - b.startMs);

    // Create merged token
    const mergedStart = toMerge[0].startMs;
    const mergedEnd = toMerge[toMerge.length - 1].endMs;
    const separator = joinStrategy === 'space' ? ' ' : '';
    const mergedText = toMerge.map(t => t.text).join(separator);

    const mergedToken = createToken(mergedText, mergedStart, mergedEnd, lineIndex);

    // Remove old tokens and insert merged
    const mergeIdSet = new Set(tokenIds);
    const result = tokens.filter(t => !mergeIdSet.has(t.id));

    // Find insertion point (where first token was)
    const firstMergedIdx = tokens.findIndex(t => t.id === toMerge[0].id);

    // Insert merged token at appropriate position
    const insertIdx = result.findIndex(t =>
        t.lineIndex > lineIndex ||
        (t.lineIndex === lineIndex && t.startMs > mergedStart)
    );

    if (insertIdx === -1) {
        result.push(mergedToken);
    } else {
        result.splice(insertIdx, 0, mergedToken);
    }

    return result;
}

/**
 * T10: Validate tokens and return issues
 * @param {Token[]} tokens
 * @param {number} trackDurationMs
 * @param {Object} policy
 * @returns {ValidationIssue[]}
 */
export function validateTokens(tokens, trackDurationMs = Infinity, policy = DEFAULT_POLICY) {
    const issues = [];

    for (const token of tokens) {
        // Check invalid range
        if (token.startMs >= token.endMs) {
            issues.push({
                tokenId: token.id,
                type: 'invalid_range',
                message: `Token "${token.text}" has invalid range: start (${token.startMs}ms) >= end (${token.endMs}ms)`,
            });
        }

        // Check too short
        const duration = token.endMs - token.startMs;
        if (duration > 0 && duration < policy.minDurationMs) {
            issues.push({
                tokenId: token.id,
                type: 'too_short',
                message: `Token "${token.text}" is too short: ${duration}ms < ${policy.minDurationMs}ms minimum`,
            });
        }

        // Check out of bounds
        if (token.startMs < 0) {
            issues.push({
                tokenId: token.id,
                type: 'out_of_bounds',
                message: `Token "${token.text}" starts before 0ms`,
            });
        }
        if (token.endMs > trackDurationMs) {
            issues.push({
                tokenId: token.id,
                type: 'out_of_bounds',
                message: `Token "${token.text}" ends after track duration (${trackDurationMs}ms)`,
            });
        }

        // Check empty text
        if (!token.text || token.text.trim() === '') {
            issues.push({
                tokenId: token.id,
                type: 'empty_text',
                message: `Token at ${token.startMs}ms has empty text`,
            });
        }
    }

    // Check overlaps (if disallowed)
    if (!policy.allowOverlaps) {
        // Group by line and check for overlaps
        const byLine = new Map();
        for (const token of tokens) {
            if (!byLine.has(token.lineIndex)) {
                byLine.set(token.lineIndex, []);
            }
            byLine.get(token.lineIndex).push(token);
        }

        for (const [lineIndex, lineTokens] of byLine) {
            lineTokens.sort((a, b) => a.startMs - b.startMs);

            for (let i = 0; i < lineTokens.length - 1; i++) {
                const current = lineTokens[i];
                const next = lineTokens[i + 1];

                if (current.endMs > next.startMs) {
                    issues.push({
                        tokenId: current.id,
                        type: 'overlap',
                        message: `Token "${current.text}" overlaps with "${next.text}" on line ${lineIndex + 1}`,
                    });
                }
            }
        }
    }

    return issues;
}

/**
 * T11: Apply ripple shift to tokens
 * @param {Token[]} tokens
 * @param {string} fromTokenId
 * @param {number} deltaMs
 * @param {'forward'|'backward'} direction
 * @returns {Token[]}
 */
export function applyRipple(tokens, fromTokenId, deltaMs, direction = 'forward') {
    const fromToken = findToken(tokens, fromTokenId);
    if (!fromToken) {
        return tokens;
    }

    const lineIndex = fromToken.lineIndex;
    const neighbors = lineNeighbors(tokens, lineIndex);
    const fromIdx = neighbors.findIndex(t => t.id === fromTokenId);

    // Determine which tokens to shift
    let tokensToShift;
    if (direction === 'forward') {
        tokensToShift = new Set(neighbors.slice(fromIdx + 1).map(t => t.id));
    } else {
        tokensToShift = new Set(neighbors.slice(0, fromIdx).map(t => t.id));
    }

    return tokens.map(token => {
        if (!tokensToShift.has(token.id)) {
            return token;
        }

        const newStartMs = clampMs(token.startMs + deltaMs, 0, Infinity);
        const newEndMs = clampMs(token.endMs + deltaMs, 0, Infinity);

        return { ...token, startMs: newStartMs, endMs: newEndMs };
    });
}
