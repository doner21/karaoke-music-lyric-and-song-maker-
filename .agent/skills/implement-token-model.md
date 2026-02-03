# Skill: Implement Token Data Model

## Purpose
Create the foundational data types and factory functions for the token editor's data model.

## Target File
`src/editor/tokenModel.js` — NEW

## Data Shapes

### Token
```js
/**
 * @typedef {Object} Token
 * @property {string} id - Stable UUID (crypto.randomUUID())
 * @property {string} text - Word text (non-empty)
 * @property {number} startMs - Start time in milliseconds (integer)
 * @property {number} endMs - End time in milliseconds (integer)
 * @property {number} lineIndex - Which line/sentence this token belongs to
 */
```

### Policy
```js
/**
 * @typedef {Object} Policy
 * @property {boolean} allowOverlaps - Whether tokens may overlap (default: false)
 * @property {boolean} rippleEnabled - Whether edits ripple to subsequent tokens (default: false)
 * @property {number|null} snapMs - Snap grid in ms, null for no snap (default: null)
 * @property {number} minDurationMs - Minimum token duration (default: 50)
 */
```

### ValidationIssue
```js
/**
 * @typedef {Object} ValidationIssue
 * @property {string} tokenId - ID of the offending token
 * @property {'invalid_range'|'too_short'|'overlap'|'out_of_bounds'|'empty_text'} type
 * @property {string} message - Human-readable description
 */
```

## Functions to Export

```js
export function createToken(text, startMs, endMs, lineIndex)
// Returns a new Token with crypto.randomUUID() id

export function createTokenWithId(id, text, startMs, endMs, lineIndex)
// Returns a Token with a specified id (for testing/deserialization)

export const DEFAULT_POLICY = {
  allowOverlaps: false,
  rippleEnabled: false,
  snapMs: null,
  minDurationMs: 50,
};

export function applySnap(timeMs, snapMs)
// If snapMs is non-null, rounds timeMs to nearest snapMs multiple
// If snapMs is null, returns timeMs unchanged

export function clampMs(value, min, max)
// Clamp an integer millisecond value to [min, max]
```

## Key Invariants
- All time values are integers (use `Math.round()` at boundaries)
- `startMs < endMs` always (enforced by transforms, not model itself)
- IDs are stable — never regenerated unless a token is truly new
- `lineIndex` is preserved through transforms; only `insertToken` and `splitToken` assign it

## Existing Code Reference
- `src/utils/karaokeHelpers.js` has `wordKey(si, wi)` using sentence+word indices — the new model replaces this with UUID-based identification
- The existing `computeAdjustedSentences()` function does similar work to transforms but mutably — the new transforms are pure/immutable
