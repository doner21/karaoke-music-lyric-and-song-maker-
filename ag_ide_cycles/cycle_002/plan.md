# Cycle 2 Plan: Word-Level Karaoke Lyrics Timing Editor — Foundation

**Goal:** Implement the core token data model, pure transform functions, JSON adapters, undo/redo stack, and the foundational Edit Mode UI panel that allows users to enter a focused word-timing editor, view/select/manipulate word tokens, and export corrected JSON.

---

## Constraints

1. **Framework**: React 18 + Vite + Tailwind CSS. No new UI libraries. Use `lucide-react` for icons (already installed).
2. **State Management**: React hooks + lifted state (consistent with existing codebase). No Redux/Zustand.
3. **Existing Architecture**: The main UI is `src/components/karaoke-designs/IntegratedEcologicalOS.jsx`. Edit Mode is a contained subsystem — entering/exiting must not break the broader app state.
4. **JSON Schema**: Must be compatible with existing canonical format: `{ title, artist, method, lyrics: [{ sentence: { start, end, text }, words: [{ start, end, text }] }] }`. Times are in **seconds** (float). Internal model uses **milliseconds** (integer) for precision; adapters convert at boundaries.
5. **Audio**: This cycle does NOT implement waveform rendering or audio playback in the editor (deferred to Cycle 3). Audio integration points are stubbed with clear interfaces.
6. **No Test Runner Exists**: Install `vitest` as dev dependency. Create test config. Write unit tests for all transform functions.
7. **Performance**: Token model must handle 5000+ tokens without degradation. Use virtualization if token list exceeds viewport.
8. **Mode Containment (I9)**: Edit Mode operates on a deep copy of lyrics data. Changes are applied back to the parent only on explicit "Apply" action.

---

## Step-by-Step Tasks

### Phase A: Test Infrastructure (`vitest.config.js` — NEW, `package.json` — MODIFY)

1. **Install vitest**: Add `vitest` as a dev dependency.
2. **Create vitest config**: Create `vitest.config.js` at project root with `environment: 'node'` for pure function tests.
3. **Add test script**: Add `"test": "vitest run"` and `"test:watch": "vitest"` to `package.json` scripts.

---

### Phase B: Token Data Model + Pure Transforms (`src/editor/` — NEW)

#### Token Model (`src/editor/tokenModel.js` — NEW)

4. **Define Token type/shape**: `{ id: string, text: string, startMs: number, endMs: number, lineIndex: number }`. IDs are stable UUIDs (use `crypto.randomUUID()`).
5. **Define Policy object shape**: `{ allowOverlaps: boolean, rippleEnabled: boolean, snapMs: number|null, minDurationMs: number }` with defaults: `{ allowOverlaps: false, rippleEnabled: false, snapMs: null, minDurationMs: 50 }`.
6. **Define ValidationIssue shape**: `{ tokenId: string, type: 'invalid_range'|'too_short'|'overlap'|'out_of_bounds'|'empty_text', message: string }`.

#### JSON Adapters (`src/editor/jsonAdapters.js` — NEW)

7. **Implement `parseJSONToTokens(canonicalJson)`**: Convert the canonical lyrics JSON into a flat `Token[]` array. Each word gets a stable `id` (generated on parse). Preserve `lineIndex` from sentence index. Convert seconds → milliseconds (round to int).
8. **Implement `tokensToExportJSON(tokens, metadata)`**: Convert `Token[]` back to canonical JSON format. Group tokens by `lineIndex` into sentences. Convert milliseconds → seconds (float). Recompute sentence-level `start`/`end` from child words. Preserve `metadata` fields (`title`, `artist`, `method`).
9. **Implement roundtrip stability**: `parseJSONToTokens(tokensToExportJSON(parseJSONToTokens(json)))` must produce the same token timings within ±1ms tolerance.

#### Transform Functions (`src/editor/tokenTransforms.js` — NEW)

