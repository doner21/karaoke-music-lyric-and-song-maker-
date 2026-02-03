# Skill: Implement Token Transform Functions

## Purpose
Create the 11 pure transform functions that operate on the Token array immutably. These are the core "business logic" of the editor.

## Target File
`src/editor/tokenTransforms.js` — NEW

## Critical Rules

1. **Pure functions**: No side effects. No mutations. Return new arrays.
2. **Immutable**: Never modify the input `tokens` array or any token in it. Always spread/copy.
3. **Policy-driven**: Overlap prevention, ripple, snap, and min-duration are all controlled by the `policy` parameter.
4. **Testable**: Each function should be independently testable with simple inputs.

## Helper Functions (internal)

```js
// Find token by id
function findToken(tokens, id) → token | undefined

// Find index by id
function findIndex(tokens, id) → number

// Get sorted tokens on the same line
function lineNeighbors(tokens, lineIndex) → Token[]

// Find previous/next token on same line (by startMs order)
function prevToken(tokens, token) → Token | null
function nextToken(tokens, token) → Token | null

// Apply snap grid
function snap(ms, policy) → number
```

## Function Signatures & Behaviors

### T1: moveTokens(tokens, selectionIds, deltaMs, policy)
- Shift startMs and endMs of all selected tokens by deltaMs
- If !allowOverlaps: clamp each token so it doesn't overlap non-selected neighbors on the same line
- Clamp to [0, Infinity] (track duration clamping is done at validation layer)
- Return new tokens array

### T2: resizeTokenStart(tokens, tokenId, newStartMs, policy)
- Set startMs = newStartMs for the target token
- Enforce: newStartMs < endMs - minDurationMs
- If !allowOverlaps: enforce newStartMs >= prevToken.endMs
- Apply snap if policy.snapMs != null
- Return new tokens array

### T3: resizeTokenEnd(tokens, tokenId, newEndMs, policy)
- Set endMs = newEndMs for the target token
- Enforce: newEndMs > startMs + minDurationMs
- If !allowOverlaps: enforce newEndMs <= nextToken.startMs
- Apply snap if policy.snapMs != null
- Return new tokens array

### T4: nudgeTokens(tokens, selectionIds, stepMs, policy)
- Identical to moveTokens but with stepMs as the delta
- stepMs can be negative (nudge left) or positive (nudge right)

### T5: editTokenText(tokens, tokenId, newText)
- Replace token.text with newText
- If newText is empty string, return tokens unchanged (reject)
- Return new tokens array

### T6: insertToken(tokens, anchorTokenId, position, text, timingStrategy)
- position: 'before' | 'after'
- timingStrategy: 'split_gap' | 'zero_duration'
- 'split_gap': new token takes half the gap between anchor and its neighbor
- 'zero_duration': new token gets minDurationMs at the anchor boundary
- New token gets crypto.randomUUID() id
- New token gets same lineIndex as anchor
- Return new tokens array

### T7: deleteTokens(tokens, selectionIds, policy)
- Remove all tokens with ids in selectionIds
- If policy.rippleEnabled: shift subsequent tokens (on same line) to close the gap
- Return new tokens array

### T8: splitToken(tokens, tokenId, splitPoint, policy)
- splitPoint: { textLeft, textRight, splitMs }
- Original [startMs, endMs] becomes two tokens: [startMs, splitMs] and [splitMs, endMs]
- Both get new UUIDs, same lineIndex
- Enforce both halves meet minDurationMs
- Return new tokens array

### T9: mergeTokens(tokens, tokenIds, joinStrategy)
- tokenIds must be consecutive tokens on the same line (sorted by startMs)
- Result: one token spanning [min(startMs), max(endMs)]
- joinStrategy: 'space' → texts joined with ' ', 'concat' → texts joined directly
- New merged token gets a new UUID, same lineIndex
- Return new tokens array

### T10: validateTokens(tokens, trackDurationMs, policy)
- Returns ValidationIssue[] (not a new token array)
- Checks:
  - startMs >= endMs → 'invalid_range'
  - (endMs - startMs) < minDurationMs → 'too_short'
  - Overlap with neighbor on same line (if !allowOverlaps) → 'overlap'
  - startMs < 0 || endMs > trackDurationMs → 'out_of_bounds'
  - text.trim() === '' → 'empty_text'

### T11: applyRipple(tokens, fromTokenId, deltaMs, direction)
- direction: 'forward' → shift all tokens AFTER fromToken by deltaMs
- direction: 'backward' → shift all tokens BEFORE fromToken by deltaMs
- Only affects tokens on the same line as fromToken
- Return new tokens array

## Testing Strategy

Each function needs at minimum:
1. **Happy path**: Normal operation with valid inputs
2. **Boundary**: Token at position 0, token at track end, single-token array
3. **Policy enforcement**: Overlap prevention clamping, min duration enforcement
4. **Immutability check**: `expect(originalTokens).toEqual(originalCopy)` after transform

Test file: `src/editor/__tests__/tokenTransforms.test.js`
