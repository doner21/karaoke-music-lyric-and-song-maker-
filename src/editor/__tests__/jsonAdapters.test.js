/**
 * Unit Tests for JSON Adapters
 */
import { describe, it, expect } from 'vitest';
import { parseJSONToTokens, tokensToExportJSON, validateRoundtrip } from '../jsonAdapters.js';

// ============================================================================
// TEST FIXTURES
// ============================================================================

const sampleCanonicalJson = {
    title: 'Test Song',
    artist: 'Test Artist',
    method: 'test',
    lyrics: [
        {
            sentence: {
                start: 1.0,
                end: 3.0,
                text: 'Hello world today',
            },
            words: [
                { start: 1.0, end: 1.5, text: 'Hello' },
                { start: 1.6, end: 2.0, text: 'world' },
                { start: 2.2, end: 3.0, text: 'today' },
            ],
        },
        {
            sentence: {
                start: 4.0,
                end: 6.0,
                text: 'How are you',
            },
            words: [
                { start: 4.0, end: 4.5, text: 'How' },
                { start: 4.6, end: 5.0, text: 'are' },
                { start: 5.2, end: 6.0, text: 'you' },
            ],
        },
    ],
};

// ============================================================================
// parseJSONToTokens
// ============================================================================

describe('parseJSONToTokens', () => {
    it('should convert canonical JSON to token array', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);

        expect(Array.isArray(tokens)).toBe(true);
        expect(tokens.length).toBe(6);
    });

    it('should assign unique IDs to each token', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);

        const ids = tokens.map(t => t.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size).toBe(ids.length);
    });

    it('should convert seconds to milliseconds', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);

        const firstToken = tokens.find(t => t.text === 'Hello');
        expect(firstToken.startMs).toBe(1000);
        expect(firstToken.endMs).toBe(1500);
    });

    it('should preserve line index from sentence index', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);

        const line0Tokens = tokens.filter(t => t.lineIndex === 0);
        const line1Tokens = tokens.filter(t => t.lineIndex === 1);

        expect(line0Tokens.length).toBe(3);
        expect(line1Tokens.length).toBe(3);
    });

    it('should sort tokens by startMs', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);

        for (let i = 1; i < tokens.length; i++) {
            expect(tokens[i].startMs).toBeGreaterThanOrEqual(tokens[i - 1].startMs);
        }
    });

    it('should handle empty lyrics array', () => {
        const emptyJson = { title: 'Empty', lyrics: [] };
        const tokens = parseJSONToTokens(emptyJson);

        expect(tokens).toEqual([]);
    });

    it('should handle empty words array in sentence', () => {
        const json = {
            title: 'Test',
            lyrics: [
                { sentence: { start: 0, end: 1, text: '' }, words: [] },
            ],
        };
        const tokens = parseJSONToTokens(json);

        expect(tokens).toEqual([]);
    });

    it('should throw on null input', () => {
        expect(() => parseJSONToTokens(null)).toThrow();
    });

    it('should preserve text exactly', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);

        const texts = tokens.map(t => t.text);
        expect(texts).toContain('Hello');
        expect(texts).toContain('world');
        expect(texts).toContain('today');
    });
});

// ============================================================================
// tokensToExportJSON
// ============================================================================

describe('tokensToExportJSON', () => {
    it('should convert tokens back to canonical JSON', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);
        const metadata = { title: 'Test Song', artist: 'Test Artist', method: 'test' };

        const json = tokensToExportJSON(tokens, metadata);

        expect(json.title).toBe('Test Song');
        expect(json.artist).toBe('Test Artist');
        expect(json.method).toBe('test');
        expect(Array.isArray(json.lyrics)).toBe(true);
    });

    it('should group tokens by lineIndex into sentences', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens, {});

        expect(json.lyrics.length).toBe(2);
        expect(json.lyrics[0].words.length).toBe(3);
        expect(json.lyrics[1].words.length).toBe(3);
    });

    it('should convert milliseconds back to seconds', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens, {});

        expect(json.lyrics[0].words[0].start).toBe(1.0);
        expect(json.lyrics[0].words[0].end).toBe(1.5);
    });

    it('should compute sentence start/end from words', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens, {});

        // First sentence: Hello (1.0-1.5), world (1.6-2.0), today (2.2-3.0)
        expect(json.lyrics[0].sentence.start).toBe(1.0);
        expect(json.lyrics[0].sentence.end).toBe(3.0);
    });

    it('should compute sentence text from words', () => {
        const tokens = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens, {});

        expect(json.lyrics[0].sentence.text).toBe('Hello world today');
    });

    it('should handle empty token array', () => {
        const json = tokensToExportJSON([], { title: 'Empty' });

        expect(json.title).toBe('Empty');
        expect(json.lyrics).toEqual([]);
    });

    it('should handle null/undefined input', () => {
        const json = tokensToExportJSON(null, {});
        expect(json.lyrics).toEqual([]);
    });
});

// ============================================================================
// Roundtrip Stability
// ============================================================================

describe('Roundtrip Stability', () => {
    it('should produce equivalent timing after roundtrip', () => {
        const tokens1 = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens1, {});
        const tokens2 = parseJSONToTokens(json);

        expect(validateRoundtrip(tokens1, tokens2)).toBe(true);
    });

    it('should preserve text values exactly', () => {
        const tokens1 = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens1, {});
        const tokens2 = parseJSONToTokens(json);

        const texts1 = tokens1.map(t => t.text).sort();
        const texts2 = tokens2.map(t => t.text).sort();

        expect(texts1).toEqual(texts2);
    });

    it('should preserve lineIndex groupings', () => {
        const tokens1 = parseJSONToTokens(sampleCanonicalJson);
        const json = tokensToExportJSON(tokens1, {});
        const tokens2 = parseJSONToTokens(json);

        const lines1 = tokens1.filter(t => t.lineIndex === 0).length;
        const lines2 = tokens2.filter(t => t.lineIndex === 0).length;

        expect(lines1).toBe(lines2);
    });

    it('should produce timing within ±1ms tolerance', () => {
        // Create tokens with more precise timing
        const preciseJson = {
            lyrics: [
                {
                    sentence: { start: 1.5678, end: 2.3456, text: 'Test' },
                    words: [
                        { start: 1.5678, end: 2.3456, text: 'Test' },
                    ],
                },
            ],
        };

        const tokens1 = parseJSONToTokens(preciseJson);
        const json = tokensToExportJSON(tokens1, {});
        const tokens2 = parseJSONToTokens(json);

        const timeDiff = Math.abs(tokens1[0].startMs - tokens2[0].startMs);
        expect(timeDiff).toBeLessThanOrEqual(1);
    });
});