10. **Implement `moveTokens(tokens, selectionIds, deltaMs, policy)`**: Shift `startMs` and `endMs` of selected tokens by `deltaMs`. Clamp to `[0, trackDurationMs]`. If `!policy.allowOverlaps`, clamp to not overlap neighbors. Return new token array (immutable).
11. **Implement `resizeTokenStart(tokens, tokenId, newStartMs, policy)`**: Change `startMs` of a single token. Enforce `newStartMs < endMs - policy.minDurationMs`. Clamp to predecessor's `endMs` if `!policy.allowOverlaps`. Return new token array.
12. **Implement `resizeTokenEnd(tokens, tokenId, newEndMs, policy)`**: Change `endMs` of a single token. Enforce `newEndMs > startMs + policy.minDurationMs`. Clamp to successor's `startMs` if `!policy.allowOverlaps`. Return new token array.
13. **Implement `nudgeTokens(tokens, selectionIds, stepMs, policy)`**: Equivalent to `moveTokens` with fixed step increments. `stepMs` can be positive or negative.
14. **Implement `editTokenText(tokens, tokenId, newText)`**: Replace `text` field. Reject empty strings (return unchanged). Return new token array.
15. **Implement `insertToken(tokens, anchorTokenId, position, text, timingStrategy)`**: Insert a new token before or after `anchorTokenId`. `timingStrategy` can be `'split_gap'` (bisect gap with neighbor) or `'zero_duration'` (place at anchor boundary with `minDurationMs`). Assign new stable `id`. Return new token array.
16. **Implement `deleteTokens(tokens, selectionIds, policy)`**: Remove tokens by ID. If `policy.rippleEnabled`, shift subsequent tokens to close gaps. Return new token array.
17. **Implement `splitToken(tokens, tokenId, splitPoint, policy)`**: Split one token into two. `splitPoint` is `{ textLeft, textRight, splitMs }` where `splitMs` is the time boundary. The original token's range `[startMs, endMs]` becomes `[startMs, splitMs]` and `[splitMs, endMs]`. Both get new stable IDs. Return new token array.
18. **Implement `mergeTokens(tokens, tokenIds, joinStrategy)`**: Merge consecutive tokens into one. Resulting token spans `[min(startMs), max(endMs)]`. `joinStrategy`: `'space'` joins text with space, `'concat'` joins directly. Return new token array.
19. **Implement `validateTokens(tokens, trackDurationMs, policy)`**: Return `ValidationIssue[]`. Check: `startMs >= endMs`, duration < `minDurationMs`, overlaps (if disallowed), `startMs < 0 || endMs > trackDurationMs`, empty text.
20. **Implement `applyRipple(tokens, fromTokenId, deltaMs, direction)`**: Shift all tokens after (or before) `fromTokenId` by `deltaMs`. `direction` is `'forward'` or `'backward'`. Return new token array.

#### Transform Tests (`src/editor/__tests__/tokenTransforms.test.js` — NEW)

21. **Write unit tests for every transform**: At least 3 tests per function: happy path, edge case (boundary), and policy enforcement (overlap prevention, min duration). Test immutability (original array unchanged). Test `validateTokens` catches all issue types.

#### Adapter Tests (`src/editor/__tests__/jsonAdapters.test.js` — NEW)

22. **Write adapter tests**: Test `parseJSONToTokens` with the existing `wildflower_demo.json` fixture. Test `tokensToExportJSON` produces valid canonical format. Test roundtrip stability.

---

### Phase C: Undo/Redo Stack (`src/editor/undoStack.js` — NEW)

23. **Implement `createUndoStack(initialState)`**: Returns `{ getState, push, undo, redo, canUndo, canRedo, clear }`. Stores snapshots of token arrays. Maximum stack depth of 500 entries. `push(newTokens)` saves current state to undo stack and clears redo stack.
24. **Write undo stack tests** (`src/editor/__tests__/undoStack.test.js` — NEW): Test push/undo/redo cycle. Test that redo is cleared on new push. Test max depth eviction. Test `canUndo`/`canRedo` flags.

---

### Phase D: React Hooks for Editor State (`src/editor/useTokenEditor.js` — NEW)

25. **Implement `useTokenEditor(initialTokens)` hook**: Wraps the token array state with undo stack integration. Exposes: `{ tokens, selection, policy, issues, dispatch }`. `dispatch` accepts action objects like `{ type: 'MOVE', selectionIds, deltaMs }`, `{ type: 'RESIZE_START', tokenId, newStartMs }`, etc. Every dispatch calls the corresponding transform, pushes to undo stack, and re-validates.
26. **Implement selection state**: `{ selectedIds: Set<string>, lastClickedId: string|null }`. Support single-click (replace selection), Ctrl+click (toggle), Shift+click (range select within same line).
27. **Implement policy state**: `{ allowOverlaps, rippleEnabled, snapMs, minDurationMs }` with UI-settable toggles.
28. **Expose `undo()`, `redo()`, `canUndo`, `canRedo`** from the hook.

