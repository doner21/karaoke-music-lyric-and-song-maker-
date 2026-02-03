# Skill: Implement Editor UI Components

## Purpose
Build the React UI components for the word-level token timing editor. These components render tokens as draggable/resizable blocks on a time axis.

## Target Directory
`src/components/editor/` — ALL NEW FILES

## Component Hierarchy

```
TokenEditorPanel (root)
├── Toolbar
│   ├── Undo/Redo buttons
│   ├── Policy toggles (Overlaps, Ripple)
│   ├── Import JSON / Export JSON / Copy JSON buttons
│   ├── Validation badge
│   ├── Apply button
│   └── Discard button
├── TokenTimeline (main editing area)
│   ├── TimeAxis (top ruler)
│   ├── TokenLane[] (one per lineIndex)
│   │   └── TokenBlock[] (one per token)
│   │       └── InlineTextEditor (when editing text)
│   └── Playhead (vertical line, placeholder for Cycle 3)
├── ValidationPanel (collapsible bottom)
│   └── IssueRow[]
└── StatusBar (bottom)
    ├── Selection info
    ├── Zoom controls
    └── Playhead time (placeholder)
```

---

## TokenEditorPanel.jsx

**Props:**
```js
{
  lyricsJson,        // The canonical lyrics JSON to edit
  trackDurationMs,   // Total track duration in ms (optional, defaults to max token endMs + 5000)
  onApply,           // (updatedJson) => void — called when user clicks Apply
  onDiscard,         // () => void — called when user clicks Discard
}
```

**Behavior:**
- Initializes `useTokenEditor(lyricsJson, trackDurationMs)`
- Renders toolbar + timeline + validation panel
- Handles keyboard shortcuts at this level (via `useEffect` with `keydown` listener)
- Manages `contextMenu` state (position + visible)

**Styling:**
- Full height flex column
- Dark background matching existing app theme: `bg-gray-900 text-gray-100`
- Toolbar: `bg-gray-800 border-b border-gray-700 p-2 flex gap-2`
- Use Tailwind utility classes throughout (consistent with IntegratedEcologicalOS.jsx)

---

## TokenTimeline.jsx

**Props:**
```js
{
  tokens,             // Token[]
  selection,          // { selectedIds, lastClickedId }
  issues,             // ValidationIssue[]
  pxPerMs,            // number — zoom level (pixels per millisecond)
  scrollLeftMs,       // number — current scroll position in ms
  trackDurationMs,    // number
  onSelectToken,      // (tokenId, mode) => void
  onMoveTokens,       // (selectionIds, deltaMs) => void
  onResizeStart,      // (tokenId, newStartMs) => void
  onResizeEnd,        // (tokenId, newEndMs) => void
  onContextMenu,      // (event, tokenId) => void
  onEditText,         // (tokenId) => void — triggers inline edit
}
```

**Layout:**
- Horizontal scrollable container
- Total width = `trackDurationMs * pxPerMs` pixels
- Tokens grouped into lanes by `lineIndex`
- Each lane is a horizontal row (height ~40px, gap 2px)
- Lane labels on left (fixed position): "Line 1", "Line 2", etc.

**Zoom Levels:**
- Default: `0.05` px/ms (50px per second)
- Range: `0.01` (10px/s, zoomed out) to `0.5` (500px/s, zoomed in)
- Zoom controls: `+` / `-` buttons, or Ctrl+scroll wheel

**Scroll:**
- Horizontal scroll via native overflow-x or translateX
- When a token is selected, auto-scroll to keep it visible

**Time Axis:**
- Rendered at top of timeline
- Major ticks every 10 seconds with labels ("0:10", "0:20", etc.)
- Minor ticks every 1 second
- Tick density adapts to zoom level

---

## TokenBlock.jsx

**Props:**
```js
{
  token,              // Token object
  isSelected,         // boolean
  hasIssue,           // boolean
  pxPerMs,            // number
  onMouseDown,        // (event, tokenId, zone) => void
  // zone: 'body' | 'left-edge' | 'right-edge'
}
```

**Rendering:**
```
left = token.startMs * pxPerMs
width = (token.endMs - token.startMs) * pxPerMs
```

