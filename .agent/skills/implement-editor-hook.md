# Skill: Implement useTokenEditor React Hook

## Purpose
Create the central React hook that wires together the token model, transforms, undo stack, selection state, and validation into a single API consumed by editor UI components.

## Target File
`src/editor/useTokenEditor.js` — NEW

## Dependencies
- `src/editor/tokenModel.js` — Token types, DEFAULT_POLICY
- `src/editor/tokenTransforms.js` — All transform functions
- `src/editor/undoStack.js` — createUndoStack
- `src/editor/jsonAdapters.js` — parseJSONToTokens, tokensToExportJSON

## Hook Signature

```js
export function useTokenEditor(initialLyricsJson, trackDurationMs = Infinity)
```

## Return Value

```js
{
  // State
  tokens,           // Token[] — current token array
  selection,        // { selectedIds: Set<string>, lastClickedId: string|null }
  policy,           // Policy object (mutable via setPolicy)
  issues,           // ValidationIssue[] — current validation issues
  isDirty,          // boolean — true if any edits have been made since init

  // Token Actions (each pushes to undo stack)
  moveTokens(selectionIds, deltaMs),
  resizeTokenStart(tokenId, newStartMs),
  resizeTokenEnd(tokenId, newEndMs),
  nudgeTokens(selectionIds, stepMs),
  editTokenText(tokenId, newText),
  insertToken(anchorTokenId, position, text, timingStrategy),
  deleteTokens(selectionIds),
  splitToken(tokenId, splitPoint),
  mergeTokens(tokenIds, joinStrategy),
  applyRipple(fromTokenId, deltaMs, direction),

  // Selection Actions (do NOT push to undo stack)
  selectToken(tokenId, mode),   // mode: 'replace' | 'toggle' | 'range'
  selectAll(),
  clearSelection(),

  // Policy
  setPolicy(partialPolicy),     // Merge partial policy into current

  // History
  undo(),
  redo(),
  canUndo,        // boolean
  canRedo,        // boolean

  // Export
  exportJSON(metadata),          // Returns canonical JSON object via tokensToExportJSON
  getTokens(),                   // Returns current tokens array (for Apply action)
}
```

## Implementation Pattern

```js
export function useTokenEditor(initialLyricsJson, trackDurationMs = Infinity) {
  // 1. Parse initial tokens
  const initialTokens = useMemo(
    () => parseJSONToTokens(initialLyricsJson),
    [initialLyricsJson]
  );

  // 2. Create undo stack (use useRef so it persists across renders)
  const undoStackRef = useRef(createUndoStack(initialTokens));

  // 3. Token state (driven by undo stack)
  const [tokens, setTokens] = useState(initialTokens);

  // 4. Selection state
  const [selection, setSelection] = useState({ selectedIds: new Set(), lastClickedId: null });

  // 5. Policy state
  const [policy, setPolicyState] = useState(DEFAULT_POLICY);

  // 6. Derived: validation issues
  const issues = useMemo(
    () => validateTokens(tokens, trackDurationMs, policy),
    [tokens, trackDurationMs, policy]
  );

  // 7. Derived: isDirty
  const isDirty = undoStackRef.current.canUndo();

  // 8. Action helper
  const applyTransform = useCallback((transformFn) => {
    const newTokens = transformFn(tokens);
    undoStackRef.current.push(newTokens);
    setTokens(newTokens);
  }, [tokens]);

  // 9. Wrap each transform...
  const moveTokensFn = useCallback((selectionIds, deltaMs) => {
    applyTransform(t => moveTokens(t, selectionIds, deltaMs, policy));
  }, [applyTransform, policy]);

  // ... etc for each transform

  // 10. Undo/Redo
  const undo = useCallback(() => {
    const prev = undoStackRef.current.undo();
    if (prev) setTokens(prev);
  }, []);

  // ... etc
}
```

## Selection Behavior

### selectToken(tokenId, mode)
- `'replace'`: Clear selection, select only this token
- `'toggle'`: If selected, deselect. If not, add to selection. (Ctrl+click)
- `'range'`: Select all tokens between lastClickedId and tokenId on the same lineIndex. (Shift+click)

### Range Selection Algorithm
1. Find lastClickedId and tokenId in the tokens array
2. Both must have the same lineIndex (otherwise fall back to 'replace')
3. Get all tokens with that lineIndex, sorted by startMs
4. Find the indices of both tokens in that sorted sub-array
5. Select all tokens between those indices (inclusive)

## Key Considerations

- The undo stack stores full token array snapshots
- Selection state is NOT part of undo history (selecting/deselecting doesn't push to undo)
- Policy changes are NOT undoable (they're settings, not edits)
- Validation runs automatically on every token change via useMemo
- The hook does NOT manage audio state — that's a separate concern for Cycle 3