---

### Phase E: Editor UI Components (`src/components/editor/` — NEW)

#### Edit Mode Entry (`src/components/karaoke-designs/IntegratedEcologicalOS.jsx` — MODIFY)

29. **Add `editorMode` state** (`boolean`, default `false`) to `IntegratedEcologicalOS`.
30. **Add "Edit Timing" button** in the ALIGNMENT section of COL 3 (FAB_PROCESSOR panel). Button is enabled only when `alignResult` contains valid lyrics JSON. Icon: `Pencil` from lucide-react.
31. **When `editorMode` is true**: Replace the COL 2 (Studio) panel content with the `TokenEditorPanel` component. Pass a deep clone of `alignResult` lyrics data. Hide the YouTube player and lyrics preview while in edit mode.
32. **On editor "Apply"**: Receive the updated tokens, convert back to canonical JSON via `tokensToExportJSON`, update `alignResult` in parent state, set `editorMode = false`.
33. **On editor "Discard"**: Set `editorMode = false` without changing `alignResult`.

#### Token Editor Panel (`src/components/editor/TokenEditorPanel.jsx` — NEW)

34. **Create the main editor panel**: Full-height component that replaces COL 2 content. Layout:
    - **Top toolbar**: Undo/Redo buttons, policy toggles (Overlaps, Ripple), validation issue count badge, "Apply" button (green), "Discard" button (red/ghost).
    - **Center area**: Scrollable token timeline view (`TokenTimeline` component).
    - **Bottom bar**: Selection info (count, total duration), current playhead position (placeholder for Cycle 3), zoom controls.
35. **Wire up `useTokenEditor` hook**: Initialize with `parseJSONToTokens(lyricsJson)`. Connect toolbar actions to dispatch.

#### Token Timeline View (`src/components/editor/TokenTimeline.jsx` — NEW)

36. **Render tokens as horizontal blocks** on a time axis. Each token is a colored rectangle with text label. Tokens are grouped by `lineIndex` into horizontal rows/lanes. Time axis shows seconds with tick marks.
37. **Implement horizontal scrolling and zoom**: Zoom level controls pixels-per-second. Scroll position tracks viewport start time. Minimap is optional (defer).
38. **Implement token selection**: Click to select, Ctrl+click for multi-select, Shift+click for range. Selected tokens get a highlight border (cyan/blue).
39. **Implement drag to move**: Mouse down on selected token body → drag horizontally → dispatches `MOVE` action on mouse up. Show ghost preview during drag.
40. **Implement edge resize**: Mouse down on left/right 6px edge zones → drag → dispatches `RESIZE_START` or `RESIZE_END` on mouse up. Cursor changes to `col-resize`.
41. **Implement keyboard shortcuts**:
    - `←/→`: Nudge selected tokens ±10ms
    - `Shift+←/→`: Nudge ±100ms
    - `Delete/Backspace`: Delete selected tokens
    - `Ctrl+Z`: Undo
    - `Ctrl+Shift+Z` or `Ctrl+Y`: Redo
    - `Ctrl+A`: Select all tokens
    - `Escape`: Clear selection
    - `S`: Split selected token at midpoint (if single selection)
    - `M`: Merge selected tokens (if multi-selection, consecutive)
    - `E` or `F2`: Edit text of selected token (if single selection)

#### Token Block (`src/components/editor/TokenBlock.jsx` — NEW)

42. **Render a single token**: Styled div with absolute positioning based on `startMs * pxPerMs` left and `(endMs - startMs) * pxPerMs` width. Truncated text label. Background color based on state: default (slate), selected (cyan border), invalid (red border/bg), overlap warning (amber).
43. **Expose mouse event handlers** for drag/resize/select (delegated from parent `TokenTimeline`).

#### Inline Text Editor (`src/components/editor/InlineTextEditor.jsx` — NEW)

