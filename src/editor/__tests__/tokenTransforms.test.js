/**
 * Unit Tests for Token Transform Functions
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
    moveTokens,
    resizeTokenStart,
    resizeTokenEnd,
    nudgeTokens,
    editTokenText,
    insertToken,
    deleteTokens,
    splitToken,
    mergeTokens,
    validateTokens,
    applyRipple,
} from '../tokenTransforms.js';
import { createTokenWithId, DEFAULT_POLICY } from '../tokenModel.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

function createTestTokens() {
    return [
        createTokenWithId('t1', 'Hello', 0, 500, 0),
        createTokenWithId('t2', 'world', 600, 1000, 0),
        createTokenWithId('t3', 'How', 1100, 1500, 0),
        createTokenWithId('t4', 'are', 1600, 2000, 0),
        createTokenWithId('t5', 'you', 2100, 2500, 0),
        // Second line
        createTokenWithId('t6', 'I', 3000, 3300, 1),
        createTokenWithId('t7', 'am', 3400, 3700, 1),
        createTokenWithId('t8', 'fine', 3800, 4200, 1),
    ];
}

// ============================================================================
// T1: moveTokens
// ============================================================================

describe('moveTokens (T1)', () => {
    let tokens;
    let originalTokens;

    beforeEach(() => {
        tokens = createTestTokens();
        originalTokens = JSON.parse(JSON.stringify(tokens));
    });

    it('should move selected tokens by deltaMs', () => {
        const result = moveTokens(tokens, ['t2'], 100, DEFAULT_POLICY);

        const moved = result.find(t => t.id === 't2');
        expect(moved.startMs).toBe(700);
        expect(moved.endMs).toBe(1100);
    });

    it('should not modify unselected tokens', () => {
        const result = moveTokens(tokens, ['t2'], 100, DEFAULT_POLICY);

        const unchanged = result.find(t => t.id === 't1');
        expect(unchanged.startMs).toBe(0);
        expect(unchanged.endMs).toBe(500);
    });

    it('should prevent overlaps when policy.allowOverlaps is false', () => {
        // Try to move t2 into t3's space
        const result = moveTokens(tokens, ['t2'], 600, DEFAULT_POLICY);

        const moved = result.find(t => t.id === 't2');
        // Should be clamped to not overlap t3 (which starts at 1100)
        expect(moved.endMs).toBeLessThanOrEqual(1100);
    });

    it('should allow overlaps when policy.allowOverlaps is true', () => {
        const overlapsPolicy = { ...DEFAULT_POLICY, allowOverlaps: true };
        const result = moveTokens(tokens, ['t2'], 600, overlapsPolicy);

        const moved = result.find(t => t.id === 't2');
        expect(moved.startMs).toBe(1200);
        expect(moved.endMs).toBe(1600);
    });

    it('should clamp to zero (not go negative)', () => {
        const result = moveTokens(tokens, ['t1'], -1000, DEFAULT_POLICY);

        const moved = result.find(t => t.id === 't1');
        expect(moved.startMs).toBe(0);
    });

    it('should not mutate original array', () => {
        moveTokens(tokens, ['t2'], 100, DEFAULT_POLICY);
        expect(tokens).toEqual(originalTokens);
    });
});

// ============================================================================
// T2: resizeTokenStart
// ============================================================================

describe('resizeTokenStart (T2)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should resize token start time', () => {
        const result = resizeTokenStart(tokens, 't2', 550, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't2');
        expect(resized.startMs).toBe(550);
        expect(resized.endMs).toBe(1000); // unchanged
    });

    it('should enforce minimum duration', () => {
        // Try to set start very close to end
        const result = resizeTokenStart(tokens, 't2', 990, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't2');
        // Should be clamped to endMs - minDurationMs = 1000 - 50 = 950
        expect(resized.startMs).toBeLessThanOrEqual(950);
    });

    it('should prevent overlap with previous token', () => {
        // Try to resize t2 start to overlap with t1
        const result = resizeTokenStart(tokens, 't2', 400, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't2');
        // Should be clamped to t1.endMs (500)
        expect(resized.startMs).toBeGreaterThanOrEqual(500);
    });

    it('should not go below zero', () => {
        const result = resizeTokenStart(tokens, 't1', -100, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't1');
        expect(resized.startMs).toBe(0);
    });
});

// ============================================================================
// T3: resizeTokenEnd
// ============================================================================

describe('resizeTokenEnd (T3)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should resize token end time', () => {
        const result = resizeTokenEnd(tokens, 't2', 1050, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't2');
        expect(resized.startMs).toBe(600); // unchanged
        expect(resized.endMs).toBe(1050);
    });

    it('should enforce minimum duration', () => {
        // Try to set end very close to start
        const result = resizeTokenEnd(tokens, 't2', 610, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't2');
        // Should be clamped to startMs + minDurationMs = 600 + 50 = 650
        expect(resized.endMs).toBeGreaterThanOrEqual(650);
    });

    it('should prevent overlap with next token', () => {
        // Try to resize t2 end to overlap with t3
        const result = resizeTokenEnd(tokens, 't2', 1200, DEFAULT_POLICY);

        const resized = result.find(t => t.id === 't2');
        // Should be clamped to t3.startMs (1100)
        expect(resized.endMs).toBeLessThanOrEqual(1100);
    });
});

// ============================================================================
// T4: nudgeTokens
// ============================================================================

describe('nudgeTokens (T4)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should nudge tokens by positive step', () => {
        const result = nudgeTokens(tokens, ['t1'], 10, DEFAULT_POLICY);

        const nudged = result.find(t => t.id === 't1');
        expect(nudged.startMs).toBe(10);
        expect(nudged.endMs).toBe(510);
    });

    it('should nudge tokens by negative step', () => {
        const result = nudgeTokens(tokens, ['t2'], -50, DEFAULT_POLICY);

        const nudged = result.find(t => t.id === 't2');
        expect(nudged.startMs).toBe(550);
        expect(nudged.endMs).toBe(950);
    });

    it('should nudge multiple selected tokens', () => {
        const result = nudgeTokens(tokens, ['t1', 't2'], 100, DEFAULT_POLICY);

        const t1 = result.find(t => t.id === 't1');
        const t2 = result.find(t => t.id === 't2');

        expect(t1.startMs).toBe(100);
        expect(t2.startMs).toBe(700);
    });
});

// ============================================================================
// T5: editTokenText
// ============================================================================

describe('editTokenText (T5)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should change token text', () => {
        const result = editTokenText(tokens, 't1', 'Goodbye');

        const edited = result.find(t => t.id === 't1');
        expect(edited.text).toBe('Goodbye');
    });

    it('should reject empty text', () => {
        const result = editTokenText(tokens, 't1', '');

        const edited = result.find(t => t.id === 't1');
        expect(edited.text).toBe('Hello'); // unchanged
    });

    it('should reject whitespace-only text', () => {
        const result = editTokenText(tokens, 't1', '   ');

        const edited = result.find(t => t.id === 't1');
        expect(edited.text).toBe('Hello'); // unchanged
    });

    it('should not modify timing', () => {
        const result = editTokenText(tokens, 't1', 'Goodbye');

        const edited = result.find(t => t.id === 't1');
        expect(edited.startMs).toBe(0);
        expect(edited.endMs).toBe(500);
    });
});

// ============================================================================
// T6: insertToken
// ============================================================================

describe('insertToken (T6)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should insert token before anchor', () => {
        const result = insertToken(tokens, 't2', 'before', 'new', 'zero_duration', DEFAULT_POLICY);

        expect(result.length).toBe(tokens.length + 1);

        const newToken = result.find(t => t.text === 'new');
        expect(newToken).toBeDefined();
        expect(newToken.lineIndex).toBe(0); // same as anchor
    });

    it('should insert token after anchor', () => {
        const result = insertToken(tokens, 't2', 'after', 'new', 'zero_duration', DEFAULT_POLICY);

        expect(result.length).toBe(tokens.length + 1);

        const newToken = result.find(t => t.text === 'new');
        expect(newToken).toBeDefined();
        expect(newToken.startMs).toBeGreaterThanOrEqual(1000); // after t2.endMs
    });

    it('should split gap when using split_gap strategy', () => {
        // Gap between t1 (ends at 500) and t2 (starts at 600) is 100ms
        const result = insertToken(tokens, 't2', 'before', 'new', 'split_gap', DEFAULT_POLICY);

        const newToken = result.find(t => t.text === 'new');
        expect(newToken.startMs).toBe(500);
        // Midpoint of gap [500, 600] is 550
        expect(newToken.endMs).toBe(550);
    });

    it('should preserve line index from anchor', () => {
        const result = insertToken(tokens, 't7', 'after', 'test', 'zero_duration', DEFAULT_POLICY);

        const newToken = result.find(t => t.text === 'test');
        expect(newToken.lineIndex).toBe(1); // same as t7
    });
});

// ============================================================================
// T7: deleteTokens
// ============================================================================

describe('deleteTokens (T7)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should delete selected tokens', () => {
        const result = deleteTokens(tokens, ['t2', 't3'], DEFAULT_POLICY);

        expect(result.length).toBe(tokens.length - 2);
        expect(result.find(t => t.id === 't2')).toBeUndefined();
        expect(result.find(t => t.id === 't3')).toBeUndefined();
    });

    it('should preserve unselected tokens', () => {
        const result = deleteTokens(tokens, ['t2'], DEFAULT_POLICY);

        expect(result.find(t => t.id === 't1')).toBeDefined();
        expect(result.find(t => t.id === 't3')).toBeDefined();
    });

    it('should handle empty selection', () => {
        const result = deleteTokens(tokens, [], DEFAULT_POLICY);

        expect(result.length).toBe(tokens.length);
    });

    it('should handle Set input for selection', () => {
        const result = deleteTokens(tokens, new Set(['t1', 't2']), DEFAULT_POLICY);

        expect(result.length).toBe(tokens.length - 2);
    });
});

// ============================================================================
// T8: splitToken
// ============================================================================

describe('splitToken (T8)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should split token into two', () => {
        const splitPoint = { textLeft: 'Hel', textRight: 'lo', splitMs: 250 };
        const result = splitToken(tokens, 't1', splitPoint, DEFAULT_POLICY);

        // Original t1 should be replaced by two new tokens
        expect(result.find(t => t.id === 't1')).toBeUndefined();
        expect(result.length).toBe(tokens.length + 1);

        const leftPart = result.find(t => t.text === 'Hel');
        const rightPart = result.find(t => t.text === 'lo');

        expect(leftPart).toBeDefined();
        expect(rightPart).toBeDefined();
        expect(leftPart.endMs).toBe(250);
        expect(rightPart.startMs).toBe(250);
    });

    it('should preserve line index for both parts', () => {
        const splitPoint = { textLeft: 'Hel', textRight: 'lo', splitMs: 250 };
        const result = splitToken(tokens, 't1', splitPoint, DEFAULT_POLICY);

        const leftPart = result.find(t => t.text === 'Hel');
        const rightPart = result.find(t => t.text === 'lo');

        expect(leftPart.lineIndex).toBe(0);
        expect(rightPart.lineIndex).toBe(0);
    });

    it('should reject split that creates too-short left part', () => {
        // t1 is [0, 500], trying to split at 30 would leave left part of 30ms < minDuration 50ms
        const splitPoint = { textLeft: 'H', textRight: 'ello', splitMs: 30 };
        const result = splitToken(tokens, 't1', splitPoint, DEFAULT_POLICY);

        // Should return unchanged
        expect(result.find(t => t.id === 't1')).toBeDefined();
        expect(result.length).toBe(tokens.length);
    });

    it('should reject split that creates too-short right part', () => {
        // t1 is [0, 500], trying to split at 480 would leave right part of 20ms < minDuration 50ms
        const splitPoint = { textLeft: 'Hell', textRight: 'o', splitMs: 480 };
        const result = splitToken(tokens, 't1', splitPoint, DEFAULT_POLICY);

        // Should return unchanged
        expect(result.find(t => t.id === 't1')).toBeDefined();
        expect(result.length).toBe(tokens.length);
    });
});

// ============================================================================
// T9: mergeTokens
// ============================================================================

describe('mergeTokens (T9)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should merge consecutive tokens with space', () => {
        const result = mergeTokens(tokens, ['t1', 't2'], 'space');

        expect(result.length).toBe(tokens.length - 1);

        const merged = result.find(t => t.text === 'Hello world');
        expect(merged).toBeDefined();
        expect(merged.startMs).toBe(0);
        expect(merged.endMs).toBe(1000);
    });

    it('should merge consecutive tokens with concat', () => {
        const result = mergeTokens(tokens, ['t1', 't2'], 'concat');

        const merged = result.find(t => t.text === 'Helloworld');
        expect(merged).toBeDefined();
    });

    it('should preserve line index', () => {
        const result = mergeTokens(tokens, ['t6', 't7'], 'space');

        const merged = result.find(t => t.text === 'I am');
        expect(merged.lineIndex).toBe(1);
    });

    it('should reject merging tokens from different lines', () => {
        // t5 is on line 0, t6 is on line 1
        const result = mergeTokens(tokens, ['t5', 't6'], 'space');

        // Should return unchanged
        expect(result.length).toBe(tokens.length);
    });

    it('should reject merging less than 2 tokens', () => {
        const result = mergeTokens(tokens, ['t1'], 'space');

        expect(result.length).toBe(tokens.length);
    });
});

// ============================================================================
// T10: validateTokens
// ============================================================================

describe('validateTokens (T10)', () => {
    it('should detect invalid range (start >= end)', () => {
        const tokens = [
            createTokenWithId('t1', 'Bad', 500, 400, 0),
        ];

        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues.some(i => i.type === 'invalid_range')).toBe(true);
    });

    it('should detect too short duration', () => {
        const tokens = [
            createTokenWithId('t1', 'Short', 100, 130, 0), // 30ms < 50ms min
        ];

        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues.some(i => i.type === 'too_short')).toBe(true);
    });

    it('should detect out of bounds (before 0)', () => {
        const tokens = [
            createTokenWithId('t1', 'Early', -100, 500, 0),
        ];

        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues.some(i => i.type === 'out_of_bounds')).toBe(true);
    });

    it('should detect out of bounds (after track end)', () => {
        const tokens = [
            createTokenWithId('t1', 'Late', 9500, 11000, 0),
        ];

        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues.some(i => i.type === 'out_of_bounds')).toBe(true);
    });

    it('should detect empty text', () => {
        const tokens = [
            createTokenWithId('t1', '', 100, 500, 0),
        ];

        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues.some(i => i.type === 'empty_text')).toBe(true);
    });

    it('should detect overlaps when policy disallows them', () => {
        const tokens = [
            createTokenWithId('t1', 'First', 100, 500, 0),
            createTokenWithId('t2', 'Second', 400, 800, 0), // overlaps t1
        ];

        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues.some(i => i.type === 'overlap')).toBe(true);
    });

    it('should not report overlaps when policy allows them', () => {
        const tokens = [
            createTokenWithId('t1', 'First', 100, 500, 0),
            createTokenWithId('t2', 'Second', 400, 800, 0), // overlaps t1
        ];

        const overlapsPolicy = { ...DEFAULT_POLICY, allowOverlaps: true };
        const issues = validateTokens(tokens, 10000, overlapsPolicy);

        expect(issues.some(i => i.type === 'overlap')).toBe(false);
    });

    it('should return empty array for valid tokens', () => {
        const tokens = createTestTokens();
        const issues = validateTokens(tokens, 10000, DEFAULT_POLICY);

        expect(issues).toEqual([]);
    });
});

// ============================================================================
// T11: applyRipple
// ============================================================================

describe('applyRipple (T11)', () => {
    let tokens;

    beforeEach(() => {
        tokens = createTestTokens();
    });

    it('should shift forward tokens by deltaMs', () => {
        // Shift everything after t2 by 100ms on line 0
        const result = applyRipple(tokens, 't2', 100, 'forward');

        const t3 = result.find(t => t.id === 't3');
        const t4 = result.find(t => t.id === 't4');

        expect(t3.startMs).toBe(1200); // 1100 + 100
        expect(t4.startMs).toBe(1700); // 1600 + 100
    });

    it('should not shift tokens on other lines', () => {
        // t2 is on line 0, t6/t7/t8 are on line 1
        const result = applyRipple(tokens, 't2', 100, 'forward');

        const t6 = result.find(t => t.id === 't6');
        expect(t6.startMs).toBe(3000); // unchanged
    });

    it('should shift backward tokens by deltaMs', () => {
        // Shift everything before t3 by 100ms on line 0
        const result = applyRipple(tokens, 't3', 100, 'backward');

        const t1 = result.find(t => t.id === 't1');
        const t2 = result.find(t => t.id === 't2');

        expect(t1.startMs).toBe(100); // 0 + 100
        expect(t2.startMs).toBe(700); // 600 + 100
    });

    it('should not shift the anchor token itself', () => {
        const result = applyRipple(tokens, 't2', 100, 'forward');

        const t2 = result.find(t => t.id === 't2');
        expect(t2.startMs).toBe(600); // unchanged
    });

    it('should handle negative delta', () => {
        const result = applyRipple(tokens, 't2', -50, 'forward');

        const t3 = result.find(t => t.id === 't3');
        expect(t3.startMs).toBe(1050); // 1100 - 50
    });
});
