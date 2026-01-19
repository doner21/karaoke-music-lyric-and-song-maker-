/**
 * Canonicalizer - Transforms AudioShake output to KaraokeTimingJSON_v1
 * SEED 44019 | Strategy: Pass-Through (Isolation Testing)
 * Strictness: NONE (Trust Provider Output)
 */

export class Canonicalizer {
    constructor() {
        this.version = 'v1';
    }

    /**
     * Transform provider output to canonical schema
     * @param {Object} providerResult - Raw AudioShake output
     * @param {string} userLyrics - Original lyrics from editor
     * @param {Object} meta - Additional metadata
     * @returns {Object} KaraokeTimingJSON_v1
     */
    transform(providerResult, userLyrics, meta = {}) {
        const tokens = this.extractTokens(providerResult);
        // Note: We use extractLines to group tokens, but we TRUST the text returned by AudioShake
        // precisely because we are testing the 'Strict Alignment' API flow.
        const lines = this.extractLines(providerResult, tokens);

        let filteredCount = 0;
        const lyrics = lines.map((line, lineIdx) => {
            // Light cleaning but preserve basic structure
            const sentenceText = line.text;
            if (!sentenceText) return null;

            // Get tokens for this line
            const lineTokens = tokens.slice(line.startTokenIndex, line.endTokenIndex + 1);
            if (lineTokens.length === 0) return null;

            // Convert to seconds
            const startTime = lineTokens[0].startMs / 1000;
            const endTime = lineTokens[lineTokens.length - 1].endMs / 1000;

            const sentence = {
                start: startTime,
                end: endTime,
                text: sentenceText
            };

            const words = lineTokens.map(t => ({
                start: t.startMs / 1000,
                end: t.endMs / 1000,
                text: t.text,
                row: 0
            }));

            return { sentence, words };
        }).filter(l => l !== null);

        console.log(`[Canonicalizer] Processed ${lyrics.length} lines (Pass-Through Mode)`);

        return {
            title: meta.title || "Unknown Title",
            artist: meta.artist || "Unknown Artist",
            method: "audioshake",
            lyrics: lyrics
        };
    }

    /**
     * Normalize text for matching (lowercase, remove punctuation)
     */
    normalizeForMatching(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, '') // Remove punctuation
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Extract tokens (Unchanged logic, ensures flat token list)
     */
    extractTokens(result) {
        if (!result) return [];

        console.log('[Canonicalizer] extracting tokens. Keys:', Object.keys(result));

        // Helper to normalize token
        const norm = (w) => {
            // Heuristic: If start > 10000, assumes ms. If < 1000, assume seconds? 
            let start = 0;
            if (w.startMs !== undefined) start = parseFloat(w.startMs);
            else if (w.start !== undefined) start = parseFloat(w.start) * 1000;

            if (w.start !== undefined && w.startMs === undefined && parseFloat(w.start) > 500) {
                start = parseFloat(w.start);
            }

            let end = 0;
            if (w.endMs !== undefined) end = parseFloat(w.endMs);
            else if (w.end !== undefined) end = parseFloat(w.end) * 1000;

            if (w.end !== undefined && w.endMs === undefined && parseFloat(w.end) > 500) {
                end = parseFloat(w.end);
            }

            return {
                text: String(w.text || w.word || '').trim(),
                startMs: start,
                endMs: end,
                confidence: w.confidence || w.score || null,
                lineIndex: w.lineIndex ?? w.line_index ?? null
            };
        };

        if (Array.isArray(result.tokens)) return result.tokens.map(norm);
        if (Array.isArray(result.words)) return result.words.map(norm);
        if (result.data && Array.isArray(result.data.tokens)) return result.data.tokens.map(norm);
        if (result.result && Array.isArray(result.result.tokens)) return result.result.tokens.map(norm);

        if (Array.isArray(result.lines)) {
            console.log('[Canonicalizer] Found root lines array - flattening words');
            const tokens = [];
            result.lines.forEach((line, lineIndex) => {
                if (Array.isArray(line.words)) {
                    line.words.forEach(w => {
                        const token = norm(w);
                        token.lineIndex = lineIndex;
                        tokens.push(token);
                    });
                }
            });
            return tokens;
        }

        console.warn('[Canonicalizer] No tokens found in known paths');
        return [];
    }

    /**
     * Extract lines (Unchanged logic)
     */
    extractLines(result, tokens) {
        if (!tokens.length) return [];

        if (Array.isArray(result.lines)) {
            return result.lines.map((line, idx) => ({
                text: line.text,
                startTokenIndex: tokens.findIndex(t => t.startMs === this.toMs(line.start || 0) && t.lineIndex === idx),
                // logic fallback...
                startTokenIndex: tokens.findIndex(t => t.lineIndex === idx),
                endTokenIndex: tokens.length - 1 - [...tokens].reverse().findIndex(t => t.lineIndex === idx)
            }));
        }

        const lineGroups = new Map();
        tokens.forEach((t, idx) => {
            const lineIdx = t.lineIndex ?? 0;
            if (!lineGroups.has(lineIdx)) {
                lineGroups.set(lineIdx, { start: idx, end: idx, texts: [] });
            }
            const group = lineGroups.get(lineIdx);
            group.end = idx;
            group.texts.push(t.text);
        });

        return Array.from(lineGroups.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([_, group]) => ({
                text: group.texts.join(' '),
                startTokenIndex: group.start,
                endTokenIndex: group.end
            }));
    }

    // helper
    toMs(val) {
        return parseFloat(val);
    }

}