44. **Render an input overlay** when a token enters text-edit mode. Appears over the token block. Commits on Enter or blur. Cancels on Escape. Dispatches `EDIT_TEXT` action.

#### Validation Issues Panel (`src/components/editor/ValidationPanel.jsx` — NEW)

45. **Render a collapsible list of validation issues**. Each issue shows type icon, message, and a "Go to" button that selects the offending token and scrolls it into view. Badge count shown in toolbar.

#### Context Menu (`src/components/editor/TokenContextMenu.jsx` — NEW)

46. **Right-click on token(s)** opens a context menu with: Edit Text, Split, Merge (if multi-select), Insert Before, Insert After, Delete. Each action dispatches to the editor hook.

---

### Phase F: JSON Import/Export UI (`src/components/editor/TokenEditorPanel.jsx` — MODIFY)

47. **Add "Import JSON" button** to the toolbar. Opens a file picker (`<input type="file" accept=".json">`). Parses the file, validates schema, loads into editor via `parseJSONToTokens`. Shows error toast if invalid.
48. **Add "Export JSON" button** to toolbar. Converts current tokens via `tokensToExportJSON`, triggers browser download as `.json` file. Shows warning if validation issues exist (allows override).
49. **Add "Copy JSON" button** to toolbar. Same as export but copies to clipboard via `navigator.clipboard.writeText`. Shows brief "Copied!" confirmation.

---

## Acceptance Criteria

- [ ] **AC1**: A "Edit Timing" button appears in the ALIGNMENT section of COL 3 when alignment JSON data exists. Clicking it replaces COL 2 content with the token editor.
- [ ] **AC2**: `parseJSONToTokens(wildflower_demo.json)` returns an array of Token objects with valid `id`, `text`, `startMs`, `endMs`, `lineIndex` fields. No token has `startMs >= endMs`.
- [ ] **AC3**: `tokensToExportJSON(parseJSONToTokens(json))` produces a JSON structure that matches the canonical schema (has `lyrics[].sentence`, `lyrics[].words[]`). Roundtrip timings match within ±1ms.
- [ ] **AC4**: All 11 transform functions (`moveTokens`, `resizeTokenStart`, `resizeTokenEnd`, `nudgeTokens`, `editTokenText`, `insertToken`, `deleteTokens`, `splitToken`, `mergeTokens`, `validateTokens`, `applyRipple`) pass their unit tests.
- [ ] **AC5**: Overlap prevention: Moving a token that would overlap a neighbor is clamped to the neighbor boundary when `policy.allowOverlaps === false`.
- [ ] **AC6**: Undo/Redo: After performing 5 edits, pressing Undo 5 times returns tokens to initial state. Pressing Redo 5 times restores to the edited state.
- [ ] **AC7**: The token timeline renders tokens as horizontal blocks grouped by line. Clicking a token selects it (cyan border). Ctrl+click adds to selection.
- [ ] **AC8**: Dragging a token horizontally changes its `startMs`/`endMs` by the drag delta. Dragging a token edge resizes it.
- [ ] **AC9**: Keyboard shortcuts work: `←/→` nudge ±10ms, `Delete` removes, `Ctrl+Z` undoes, `S` splits, `M` merges.
- [ ] **AC10**: "Export JSON" button produces a downloadable `.json` file with correct canonical format. "Copy JSON" copies to clipboard.
- [ ] **AC11**: "Apply" button sends updated tokens back to `IntegratedEcologicalOS`, converting via `tokensToExportJSON`, and exits edit mode. "Discard" exits without changes.
- [ ] **AC12**: `validateTokens` catches: inverted ranges, overlaps, out-of-bounds, empty text, too-short duration. Issues panel displays them with navigation.
- [ ] **AC13**: `vitest run` passes with all transform and adapter tests green.
- [ ] **AC14**: Exiting edit mode (Apply or Discard) restores the main Studio panel without breaking player state.

---

## Definition of Done (DoD)

All acceptance criteria (AC1–AC14) pass verification. The cycle artifacts (`plan.md`, `execution.md`, `verification.md`) are complete. `vitest run` returns 0 exit code.

---

## Expected Changes