**Visual States:**
- Default: `bg-slate-600 border border-slate-500`
- Selected: `border-2 border-cyan-400 bg-slate-700`
- Has issue: `border-2 border-red-400 bg-red-900/30`
- Hover: `bg-slate-500`

**Edge Zones:**
- Left 6px and right 6px of the block are resize handles
- Cursor changes to `col-resize` on hover over edges
- `onMouseDown` reports which zone was clicked

**Text:**
- Token text is rendered inside, truncated with `text-ellipsis overflow-hidden whitespace-nowrap`
- Font: `text-xs`
- If block is too narrow for text (< 20px), hide text

---

## InlineTextEditor.jsx

**Props:**
```js
{
  token,              // Token being edited
  pxPerMs,            // For positioning
  onCommit,           // (tokenId, newText) => void
  onCancel,           // () => void
}
```

**Behavior:**
- Renders an `<input>` absolutely positioned over the token block
- Auto-focuses on mount
- Commits on `Enter` or `blur`
- Cancels on `Escape`
- Does NOT commit if text is empty (shows brief red flash)

---

## ValidationPanel.jsx

**Props:**
```js
{
  issues,             // ValidationIssue[]
  isOpen,             // boolean
  onToggle,           // () => void
  onGoToToken,        // (tokenId) => void
}
```

**Rendering:**
- Collapsible panel at bottom of editor
- Header: "Validation Issues (N)" with chevron toggle
- Each issue row: icon (based on type), message, "Go to" button
- Type icons: `AlertTriangle` for overlap/range, `Clock` for too_short, `MapPin` for out_of_bounds, `Type` for empty_text

---

## TokenContextMenu.jsx

**Props:**
```js
{
  x, y,               // Position
  visible,            // boolean
  selectedCount,       // number of selected tokens
  onAction,           // (actionType) => void
  onClose,            // () => void
}
```

**Actions:**
- "Edit Text" (single selection only)
- "Split" (single selection only)
- "Merge" (multi-selection, consecutive)
- "Insert Before"
- "Insert After"
- "Delete"

**Styling:**
- `bg-gray-800 border border-gray-600 rounded shadow-lg`
- Menu items: `px-3 py-1.5 hover:bg-gray-700 cursor-pointer text-sm`
- Disabled items: `text-gray-500 cursor-not-allowed`

---

## Integration with IntegratedEcologicalOS.jsx

### Changes needed:

1. Add state: `const [editorMode, setEditorMode] = useState(false);`

2. Add "Edit Timing" button in the ALIGNMENT section (COL 3):
```jsx
{alignResult && (
  <button
    onClick={() => setEditorMode(true)}
    className="flex items-center gap-1 px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs"
  >
    <Pencil size={12} /> Edit Timing
  </button>
)}
```

3. Conditional rendering in COL 2:
```jsx
{editorMode ? (
  <TokenEditorPanel
    lyricsJson={alignResult}
    trackDurationMs={duration * 1000}
    onApply={(updatedJson) => {
      setAlignResult(updatedJson);
      setEditorMode(false);
    }}
    onDiscard={() => setEditorMode(false)}
  />
) : (
  // ... existing Studio panel content
)}
```

4. Import at top: `import { Pencil } from 'lucide-react';` (if not already imported)
5. Import: `import TokenEditorPanel from '../editor/TokenEditorPanel';`

---

## Keyboard Shortcut Reference

Register at TokenEditorPanel level via `useEffect`:

| Key | Action | Condition |
|-----|--------|-----------|
| `←` | Nudge -10ms | Has selection |
| `→` | Nudge +10ms | Has selection |
| `Shift+←` | Nudge -100ms | Has selection |
| `Shift+→` | Nudge +100ms | Has selection |
| `Delete` / `Backspace` | Delete selected | Has selection |
| `Ctrl+Z` | Undo | canUndo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo | canRedo |
| `Ctrl+A` | Select all | Always |
| `Escape` | Clear selection / close context menu | Always |
| `S` | Split at midpoint | Single selection |
| `M` | Merge | Multi-selection, consecutive |
| `E` / `F2` | Edit text | Single selection |

**Note:** Only capture keys when the editor panel has focus. Use `tabIndex={0}` and `onKeyDown` on the panel container div.