- **NEW**: `vitest.config.js` — Test runner configuration
- **NEW**: `src/editor/tokenModel.js` — Token type definitions and policy defaults
- **NEW**: `src/editor/jsonAdapters.js` — `parseJSONToTokens()`, `tokensToExportJSON()`
- **NEW**: `src/editor/tokenTransforms.js` — All 11 transform functions (T1–T11)
- **NEW**: `src/editor/undoStack.js` — Undo/redo stack implementation
- **NEW**: `src/editor/useTokenEditor.js` — React hook wrapping transforms + undo + validation
- **NEW**: `src/editor/__tests__/tokenTransforms.test.js` — Transform unit tests
- **NEW**: `src/editor/__tests__/jsonAdapters.test.js` — Adapter + roundtrip tests
- **NEW**: `src/editor/__tests__/undoStack.test.js` — Undo stack tests
- **NEW**: `src/components/editor/TokenEditorPanel.jsx` — Main editor panel component
- **NEW**: `src/components/editor/TokenTimeline.jsx` — Timeline view with zoom/scroll
- **NEW**: `src/components/editor/TokenBlock.jsx` — Individual token block renderer
- **NEW**: `src/components/editor/InlineTextEditor.jsx` — Inline text editing overlay
- **NEW**: `src/components/editor/ValidationPanel.jsx` — Validation issues list
- **NEW**: `src/components/editor/TokenContextMenu.jsx` — Right-click context menu
- **MODIFY**: `src/components/karaoke-designs/IntegratedEcologicalOS.jsx` — Add editorMode state, "Edit Timing" button, conditional rendering of TokenEditorPanel
- **MODIFY**: `package.json` — Add vitest dev dependency, add test scripts

---

## Verification Plan

### Automated Tests

```bash
npx vitest run
```

Expected: All tests in `src/editor/__tests__/` pass.

### Manual Verification

1. **Edit Mode Entry (AC1, AC14)**: Load the app, process a song through alignment. Verify "Edit Timing" button appears in COL 3 ALIGNMENT section. Click it. Verify COL 2 switches to the token editor. Click "Discard". Verify COL 2 returns to normal Studio view with player intact.

2. **Token Rendering (AC7)**: Enter edit mode with alignment data. Verify tokens appear as colored blocks in horizontal lanes grouped by line number. Verify text labels are visible on tokens.

3. **Selection (AC7)**: Click a token — verify cyan selection border. Click another — verify first deselects. Ctrl+click — verify both selected. Escape — verify all deselected.

4. **Drag Move (AC8)**: Select a token and drag it right. Verify start/end times update. Verify the token does not overlap its neighbor (overlap prevention).

5. **Edge Resize (AC8)**: Hover over a token's left edge — verify `col-resize` cursor. Drag left edge — verify only `startMs` changes. Repeat for right edge and `endMs`.

6. **Keyboard Shortcuts (AC9)**: Select a token. Press `→` — verify 10ms nudge. Press `Shift+→` — verify 100ms nudge. Press `Delete` — verify token removed. Press `Ctrl+Z` — verify token restored. Select one token, press `S` — verify split into two. Select two adjacent tokens, press `M` — verify merge into one.

7. **Export JSON (AC10)**: Click "Export JSON" — verify `.json` file downloads. Open it — verify canonical schema structure with `lyrics[].sentence` and `lyrics[].words[]`.

8. **Copy JSON (AC10)**: Click "Copy JSON" — verify clipboard contains valid JSON string.

9. **Apply Changes (AC11)**: Make edits in editor. Click "Apply". Verify edit mode exits. Verify the `alignResult` in the main UI reflects the edited timings (check JSON preview in ALIGNMENT section).

10. **Validation (AC12)**: Manually create an invalid state (e.g., resize a token so it overlaps). Check validation panel shows the issue. Click "Go to" — verify the offending token is selected and scrolled into view.

11. **Roundtrip Test (AC3)**: Export JSON from editor. Re-import the exported JSON. Verify all timings match the pre-export state.

12. **Unit Tests (AC4, AC13)**: Run `npx vitest run`. Verify all tests pass with 0 exit code.

---

## Future Cycles (Out of Scope)

- **Cycle 3**: Audio integration — waveform rendering, transport controls, vocal audition, loop regions, playback rate
- **Cycle 4**: MP3 export from editor, mixed audio export, file naming templates
- **Cycle 5**: Performance optimization — token virtualization, large file handling, profiling
